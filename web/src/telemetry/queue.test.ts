import { describe, expect, it, vi } from "vitest";
import type { KeyValue } from "../state/progress";
import { createQueue, QUEUE_KEY, type QueuedEvent } from "./queue";

const memoryStore = (): KeyValue & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return {
    data,
    get: (k) => data.get(k) ?? null,
    set: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };
};

const throwingStore = (): KeyValue => ({
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

const ev = (i: number, props?: QueuedEvent["props"]): QueuedEvent => ({ name: "app_open", at: i, ...(props ? { props } : {}) });
const ats = (batch: QueuedEvent[]) => batch.map((e) => e.at);

describe("createQueue", () => {
  it("쌓은 순서대로 보내고, 성공하면 비운다", async () => {
    const send = vi.fn<(b: QueuedEvent[]) => Promise<boolean>>(async () => true);
    const q = createQueue({ send, store: memoryStore() });
    q.push(ev(1));
    q.push(ev(2));
    await q.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(ats(send.mock.calls[0]![0])).toEqual([1, 2]);
    await q.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("send 가 false 면 이벤트가 남아 다음 flush 에 다시 간다", async () => {
    const send = vi.fn<(b: QueuedEvent[]) => Promise<boolean>>().mockResolvedValueOnce(false).mockResolvedValue(true);
    const q = createQueue({ send, store: memoryStore() });
    q.push(ev(1));
    await q.flush();
    await q.flush();
    expect(send).toHaveBeenCalledTimes(2);
    expect(ats(send.mock.calls[1]![0])).toEqual([1]);
    await q.flush();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it("send 가 던져도 flush 는 던지지 않고 이벤트가 남는다", async () => {
    const send = vi.fn<(b: QueuedEvent[]) => Promise<boolean>>().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(true);
    const q = createQueue({ send, store: memoryStore() });
    q.push(ev(1));
    await expect(q.flush()).resolves.toBeUndefined();
    await q.flush();
    expect(ats(send.mock.calls[1]![0])).toEqual([1]);
  });

  it("send 가 동기로 던져도 flush 는 던지지 않는다", async () => {
    const q = createQueue({
      send: () => {
        throw new Error("sync");
      },
      store: memoryStore(),
    });
    q.push(ev(1));
    await expect(q.flush()).resolves.toBeUndefined();
  });

  it("200개를 넘으면 가장 오래된 것부터 버린다", async () => {
    const send = vi.fn<(b: QueuedEvent[]) => Promise<boolean>>(async () => true);
    const q = createQueue({ send, store: memoryStore(), maxPerRequest: 1000, maxBytes: 10_000_000 });
    for (let i = 1; i <= 205; i++) q.push(ev(i));
    await q.flush();
    const sent = send.mock.calls.flatMap((c) => ats(c[0]));
    expect(sent).toHaveLength(200);
    expect(sent[0]).toBe(6);
    expect(sent.at(-1)).toBe(205);
  });

  it("max 를 바꿀 수 있다", async () => {
    const send = vi.fn<(b: QueuedEvent[]) => Promise<boolean>>(async () => true);
    const q = createQueue({ send, store: memoryStore(), max: 3 });
    for (let i = 1; i <= 5; i++) q.push(ev(i));
    await q.flush();
    expect(ats(send.mock.calls[0]![0])).toEqual([3, 4, 5]);
  });

  it("한 번에 50개까지만 보낸다", async () => {
    const send = vi.fn<(b: QueuedEvent[]) => Promise<boolean>>(async () => true);
    const q = createQueue({ send, store: memoryStore() });
    for (let i = 1; i <= 120; i++) q.push(ev(i));
    await q.flush();
    expect(send.mock.calls.map((c) => c[0].length)).toEqual([50, 50, 20]);
  });

  it("한 번에 12000바이트까지만 보낸다", async () => {
    const send = vi.fn<(b: QueuedEvent[]) => Promise<boolean>>(async () => true);
    const q = createQueue({ send, store: memoryStore() });
    const big = "가".repeat(100);
    for (let i = 1; i <= 40; i++) q.push(ev(i, { text: big }));
    await q.flush();
    expect(send.mock.calls.length).toBeGreaterThan(1);
    for (const [batch] of send.mock.calls) {
      expect(new TextEncoder().encode(JSON.stringify(batch)).length).toBeLessThanOrEqual(12000);
    }
    expect(send.mock.calls.flatMap((c) => ats(c[0]))).toHaveLength(40);
  });

  it("혼자서 12000바이트를 넘는 이벤트는 버려서 줄이 막히지 않는다", async () => {
    const send = vi.fn<(b: QueuedEvent[]) => Promise<boolean>>(async () => true);
    const q = createQueue({ send, store: memoryStore() });
    q.push(ev(1, { text: "가".repeat(5000) }));
    q.push(ev(2));
    await q.flush();
    expect(send.mock.calls.flatMap((c) => ats(c[0]))).toEqual([2]);
  });

  it("앞 덩어리가 실패하면 거기서 멈추고 뒤는 보내지 않는다", async () => {
    const send = vi.fn<(b: QueuedEvent[]) => Promise<boolean>>(async () => false);
    const q = createQueue({ send, store: memoryStore() });
    for (let i = 1; i <= 60; i++) q.push(ev(i));
    await q.flush();
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("flush 가 동시에 불려도 같은 이벤트를 두 번 보내지 않는다", async () => {
    let release: (ok: boolean) => void = () => {};
    const send = vi.fn(() => new Promise<boolean>((resolve) => (release = resolve)));
    const q = createQueue({ send, store: memoryStore() });
    q.push(ev(1));
    const a = q.flush();
    const b = q.flush();
    release(true);
    await Promise.all([a, b]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it("보내는 중에 쌓은 이벤트는 지워지지 않는다", async () => {
    let release: (ok: boolean) => void = () => {};
    const send = vi
      .fn<(b: QueuedEvent[]) => Promise<boolean>>()
      .mockImplementationOnce(() => new Promise<boolean>((resolve) => (release = resolve)))
      .mockResolvedValue(true);
    const q = createQueue({ send, store: memoryStore() });
    q.push(ev(1));
    const first = q.flush();
    q.push(ev(2));
    release(true);
    await first;
    expect(send.mock.calls.flatMap((c) => ats(c[0]))).toContain(2);
  });

  it("보내는 중에 200개 한도로 밀려난 이벤트가 있어도 엉뚱한 것을 지우지 않는다", async () => {
    let release: (ok: boolean) => void = () => {};
    const send = vi
      .fn<(b: QueuedEvent[]) => Promise<boolean>>()
      .mockImplementationOnce(() => new Promise<boolean>((resolve) => (release = resolve)))
      .mockResolvedValue(true);
    const q = createQueue({ send, store: memoryStore(), max: 3, maxPerRequest: 2 });
    q.push(ev(1));
    q.push(ev(2));
    q.push(ev(3));
    const flushing = q.flush();
    q.push(ev(4));
    q.push(ev(5));
    release(true);
    await flushing;
    const rest = send.mock.calls.slice(1).flatMap((c) => ats(c[0]));
    expect(rest).toEqual([3, 4, 5]);
  });

  it("저장소에 남기고, 새 큐가 그것을 이어 보낸다", async () => {
    const store = memoryStore();
    const first = createQueue({ send: async () => false, store });
    first.push(ev(7));
    await first.flush();
    expect(store.data.has(QUEUE_KEY)).toBe(true);
    const send = vi.fn<(b: QueuedEvent[]) => Promise<boolean>>(async () => true);
    const second = createQueue({ send, store });
    await second.flush();
    expect(ats(send.mock.calls[0]![0])).toEqual([7]);
    expect(store.data.has(QUEUE_KEY) ? JSON.parse(store.data.get(QUEUE_KEY)!) : []).toEqual([]);
  });

  it("저장소가 던지면 메모리로만 돈다", async () => {
    const send = vi.fn<(b: QueuedEvent[]) => Promise<boolean>>().mockResolvedValueOnce(false).mockResolvedValue(true);
    const q = createQueue({ send, store: throwingStore() });
    q.push(ev(1));
    await q.flush();
    await q.flush();
    expect(ats(send.mock.calls[1]![0])).toEqual([1]);
  });

  it.each(["not json", "{}", "[1,2]", '[{"name":"app_open"}]', '[{"name":5,"at":1}]'])("깨진 저장 큐 %j 는 버리고 죽지 않는다", async (bad) => {
    const store = memoryStore();
    store.data.set(QUEUE_KEY, bad);
    const send = vi.fn<(b: QueuedEvent[]) => Promise<boolean>>(async () => true);
    const q = createQueue({ send, store });
    q.push(ev(1));
    await q.flush();
    expect(send.mock.calls.flatMap((c) => ats(c[0]))).toEqual([1]);
  });

  it("maxBytes - 2 바이트짜리 이벤트는 버리고 뒤의 작은 것을 보낸다", async () => {
    const send = vi.fn<(b: QueuedEvent[]) => Promise<boolean>>(async () => true);
    const q = createQueue({ send, store: memoryStore(), maxBytes: 100 });
    const filler = (n: number): QueuedEvent => {
      const base = { name: "app_open", at: 1, props: { a: "" } } as const;
      const pad = n - JSON.stringify(base).length;
      return { ...base, props: { a: "x".repeat(pad) } };
    };
    const exact = filler(98);
    expect(JSON.stringify(exact).length).toBe(98);
    q.push(exact);
    q.push(ev(2));
    await q.flush();
    expect(send).toHaveBeenCalledTimes(1);
    expect(ats(send.mock.calls[0]![0])).toEqual([2]);
  });
});
