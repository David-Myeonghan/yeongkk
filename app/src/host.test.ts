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

  it("Android: 글만 있으면 글만 message 가 된다 (url 을 늘 붙이면 잡힘)", async () => {
    const { host, deps } = make({ platform: "android" });
    await call(host, "share", { text: "3점" });
    expect(deps.share).toHaveBeenCalledWith({ message: "3점" });
  });

  it("iOS: url 만 있으면 url 만 넘긴다 (빈 message 를 지어내면 잡힘)", async () => {
    const { host, deps } = make();
    await call(host, "share", { url: "https://q.example/" });
    expect(deps.share).toHaveBeenCalledWith({ url: "https://q.example/" });
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

describe("ads", () => {
  type AdsDeps = NonNullable<HostDeps["ads"]>;
  const makeAds = (overrides: Partial<AdsDeps> = {}): AdsDeps => ({
    consent: vi.fn(async () => ({ ok: true as const, nonPersonalized: false })),
    show: vi.fn(() => true),
    hide: vi.fn(),
    ...overrides,
  });

  it("광고가 꺼진 빌드는 기능표에 ads 가 없고 부르면 UNSUPPORTED (뜻: 늘 광고하면 잡힘)", async () => {
    const { host } = make();
    expect(host.info().capabilities).not.toHaveProperty("ads");
    expect(await call(host, "ads", { visible: true })).toMatchObject({ ok: false, error: { code: "UNSUPPORTED" } });
  });

  it("켠 빌드는 ads 1 을 알린다", () => {
    expect(make({ ads: makeAds() }).host.info().capabilities).toEqual({ share: 1, haptics: 1, ads: 1 });
  });

  it("visible:true → 동의 뒤 보여 주고 {visible:true}", async () => {
    const ads = makeAds();
    const { host } = make({ ads });
    expect(await call(host, "ads", { visible: true })).toMatchObject({ ok: true, result: { visible: true } });
    expect(ads.consent).toHaveBeenCalledTimes(1);
    expect(ads.show).toHaveBeenCalledWith(false);
  });

  it("visible:false → 동의를 묻지 않고 숨긴다 (뜻: 숨길 때도 동의창이 뜨면 잡힘)", async () => {
    const ads = makeAds();
    const { host } = make({ ads });
    expect(await call(host, "ads", { visible: false })).toMatchObject({ ok: true, result: { visible: false } });
    expect(ads.consent).not.toHaveBeenCalled();
    expect(ads.hide).toHaveBeenCalledTimes(1);
  });

  it("동의 거부 → 비맞춤으로 보여 준다 (뜻: nonPersonalized 를 안 넘기면 잡힘)", async () => {
    const ads = makeAds({ consent: async () => ({ ok: true, nonPersonalized: true }) });
    const { host } = make({ ads });
    expect(await call(host, "ads", { visible: true })).toMatchObject({ result: { visible: true } });
    expect(ads.show).toHaveBeenCalledWith(true);
  });

  it("동의 흐름 실패 → 배너 없이 {visible:false} (뜻: 실패에도 보이면 잡힘)", async () => {
    const ads = makeAds({ consent: async () => ({ ok: false }) });
    const { host } = make({ ads });
    expect(await call(host, "ads", { visible: true })).toMatchObject({ ok: true, result: { visible: false } });
    expect(ads.show).not.toHaveBeenCalled();
    expect(ads.hide).toHaveBeenCalled();
  });

  it("show 가 못 보였다고 하면(단위 아이디 없음) 그대로 {visible:false}", async () => {
    const { host } = make({ ads: makeAds({ show: () => false }) });
    expect(await call(host, "ads", { visible: true })).toMatchObject({ result: { visible: false } });
  });

  it("동의 흐름이 던져도 {visible:false} (뜻: 던진 오류가 BAD_REQUEST/FAILED 로 새면 잡힘)", async () => {
    const { host } = make({ ads: makeAds({ consent: async () => { throw new Error("boom"); } }) });
    expect(await call(host, "ads", { visible: true })).toMatchObject({ ok: true, result: { visible: false } });
  });

  it("payload 가 틀리면 BAD_REQUEST", async () => {
    const ads = makeAds();
    const { host } = make({ ads });
    for (const bad of [undefined, null, "yes", {}, { visible: "true" }, { visible: 1 }]) {
      expect(await call(host, "ads", bad)).toMatchObject({ ok: false, error: { code: "BAD_REQUEST" } });
    }
    expect(ads.consent).not.toHaveBeenCalled();
    expect(ads.show).not.toHaveBeenCalled();
  });

  it("동시에 보이기 두 번 → 동의 흐름은 한 번 (게이트 공유)", async () => {
    let calls = 0;
    const gate = (() => {
      let p: Promise<{ ok: true; nonPersonalized: boolean }> | null = null;
      return () => (p ??= (calls += 1, Promise.resolve({ ok: true as const, nonPersonalized: false })));
    })();
    const { host } = make({ ads: makeAds({ consent: gate }) });
    const [a, b] = await Promise.all([call(host, "ads", { visible: true }), call(host, "ads", { visible: true })]);
    expect(a).toMatchObject({ result: { visible: true } });
    expect(b).toMatchObject({ result: { visible: true } });
    expect(calls).toBe(1);
  });

  it("동의를 기다리는 사이 숨기기가 오면 나중 요청이 이긴다 (뜻: 늦게 끝난 동의가 숨김을 뒤집으면 잡힘)", async () => {
    let release: (v: { ok: true; nonPersonalized: boolean }) => void = () => undefined;
    const ads = makeAds({ consent: () => new Promise((r) => { release = r; }) });
    const { host } = make({ ads });
    const first = call(host, "ads", { visible: true });
    await Promise.resolve();
    const second = await call(host, "ads", { visible: false });
    release({ ok: true, nonPersonalized: false });
    expect(second).toMatchObject({ result: { visible: false } });
    expect(await first).toMatchObject({ ok: true, result: { visible: false } });
    expect(ads.show).not.toHaveBeenCalled();
  });
});
