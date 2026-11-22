import { afterEach, describe, expect, it, vi } from "vitest";
import { submitReport } from "./report";

const input = { anonId: "anon-12345678", locale: "ko-KR", word: "갑분싸" };
const respond = (status: number) => vi.fn<typeof fetch>(async () => new Response(null, { status }));

afterEach(() => vi.restoreAllMocks());

describe("submitReport", () => {
  it("POST {api}/reports 로 anonId, locale, word 만 보낸다", async () => {
    const fetchFn = respond(204);
    expect(await submitReport(fetchFn, "/api", input)).toBe("ok");
    const [url, init] = fetchFn.mock.calls[0]!;
    expect(url).toBe("/api/reports");
    expect(init?.method).toBe("POST");
    expect(new Headers(init?.headers).get("Content-Type")).toBe("application/json");
    expect(JSON.parse(String(init?.body))).toEqual(input);
  });

  it.each([
    [204, "ok"],
    [400, "rejected"],
    [429, "limited"],
    [500, "failed"],
    [413, "failed"],
    [200, "failed"],
  ])("상태 %i → %s", async (status, expected) => {
    expect(await submitReport(respond(status), "/api", input)).toBe(expected);
  });

  it("던지면 failed", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => {
      throw new TypeError("offline");
    });
    expect(await submitReport(fetchFn, "/api", input)).toBe("failed");
  });

  it("Referer 를 싣지 않고 10초 제한 신호를 싣는다", async () => {
    const spy = vi.spyOn(AbortSignal, "timeout");
    const fetchFn = respond(204);
    await submitReport(fetchFn, "/api", input);
    expect(fetchFn.mock.calls[0]![1]?.referrerPolicy).toBe("no-referrer");
    expect(spy).toHaveBeenCalledWith(10_000);
    expect(fetchFn.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it("10초 안에 안 끝나면 failed", async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const fetchFn = vi.fn<typeof fetch>(() => new Promise<Response>(() => {}));
    let result: string | undefined;
    void submitReport(fetchFn, "/api", input).then((r) => (result = r));
    await Promise.resolve();
    expect(result).toBeUndefined();
    controller.abort();
    await vi.waitFor(() => expect(result).toBe("failed"));
  });
});
