import type { Word } from "@yk/quiz-core/types";
import { isRecord, isString } from "./guards";

export type LoadWordsResult =
  | { ok: true; words: Word[] }
  | { ok: false; reason: "network" | "empty" | "bad-shape" };

function toWord(raw: unknown): Word | null {
  if (!isRecord(raw)) return null;
  const { id, word, meaning, examples, origin, funnyWrong, addedAt } = raw;
  if (!isString(id) || !isString(word) || !isString(meaning) || !isString(addedAt)) return null;
  if (!Array.isArray(examples) || !examples.every(isString)) return null;
  const result: Word = { id, word, meaning, examples: [...examples], addedAt };
  if (isString(origin)) result.origin = origin;
  if (Array.isArray(funnyWrong)) result.funnyWrong = funnyWrong.filter(isString);
  return result;
}

export async function loadWords(fetchFn: typeof fetch, locale: string): Promise<LoadWordsResult> {
  let text: string;
  try {
    const res = await fetchFn(`/words.${locale}.json`, { cache: "no-cache" });
    if (!res.ok) return { ok: false, reason: "network" };
    text = await res.text();
  } catch {
    return { ok: false, reason: "network" };
  }
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return { ok: false, reason: "bad-shape" };
  }
  if (!isRecord(body) || !Array.isArray(body.words)) return { ok: false, reason: "bad-shape" };
  const words = body.words.map(toWord).filter((w): w is Word => w !== null);
  return words.length > 0 ? { ok: true, words } : { ok: false, reason: "empty" };
}
