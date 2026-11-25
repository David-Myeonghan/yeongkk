import { describe, expect, it } from "vitest";
import { PRIVACY_CONTACT_PLACEHOLDER } from "../../tools/privacy/contact";
import { parseWebUrl } from "./config";
import {
  PLACEHOLDER_IDENTIFIER,
  ReleaseSettingsError,
  assertReleaseReady,
  isValidIdentifier,
  releaseProblems,
  type ReleaseInput,
} from "./releaseCheck";

const valid: ReleaseInput = {
  profile: "production",
  identifier: "kr.mynmal.app",
  webUrl: "https://quiz.example.com",
  projectId: "11111111-2222-3333-4444-555555555555",
  privacyContact: "privacy@example.com",
};

const problems = (patch: Partial<ReleaseInput>) => releaseProblems({ ...valid, ...patch });

describe("production: 한 규칙씩", () => {
  it("값이 다 맞으면 문제가 없다", () => {
    expect(releaseProblems(valid)).toEqual([]);
  });

  it("자리표시 식별자는 막는다 (자리표시 비교를 지우면 빨개진다)", () => {
    const found = problems({ identifier: PLACEHOLDER_IDENTIFIER });
    expect(found).toHaveLength(1);
    expect(found[0]).toContain("자리표시");
  });

  it.each(["Kr.Mynmal.App", "kr.my_nmal.app", "mynmal", "kr..app", "kr.1app.x", "kr.my-nmal.app", " kr.app", ""])(
    "식별자 모양이 틀리면 막는다: %j",
    (identifier) => {
      expect(problems({ identifier })).toHaveLength(1);
    },
  );

  it.each([undefined, "", "   "])("웹 주소가 없으면 막는다: %j", (webUrl) => {
    expect(problems({ webUrl })).toHaveLength(1);
  });

  it.each([
    "http://quiz.example.com",
    "https://localhost",
    "https://localhost:8787",
    "https://192.168.0.2",
    "https://[::1]",
    "https://x.workers.dev",
    "https://yeongkk.my-account.workers.dev/",
    "https://intranet",
    "quiz.example.com",
  ])("스토어 빌드가 가리키면 안 되는 주소: %s", (webUrl) => {
    expect(problems({ webUrl })).toHaveLength(1);
  });

  it.each(["https://뭔말이야.kr", "https:/quiz.example.com", "https://my_quiz.example.com", "https://x.workers.dev."])(
    "앱이 못 읽거나(originOf 가 null) 끝 점으로 빠져나가는 주소도 막는다: %s",
    (webUrl) => {
      expect(problems({ webUrl })).toHaveLength(1);
    },
  );

  it.each(["https://뭔말이야.kr", "https:/quiz.example.com", "https://my_quiz.example.com"])("preview 도 앱이 못 읽는 주소는 막는다: %s", (webUrl) => {
    expect(releaseProblems({ ...valid, profile: "preview", webUrl })).toHaveLength(1);
  });

  it("guard 가 통과시킨 주소는 앱의 parseWebUrl 이 던지지 않는다 (둘이 어긋나면 빨개진다)", () => {
    for (const webUrl of ["https://quiz.example.com", "https://quiz.example.com/", "https://a.b.co.kr:8443", "https://workers.dev.example.com"]) {
      expect(problems({ webUrl })).toEqual([]);
      expect(() => parseWebUrl(webUrl)).not.toThrow();
    }
  });

  it.each(["https://quiz.example.com", "https://quiz.example.com/", "https://a.b.co.kr:8443"])("받는 주소: %s", (webUrl) => {
    expect(problems({ webUrl })).toEqual([]);
  });

  it("workers.dev 로 끝나지만 다른 주소는 막지 않는다 (끝 일치 대신 포함 검사를 쓰면 빨개진다)", () => {
    expect(problems({ webUrl: "https://workers.dev.example.com" })).toEqual([]);
  });

  it.each([undefined, "", "  "])("EAS 프로젝트 아이디가 없으면 막는다: %j", (projectId) => {
    expect(problems({ projectId })).toHaveLength(1);
  });

  it.each([PRIVACY_CONTACT_PLACEHOLDER, "", "  "])("개인정보 문의처가 자리표시이거나 비면 막는다: %j", (privacyContact) => {
    expect(problems({ privacyContact })).toHaveLength(1);
  });

  it("실제로 보이는 문의처는 막지 않는다 (저장소의 현재 값과 무관)", () => {
    expect(problems({ privacyContact: "privacy@example.com" })).toEqual([]);
    expect(problems({ privacyContact: "https://example.com/contact" })).toEqual([]);
  });
});

describe("production: 문제를 한꺼번에 보고한다", () => {
  const all: ReleaseInput = {
    profile: "production",
    identifier: PLACEHOLDER_IDENTIFIER,
    webUrl: "https://x.workers.dev",
    projectId: undefined,
    privacyContact: PRIVACY_CONTACT_PLACEHOLDER,
  };

  it("네 가지를 모두 센다 (첫 문제에서 멈추면 빨개진다)", () => {
    expect(releaseProblems(all)).toHaveLength(4);
  });

  it("오류 하나에 번호 붙은 문제가 전부 들어 있다", () => {
    let thrown: unknown;
    try {
      assertReleaseReady(all);
    } catch (e) {
      thrown = e;
    }
    expect(thrown).toBeInstanceOf(ReleaseSettingsError);
    const message = (thrown as Error).message;
    for (const n of ["1.", "2.", "3.", "4."]) expect(message).toContain(n);
    expect(message).toContain("APP_IDENTIFIER");
    expect(message).toContain("EXPO_PUBLIC_WEB_URL");
    expect(message).toContain("EAS_PROJECT_ID");
    expect(message).toContain("tools/privacy/contact.ts");
  });

  it("문제가 없으면 던지지 않는다", () => {
    expect(() => assertReleaseReady(valid)).not.toThrow();
  });
});

describe("프로필별 차이", () => {
  const placeholders: ReleaseInput = {
    profile: undefined,
    identifier: PLACEHOLDER_IDENTIFIER,
    webUrl: undefined,
    projectId: undefined,
    privacyContact: PRIVACY_CONTACT_PLACEHOLDER,
  };

  it.each([undefined, "", "development"])("프로필 %j 은 검사하지 않는다", (profile) => {
    expect(releaseProblems({ ...placeholders, profile })).toEqual([]);
  });

  it("preview: 자리표시 식별자는 막는다", () => {
    expect(releaseProblems({ ...valid, profile: "preview", identifier: PLACEHOLDER_IDENTIFIER })).toHaveLength(1);
  });

  it.each([undefined, "", "http://quiz.example.com"])("preview: https 가 아니면 막는다: %j", (webUrl) => {
    expect(releaseProblems({ ...valid, profile: "preview", webUrl })).toHaveLength(1);
  });

  it("preview: workers.dev · 프로젝트 아이디 없음 · 자리표시 문의처는 허용한다", () => {
    expect(
      releaseProblems({
        profile: "preview",
        identifier: "kr.mynmal.app",
        webUrl: "https://yeongkk.me.workers.dev",
        projectId: undefined,
        privacyContact: PRIVACY_CONTACT_PLACEHOLDER,
      }),
    ).toEqual([]);
  });

  it("알 수 없는 프로필 이름은 스토어 기준으로 본다 (조용히 풀리면 빨개진다)", () => {
    expect(releaseProblems({ ...placeholders, profile: "staging" }).length).toBeGreaterThan(0);
  });
});

describe("isValidIdentifier", () => {
  it.each(["kr.mynmal.app", "a.b", "com.example.app2"])("맞다: %s", (id) => expect(isValidIdentifier(id)).toBe(true));
  it.each(["App.example", "a_b.c", "single", "a.b-c", "a.1b", "a.b.", ".a.b"])("틀리다: %s", (id) => expect(isValidIdentifier(id)).toBe(false));
});
