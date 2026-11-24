import { describe, expect, it } from "vitest";
import { markRoundCompleted, COMPLETED_KEY } from "./completed";
import type { KeyValue } from "./progress";

const memoryStore = (): KeyValue => {
  const data = new Map<string, string>();
  return { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), remove: (k) => void data.delete(k) };
};

describe("markRoundCompleted", () => {
  it("판마다 처음 한 번만 true", () => {
    const store = memoryStore();
    expect(markRoundCompleted(store, "r1")).toBe(true);
    expect(markRoundCompleted(store, "r1")).toBe(false);
    expect(markRoundCompleted(store, "r2")).toBe(true);
    expect(markRoundCompleted(store, "r2")).toBe(false);
  });

  it("저장소가 던지면 이번 실행 동안은 한 번만(메모리)", () => {
    const boom = () => {
      throw new Error("x");
    };
    const store: KeyValue = { get: boom, set: boom, remove: boom };
    expect(markRoundCompleted(store, "mem-1")).toBe(true);
    expect(markRoundCompleted(store, "mem-1")).toBe(false);
  });

  it("저장 키", () => {
    expect(COMPLETED_KEY).toBe("yk.completed.v1");
  });
});
