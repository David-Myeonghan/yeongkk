export function score(answers: { correct: boolean }[]): { correct: number; total: number } {
  return { correct: answers.filter((a) => a.correct).length, total: answers.length };
}

// 10문제 기준 경계: 0~2, 3~4, 5~6, 7~9, 10
const TIER_FLOORS = [0.3, 0.5, 0.7, 1] as const;

export function resultTier(correct: number, total: number): 0 | 1 | 2 | 3 | 4 {
  if (total <= 0) return 0;
  const ratio = correct / total;
  if (ratio >= TIER_FLOORS[3]) return 4;
  if (ratio >= TIER_FLOORS[2]) return 3;
  if (ratio >= TIER_FLOORS[1]) return 2;
  if (ratio >= TIER_FLOORS[0]) return 1;
  return 0;
}

export const RESULT_COPY: Record<"ko-KR", [string, string, string, string, string]> = {
  "ko-KR": [
    // 임시 문구 — David 확정 전
    "요즘 말이 외국어",
    "회식 2차 가실 분",
    // 임시 문구 — David 확정 전
    "반은 알아듣는 중",
    // 임시 문구 — David 확정 전
    "거의 영크크",
    "이미 영크크",
  ],
};
