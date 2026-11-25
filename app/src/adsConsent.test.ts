import { describe, expect, it, vi } from "vitest";
import { createConsentGate, decidePersonalization, type ConsentDeps } from "./adsConsent";

const facts = { canRequestAds: true, gdprApplies: false, selectedPersonalised: false };

function make(overrides: Partial<ConsentDeps> = {}) {
  const deps: ConsentDeps = {
    gather: vi.fn(async () => facts),
    requestTracking: vi.fn(async () => true),
    initialize: vi.fn(async () => undefined),
    ...overrides,
  };
  return { deps, gate: createConsentGate(deps) };
}

describe("decidePersonalization", () => {
  const cases: Array<[string, Parameters<typeof decidePersonalization>[0], boolean]> = [
    ["GDPR 비대상 + 추적 허용 -> 맞춤 (뜻: 한국 사용자가 늘 비맞춤이면 잡힘)", { gdprApplies: false, selectedPersonalised: false, tracking: "granted" }, false],
    ["GDPR 비대상 + 추적 거부(iOS) -> 비맞춤", { gdprApplies: false, selectedPersonalised: false, tracking: "denied" }, true],
    ["GDPR 대상 + 맞춤 미선택 -> 비맞춤 (뜻: UMP 선택을 무시하면 잡힘)", { gdprApplies: true, selectedPersonalised: false, tracking: "granted" }, true],
    ["GDPR 대상 + 선택 + 추적 허용 -> 맞춤", { gdprApplies: true, selectedPersonalised: true, tracking: "granted" }, false],
    ["GDPR 대상 + 선택 + 추적 거부 -> 비맞춤", { gdprApplies: true, selectedPersonalised: true, tracking: "denied" }, true],
    ["안드로이드(ATT 없음) + GDPR 비대상 -> 맞춤", { gdprApplies: false, selectedPersonalised: false, tracking: "not-asked" }, false],
    ["안드로이드 + GDPR 대상 + 선택 -> 맞춤", { gdprApplies: true, selectedPersonalised: true, tracking: "not-asked" }, false],
  ];
  it.each(cases)("%s", (_title, input, expected) => {
    expect(decidePersonalization(input)).toBe(expected);
  });
});

describe("consent gate", () => {
  it("동의 창이 필요 없는 지역에서 추적을 허용하면 맞춤 광고", async () => {
    expect(await make().gate()).toEqual({ ok: true, nonPersonalized: false });
  });

  it("GDPR 지역에서 맞춤을 안 고르면 비맞춤", async () => {
    const { gate } = make({ gather: async () => ({ ...facts, gdprApplies: true }) });
    expect(await gate()).toEqual({ ok: true, nonPersonalized: true });
  });

  it("ATT 거부 -> 비맞춤", async () => {
    const { gate } = make({ requestTracking: async () => false });
    expect(await gate()).toEqual({ ok: true, nonPersonalized: true });
  });

  it("ATT 가 던지면 -> 비맞춤 (배너는 뜬다)", async () => {
    const { gate } = make({ requestTracking: async () => { throw new Error("att"); } });
    expect(await gate()).toEqual({ ok: true, nonPersonalized: true });
  });

  it("안드로이드처럼 ATT 가 없으면 부르지 않는다", async () => {
    const { gate } = make({ requestTracking: undefined });
    expect(await gate()).toEqual({ ok: true, nonPersonalized: false });
  });

  it("UMP 가 던지면 배너 없음, ATT · 초기화도 안 부른다 (뜻: 실패를 열림으로 처리하면 잡힘)", async () => {
    const { gate, deps } = make({ gather: async () => { throw new Error("ump"); } });
    expect(await gate()).toEqual({ ok: false });
    expect(deps.requestTracking).not.toHaveBeenCalled();
    expect(deps.initialize).not.toHaveBeenCalled();
  });

  it("canRequestAds 가 false 면 배너 없음", async () => {
    const { gate, deps } = make({ gather: async () => ({ ...facts, canRequestAds: false }) });
    expect(await gate()).toEqual({ ok: false });
    expect(deps.initialize).not.toHaveBeenCalled();
  });

  it("순서: UMP -> ATT -> SDK 초기화 (뜻: 동의 전에 초기화하면 잡힘)", async () => {
    const order: string[] = [];
    const { gate } = make({
      gather: async () => { order.push("ump"); return facts; },
      requestTracking: async () => { order.push("att"); return true; },
      initialize: async () => { order.push("init"); },
    });
    await gate();
    expect(order).toEqual(["ump", "att", "init"]);
  });

  it("초기화가 실패하면 배너 없음 (뜻: 초기화 실패를 삼키면 잡힘)", async () => {
    const { gate } = make({ initialize: async () => { throw new Error("init"); } });
    expect(await gate()).toEqual({ ok: false });
  });

  it("동시에 두 번 불러도 흐름 · 초기화는 한 번 (뜻: 동의창이 두 번 뜨면 잡힘)", async () => {
    const { gate, deps } = make();
    const [a, b] = await Promise.all([gate(), gate()]);
    expect(a).toEqual(b);
    expect(deps.gather).toHaveBeenCalledTimes(1);
    expect(deps.requestTracking).toHaveBeenCalledTimes(1);
    expect(deps.initialize).toHaveBeenCalledTimes(1);
  });

  it("성공한 뒤에는 다시 묻지 않는다", async () => {
    const { gate, deps } = make();
    await gate();
    await gate();
    expect(deps.gather).toHaveBeenCalledTimes(1);
  });

  it("실패한 뒤에는 다음 호출에서 다시 시도한다 (뜻: 실패를 영영 기억하면 잡힘)", async () => {
    const gather = vi.fn<ConsentDeps["gather"]>().mockRejectedValueOnce(new Error("net")).mockResolvedValueOnce(facts);
    const gate = createConsentGate({ gather, initialize: async () => undefined });
    expect(await gate()).toEqual({ ok: false });
    expect(await gate()).toEqual({ ok: true, nonPersonalized: false });
  });
});
