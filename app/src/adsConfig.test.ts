import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import { adsFromExtra, AdsSettingsError, ADS_MODULE, ADS_MODULES, ADS_NATIVE_MODULE, TRACKING_MODULE, adsModuleAvailable, bannerUnitId, GOOGLE_TEST_IDS, resolveAdsConfig } from "./adsConfig";

const IOS_APP = "ca-app-pub-3940256099942544~1458002511";
const ANDROID_APP = "ca-app-pub-3940256099942544~3347511713";
const OWN_UNIT = "ca-app-pub-1111111111111111/2222222222";
const base = { ADMOB_IOS_APP_ID: IOS_APP, ADMOB_ANDROID_APP_ID: ANDROID_APP };

const IN = { excludedModules: [] as readonly string[] };
const OUT = { excludedModules: ADS_MODULES };
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

describe("resolveAdsConfig — 두 네이티브 모듈은 함께 제외하거나 함께 뺀다", () => {
  const ONLY_ADS = { excludedModules: [ADS_MODULE] as readonly string[] };
  const ONLY_TRACKING = { excludedModules: [TRACKING_MODULE] as readonly string[] };

  it("광고 모듈과 추적 투명성 모듈이 둘 다 제외 대상이다 (뜻: 하나가 빠지면 기본 빌드가 추적 라이브러리를 링크한다)", () => {
    expect([...ADS_MODULES].sort()).toEqual(["expo-tracking-transparency", "react-native-google-mobile-ads"]);
  });

  it("하나만 제외된 상태는 아이디가 없어도 있어도 오류, 어느 쪽이 남았는지 알려 준다 (뜻: 한쪽만 제외해도 통과하면 잡힘)", () => {
    for (const env of [{}, base]) {
      expect(() => resolveAdsConfig(env, ONLY_ADS)).toThrow(AdsSettingsError);
      expect(() => resolveAdsConfig(env, ONLY_ADS)).toThrow(/함께 넣거나 함께 빼야 해요[\s\S]*expo-tracking-transparency/);
      expect(() => resolveAdsConfig(env, ONLY_TRACKING)).toThrow(/함께 넣거나 함께 빼야 해요[\s\S]*react-native-google-mobile-ads/);
    }
  });

  it("두 모듈 이름이 오류 안내에 들어간다 (뜻: 안내가 한 패키지만 말하면 잡힘)", () => {
    expect(() => resolveAdsConfig(base, OUT)).toThrow(new RegExp(`${ADS_MODULE}[\\s\\S]*${TRACKING_MODULE}`));
    expect(() => resolveAdsConfig({}, IN)).toThrow(new RegExp(`${ADS_MODULE}[\\s\\S]*${TRACKING_MODULE}`));
  });
});

describe("app/package.json 의 제외 목록", () => {
  it("기본 상태에서 두 네이티브 모듈이 모두 제외돼 있다 (뜻: 하나가 빠지면 기본 iOS 빌드가 추적 프레임워크를 링크한다)", () => {
    const pkg: { expo: { autolinking: { exclude: string[] } } } = JSON.parse(readFileSync(join(import.meta.dirname, "..", "package.json"), "utf8"));
    expect([...pkg.expo.autolinking.exclude].sort()).toEqual([...ADS_MODULES].sort());
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

  it("배너 단위 아이디: 맞는 모양은 받고 앞뒤 공백은 자른다 (뜻: trim 을 빼면 잡힘)", () => {
    expect(inBuild({ ...base, EXPO_PUBLIC_ADMOB_IOS_BANNER_ID: ` ${OWN_UNIT} ` })).toEqual({
      enabled: true,
      iosAppId: IOS_APP,
      androidAppId: ANDROID_APP,
      iosBannerId: OWN_UNIT,
    });
  });

  it("배너 단위 아이디가 있는데 모양이 틀리면 오류 — 앱 아이디를 잘못 붙인 경우 (뜻: 조용히 무시하면 잡힘)", () => {
    for (const key of ["EXPO_PUBLIC_ADMOB_IOS_BANNER_ID", "EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID"]) {
      expect(() => inBuild({ ...base, [key]: "ca-app-pub-1111111111111111~2222222222" })).toThrow(AdsSettingsError);
      expect(() => inBuild({ ...base, [key]: "x" })).toThrow(/배너 단위 아이디/);
    }
  });

  it("배너 단위 아이디가 빈 글자면 안 준 것", () => {
    expect(inBuild({ ...base, EXPO_PUBLIC_ADMOB_IOS_BANNER_ID: " " })).toEqual({ enabled: true, iosAppId: IOS_APP, androidAppId: ANDROID_APP });
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
  it("extra 읽기는 너그럽다: 틀린 배너 아이디는 버리고 켠 채로 둔다", () => {
    expect(adsFromExtra({ ads: { enabled: true, iosAppId: IOS_APP, androidAppId: ANDROID_APP, iosBannerId: "x" } })).toEqual(inBuild(base));
  });
  it("앱 설정의 extra.ads 를 다시 검증해 읽는다", () => {
    expect(adsFromExtra({ ads: inBuild(base) })).toEqual(inBuild(base));
  });
  it("없거나 이상하면 꺼진다 (뜻: 런타임이 extra 를 믿고 켜면 잡힘)", () => {
    const bad = [undefined, null, {}, { ads: null }, { ads: { enabled: true } }, { ads: { enabled: true, iosAppId: "x", androidAppId: "y" } }];
    for (const extra of bad) expect(adsFromExtra(extra)).toEqual({ enabled: false });
  });
});

describe("adsModuleAvailable", () => {
  it("네이티브 모듈이 등록돼 있으면 참 (뜻: 이름이 틀리면 잡힘)", () => {
    const asked: string[] = [];
    expect(adsModuleAvailable((name) => (asked.push(name), {}))).toBe(true);
    expect(asked).toEqual([ADS_NATIVE_MODULE]);
  });

  it("없으면 거짓 — 가져오기(import)를 하기 전에 알아야 빨간 오류 상자가 안 뜬다", () => {
    expect(adsModuleAvailable(() => null)).toBe(false);
  });

  it("조회가 던지면 거짓", () => {
    expect(
      adsModuleAvailable(() => {
        throw new Error("x");
      }),
    ).toBe(false);
  });
});

describe("ADS_NATIVE_MODULE", () => {
  it("설치된 광고 라이브러리가 등록하는 네이티브 모듈 이름과 같다 (뜻: 이름이 틀리거나 라이브러리가 바꾸면 광고가 소리 없이 꺼지므로 여기서 잡힘)", () => {
    const root = dirname(createRequire(import.meta.url).resolve(`${ADS_MODULE}/package.json`));
    const spec = join(root, "src", "specs", "modules", "NativeGoogleMobileAdsModule.ts");
    expect(existsSync(spec), `${spec} 가 없어요. 라이브러리가 파일을 옮겼으면 이 경로를 고치세요`).toBe(true);
    expect(readFileSync(spec, "utf8")).toContain(`getEnforcing<Spec>('${ADS_NATIVE_MODULE}')`);
  });
});
