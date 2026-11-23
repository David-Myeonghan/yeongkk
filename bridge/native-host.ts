import { match } from "ts-pattern";
import {
  BridgeError,
  PROTOCOL_VERSION,
  parseMessage,
  response,
  type HostInfo,
  type RequestMessage,
} from "./protocol";

export type Handlers = Record<string, { version: number; handle: (payload: unknown) => unknown | Promise<unknown> }>;

const FALLBACK_MESSAGE = "handler failed";

function failureText(e: unknown): string {
  try {
    const text = e instanceof Error ? e.message : String(e);
    return typeof text === "string" ? text : FALLBACK_MESSAGE;
  } catch {
    return FALLBACK_MESSAGE;
  }
}

function failureCode(e: unknown): string {
  if (!(e instanceof BridgeError)) return "FAILED";
  const code: unknown = e.code;
  return typeof code === "string" && code.length > 0 ? code : "FAILED";
}

function rejectedRequestId(raw: string): string | null {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
    const { kind, id } = parsed as Record<string, unknown>;
    return kind === "request" && typeof id === "string" && id.length > 0 ? id : null;
  } catch {
    return null;
  }
}

export interface NativeHost {
  info(): HostInfo;
  handle(raw: string): Promise<string | null>;
  event(name: string, payload?: unknown): string;
}

export function createNativeHost(opts: { appVersion: string; platform: string; handlers: Handlers }): NativeHost {
  const { appVersion, platform, handlers } = opts;

  const info = (): HostInfo => ({
    protocol: PROTOCOL_VERSION,
    appVersion,
    platform,
    capabilities: Object.fromEntries(Object.entries(handlers).map(([name, h]) => [name, h.version])),
  });

  async function answer(req: RequestMessage): Promise<string> {
    if (req.name === "hello") return JSON.stringify(response.ok(req.id, info()));
    if (!Object.hasOwn(handlers, req.name)) {
      return JSON.stringify(response.fail(req.id, "UNSUPPORTED", `unsupported request: ${req.name}`));
    }
    try {
      const result = await handlers[req.name].handle(req.payload);
      return JSON.stringify(response.ok(req.id, result));
    } catch (e) {
      return JSON.stringify(response.fail(req.id, failureCode(e), failureText(e)));
    }
  }

  return {
    info,
    async handle(raw) {
      try {
        const msg = parseMessage(raw);
        if (msg === null) {
          const id = rejectedRequestId(raw);
          return id === null ? null : JSON.stringify(response.fail(id, "BAD_REQUEST", "invalid request"));
        }
        return await match(msg)
          .with({ kind: "request" }, (req) => answer(req))
          .with({ kind: "response" }, () => null)
          .with({ kind: "event" }, () => null)
          .exhaustive();
      } catch {
        return null;
      }
    },
    event(name, payload) {
      return JSON.stringify(
        payload === undefined
          ? { v: PROTOCOL_VERSION, kind: "event", name }
          : { v: PROTOCOL_VERSION, kind: "event", name, payload },
      );
    },
  };
}
