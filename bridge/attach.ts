import { toObject } from "./protocol";
import { createWebBridge, type WebBridge, type WebBridgeOptions } from "./web";

export type BridgeWindow = Window & {
  ReactNativeWebView?: { postMessage(s: string): void; injectedObjectJson?(): string | undefined };
  __YK_BRIDGE__?: { receive(raw: unknown): void };
};

function readInjected(view: BridgeWindow["ReactNativeWebView"]): unknown {
  try {
    const json = view?.injectedObjectJson?.();
    if (typeof json !== "string" || json === "") return undefined;
    return toObject(json) ?? undefined;
  } catch {
    return undefined;
  }
}

export function attachToWindow(win: BridgeWindow, opts?: WebBridgeOptions): WebBridge {
  const view = win.ReactNativeWebView;
  const bridge = createWebBridge(
    { post: view ? (raw) => view.postMessage(raw) : undefined, injected: readInjected(view) },
    opts,
  );
  win.__YK_BRIDGE__ = { receive: (raw) => bridge.receive(raw) };
  return bridge;
}
