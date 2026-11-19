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
