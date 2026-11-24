import { describe, expect, it } from "vitest";
import { assignVariant, type Experiment } from "./experiment";
import { fnv1a32, seededRng } from "./rng";

const exp = (id: string, variants = [{ name: "a", weight: 1 }, { name: "b", weight: 1 }]): Experiment => ({
  id,
  variants,
  enabled: true,
});

describe("assignVariant", () => {
  it("같은 anonId + 같은 실험은 언제나 같은 변형", () => {
    const first = assignVariant("user-1", exp("funny"));
    for (let i = 0; i < 10; i++) expect(assignVariant("user-1", exp("funny"))).toBe(first);
  });

  it("실험 id 가 다르면 배정이 따로 논다", () => {
    const ids = Array.from({ length: 200 }, (_, i) => `u${i}`);
    const same = ids.every((id) => assignVariant(id, exp("e1")) === assignVariant(id, exp("e2")));
    expect(same).toBe(false);
  });

  it("무작위 값 10,000개, 1:1 이면 각 변형이 4,800~5,200", () => {
    const rng = seededRng("assign");
    const counts: Record<string, number> = { a: 0, b: 0 };
    for (let i = 0; i < 10_000; i++) {
      const id = Math.floor(rng() * 2 ** 32).toString(16) + Math.floor(rng() * 2 ** 32).toString(16);
      counts[assignVariant(id, exp("funny"))!]!++;
    }
    expect(counts.a).toBeGreaterThanOrEqual(4800);
    expect(counts.a).toBeLessThanOrEqual(5200);
    expect(counts.b).toBeGreaterThanOrEqual(4800);
    expect(counts.b).toBeLessThanOrEqual(5200);
  });

  it("가중치 0 인 변형은 배정되지 않는다", () => {
    const e = exp("x", [{ name: "zero", weight: 0 }, { name: "one", weight: 1 }, { name: "neg", weight: -3 }, { name: "nan", weight: NaN }]);
    for (let i = 0; i < 500; i++) expect(assignVariant(`u${i}`, e)).toBe("one");
  });

  it("꺼져 있거나 변형이 비었거나 가중치 합이 0 이면 null", () => {
    expect(assignVariant("u", { ...exp("x"), enabled: false })).toBeNull();
    expect(assignVariant("u", exp("x", []))).toBeNull();
    expect(assignVariant("u", exp("x", [{ name: "a", weight: 0 }]))).toBeNull();
  });

  it.each([
    ["user-1", "funny", 2708227014, "b"],
    ["영크크-기기", "funny", 2485476913, "b"],
    ["device-abc123", "order", 1899015800, "a"],
  ])("골든: %s + %s 은 해시 %i, 변형 %s (anonId:expId 순서 고정)", (anonId, expId, hash, variant) => {
    expect(fnv1a32(anonId + ":" + expId)).toBe(hash);
    expect(assignVariant(anonId, exp(expId))).toBe(variant);
  });

  it.each([
    ["user-1", "funny", "b"],
    ["영크크-기기", "order", "b"],
  ])("골든 1:3: %s + %s 은 변형 %s", (anonId, expId, variant) => {
    expect(assignVariant(anonId, exp(expId, [{ name: "a", weight: 1 }, { name: "b", weight: 3 }]))).toBe(variant);
  });

  it("가중치 1:3 이면 20,000명 중 변형 비율이 25% / 75% ±2%p", () => {
    const e = exp("ratio", [{ name: "a", weight: 1 }, { name: "b", weight: 3 }]);
    let a = 0;
    for (let i = 0; i < 20_000; i++) if (assignVariant("u" + i, e) === "a") a++;
    expect(a / 20_000).toBeGreaterThanOrEqual(0.23);
    expect(a / 20_000).toBeLessThanOrEqual(0.27);
    expect(1 - a / 20_000).toBeGreaterThanOrEqual(0.73);
    expect(1 - a / 20_000).toBeLessThanOrEqual(0.77);
  });

  it("같은 사용자가 1:1 에서는 a, 1:3 에서는 b (가중치가 실제로 쓰인다)", () => {
    const even = exp("w", [{ name: "a", weight: 1 }, { name: "b", weight: 1 }]);
    const skewed = exp("w", [{ name: "a", weight: 1 }, { name: "b", weight: 3 }]);
    expect(assignVariant("pin5", even)).toBe("a");
    expect(assignVariant("pin5", skewed)).toBe("b");
  });

  it("가중치 0:1 이면 언제나 두 번째", () => {
    const e = exp("zero-one", [{ name: "a", weight: 0 }, { name: "b", weight: 1 }]);
    for (let i = 0; i < 1000; i++) expect(assignVariant("u" + i, e)).toBe("b");
  });
});
