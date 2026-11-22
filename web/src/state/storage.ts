import type { KeyValue } from "./progress";

type WebStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export function createStore(open: () => WebStorage | undefined = () => globalThis.localStorage): KeyValue {
  const memory = new Map<string, string>();
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
      const s = backing();
      if (s) {
        try {
          return s.getItem(key);
        } catch {
          storage = null;
        }
      }
      return memory.get(key) ?? null;
    },
    set(key, value) {
      const s = backing();
      if (s) {
        try {
          s.setItem(key, value);
          return;
        } catch {
          storage = null;
        }
      }
      memory.set(key, value);
    },
    remove(key) {
      memory.delete(key);
      const s = backing();
      if (s) {
        try {
          s.removeItem(key);
        } catch {
          storage = null;
        }
      }
    },
  };
}
