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
