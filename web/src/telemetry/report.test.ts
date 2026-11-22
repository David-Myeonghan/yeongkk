import { describe, expect, it, vi } from "vitest";
import { submitReport } from "./report";

const input = { anonId: "anon-12345678", locale: "ko-KR", word: "갑분싸" };
const respond = (status: number) => vi.fn<typeof fetch>(async () => new Response(null, { status }));

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
});
