import type { EventName } from "@yk/quiz-core/events";
import type { KeyValue } from "../state/progress";
import { createQueue, type PropValue, type QueuedEvent } from "./queue";
import { buildBody, eventsUrl, sendEvents, type Envelope } from "./send";

const LOCALE = "ko-KR";
const FLUSH_DELAY_MS = 2000;
const MAX_PROPS = 20;
const MAX_STRING = 200;
const PROP_KEY = /^[a-z][A-Za-z0-9_]{0,31}$/;

/** 서버와 같은 규칙. 기기를 떠나기 전에 한 번 더 걸러서 개인정보가 나갈 길을 없앤다. */
export function sanitizeProps(raw: Record<string, unknown> | undefined): Record<string, PropValue> | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const kept: Record<string, PropValue> = {};
  let count = 0;
  for (const [key, value] of Object.entries(raw)) {
    if (count >= MAX_PROPS) break;
    if (!PROP_KEY.test(key)) continue;
    const ok =
      (typeof value === "string" && !value.includes("@") && [...value].length <= MAX_STRING) ||
      (typeof value === "number" && Number.isFinite(value)) ||
      typeof value === "boolean";
    if (!ok) continue;
    kept[key] = value as PropValue;
    count += 1;
  }
  return count === 0 ? undefined : kept;
}

export interface TelemetryDeps {
  store: KeyValue;
  anonId: () => string;
  fetchFn: typeof fetch;
  beacon?: (url: string, body: string) => boolean;
  getApi: () => string;
  getHost: () => { host: "app" | "browser"; appVersion?: string };
  setTimer: (fn: () => void, ms: number) => unknown;
  clearTimer: (id: unknown) => void;
  now: () => number;
}

export function createTelemetry(deps: TelemetryDeps) {
  let leaving = false;
  let timer: unknown = null;

  const queue = createQueue({
    store: deps.store,
    send: async (batch: QueuedEvent[]) => {
      const api = deps.getApi();
      const envelope: Envelope = { anonId: deps.anonId(), locale: LOCALE, ...deps.getHost() };
      if (leaving && deps.beacon) {
        try {
          if (deps.beacon(eventsUrl(api), buildBody(envelope, batch))) return true;
        } catch {
          // 막히면 보통 보내기로
        }
      }
      return sendEvents(deps.fetchFn, api, envelope, batch);
    },
  });

  const cancelTimer = () => {
    if (timer !== null) deps.clearTimer(timer);
    timer = null;
  };

  const flush = (): Promise<void> => {
    cancelTimer();
    return queue.flush();
  };

  return {
    track(name: EventName, props?: Record<string, PropValue>): void {
      try {
        const clean = sanitizeProps(props);
        queue.push({ name, at: deps.now(), ...(clean ? { props: clean } : {}) });
        cancelTimer();
        timer = deps.setTimer(() => {
          timer = null;
          void queue.flush();
        }, FLUSH_DELAY_MS);
      } catch {
        // 이벤트 때문에 퀴즈가 멈추면 안 된다
      }
    },
    flush,
    /** 화면이 가려지거나 페이지를 떠난다. sendBeacon 이 있으면 그것으로 남은 것을 보낸다. */
    leave(): void {
      leaving = true;
      void flush();
    },
    resume(): void {
      leaving = false;
    },
  };
}

export type Telemetry = ReturnType<typeof createTelemetry>;
