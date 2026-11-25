export type BannerState = { visible: false } | { visible: true; unitId: string; nonPersonalized: boolean };

export interface BannerStore {
  get(): BannerState;
  set(next: BannerState): void;
  subscribe(listener: () => void): () => void;
}

const HIDDEN: BannerState = { visible: false };

export function createBannerStore(): BannerStore {
  let state: BannerState = HIDDEN;
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(next) {
      state = next.visible ? next : HIDDEN;
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
