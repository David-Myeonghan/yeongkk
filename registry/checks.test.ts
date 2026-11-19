import { test, expect } from "vitest";
import { checkFormat } from "./checks";
import { sampleWord, loaded } from "./testkit";

test("정상 파일 통과", () => expect(checkFormat(loaded(sampleWord()))).toEqual([]));
test("깨진 JSON", () => expect(checkFormat(loaded({ __parseError: "x" }))[0].message).toContain("JSON"));
test("폴더 로케일 ≠ 파일 locale", () => {
  expect(checkFormat(loaded(sampleWord(), "words/en-US/gatsaeng.json")).map(p => p.message).join()).toContain("로케일");
});
test("파일 이름 ≠ id", () => {
  expect(checkFormat(loaded(sampleWord(), "words/ko-KR/other.json")).length).toBe(1);
});
test("파일 이름에 대문자", () => {
  expect(checkFormat(loaded(sampleWord({ id: "Gat" }), "words/ko-KR/Gat.json")).length).toBeGreaterThan(0);
});

import type { Word } from "./types";
import { checkDuplicates } from "./checks";
const v = (o: Partial<Word>, path: string) => ({ path, word: sampleWord(o) });
test("같은 로케일 같은 말 = 중복 (공백·NFD·은퇴 포함)", () => {
  const nfd = "갓생".normalize("NFD");
  const ps = checkDuplicates([
    v({}, "words/ko-KR/gatsaeng.json"),
    v({ id: "gat-2", word: ` ${nfd} `, status: "retired" }, "words/ko-KR/gat-2.json"),
  ]);
  expect(ps.length).toBe(1);
  expect(ps[0].file).toBe("words/ko-KR/gat-2.json");
});
test("다른 로케일이면 중복 아님", () => {
  expect(checkDuplicates([v({}, "a"), v({ locale: "en-US" }, "b")])).toEqual([]);
});

import { checkSources, platformOf } from "./checks";
test("플랫폼 판별", () => {
  expect(platformOf("https://youtu.be/x")).toBe("youtube");
  expect(platformOf("https://m.youtube.com/watch?v=x")).toBe("youtube");
  expect(platformOf("https://www.tiktok.com/tag/abc")).toBe("tiktok");
  expect(platformOf("not a url")).toBe("invalid");
});
test("같은 플랫폼 주소 2개는 실패", () => {
  const w = sampleWord({ sources: ["https://youtu.be/a", "https://youtu.be/b"] });
  expect(checkSources([{ path: "p", word: w }]).length).toBe(1);
});
test("서로 다른 플랫폼 2개면 통과", () => {
  expect(checkSources([{ path: "p", word: sampleWord() }])).toEqual([]);
});

import { checkBanned } from "./checks";
test("뜻·예문에 금지어가 있으면 실패", () => {
  const w = sampleWord({ examples: ["욕1 들어간 예문 갓생", "갓생 둘"] });
  expect(checkBanned([{ path: "p", word: w }], { "ko-KR": ["욕1"] }).length).toBe(1);
});
test("다른 로케일 금지어는 무시", () => {
  expect(checkBanned([{ path: "p", word: sampleWord() }], { "en-US": ["갓생"] })).toEqual([]);
});

import { checkQuiz } from "./checks";
test("웃긴 오답이 뜻과 같으면 실패", () => {
  const w = sampleWord({ funnyWrong: ["부지런하고 계획적으로 사는 삶"] });
  expect(checkQuiz([{ path: "p", word: w }]).length).toBe(1);
});
test("예문에 그 말이 없으면 실패", () => {
  const w = sampleWord({ examples: ["아무 말", "갓생 있음"] });
  expect(checkQuiz([{ path: "p", word: w }])[0].message).toContain("예문");
});
test("뜻이 말 자체면 실패", () => {
  expect(checkQuiz([{ path: "p", word: sampleWord({ meaning: "갓생" }) }]).length).toBe(1);
});

import { checkPII } from "./checks";
const pii = (o: Partial<Word>) => checkPII([{ path: "p", word: sampleWord(o) }]);
test("@아이디", () => expect(pii({ examples: ["@kim_01 갓생", "갓생"] }).length).toBe(1));
test("이메일", () => expect(pii({ examples: ["a.b@mail.com 갓생", "갓생"] }).length).toBe(1));
test("전화번호", () => expect(pii({ examples: ["010-1234-5678 갓생", "갓생"] }).length).toBe(1));
test("계정 주소", () => expect(pii({ sources: ["https://www.youtube.com/@someone", "https://www.instagram.com/p/X/"] }).length).toBe(1));
test("인스타 프로필 주소", () => expect(pii({ sources: ["https://youtu.be/abc123", "https://www.instagram.com/someone/"] }).length).toBe(1));
test("정상", () => expect(pii({})).toEqual([]));
test("유튜브 짧은 주소·shorts 통과", () => {
  expect(pii({ sources: ["https://youtu.be/abc123", "https://www.youtube.com/shorts/Ab-cd_1"] })).toEqual([]);
});

import { checkScope } from "./checks";
test("봇 PR 이 words/ 밖을 바꾸면 실패", () => {
  expect(checkScope(["words/ko-KR/a.json", "registry/checks.ts"], true).length).toBe(1);
});
test("사람 PR 은 범위 제한 없음", () => expect(checkScope(["registry/checks.ts"], false)).toEqual([]));
