import { match } from "ts-pattern";

export const PROTOCOL_VERSION = 1;

export type ErrorCode = "UNSUPPORTED" | "TIMEOUT" | "FAILED" | "BAD_REQUEST" | "NO_HOST";

export interface HostInfo {
  protocol: number;
  appVersion: string;
  platform: string;
  capabilities: Record<string, number>;
}

export interface RequestMessage {
  v: number;
  kind: "request";
  id: string;
  name: string;
  payload?: unknown;
}

export interface OkResponseMessage {
  v: number;
  kind: "response";
  id: string;
  ok: true;
  result?: unknown;
}

export interface FailResponseMessage {
  v: number;
  kind: "response";
  id: string;
  ok: false;
  error: { code: string; message?: string };
}

export type ResponseMessage = OkResponseMessage | FailResponseMessage;

export interface EventMessage {
  v: number;
  kind: "event";
  name: string;
  payload?: unknown;
}

export type Message = RequestMessage | ResponseMessage | EventMessage;

export class BridgeError extends Error {
  code: string;

  constructor(code: string, message?: string) {
    super(message ?? code);
    this.name = "BridgeError";
    this.code = code;
  }
}

type Obj = Record<string, unknown>;

const isObj = (x: unknown): x is Obj => typeof x === "object" && x !== null && !Array.isArray(x);
const isText = (x: unknown): x is string => typeof x === "string" && x.length > 0;
const withOptional = <K extends string>(src: Obj, key: K): { [P in K]?: unknown } =>
  key in src && src[key] !== undefined ? ({ [key]: src[key] } as { [P in K]?: unknown }) : {};

function toObject(raw: unknown): Obj | null {
  if (typeof raw === "string") {
    try {
      const parsed: unknown = JSON.parse(raw);
      return isObj(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return isObj(raw) ? raw : null;
}

export function parseMessage(raw: unknown): Message | null {
  const o = toObject(raw);
  if (!o || o.v !== PROTOCOL_VERSION) return null;
  const v = PROTOCOL_VERSION;
  const kind = o.kind;

  return match(kind)
    .with("request", (): Message | null =>
      isText(o.id) && isText(o.name)
        ? { v, kind: "request", id: o.id, name: o.name, ...withOptional(o, "payload") }
        : null,
    )
    .with("event", (): Message | null =>
      isText(o.name) ? { v, kind: "event", name: o.name, ...withOptional(o, "payload") } : null,
    )
    .with("response", (): Message | null => {
      if (!isText(o.id)) return null;
      if (o.ok === true) return { v, kind: "response", id: o.id, ok: true, ...withOptional(o, "result") };
      if (o.ok === false && isObj(o.error) && isText(o.error.code)) {
        const error: { code: string; message?: string } = { code: o.error.code };
        if (typeof o.error.message === "string") error.message = o.error.message;
        return { v, kind: "response", id: o.id, ok: false, error };
      }
      return null;
    })
    .otherwise(() => null);
}

export function parseHostInfo(raw: unknown): HostInfo | null {
  if (!isObj(raw) || raw.protocol !== PROTOCOL_VERSION) return null;
  if (typeof raw.appVersion !== "string" || typeof raw.platform !== "string") return null;
  if (!isObj(raw.capabilities)) return null;
  const capabilities: Record<string, number> = {};
  for (const [name, version] of Object.entries(raw.capabilities)) {
    if (typeof version === "number" && Number.isInteger(version) && version > 0) capabilities[name] = version;
  }
  return { protocol: PROTOCOL_VERSION, appVersion: raw.appVersion, platform: raw.platform, capabilities };
}

export function request(id: string, name: string, payload?: unknown): RequestMessage {
  return payload === undefined
    ? { v: PROTOCOL_VERSION, kind: "request", id, name }
    : { v: PROTOCOL_VERSION, kind: "request", id, name, payload };
}

export const response = {
  ok(id: string, result?: unknown): OkResponseMessage {
    return result === undefined
      ? { v: PROTOCOL_VERSION, kind: "response", id, ok: true }
      : { v: PROTOCOL_VERSION, kind: "response", id, ok: true, result };
  },
  fail(id: string, code: string, message?: string): FailResponseMessage {
    return {
      v: PROTOCOL_VERSION,
      kind: "response",
      id,
      ok: false,
      error: message === undefined ? { code } : { code, message },
    };
  },
};
