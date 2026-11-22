import type { WebBridge } from "@yk/bridge/web";
import { describe, expect, it, vi } from "vitest";
import { hapticForAnswer } from "./haptics";

function fakeBridge(has: boolean, call: () => Promise<unknown>) {
  const callFn = vi.fn(call);
  const bridge = { has: () => has, call: callFn } as unknown as WebBridge;
  return { bridge, callFn };
}

describe("hapticForAnswer", () => {
  it("기능이 없으면 부르지 않는다", () => {
    const { bridge, callFn } = fakeBridge(false, () => Promise.resolve());
    hapticForAnswer(bridge, true);
    expect(callFn).not.toHaveBeenCalled();
  });

  it("정답은 success, 오답은 error", () => {
    const { bridge, callFn } = fakeBridge(true, () => Promise.resolve());
    hapticForAnswer(bridge, true);
    hapticForAnswer(bridge, false);
    expect(callFn).toHaveBeenNthCalledWith(1, "haptics", { kind: "success" });
    expect(callFn).toHaveBeenNthCalledWith(2, "haptics", { kind: "error" });
  });

  it("거절돼도 처리 안 된 거절이 남지 않는다", async () => {
    const seen: unknown[] = [];
    const onRejection = (e: unknown) => void seen.push(e);
    process.on("unhandledRejection", onRejection);
    const { bridge } = fakeBridge(true, () => Promise.reject(new Error("TIMEOUT")));
    hapticForAnswer(bridge, true);
    await new Promise((r) => setTimeout(r, 20));
    process.off("unhandledRejection", onRejection);
    expect(seen).toEqual([]);
  });

  it("동기로 던져도 밖으로 나가지 않는다", () => {
    const { bridge } = fakeBridge(true, () => {
      throw new Error("boom");
    });
    expect(() => hapticForAnswer(bridge, false)).not.toThrow();
  });
});
