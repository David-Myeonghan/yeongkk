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
