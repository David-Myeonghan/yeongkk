import { describe, expect, it } from "vitest";
import { adsFromExtra, AdsSettingsError, bannerUnitId, GOOGLE_TEST_IDS, resolveAdsConfig } from "./adsConfig";

const IOS_APP = "ca-app-pub-3940256099942544~1458002511";
const ANDROID_APP = "ca-app-pub-3940256099942544~3347511713";
const OWN_UNIT = "ca-app-pub-1111111111111111/2222222222";
const base = { ADMOB_IOS_APP_ID: IOS_APP, ADMOB_ANDROID_APP_ID: ANDROID_APP };

const IN = { nativeModuleExcluded: false };
const OUT = { nativeModuleExcluded: true };
const inBuild = (env: Record<string, string | undefined>) => resolveAdsConfig(env, IN);

describe("resolveAdsConfig — 네 경우", () => {
  it("제외 + 아이디 없음 → 꺼짐 (기본 상태) (뜻: 기본이 켜짐이면 잡힘)", () => {
    expect(resolveAdsConfig({}, OUT)).toEqual({ enabled: false });
    expect(resolveAdsConfig({ ADMOB_IOS_APP_ID: " ", ADMOB_ANDROID_APP_ID: "" }, OUT)).toEqual({ enabled: false });
  });

  it("포함 + 아이디 없음 → 오류, 시작하자마자 죽는다는 안내 (뜻: 조용히 통과시키면 잡힘)", () => {
    expect(() => resolveAdsConfig({}, IN)).toThrow(AdsSettingsError);
    expect(() => resolveAdsConfig({}, IN)).toThrow(/시작하자마자 죽어요/);
  });

  it("제외 + 아이디 있음 → 오류, 광고 코드가 없다는 안내 (뜻: 조용히 꺼 두면 잡힘)", () => {
    expect(() => resolveAdsConfig(base, OUT)).toThrow(AdsSettingsError);
    expect(() => resolveAdsConfig(base, OUT)).toThrow(/광고 코드가 빌드에 없어요/);
  });

  it("포함 + 올바른 아이디 → 켜짐", () => {
    expect(resolveAdsConfig(base, IN)).toEqual({ enabled: true, iosAppId: IOS_APP, androidAppId: ANDROID_APP });
  });
});

describe("resolveAdsConfig — 아이디 검증", () => {
  it("한쪽만 있으면 오류 (제외든 포함이든) (뜻: 한쪽만으로 켜면 잡힘)", () => {
    for (const opts of [IN, OUT]) {
      expect(() => resolveAdsConfig({ ADMOB_IOS_APP_ID: IOS_APP }, opts)).toThrow(AdsSettingsError);
      expect(() => resolveAdsConfig({ ADMOB_ANDROID_APP_ID: ANDROID_APP }, opts)).toThrow(AdsSettingsError);
    }
  });

  it("모양이 틀린 아이디는 오류 (조용히 끄지 않는다) (뜻: 검증을 빼거나 무시하면 잡힘)", () => {
    for (const bad of ["x", "ca-app-pub-3940256099942544/1458002511", "ca-app-pub-123~456", `${IOS_APP}x`]) {
      for (const opts of [IN, OUT]) {
        expect(() => resolveAdsConfig({ ADMOB_IOS_APP_ID: bad, ADMOB_ANDROID_APP_ID: ANDROID_APP }, opts)).toThrow(/모양이 틀려요/);
      }
    }
  });

  it("앞뒤 공백은 자른다 (뜻: trim 을 빼면 잡힘)", () => {
    expect(inBuild({ ADMOB_IOS_APP_ID: ` ${IOS_APP}\n`, ADMOB_ANDROID_APP_ID: ANDROID_APP }).enabled).toBe(true);
  });

  it("배너 단위 아이디는 모양이 맞을 때만 받는다 (뜻: 앱 아이디 모양을 단위에 쓰면 잡힘)", () => {
    const cfg = inBuild({
      ...base,
      EXPO_PUBLIC_ADMOB_IOS_BANNER_ID: ` ${OWN_UNIT} `,
      EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID: "ca-app-pub-1111111111111111~2222222222",
    });
    expect(cfg).toEqual({ enabled: true, iosAppId: IOS_APP, androidAppId: ANDROID_APP, iosBannerId: OWN_UNIT });
  });
});

describe("bannerUnitId", () => {
  const cfg = inBuild(base);
  it("개발 빌드에 단위 아이디가 없으면 구글 시험용 (뜻: 시험용을 안 쓰면 잡힘)", () => {
    expect(bannerUnitId(cfg, "ios", true)).toBe(GOOGLE_TEST_IDS.iosBanner);
    expect(bannerUnitId(cfg, "android", true)).toBe(GOOGLE_TEST_IDS.androidBanner);
  });
  it("배포 빌드에 단위 아이디가 없으면 null — 시험 광고를 내보내지 않는다", () => {
    expect(bannerUnitId(cfg, "ios", false)).toBeNull();
    expect(bannerUnitId(cfg, "android", false)).toBeNull();
  });
  it("있으면 개발이든 배포든 그 값", () => {
    const own = inBuild({ ...base, EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID: OWN_UNIT });
    expect(bannerUnitId(own, "android", true)).toBe(OWN_UNIT);
    expect(bannerUnitId(own, "android", false)).toBe(OWN_UNIT);
  });
  it("꺼진 설정은 null · 모르는 OS 도 null", () => {
    expect(bannerUnitId({ enabled: false }, "ios", true)).toBeNull();
    expect(bannerUnitId(cfg, "web", true)).toBeNull();
  });
});

describe("adsFromExtra", () => {
  it("앱 설정의 extra.ads 를 다시 검증해 읽는다", () => {
    expect(adsFromExtra({ ads: inBuild(base) })).toEqual(inBuild(base));
  });
  it("없거나 이상하면 꺼진다 (뜻: 런타임이 extra 를 믿고 켜면 잡힘)", () => {
    const bad = [undefined, null, {}, { ads: null }, { ads: { enabled: true } }, { ads: { enabled: true, iosAppId: "x", androidAppId: "y" } }];
    for (const extra of bad) expect(adsFromExtra(extra)).toEqual({ enabled: false });
  });
});
