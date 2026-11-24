import { test, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { writeBuild } from "./write-build";
import { sampleWord } from "./testkit";

function repo(data: string) {
  const root = mkdtempSync(join(tmpdir(), "yk-"));
  mkdirSync(join(root, "words/ko-KR"), { recursive: true });
  writeFileSync(join(root, "words/ko-KR/gatsaeng.json"), data);
  return root;
}
test("단어 묶음 파일과 index.html 을 쓴다", () => {
  const root = repo(JSON.stringify(sampleWord()));
  const out = join(root, "dist");
  writeBuild(root, out);
  expect(JSON.parse(readFileSync(join(out, "words.ko-KR.json"), "utf8")).count).toBe(1);
  expect(existsSync(join(out, "index.html"))).toBe(true);
});
test("형식이 틀리면 던진다", () => {
  const root = repo("{ not json");
  expect(() => writeBuild(root, join(root, "dist"))).toThrow();
});
test("단어가 하나도 없는 로케일 폴더도 빈 묶음 파일을 쓴다", () => {
  const root = mkdtempSync(join(tmpdir(), "yk-"));
  mkdirSync(join(root, "words/ko-KR"), { recursive: true });
  const out = join(root, "dist");
  writeBuild(root, out);
  expect(JSON.parse(readFileSync(join(out, "words.ko-KR.json"), "utf8"))).toEqual({ locale: "ko-KR", count: 0, words: [] });
});
test("단어가 있는 로케일 폴더의 결과는 그대로", () => {
  const root = repo(JSON.stringify(sampleWord()));
  mkdirSync(join(root, "words/en-US"));
  const out = join(root, "dist");
  writeBuild(root, out);
  const ko = JSON.parse(readFileSync(join(out, "words.ko-KR.json"), "utf8"));
  expect(ko.count).toBe(1);
  expect(ko.words).toHaveLength(1);
  expect(JSON.parse(readFileSync(join(out, "words.en-US.json"), "utf8")).count).toBe(0);
});
test("words 아래의 파일이나 로케일이 아닌 폴더는 묶음 파일을 만들지 않는다", () => {
  const root = mkdtempSync(join(tmpdir(), "yk-"));
  mkdirSync(join(root, "words/drafts"), { recursive: true });
  writeFileSync(join(root, "words/README.md"), "x");
  const out = join(root, "dist");
  const written = writeBuild(root, out);
  expect(written.filter(f => f.includes("words."))).toEqual([]);
  expect(existsSync(join(out, "words.README.md.json"))).toBe(false);
});
