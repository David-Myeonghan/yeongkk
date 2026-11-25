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

export const ADS_MODULE = "react-native-google-mobile-ads";

export class AdsSettingsError extends Error {}

const present = (raw: string | undefined): string | undefined => (raw === undefined || raw.trim() === "" ? undefined : raw);

export function resolveAdsConfig(env: AdsEnv, opts: { nativeModuleExcluded: boolean }): AdsConfig {
  const rawIos = present(env.ADMOB_IOS_APP_ID);
  const rawAndroid = present(env.ADMOB_ANDROID_APP_ID);
  const iosAppId = checked(rawIos, APP_ID);
  const androidAppId = checked(rawAndroid, APP_ID);
  if ((rawIos !== undefined && iosAppId === undefined) || (rawAndroid !== undefined && androidAppId === undefined)) {
    throw new AdsSettingsError(
      "ADMOB_IOS_APP_ID / ADMOB_ANDROID_APP_ID 모양이 틀려요. ca-app-pub-숫자16자리~숫자10자리 여야 해요.",
    );
  }
  const both = iosAppId !== undefined && androidAppId !== undefined;
  const none = iosAppId === undefined && androidAppId === undefined;
  if (!both && !none) {
    throw new AdsSettingsError("ADMOB_IOS_APP_ID 와 ADMOB_ANDROID_APP_ID 는 둘 다 주거나 둘 다 비워야 해요.");
  }
  if (none) {
    if (opts.nativeModuleExcluded) return { enabled: false };
    throw new AdsSettingsError(
      `app/package.json 의 expo.autolinking.exclude 에서 ${ADS_MODULE} 를 뺐는데 AdMob 앱 아이디가 없어요. 이대로 만들면 앱이 시작하자마자 죽어요. 아이디 둘을 주거나 제외 목록에 다시 넣으세요.`,
    );
  }
  if (opts.nativeModuleExcluded) {
    throw new AdsSettingsError(
      `AdMob 앱 아이디를 줬지만 app/package.json 의 expo.autolinking.exclude 에 ${ADS_MODULE} 가 남아 있어요. 이대로면 광고 코드가 빌드에 없어요. 광고를 켜려면 제외 목록에서 빼세요.`,
    );
  }
  return build({
    iosAppId,
    androidAppId,
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
