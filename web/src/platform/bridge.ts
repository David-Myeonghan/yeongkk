import { attachToWindow, type BridgeWindow } from "@yk/bridge/attach";
import { createWebBridge, type WebBridge } from "@yk/bridge/web";

export function createBridgeGetter(win: BridgeWindow | undefined): () => WebBridge {
  let bridge: WebBridge | null = null;
  return () => {
    bridge ??= win ? attachToWindow(win) : createWebBridge({});
    return bridge;
  };
}

export const getBridge = createBridgeGetter(typeof window === "undefined" ? undefined : window);
