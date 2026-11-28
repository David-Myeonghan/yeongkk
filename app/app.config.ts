import type { ExpoConfig } from "expo/config";
import pkg from "./package.json";
import { PRIVACY_CONTACT } from "../tools/privacy/contact.ts";
import { blockedPermissions } from "./src/androidPermissions.ts";
import { present, resolveAdsConfig } from "./src/adsConfig.ts";
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

// 구글이 알리는 구매자 식별자 목록은 이보다 길다. 실제 광고 배포 전에 docs/release.md 대로 채운다.
const SKAD_NETWORK_ITEMS = ["cstr6suwn9.skadnetwork"];

const expoField: { autolinking?: { exclude?: readonly string[] } } = pkg.expo;
const excluded = expoField.autolinking?.exclude ?? [];
const ads = resolveAdsConfig(process.env, { excludedModules: excluded });

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
      ["react-native-google-mobile-ads", { iosAppId: ads.iosAppId, androidAppId: ads.androidAppId, userTrackingUsageDescription: ADS_TRACKING_TEXT, skAdNetworkItems: SKAD_NETWORK_ITEMS }],
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

export default config;
