import { describe, expect, it } from "vitest";
import { localDate } from "./today";

describe("localDate — 기기 달력 날짜", () => {
  it("시험은 Asia/Seoul 로 돈다(web test 스크립트의 TZ)", () => {
    expect(new Date("2026-12-31T15:30:00Z").getTimezoneOffset()).toBe(-540);
  });

  it("YYYY-MM-DD, 한 자리 월·일은 0 을 채운다", () => {
    expect(localDate(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
    expect(localDate(new Date(2026, 10, 23, 9))).toBe("2026-11-23");
  });

  it("UTC 가 아니라 기기 시간대의 날짜: UTC 12-31 15:30 은 서울 1월 1일", () => {
    expect(localDate(new Date("2026-12-31T15:30:00Z"))).toBe("2027-01-01");
    expect(localDate(new Date("2026-12-31T14:59:59Z"))).toBe("2026-12-31");
  });
});
