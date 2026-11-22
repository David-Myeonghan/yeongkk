import { afterEach, describe, expect, it, vi } from "vitest";
import type { KeyValue } from "../state/progress";
import { createTelemetry, sanitizeProps, type TelemetryDeps } from "./events";

const memoryStore = (): KeyValue => {
  const data = new Map<string, string>();
  return { get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), remove: (k) => void data.delete(k) };
};

afterEach(() => vi.restoreAllMocks());

function setup(over: Partial<TelemetryDeps> = {}) {
  const timers = new Map<number, { fn: () => void; ms: number }>();
  let nextTimer = 1;
  const fetchFn = vi.fn<typeof fetch>(async () => new Response(null, { status: 204 }));
  const deps: TelemetryDeps = {
    store: memoryStore(),
    anonId: () => "anon-12345678",
    fetchFn,
    getApi: () => "/api",
    getHost: () => ({ host: "browser" }),
    setTimer: (fn, ms) => {
      const id = nextTimer++;
      timers.set(id, { fn, ms });
      return id;
    },
    clearTimer: (id) => void timers.delete(id as number),
    now: () => 1_700_000_000_000,
    ...over,
  };
  const telemetry = createTelemetry(deps);
  const fire = async () => {
    const pending = [...timers.values()];
    timers.clear();
    pending.forEach((t) => t.fn());
    await telemetry.flush();
  };
  const bodies = () => fetchFn.mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
  return { telemetry, timers, fetchFn, fire, bodies };
}

describe("sanitizeProps", () => {
  it("@ 가 든 문자열 · 객체 · 배열 · null · 유한하지 않은 숫자를 버린다", () => {
    expect(
      sanitizeProps({
        email: "me@example.com",
        ok: "fine",
        nested: { a: 1 },
        list: [1],
        nothing: null,
        undef: undefined,
        inf: Infinity,
        nan: NaN,
        n: 3,
        b: false,
      } as never),
    ).toEqual({ ok: "fine", n: 3, b: false });
  });

  it("규칙에 안 맞는 키를 버린다", () => {
    expect(sanitizeProps({ Bad: 1, "1x": 1, "a-b": 1, good_Key1: 1, ["a".repeat(33)]: 1, ["a".repeat(32)]: 2 })).toEqual({
      good_Key1: 1,
      ["a".repeat(32)]: 2,
    });
  });

  it("200자를 넘는 문자열을 버린다(코드 포인트 기준)", () => {
    expect(sanitizeProps({ a: "😀".repeat(200), b: "😀".repeat(201) })).toEqual({ a: "😀".repeat(200) });
  });

  it("20개까지만 남긴다", () => {
    const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`k${i}`, i]));
    expect(Object.keys(sanitizeProps(many) ?? {})).toHaveLength(20);
  });

  it("남는 게 없거나 props 가 없으면 undefined", () => {
    expect(sanitizeProps(undefined)).toBeUndefined();
    expect(sanitizeProps({ email: "a@b.c" })).toBeUndefined();
  });
});

describe("track", () => {
  it("이메일처럼 보이는 값(@ 포함 문자열)이 든 속성을 버린다", async () => {
    const { telemetry, fire, bodies } = setup();
    telemetry.track("share_done", { via: "clipboard", who: "a@b.com", completed: true });
    await fire();
    expect(bodies()[0].events[0].props).toEqual({ via: "clipboard", completed: true });
  });

  it("at 은 now() 이고, props 가 없으면 키도 없다", async () => {
    const { telemetry, fire, bodies } = setup();
    telemetry.track("share_click");
    await fire();
    expect(bodies()[0].events).toEqual([{ name: "share_click", at: 1_700_000_000_000 }]);
  });

  it("보내는 곳은 {api}/events, 봉투에 anonId · locale · host", async () => {
    const { telemetry, fire, fetchFn, bodies } = setup({ getApi: () => "https://api.example.com" });
    telemetry.track("app_open", { fromShare: false });
    await fire();
    expect(fetchFn.mock.calls[0]![0]).toBe("https://api.example.com/events");
    expect(bodies()[0]).toMatchObject({ anonId: "anon-12345678", locale: "ko-KR", host: "browser" });
  });

  it("host 와 appVersion 은 보내는 순간의 값", async () => {
    let host: ReturnType<TelemetryDeps["getHost"]> = { host: "browser" };
    const { telemetry, fire, bodies } = setup({ getHost: () => host });
    telemetry.track("app_open", { fromShare: false });
    host = { host: "app", appVersion: "2.0.1" };
    await fire();
    expect(bodies()[0]).toMatchObject({ host: "app", appVersion: "2.0.1" });
  });

  it("2초 뒤 보내기를 예약하고, 연달아 불러도 타이머는 하나(밀어내기)", () => {
    const { telemetry, timers } = setup();
    telemetry.track("app_open", { fromShare: false });
    telemetry.track("share_click");
    telemetry.track("share_click");
    expect(timers.size).toBe(1);
    expect([...timers.values()][0]!.ms).toBe(2000);
  });

  it("동기로 돌아오고 아무것도 던지지 않는다 — 저장소 · fetch · 시계 · 봉투가 다 던져도", () => {
    const boom = () => {
      throw new Error("boom");
    };
    const { telemetry } = setup({
      store: { get: boom, set: boom, remove: boom },
      fetchFn: boom as never,
      now: boom,
      anonId: boom,
      getApi: boom,
      getHost: boom,
      setTimer: boom,
    });
    expect(telemetry.track("app_open", { fromShare: true })).toBeUndefined();
  });

  it("보내기가 실패하면 남겨 두었다가 다음에 보낸다", async () => {
    const fetchFn = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new TypeError("offline"))
      .mockResolvedValue(new Response(null, { status: 204 }));
    const { telemetry, fire } = setup({ fetchFn });
    telemetry.track("app_open", { fromShare: false });
    await fire();
    await telemetry.flush();
    expect(fetchFn).toHaveBeenCalledTimes(2);
    await telemetry.flush();
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it("보낼 게 없으면 요청하지 않는다", async () => {
    const { telemetry, fetchFn } = setup();
    await telemetry.flush();
    expect(fetchFn).not.toHaveBeenCalled();
  });
});

describe("leave (페이지를 떠날 때)", () => {
  it("sendBeacon 이 있으면 그걸로 보내고, true 면 보낸 것으로 친다", async () => {
    const beacon = vi.fn<(url: string, body: string) => boolean>(() => true);
    const { telemetry, fetchFn } = setup({ beacon });
    telemetry.track("share_click");
    telemetry.leave();
    await telemetry.flush();
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(beacon.mock.calls[0]![0]).toBe("/api/events");
    expect(JSON.parse(beacon.mock.calls[0]![1]).events[0].name).toBe("share_click");
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("beacon 이 false 면 보통 보내기로 돌아가고, 그게 되면 다시 안 보낸다", async () => {
    const beacon = vi.fn(() => false);
    const { telemetry, fetchFn } = setup({ beacon });
    telemetry.track("share_click");
    telemetry.leave();
    await telemetry.flush();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await telemetry.flush();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("beacon 이 던져도 보통 보내기로 돌아간다", async () => {
    const beacon = vi.fn(() => {
      throw new Error("blocked");
    });
    const { telemetry, fetchFn } = setup({ beacon });
    telemetry.track("share_click");
    telemetry.leave();
    await telemetry.flush();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("beacon 이 없으면 보통 보내기, 대기 중인 타이머는 걷는다", async () => {
    const { telemetry, fetchFn, timers } = setup();
    telemetry.track("share_click");
    telemetry.leave();
    expect(timers.size).toBe(0);
    await telemetry.flush();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("떠난 뒤 돌아와도(다시 보임) 보통 보내기를 쓴다", async () => {
    const beacon = vi.fn(() => true);
    const { telemetry, fetchFn } = setup({ beacon });
    telemetry.leave();
    telemetry.resume();
    telemetry.track("share_click");
    await telemetry.flush();
    expect(beacon).not.toHaveBeenCalled();
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("보내기가 멈춘 채 떠나면, 10초 제한으로 끊긴 뒤 beacon 으로 한 번 보낸다", async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const beacon = vi.fn<(url: string, body: string) => boolean>(() => true);
    const fetchFn = vi.fn<typeof fetch>(() => new Promise<Response>(() => {}));
    const { telemetry } = setup({ beacon, fetchFn });
    telemetry.track("share_click");
    const first = telemetry.flush();
    telemetry.leave();
    await Promise.resolve();
    expect(beacon).not.toHaveBeenCalled();
    controller.abort();
    await first;
    await telemetry.flush();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(beacon).toHaveBeenCalledTimes(1);
    expect(JSON.parse(beacon.mock.calls[0]![1]).events[0].name).toBe("share_click");
  });
});
