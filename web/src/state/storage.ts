import type { KeyValue } from "./progress";

type WebStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createStore(open: () => WebStorage | undefined = () => globalThis.localStorage): KeyValue {
  const memory = new Map<string, string | null>();
  let storage: WebStorage | null | undefined;

  const backing = (): WebStorage | null => {
    if (storage === undefined) {
      try {
        storage = open() ?? null;
      } catch {
        storage = null;
      }
    }
    return storage;
  };

  return {
    get(key) {
      if (memory.has(key)) return memory.get(key) ?? null;
      const s = backing();
      if (!s) return null;
      try {
        return s.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      const s = backing();
      if (s) {
        try {
          s.setItem(key, value);
          memory.delete(key);
          return;
        } catch {
          // 이 키만 메모리에 둔다
        }
      }
      memory.set(key, value);
    },
    remove(key) {
      const s = backing();
      memory.delete(key);
      if (!s) return;
      try {
        s.removeItem(key);
      } catch {
        memory.set(key, null);
      }
    },
  };
}
