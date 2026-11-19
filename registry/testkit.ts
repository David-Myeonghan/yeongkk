import type { Word, LoadedWord } from "./types";
export function sampleWord(o: Partial<Word> = {}): Word {
  return {
    id: "gatsaeng", locale: "ko-KR", kind: "word", word: "갓생",
    meaning: "부지런하고 계획적으로 사는 삶",
    examples: ["요즘 아침 6시 기상으로 갓생 사는 중", "방학 때 갓생 살기 도전"],
    origin: "God + 인생", funnyWrong: ["신이 내린 생맥주"],
    sources: ["https://www.youtube.com/watch?v=abc123", "https://www.instagram.com/p/XYZ/"],
    addedBy: "human", addedAt: "2026-12-01", status: "active", ...o,
  };
}
export function loaded(data: unknown, path = "words/ko-KR/gatsaeng.json"): LoadedWord {
  const [, folderLocale, fileName] = path.split("/");
  return { path, folderLocale, fileName, data };
}
