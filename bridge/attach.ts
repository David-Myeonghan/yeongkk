import { createWebBridge, type WebBridge, type WebBridgeOptions } from "./web";

export type BridgeWindow = Window & {
  ReactNativeWebView?: { postMessage(s: string): void; injectedObjectJson?(): string | undefined };
  __YK_BRIDGE__?: { receive(raw: unknown): void };
};

function readInjected(view: BridgeWindow["ReactNativeWebView"]): unknown {
  try {
    const json = view?.injectedObjectJson?.();
    return typeof json === "string" ? (JSON.parse(json) as unknown) : undefined;
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
