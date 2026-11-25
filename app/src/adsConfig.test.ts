import { describe, expect, it } from "vitest";
import { adsFromExtra, bannerUnitId, GOOGLE_TEST_IDS, parseAdsConfig } from "./adsConfig";

const IOS_APP = "ca-app-pub-3940256099942544~1458002511";
const ANDROID_APP = "ca-app-pub-3940256099942544~3347511713";
const OWN_UNIT = "ca-app-pub-1111111111111111/2222222222";
const base = { ADMOB_IOS_APP_ID: IOS_APP, ADMOB_ANDROID_APP_ID: ANDROID_APP };

describe("parseAdsConfig", () => {
  it("아이디가 없으면 꺼진다 (뜻: 기본이 켜짐이면 잡힘)", () => {
    expect(parseAdsConfig({})).toEqual({ enabled: false });
  });

  it("한쪽 앱 아이디만 있으면 꺼진다 (뜻: || 로 판정하면 잡힘)", () => {
    expect(parseAdsConfig({ ADMOB_IOS_APP_ID: IOS_APP })).toEqual({ enabled: false });
    expect(parseAdsConfig({ ADMOB_ANDROID_APP_ID: ANDROID_APP })).toEqual({ enabled: false });
  });

  it("둘 다 있으면 켜진다", () => {
    expect(parseAdsConfig(base)).toEqual({ enabled: true, iosAppId: IOS_APP, androidAppId: ANDROID_APP });
  });

  it("앞뒤 공백은 자른다 · 빈 글자는 없는 것 (뜻: trim 을 빼면 잡힘)", () => {
    expect(parseAdsConfig({ ADMOB_IOS_APP_ID: ` ${IOS_APP}\n`, ADMOB_ANDROID_APP_ID: ANDROID_APP }).enabled).toBe(true);
    expect(parseAdsConfig({ ADMOB_IOS_APP_ID: "  ", ADMOB_ANDROID_APP_ID: ANDROID_APP }).enabled).toBe(false);
  });

  it("앱 아이디 모양이 틀리면 꺼진다 (뜻: 검증을 빼면 잡힘)", () => {
    for (const bad of ["x", "ca-app-pub-3940256099942544/1458002511", "ca-app-pub-123~456", `${IOS_APP}x`]) {
      expect(parseAdsConfig({ ADMOB_IOS_APP_ID: bad, ADMOB_ANDROID_APP_ID: ANDROID_APP })).toEqual({ enabled: false });
    }
  });

  it("배너 단위 아이디는 모양이 맞을 때만 받는다 (뜻: 앱 아이디 모양을 단위에 쓰면 잡힘)", () => {
    const cfg = parseAdsConfig({
      ...base,
      EXPO_PUBLIC_ADMOB_IOS_BANNER_ID: ` ${OWN_UNIT} `,
      EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID: "ca-app-pub-1111111111111111~2222222222",
    });
    expect(cfg).toEqual({ enabled: true, iosAppId: IOS_APP, androidAppId: ANDROID_APP, iosBannerId: OWN_UNIT });
  });
});

describe("bannerUnitId", () => {
  const cfg = parseAdsConfig(base);
  it("개발 빌드에 단위 아이디가 없으면 구글 시험용 (뜻: 시험용을 안 쓰면 잡힘)", () => {
    expect(bannerUnitId(cfg, "ios", true)).toBe(GOOGLE_TEST_IDS.iosBanner);
    expect(bannerUnitId(cfg, "android", true)).toBe(GOOGLE_TEST_IDS.androidBanner);
  });
  it("배포 빌드에 단위 아이디가 없으면 null — 시험 광고를 내보내지 않는다", () => {
    expect(bannerUnitId(cfg, "ios", false)).toBeNull();
    expect(bannerUnitId(cfg, "android", false)).toBeNull();
  });
  it("있으면 개발이든 배포든 그 값", () => {
    const own = parseAdsConfig({ ...base, EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID: OWN_UNIT });
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
    expect(adsFromExtra({ ads: parseAdsConfig(base) })).toEqual(parseAdsConfig(base));
  });
  it("없거나 이상하면 꺼진다 (뜻: 런타임이 extra 를 믿고 켜면 잡힘)", () => {
    const bad = [undefined, null, {}, { ads: null }, { ads: { enabled: true } }, { ads: { enabled: true, iosAppId: "x", androidAppId: "y" } }];
    for (const extra of bad) expect(adsFromExtra(extra)).toEqual({ enabled: false });
  });
});
