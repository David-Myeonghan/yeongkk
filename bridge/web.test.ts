import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PROTOCOL_VERSION, response } from "./protocol";
import { createWebBridge } from "./web";

const injected = { protocol: PROTOCOL_VERSION, appVersion: "1.0.0", platform: "ios", capabilities: { share: 1 } };

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("web bridge 세부", () => {
  it("has 는 기능표의 자기 키만 본다 — toString 같은 상속 이름은 거짓", async () => {
    const bridge = createWebBridge({ injected, post: () => undefined });
    await bridge.ready();
    expect(bridge.has("toString")).toBe(false);
    expect(bridge.has("constructor")).toBe(false);
    expect(bridge.has("__proto__")).toBe(false);
    expect(bridge.has("share")).toBe(true);
  });

  it("답이 오면 시간 제한 타이머를 치운다", async () => {
    const sent: string[] = [];
    const bridge = createWebBridge({ injected, post: (raw) => { sent.push(raw); } });
    await bridge.ready();
    const p = bridge.call("share");
    await vi.advanceTimersByTimeAsync(0);
    expect(vi.getTimerCount()).toBe(1);
    bridge.receive(response.ok((JSON.parse(sent[0]!) as { id: string }).id, 1));
    await p;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("시간이 지나면 대기 목록에서 빠진다 — 타이머가 남지 않는다", async () => {
    const bridge = createWebBridge({ injected, post: () => undefined }, { callTimeoutMs: 50 });
    await bridge.ready();
    const p = bridge.call("share");
    const assertion = expect(p).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(50);
    await assertion;
    expect(vi.getTimerCount()).toBe(0);
  });

  it("post 가 던지면 FAILED 로 끝낸다", async () => {
    const bridge = createWebBridge({ injected, post: () => { throw new Error("no channel"); } });
    await bridge.ready();
    await expect(bridge.call("share")).rejects.toMatchObject({ code: "FAILED" });
    expect(vi.getTimerCount()).toBe(0);
  });
});
