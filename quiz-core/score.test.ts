import { describe, expect, it } from "vitest";
import { RESULT_COPY, resultTier, score } from "./score";

describe("score", () => {
  it("맞은 수와 전체 수를 센다", () => {
    expect(score([{ correct: true }, { correct: false }, { correct: true }])).toEqual({ correct: 2, total: 3 });
    expect(score([])).toEqual({ correct: 0, total: 0 });
  });
});

describe("resultTier — 10문제 기준", () => {
  it.each([
    [0, 0],
    [2, 0],
    [3, 1],
    [4, 1],
    [5, 2],
    [6, 2],
    [7, 3],
    [9, 3],
    [10, 4],
  ] as const)("%i 점 → 점수대 %i", (correct, tier) => {
    expect(resultTier(correct, 10)).toBe(tier);
  });

  it("10문제가 아니면 비율로 같은 점수대", () => {
    expect(resultTier(6, 6)).toBe(4);
    expect(resultTier(0, 6)).toBe(0);
    expect(resultTier(3, 6)).toBe(2);
  });

  it("total 이 0 이면 0점대, 던지지 않는다", () => {
    expect(resultTier(0, 0)).toBe(0);
  });
});

describe("RESULT_COPY", () => {
  it("정해진 문구", () => {
    expect(RESULT_COPY["ko-KR"][4]).toBe("이미 영크크");
    expect(RESULT_COPY["ko-KR"][1]).toBe("회식 2차 가실 분");
  });

  it("다섯 문구 모두 빈 글이 아니다", () => {
    expect(RESULT_COPY["ko-KR"]).toHaveLength(5);
    for (const line of RESULT_COPY["ko-KR"]) expect(line.trim()).not.toBe("");
  });
});
