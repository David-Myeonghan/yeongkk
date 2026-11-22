import { shuffled, type Rng } from "./rng";
import type { Word } from "./types";

export interface RoundOptions {
  today: string;
  rng: Rng;
  size?: number;
  newCount?: number;
  newWithinDays?: number;
}

const DAY_MS = 86_400_000;

function utcDay(date: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  const parsed = new Date(ms);
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) {
    return null;
  }
  return ms / DAY_MS;
}

function isNew(word: Word, today: number | null, withinDays: number): boolean {
  const added = utcDay(word.addedAt);
  if (today === null || added === null) return false;
  const age = today - added;
  return age >= 0 && age <= withinDays;
}

export function pickRound(words: Word[], opts: RoundOptions): Word[] {
  const { rng } = opts;
  const size = Math.max(0, Math.floor(opts.size ?? 10));
  const newCount = Math.max(0, Math.floor(opts.newCount ?? 3));
  const withinDays = opts.newWithinDays ?? 7;
  const today = utcDay(opts.today);

  const active = words.filter((w) => (w.status ?? "active") === "active");
  const fresh = shuffled(
    active.filter((w) => isNew(w, today, withinDays)),
    rng,
  );
  const old = shuffled(
    active.filter((w) => !isNew(w, today, withinDays)),
    rng,
  );

  const chosenNew = fresh.slice(0, Math.min(newCount, size));
  const rest = [...old, ...fresh.slice(chosenNew.length)];
  const chosen = [...chosenNew, ...rest.slice(0, size - chosenNew.length)];
  return shuffled(chosen, rng);
}
