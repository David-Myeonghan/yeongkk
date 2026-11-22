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

export function isNew(word: Word, today: string, withinDays = 7): boolean {
  const added = utcDay(word.addedAt);
  const now = utcDay(today);
  if (now === null || added === null) return false;
  const age = now - added;
  return age >= 0 && age <= withinDays;
}

export function pickRound(words: Word[], opts: RoundOptions): Word[] {
  const { rng } = opts;
  const size = Math.max(0, Math.floor(opts.size ?? 10));
  const newCount = Math.max(0, Math.floor(opts.newCount ?? 3));
  const withinDays = opts.newWithinDays ?? 7;

  const seen = new Set<string>();
  const active = words.filter((w) => {
    if ((w.status ?? "active") !== "active" || seen.has(w.id)) return false;
    seen.add(w.id);
    return true;
  });
  const fresh = shuffled(
    active.filter((w) => isNew(w, opts.today, withinDays)),
    rng,
  );
  const old = shuffled(
    active.filter((w) => !isNew(w, opts.today, withinDays)),
    rng,
  );

  const chosenNew = fresh.slice(0, Math.min(newCount, size));
  const rest = [...old, ...fresh.slice(chosenNew.length)];
  const chosen = [...chosenNew, ...rest.slice(0, size - chosenNew.length)];
  return shuffled(chosen, rng);
}
