import { describe, expect, it } from "vitest";
import { createStore } from "./storage";

function fakeStorage(fail: { get?: boolean; set?: boolean; remove?: boolean } = {}) {
  const data = new Map<string, string>();
  let calls = 0;
  const storage = {
    getItem(key: string) {
      calls++;
      if (fail.get) throw new Error("SecurityError");
      return data.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      calls++;
      if (fail.set) throw new Error("QuotaExceededError");
      data.set(key, value);
    },
    removeItem(key: string) {
      calls++;
      if (fail.remove) throw new Error("SecurityError");
      data.delete(key);
    },
  };
  return { storage, data, calls: () => calls };
}

describe("createStore — localStorage 감싸기", () => {
  it("정상 저장소면 그대로 쓴다", () => {
    const fake = fakeStorage();
    const store = createStore(() => fake.storage);
    store.set("k", "v");
    expect(fake.data.get("k")).toBe("v");
    expect(store.get("k")).toBe("v");
    store.remove("k");
    expect(store.get("k")).toBeNull();
  });

  it("저장소에 손대는 것만으로 던지면 메모리로 돈다", () => {
    const store = createStore(() => {
      throw new Error("SecurityError: localStorage 막힘");
    });
    expect(store.get("k")).toBeNull();
    store.set("k", "v");
    expect(store.get("k")).toBe("v");
    store.remove("k");
    expect(store.get("k")).toBeNull();
  });

  it("저장소가 없으면 메모리로 돈다", () => {
    const store = createStore(() => undefined);
    store.set("k", "v");
    expect(store.get("k")).toBe("v");
  });

  it("setItem 이 던지면 그 뒤로는 메모리만 쓰고 던지지 않는다", () => {
    const fake = fakeStorage({ set: true });
    const store = createStore(() => fake.storage);
    expect(() => store.set("k", "v")).not.toThrow();
    expect(store.get("k")).toBe("v");
    const before = fake.calls();
    store.set("k", "w");
    expect(store.get("k")).toBe("w");
    expect(fake.calls()).toBe(before);
  });

  it("getItem 이 던져도 null 을 주고 던지지 않는다", () => {
    const fake = fakeStorage({ get: true });
    const store = createStore(() => fake.storage);
    expect(store.get("k")).toBeNull();
    store.set("k", "v");
    expect(store.get("k")).toBe("v");
  });

  it("removeItem 이 던져도 던지지 않고 메모리 값도 지운다", () => {
    const fake = fakeStorage({ remove: true });
    const store = createStore(() => fake.storage);
    store.set("k", "v");
    expect(() => store.remove("k")).not.toThrow();
    expect(store.get("k")).toBeNull();
  });

  it("만들 때는 저장소에 손대지 않는다", () => {
    let touched = false;
    createStore(() => {
      touched = true;
      return undefined;
    });
    expect(touched).toBe(false);
  });
});
