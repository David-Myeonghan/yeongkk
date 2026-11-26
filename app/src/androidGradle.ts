export type GradleItem = { type: "comment"; value: string } | { type: "empty" } | { type: "property"; key: string; value: string };

const KEY = "reactNativeReleaseLevel";

// react-native-google-mobile-ads 17.4.0 는 안드로이드 모듈을 TurboModule 이 아닌 옛 모듈로 등록한다.
// React Native 0.88 은 useTurboModuleInterop 이 꺼져 있어 그 모듈을 못 찾는다. canary 단계가 이 플래그를 켠다.
export const ADS_RELEASE_LEVEL = "canary";

export function withAdsGradleProperties(items: readonly GradleItem[], adsEnabled: boolean): GradleItem[] {
  if (!adsEnabled) return [...items];
  const rest = items.filter((item) => !(item.type === "property" && item.key === KEY));
  return [...rest, { type: "property", key: KEY, value: ADS_RELEASE_LEVEL }];
}
