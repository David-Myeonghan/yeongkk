import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

interface Profile {
  distribution?: string;
  developmentClient?: boolean;
  autoIncrement?: boolean;
  env?: Record<string, string>;
}
interface Eas {
  cli: { version: string; appVersionSource: string };
  build: Record<string, Profile>;
}

const eas = JSON.parse(readFileSync(join(import.meta.dirname, "..", "eas.json"), "utf8")) as Eas;
const ALLOWED_ENV = ["APP_PROFILE", "APP_IDENTIFIER", "EXPO_PUBLIC_WEB_URL", "EAS_PROJECT_ID", "ADMOB_IOS_APP_ID", "ADMOB_ANDROID_APP_ID", "EXPO_PUBLIC_ADMOB_IOS_BANNER_ID", "EXPO_PUBLIC_ADMOB_ANDROID_BANNER_ID"];

describe("eas.json 모양", () => {
  it("프로필 셋이 있다", () => {
    expect(Object.keys(eas.build).sort()).toEqual(["development", "preview", "production"]);
  });

  it("production 은 스토어용이다 (internal 로 바꾸면 빨개진다)", () => {
    expect(eas.build.production.distribution).toBe("store");
    expect(eas.build.production.developmentClient).not.toBe(true);
  });

  it("development 는 개발 클라이언트 + internal, preview 는 internal 이다", () => {
    expect(eas.build.development).toMatchObject({ developmentClient: true, distribution: "internal" });
    expect(eas.build.preview.distribution).toBe("internal");
    expect(eas.build.preview.developmentClient).not.toBe(true);
  });

  it("빌드 번호는 서버가 올린다 (remote + production autoIncrement)", () => {
    expect(eas.cli.appVersionSource).toBe("remote");
    expect(eas.build.production.autoIncrement).toBe(true);
    expect(eas.cli.version).toMatch(/^[<>=~^ 0-9.]+$/);
  });

  it("프로필마다 APP_PROFILE 이 자기 이름이다 (복사해 두고 안 바꾸면 빨개진다)", () => {
    for (const [name, profile] of Object.entries(eas.build)) expect(profile.env?.APP_PROFILE).toBe(name);
  });

  it("env 에는 허용한 이름만, 비밀처럼 보이는 값은 없다", () => {
    for (const profile of Object.values(eas.build)) {
      for (const [key, value] of Object.entries(profile.env ?? {})) {
        expect(ALLOWED_ENV).toContain(key);
        expect(key).not.toMatch(/SECRET|TOKEN|PASSWORD|PRIVATE/i);
        expect(value).not.toMatch(/^[A-Za-z0-9+/_=-]{40,}$/);
      }
    }
  });

  it("파일 전체에 비밀 모양이 없다", () => {
    const text = readFileSync(join(import.meta.dirname, "..", "eas.json"), "utf8");
    expect(text).not.toMatch(/-----BEGIN|AKIA[0-9A-Z]{12}|ghp_|(?:secret|token|password)"\s*:/i);
  });
});
