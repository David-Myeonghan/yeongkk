import type { ExpoConfig } from "expo/config";
import pkg from "./package.json";
import { ADS_MODULE, resolveAdsConfig } from "./src/adsConfig.ts";

// 자리표시 값이다. 주인이 정하기 전에는 스토어용 빌드를 만들지 않는다.
const APP_IDENTIFIER = "app.example.yeongkk";

const ADS_TRACKING_TEXT = "맞는 광고를 보여 주려고 이 기기의 광고 식별자를 사용해요. 허용하지 않아도 앱은 똑같이 쓸 수 있어요.";

const expoField: { autolinking?: { exclude?: readonly string[] } } = pkg.expo;
const excluded = expoField.autolinking?.exclude ?? [];
const ads = resolveAdsConfig(process.env, { nativeModuleExcluded: excluded.includes(ADS_MODULE) });

// 로컬 알림만 쓴다. 플러그인 기본값은 iOS 푸시 권한(aps-environment)을 더하므로 끈다.
const notifications: NonNullable<ExpoConfig["plugins"]>[number] = ["expo-notifications", { enableRemoteNotifications: false }];

const plugins: NonNullable<ExpoConfig["plugins"]> = ads.enabled
  ? [
      notifications,
      ["react-native-google-mobile-ads", { iosAppId: ads.iosAppId, androidAppId: ads.androidAppId, userTrackingUsageDescription: ADS_TRACKING_TEXT }],
      ["expo-tracking-transparency", { userTrackingPermission: ADS_TRACKING_TEXT }],
    ]
  : [notifications];

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
