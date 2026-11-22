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
      const code = e instanceof BridgeError ? e.code : "FAILED";
      const message = e instanceof Error ? e.message : String(e);
      return JSON.stringify(response.fail(req.id, code, message));
    }
  }

  return {
    info,
    async handle(raw) {
      try {
        const msg = parseMessage(raw);
        if (msg === null) return null;
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
