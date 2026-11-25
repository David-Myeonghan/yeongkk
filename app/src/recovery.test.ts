import { describe, expect, it } from "vitest";
import { recoveryFor } from "./recovery";

describe("recoveryFor", () => {
  it("안드로이드 렌더 프로세스가 죽으면 웹뷰를 새로 만든다 (reload 로 바꾸면 잡힘)", () => {
    expect(recoveryFor("android-render-process-gone")).toBe("remount");
  });

  it("iOS 콘텐츠 프로세스가 끝나면 reload (remount 로 바꾸면 잡힘)", () => {
    expect(recoveryFor("ios-content-process-terminated")).toBe("reload");
  });
});
