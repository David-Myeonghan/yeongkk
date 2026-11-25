import { describe, expect, it } from "vitest";
import { request } from "../../bridge/protocol";
import { createAppHost } from "./host";
import { REMINDER_BODY, REMINDER_TITLE, REMINDER_TRIGGER } from "./notify";
import type { NotifyDeps } from "./notify";

type Reply = { ok: boolean; result?: unknown; error?: { code: string; message?: string } };

function fakePlatform(opts: { granted?: boolean; grantsOnRequest?: boolean; scheduled?: boolean } = {}) {
  const log: string[] = [];
  const state = { granted: opts.granted ?? false, scheduled: opts.scheduled ?? false, live: opts.scheduled ? 1 : 0, schedules: [] as unknown[] };
  const notify: NotifyDeps = {
    permissionGranted: async () => {
      log.push("permission");
      return state.granted;
    },
    requestPermission: async () => {
      log.push("request");
      state.granted = opts.grantsOnRequest ?? false;
      return state.granted;
    },
    isScheduled: async () => {
      log.push("isScheduled");
      return state.live > 0;
    },
    cancel: async () => {
      log.push("cancel");
      state.live = 0;
    },
    schedule: async (content, trigger) => {
      log.push("schedule");
      state.schedules.push({ content, trigger });
      state.live += 1;
    },
  };
  return { notify, log, state };
}

function hostWith(notify: NotifyDeps) {
  return createAppHost({
    appVersion: "0.1.0",
    platform: "ios",
    dismissedAction: "dismissedAction",
    share: async () => ({ action: "sharedAction" }),
    haptic: async () => undefined,
    notify,
  });
}

async function call(notify: NotifyDeps, payload?: unknown): Promise<Reply> {
  const raw = await hostWith(notify).handle(JSON.stringify(request("n1", "notify", payload)));
  if (raw === null) throw new Error("no reply");
  return JSON.parse(raw) as Reply;
}

describe("notify: 기능표", () => {
  it("항상 notify 1 을 알린다", () => {
    expect(hostWith(fakePlatform().notify).info().capabilities).toMatchObject({ notify: 1 });
  });
});

describe("notify: status", () => {
  it.each([
    [true, true],
    [true, false],
    [false, false],
  ])("권한 %s, 예약 %s 를 그대로 알린다", async (granted, scheduled) => {
    const { notify } = fakePlatform({ granted, scheduled });
    expect(await call(notify, { action: "status" })).toMatchObject({ ok: true, result: { granted, scheduled } });
  });

  it("권한을 묻지 않고 예약도 건드리지 않는다 (뜻: status 가 request 를 부르면 잡힘)", async () => {
    const { notify, log } = fakePlatform({ granted: false });
    await call(notify, { action: "status" });
    expect(log).not.toContain("request");
    expect(log).not.toContain("schedule");
    expect(log).not.toContain("cancel");
  });
});

describe("notify: request", () => {
  it("허용하면 granted:true, 예약은 하지 않는다 (뜻: request 가 예약까지 하면 잡힘)", async () => {
    const { notify, log } = fakePlatform({ grantsOnRequest: true });
    expect(await call(notify, { action: "request" })).toMatchObject({ ok: true, result: { granted: true, scheduled: false } });
    expect(log).not.toContain("schedule");
  });

  it("거부하면 granted:false", async () => {
    const { notify } = fakePlatform({ grantsOnRequest: false });
    expect(await call(notify, { action: "request" })).toMatchObject({ ok: true, result: { granted: false, scheduled: false } });
  });

  it("이미 예약돼 있으면 그 상태를 그대로 알린다", async () => {
    const { notify } = fakePlatform({ granted: true, grantsOnRequest: true, scheduled: true });
    expect(await call(notify, { action: "request" })).toMatchObject({ result: { granted: true, scheduled: true } });
  });
});

describe("notify: schedule-weekly", () => {
  it("권한이 있으면 묻지 않고 하나만 예약한다 (뜻: 늘 묻거나 예약을 빼면 잡힘)", async () => {
    const { notify, log, state } = fakePlatform({ granted: true });
    expect(await call(notify, { action: "schedule-weekly" })).toMatchObject({ ok: true, result: { granted: true, scheduled: true } });
    expect(log).not.toContain("request");
    expect(state.live).toBe(1);
  });

  it("권한이 없으면 먼저 묻고, 허용하면 예약한다", async () => {
    const { notify, log } = fakePlatform({ granted: false, grantsOnRequest: true });
    expect(await call(notify, { action: "schedule-weekly" })).toMatchObject({ result: { granted: true, scheduled: true } });
    expect(log.indexOf("request")).toBeLessThan(log.indexOf("schedule"));
  });

  it("거부하면 예약하지 않는다 (뜻: 거부 뒤에도 예약하면 잡힘)", async () => {
    const { notify, log } = fakePlatform({ granted: false, grantsOnRequest: false });
    expect(await call(notify, { action: "schedule-weekly" })).toMatchObject({ ok: true, result: { granted: false, scheduled: false } });
    expect(log).not.toContain("schedule");
  });

  it("예약 전에 이전 것을 취소한다 (뜻: 취소를 빼면 두 개가 됨)", async () => {
    const { notify, log, state } = fakePlatform({ granted: true, scheduled: true });
    await call(notify, { action: "schedule-weekly" });
    expect(log.indexOf("cancel")).toBeGreaterThanOrEqual(0);
    expect(log.indexOf("cancel")).toBeLessThan(log.indexOf("schedule"));
    expect(state.live).toBe(1);
  });

  it("두 번 눌러도 하나다", async () => {
    const { notify, state } = fakePlatform({ granted: true });
    await call(notify, { action: "schedule-weekly" });
    await call(notify, { action: "schedule-weekly" });
    expect(state.live).toBe(1);
  });

  it("트리거는 월요일(weekday 2, 일요일이 1) 9시 0분 반복, 글은 한 곳의 문구 (뜻: 요일 · 시각 · 문구가 바뀌면 잡힘)", async () => {
    const { notify, state } = fakePlatform({ granted: true });
    await call(notify, { action: "schedule-weekly" });
    expect(state.schedules).toEqual([
      { content: { title: "뭔말이야", body: "이번 주 새 말이 올라왔어요." }, trigger: { type: "weekly", weekday: 2, hour: 9, minute: 0 } },
    ]);
    expect(REMINDER_TITLE).toBe("뭔말이야");
    expect(REMINDER_BODY).toBe("이번 주 새 말이 올라왔어요.");
    expect(REMINDER_TRIGGER).toEqual({ type: "weekly", weekday: 2, hour: 9, minute: 0 });
  });
});

describe("notify: cancel", () => {
  it("예약을 지우고 현재 상태를 알린다", async () => {
    const { notify, state } = fakePlatform({ granted: true, scheduled: true });
    expect(await call(notify, { action: "cancel" })).toMatchObject({ ok: true, result: { granted: true, scheduled: false } });
    expect(state.live).toBe(0);
  });

  it("권한을 묻지 않는다", async () => {
    const { notify, log } = fakePlatform({ granted: false, scheduled: true });
    await call(notify, { action: "cancel" });
    expect(log).not.toContain("request");
  });
});

describe("notify: 나쁜 요청과 실패", () => {
  it.each([
    ["payload 없음", undefined],
    ["문자열", "status"],
    ["빈 객체", {}],
    ["모르는 action", { action: "snooze" }],
    ["숫자 action", { action: 1 }],
    ["프로토타입 키", { action: "constructor" }],
    ["null", null],
  ])("%s 는 BAD_REQUEST 이고 아무것도 부르지 않는다", async (_n, payload) => {
    const { notify, log } = fakePlatform({ granted: true });
    expect(await call(notify, payload)).toMatchObject({ ok: false, error: { code: "BAD_REQUEST" } });
    expect(log).toEqual([]);
  });

  it.each(["permissionGranted", "requestPermission", "isScheduled", "cancel", "schedule"] as const)(
    "%s 가 던지면 FAILED (앱이 죽지 않음)",
    async (broken) => {
      const actions = ["status", "request", "schedule-weekly", "cancel"] as const;
      const replies = await Promise.all(
        actions.map((action) => {
          const { notify } = fakePlatform({ granted: true, grantsOnRequest: true, scheduled: true });
          return call({ ...notify, [broken]: async () => { throw new Error("native gone"); } }, { action });
        }),
      );
      expect(replies.some((r) => !r.ok && r.error?.code === "FAILED")).toBe(true);
      for (const r of replies) if (!r.ok) expect(r.error?.code).toBe("FAILED");
    },
  );

  it("네이티브 모듈이 없으면(불러오기 실패) 모든 action 이 FAILED", async () => {
    const missing = async (): Promise<never> => { throw new Error("Cannot find native module 'ExpoNotifications'"); };
    const notify: NotifyDeps = { permissionGranted: missing, requestPermission: missing, isScheduled: missing, cancel: missing, schedule: missing };
    for (const action of ["status", "request", "schedule-weekly", "cancel"]) {
      expect(await call(notify, { action })).toMatchObject({ ok: false, error: { code: "FAILED" } });
    }
  });
});
