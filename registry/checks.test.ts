import { test, expect } from "vitest";
import { checkFormat } from "./checks";
import { sampleWord, loaded } from "./testkit";

test("정상 파일 통과", () => expect(checkFormat(loaded(sampleWord()))).toEqual([]));
test("깨진 JSON", () => expect(checkFormat(loaded({ __parseError: "x" }))[0].message).toContain("JSON"));
test("폴더 로케일 ≠ 파일 locale", () => {
  expect(checkFormat(loaded(sampleWord(), "words/en-US/gatsaeng.json")).map(p => p.message).join()).toContain("로케일");
});
test("파일 이름 ≠ id", () => {
  expect(checkFormat(loaded(sampleWord(), "words/ko-KR/other.json")).length).toBe(1);
});
test("파일 이름에 대문자", () => {
  expect(checkFormat(loaded(sampleWord({ id: "Gat" }), "words/ko-KR/Gat.json")).length).toBeGreaterThan(0);
});
