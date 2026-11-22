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
