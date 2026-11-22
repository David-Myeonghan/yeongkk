import { env, exports } from "cloudflare:workers";
import { afterEach, describe, expect, it, vi } from "vitest";
import worker, { createHandler } from "./index";

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;

const call = (path: string, init?: RequestInit) =>
  exports.default.fetch(new Request(`https://yeongkk.test${path}`, init));

afterEach(() => vi.restoreAllMocks());

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

  it("Object.prototype 이름의 메서드는 핸들러로 취급하지 않고 405", async () => {
    for (const method of ["constructor", "toString", "hasOwnProperty"]) {
      const fake = { method, url: "https://yeongkk.test/api/health", headers: new Headers() };
      const res = await worker.fetch(fake as unknown as Request, env, ctx);
      expect(res.status).toBe(405);
      expect(await res.json()).toEqual({ code: "METHOD_NOT_ALLOWED" });
    }
  });

  it("HEAD 는 GET 처럼 답하되 본문이 없다", async () => {
    const res = await call("/api/health", { method: "HEAD" });
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("");
  });

  it("OPTIONS 는 405", async () => {
    expect((await call("/api/health", { method: "OPTIONS" })).status).toBe(405);
  });

  it("/api/ 가 아닌 요청은 ASSETS 로 넘긴다", async () => {
    const assets = { fetch: vi.fn(async () => new Response("asset")) };
    const res = await worker.fetch(
      new Request("https://yeongkk.test/index.html"),
      { ...env, ASSETS: assets as unknown as Fetcher },
      ctx,
    );
    expect(assets.fetch).toHaveBeenCalledOnce();
    expect(await res.text()).toBe("asset");
  });
});

describe("오류 경계", () => {
  const boom = () => createHandler({
    "/api/throw": { GET: () => { throw new Error("boom"); } },
    "/api/reject": { GET: () => Promise.reject(new Error("nope")) },
  });

  it("던지는 핸들러는 500 INTERNAL_ERROR JSON 이고 로그를 남긴다", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    for (const path of ["/api/throw", "/api/reject"]) {
      const res = await boom().fetch(new Request(`https://yeongkk.test${path}`), env, ctx);
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ code: "INTERNAL_ERROR" });
    }
    expect(log).toHaveBeenCalledTimes(2);
  });
});

describe("출처 검사", () => {
  const post = (origin?: string, e: Env = env) =>
    worker.fetch(
      new Request("https://yeongkk.test/api/health", {
        method: "POST",
        headers: origin ? { Origin: origin } : {},
      }),
      e,
      ctx,
    );

  it("다른 출처의 POST 는 403", async () => {
    const res = await post("https://evil.example");
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ code: "FORBIDDEN_ORIGIN" });
  });

  it("같은 출처의 POST 는 출처 검사를 통과한다 (health 는 GET 만 있어 405)", async () => {
    expect((await post("https://yeongkk.test")).status).toBe(405);
  });

  it("ALLOWED_ORIGINS 에 있는 출처는 출처 검사를 통과한다", async () => {
    expect((await post("http://localhost:5173")).status).toBe(405);
  });

  it("Origin 이 없으면 막지 않는다", async () => {
    expect((await post()).status).toBe(405);
  });

  it("ALLOWED_ORIGINS 는 공백 · 끝 슬래시 · 빈 항목을 정리해 읽는다", async () => {
    const e = { ...env, ALLOWED_ORIGINS: " https://a.example/ , ,https://b.example " };
    expect((await post("https://a.example", e)).status).toBe(405);
    expect((await post("https://b.example", e)).status).toBe(405);
    expect((await post("http://localhost:5173", e)).status).toBe(403);
    expect((await post("", e)).status).toBe(405);
  });
});

describe("D1 표", () => {
  it("events · reports 표와 색인 넷이 있다", async () => {
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE name IN ('events','reports','events_day_name','events_anon_day','reports_locale_word','reports_anon_day') ORDER BY name",
    ).all<{ name: string }>();
    expect(results.map((r) => r.name)).toEqual([
      "events",
      "events_anon_day",
      "events_day_name",
      "reports",
      "reports_anon_day",
      "reports_locale_word",
    ]);
  });
});
