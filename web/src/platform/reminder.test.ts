import type { WebBridge } from "@yk/bridge/web";
import { describe, expect, it, vi } from "vitest";
import { createReminder } from "./reminder";

type Call = (name: string, payload?: unknown, opts?: { timeoutMs?: number }) => Promise<unknown>;

function fakeBridge(has: boolean, call: Call = () => Promise.resolve({ granted: true, scheduled: false })) {
  const callFn = vi.fn(call);
  const hasFn = vi.fn(() => has);
  const bridge = { ready: () => Promise.resolve(null), has: hasFn, call: callFn } as unknown as WebBridge;
  return { reminder: createReminder(() => bridge), callFn, hasFn };
}

const answer = (granted: boolean, scheduled: boolean): Call => () => Promise.resolve({ granted, scheduled });

describe("load", () => {
  it("앱에 notify 가 없으면 부르지 않고 숨긴다 (뜻: has 확인을 빼면 잡힘)", async () => {
    const { reminder, callFn, hasFn } = fakeBridge(false);
    expect(await reminder.load()).toEqual({ kind: "hidden" });
    expect(hasFn).toHaveBeenCalledWith("notify", 1);
    expect(callFn).not.toHaveBeenCalled();
  });

  it("status 로 묻고, 예약돼 있으면 켜진 상태", async () => {
    const { reminder, callFn } = fakeBridge(true, answer(true, true));
    expect(await reminder.load()).toEqual({ kind: "on" });
    expect(callFn).toHaveBeenCalledTimes(1);
    expect(callFn.mock.calls[0]?.slice(0, 2)).toEqual(["notify", { action: "status" }]);
  });

  it.each([
    [true, false],
    [false, false],
  ])("예약이 없으면 권한(%s)과 상관없이 제안 상태, 권한을 묻지 않는다", async (granted, scheduled) => {
    const { reminder, callFn } = fakeBridge(true, answer(granted, scheduled));
    expect(await reminder.load()).toEqual({ kind: "offer" });
    expect(callFn).toHaveBeenCalledTimes(1);
  });

  it("거절되면 던지지 않고 숨긴다", async () => {
    const { reminder } = fakeBridge(true, () => Promise.reject(new Error("TIMEOUT")));
    expect(await reminder.load()).toEqual({ kind: "hidden" });
  });

  it("모양이 틀린 답은 숨긴다", async () => {
    const { reminder } = fakeBridge(true, () => Promise.resolve({ granted: "yes" }));
    expect(await reminder.load()).toEqual({ kind: "hidden" });
    const second = fakeBridge(true, () => Promise.resolve(undefined));
    expect(await second.reminder.load()).toEqual({ kind: "hidden" });
    const third = fakeBridge(true, () => Promise.resolve({ granted: true, scheduled: "yes" }));
    expect(await third.reminder.load()).toEqual({ kind: "hidden" });
  });

  it("ready 가 거절돼도 숨기고 던지지 않는다", async () => {
    const bridge = { ready: () => Promise.reject(new Error("x")), has: () => true, call: vi.fn() } as unknown as WebBridge;
    expect(await createReminder(() => bridge).load()).toEqual({ kind: "hidden" });
    expect(bridge.call).not.toHaveBeenCalled();
  });
});

describe("enable", () => {
  it("schedule-weekly 를 부르고 예약되면 켜진 상태", async () => {
    const { reminder, callFn } = fakeBridge(true, answer(true, true));
    expect(await reminder.enable()).toEqual({ kind: "on" });
    expect(callFn.mock.calls[0]?.slice(0, 2)).toEqual(["notify", { action: "schedule-weekly" }]);
  });

  it("권한 창이 떠 있는 동안 기다릴 만큼 시간을 늘린다 (뜻: 기본 5초면 창을 보는 사이 끊김)", async () => {
    const { reminder, callFn } = fakeBridge(true, answer(true, true));
    await reminder.enable();
    const opts = callFn.mock.calls[0]?.[2];
    expect(opts?.timeoutMs).toBeGreaterThan(5000);
  });

  it("granted:false 면 설정 안내 상태 (뜻: 거부를 숨기거나 다시 묻으면 잡힘)", async () => {
    const { reminder, callFn } = fakeBridge(true, answer(false, false));
    expect(await reminder.enable()).toEqual({ kind: "denied" });
    expect(callFn).toHaveBeenCalledTimes(1);
  });

  it("허용했는데 예약이 안 됐으면 숨긴다", async () => {
    const { reminder } = fakeBridge(true, answer(true, false));
    expect(await reminder.enable()).toEqual({ kind: "hidden" });
  });

  it("거절 · 시간 초과면 던지지 않고 숨긴다", async () => {
    const { reminder } = fakeBridge(true, () => Promise.reject(new Error("TIMEOUT")));
    expect(await reminder.enable()).toEqual({ kind: "hidden" });
  });
});

describe("disable", () => {
  it("cancel 을 부르고 예약이 없으면 제안 상태로 돌아간다", async () => {
    const { reminder, callFn } = fakeBridge(true, answer(true, false));
    expect(await reminder.disable()).toEqual({ kind: "offer" });
    expect(callFn.mock.calls[0]?.slice(0, 2)).toEqual(["notify", { action: "cancel" }]);
  });

  it("그래도 예약이 남았다고 하면 켜진 상태 그대로", async () => {
    const { reminder } = fakeBridge(true, answer(true, true));
    expect(await reminder.disable()).toEqual({ kind: "on" });
  });

  it("거절이면 던지지 않고 숨긴다", async () => {
    const { reminder } = fakeBridge(true, () => Promise.reject(new Error("FAILED")));
    expect(await reminder.disable()).toEqual({ kind: "hidden" });
  });
});
