import { test, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkConfig, loadConfigs, type LoadedConfig } from "./config";
import { runAll } from "./validate";
import { writeBuild } from "./write-build";
import { DEFAULT_CONFIG, type RemoteConfig } from "../quiz-core/config";

const good = (o: Partial<RemoteConfig> = {}): RemoteConfig => ({
  version: 1,
  features: { report: true, ask: false, ads: false },
  experiments: [{ id: "funny-wrong", enabled: false, variants: [{ name: "on", weight: 1 }, { name: "off", weight: 1 }] }],
  api: "/api", ...o,
});
const cfg = (data: unknown, fileName = "ko-KR.json"): LoadedConfig => ({ path: `config/remote/${fileName}`, fileName, data });
const messages = (data: unknown, fileName?: string) => checkConfig(cfg(data, fileName)).map(p => p.message).join("\n");

function repo(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "yk-cfg-"));
  for (const [p, c] of Object.entries(files)) { mkdirSync(join(root, p, ".."), { recursive: true }); writeFileSync(join(root, p), c); }
  return root;
}

test("올바른 설정은 문제 없음", () => { expect(checkConfig(cfg(good()))).toEqual([]); });
test("DEFAULT_CONFIG 도 스키마를 통과한다", () => {
  expect(checkConfig(cfg({ ...DEFAULT_CONFIG, version: 1 }))).toEqual([]);
});
test("실제 config/remote/ko-KR.json 이 통과한다", () => {
  const [c] = loadConfigs(process.cwd()).filter(x => x.fileName === "ko-KR.json");
  expect(checkConfig(c)).toEqual([]);
});
test("스키마에 안 맞으면 형식 문제", () => {
  const ps = checkConfig(cfg({ ...good(), version: 0 }));
  expect(ps.length).toBeGreaterThan(0);
  expect(ps[0].rule).toBe("형식");
});
test("모르는 키는 거절", () => { expect(checkConfig(cfg({ ...good(), feature: {} })).length).toBeGreaterThan(0); });
test("features 칸이 빠지면 거절", () => {
  expect(checkConfig(cfg({ ...good(), features: { report: true, ask: false } })).length).toBeGreaterThan(0);
});
test("api 는 / 로 시작하거나 https:// 만", () => {
  expect(checkConfig(cfg(good({ api: "https://api.example.com" })))).toEqual([]);
  expect(checkConfig(cfg(good({ api: "http://x" }))).length).toBeGreaterThan(0);
  expect(checkConfig(cfg(good({ api: "api" }))).length).toBeGreaterThan(0);
});
test("JSON 아니면 형식 문제", () => {
  expect(messages({ __parseError: "boom" })).toContain("JSON 아님");
});
test("가중치 합이 0 이면 실패(꺼진 실험도)", () => {
  const e = { id: "x", enabled: false, variants: [{ name: "a", weight: 0 }, { name: "b", weight: 0 }] };
  expect(messages(good({ experiments: [e] }))).toContain("가중치 합이 0");
});
test("실험 id 중복", () => {
  const e = { id: "x", enabled: true, variants: [{ name: "a", weight: 1 }] };
  expect(messages(good({ experiments: [e, e] }))).toContain("실험 id 중복");
});
test("한 실험 안 변형 이름 중복", () => {
  const e = { id: "x", enabled: true, variants: [{ name: "a", weight: 1 }, { name: "a", weight: 1 }] };
  expect(messages(good({ experiments: [e] }))).toContain("변형 이름 중복");
});
test("파일 이름이 로케일 모양이 아니면 실패", () => {
  expect(messages(good(), "korean.json")).toContain("로케일");
});

test("runAll 이 잘못된 설정을 문제로 돌려준다", () => {
  const ps = runAll({ words: [], configs: [cfg({ ...good(), version: 0 })], banned: {}, changedFiles: [], deletedFiles: [], isBot: false });
  expect(ps.some(p => p.file === "config/remote/ko-KR.json")).toBe(true);
});
test("runAll 은 root 가 있어도 설정 문제를 돌려주고 묶기는 던지지 않는다", () => {
  const root = repo({ "config/remote/ko-KR.json": JSON.stringify({ ...good(), version: 0 }) });
  const ps = runAll({ words: [], configs: loadConfigs(root), banned: {}, changedFiles: [], deletedFiles: [], isBot: false, root });
  expect(ps.length).toBeGreaterThan(0);
});

test("묶으면 단어가 없는 로케일도 config 파일을 쓴다", () => {
  const root = repo({ "config/remote/ko-KR.json": JSON.stringify(good()) });
  const out = join(root, "dist");
  writeBuild(root, out);
  expect(JSON.parse(readFileSync(join(out, "config.ko-KR.json"), "utf8")).version).toBe(1);
  expect(existsSync(join(out, "words.ko-KR.json"))).toBe(false);
});
test("config/remote 가 없어도 묶기는 성공", () => {
  const root = repo({});
  expect(() => writeBuild(root, join(root, "dist"))).not.toThrow();
});
test("스키마에 안 맞는 설정이면 묶기가 던진다", () => {
  const root = repo({ "config/remote/ko-KR.json": JSON.stringify({ ...good(), version: 0 }) });
  expect(() => writeBuild(root, join(root, "dist"))).toThrow();
});
