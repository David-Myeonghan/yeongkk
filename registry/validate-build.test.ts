import { test, expect, vi } from "vitest";
vi.mock("./write-build", () => ({ writeBuild: vi.fn(() => { throw new Error("boom"); }) }));
import { runAll } from "./validate";
import { sampleWord, loaded } from "./testkit";
test("묶기가 던지면 묶기 문제로 보고", () => {
  const ps = runAll({ words: [loaded(sampleWord())], banned: {}, changedFiles: [], deletedFiles: [], isBot: false, root: "/nowhere" });
  expect(ps.map(p => p.rule)).toEqual(["묶기"]);
  expect(ps[0].message).toContain("boom");
});
test("형식 문제가 있으면 묶기는 건너뜀", () => {
  const ps = runAll({ words: [loaded({ __parseError: "x" })], banned: {}, changedFiles: [], deletedFiles: [], isBot: false, root: "/nowhere" });
  expect(ps.map(p => p.rule)).toEqual(["형식"]);
});
