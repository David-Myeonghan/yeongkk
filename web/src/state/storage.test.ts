import { describe, expect, it } from "vitest";
import { createStore } from "./storage";

function fakeStorage(fail: { get?: boolean; set?: boolean | string | number; remove?: boolean } = {}) {
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
      const failing =
        fail.set === true ||
        (typeof fail.set === "string" && fail.set === key) ||
        (typeof fail.set === "number" && calls > fail.set);
      if (failing) throw new Error("QuotaExceededError");
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

  it("setItem 이 던지면 그 키만 메모리에 두고 던지지 않는다", () => {
    const fake = fakeStorage({ set: true });
    const store = createStore(() => fake.storage);
    expect(() => store.set("k", "v")).not.toThrow();
    expect(store.get("k")).toBe("v");
    store.set("k", "w");
    expect(store.get("k")).toBe("w");
  });

  it("한 키의 쓰기가 실패해도 이미 저장된 다른 값은 계속 읽힌다", () => {
    const fake = fakeStorage({ set: "bad" });
    fake.data.set("round", "flag");
    const store = createStore(() => fake.storage);
    expect(() => store.set("bad", "new")).not.toThrow();
    expect(store.get("round")).toBe("flag");
    expect(store.get("bad")).toBe("new");
    expect(fake.data.has("bad")).toBe(false);
  });

  it("N 번째 호출부터 setItem 이 실패해도 앞서 저장한 값이 읽힌다", () => {
    const fake = fakeStorage({ set: 1 });
    const store = createStore(() => fake.storage);
    store.set("a", "1");
    store.set("b", "2");
    expect(store.get("a")).toBe("1");
    expect(store.get("b")).toBe("2");
  });

  it("실패한 키가 있어도 다른 키는 저장소에 쓰고 읽는다", () => {
    const fake = fakeStorage({ set: "k" });
    const store = createStore(() => fake.storage);
    store.set("k", "mem");
    fake.storage.setItem("other", "x");
    expect(store.get("other")).toBe("x");
    expect(store.get("k")).toBe("mem");
  });

  it("remove 는 메모리와 저장소 둘 다 지운다", () => {
    const fake = fakeStorage({ set: "k" });
    fake.data.set("k", "old");
    const store = createStore(() => fake.storage);
    store.set("k", "mem");
    store.remove("k");
    expect(store.get("k")).toBeNull();
    expect(fake.data.has("k")).toBe(false);
  });

  it("getItem 이 던져도 null 을 주고 던지지 않는다", () => {
    const fake = fakeStorage({ get: true });
    const store = createStore(() => fake.storage);
    expect(store.get("k")).toBeNull();
    expect(() => store.set("k", "v")).not.toThrow();
    expect(store.get("k")).toBeNull();
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
