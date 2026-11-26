import { describe, expect, it } from "vitest";
import { ADS_RELEASE_LEVEL, withAdsGradleProperties, type GradleItem } from "./androidGradle";

const base: GradleItem[] = [
  { type: "property", key: "newArchEnabled", value: "true" },
  { type: "property", key: "hermesEnabled", value: "true" },
];

describe("withAdsGradleProperties", () => {
  it("광고 없는 빌드는 속성을 그대로 둔다 (뜻: 기본 빌드에 canary 가 새면 잡힘)", () => {
    expect(withAdsGradleProperties(base, false)).toEqual(base);
  });

  it("광고 빌드는 reactNativeReleaseLevel 을 canary 로 건다 (안드로이드 광고 모듈이 옛 모듈 호환층을 쓴다)", () => {
    expect(ADS_RELEASE_LEVEL).toBe("canary");
    expect(withAdsGradleProperties(base, true)).toEqual([...base, { type: "property", key: "reactNativeReleaseLevel", value: "canary" }]);
  });

  it("이미 있는 같은 키는 하나로 바꾼다 (두 번 돌려도 한 줄)", () => {
    const once = withAdsGradleProperties([...base, { type: "property", key: "reactNativeReleaseLevel", value: "stable" }], true);
    expect(once.filter((item) => item.type === "property" && item.key === "reactNativeReleaseLevel")).toEqual([
      { type: "property", key: "reactNativeReleaseLevel", value: "canary" },
    ]);
    expect(withAdsGradleProperties(once, true)).toEqual(once);
  });

  it("입력 배열을 바꾸지 않는다", () => {
    const copy = structuredClone(base);
    withAdsGradleProperties(base, true);
    expect(base).toEqual(copy);
  });
});
