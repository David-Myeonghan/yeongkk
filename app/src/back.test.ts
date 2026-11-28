import { describe, expect, it } from "vitest";
import { atStartPage, backAction } from "./back";

const START = "https://yeongkk.example";
const facts = { canGoBack: true, offline: false, currentUrl: `${START}/privacy/`, startUrl: START };

describe("backAction", () => {
  it("시작 주소가 아닌 페이지(방침)에서 기록이 있으면 웹뷰 안에서 뒤로 간다", () => {
    expect(backAction(facts)).toBe("webview-back");
  });

  it("시작 주소에서는 기록이 있어도 시스템 기본이다 (홈 → 방침 → 링크로 홈 뒤의 기록)", () => {
    expect(backAction({ ...facts, currentUrl: `${START}/` })).toBe("system-default");
    expect(backAction({ ...facts, currentUrl: START })).toBe("system-default");
  });

  it("시작 주소 뒤의 쿼리 · 해시는 무시한다 (공유 링크 /?r=2 도 퀴즈 홈)", () => {
    expect(backAction({ ...facts, currentUrl: `${START}/?r=2` })).toBe("system-default");
    expect(backAction({ ...facts, currentUrl: `${START}/#top` })).toBe("system-default");
    expect(backAction({ ...facts, currentUrl: `${START}?r=2#a` })).toBe("system-default");
  });

  it("경로가 다르면 시작 주소가 아니다 (쿼리에 시작 경로가 있어도)", () => {
    expect(backAction({ ...facts, currentUrl: `${START}/privacy?next=/` })).toBe("webview-back");
    expect(backAction({ ...facts, currentUrl: `${START}/privacy` })).toBe("webview-back");
  });

  it("다른 출처는 시작 주소가 아니다", () => {
    expect(backAction({ ...facts, currentUrl: "https://other.example/" })).toBe("webview-back");
  });

  it("시작 주소가 경로를 가져도 끝 / 차이는 같다", () => {
    const start = `${START}/app`;
    expect(backAction({ ...facts, startUrl: start, currentUrl: `${START}/app/` })).toBe("system-default");
    expect(backAction({ ...facts, startUrl: `${start}/`, currentUrl: `${START}/app` })).toBe("system-default");
    expect(backAction({ ...facts, startUrl: start, currentUrl: `${START}/` })).toBe("webview-back");
  });

  it("현재 주소가 깨졌거나 비었으면 시스템 기본이다", () => {
    expect(backAction({ ...facts, currentUrl: "" })).toBe("system-default");
    expect(backAction({ ...facts, currentUrl: "not a url" })).toBe("system-default");
    expect(backAction({ ...facts, currentUrl: "about:blank" })).toBe("system-default");
  });

  it("갈 곳이 없으면 시스템 기본에 맡긴다", () => {
    expect(backAction({ ...facts, canGoBack: false })).toBe("system-default");
  });

  it("오프라인 화면에서는 기록이 있어도 시스템 기본이다 (웹뷰가 화면에 없음)", () => {
    expect(backAction({ ...facts, offline: true })).toBe("system-default");
  });
});

describe("atStartPage", () => {
  it("대소문자 · 기본 포트 차이를 출처 비교로 맞춘다", () => {
    expect(atStartPage("HTTPS://YEONGKK.example:443/", START)).toBe(true);
  });
});
