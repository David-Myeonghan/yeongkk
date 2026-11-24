import type { ShareData } from "@yk/bridge/share";
import { RESULT_COPY, resultTier } from "@yk/quiz-core/score";

export type ResultShareData = ShareData & { text: string };

export function shareDataFor(correct: number, total: number, origin: string): ResultShareData {
  return {
    title: "뭔말이야",
    text: `${correct}점 — ${RESULT_COPY["ko-KR"][resultTier(correct, total)]}`,
    ...(origin === "" || origin === "null" ? {} : { url: `${origin}/?r=${correct}` }),
  };
}
