import { describe, expect, it } from "vitest";
import { fnv1a32, seededRng, shuffled } from "./rng";

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

  it("seededRng 골든 수열 (엔진과 무관하게 같다)", () => {
    const korean = seededRng("영크크");
    expect([korean(), korean(), korean()]).toEqual([0.28182578762061894, 0.823351446306333, 0.27077360125258565]);
    const ascii = seededRng("seed-1");
    expect([ascii(), ascii(), ascii()]).toEqual([0.8126733123790473, 0.5248212472070009, 0.5631958588492125]);
  });

  it("shuffled 는 순열이고 입력을 바꾸지 않는다", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = shuffled(input, seededRng("s"));
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...out].sort((a, b) => a - b)).toEqual(input);
    expect(out).not.toBe(input);
  });
});
