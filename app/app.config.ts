import type { ExpoConfig } from "expo/config";
import pkg from "./package.json";
import { parseAdsConfig } from "./src/adsConfig.ts";

// 자리표시 값이다. 주인이 정하기 전에는 스토어용 빌드를 만들지 않는다.
const APP_IDENTIFIER = "app.example.yeongkk";

const ADS_TRACKING_TEXT = "맞는 광고를 보여 주려고 이 기기의 광고 식별자를 사용해요. 허용하지 않아도 앱은 똑같이 쓸 수 있어요.";

const ads = parseAdsConfig(process.env);

const plugins: NonNullable<ExpoConfig["plugins"]> = ads.enabled
  ? [
      ["react-native-google-mobile-ads", { iosAppId: ads.iosAppId, androidAppId: ads.androidAppId, userTrackingUsageDescription: ADS_TRACKING_TEXT }],
      ["expo-tracking-transparency", { userTrackingPermission: ADS_TRACKING_TEXT }],
    ]
  : [];

const config: ExpoConfig = {
  name: "뭔말이야",
  slug: "yeongkk",
  version: pkg.version,
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  ios: { bundleIdentifier: APP_IDENTIFIER, supportsTablet: false },
  android: { package: APP_IDENTIFIER },
  plugins,
  extra: { ads },
};

export default config;
