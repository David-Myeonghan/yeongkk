import { describe, expect, it } from "vitest";
import { localDate } from "./today";

describe("localDate — 기기 달력 날짜", () => {
  it("YYYY-MM-DD, 한 자리 월·일은 0 을 채운다", () => {
    expect(localDate(new Date(2026, 0, 5, 12))).toBe("2026-01-05");
    expect(localDate(new Date(2026, 10, 23, 9))).toBe("2026-11-23");
  });

  it("UTC 가 아니라 기기 시간대의 날짜", () => {
    expect(localDate(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
    expect(localDate(new Date(2027, 0, 1, 0, 0))).toBe("2027-01-01");
  });
});
