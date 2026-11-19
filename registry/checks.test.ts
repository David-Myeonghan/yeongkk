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
  ], []);
  expect(ps.length).toBe(1);
  expect(ps[0].file).toBe("words/ko-KR/gat-2.json");
});
test("다른 로케일이면 중복 아님", () => {
  expect(checkDuplicates([v({}, "a"), v({ locale: "en-US" }, "b")], [])).toEqual([]);
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
test("인스타 프로필 주소", () => expect(pii({ sources: ["https://youtu.be/dQw4w9WgXcQ", "https://www.instagram.com/someone/"] }).length).toBe(1));
test("정상", () => expect(pii({})).toEqual([]));
test("유튜브 짧은 주소·shorts 통과", () => {
  expect(pii({ sources: ["https://youtu.be/dQw4w9WgXcQ", "https://www.youtube.com/shorts/Ab-cd_1Ef2G"] })).toEqual([]);
});

import { checkScope } from "./checks";
test("봇 PR 이 words/ 밖을 바꾸면 실패", () => {
  expect(checkScope(["words/ko-KR/a.json", "registry/checks.ts"], [], true).length).toBe(1);
});
test("사람 PR 은 범위 제한 없음", () => expect(checkScope(["registry/checks.ts"], ["words/ko-KR/x.json"], false)).toEqual([]));

// ---- 리뷰 반영 ----
const src = (sources: string[]) => checkSources([{ path: "p", word: sampleWord({ sources }) }]);
test("허용 안 된 출처는 실패", () => {
  for (const s of [
    ["https://youtu.be/dQw4w9WgXcQ", "https://x.com/kim_01"],
    ["https://youtu.be/dQw4w9WgXcQ", "mailto:kim@naver.com"],
    ["https://a.com/x", "https://b.com/y"],
  ]) expect(src(s).length).toBeGreaterThan(0);
  expect(src(["https://youtu.be/dQw4w9WgXcQ", "https://x.com/kim_01"])[0].message).toContain("허용 안 된 출처");
});
test("출처 스키마는 https 만", () => {
  expect(checkFormat(loaded(sampleWord({ sources: ["https://youtu.be/dQw4w9WgXcQ", "mailto:kim@naver.com"] }))).length).toBeGreaterThan(0);
});
test("유튜브 호스트별 주소 규칙", () => {
  const bad = ["https://www.youtube.com/pewdiepie", "https://www.youtube.com/watchmojo", "https://www.youtube.com/watch", "https://www.youtube.com/watch?x=1", "https://youtu.be/short"];
  for (const b of bad) expect(pii({ sources: [b, "https://www.instagram.com/p/X/"] }).length, b).toBe(1);
  const good = ["https://www.youtube.com/watch?v=dQw4w9WgXcQ", "https://www.youtube.com/shorts/Ab-cd_1Ef2G", "https://youtu.be/dQw4w9WgXcQ/"];
  for (const g of good) expect(pii({ sources: [g, "https://www.instagram.com/p/X/"] }), g).toEqual([]);
});
test("보이지 않는 글자·전각 문자도 중복", () => {
  const d = (word: string) => checkDuplicates([v({}, "words/ko-KR/a.json"), v({ id: "b", word }, "words/ko-KR/b.json")], []).length;
  expect(d("갓\u200b생")).toBe(1);
  expect(checkDuplicates([v({ word: "mbti" }, "a"), v({ id: "b", word: "ＭＢＴＩ" }, "b")], []).length).toBe(1);
});
test("금지어: 보이지 않는 글자·전각 우회", () => {
  const b = (examples: string[], banned: string) => checkBanned([{ path: "p", word: sampleWord({ examples }) }], { "ko-KR": [banned] }).length;
  expect(b(["욕\u200b1 갓생", "갓생"], "욕1")).toBe(1);
  expect(b(["ＦＵＣＫ 갓생", "갓생"], "fuck")).toBe(1);
});
test("금지어는 칸마다 따로 검사", () => {
  const w = (o: Partial<Word>, banned: string) => checkBanned([{ path: "p", word: sampleWord(o) }], { "ko-KR": [banned] }).length;
  expect(w({ examples: ["버스 출발 시 발표 연습 갓생", "갓생"] }, "시발")).toBe(0);
  expect(w({ meaning: "열심히 사는 병", examples: ["신나게 갓생", "갓생"] }, "병신")).toBe(0);
});
test("활용형 용언 예문 통과", () => {
  const w = sampleWord({ word: "킹받다", examples: ["아 진짜 킹받네", "킹받아서 잠이 안 와"] });
  expect(checkQuiz([{ path: "p", word: w }])).toEqual([]);
  const w2 = sampleWord({ word: "킹받다", examples: ["아 진짜 킹받네", "아무 말"] });
  expect(checkQuiz([{ path: "p", word: w2 }]).length).toBe(1);
});
test("전화번호 정규식", () => {
  expect(pii({ examples: ["2019 2020 2021 내내 갓생", "갓생"] })).toEqual([]);
  for (const p of ["+82 10-1234-5678", "010 - 1234 - 5678", "０１０-１２３４-５６７８"]) expect(pii({ examples: [`${p} 갓생`, "갓생"] }).length, p).toBe(1);
});
test("@아이디는 영문자로 시작해야", () => {
  expect(pii({ examples: ["회의 @3pm 갓생", "갓생"] })).toEqual([]);
  expect(pii({ examples: ["＠kim_01 갓생", "갓생"] }).length).toBe(1);
});
test("봇 변경 범위는 정확히", () => {
  for (const f of ["words/ko-KR/evil.js", "words/README.md", "words/ko-KR/sub/x.json", "words/ko-KR/Bad.json"])
    expect(checkScope([f], [], true).length, f).toBe(1);
  expect(checkScope(["words/ko-KR/gat-saeng2.json"], [], true)).toEqual([]);
  expect(checkScope([], ["words/ko-KR/a.json"], true)[0].message).toContain("지울 수 없음");
});
test("중복은 PR 이 건드린 파일을 표시", () => {
  const old = v({ id: "gat-2", status: "retired" }, "words/ko-KR/gat-2.json");
  const added = v({ id: "gat-3" }, "words/ko-KR/gat-3.json");
  const ps = checkDuplicates([old, added], ["words/ko-KR/gat-3.json"]);
  expect(ps.map(p => p.file)).toEqual(["words/ko-KR/gat-3.json"]);
});
test("출처 주소에 계정 정보(userinfo)가 있으면 실패", () => {
  expect(pii({ sources: ["https://kim.chulsoo@youtu.be/dQw4w9WgXcQ", "https://www.instagram.com/p/X/"] }).length).toBe(1);
});
