import { BridgeError, isObj } from "./protocol";
import type { WebBridge } from "./web";

const NATIVE_SHARE_TIMEOUT_MS = 60_000;

export interface ShareData {
  title?: string;
  text?: string;
  url?: string;
}

export interface ShareEnv {
  webShare?: (data: ShareData) => Promise<void>;
  clipboardWrite?: (text: string) => Promise<void>;
}

export interface ShareResult {
  via: "native" | "web-share" | "clipboard" | "none";
  completed: boolean;
}

const isAbort = (e: unknown): boolean => typeof e === "object" && e !== null && (e as { name?: unknown }).name === "AbortError";

export async function share(bridge: WebBridge, data: ShareData, env: ShareEnv): Promise<ShareResult> {
  try {
    const result = await bridge.call("share", data, { timeoutMs: NATIVE_SHARE_TIMEOUT_MS });
    const completed = isObj(result) && typeof result.completed === "boolean" ? result.completed : true;
    return { via: "native", completed };
  } catch (e) {
    if (e instanceof BridgeError && e.code === "TIMEOUT") return { via: "native", completed: false };
  }

  if (env.webShare) {
    try {
      await env.webShare(data);
      return { via: "web-share", completed: true };
    } catch (e) {
      if (isAbort(e)) return { via: "web-share", completed: false };
    }
  }

  const copyText = [data.text, data.url].filter(Boolean).join(" ");
  if (env.clipboardWrite && copyText) {
    try {
      await env.clipboardWrite(copyText);
      return { via: "clipboard", completed: true };
    } catch {
      return { via: "none", completed: false };
    }
  }

  return { via: "none", completed: false };
}
