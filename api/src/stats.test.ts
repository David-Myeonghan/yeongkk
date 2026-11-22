import { env, exports } from "cloudflare:workers";
import { beforeEach, describe, expect, it } from "vitest";
import { insertEvents, type EventRow } from "./db";
import { createHandler, routes } from "./index";

const ctx = { waitUntil() {}, passThroughOnException() {} } as unknown as ExecutionContext;

const get = (query: string, auth: string | null = "Bearer test-token") =>
  exports.default.fetch(
    new Request(`https://yeongkk.test/api/stats${query}`, { headers: auth === null ? {} : { Authorization: auth } }),
  );

const seed = (
  day: string, anonId: string, name: string,
  extra: { props?: Record<string, unknown>; host?: "app" | "browser"; appVersion?: string | null } = {},
): EventRow => ({
  receivedAt: `${day}T00:00:00.000Z`, day, anonId, name, locale: "ko-KR",
  host: extra.host ?? "browser", appVersion: extra.appVersion ?? null,
  props: extra.props ? JSON.stringify(extra.props) : null,
});

const done = { via: "native", completed: true };
const D1 = "2026-11-20";
const D2 = "2026-11-21";
const D3 = "2026-11-22";

beforeEach(async () => {
  await env.DB.prepare("DELETE FROM events").run();
});

describe("GET /api/stats 인증", () => {
  it("토큰이 없거나 틀리면 401 UNAUTHORIZED", async () => {
    for (const auth of [null, "Bearer wrong", "Bearer", "Bearer ", "test-token", "Basic test-token", "Bearer  test-token", "Bearer test-token x"]) {
      const res = await get(`?from=${D1}&to=${D3}`, auth);
      expect(res.status, String(auth)).toBe(401);
      expect(await res.json()).toEqual({ code: "UNAUTHORIZED" });
    }
  });

  it("인증 방식 이름은 대소문자를 가리지 않는다", async () => {
    for (const auth of ["bearer test-token", "BEARER test-token", "Bearer test-token"]) {
      expect((await get(`?from=${D1}&to=${D3}`, auth)).status, auth).toBe(200);
    }
  });

  it("서버 토큰이 비었거나 없으면 어떤 값으로도 401", async () => {
    for (const STATS_TOKEN of ["", undefined]) {
      const handler = createHandler(routes);
      for (const auth of ["Bearer ", "Bearer", "Bearer undefined", "Bearer test-token"]) {
        const res = await handler.fetch(
          new Request(`https://yeongkk.test/api/stats?from=${D1}&to=${D3}`, { headers: { Authorization: auth } }),
          { ...env, STATS_TOKEN } as unknown as Env,
          ctx,
        );
        expect(res.status).toBe(401);
      }
    }
  });

  it("맞는 토큰은 200 이고 no-store", async () => {
    const res = await get(`?from=${D1}&to=${D3}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(await res.json()).toEqual({ days: [], experiments: [], hosts: [], shareVia: {}, shareAttempts: {} });
  });

  it("인증은 날짜 검사보다 먼저", async () => {
    expect((await get("", null)).status).toBe(401);
  });
});

describe("GET /api/stats 기간 검사", () => {
  it("from · to 가 없거나 날짜 모양이 아니거나 from > to 이면 400", async () => {
    for (const q of [
      "", `?from=${D1}`, `?to=${D1}`, "?from=2026-1-1&to=2026-11-22", "?from=2026-02-30&to=2026-03-01",
      "?from=abc&to=def", `?from=${D3}&to=${D1}`, "?from=2026-13-01&to=2026-13-02",
    ]) {
      const res = await get(q);
      expect(res.status, q).toBe(400);
      expect(await res.json()).toEqual({ code: "BAD_REQUEST" });
    }
  });

  it("92일까지는 받고 93일부터 400", async () => {
    expect((await get("?from=2026-01-01&to=2026-04-02")).status).toBe(200);
    expect((await get("?from=2026-01-01&to=2026-04-03")).status).toBe(400);
  });
});

describe("GET /api/stats 집계", () => {
  const stats = async (from = D1, to = D3) => (await get(`?from=${from}&to=${to}`)).json<{
    days: { day: string; opened: number; started: number; completed: number; shared: number; returnedNextDay: number }[];
    experiments: { id: string; variant: string; exposed: number; completed: number; shared: number }[];
    hosts: { host: string; appVersion: string; opened: number }[];
    shareVia: Record<string, number>;
    shareAttempts: Record<string, number>;
  }>();

  it("같은 사람이 여러 번 열어도 opened 는 1, 단계별 사람 수를 센다", async () => {
    await insertEvents(env, [
      seed(D2, "anon-aaaaaaaa", "app_open"), seed(D2, "anon-aaaaaaaa", "app_open"), seed(D2, "anon-aaaaaaaa", "app_open"),
      seed(D2, "anon-bbbbbbbb", "app_open"),
      seed(D2, "anon-aaaaaaaa", "round_start"), seed(D2, "anon-aaaaaaaa", "round_start"), seed(D2, "anon-bbbbbbbb", "round_start"),
      seed(D2, "anon-aaaaaaaa", "round_complete"),
      seed(D2, "anon-aaaaaaaa", "share_done", { props: done }), seed(D2, "anon-aaaaaaaa", "share_done", { props: done }),
      seed(D2, "anon-aaaaaaaa", "share_click"),
    ]);
    expect((await stats()).days).toEqual([
      { day: D2, opened: 2, started: 2, completed: 1, shared: 1, returnedNextDay: 0 },
    ]);
  });

  it("어제 열고 오늘 또 연 사람은 어제의 returnedNextDay 에 센다", async () => {
    await insertEvents(env, [
      seed(D2, "anon-aaaaaaaa", "app_open"), seed(D2, "anon-bbbbbbbb", "app_open"), seed(D2, "anon-cccccccc", "app_open"),
      seed(D3, "anon-aaaaaaaa", "app_open"), seed(D3, "anon-aaaaaaaa", "app_open"),
      seed(D3, "anon-cccccccc", "round_start"),
    ]);
    const { days } = await stats();
    expect(days).toEqual([
      { day: D2, opened: 3, started: 0, completed: 0, shared: 0, returnedNextDay: 1 },
      { day: D3, opened: 1, started: 1, completed: 0, shared: 0, returnedNextDay: 0 },
    ]);
  });

  it("다음 날이 요청 범위 밖이어도 returnedNextDay 에 센다", async () => {
    await insertEvents(env, [seed(D2, "anon-aaaaaaaa", "app_open"), seed(D3, "anon-aaaaaaaa", "app_open")]);
    expect((await stats(D2, D2)).days).toEqual([
      { day: D2, opened: 1, started: 0, completed: 0, shared: 0, returnedNextDay: 1 },
    ]);
  });

  it("월말 → 다음 달 1일도 다음 날이다", async () => {
    await insertEvents(env, [seed("2026-11-30", "anon-aaaaaaaa", "app_open"), seed("2026-12-01", "anon-aaaaaaaa", "app_open")]);
    expect((await stats("2026-11-30", "2026-11-30")).days[0]?.returnedNextDay).toBe(1);
  });

  it("범위 밖 날의 이벤트는 세지 않는다", async () => {
    await insertEvents(env, [seed("2026-11-10", "anon-aaaaaaaa", "app_open"), seed(D2, "anon-bbbbbbbb", "app_open")]);
    expect((await stats()).days.map((d) => [d.day, d.opened])).toEqual([[D2, 1]]);
  });

  it("실험별 수는 experiment_exposure 를 받은 사람만 센다", async () => {
    const exposure = (anon: string, exp: string, variant: string) =>
      seed(D2, anon, "experiment_exposure", { props: { exp, variant } });
    await insertEvents(env, [
      exposure("anon-aaaaaaaa", "e1", "A"), exposure("anon-aaaaaaaa", "e1", "A"),
      exposure("anon-bbbbbbbb", "e1", "A"),
      exposure("anon-cccccccc", "e1", "B"),
      exposure("anon-aaaaaaaa", "e2", "X"),
      seed(D2, "anon-aaaaaaaa", "round_complete"), seed(D3, "anon-aaaaaaaa", "round_complete"),
      seed(D2, "anon-aaaaaaaa", "share_done", { props: done }),
      seed(D2, "anon-cccccccc", "round_complete"),
      seed(D2, "anon-dddddddd", "round_complete"), seed(D2, "anon-dddddddd", "share_done", { props: done }),
      seed(D2, "anon-eeeeeeee", "experiment_exposure", { props: { exp: "e1" } }),
      seed(D2, "anon-eeeeeeee", "experiment_exposure"),
      seed(D2, "anon-ffffffff", "experiment_exposure", { props: { exp: 5, variant: "A" } }),
    ]);
    expect((await stats()).experiments).toEqual([
      { id: "e1", variant: "A", exposed: 2, completed: 1, shared: 1 },
      { id: "e1", variant: "B", exposed: 1, completed: 1, shared: 0 },
      { id: "e2", variant: "X", exposed: 1, completed: 1, shared: 1 },
    ]);
  });

  it("노출 뒤 범위 밖에서만 완료한 사람은 completed 에 세지 않는다", async () => {
    await insertEvents(env, [
      seed(D2, "anon-aaaaaaaa", "experiment_exposure", { props: { exp: "e1", variant: "A" } }),
      seed("2026-12-30", "anon-aaaaaaaa", "round_complete"),
    ]);
    expect((await stats()).experiments).toEqual([{ id: "e1", variant: "A", exposed: 1, completed: 0, shared: 0 }]);
  });

  it("hosts 는 host · 앱 버전(null 은 빈 글)별 app_open 사람 수", async () => {
    await insertEvents(env, [
      seed(D2, "anon-aaaaaaaa", "app_open", { host: "app", appVersion: "1.0.0" }),
      seed(D2, "anon-aaaaaaaa", "app_open", { host: "app", appVersion: "1.0.0" }),
      seed(D3, "anon-aaaaaaaa", "app_open", { host: "app", appVersion: "1.0.0" }),
      seed(D2, "anon-bbbbbbbb", "app_open", { host: "app", appVersion: "1.0.0" }),
      seed(D2, "anon-cccccccc", "app_open", { host: "app", appVersion: "1.1.0" }),
      seed(D2, "anon-dddddddd", "app_open", { host: "browser" }),
      seed(D2, "anon-eeeeeeee", "round_start", { host: "browser" }),
    ]);
    expect((await stats()).hosts).toEqual([
      { host: "app", appVersion: "1.0.0", opened: 2 },
      { host: "app", appVersion: "1.1.0", opened: 1 },
      { host: "browser", appVersion: "", opened: 1 },
    ]);
  });

  it("shareVia 는 완료된 공유의 via 별 건수, shareAttempts 는 모든 share_done 의 via 별 건수", async () => {
    const ok = (via: string) => ({ via, completed: true });
    await insertEvents(env, [
      seed(D2, "anon-aaaaaaaa", "share_done", { props: ok("kakao") }),
      seed(D2, "anon-aaaaaaaa", "share_done", { props: ok("kakao") }),
      seed(D2, "anon-bbbbbbbb", "share_done", { props: ok("link") }),
      seed(D2, "anon-bbbbbbbb", "share_done", { props: ok("__proto__") }),
      seed(D2, "anon-bbbbbbbb", "share_done", { props: { via: "link", completed: false } }),
      seed(D2, "anon-bbbbbbbb", "share_done"),
      seed(D2, "anon-cccccccc", "share_click", { props: ok("kakao") }),
    ]);
    const { shareVia, shareAttempts } = await stats();
    expect(Object.entries(shareVia).sort()).toEqual([["__proto__", 1], ["kakao", 2], ["link", 1]]);
    expect(Object.entries(shareAttempts).sort()).toEqual([["__proto__", 1], ["kakao", 2], ["link", 2]]);
  });

  it("끝까지 공유한 사람만 shared: 취소한 공유와 via none 은 시도로만 센다", async () => {
    const arm = { exp: "e1", variant: "A" };
    await insertEvents(env, [
      seed(D2, "anon-aaaaaaaa", "share_done", { props: { via: "native", completed: true, ...arm } }),
      seed(D2, "anon-bbbbbbbb", "share_done", { props: { via: "web-share", completed: false, ...arm } }),
      seed(D2, "anon-cccccccc", "share_done", { props: { via: "none", completed: false, ...arm } }),
      ...["anon-aaaaaaaa", "anon-bbbbbbbb", "anon-cccccccc"].map((a) =>
        seed(D2, a, "experiment_exposure", { props: arm })),
    ]);
    const s = await stats();
    expect(s.days[0]?.shared).toBe(1);
    expect(s.shareVia).toEqual({ native: 1 });
    expect(s.shareAttempts).toEqual({ native: 1, "web-share": 1, none: 1 });
    expect(s.experiments).toEqual([{ id: "e1", variant: "A", exposed: 3, completed: 0, shared: 1 }]);
  });

  it("POST 는 405", async () => {
    const res = await exports.default.fetch(new Request("https://yeongkk.test/api/stats", { method: "POST" }));
    expect(res.status).toBe(405);
  });
});
