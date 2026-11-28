import { afterEach, describe, expect, it, vi } from "vitest";

const VALID = {
  EAS_BUILD_PROFILE: "production",
  APP_IDENTIFIER: "kr.mynmal.app",
  EXPO_PUBLIC_WEB_URL: "https://quiz.example.com",
  EAS_PROJECT_ID: "11111111-2222-3333-4444-555555555555",
};

async function load(env: Record<string, string>, contact?: string, exclude?: string[]) {
  vi.resetModules();
  vi.doUnmock("../package.json");
  if (exclude !== undefined) {
    vi.doMock("../package.json", async (importOriginal) => {
      const original = await importOriginal<{ default: { expo: object } }>();
      return { default: { ...original.default, expo: { ...original.default.expo, autolinking: { exclude } } } };
    });
  }
  vi.doUnmock("../../tools/privacy/contact");
  if (contact !== undefined) {
    vi.doMock("../../tools/privacy/contact", async (importOriginal) => ({ ...(await importOriginal<object>()), PRIVACY_CONTACT: contact }));
  }
  for (const key of ["EAS_BUILD_PROFILE", "APP_PROFILE", "APP_IDENTIFIER", "EXPO_PUBLIC_WEB_URL", "EAS_PROJECT_ID"]) vi.stubEnv(key, "");
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
  return (await import("../app.config.ts")).default;
}

afterEach(() => vi.unstubAllEnvs());

describe("app.config.ts", () => {
  it("프로필이 없으면 자리표시 식별자로도 열린다", async () => {
    const config = await load({});
    expect(config.ios?.bundleIdentifier).toBe("app.example.yeongkk");
    expect(config.android?.package).toBe("app.example.yeongkk");
    expect(config.extra).not.toHaveProperty("eas");
  });

  it("광고 없는 기본 빌드는 광고 식별자 · 저장소 권한을 막는다", async () => {
    const config = await load({});
    expect(config.android?.blockedPermissions).toEqual(
      expect.arrayContaining(["com.google.android.gms.permission.AD_ID", "android.permission.READ_EXTERNAL_STORAGE"]),
    );
  });

  it("기본 빌드는 광고 · 추적 투명성 플러그인을 넣지 않는다", async () => {
    const config = await load({});
    const names = (config.plugins ?? []).map((plugin) => (Array.isArray(plugin) ? plugin[0] : plugin));
    expect(names).not.toContain("react-native-google-mobile-ads");
    expect(names).not.toContain("expo-tracking-transparency");
  });

  it("광고 빌드는 두 플러그인을 넣고 구글의 SKAdNetwork 식별자를 준다 (뜻: 식별자를 빼면 잡힘)", async () => {
    const config = await load({ ADMOB_IOS_APP_ID: "ca-app-pub-3940256099942544~1458002511", ADMOB_ANDROID_APP_ID: "ca-app-pub-3940256099942544~3347511713" }, undefined, []);
    const plugins = new Map((config.plugins ?? []).flatMap((plugin) => (Array.isArray(plugin) ? [[plugin[0], plugin[1]] as const] : [])));
    expect(plugins.get("react-native-google-mobile-ads")).toMatchObject({ skAdNetworkItems: ["cstr6suwn9.skadnetwork"] });
    expect(plugins.has("expo-tracking-transparency")).toBe(true);
  });

  it("식별자는 APP_IDENTIFIER 한 곳에서 두 OS 로 간다", async () => {
    const config = await load({ APP_IDENTIFIER: "kr.mynmal.app" });
    expect([config.ios?.bundleIdentifier, config.android?.package]).toEqual(["kr.mynmal.app", "kr.mynmal.app"]);
  });

  it("production 은 자리표시 값이면 모든 문제를 한 오류로 낸다", async () => {
    await expect(load({ EAS_BUILD_PROFILE: "production" })).rejects.toThrow(/APP_IDENTIFIER[\s\S]*EXPO_PUBLIC_WEB_URL[\s\S]*EAS_PROJECT_ID/);
  });

  it("eas.json 이 주는 APP_PROFILE 만 있어도 같은 검사를 한다 (로컬 평가 때 막는다)", async () => {
    await expect(load({ APP_PROFILE: "production" })).rejects.toThrow(/설정이 덜 끝났어요/);
  });

  it("production 은 다른 값이 다 맞아도 문의처가 자리표시면 멈춘다", async () => {
    await expect(load(VALID, "PRIVACY_CONTACT_PLACEHOLDER")).rejects.toThrow(/PRIVACY_CONTACT_PLACEHOLDER/);
  });

  it("production 값이 맞으면 식별자 · 프로젝트 아이디 · 아이콘 · 암호화 신고가 들어간다", async () => {
    const config = await load(VALID, "privacy@example.com");
    expect(config.ios?.bundleIdentifier).toBe("kr.mynmal.app");
    expect(config.extra?.eas).toEqual({ projectId: VALID.EAS_PROJECT_ID });
    expect(config.icon).toBe("./assets/icon.png");
    expect(config.android?.adaptiveIcon?.foregroundImage).toBe("./assets/adaptive-icon.png");
    expect(config.ios?.config?.usesNonExemptEncryption).toBe(false);
    expect(config.ios?.supportsTablet).toBe(false);
  });
});
