import { createNativeHost, type NativeHost } from "../../bridge/native-host";
import { BridgeError, isObj } from "../../bridge/protocol";
import type { ConsentOutcome } from "./adsConsent";
import { notifyHandler, type NotifyDeps } from "./notify";

export type HapticKind = "success" | "error";

export type ShareContent = { title?: string } & ({ message: string; url?: string } | { url: string });

export interface AdsDeps {
  consent(): Promise<ConsentOutcome>;
  show(nonPersonalized: boolean): boolean;
  hide(): void;
}

export interface HostDeps {
  appVersion: string;
  platform: string;
  dismissedAction: string;
  share(content: ShareContent): Promise<{ action: string }>;
  haptic(kind: HapticKind): Promise<void>;
  notify: NotifyDeps;
  ads?: AdsDeps;
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
  const head = title === undefined ? {} : { title };
  if (text === undefined) {
    if (url === undefined) throw new BridgeError("BAD_REQUEST", "share needs text or url");
    return platform === "android" ? { ...head, message: url } : { ...head, url };
  }
  if (platform === "android") return { ...head, message: url === undefined ? text : `${text} ${url}` };
  return { ...head, message: text, ...(url === undefined ? {} : { url }) };
}

function adsHandler(ads: AdsDeps) {
  let wanted = false;
  const apply = async (visible: boolean): Promise<boolean> => {
    if (!visible) {
      ads.hide();
      return false;
    }
    let outcome: ConsentOutcome;
    try {
      outcome = await ads.consent();
    } catch {
      outcome = { ok: false };
    }
    if (!wanted) return false;
    if (outcome.ok && ads.show(outcome.nonPersonalized)) return true;
    ads.hide();
    return false;
  };
  return {
    version: 1,
    async handle(payload: unknown) {
      const visible = isObj(payload) ? payload.visible : undefined;
      if (typeof visible !== "boolean") throw new BridgeError("BAD_REQUEST", "visible must be a boolean");
      wanted = visible;
      return { visible: await apply(visible) };
    },
  };
}

export function createAppHost(deps: HostDeps): NativeHost {
  return createNativeHost({
    appVersion: deps.appVersion,
    platform: deps.platform,
    handlers: {
      ...(deps.ads ? { ads: adsHandler(deps.ads) } : {}),
      notify: notifyHandler(deps.notify),
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
