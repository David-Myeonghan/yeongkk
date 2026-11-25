// 앱 버전별 동작 표. 깔려 있는 옛 앱과 새 웹이 섞여도 웹이 깨지지 않는다는 것을 줄마다 고정한다.
// 웹 쪽 브릿지와 앱 쪽 처리기를 메모리 안에서 이어 붙여 실제 메시지를 주고받는다.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNativeHost, type Handlers } from "./native-host";
import { BridgeError, PROTOCOL_VERSION, request, response } from "./protocol";
import { share } from "./share";
import { createWebBridge, type WebBridge } from "./web";

interface Shell {
  /** 문서 시작 전에 자기 소개를 넣어 두는가 (빠른 길) */
  injects: boolean;
  /** 메시지에 답하는가. false = 창구는 있는데 아무 답이 없는 껍데기 */
  answers: boolean;
  appVersion: string;
  handlers: Handlers;
  /** 규약 버전을 속일 때 */
  protocol?: number;
}

const shared: string[] = [];
const shareHandler = { version: 1, handle: (payload: unknown) => { shared.push(JSON.stringify(payload)); return { completed: true }; } };

const SHELLS = {
  "껍데기 1.0": { injects: true, answers: true, appVersion: "1.0.0", handlers: { share: shareHandler } },
  "껍데기 1.1": {
    injects: true, answers: true, appVersion: "1.1.0",
    handlers: { share: shareHandler, haptics: { version: 1, handle: () => null }, notify: { version: 1, handle: () => ({ granted: true, scheduled: false }) } },
  },
  "정보를 안 넣는 옛 껍데기": { injects: false, answers: true, appVersion: "0.9.0", handlers: { share: shareHandler } },
  "답이 없는 껍데기": { injects: false, answers: false, appVersion: "0.1.0", handlers: {} },
  "규약 2를 말하는 미래 껍데기": { injects: true, answers: true, appVersion: "9.0.0", handlers: { share: shareHandler }, protocol: 2 },
} satisfies Record<string, Shell>;

/** 껍데기 하나와 웹 브릿지를 이어 붙인다. shell 이 없으면 브라우저. */
function connect(shell?: Shell): { bridge: WebBridge; sent: string[] } {
  const sent: string[] = [];
  if (!shell) return { bridge: createWebBridge({}), sent };
  const host = createNativeHost({ appVersion: shell.appVersion, platform: "ios", handlers: shell.handlers });
  const injected = shell.injects ? { ...host.info(), protocol: shell.protocol ?? PROTOCOL_VERSION } : undefined;
  const bridge: WebBridge = createWebBridge({
    injected,
    post: (raw) => {
      sent.push(raw);
      if (!shell.answers) return;
      void host.handle(raw).then((reply) => { if (reply !== null) bridge.receive(reply); });
    },
  });
  return { bridge, sent };
}

const webShare = vi.fn(async () => undefined);
const clipboard = vi.fn(async () => undefined);
const env = () => ({ webShare, clipboardWrite: clipboard });
const card = { title: "영크크", text: "10점 — 이미 영크크", url: "https://yeongkk.example/r/1" };

beforeEach(() => { vi.useFakeTimers(); shared.length = 0; webShare.mockClear(); clipboard.mockClear(); });
afterEach(() => { vi.useRealTimers(); });

/** 인사가 끝날 때까지 가짜 시계를 돌린다. */
async function ready(bridge: WebBridge) {
  const p = bridge.ready();
  await vi.runAllTimersAsync();
  return p;
}

describe("인사 — 누구와 이야기하는지", () => {
  it("브라우저: 앱 없음", async () => {
    const { bridge, sent } = connect();
    expect(await ready(bridge)).toBeNull();
    expect(sent).toEqual([]);
    expect(bridge.has("share")).toBe(false);
  });

  it("껍데기 1.0: 넣어 둔 정보로 바로 안다 — hello 를 보내지 않는다", async () => {
    const { bridge, sent } = connect(SHELLS["껍데기 1.0"]);
    const info = await ready(bridge);
    expect(info).toMatchObject({ appVersion: "1.0.0", capabilities: { share: 1 } });
    expect(sent).toEqual([]);
  });

  it("정보를 안 넣는 옛 껍데기: hello 로 물어서 안다", async () => {
    const { bridge, sent } = connect(SHELLS["정보를 안 넣는 옛 껍데기"]);
    const info = await ready(bridge);
    expect(info).toMatchObject({ appVersion: "0.9.0", capabilities: { share: 1 } });
    expect(sent).toHaveLength(1);
    expect(JSON.parse(sent[0]!)).toMatchObject({ kind: "request", name: "hello" });
  });

  it("답이 없는 껍데기: 정해진 시간 뒤 앱 없는 것으로 본다", async () => {
    const { bridge } = connect(SHELLS["답이 없는 껍데기"]);
    expect(await ready(bridge)).toBeNull();
    expect(bridge.has("share")).toBe(false);
  });

  it("규약 2를 말하는 미래 껍데기: 앱 없는 것으로 본다", async () => {
    const { bridge } = connect(SHELLS["규약 2를 말하는 미래 껍데기"]);
    expect(await ready(bridge)).toBeNull();
    expect(bridge.has("share")).toBe(false);
  });

  it("ready 는 몇 번을 불러도 인사를 한 번만 한다", async () => {
    const { bridge, sent } = connect(SHELLS["정보를 안 넣는 옛 껍데기"]);
    await Promise.all([ready(bridge), ready(bridge)]);
    await ready(bridge);
    expect(sent).toHaveLength(1);
  });
});

describe("기능 — 묻고 쓴다", () => {
  it("껍데기 1.0 에 없는 기능은 보내지도 않고 UNSUPPORTED", async () => {
    const { bridge, sent } = connect(SHELLS["껍데기 1.0"]);
    await ready(bridge);
    await expect(bridge.call("haptics")).rejects.toMatchObject({ code: "UNSUPPORTED" });
    expect(sent).toEqual([]);
  });

  it("껍데기 1.1 은 셋 다 앱이 처리한다", async () => {
    const { bridge } = connect(SHELLS["껍데기 1.1"]);
    await ready(bridge);
    expect([bridge.has("share"), bridge.has("haptics"), bridge.has("notify")]).toEqual([true, true, true]);
    const p = bridge.call("notify");
    await vi.runAllTimersAsync();
    await expect(p).resolves.toEqual({ granted: true, scheduled: false });
  });

  it("기능 버전이 모자라면 has 는 거짓", async () => {
    const { bridge } = connect(SHELLS["껍데기 1.0"]);
    await ready(bridge);
    expect(bridge.has("share", 1)).toBe(true);
    expect(bridge.has("share", 2)).toBe(false);
  });

  it("브라우저에서 부르면 NO_HOST", async () => {
    const { bridge } = connect();
    await ready(bridge);
    await expect(bridge.call("share", card)).rejects.toMatchObject({ code: "NO_HOST" });
  });

  it("오류는 BridgeError 로 온다", async () => {
    const { bridge } = connect();
    await ready(bridge);
    await expect(bridge.call("share")).rejects.toBeInstanceOf(BridgeError);
  });
});

describe("공유 — 앱 → 웹 공유 → 복사 순으로 대신한다", () => {
  it("브라우저: 웹 공유", async () => {
    const { bridge } = connect();
    await ready(bridge);
    expect(await share(bridge, card, env())).toEqual({ via: "web-share", completed: true });
    expect(webShare).toHaveBeenCalledWith(card);
  });

  it("껍데기 1.0: 앱 공유 시트", async () => {
    const { bridge } = connect(SHELLS["껍데기 1.0"]);
    await ready(bridge);
    const p = share(bridge, card, env());
    await vi.runAllTimersAsync();
    expect(await p).toEqual({ via: "native", completed: true });
    expect(shared).toEqual([JSON.stringify(card)]);
    expect(webShare).not.toHaveBeenCalled();
  });

  it("답이 없는 껍데기: 웹 공유로 넘어간다", async () => {
    const { bridge } = connect(SHELLS["답이 없는 껍데기"]);
    await ready(bridge);
    expect(await share(bridge, card, env())).toEqual({ via: "web-share", completed: true });
  });

  it("웹 공유도 없으면 복사", async () => {
    const { bridge } = connect();
    await ready(bridge);
    expect(await share(bridge, card, { clipboardWrite: clipboard })).toEqual({ via: "clipboard", completed: true });
    expect(clipboard).toHaveBeenCalledWith("10점 — 이미 영크크 https://yeongkk.example/r/1");
  });

  it("아무것도 없으면 none — 던지지 않는다", async () => {
    const { bridge } = connect();
    await ready(bridge);
    expect(await share(bridge, card, {})).toEqual({ via: "none", completed: false });
  });

  it("사용자가 웹 공유 창을 닫으면 복사로 넘어가지 않는다", async () => {
    const { bridge } = connect();
    await ready(bridge);
    const cancel = vi.fn(async () => { throw Object.assign(new Error("cancel"), { name: "AbortError" }); });
    expect(await share(bridge, card, { webShare: cancel, clipboardWrite: clipboard })).toEqual({ via: "web-share", completed: false });
    expect(clipboard).not.toHaveBeenCalled();
  });

  it("기능표에는 있는데 앱이 UNSUPPORTED 로 답하면 웹 공유로 넘어간다", async () => {
    const sent: string[] = [];
    const bridge: WebBridge = createWebBridge({
      injected: { protocol: PROTOCOL_VERSION, appVersion: "1.0.1", platform: "android", capabilities: { share: 1 } },
      post: (raw) => {
        sent.push(raw);
        const req = JSON.parse(raw) as { id: string };
        bridge.receive(response.fail(req.id, "UNSUPPORTED"));
      },
    });
    await ready(bridge);
    expect(await share(bridge, card, env())).toEqual({ via: "web-share", completed: true });
    expect(sent).toHaveLength(1);
  });
});

describe("시간 제한과 깨진 메시지 — 죽지 않는다", () => {
  it("답이 안 오면 TIMEOUT, 늦게 온 답은 버린다", async () => {
    const sent: string[] = [];
    const bridge = createWebBridge(
      { injected: { protocol: PROTOCOL_VERSION, appVersion: "1.0.0", platform: "ios", capabilities: { share: 1 } }, post: (raw) => { sent.push(raw); } },
      { callTimeoutMs: 1000 },
    );
    await ready(bridge);
    const p = bridge.call("share", card);
    const assertion = expect(p).rejects.toMatchObject({ code: "TIMEOUT" });
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
    const id = (JSON.parse(sent[0]!) as { id: string }).id;
    expect(() => bridge.receive(response.ok(id, { completed: true }))).not.toThrow();
  });

  it("같은 답이 두 번 와도 한 번만 쓴다", async () => {
    const sent: string[] = [];
    const bridge = createWebBridge({
      injected: { protocol: PROTOCOL_VERSION, appVersion: "1.0.0", platform: "ios", capabilities: { share: 1 } },
      post: (raw) => { sent.push(raw); },
    });
    await ready(bridge);
    const p = bridge.call("share", card);
    const id = (JSON.parse(sent[0]!) as { id: string }).id;
    bridge.receive(response.ok(id, { completed: true }));
    bridge.receive(response.fail(id, "FAILED"));
    await expect(p).resolves.toEqual({ completed: true });
  });

  it.each([
    ["JSON 이 아닌 글", "{oops"],
    ["모르는 종류", { v: 1, kind: "stream" }],
    ["모르는 규약 버전", { v: 7, kind: "event", name: "resume" }],
    ["주인 없는 응답", response.ok("nobody", 1)],
    ["웹이 처리하지 않는 요청", request("r1", "open")],
  ])("%s 는 버린다", async (_label, raw) => {
    const { bridge } = connect(SHELLS["껍데기 1.0"]);
    await ready(bridge);
    expect(() => bridge.receive(raw)).not.toThrow();
  });

  it("이벤트: 듣는 쪽이 있으면 전달하고, 모르는 이벤트는 버린다", async () => {
    const { bridge } = connect(SHELLS["껍데기 1.0"]);
    await ready(bridge);
    const seen: unknown[] = [];
    const off = bridge.on("resume", (payload) => { seen.push(payload); });
    bridge.receive({ v: 1, kind: "event", name: "resume", payload: { at: 1 } });
    bridge.receive({ v: 1, kind: "event", name: "나중에-생긴-이벤트" });
    off();
    bridge.receive({ v: 1, kind: "event", name: "resume", payload: { at: 2 } });
    expect(seen).toEqual([{ at: 1 }]);
  });

  it("듣는 쪽이 던져도 다른 듣는 쪽은 받는다", async () => {
    const { bridge } = connect(SHELLS["껍데기 1.0"]);
    await ready(bridge);
    const seen: unknown[] = [];
    bridge.on("resume", () => { throw new Error("boom"); });
    bridge.on("resume", (payload) => { seen.push(payload); });
    expect(() => bridge.receive({ v: 1, kind: "event", name: "resume", payload: 1 })).not.toThrow();
    expect(seen).toEqual([1]);
  });
});
