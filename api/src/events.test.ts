import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { createHandler, routes } from "./index";

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;
const NOW = Date.parse("2026-11-22T14:59:59Z");
const handler = (now = NOW) => createHandler(routes, () => now);

const post = (body: unknown, headers: Record<string, string> = {}, now = NOW) =>
  handler(now).fetch(
    new Request("https://yeongkk.test/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    env,
    ctx,
  );

const base = { anonId: "anon-1234abcd", locale: "ko-KR", host: "app", appVersion: "1.2.3" };
const ev = (name: string, props?: Record<string, unknown>) => ({ name, at: 1, ...(props ? { props } : {}) });

type Row = {
  received_at: string; day: string; anon_id: string; name: string;
  locale: string; host: string; app_version: string | null; props: string | null;
};
const rows = async () =>
  (await env.DB.prepare("SELECT * FROM events ORDER BY id").all<Row & { id: number }>()).results;

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM events").run();
});

describe("POST /api/events", () => {
  it("올바른 묶음은 204 이고 줄 수만큼 저장한다", async () => {
    const res = await post({ ...base, events: [ev("app_open"), ev("round_start"), ev("round_complete", { score: 7 })] });
    expect(res.status).toBe(204);
    expect(await res.text()).toBe("");
    const stored = await rows();
    expect(stored.map((r) => r.name)).toEqual(["app_open", "round_start", "round_complete"]);
    expect(stored[0]).toMatchObject({
      anon_id: "anon-1234abcd", locale: "ko-KR", host: "app", app_version: "1.2.3",
      received_at: "2026-11-22T14:59:59.000Z", day: "2026-11-22", props: null,
    });
    expect(stored[2]?.props).toBe('{"score":7}');
  });

  it("day 는 UTC+9 날짜다", async () => {
    await post({ ...base, events: [ev("app_open")] }, {}, Date.parse("2026-11-22T15:00:00Z"));
    expect((await rows())[0]?.day).toBe("2026-11-23");
  });

  it("text/plain 본문도 받는다 (sendBeacon)", async () => {
    const res = await post({ ...base, events: [ev("app_open")] }, { "Content-Type": "text/plain;charset=UTF-8" });
    expect(res.status).toBe(204);
    expect(await rows()).toHaveLength(1);
  });

  it("빈 events 는 204 이고 저장하지 않는다", async () => {
    expect((await post({ ...base, events: [] })).status).toBe(204);
    expect(await rows()).toHaveLength(0);
  });

  it("50개는 받고 51개는 413 TOO_LARGE 이며 아무것도 저장하지 않는다", async () => {
    const many = (n: number) => Array.from({ length: n }, () => ev("app_open"));
    expect((await post({ ...base, events: many(50) })).status).toBe(204);
    expect(await rows()).toHaveLength(50);
    await env.DB.prepare("DELETE FROM events").run();
    const res = await post({ ...base, events: many(51) });
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ code: "TOO_LARGE" });
    expect(await rows()).toHaveLength(0);
  });

  it("모르는 이름 · 유한하지 않은 at 은 그 줄만 버리고 204", async () => {
    const res = await post({
      ...base,
      events: [ev("nope"), { name: "app_open", at: "x" }, { name: "app_open" }, { name: 5, at: 1 }, "str", null, ev("app_open")],
    });
    expect(res.status).toBe(204);
    expect((await rows()).map((r) => r.name)).toEqual(["app_open"]);
  });

  it("props 는 속성별로 걸러낸다", async () => {
    await post({
      ...base,
      events: [ev("share_done", {
        via: "link", n: 3, ok: true,
        contact: "me@example.com", long: "x".repeat(201), okLong: "y".repeat(200),
        nested: { a: 1 }, list: [1], nul: null, bad: Number.NaN,
        "Bad-Key": "v", "1abc": "v", up: "v", ["k".repeat(33)]: "v",
      })],
    });
    expect(JSON.parse((await rows())[0]?.props ?? "null")).toEqual({
      via: "link", n: 3, ok: true, okLong: "y".repeat(200), up: "v",
    });
  });

  it("props 문자열 길이는 코드 포인트로 센다 (200)", async () => {
    await post({ ...base, events: [ev("app_open", { ok: "😀".repeat(150), no: "😀".repeat(201), edge: "😀".repeat(200) })] });
    expect(JSON.parse((await rows())[0]?.props ?? "null")).toEqual({ ok: "😀".repeat(150), edge: "😀".repeat(200) });
  });

  it("props 는 20개까지만 남기고, 다 걸러지면 null", async () => {
    const props = Object.fromEntries(Array.from({ length: 25 }, (_, i) => [`p${i}`, i]));
    await post({ ...base, events: [ev("app_open", props), ev("app_open", { a: "x@y" })] });
    const stored = await rows();
    expect(Object.keys(JSON.parse(stored[0]?.props ?? "{}"))).toHaveLength(20);
    expect(stored[1]?.props).toBeNull();
  });

  it("클라이언트의 at 은 저장하지 않는다", async () => {
    await post({ ...base, events: [{ name: "app_open", at: 123456 }] });
    const [row] = await rows();
    expect(JSON.stringify(row)).not.toContain("123456");
    expect(row?.props).toBeNull();
    expect(Object.keys(row ?? {})).not.toContain("at");
  });

  it("appVersion 이 틀리면 null 로 저장하고 요청은 성공한다", async () => {
    for (const appVersion of ["x".repeat(33), "1 2", "v1;drop", 5, undefined]) {
      expect((await post({ ...base, appVersion, events: [ev("app_open")] })).status).toBe(204);
    }
    expect((await rows()).map((r) => r.app_version)).toEqual([null, null, null, null, null]);
  });

  it("본문이 16KB 를 넘으면 413 (Content-Length 가 있든 없든)", async () => {
    const big = JSON.stringify({ ...base, events: [ev("app_open", { pad: "z" }), { name: "x", at: 1, pad: "z".repeat(17000) }] });
    const res = await post(big);
    expect(res.status).toBe(413);
    expect(await res.json()).toEqual({ code: "TOO_LARGE" });
    const lying = await post(big, { "Content-Length": "10" });
    expect(lying.status).toBe(413);
    const declared = await post("{}", { "Content-Length": "99999" });
    expect(declared.status).toBe(413);
    expect(await rows()).toHaveLength(0);
  });

  it("정확히 16384 바이트는 받고 16385 바이트는 413 이다", async () => {
    const sized = (bytes: number) => {
      const shell = JSON.stringify({ ...base, events: [], pad: "" });
      const body = JSON.stringify({ ...base, events: [], pad: "z".repeat(bytes - new TextEncoder().encode(shell).length) });
      expect(new TextEncoder().encode(body).length).toBe(bytes);
      return body;
    };
    expect((await post(sized(16384))).status).toBe(204);
    expect((await post(sized(16385))).status).toBe(413);
  });

  it("한글 본문의 크기는 UTF-8 바이트로 잰다", async () => {
    const body = JSON.stringify({ ...base, events: [], pad: "가".repeat(6000) });
    expect(body.length).toBeLessThan(16384);
    expect((await post(body)).status).toBe(413);
  });

  it("JSON 이 아니거나 모양이 틀리면 400 BAD_REQUEST", async () => {
    const bad: unknown[] = [
      "not json", "[]", "null", "5",
      { ...base, events: "x" }, { ...base },
      { ...base, events: [], anonId: "short" }, { ...base, events: [], anonId: "bad id!!!!!" },
      { ...base, events: [], anonId: "a".repeat(65) },
      { ...base, events: [], locale: "ko" }, { ...base, events: [], locale: "KO-kr" },
      { ...base, events: [], host: "web" }, { ...base, events: [], host: undefined },
    ];
    for (const body of bad) {
      const res = await post(body);
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ code: "BAD_REQUEST" });
    }
    expect(await rows()).toHaveLength(0);
  });

  it("IP · User-Agent 를 저장하지 않는다", async () => {
    await post(
      { ...base, events: [ev("app_open")] },
      { "CF-Connecting-IP": "203.0.113.77", "X-Forwarded-For": "198.51.100.9", "User-Agent": "SecretAgent/9.9" },
    );
    const cols = (await env.DB.prepare("PRAGMA table_info(events)").all<{ name: string }>()).results.map((c) => c.name);
    expect(cols).toEqual(["id", "received_at", "day", "anon_id", "name", "locale", "host", "app_version", "props"]);
    const dump = JSON.stringify(await rows());
    for (const secret of ["203.0.113.77", "198.51.100.9", "SecretAgent"]) expect(dump).not.toContain(secret);
  });

  it("GET 은 405", async () => {
    const res = await handler().fetch(new Request("https://yeongkk.test/api/events"), env, ctx);
    expect(res.status).toBe(405);
  });
});
