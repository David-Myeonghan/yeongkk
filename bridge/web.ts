import { match } from "ts-pattern";
import { BridgeError, parseHostInfo, parseMessage, request, type HostInfo, type ResponseMessage } from "./protocol";

export interface WebBridgeEnv {
  post?: (raw: string) => void;
  injected?: unknown;
}

export interface WebBridgeOptions {
  helloTimeoutMs?: number;
  callTimeoutMs?: number;
}

export interface WebBridge {
  ready(): Promise<HostInfo | null>;
  host(): HostInfo | null;
  has(name: string, minVersion?: number): boolean;
  call<T = unknown>(name: string, payload?: unknown, opts?: { timeoutMs?: number }): Promise<T>;
  on(event: string, fn: (payload: unknown) => void): () => void;
  receive(raw: unknown): void;
}

interface Pending {
  resolve: (result: unknown) => void;
  reject: (error: BridgeError) => void;
  timer: ReturnType<typeof setTimeout>;
}

export function createWebBridge(env: WebBridgeEnv, opts: WebBridgeOptions = {}): WebBridge {
  const helloTimeoutMs = opts.helloTimeoutMs ?? 300;
  const callTimeoutMs = opts.callTimeoutMs ?? 5000;
  const pending = new Map<string, Pending>();
  const listeners = new Map<string, Set<(payload: unknown) => void>>();
  let hostInfo: HostInfo | null = null;
  let greeting: Promise<HostInfo | null> | null = null;
  let counter = 0;

  function send(name: string, payload: unknown, timeoutMs: number): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!env.post) {
        reject(new BridgeError("NO_HOST", "no channel to the app"));
        return;
      }
      counter += 1;
      const id = `web-${counter}`;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new BridgeError("TIMEOUT", `no answer to ${name} in ${timeoutMs}ms`));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      try {
        env.post(JSON.stringify(request(id, name, payload)));
      } catch (e) {
        clearTimeout(timer);
        pending.delete(id);
        reject(new BridgeError("FAILED", e instanceof Error ? e.message : String(e)));
      }
    });
  }

  async function greet(): Promise<HostInfo | null> {
    if (!env.post) return null;
    if (env.injected !== undefined) return parseHostInfo(env.injected);
    try {
      return parseHostInfo(await send("hello", undefined, helloTimeoutMs));
    } catch {
      return null;
    }
  }

  function ready(): Promise<HostInfo | null> {
    greeting ??= greet().then((info) => {
      hostInfo = info;
      return info;
    });
    return greeting;
  }

  function settle(msg: ResponseMessage): void {
    const entry = pending.get(msg.id);
    if (!entry) return;
    pending.delete(msg.id);
    clearTimeout(entry.timer);
    match(msg)
      .with({ ok: true }, (ok) => entry.resolve(ok.result))
      .with({ ok: false }, (fail) => entry.reject(new BridgeError(fail.error.code, fail.error.message)))
      .exhaustive();
  }

  function emit(name: string, payload: unknown): void {
    const set = listeners.get(name);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch {
        // one failing listener must not block the others
      }
    }
  }

  function has(name: string, minVersion = 1): boolean {
    if (!hostInfo || !Object.hasOwn(hostInfo.capabilities, name)) return false;
    return hostInfo.capabilities[name] >= minVersion;
  }

  return {
    ready,
    host: () => hostInfo,
    has,
    call<T = unknown>(name: string, payload?: unknown, callOpts?: { timeoutMs?: number }): Promise<T> {
      const run = (): Promise<T> => {
        if (!hostInfo) return Promise.reject(new BridgeError("NO_HOST", "not running inside the app"));
        if (!has(name)) return Promise.reject(new BridgeError("UNSUPPORTED", `app does not support ${name}`));
        return send(name, payload, callOpts?.timeoutMs ?? callTimeoutMs) as Promise<T>;
      };
      return hostInfo !== null ? run() : ready().then(run);
    },
    on(event, fn) {
      const set = listeners.get(event) ?? new Set();
      set.add(fn);
      listeners.set(event, set);
      return () => {
        set.delete(fn);
      };
    },
    receive(raw) {
      const msg = parseMessage(raw);
      if (msg === null) return;
      match(msg)
        .with({ kind: "response" }, (res) => settle(res))
        .with({ kind: "event" }, (ev) => emit(ev.name, ev.payload))
        .with({ kind: "request" }, () => undefined)
        .exhaustive();
    },
  };
}
