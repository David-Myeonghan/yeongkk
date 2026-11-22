import { describe, expect, it } from "vitest";
import { parseAnonId, parseAppVersion, parseHost, parseLocale, parseWord } from "./validate";

describe("parseWord", () => {
  it("앞뒤 공백을 떼고 1~20자 (코드 포인트 기준)", () => {
    expect(parseWord("  갑분싸 ")).toBe("갑분싸");
    expect(parseWord("가".repeat(20))).toBe("가".repeat(20));
    expect(parseWord("😀".repeat(20))).toBe("😀".repeat(20));
  });

  it("빈 글 · 공백뿐 · 21자 · 문자열 아님은 거부", () => {
    for (const v of ["", "   ", "가".repeat(21), "😀".repeat(21), 5, null, undefined]) expect(parseWord(v)).toBeNull();
  });

  it("@아이디 · 주소 · 도메인 모양은 거부", () => {
    for (const v of ["@david", "a@b", "http://x", "https://x.kr", "www.naver", "WWW.naver", "naver.com", "foo.co.kr", "내말 a.kr"]) {
      expect(parseWord(v), v).toBeNull();
    }
  });

  it("숫자 7자리 이상(공백 · 하이픈 섞여도)은 거부, 6자리까지는 허용", () => {
    for (const v of ["01012345678", "010 1234 5678", "010-1234-5678", "12 34 56 7"]) expect(parseWord(v), v).toBeNull();
    expect(parseWord("123456")).toBe("123456");
    expect(parseWord("14학번")).toBe("14학번");
  });

  it("마침표가 끝에 오거나 한 글자 뒤면 허용", () => {
    expect(parseWord("ㅇㅈ.")).toBe("ㅇㅈ.");
    expect(parseWord("a.b")).toBe("a.b");
  });

  it("한글 · 숫자 · 한 글자가 점 뒤에 와도 허용", () => {
    for (const v of ["어쩔.티비", "ㅇㅈ.ㅇㅇ", "ㅋ.ㅋ", "v2.0", "a.b"]) expect(parseWord(v), v).toBe(v);
  });

  it("점 뒤 ASCII 2자 이상 · xn-- 라벨이 끝 또는 구분 기호 앞이면 주소 모양", () => {
    for (const v of [
      "kakao.com/o/x", "bit.ly/x", "naver.com.", "see naver.com now", "naver.com?q=1", "naver.com#a",
      "naver.com:8080", "naver.com,", "naver.com!", "(naver.com)", "a.xn--p1ai", "NAVER.COM",
    ]) {
      expect(parseWord(v), v).toBeNull();
    }
  });

  it("비슷하게 생긴 문자도 걸러낸다 (전각 · 숫자 · 보이지 않는 문자)", () => {
    for (const v of ["＠david", "０１０１２３４５６７８", "naver.c\u200Bom", "ｎａｖｅｒ．ｃｏｍ"]) {
      expect(parseWord(v), v).toBeNull();
    }
  });

  it("정규화한 값을 돌려주고 평범한 한글은 그대로", () => {
    expect(parseWord("갑분싸")).toBe("갑분싸");
    expect(parseWord("ａｂ\u200Bc")).toBe("abc");
  });
});

describe("식별 값", () => {
  it("anonId 는 8~64자 영숫자 _ -", () => {
    expect(parseAnonId("abcdefgh")).toBe("abcdefgh");
    expect(parseAnonId("a".repeat(64))).not.toBeNull();
    for (const v of ["abcdefg", "a".repeat(65), "abcd efgh", "abcdefg!", "가나다라마바사아", 5]) expect(parseAnonId(v)).toBeNull();
  });

  it("locale 은 xx-XX", () => {
    expect(parseLocale("ko-KR")).toBe("ko-KR");
    for (const v of ["ko", "ko-kr", "KO-KR", "ko-KRR", 5]) expect(parseLocale(v)).toBeNull();
  });

  it("host 는 app 또는 browser", () => {
    expect(parseHost("app")).toBe("app");
    expect(parseHost("browser")).toBe("browser");
    expect(parseHost("web")).toBeNull();
  });

  it("appVersion 은 32자 이하 [0-9A-Za-z.+-]", () => {
    expect(parseAppVersion("1.2.3-beta+4")).toBe("1.2.3-beta+4");
    for (const v of ["", "x".repeat(33), "1 2", "1_2", 5]) expect(parseAppVersion(v)).toBeNull();
  });
});
