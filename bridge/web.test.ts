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

  it("ready 전에 부른 call 은 인사가 끝난 뒤에야 보낸다", async () => {
    const sent: string[] = [];
    const bridge = createWebBridge({ post: (raw) => { sent.push(raw); } });
    const p = bridge.call("share");
    const assertion = expect(p).rejects.toMatchObject({ code: "NO_HOST" });
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0]!)).toMatchObject({ name: "hello" });
    await vi.advanceTimersByTimeAsync(300);
    await assertion;
    expect(sent).toHaveLength(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("인사 뒤에 기능이 있으면 그때 보낸다", async () => {
    const sent: string[] = [];
    const bridge = createWebBridge({
      post: (raw) => {
        sent.push(raw);
        const req = JSON.parse(raw) as { id: string; name: string };
        if (req.name === "hello") queueMicrotask(() => bridge.receive(response.ok(req.id, injected)));
      },
    });
    const p = bridge.call("share");
    await vi.advanceTimersByTimeAsync(0);
    expect(sent.map((s) => (JSON.parse(s) as { name: string }).name)).toEqual(["hello", "share"]);
    bridge.receive(response.ok((JSON.parse(sent[1]!) as { id: string }).id, "done"));
    await expect(p).resolves.toBe("done");
  });

  it("call 마다 timeoutMs 를 줄 수 있다", async () => {
    const bridge = createWebBridge({ injected, post: () => undefined }, { callTimeoutMs: 5000 });
    await bridge.ready();
    const p = bridge.call("share", undefined, { timeoutMs: 20 });
    const assertion = expect(p).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(20);
    await assertion;
  });

  it("helloTimeoutMs 를 바꿀 수 있다", async () => {
    const bridge = createWebBridge({ post: () => undefined }, { helloTimeoutMs: 40 });
    let done = false;
    void bridge.ready().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(39);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
    expect(bridge.host()).toBeNull();
  });
});
