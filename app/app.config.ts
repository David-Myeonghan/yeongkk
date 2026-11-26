import { withGradleProperties } from "expo/config-plugins";
import type { ExpoConfig } from "expo/config";
import pkg from "./package.json";
import { PRIVACY_CONTACT } from "../tools/privacy/contact.ts";
import { withAdsGradleProperties } from "./src/androidGradle.ts";
import { blockedPermissions } from "./src/androidPermissions.ts";
import { ADS_MODULE, present, resolveAdsConfig } from "./src/adsConfig.ts";
import { PLACEHOLDER_IDENTIFIER, assertReleaseReady } from "./src/releaseCheck.ts";
import { THEME } from "./src/theme.ts";

const filled = (raw: string | undefined): string | undefined => present(raw)?.trim();

// 식별자는 여기 한 곳에서만 정한다. 비우면 자리표시 값이고, production 빌드는 이 값이면 멈춘다.
const APP_IDENTIFIER = filled(process.env.APP_IDENTIFIER) ?? PLACEHOLDER_IDENTIFIER;
const EAS_PROJECT_ID = filled(process.env.EAS_PROJECT_ID);

assertReleaseReady({
  profile: filled(process.env.EAS_BUILD_PROFILE) ?? filled(process.env.APP_PROFILE),
  identifier: APP_IDENTIFIER,
  webUrl: process.env.EXPO_PUBLIC_WEB_URL,
  projectId: EAS_PROJECT_ID,
  privacyContact: PRIVACY_CONTACT,
});

const ADS_TRACKING_TEXT = "맞는 광고를 보여 주려고 이 기기의 광고 식별자를 사용해요. 허용하지 않아도 앱은 똑같이 쓸 수 있어요.";

const expoField: { autolinking?: { exclude?: readonly string[] } } = pkg.expo;
const excluded = expoField.autolinking?.exclude ?? [];
const ads = resolveAdsConfig(process.env, { nativeModuleExcluded: excluded.includes(ADS_MODULE) });

// 로컬 알림만 쓴다. 플러그인 기본값은 iOS 푸시 권한(aps-environment)을 더하므로 끈다.
const notifications: NonNullable<ExpoConfig["plugins"]>[number] = ["expo-notifications", { enableRemoteNotifications: false }];

const splash: NonNullable<ExpoConfig["plugins"]>[number] = [
  "expo-splash-screen",
  { image: "./assets/splash.png", imageWidth: 200, backgroundColor: THEME.light.background, dark: { image: "./assets/splash.png", backgroundColor: THEME.dark.background } },
];

const plugins: NonNullable<ExpoConfig["plugins"]> = ads.enabled
  ? [
      notifications,
      splash,
      ["react-native-google-mobile-ads", { iosAppId: ads.iosAppId, androidAppId: ads.androidAppId, userTrackingUsageDescription: ADS_TRACKING_TEXT }],
      ["expo-tracking-transparency", { userTrackingPermission: ADS_TRACKING_TEXT }],
    ]
  : [notifications, splash];

const config: ExpoConfig = {
  name: "뭔말이야",
  slug: "yeongkk",
  version: pkg.version,
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  ios: { bundleIdentifier: APP_IDENTIFIER, supportsTablet: false, config: { usesNonExemptEncryption: false } },
  android: {
    package: APP_IDENTIFIER,
    blockedPermissions: blockedPermissions(ads.enabled),
    adaptiveIcon: { foregroundImage: "./assets/adaptive-icon.png", backgroundColor: THEME.light.accent },
  },
  plugins,
  extra: { ads, ...(EAS_PROJECT_ID === undefined ? {} : { eas: { projectId: EAS_PROJECT_ID } }) },
};

// 안드로이드 광고 모듈은 canary 단계에서만 찾힌다 (src/androidGradle.ts). 광고 없는 빌드는 건드리지 않는다.
export default ads.enabled
  ? withGradleProperties(config, (c) => {
      c.modResults = withAdsGradleProperties(c.modResults, true);
      return c;
    })
  : config;
