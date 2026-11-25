import { describe, expect, it } from "vitest";
import { decideNavigation, isMainDocumentFailure, isSameOrigin, originOf } from "./navigation";

const ORIGIN = "https://quiz.example.com";

describe("originOf", () => {
  it("소문자로 맞추고 기본 포트와 끝 점을 지운다", () => {
    expect(originOf("HTTPS://Quiz.Example.COM:443/a?b#c")).toBe(ORIGIN);
    expect(originOf("http://quiz.example.com.:80/")).toBe("http://quiz.example.com");
    expect(originOf("http://localhost:8787/x")).toBe("http://localhost:8787");
  });

  it.each([
    "about:blank",
    "mailto:a@b.com",
    "tel:+8210",
    "javascript:alert(1)",
    "",
    "not a url",
    "https://",
    "https://a b.com",
    "https://origin.com\\@evil.com",
    "https://user:pw@quiz.example.com/",
    " https://quiz.example.com/",
    "https:\\\\quiz.example.com",
    "https://quiz.example.com:99999999",
    "myapp://quiz.example.com",
  ])("%j 는 출처가 없다", (url) => {
    expect(originOf(url)).toBeNull();
  });
});

describe("isSameOrigin", () => {
  it("같은 출처는 경로 · 쿼리 · 해시가 달라도 참", () => {
    expect(isSameOrigin("https://quiz.example.com/", ORIGIN)).toBe(true);
    expect(isSameOrigin("https://quiz.example.com/?r=3#x", ORIGIN)).toBe(true);
    expect(isSameOrigin("https://quiz.example.com", ORIGIN)).toBe(true);
  });

  it("대문자 스킴과 호스트도 같은 출처", () => {
    expect(isSameOrigin("HTTPS://QUIZ.EXAMPLE.COM/", ORIGIN)).toBe(true);
  });

  it("끝에 점이 붙은 호스트는 같은 출처로 본다", () => {
    expect(isSameOrigin("https://quiz.example.com./", ORIGIN)).toBe(true);
  });

  it.each([
    ["접미사 호스트", "https://quiz.example.com.evil.com/"],
    ["앞에 붙인 호스트", "https://evilquiz.example.com/"],
    ["origin.evil.com 꼴", "https://quiz.example.com.attacker.io/"],
    ["userinfo 로 속이기", "https://quiz.example.com@evil.com/"],
    ["userinfo 뒤 같은 호스트", "https://evil.com@quiz.example.com/"],
    ["다른 포트", "https://quiz.example.com:8443/"],
    ["다른 스킴", "http://quiz.example.com/"],
    ["about:blank", "about:blank"],
    ["mailto", "mailto:a@quiz.example.com"],
    ["깨진 주소", "https://%%%"],
    ["빈 문자열", ""],
    ["백슬래시 속임수", "https://quiz.example.com\\@evil.com/"],
  ])("%s 는 거짓", (_name, url) => {
    expect(isSameOrigin(url, ORIGIN)).toBe(false);
  });

  it("웹 출처가 개발용 http 와 포트일 때 포트를 구분한다", () => {
    expect(isSameOrigin("http://localhost:8787/a", "http://localhost:8787")).toBe(true);
    expect(isSameOrigin("http://localhost:8788/a", "http://localhost:8787")).toBe(false);
    expect(isSameOrigin("http://localhost:87870/", "http://localhost:8787")).toBe(false);
  });

  it("웹 출처 자체가 깨졌으면 어떤 주소도 거짓", () => {
    expect(isSameOrigin("https://quiz.example.com/", "garbage")).toBe(false);
  });
});

describe("decideNavigation", () => {
  it("같은 출처는 웹뷰에서 연다", () => {
    expect(decideNavigation("https://quiz.example.com/?r=2", ORIGIN)).toBe("load");
  });

  it("다른 출처 http(s) 는 기기 브라우저로 보낸다", () => {
    expect(decideNavigation("https://evil.com/", ORIGIN)).toBe("open-external");
    expect(decideNavigation("http://quiz.example.com/", ORIGIN)).toBe("open-external");
    expect(decideNavigation("HTTPS://other.example.org/x", ORIGIN)).toBe("open-external");
    expect(decideNavigation("https://quiz.example.com.evil.com/", ORIGIN)).toBe("open-external");
  });

  it.each(["mailto:a@b.com", "tel:+8210", "myapp://x", "about:blank", "javascript:alert(1)", "intent://x#Intent;end", "", "https://", "data:text/html,hi"])(
    "%j 는 무시한다",
    (url) => {
      expect(decideNavigation(url, ORIGIN)).toBe("ignore");
    },
  );

  it("userinfo 로 같은 호스트를 흉내 낸 주소는 열지 않는다", () => {
    expect(decideNavigation("https://quiz.example.com@evil.com/", ORIGIN)).not.toBe("load");
  });
});

describe("isMainDocumentFailure", () => {
  it("현재 메인 문서 주소와 같으면 참, 해시는 무시", () => {
    expect(isMainDocumentFailure("https://quiz.example.com/a#x", "https://quiz.example.com/a")).toBe(true);
  });

  it("하위 자원(favicon 등) 오류는 거짓", () => {
    expect(isMainDocumentFailure("https://quiz.example.com/favicon.ico", "https://quiz.example.com/")).toBe(false);
  });
});
