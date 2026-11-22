import { BridgeError } from "./protocol";
import type { WebBridge } from "./web";

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

const isAbort = (e: unknown): boolean => e instanceof Error && e.name === "AbortError";

export async function share(bridge: WebBridge, data: ShareData, env: ShareEnv): Promise<ShareResult> {
  try {
    const result = await bridge.call<{ completed?: boolean } | undefined>("share", data);
    return { via: "native", completed: result?.completed ?? true };
  } catch (e) {
    if (!(e instanceof BridgeError)) throw e;
  }

  if (env.webShare) {
    try {
      await env.webShare(data);
      return { via: "web-share", completed: true };
    } catch (e) {
      if (isAbort(e)) return { via: "web-share", completed: false };
    }
  }

  if (env.clipboardWrite) {
    try {
      await env.clipboardWrite([data.text, data.url].filter(Boolean).join(" "));
      return { via: "clipboard", completed: true };
    } catch {
      return { via: "none", completed: false };
    }
  }

  return { via: "none", completed: false };
}
