import { env, exports } from "cloudflare:workers";
import { describe, expect, it } from "vitest";

const call = (path: string, init?: RequestInit) =>
  exports.default.fetch(new Request(`https://yeongkk.test${path}`, init));

describe("라우팅", () => {
  it("GET /api/health 는 200 ok", async () => {
    const res = await call("/api/health");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("모르는 /api 경로는 404 NOT_FOUND", async () => {
    const res = await call("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ code: "NOT_FOUND" });
  });

  it("아는 경로에 틀린 메서드는 405", async () => {
    const res = await call("/api/health", { method: "DELETE" });
    expect(res.status).toBe(405);
    expect(await res.json()).toEqual({ code: "METHOD_NOT_ALLOWED" });
  });
});

describe("출처 검사", () => {
  const post = (origin?: string) =>
    call("/api/health", { method: "POST", headers: origin ? { Origin: origin } : {} });

  it("다른 출처의 POST 는 403", async () => {
    const res = await post("https://evil.example");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ code: "FORBIDDEN_ORIGIN" });
  });

  it("같은 출처의 POST 는 403 이 아니다", async () => {
    expect((await post("https://yeongkk.test")).status).not.toBe(403);
  });

  it("ALLOWED_ORIGINS 에 있는 출처는 403 이 아니다", async () => {
    expect((await post("http://localhost:5173")).status).not.toBe(403);
  });

  it("Origin 이 없으면 막지 않는다", async () => {
    expect((await post()).status).not.toBe(403);
  });
});

describe("D1 표", () => {
  it("events · reports 표와 색인 셋이 있다", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE name IN ('events','reports','events_day_name','events_anon_day','reports_locale_word') ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual([
      "events",
      "events_anon_day",
      "events_day_name",
      "reports",
      "reports_locale_word",
    ]);
  });
});
