import type { BridgeWindow } from "@yk/bridge/attach";
import { describe, expect, it } from "vitest";
import { createBridgeGetter } from "./bridge";

function fakeWindow(injected?: unknown) {
  const posted: string[] = [];
  const win = {
    ReactNativeWebView: {
      postMessage: (s: string) => void posted.push(s),
      injectedObjectJson: () => (injected === undefined ? undefined : JSON.stringify(injected)),
    },
  } as unknown as BridgeWindow;
  return { win, posted };
}

describe("createBridgeGetter", () => {
  it("창에 한 번만 붙이고 같은 브릿지를 돌려준다", () => {
    const { win } = fakeWindow();
    const get = createBridgeGetter(win);
    const first = get();
    const receiver = win.__YK_BRIDGE__;
    expect(receiver).toBeDefined();
    expect(get()).toBe(first);
    expect(win.__YK_BRIDGE__).toBe(receiver);
  });

  it("앱이 미리 넣어 준 자기 소개를 읽는다", async () => {
    const { win } = fakeWindow({ protocol: 1, appVersion: "1.0.0", platform: "ios", capabilities: { share: 1 } });
    const bridge = createBridgeGetter(win)();
    expect((await bridge.ready())?.platform).toBe("ios");
    expect(bridge.has("share")).toBe(true);
  });

  it("창이 없으면 브라우저로 본다", async () => {
    const bridge = createBridgeGetter(undefined)();
    expect(await bridge.ready()).toBeNull();
    expect(bridge.has("share")).toBe(false);
  });
});
