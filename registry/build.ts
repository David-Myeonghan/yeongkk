import type { Word } from "./types";
export interface PublicWord { id: string; word: string; meaning: string; examples: string[]; origin?: string; funnyWrong: string[]; addedAt: string }
export function buildLocale(words: Word[], locale: string) {
  const list: PublicWord[] = words
    .filter(w => w.locale === locale && w.status === "active")
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(({ id, word, meaning, examples, origin, funnyWrong, addedAt }) => ({ id, word, meaning, examples, ...(origin ? { origin } : {}), funnyWrong, addedAt }));
  return { locale, count: list.length, words: list };
}
