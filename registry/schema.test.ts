import { test, expect } from "vitest";
import { validateWordSchema } from "./schema";
import { sampleWord } from "./testkit";

test("올바른 단어는 통과", () => {
  expect(validateWordSchema(sampleWord()).ok).toBe(true);
});
test("필수 칸이 없으면 실패", () => {
  const w: any = sampleWord(); delete w.meaning;
  const r = validateWordSchema(w);
  expect(r.ok).toBe(false);
  expect(r.errors.join()).toContain("meaning");
});
test("모르는 칸이 있으면 실패", () => {
  expect(validateWordSchema({ ...sampleWord(), extra: 1 }).ok).toBe(false);
});
test("빈칸·공백만·제어/방향 글자는 실패", () => {
  for (const o of [{ word: " " }, { word: "​" }, { meaning: "   " }, { word: "킹‮받네" }, { examples: ["갓생\u0007", "갓생 살기"] }, { funnyWrong: ["⁦갓"] }, { origin: "  " }])
    expect(validateWordSchema(sampleWord(o as any)).ok, JSON.stringify(o)).toBe(false);
});
test("이모지 이음 글자(ZWJ)는 허용", () => {
  expect(validateWordSchema(sampleWord({ examples: ["갓생 👨‍👩‍👧", "갓생 살기"] })).ok).toBe(true);
});
