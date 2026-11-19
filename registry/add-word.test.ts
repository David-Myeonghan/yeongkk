import { test, expect } from "vitest";
import { makeWord } from "./add-word-core";
import { validateWordSchema } from "./schema";
const base = { id: "gatsaeng", word: "갓생", meaning: "부지런한 삶", examples: ["갓생 1", "갓생 2"],
  origin: "", funnyWrong: ["신의 생맥주"], sources: ["https://youtu.be/dQw4w9WgXcQ", "https://www.instagram.com/p/X/"] };
test("입력으로 단어 파일을 만든다", () => {
  const w = makeWord(base, "ko-KR", "2026-12-01");
  expect(w).toMatchObject({ kind: "word", addedBy: "human", status: "active", addedAt: "2026-12-01" });
  expect("origin" in w).toBe(false);
});
test("유래가 있으면 넣는다", () => expect(makeWord({ ...base, origin: "God + 인생" }, "ko-KR", "2026-12-01").origin).toBe("God + 인생"));
test("출처 주소를 정규화(한글 경로 퍼센트 인코딩)", () => {
  const w = makeWord({ ...base, sources: [" https://www.tiktok.com/tag/갓생 ", "https://youtu.be/dQw4w9WgXcQ"] }, "ko-KR", "2026-12-01");
  expect(w.sources[0]).toBe("https://www.tiktok.com/tag/%EA%B0%93%EC%83%9D");
  expect(validateWordSchema(w).ok).toBe(true);
});
test("주소가 아니면 던진다", () => {
  expect(() => makeWord({ ...base, sources: ["not a url"] }, "ko-KR", "2026-12-01")).toThrow();
});
