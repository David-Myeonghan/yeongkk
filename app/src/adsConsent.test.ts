import { describe, expect, it, vi } from "vitest";
import { createConsentGate, type ConsentDeps } from "./adsConsent";

function make(overrides: Partial<ConsentDeps> = {}) {
  const deps: ConsentDeps = {
    gather: vi.fn(async () => ({ canRequestAds: true, personalized: true })),
    requestTracking: vi.fn(async () => true),
    ...overrides,
  };
  return { deps, gate: createConsentGate(deps) };
}

describe("consent gate", () => {
  it("다 허용하면 개인 맞춤 광고 (뜻: 늘 비맞춤이면 잡힘)", async () => {
    expect(await make().gate()).toEqual({ ok: true, nonPersonalized: false });
  });

  it("UMP 에서 맞춤 거부 → 비맞춤", async () => {
    const { gate } = make({ gather: async () => ({ canRequestAds: true, personalized: false }) });
    expect(await gate()).toEqual({ ok: true, nonPersonalized: true });
  });

  it("ATT 거부 → 비맞춤", async () => {
    const { gate } = make({ requestTracking: async () => false });
    expect(await gate()).toEqual({ ok: true, nonPersonalized: true });
  });

  it("ATT 가 던지면 → 비맞춤 (배너는 뜬다)", async () => {
    const { gate } = make({ requestTracking: async () => { throw new Error("att"); } });
    expect(await gate()).toEqual({ ok: true, nonPersonalized: true });
  });

  it("안드로이드처럼 ATT 가 없으면 부르지 않는다", async () => {
    const { gate } = make({ requestTracking: undefined });
    expect(await gate()).toEqual({ ok: true, nonPersonalized: false });
  });

  it("UMP 가 던지면 배너 없음 (뜻: 실패를 열림으로 처리하면 잡힘)", async () => {
    const { gate, deps } = make({ gather: async () => { throw new Error("ump"); } });
    expect(await gate()).toEqual({ ok: false });
    expect(deps.requestTracking).not.toHaveBeenCalled();
  });

  it("canRequestAds 가 false 면 배너 없음", async () => {
    const { gate } = make({ gather: async () => ({ canRequestAds: false, personalized: false }) });
    expect(await gate()).toEqual({ ok: false });
  });

  it("UMP 가 먼저, ATT 는 그 다음", async () => {
    const order: string[] = [];
    const { gate } = make({
      gather: async () => { order.push("ump"); return { canRequestAds: true, personalized: true }; },
      requestTracking: async () => { order.push("att"); return true; },
    });
    await gate();
    expect(order).toEqual(["ump", "att"]);
  });

  it("동시에 두 번 불러도 흐름은 한 번 (뜻: 동의창이 두 번 뜨면 잡힘)", async () => {
    const { gate, deps } = make();
    const [a, b] = await Promise.all([gate(), gate()]);
    expect(a).toEqual(b);
    expect(deps.gather).toHaveBeenCalledTimes(1);
    expect(deps.requestTracking).toHaveBeenCalledTimes(1);
  });

  it("성공한 뒤에는 다시 묻지 않는다", async () => {
    const { gate, deps } = make();
    await gate();
    await gate();
    expect(deps.gather).toHaveBeenCalledTimes(1);
  });

  it("실패한 뒤에는 다음 호출에서 다시 시도한다 (뜻: 실패를 영영 기억하면 잡힘)", async () => {
    const gather = vi.fn<ConsentDeps["gather"]>()
      .mockRejectedValueOnce(new Error("net"))
      .mockResolvedValueOnce({ canRequestAds: true, personalized: true });
    const gate = createConsentGate({ gather });
    expect(await gate()).toEqual({ ok: false });
    expect(await gate()).toEqual({ ok: true, nonPersonalized: false });
  });
});
