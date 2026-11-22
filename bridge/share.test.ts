import { describe, expect, it, vi } from "vitest";
import { BridgeError, PROTOCOL_VERSION } from "./protocol";
import { share } from "./share";
import { createWebBridge } from "./web";

const card = { title: "영크크", text: "10점", url: "https://yeongkk.example/r/1" };
const info = { protocol: PROTOCOL_VERSION, appVersion: "1.0.0", platform: "ios", capabilities: { share: 1 } };
const browser = () => createWebBridge({});
const failing = (name = "Error") => vi.fn(async () => { throw Object.assign(new Error("x"), { name }); });

describe("share 대신하기 가지", () => {
  it("웹 공유가 AbortError 가 아닌 오류로 실패하면 복사로 넘어간다", async () => {
    const clipboard = vi.fn(async () => undefined);
    expect(await share(browser(), card, { webShare: failing(), clipboardWrite: clipboard })).toEqual({ via: "clipboard", completed: true });
    expect(clipboard).toHaveBeenCalledOnce();
  });

  it("복사도 실패하면 none", async () => {
    expect(await share(browser(), card, { clipboardWrite: failing() })).toEqual({ via: "none", completed: false });
  });

  it("앱이 completed: false 로 답하면 웹 공유로 넘어가지 않는다", async () => {
    const webShare = vi.fn(async () => undefined);
    const bridge = createWebBridge({
      injected: info,
      post: (raw) => {
        const id = (JSON.parse(raw) as { id: string }).id;
        queueMicrotask(() => bridge.receive({ v: 1, kind: "response", id, ok: true, result: { completed: false } }));
      },
    });
    expect(await share(bridge, card, { webShare })).toEqual({ via: "native", completed: false });
    expect(webShare).not.toHaveBeenCalled();
  });

  it("앱 호출이 BridgeError 가 아닌 것을 던져도 다음 방법으로 넘어간다", async () => {
    const bridge = { ...browser(), call: () => Promise.reject(new TypeError("odd")) };
    const webShare = vi.fn(async () => undefined);
    expect(await share(bridge, card, { webShare })).toEqual({ via: "web-share", completed: true });
  });

  it("앱 호출이 BridgeError 로 끝나도 넘어간다", async () => {
    const bridge = { ...browser(), call: () => Promise.reject(new BridgeError("TIMEOUT")) };
    expect(await share(bridge, card, {})).toEqual({ via: "none", completed: false });
  });

  it("text 도 url 도 없으면 빈 글을 복사하지 않는다", async () => {
    const clipboard = vi.fn(async () => undefined);
    expect(await share(browser(), { title: "영크크" }, { clipboardWrite: clipboard })).toEqual({ via: "none", completed: false });
    expect(clipboard).not.toHaveBeenCalled();
  });

  it("name 이 AbortError 인 평범한 객체도 닫음으로 본다", async () => {
    const clipboard = vi.fn(async () => undefined);
    const webShare = vi.fn(async () => { throw { name: "AbortError" }; });
    expect(await share(browser(), card, { webShare, clipboardWrite: clipboard })).toEqual({ via: "web-share", completed: false });
    expect(clipboard).not.toHaveBeenCalled();
  });
});
