import { describe, expect, it } from "vitest";
import { DEFAULT_WEB_URL, parseWebUrl } from "./config";

describe("parseWebUrl", () => {
  it("값이 없거나 비어 있으면 개발용 기본값", () => {
    expect(parseWebUrl(undefined)).toEqual({ url: DEFAULT_WEB_URL, origin: "http://localhost:8787" });
    expect(parseWebUrl("   ")).toEqual({ url: DEFAULT_WEB_URL, origin: "http://localhost:8787" });
  });

  it("https 주소에서 출처를 뽑는다", () => {
    expect(parseWebUrl("https://quiz.example.com/path")).toEqual({
      url: "https://quiz.example.com/path",
      origin: "https://quiz.example.com",
    });
  });

  it("LAN 주소와 포트를 받는다", () => {
    expect(parseWebUrl("http://192.168.0.5:8787").origin).toBe("http://192.168.0.5:8787");
  });

  it("앞뒤 공백은 지운다", () => {
    expect(parseWebUrl("  https://a.example.com  ").url).toBe("https://a.example.com");
  });

  it.each(["ftp://a.com", "quiz.example.com", "javascript:alert(1)", "https://", "file:///x", "myapp://a", "https://a b.com"])(
    "%j 는 분명한 오류로 던진다",
    (raw) => {
      expect(() => parseWebUrl(raw)).toThrow(/EXPO_PUBLIC_WEB_URL/);
    },
  );
});
