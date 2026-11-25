import { describe, expect, it, vi } from "vitest";
import { PROTOCOL_VERSION, request } from "../../bridge/protocol";
import { createAppHost, type HostDeps } from "./host";

type Reply = { ok: boolean; result?: unknown; error?: { code: string; message?: string } };

function make(overrides: Partial<HostDeps> = {}) {
  const deps: HostDeps = {
    appVersion: "0.1.0",
    platform: "ios",
    dismissedAction: "dismissedAction",
    share: vi.fn(async () => ({ action: "sharedAction" })),
    haptic: vi.fn(async () => undefined),
    ...overrides,
  };
  return { deps, host: createAppHost(deps) };
}

async function call(host: ReturnType<typeof make>["host"], name: string, payload?: unknown): Promise<Reply> {
  const raw = await host.handle(JSON.stringify(request("r1", name, payload)));
  if (raw === null) throw new Error("no reply");
  return JSON.parse(raw) as Reply;
}

describe("info", () => {
  it("규약 버전 · 앱 버전 · 플랫폼 · 기능표를 싣는다", () => {
    expect(make().host.info()).toEqual({
      protocol: PROTOCOL_VERSION,
      appVersion: "0.1.0",
      platform: "ios",
      capabilities: { share: 1, haptics: 1 },
    });
  });
});

describe("share", () => {
  it("iOS: text 는 message, url 은 url 로 넘긴다 (뜻: 필드 매핑이 바뀌면 잡힘)", async () => {
    const { host, deps } = make();
    const reply = await call(host, "share", { title: "뭔말이야", text: "3점", url: "https://q.example/?r=3" });
    expect(deps.share).toHaveBeenCalledWith({ title: "뭔말이야", message: "3점", url: "https://q.example/?r=3" });
    expect(reply).toMatchObject({ ok: true, result: { completed: true } });
  });

  it("Android: url 은 따로 못 보내니 message 끝에 붙인다", async () => {
    const { host, deps } = make({ platform: "android" });
    await call(host, "share", { title: "t", text: "3점", url: "https://q.example/" });
    expect(deps.share).toHaveBeenCalledWith({ title: "t", message: "3점 https://q.example/" });
  });

  it("Android: url 만 있어도 message 가 된다", async () => {
    const { host, deps } = make({ platform: "android" });
    await call(host, "share", { url: "https://q.example/" });
    expect(deps.share).toHaveBeenCalledWith({ message: "https://q.example/" });
  });

  it("사용자가 닫으면 completed:false (닫기를 완료로 보면 잡힘)", async () => {
    const { host } = make({ share: async () => ({ action: "dismissedAction" }) });
    expect(await call(host, "share", { text: "x" })).toMatchObject({ ok: true, result: { completed: false } });
  });

  it("안드로이드처럼 늘 sharedAction 만 오면 completed:true", async () => {
    const { host } = make({ platform: "android", share: async () => ({ action: "sharedAction" }) });
    expect(await call(host, "share", { text: "x" })).toMatchObject({ result: { completed: true } });
  });

  it("공유 호출이 던지면 FAILED 와 메시지", async () => {
    const { host } = make({ share: async () => { throw new Error("no sheet"); } });
    expect(await call(host, "share", { text: "x" })).toMatchObject({ ok: false, error: { code: "FAILED", message: "no sheet" } });
  });

  it.each([
    ["payload 없음", undefined],
    ["문자열 payload", "hi"],
    ["빈 객체", {}],
    ["text 가 숫자", { text: 3 }],
    ["빈 문자열만", { text: "", url: "" }],
    ["url 이 객체", { url: {} }],
  ])("%s 는 BAD_REQUEST 이고 공유 창을 열지 않는다", async (_n, payload) => {
    const { host, deps } = make();
    expect(await call(host, "share", payload)).toMatchObject({ ok: false, error: { code: "BAD_REQUEST" } });
    expect(deps.share).not.toHaveBeenCalled();
  });
});

describe("haptics", () => {
  it.each(["success", "error"] as const)("%s 를 그대로 전달", async (kind) => {
    const { host, deps } = make();
    expect(await call(host, "haptics", { kind })).toMatchObject({ ok: true });
    expect(deps.haptic).toHaveBeenCalledWith(kind);
  });

  it.each([{ kind: "warning" }, { kind: "" }, { kind: 1 }, {}, undefined, "success", null])(
    "모르는 종류 %j 는 BAD_REQUEST 이고 진동하지 않는다",
    async (payload) => {
      const { host, deps } = make();
      expect(await call(host, "haptics", payload)).toMatchObject({ ok: false, error: { code: "BAD_REQUEST" } });
      expect(deps.haptic).not.toHaveBeenCalled();
    },
  );

  it("프로토타입 키 kind 도 거절", async () => {
    const { host } = make();
    expect(await call(host, "haptics", { kind: "constructor" })).toMatchObject({ error: { code: "BAD_REQUEST" } });
  });

  it("진동 호출이 던지면 FAILED (앱이 죽지 않음)", async () => {
    const { host } = make({ haptic: async () => { throw new Error("no engine"); } });
    expect(await call(host, "haptics", { kind: "error" })).toMatchObject({ error: { code: "FAILED" } });
  });
});

describe("bridge 규칙", () => {
  it("모르는 기능은 UNSUPPORTED", async () => {
    expect(await call(make().host, "notify", { action: "status" })).toMatchObject({ ok: false, error: { code: "UNSUPPORTED" } });
  });

  it("hello 는 info 로 답한다", async () => {
    const { host } = make();
    expect(await call(host, "hello")).toMatchObject({ ok: true, result: host.info() });
  });

  it("id 있는 깨진 요청은 BAD_REQUEST", async () => {
    const raw = await make().host.handle(JSON.stringify({ v: 99, kind: "request", id: "z", name: "share" }));
    expect(JSON.parse(raw ?? "null")).toMatchObject({ id: "z", ok: false, error: { code: "BAD_REQUEST" } });
  });

  it("id 없는 깨진 메시지와 JSON 아닌 글자는 답 없이 버린다", async () => {
    const { host } = make();
    expect(await host.handle("{}")).toBeNull();
    expect(await host.handle("not json")).toBeNull();
  });

  it("event 는 이벤트 메시지 문자열", () => {
    expect(JSON.parse(make().host.event("resume"))).toEqual({ v: 1, kind: "event", name: "resume" });
  });
});
