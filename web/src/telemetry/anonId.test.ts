import { describe, expect, it } from "vitest";
import type { KeyValue } from "../state/progress";
import { ANON_KEY, getAnonId } from "./anonId";

const memoryStore = (): KeyValue & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    get: (k) => data.get(k) ?? null,
    set: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };
};

const throwing = (): KeyValue => ({
  get: () => {
    throw new Error("SecurityError");
  },
  set: () => {
    throw new Error("QuotaExceededError");
  },
  remove: () => {
    throw new Error("SecurityError");
  },
});

const counter = () => {
  let n = 0;
  return () => `generated-id-${++n}`;
};

describe("getAnonId", () => {
  it("두 번 불러도 같은 값이고 저장소에 남는다", () => {
    const store = memoryStore();
    const random = counter();
    const first = getAnonId(store, random);
    expect(getAnonId(store, random)).toBe(first);
    expect(store.data.get(ANON_KEY)).toBe(first);
  });

  it("저장된 값이 서버 규칙에 맞으면 그대로 쓴다", () => {
    const store = memoryStore();
    store.data.set(ANON_KEY, "abc_DEF-12345");
    expect(getAnonId(store, counter())).toBe("abc_DEF-12345");
  });

  it.each(["short", "has space in it", "a".repeat(65), "한글한글한글한글한글", ""])("규칙에 안 맞는 저장값 %j 는 새로 만든다", (bad) => {
    const store = memoryStore();
    store.data.set(ANON_KEY, bad);
    const id = getAnonId(store, counter());
    expect(id).toBe("generated-id-1");
    expect(store.data.get(ANON_KEY)).toBe(id);
  });

  it("저장소가 던져도 값을 주고, 같은 실행에서는 같은 값", () => {
    const store = throwing();
    const random = counter();
    const first = getAnonId(store, random);
    expect(first).toMatch(/^generated-id-/);
    expect(getAnonId(store, random)).toBe(first);
  });

  it("random 이 규칙에 안 맞는 값을 줘도 서버 규칙에 맞는 값만 낸다", () => {
    const id = getAnonId(memoryStore(), () => "x");
    expect(id).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });
});
