import { test, expect } from "vitest";
import { runAll } from "./validate";
import { sampleWord, loaded } from "./testkit";
test("형식이 틀린 파일은 다른 검사를 건너뛴다", () => {
  const ps = runAll({ words: [loaded({ __parseError: "x" }), loaded(sampleWord())], banned: {}, changedFiles: [], deletedFiles: [], isBot: false });
  expect(ps.map(p => p.rule)).toEqual(["형식"]);
});
test("문제 없음", () => {
  expect(runAll({ words: [loaded(sampleWord())], banned: {}, changedFiles: ["words/ko-KR/gatsaeng.json"], deletedFiles: [], isBot: true })).toEqual([]);
});
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
test("root 가 있으면 실제로 묶어 보고 통과", () => {
  const root = mkdtempSync(join(tmpdir(), "yk-"));
  mkdirSync(join(root, "words/ko-KR"), { recursive: true });
  writeFileSync(join(root, "words/ko-KR/gatsaeng.json"), JSON.stringify(sampleWord()));
  expect(runAll({ words: [loaded(sampleWord())], banned: {}, changedFiles: [], deletedFiles: [], isBot: false, root })).toEqual([]);
});
