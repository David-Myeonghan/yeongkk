export const REQUEST_TIMEOUT_MS = 10_000;

export interface Deadline {
  signal: AbortSignal;
  /** 신호가 먼저 끝나면 null, 아니면 요청 결과. 신호를 무시하는 fetch 도 여기서 끊긴다. */
  race<T>(request: Promise<T>): Promise<T | null>;
  clear(): void;
}

export function deadline(ms: number = REQUEST_TIMEOUT_MS): Deadline {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let signal: AbortSignal;
  if (typeof AbortSignal.timeout === "function") {
    signal = AbortSignal.timeout(ms);
  } else {
    const controller = new AbortController();
    timer = setTimeout(() => controller.abort(), ms);
    signal = controller.signal;
  }
  const aborted = new Promise<null>((resolve) => {
    if (signal.aborted) resolve(null);
    else signal.addEventListener("abort", () => resolve(null), { once: true });
  });
  return {
    signal,
    race: (request) => Promise.race([request, aborted]),
    clear: () => clearTimeout(timer),
  };
}
