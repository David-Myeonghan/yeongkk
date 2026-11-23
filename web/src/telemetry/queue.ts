import type { EventName } from "@yk/quiz-core/events";
import type { KeyValue } from "../state/progress";

export type PropValue = string | number | boolean;
export interface QueuedEvent {
  name: EventName;
  at: number;
  props?: Record<string, PropValue>;
}

export const QUEUE_KEY = "yk.events.v1";
const MAX_QUEUED = 200;
const MAX_PER_REQUEST = 50;
const MAX_BYTES = 12_000;

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const isQueued = (v: unknown): v is QueuedEvent =>
  isRecord(v) && typeof v.name === "string" && typeof v.at === "number" && Number.isFinite(v.at) && (v.props === undefined || isRecord(v.props));

const encoder = new TextEncoder();
const byteLength = (value: unknown): number => encoder.encode(JSON.stringify(value)).length;
/** 배열 `[`·`]` 두 글자 + 이벤트 + 쉼표 한 글자. 한 묶음에 이 크기만 들어갈 수 있다. */
const chunkCost = (e: QueuedEvent): number => byteLength(e) + 1;
const EMPTY_CHUNK = 2;

export interface QueueOptions {
  send: (batch: QueuedEvent[]) => Promise<boolean>;
  store: KeyValue;
  max?: number;
  maxPerRequest?: number;
  maxBytes?: number;
}

export function createQueue(opts: QueueOptions) {
  const { send, store } = opts;
  const max = opts.max ?? MAX_QUEUED;
  const maxPerRequest = opts.maxPerRequest ?? MAX_PER_REQUEST;
  const maxBytes = opts.maxBytes ?? MAX_BYTES;
  let events: QueuedEvent[] | null = null;
  let tail: Promise<void> = Promise.resolve();
  let waiting = 0;
  let inFlight: ReadonlySet<QueuedEvent> = new Set();

  const load = (): QueuedEvent[] => {
    if (events) return events;
    events = [];
    try {
      const text = store.get(QUEUE_KEY);
      if (text === null) return events;
      const raw: unknown = JSON.parse(text);
      if (Array.isArray(raw) && raw.every(isQueued)) events = raw.slice(-max);
      else store.remove(QUEUE_KEY);
    } catch {
      try {
        store.remove(QUEUE_KEY);
      } catch {
        // 지우기도 막힌 저장소
      }
    }
    return events;
  };

  const persist = () => {
    try {
      store.set(QUEUE_KEY, JSON.stringify(events ?? []));
    } catch {
      // 저장이 막히면 메모리로만 돈다
    }
  };

  const chunkFrom = (all: readonly QueuedEvent[]): QueuedEvent[] => {
    const chunk: QueuedEvent[] = [];
    let bytes = EMPTY_CHUNK;
    for (const e of all) {
      if (chunk.length >= maxPerRequest) break;
      const size = chunkCost(e);
      if (bytes + size > maxBytes) break;
      chunk.push(e);
      bytes += size;
    }
    return chunk;
  };

  const nextChunk = (): QueuedEvent[] => chunkFrom(load());

  const dropOversized = (): boolean => {
    const first = load()[0];
    if (!first || EMPTY_CHUNK + chunkCost(first) <= maxBytes) return false;
    events = load().slice(1);
    persist();
    return true;
  };

  const run = async () => {
    for (;;) {
      if (load().length === 0) return;
      const chunk = nextChunk();
      if (chunk.length === 0) {
        if (dropOversized()) continue;
        return;
      }
      let ok: boolean;
      inFlight = new Set(chunk);
      try {
        ok = await send(chunk);
      } catch {
        ok = false;
      } finally {
        inFlight = new Set();
      }
      if (!ok) return;
      const sent = new Set(chunk);
      events = load().filter((e) => !sent.has(e));
      persist();
    }
  };

  return {
    push(e: QueuedEvent): void {
      const all = load();
      all.push(e);
      if (all.length > max) events = all.slice(all.length - max);
      persist();
    },
    /** 지금 날아가는 묶음을 뺀 나머지를 동기로 묶음씩 넘긴다. 받은 쪽이 true 면 큐에서 지우고, false 면 멈추고 큐에 남긴다. */
    takeIdle(handOff: (chunk: QueuedEvent[]) => boolean): void {
      for (;;) {
        const idle = load().filter((e) => !inFlight.has(e) && EMPTY_CHUNK + chunkCost(e) <= maxBytes);
        const chunk = chunkFrom(idle);
        if (chunk.length === 0) return;
        let ok: boolean;
        try {
          ok = handOff(chunk);
        } catch {
          ok = false;
        }
        if (!ok) return;
        const taken = new Set(chunk);
        events = load().filter((e) => !taken.has(e));
        persist();
      }
    },
    flush(): Promise<void> {
      const started = waiting === 0 ? run() : tail.then(run);
      waiting += 1;
      tail = started
        .catch(() => {})
        .finally(() => {
          waiting -= 1;
        });
      return tail;
    },
  };
}
