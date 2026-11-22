import type { KeyValue } from "./progress";

export const COMPLETED_KEY = "yk.completed.v1";
const heldInMemory = new Set<string>();

/** 이 판의 완주를 처음 기록하면 true. 다시 보거나 새로고침하면 false. */
export function markRoundCompleted(store: KeyValue, roundId: string): boolean {
  if (heldInMemory.has(roundId)) return false;
  try {
    if (store.get(COMPLETED_KEY) === roundId) return false;
  } catch {
    // 저장소가 막혔으면 메모리로만 기억한다
  }
  heldInMemory.add(roundId);
  try {
    store.set(COMPLETED_KEY, roundId);
  } catch {
    // 위에서 메모리에 남겼다
  }
  return true;
}
