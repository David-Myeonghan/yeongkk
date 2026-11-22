import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { attachToWindow } from "./attach";
import { PROTOCOL_VERSION, response } from "./protocol";

type Win = Parameters<typeof attachToWindow>[0];

const info = { protocol: PROTOCOL_VERSION, appVersion: "1.0.0", platform: "ios", capabilities: { share: 1 } };
const asWin = (fake: object) => fake as unknown as Win;

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("attachToWindow", () => {
  it("ReactNativeWebView 가 없는 창: ready 는 null", async () => {
    const bridge = attachToWindow(asWin({}));
    const p = bridge.ready();
    await vi.runAllTimersAsync();
    expect(await p).toBeNull();
  });

  it("injectedObjectJson 이 올바른 정보를 주면 hello 없이 그 정보", async () => {
    const post = vi.fn();
    const bridge = attachToWindow(asWin({ ReactNativeWebView: { postMessage: post, injectedObjectJson: () => JSON.stringify(info) } }));
    expect(await bridge.ready()).toMatchObject({ appVersion: "1.0.0", capabilities: { share: 1 } });
    expect(post).not.toHaveBeenCalled();
  });

  it("injectedObjectJson 이 던지면 hello 로 묻는다", async () => {
    const post = vi.fn();
    const bridge = attachToWindow(asWin({
      ReactNativeWebView: { postMessage: post, injectedObjectJson: () => { throw new Error("nope"); } },
    }));
    const p = bridge.ready();
    await vi.runAllTimersAsync();
    expect(await p).toBeNull();
    expect(post).toHaveBeenCalledTimes(1);
    expect(JSON.parse(post.mock.calls[0]![0] as string)).toMatchObject({ kind: "request", name: "hello" });
  });

  it("injectedObjectJson 이 JSON 이 아니면 hello 로 묻는다", async () => {
    const post = vi.fn();
    const bridge = attachToWindow(asWin({ ReactNativeWebView: { postMessage: post, injectedObjectJson: () => "{oops" } }));
    const p = bridge.ready();
    await vi.runAllTimersAsync();
    await p;
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("injectedObjectJson 이 없는 값을 주면 hello 로 묻는다", async () => {
    const post = vi.fn();
    const bridge = attachToWindow(asWin({ ReactNativeWebView: { postMessage: post, injectedObjectJson: () => undefined } }));
    const p = bridge.ready();
    await vi.runAllTimersAsync();
    await p;
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("hello 에 앱이 injectJavaScript 로 답하면 win.__YK_BRIDGE__.receive 가 받는다", async () => {
    const win: Record<string, unknown> = {};
    win.ReactNativeWebView = {
      postMessage: (raw: string) => {
        const id = (JSON.parse(raw) as { id: string }).id;
        (win.__YK_BRIDGE__ as { receive(r: unknown): void }).receive(JSON.stringify(response.ok(id, info)));
      },
    };
    const bridge = attachToWindow(asWin(win));
    expect(await bridge.ready()).toMatchObject({ appVersion: "1.0.0" });
  });

  it("injectedObjectJson 이 \"null\" 을 주면 hello 로 묻는다", async () => {
    const post = vi.fn();
    const bridge = attachToWindow(asWin({ ReactNativeWebView: { postMessage: post, injectedObjectJson: () => "null" } }));
    const p = bridge.ready();
    await vi.runAllTimersAsync();
    await p;
    expect(post).toHaveBeenCalledTimes(1);
  });

  it.each(["", "5", "[1]", "\"text\""])("injectedObjectJson 이 %j 이면 hello 로 묻는다", async (json) => {
    const post = vi.fn();
    const bridge = attachToWindow(asWin({ ReactNativeWebView: { postMessage: post, injectedObjectJson: () => json } }));
    const p = bridge.ready();
    await vi.runAllTimersAsync();
    await p;
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("injectedObjectJson 함수가 아예 없으면 hello 로 묻는다", async () => {
    const post = vi.fn();
    const bridge = attachToWindow(asWin({ ReactNativeWebView: { postMessage: post } }));
    const p = bridge.ready();
    await vi.runAllTimersAsync();
    await p;
    expect(post).toHaveBeenCalledTimes(1);
  });

  it("규약 2 객체면 앱 없음으로 끝내고 hello 를 보내지 않는다", async () => {
    const post = vi.fn();
    const bridge = attachToWindow(asWin({
      ReactNativeWebView: { postMessage: post, injectedObjectJson: () => JSON.stringify({ ...info, protocol: 2 }) },
    }));
    expect(await bridge.ready()).toBeNull();
    expect(post).not.toHaveBeenCalled();
  });

  it("win.__YK_BRIDGE__.receive 가 걸린다", () => {
    const win: Record<string, unknown> = {};
    attachToWindow(asWin(win));
    expect(typeof (win.__YK_BRIDGE__ as { receive: unknown }).receive).toBe("function");
  });
});
