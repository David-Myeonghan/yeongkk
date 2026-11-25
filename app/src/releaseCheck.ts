import { PRIVACY_CONTACT_PLACEHOLDER, isPlaceholderContact } from "../../tools/privacy/contact.ts";
import { present } from "./adsConfig.ts";
import { originOf } from "./navigation.ts";

export const PLACEHOLDER_IDENTIFIER = "app.example.yeongkk";

export interface ReleaseInput {
  profile: string | undefined;
  identifier: string;
  webUrl: string | undefined;
  projectId: string | undefined;
  privacyContact: string;
}

export class ReleaseSettingsError extends Error {}

type Level = "none" | "preview" | "store";

const LEVELS: Record<string, Level> = { development: "none", preview: "preview" };

const levelOf = (profile: string | undefined): Level => {
  const name = profile?.trim() ?? "";
  if (name === "") return "none";
  return Object.hasOwn(LEVELS, name) ? LEVELS[name] : "store";
};

const IDENTIFIER = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/;
const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/;

export const isValidIdentifier = (id: string): boolean => IDENTIFIER.test(id);

function hostOf(origin: string): string {
  const authority = origin.slice(origin.indexOf("//") + 2);
  return authority.startsWith("[") ? authority : authority.replace(/:\d+$/, "");
}

function storeHostProblem(host: string): string | null {
  if (host === "localhost" || host.endsWith(".localhost")) return "localhost 는 폰에서 열리지 않아요";
  if (IPV4.test(host) || host.startsWith("[")) return "IP 주소는 쓰지 않아요";
  if (!host.includes(".")) return "도메인이 아니에요";
  if (host.endsWith(".workers.dev")) return "workers.dev 주소는 쓰지 않아요";
  return null;
}

// 앱이 실제로 여는 주소 해석(originOf)을 그대로 쓴다. 지킴과 앱이 다르게 읽으면 빌드는 되는데 앱이 켜지자마자 죽는다.
function urlProblems(raw: string | undefined, level: Level): string[] {
  const hint = "EXPO_PUBLIC_WEB_URL";
  const text = present(raw)?.trim();
  if (text === undefined) return [`${hint} 가 비어 있어요. 앱이 열 웹 주소(https://…)를 주세요.`];
  const origin = originOf(text);
  if (origin === null || !origin.startsWith("https://")) {
    return [`${hint} 는 https:// 로 시작하고 앱이 읽을 수 있는 주소여야 해요(영문 소문자 · 숫자 · - · . 만. 한글 도메인은 punycode xn-- 로). 받은 값: ${JSON.stringify(raw)}`];
  }
  if (level !== "store") return [];
  const why = storeHostProblem(hostOf(origin));
  if (why === null) return [];
  return [`${hint} 가 주인의 도메인이 아니에요(${why}). 설치된 앱 안의 주소는 바꿀 수 없으니 주인의 도메인을 쓰세요. 받은 값: ${JSON.stringify(raw)}`];
}

function identifierProblems(id: string, level: Level): string[] {
  if (id === PLACEHOLDER_IDENTIFIER) {
    return [`APP_IDENTIFIER 가 자리표시 값(${PLACEHOLDER_IDENTIFIER}) 그대로예요. 주인이 정한 식별자를 주세요.`];
  }
  if (level === "store" && !isValidIdentifier(id)) {
    return [`APP_IDENTIFIER 모양이 틀려요. 영문 소문자와 숫자로 된 마디를 점으로 이은 두 마디 이상(예: kr.mynmal.app)이어야 해요. 받은 값: ${JSON.stringify(id)}`];
  }
  return [];
}

export function releaseProblems(input: ReleaseInput): string[] {
  const level = levelOf(input.profile);
  if (level === "none") return [];
  const found = [...identifierProblems(input.identifier, level), ...urlProblems(input.webUrl, level)];
  if (level === "store") {
    if (present(input.projectId) === undefined) found.push("EAS_PROJECT_ID 가 없어요. `eas init` 으로 만든 프로젝트 아이디를 주세요.");
    if (isPlaceholderContact(input.privacyContact)) {
      found.push(`개인정보 문의처가 자리표시(${PRIVACY_CONTACT_PLACEHOLDER}) 그대로예요. tools/privacy/contact.ts 를 고치고 npm run privacy 를 돌리세요.`);
    }
  }
  return found;
}

export function assertReleaseReady(input: ReleaseInput): void {
  const found = releaseProblems(input);
  if (found.length === 0) return;
  const name = input.profile?.trim() ?? "";
  const lines = found.map((text, i) => `${i + 1}. ${text}`);
  throw new ReleaseSettingsError(`빌드 프로필 ${JSON.stringify(name)} 의 설정이 덜 끝났어요. ${found.length}가지를 고치세요.\n${lines.join("\n")}`);
}
