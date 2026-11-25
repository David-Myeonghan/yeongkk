import type { WebBridge } from "@yk/bridge/web";
import { describe, expect, it, vi } from "vitest";
import { createAdsSync } from "./ads";

function fakeBridge(has: boolean, call: (name: string, payload?: unknown) => Promise<unknown> = () => Promise.resolve({ visible: true })) {
  const callFn = vi.fn(call);
  const hasFn = vi.fn(() => has);
  const bridge = { ready: () => Promise.resolve(null), has: hasFn, call: callFn } as unknown as WebBridge;
  return { bridge, callFn, hasFn };
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));

describe("createAdsSync", () => {
  it("기능이 있으면 설정 값으로 한 번 부른다 (뜻: 값을 하드코딩하면 잡힘)", async () => {
    const { bridge, callFn, hasFn } = fakeBridge(true);
    const sync = createAdsSync(() => bridge);
    sync(true);
    await flush();
    expect(hasFn).toHaveBeenCalledWith("ads", 1);
    expect(callFn).toHaveBeenCalledTimes(1);
    expect(callFn).toHaveBeenCalledWith("ads", { visible: true });
  });

  it("설정이 false 면 false 로 알린다", async () => {
    const { bridge, callFn } = fakeBridge(true);
    createAdsSync(() => bridge)(false);
    await flush();
    expect(callFn).toHaveBeenCalledWith("ads", { visible: false });
  });

  it("기능이 없으면 부르지 않는다 (뜻: has 확인을 빼면 잡힘)", async () => {
    const { bridge, callFn } = fakeBridge(false);
    createAdsSync(() => bridge)(true);
    await flush();
    expect(callFn).not.toHaveBeenCalled();
  });

  it("같은 값으로 여러 번 와도 한 번만 (페이지 로드당 한 번)", async () => {
    const { bridge, callFn } = fakeBridge(true);
    const sync = createAdsSync(() => bridge);
    sync(true);
    sync(true);
    await flush();
    sync(true);
    await flush();
    expect(callFn).toHaveBeenCalledTimes(1);
  });

  it("기본 설정이 먼저 오고 진짜 설정이 나중에 오면 바뀐 값만 한 번 더", async () => {
    const { bridge, callFn } = fakeBridge(true);
    const sync = createAdsSync(() => bridge);
    sync(false);
    await flush();
    sync(true);
    await flush();
    expect(callFn.mock.calls.map((c) => c[1])).toEqual([{ visible: false }, { visible: true }]);
  });

  it("거절돼도 처리 안 된 거절이 남지 않고 던지지도 않는다 (뜻: catch 를 빼면 잡힘)", async () => {
    const seen: unknown[] = [];
    const onRejection = (e: unknown) => void seen.push(e);
    process.on("unhandledRejection", onRejection);
    const { bridge } = fakeBridge(true, () => Promise.reject(new Error("TIMEOUT")));
    expect(() => createAdsSync(() => bridge)(true)).not.toThrow();
    await flush();
    await flush();
    process.off("unhandledRejection", onRejection);
    expect(seen).toEqual([]);
  });

  it("ready 가 거절돼도 조용히 끝난다", async () => {
    const bridge = { ready: () => Promise.reject(new Error("x")), has: () => true, call: vi.fn() } as unknown as WebBridge;
    createAdsSync(() => bridge)(true);
    await flush();
    expect(bridge.call).not.toHaveBeenCalled();
  });
});
