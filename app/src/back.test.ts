import { describe, expect, it } from "vitest";
import { backAction } from "./back";

describe("backAction", () => {
  it("웹뷰가 뒤로 갈 수 있으면 웹뷰 안에서 뒤로 간다 (뜻: 개인정보 화면에서 BACK 이 홈으로 돌아가야 함)", () => {
    expect(backAction({ canGoBack: true, offline: false })).toBe("webview-back");
  });

  it("갈 곳이 없으면 시스템 기본(앱 나가기)에 맡긴다", () => {
    expect(backAction({ canGoBack: false, offline: false })).toBe("system-default");
  });

  it("오프라인 화면에서는 웹뷰가 남긴 기록이 있어도 시스템 기본이다 (웹뷰가 화면에 없음)", () => {
    expect(backAction({ canGoBack: true, offline: true })).toBe("system-default");
  });
});
