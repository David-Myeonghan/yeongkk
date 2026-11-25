export const GOOGLE_TEST_IDS = {
  iosAppId: "ca-app-pub-3940256099942544~1458002511",
  androidAppId: "ca-app-pub-3940256099942544~3347511713",
  iosBanner: "ca-app-pub-3940256099942544/2435281174",
  androidBanner: "ca-app-pub-3940256099942544/9214589741",
} as const;

export type AdsConfig =
  | { enabled: false }
  | { enabled: true; iosAppId: string; androidAppId: string; iosBannerId?: string; androidBannerId?: string };

export type AdsEnv = Record<string, string | undefined>;

const APP_ID = /^ca-app-pub-\d{16}~\d{10}$/;
const UNIT_ID = /^ca-app-pub-\d{16}\/\d{10}$/;

const checked = (raw: unknown, shape: RegExp): string | undefined => {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim();
  return shape.test(value) ? value : undefined;
};

function build(src: Record<string, unknown>): AdsConfig {
  const iosAppId = checked(src.iosAppId, APP_ID);
  const androidAppId = checked(src.androidAppId, APP_ID);
  if (iosAppId === undefined || androidAppId === undefined) return { enabled: false };
  const iosBannerId = checked(src.iosBannerId, UNIT_ID);
  const androidBannerId = checked(src.androidBannerId, UNIT_ID);
  return {
    enabled: true,
    iosAppId,
    androidAppId,
    ...(iosBannerId === undefined ? {} : { iosBannerId }),
    ...(androidBannerId === undefined ? {} : { androidBannerId }),
  };
}

export function parseAdsConfig(env: AdsEnv): AdsConfig {
  return build({
    iosAppId: env.ADMOB_IOS_APP_ID,
    androidAppId: env.ADMOB_ANDROID_APP_ID,
    iosBannerId: env.EXPO_PUBLIC_ADMOB_IOS_BANNER_ID,
    androidBannerId: env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID,
  });
}

export function adsFromExtra(extra: unknown): AdsConfig {
  if (typeof extra !== "object" || extra === null || !("ads" in extra)) return { enabled: false };
  const ads: unknown = extra.ads;
  if (typeof ads !== "object" || ads === null || !("enabled" in ads) || ads.enabled !== true) return { enabled: false };
  return build({ ...ads });
}

export function bannerUnitId(config: AdsConfig, os: string, dev: boolean): string | null {
  if (!config.enabled) return null;
  if (os === "ios") return config.iosBannerId ?? (dev ? GOOGLE_TEST_IDS.iosBanner : null);
  if (os === "android") return config.androidBannerId ?? (dev ? GOOGLE_TEST_IDS.androidBanner : null);
  return null;
}
