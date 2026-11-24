import { test, expect } from "vitest";
import { buildLocale } from "./build";
import { sampleWord } from "./testkit";
test("active 만, id 순, 공개 칸만", () => {
  const out = buildLocale([
    sampleWord({ id: "b", word: "비" }),
    sampleWord({ id: "a", word: "에이" }),
    sampleWord({ id: "c", word: "씨", status: "retired" }),
    sampleWord({ id: "d", word: "디", locale: "en-US" }),
  ], "ko-KR");
  expect(out.count).toBe(2);
  expect(out.words.map(w => w.id)).toEqual(["a", "b"]);
  expect(Object.keys(out.words[0])).not.toContain("sources");
});
test("공개 칸에 addedAt 이 들어간다", () => {
  const out = buildLocale([sampleWord({ addedAt: "2026-12-05" })], "ko-KR");
  expect(out.words[0].addedAt).toBe("2026-12-05");
});
