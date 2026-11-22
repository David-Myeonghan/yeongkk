import { describe, expect, it } from "vitest";
import { fnv1a32, seededRng } from "./rng";

describe("rng", () => {
  it("fnv1a32 는 알려진 값과 같다", () => {
    expect(fnv1a32("")).toBe(0x811c9dc5);
    expect(fnv1a32("a")).toBe(0xe40c292c);
  });

  it("seededRng 는 같은 seed 에서 같은 수열을 내고 0 이상 1 미만이다", () => {
    const a = seededRng("영크크");
    const b = seededRng("영크크");
    for (let i = 0; i < 100; i++) {
      const v = a();
      expect(v).toBe(b());
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
