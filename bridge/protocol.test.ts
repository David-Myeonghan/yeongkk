import { describe, expect, it } from "vitest";
import { PROTOCOL_VERSION, parseHostInfo, parseMessage, request } from "./protocol";

describe("parseMessage — 밖에서 들어온 메시지 읽기", () => {
  it("문자열과 객체를 둘 다 읽는다", () => {
    const msg = request("a1", "share", { url: "https://x" });
    expect(parseMessage(JSON.stringify(msg))).toEqual(msg);
    expect(parseMessage(msg)).toEqual(msg);
  });

  it("모르는 필드는 버리고 아는 필드만 남긴다", () => {
    const parsed = parseMessage({ v: 1, kind: "event", name: "resume", payload: 1, extra: "나중에 생긴 필드" });
    expect(parsed).toEqual({ v: 1, kind: "event", name: "resume", payload: 1 });
  });

  it.each([
    ["JSON 이 아닌 문자열", "{not json"],
    ["null", null],
    ["숫자", 42],
    ["배열", []],
    ["규약 버전 없음", { kind: "event", name: "x" }],
    ["모르는 규약 버전", { v: 2, kind: "event", name: "x" }],
    ["모르는 종류", { v: 1, kind: "stream", name: "x" }],
    ["요청에 id 없음", { v: 1, kind: "request", name: "share" }],
    ["요청 이름이 빈 글", { v: 1, kind: "request", id: "a", name: "" }],
    ["응답에 ok 없음", { v: 1, kind: "response", id: "a" }],
    ["실패 응답에 오류 코드 없음", { v: 1, kind: "response", id: "a", ok: false, error: {} }],
    ["이벤트에 이름 없음", { v: 1, kind: "event" }],
  ])("%s → null (던지지 않는다)", (_label, raw) => {
    expect(parseMessage(raw)).toBeNull();
  });

  it("실패 응답의 모르는 오류 코드도 그대로 받는다 — 앱이 나중에 코드를 더할 수 있다", () => {
    const parsed = parseMessage({ v: 1, kind: "response", id: "a", ok: false, error: { code: "RATE_LIMITED" } });
    expect(parsed).toEqual({ v: 1, kind: "response", id: "a", ok: false, error: { code: "RATE_LIMITED" } });
  });
});

describe("parseHostInfo — 앱이 넣어 둔 자기 소개 읽기", () => {
  it("올바른 정보는 그대로", () => {
    const info = { protocol: PROTOCOL_VERSION, appVersion: "1.0.0", platform: "ios", capabilities: { share: 1 } };
    expect(parseHostInfo(info)).toEqual(info);
  });

  it("기능표에서 버전이 양의 정수가 아닌 줄은 버린다", () => {
    const info = parseHostInfo({
      protocol: 1, appVersion: "1.0.0", platform: "android",
      capabilities: { share: 1, haptics: 0, notify: "1", ads: 2.5, offline: 2 },
    });
    expect(info?.capabilities).toEqual({ share: 1, offline: 2 });
  });

  it.each([
    ["없음", undefined],
    ["규약 버전이 모르는 값", { protocol: 2, appVersion: "9", platform: "ios", capabilities: {} }],
    ["기능표 없음", { protocol: 1, appVersion: "1", platform: "ios" }],
    ["앱 버전이 글이 아님", { protocol: 1, appVersion: 1, platform: "ios", capabilities: {} }],
  ])("%s → null", (_label, raw) => {
    expect(parseHostInfo(raw)).toBeNull();
  });
});
