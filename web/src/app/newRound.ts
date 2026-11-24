import type { Word } from "@yk/quiz-core/types";
import { newRoundId } from "../state/ids";
import { saveProgress, type KeyValue } from "../state/progress";
import { startRound } from "../state/session";
import { localDate } from "../state/today";
import { rounds } from "./services";

export function beginNewRound(store: KeyValue, words: Word[]): void {
  const now = Date.now();
  const progress = startRound(words, { today: localDate(new Date(now)), roundId: newRoundId(), now });
  saveProgress(store, progress);
  rounds.begin({ store, progress, words, resumed: false });
}
