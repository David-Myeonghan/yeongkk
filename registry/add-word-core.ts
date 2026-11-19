import type { Word } from "./types";
export interface Answers { id: string; word: string; meaning: string; examples: string[]; origin: string; funnyWrong: string[]; sources: string[] }
export function makeWord(a: Answers, locale: string, today: string): Word {
  return { id: a.id, locale, kind: "word", word: a.word, meaning: a.meaning, examples: a.examples,
    ...(a.origin ? { origin: a.origin } : {}), funnyWrong: a.funnyWrong, sources: a.sources.map(s => new URL(s.trim()).href),
    addedBy: "human", addedAt: today, status: "active" };
}
