import { afterEach, describe, expect, it, vi } from "vitest";
import { deadline } from "./timeout";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("deadline", () => {
  it("AbortSignal.timeout 이 있으면 그 신호를 쓴다", () => {
    const spy = vi.spyOn(AbortSignal, "timeout");
    const d = deadline(10_000);
    expect(spy).toHaveBeenCalledWith(10_000);
    d.clear();
  });

  it("AbortSignal.timeout 이 없으면 타이머로 직접 끊는다", async () => {
    vi.useFakeTimers();
    const original = AbortSignal;
    const fake = class extends original {} as typeof AbortSignal;
    (fake as { timeout?: unknown }).timeout = undefined;
    vi.stubGlobal("AbortSignal", fake);
    const d = deadline(10_000);
    const hung = d.race(new Promise<string>(() => {}));
    expect(d.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(9_999);
    expect(d.signal.aborted).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(d.signal.aborted).toBe(true);
    await expect(hung).resolves.toBeNull();
  });

  it("먼저 끝난 요청은 결과를 그대로 준다", async () => {
    const d = deadline(10_000);
    await expect(d.race(Promise.resolve("ok"))).resolves.toBe("ok");
    d.clear();
  });
});
