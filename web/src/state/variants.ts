import { isRecord } from "../data/guards";
import type { KeyValue } from "./progress";

export const ROUND_FLAGS_KEY = "yk.round-flags.v1";

export interface RoundFlags {
  roundId: string;
  funnyWrong: boolean;
  variant: string | null;
}

export function loadRoundFlags(store: KeyValue, roundId: string): RoundFlags | null {
  try {
    const text = store.get(ROUND_FLAGS_KEY);
    if (text === null) return null;
    const raw: unknown = JSON.parse(text);
    if (!isRecord(raw)) return null;
    if (raw.roundId !== roundId || typeof raw.funnyWrong !== "boolean") return null;
    return { roundId, funnyWrong: raw.funnyWrong, variant: typeof raw.variant === "string" ? raw.variant : null };
  } catch {
    return null;
  }
}

export function saveRoundFlags(store: KeyValue, flags: RoundFlags): void {
  try {
    store.set(ROUND_FLAGS_KEY, JSON.stringify(flags));
  } catch {
    // 저장이 막히면 이 판은 기본(켜짐)으로 돈다
  }
}

/** 판이 시작될 때 정해 둔 값. 없으면(옛 판) 제품 기본값인 켜짐. */
export function funnyWrongOn(store: KeyValue, roundId: string): boolean {
  return loadRoundFlags(store, roundId)?.funnyWrong ?? true;
}
