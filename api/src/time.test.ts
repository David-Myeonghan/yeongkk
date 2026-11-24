import { describe, expect, it } from "vitest";
import { dayOf } from "./time";

describe("dayOf (UTC+9)", () => {
  it("14:59:59Z 는 같은 날", () => {
    expect(dayOf(Date.parse("2026-11-22T14:59:59Z"))).toBe("2026-11-22");
  });

  it("15:00:00Z 는 다음 날", () => {
    expect(dayOf(Date.parse("2026-11-22T15:00:00Z"))).toBe("2026-11-23");
  });

  it("해와 달 경계를 넘긴다", () => {
    expect(dayOf(Date.parse("2026-12-31T15:00:00Z"))).toBe("2027-01-01");
    expect(dayOf(Date.parse("2026-01-01T00:00:00Z"))).toBe("2026-01-01");
  });
});
