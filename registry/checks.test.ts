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

import type { Word } from "./types";
import { checkDuplicates } from "./checks";
const v = (o: Partial<Word>, path: string) => ({ path, word: sampleWord(o) });
test("같은 로케일 같은 말 = 중복 (공백·NFD·은퇴 포함)", () => {
  const nfd = "갓생".normalize("NFD");
  const ps = checkDuplicates([
    v({}, "words/ko-KR/gatsaeng.json"),
    v({ id: "gat-2", word: ` ${nfd} `, status: "retired" }, "words/ko-KR/gat-2.json"),
  ]);
  expect(ps.length).toBe(1);
  expect(ps[0].file).toBe("words/ko-KR/gat-2.json");
});
test("다른 로케일이면 중복 아님", () => {
  expect(checkDuplicates([v({}, "a"), v({ locale: "en-US" }, "b")])).toEqual([]);
});
