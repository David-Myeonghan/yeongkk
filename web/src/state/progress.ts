export interface KeyValue {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export interface Progress {
  roundId: string;
  wordIds: string[];
  answers: { wordId: string; choice: number; correct: boolean }[];
  startedAt: number;
}

export const PROGRESS_KEY = "yk.progress.v1";
const MAX_AGE_MS = 6 * 3_600_000;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isId = (v: unknown): v is string => typeof v === "string" && v.length > 0;

function toProgress(raw: unknown): Progress | null {
  if (!isRecord(raw)) return null;
  const { roundId, wordIds, answers, startedAt } = raw;
  if (!isId(roundId)) return null;
  if (typeof startedAt !== "number" || !Number.isFinite(startedAt)) return null;
  if (!Array.isArray(wordIds) || wordIds.length === 0 || !wordIds.every(isId)) return null;
  if (!Array.isArray(answers) || answers.length > wordIds.length) return null;
  const parsed: Progress["answers"] = [];
  for (const [i, a] of answers.entries()) {
    if (!isRecord(a) || a.wordId !== wordIds[i]) return null;
    if (typeof a.choice !== "number" || !Number.isInteger(a.choice) || a.choice < 0) return null;
    if (typeof a.correct !== "boolean") return null;
    parsed.push({ wordId: a.wordId, choice: a.choice, correct: a.correct });
  }
  return { roundId, wordIds: [...wordIds], answers: parsed, startedAt };
}

export function saveProgress(store: KeyValue, p: Progress): void {
  try {
    store.set(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    // 저장 실패는 이어 풀기만 잃는다
  }
}

export function loadProgress(store: KeyValue, now: number): Progress | null {
  let text: string | null;
  try {
    text = store.get(PROGRESS_KEY);
  } catch {
    return null;
  }
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  const p = toProgress(raw);
  if (p === null || now - p.startedAt > MAX_AGE_MS) return null;
  return p;
}

export function clearProgress(store: KeyValue): void {
  try {
    store.remove(PROGRESS_KEY);
  } catch {
    // 지우기 실패도 화면을 막지 않는다
  }
}
