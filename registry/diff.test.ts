import { test, expect } from "vitest";
import { parseNameStatus } from "./diff";
test("name-status 출력을 바뀐 파일·지운 파일로 나눈다", () => {
  const r = parseNameStatus("A\twords/ko-KR/a.json\nM\twords/ko-KR/b.json\nD\twords/ko-KR/c.json\n\n");
  expect(r.changedFiles).toEqual(["words/ko-KR/a.json", "words/ko-KR/b.json"]);
  expect(r.deletedFiles).toEqual(["words/ko-KR/c.json"]);
});
test("빈 출력", () => expect(parseNameStatus("")).toEqual({ changedFiles: [], deletedFiles: [] }));
test("공백 든 경로는 그대로", () => expect(parseNameStatus("A\twords/a b.json").changedFiles).toEqual(["words/a b.json"]));
