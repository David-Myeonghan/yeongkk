import { afterEach, describe, expect, it, vi } from "vitest";
import { buildBody, eventsUrl, sendEvents, type Envelope } from "./send";
import type { QueuedEvent } from "./queue";

const envelope: Envelope = { anonId: "anon-12345678", locale: "ko-KR", host: "browser" };
const events: QueuedEvent[] = [{ name: "app_open", at: 1, props: { fromShare: false } }, { name: "share_click", at: 2 }];
const respond = (status: number) => vi.fn<typeof fetch>(async () => new Response(null, { status }));

afterEach(() => vi.restoreAllMocks());

describe("sendEvents", () => {
  it("POST {api}/events 로 JSON 을 보낸다", async () => {
    const fetchFn = respond(204);
    expect(await sendEvents(fetchFn, "/api", envelope, events)).toBe(true);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("/api/events");
    expect(init?.method).toBe("POST");
    expect(init?.keepalive).toBe(true);
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual({
      anonId: "anon-12345678",
      locale: "ko-KR",
      host: "browser",
      events: [{ name: "app_open", at: 1, props: { fromShare: false } }, { name: "share_click", at: 2 }],
    });
  });

  it("Referer 를 싣지 않는다", async () => {
    const fetchFn = respond(204);
    await sendEvents(fetchFn, "/api", envelope, events);
    expect(fetchFn.mock.calls[0]![1]?.referrerPolicy).toBe("no-referrer");
  });

  it("10초 제한 신호를 싣는다", async () => {
    const spy = vi.spyOn(AbortSignal, "timeout");
    const fetchFn = respond(204);
    await sendEvents(fetchFn, "/api", envelope, events);
    expect(spy).toHaveBeenCalledWith(10_000);
    expect(fetchFn.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("신호를 무시하고 멈춘 fetch 도 10초 뒤 false", async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const fetchFn = vi.fn<typeof fetch>(() => new Promise<Response>(() => {}));
    let result: boolean | undefined;
    void sendEvents(fetchFn, "/api", envelope, events).then((r) => (result = r));
    await Promise.resolve();
    expect(result).toBeUndefined();
    controller.abort();
    await vi.waitFor(() => expect(result).toBe(false));
  });

  it("앱이면 host 와 appVersion 이 같이 간다", async () => {
    const fetchFn = respond(204);
    await sendEvents(fetchFn, "https://api.example.com", { ...envelope, host: "app", appVersion: "1.2.3" }, events);
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("https://api.example.com/events");
    expect(JSON.parse(String(init?.body))).toMatchObject({ host: "app", appVersion: "1.2.3" });
  });

  it.each([
    [204, true],
    [400, true],
    [413, true],
    [429, false],
    [500, false],
    [503, false],
    [200, false],
    [404, false],
  ])("상태 %i → %s", async (status, expected) => {
    expect(await sendEvents(respond(status), "/api", envelope, events)).toBe(expected);
  });

  it("네트워크 오류는 false, 던지지 않는다", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await sendEvents(fetchFn, "/api", envelope, events)).toBe(false);
  });

  it("fetch 가 동기로 던져도 false", async () => {
    const fetchFn = vi.fn<typeof fetch>(() => {
      throw new Error("sync");
    });
    expect(await sendEvents(fetchFn, "/api", envelope, events)).toBe(false);
  });
});

describe("eventsUrl / buildBody", () => {
  it("끝 슬래시를 겹치지 않는다", () => {
    expect(eventsUrl("/api/")).toBe("/api/events");
    expect(eventsUrl("/api")).toBe("/api/events");
  });

  it("appVersion 이 서버 규칙에 안 맞으면 뺀다", () => {
    const body = JSON.parse(buildBody({ ...envelope, host: "app", appVersion: "bad version!" }, events));
    expect("appVersion" in body).toBe(false);
  });
});
