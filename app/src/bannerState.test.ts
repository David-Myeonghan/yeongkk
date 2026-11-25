import { describe, expect, it } from "vitest";
import { renderableBanner, type BannerState } from "./bannerState";

const shown: BannerState = { visible: true, unitId: "ca-app-pub-1111111111111111/2222222222", nonPersonalized: false };

describe("renderableBanner", () => {
  it("보이라고 했고 오프라인이 아니면 그린다", () => {
    expect(renderableBanner(shown, false)).toEqual(shown);
  });
  it("오프라인 화면에서는 그리지 않는다 (뜻: 오류 화면에 광고가 남으면 잡힘)", () => {
    expect(renderableBanner(shown, true)).toBeNull();
  });
  it("숨기라고 했으면 그리지 않는다", () => {
    expect(renderableBanner({ visible: false }, false)).toBeNull();
  });
  it("오프라인이 풀리면 웹이 요청한 상태가 그대로 돌아온다 (상태를 지우면 잡힘)", () => {
    renderableBanner(shown, true);
    expect(renderableBanner(shown, false)).toEqual(shown);
  });
});
