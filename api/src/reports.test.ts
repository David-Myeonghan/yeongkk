import { env } from "cloudflare:workers";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHandler, routes } from "./index";

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
const NOW = Date.parse("2026-11-22T03:00:00Z");

const post = (body: unknown, now = NOW, headers: Record<string, string> = {}) =>
  createHandler(routes, () => now).fetch(
    new Request("https://yeongkk.test/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    env,
    ctx,
  );

const anon = "anon-report-1";
const report = (word: string, anonId = anon) => ({ anonId, locale: "ko-KR", word });

type Row = { id: number; received_at: string; day: string; locale: string; word: string; anon_id: string };
const rows = async () => (await env.DB.prepare("SELECT * FROM reports ORDER BY id").all<Row>()).results;

afterEach(() => vi.restoreAllMocks());

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM reports").run();
});

describe("POST /api/reports", () => {
  it("올바른 제보는 204 이고 공백을 뗀 글을 저장한다", async () => {
    const res = await post(report("  갑분싸  "));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    expect(await rows()).toEqual([
      {
        id: expect.any(Number), received_at: "2026-11-22T03:00:00.000Z", day: "2026-11-22",
        locale: "ko-KR", word: "갑분싸", anon_id: anon,
      },
    ]);
  });

  it("text/plain 본문도 받는다", async () => {
    expect((await post(JSON.stringify(report("갑분싸")), NOW, { "Content-Type": "text/plain" })).status).toBe(204);
  });

  it("빈 글 · 공백뿐 · 21자 · 글 아님은 400 BAD_REQUEST", async () => {
    for (const word of ["", "   ", "가".repeat(21)]) {
      const res = await post(report(word));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ code: "BAD_REQUEST" });
    }
    expect((await post({ anonId: anon, locale: "ko-KR", word: 5 })).status).toBe(400);
    expect((await post({ anonId: anon, locale: "ko-KR" })).status).toBe(400);
    expect(await rows()).toHaveLength(0);
  });

  it("주소 · 전화번호 · @아이디 모양은 400", async () => {
    for (const word of ["@david", "me@x.com", "https://a.kr", "www.a", "naver.com", "010-1234-5678", "01012345678"]) {
      expect((await post(report(word))).status, word).toBe(400);
    }
    expect(await rows()).toHaveLength(0);
  });

  it("anonId · locale 이 틀리면 400", async () => {
    expect((await post({ ...report("말"), anonId: "x" })).status).toBe(400);
    expect((await post({ ...report("말"), locale: "ko" })).status).toBe(400);
    expect((await post("nope")).status).toBe(400);
  });

  it("본문 16KB 초과는 413", async () => {
    const res = await post({ ...report("말"), pad: "z".repeat(17000) });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ code: "TOO_LARGE" });
  });

  it("같은 anonId 의 21번째 제보는 429 RATE_LIMITED", async () => {
    for (let i = 0; i < 20; i += 1) expect((await post(report(`말${i}`))).status).toBe(204);
    const res = await post(report("말20"));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ code: "RATE_LIMITED" });
    expect(await rows()).toHaveLength(20);
  });

  it("동시에 25건을 보내도 정확히 20건만 저장한다", async () => {
    const results = await Promise.all(Array.from({ length: 25 }, (_, i) => post(report(`동시${i}`))));
    expect(results.filter((r) => r.status === 204)).toHaveLength(20);
    expect(results.filter((r) => r.status === 429)).toHaveLength(5);
    expect(await rows()).toHaveLength(20);
  });

  it("전각 @ 는 400, 정규화한 글을 저장한다", async () => {
    expect((await post(report("＠david"))).status).toBe(400);
    expect((await post(report("ａｂｃ"))).status).toBe(204);
    expect((await rows())[0]?.word).toBe("abc");
  });

  it("D1 이 실패하면 204 가 아니라 JSON 500", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const failing = {
      prepare: () => ({ bind: () => ({ run: () => Promise.reject(new Error("d1 down")), first: () => Promise.reject(new Error("d1 down")) }) }),
      batch: () => Promise.reject(new Error("d1 down")),
    };
    const broken = { ...env, DB: failing } as unknown as Env;
    const send = (path: string, body: unknown) =>
      createHandler(routes, () => NOW).fetch(
        new Request(`https://yeongkk.test${path}`, { method: "POST", body: JSON.stringify(body) }),
        broken,
        ctx,
      );
    const events = await send("/api/events", { anonId: anon, locale: "ko-KR", host: "app", events: [{ name: "app_open", at: 1 }] });
    const reports = await send("/api/reports", report("갑분싸"));
    for (const res of [events, reports]) {
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ code: "INTERNAL_ERROR" });
    }
    expect(log).toHaveBeenCalledTimes(2);
  });

  it("한도는 anonId 별 · 날(UTC+9) 별로 센다", async () => {
    for (let i = 0; i < 20; i += 1) await post(report(`말${i}`));
    expect((await post(report("다른사람", "anon-report-2"))).status).toBe(204);
    expect((await post(report("다음날"), Date.parse("2026-11-22T15:00:00Z"))).status).toBe(204);
  });

  it("IP · User-Agent 를 저장하지 않는다", async () => {
    await post(report("갑분싸"), NOW, {
      "CF-Connecting-IP": "203.0.113.77", "X-Forwarded-For": "198.51.100.9", "User-Agent": "SecretAgent/9.9",
    });
    const cols = (await env.DB.prepare("PRAGMA table_info(reports)").all<{ name: string }>()).results.map((c) => c.name);
    expect(cols).toEqual(["id", "received_at", "day", "locale", "word", "anon_id"]);
    expect(await rows()).toHaveLength(1);
    const dump = JSON.stringify(await rows());
    for (const secret of ["203.0.113.77", "198.51.100.9", "SecretAgent"]) expect(dump).not.toContain(secret);
  });
});
