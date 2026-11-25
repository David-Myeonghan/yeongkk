import { createNativeHost, type NativeHost } from "../../bridge/native-host";
import { BridgeError, isObj } from "../../bridge/protocol";

export type HapticKind = "success" | "error";

export interface ShareContent {
  title?: string;
  message?: string;
  url?: string;
}

export interface HostDeps {
  appVersion: string;
  platform: string;
  dismissedAction: string;
  share(content: ShareContent): Promise<{ action: string }>;
  haptic(kind: HapticKind): Promise<void>;
}

const HAPTIC_KINDS: readonly string[] = ["success", "error"];
const isHapticKind = (x: unknown): x is HapticKind => typeof x === "string" && HAPTIC_KINDS.includes(x);

const optionalText = (src: Record<string, unknown>, key: string): string | undefined => {
  const value = src[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new BridgeError("BAD_REQUEST", `${key} must be a string`);
  return value === "" ? undefined : value;
};

function shareContent(payload: unknown, platform: string): ShareContent {
  if (!isObj(payload)) throw new BridgeError("BAD_REQUEST", "share payload must be an object");
  const title = optionalText(payload, "title");
  const text = optionalText(payload, "text");
  const url = optionalText(payload, "url");
  if (text === undefined && url === undefined) throw new BridgeError("BAD_REQUEST", "share needs text or url");
  const common = title === undefined ? {} : { title };
  if (platform === "android") {
    return { ...common, message: [text, url].filter((part) => part !== undefined).join(" ") };
  }
  return { ...common, ...(text === undefined ? {} : { message: text }), ...(url === undefined ? {} : { url }) };
}

export function createAppHost(deps: HostDeps): NativeHost {
  return createNativeHost({
    appVersion: deps.appVersion,
    platform: deps.platform,
    handlers: {
      share: {
        version: 1,
        async handle(payload) {
          const result = await deps.share(shareContent(payload, deps.platform));
          return { completed: result.action !== deps.dismissedAction };
        },
      },
      haptics: {
        version: 1,
        async handle(payload) {
          const kind = isObj(payload) ? payload.kind : undefined;
          if (!isHapticKind(kind)) throw new BridgeError("BAD_REQUEST", "unknown haptics kind");
          await deps.haptic(kind);
          return undefined;
        },
      },
    },
  });
}
