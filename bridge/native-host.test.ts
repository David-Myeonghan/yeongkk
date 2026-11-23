import { describe, expect, it } from "vitest";
import { createNativeHost, type Handlers } from "./native-host";
import { BridgeError, parseMessage, request, response } from "./protocol";

const make = (handlers: Handlers = { share: { version: 1, handle: (p) => ({ echoed: p }) } }) =>
  createNativeHost({ appVersion: "1.2.3", platform: "ios", handlers });

const call = async (host: ReturnType<typeof make>, name: string, payload?: unknown) => {
  const raw = await host.handle(JSON.stringify(request("r1", name, payload)));
  return raw === null ? null : JSON.parse(raw);
};

describe("createNativeHost", () => {
  it("info 는 처리기의 version 을 기능표로 쓴다", () => {
    expect(make().info()).toEqual({ protocol: 1, appVersion: "1.2.3", platform: "ios", capabilities: { share: 1 } });
  });

  it("hello 는 info 로 답하고 기능표에 들어가지 않는다", async () => {
    const host = make();
    const reply = await call(host, "hello");
    expect(reply).toMatchObject({ id: "r1", ok: true, result: host.info() });
    expect(host.info().capabilities).not.toHaveProperty("hello");
  });

  it("처리기를 부르고 결과를 돌려준다", async () => {
    expect(await call(make(), "share", { a: 1 })).toMatchObject({ ok: true, result: { echoed: { a: 1 } } });
  });

  it("모르는 이름은 UNSUPPORTED 로 답한다", async () => {
    expect(await call(make(), "nope")).toMatchObject({ id: "r1", ok: false, error: { code: "UNSUPPORTED" } });
  });

  it.each(["toString", "constructor", "__proto__", "hasOwnProperty"])("프로토타입 키 %s 는 모르는 이름이다", async (name) => {
    expect(await call(make(), name)).toMatchObject({ ok: false, error: { code: "UNSUPPORTED" } });
  });

  it("처리기가 던지면 FAILED 와 그 메시지", async () => {
    const host = make({ share: { version: 1, handle: () => { throw new Error("boom"); } } });
    expect(await call(host, "share")).toMatchObject({ ok: false, error: { code: "FAILED", message: "boom" } });
  });

  it("처리기가 거부해도 FAILED", async () => {
    const host = make({ share: { version: 1, handle: () => Promise.reject(new Error("later")) } });
    expect(await call(host, "share")).toMatchObject({ ok: false, error: { code: "FAILED", message: "later" } });
  });

  it("BridgeError 의 코드는 그대로 전한다", async () => {
    const host = make({ share: { version: 1, handle: () => { throw new BridgeError("BAD_REQUEST", "no url"); } } });
    expect(await call(host, "share")).toMatchObject({ ok: false, error: { code: "BAD_REQUEST", message: "no url" } });
  });

  it("Error 가 아닌 값을 던져도 FAILED", async () => {
    const host = make({ share: { version: 1, handle: () => { throw "str"; } } });
    expect(await call(host, "share")).toMatchObject({ ok: false, error: { code: "FAILED" } });
  });

  it("문자열로 만들 수 없는 값을 던져도 고정 문구로 FAILED", async () => {
    const host = make({ share: { version: 1, handle: () => { throw Object.create(null); } } });
    expect(await call(host, "share")).toMatchObject({ id: "r1", ok: false, error: { code: "FAILED", message: "handler failed" } });
  });

  it("Error 가 아닌 객체의 toString 이 던져도 FAILED", async () => {
    const host = make({ share: { version: 1, handle: () => { throw { toString: () => { throw new Error("x"); } }; } } });
    expect(await call(host, "share")).toMatchObject({ ok: false, error: { code: "FAILED", message: "handler failed" } });
  });

  it("빈 코드의 BridgeError 는 FAILED 로 답한다", async () => {
    const host = make({ share: { version: 1, handle: () => { throw new BridgeError("", "no code"); } } });
    expect(await call(host, "share")).toMatchObject({ ok: false, error: { code: "FAILED", message: "no code" } });
  });

  it("문자열이 아닌 코드도 FAILED", async () => {
    const host = make({
      share: {
        version: 1,
        handle: () => {
          const e = new BridgeError("X");
          (e as unknown as { code: unknown }).code = 42;
          throw e;
        },
      },
    });
    expect(await call(host, "share")).toMatchObject({ ok: false, error: { code: "FAILED" } });
  });

  it("직렬화할 수 없는 결과는 FAILED 로 답한다", async () => {
    const host = make({ share: { version: 1, handle: () => 1n } });
    expect(await call(host, "share")).toMatchObject({ id: "r1", ok: false, error: { code: "FAILED" } });
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    const loop = make({ share: { version: 1, handle: () => circular } });
    expect(await call(loop, "share")).toMatchObject({ ok: false, error: { code: "FAILED" } });
  });

  it("id 가 있는 요청이 모양이 틀리면 BAD_REQUEST 로 답한다", async () => {
    const host = make();
    for (const bad of [{ v: 1, kind: "request", id: "q1" }, { v: 1, kind: "request", id: "q1", name: 5 }]) {
      const raw = await host.handle(JSON.stringify(bad));
      expect(JSON.parse(raw!)).toEqual({ v: 1, kind: "response", id: "q1", ok: false, error: { code: "BAD_REQUEST", message: expect.any(String) } });
    }
  });

  it("다른 규약 버전의 요청도 id 가 있으면 현재 버전으로 BAD_REQUEST", async () => {
    const raw = await make().handle(JSON.stringify({ v: 2, kind: "request", id: "q2", name: "share" }));
    expect(JSON.parse(raw!)).toMatchObject({ v: 1, kind: "response", id: "q2", ok: false, error: { code: "BAD_REQUEST" } });
  });

  it("id 가 없거나 비었거나 문자열이 아니면, 응답 · 이벤트는 여전히 null", async () => {
    const host = make();
    expect(await host.handle(JSON.stringify({ v: 2, kind: "request", name: "share" }))).toBeNull();
    expect(await host.handle(JSON.stringify({ v: 1, kind: "request", id: "", name: "share" }))).toBeNull();
    expect(await host.handle(JSON.stringify({ v: 1, kind: "request", id: 7, name: "share" }))).toBeNull();
    expect(await host.handle(JSON.stringify({ v: 2, kind: "response", id: "q", ok: true }))).toBeNull();
    expect(await host.handle(JSON.stringify({ v: 2, kind: "event", id: "q", name: "e" }))).toBeNull();
    expect(await host.handle(JSON.stringify([1]))).toBeNull();
  });

  it("깨진 입력 · 응답 · 이벤트는 null", async () => {
    const host = make();
    expect(await host.handle("{not json")).toBeNull();
    expect(await host.handle(JSON.stringify(response.ok("x")))).toBeNull();
    expect(await host.handle(JSON.stringify({ v: 1, kind: "event", name: "e" }))).toBeNull();
  });

  it("event 는 웹의 parseMessage 가 읽는 문자열", () => {
    expect(parseMessage(make().event("resume", { at: 1 }))).toEqual({ v: 1, kind: "event", name: "resume", payload: { at: 1 } });
    expect(parseMessage(make().event("resume"))).toEqual({ v: 1, kind: "event", name: "resume" });
  });
});
