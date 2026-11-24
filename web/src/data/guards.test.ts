import { describe, expect, it } from "vitest";
import { isSafeApiBase } from "./guards";

describe("isSafeApiBase", () => {
  it.each(["/api", "/api/v2", "https://example.com/api"])("받아들인다: %j", (v) => {
    expect(isSafeApiBase(v)).toBe(true);
  });

  it.each([
    ["//evil.com", "//evil.com"],
    ["백슬래시 시작", "/\\evil.com"],
    ["탭이 낀 //", "/\t/evil.com"],
    ["중간 백슬래시", "/api\\x"],
    ["빈 호스트", "https://"],
    ["슬래시 하나", "https:/x"],
    ["http", "http://example.com"],
    ["javascript", "javascript:alert(1)"],
    ["빈 문자열", ""],
    ["앞 공백", " /api"],
    ["너무 긴 값", "/" + "a".repeat(2999)],
    ["https 호스트에 백슬래시", "https://evil.com\\@good.com"],
    ["숫자", 5],
  ])("거절한다: %s", (_name, v) => {
    expect(isSafeApiBase(v)).toBe(false);
  });
});
