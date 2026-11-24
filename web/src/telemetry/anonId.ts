import type { KeyValue } from "../state/progress";

export const ANON_KEY = "yk.anon.v1";
const ANON_RULE = /^[A-Za-z0-9_-]{8,64}$/;
const FALLBACK = "anon00000000";

const heldInMemory = new WeakMap<KeyValue, string>();

function fresh(random: () => string): string {
  let candidate: string;
  try {
    candidate = random();
  } catch {
    candidate = "";
  }
  if (ANON_RULE.test(candidate)) return candidate;
  const cleaned = candidate.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 56);
  const padded = `${cleaned}${Math.random().toString(36).slice(2, 12)}`;
  return ANON_RULE.test(padded) ? padded : FALLBACK + Date.now().toString(36);
}

/** 기기 안에서 만든 무작위 값 하나. 저장소를 못 쓰면 이번 페이지 동안만 산다. */
export function getAnonId(store: KeyValue, random: () => string): string {
  const held = heldInMemory.get(store);
  if (held) return held;
  try {
    const stored = store.get(ANON_KEY);
    if (stored !== null && ANON_RULE.test(stored)) return stored;
  } catch {
    // 저장소가 막힌 브라우저
  }
  const id = fresh(random);
  try {
    store.set(ANON_KEY, id);
  } catch {
    heldInMemory.set(store, id);
  }
  return id;
}
