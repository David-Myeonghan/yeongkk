import type { EventName } from "@yk/quiz-core/events";
import { isNew } from "@yk/quiz-core/round";
import type { Word } from "@yk/quiz-core/types";
import type { PropValue } from "../telemetry/queue";
import type { KeyValue, Progress } from "./progress";
import { roundDay } from "./session";
import { FUNNY_WRONG, loadRoundFlags, saveRoundFlags, type RoundFlags } from "./variants";

export interface RoundTrackerDeps {
  track: (name: EventName, props?: Record<string, PropValue>) => void;
  variantOf: (expId: string) => string | null;
  expose: (expId: string, variant: string) => void;
}

export function createRoundTracker(deps: RoundTrackerDeps) {
  const decide = (roundId: string): RoundFlags => {
    let variant: string | null;
    try {
      variant = deps.variantOf(FUNNY_WRONG);
    } catch {
      variant = null;
    }
    return { roundId, funnyWrong: variant !== "off", variant };
  };

  return {
    /** 판을 시작하거나 이어 풀 때. 웃긴 오답 여부는 새 판에서만 정해 저장하고, 이어 풀면 저장된 것을 쓴다. */
    begin(input: { store: KeyValue; progress: Progress; words: Word[]; resumed: boolean }): void {
      const { store, progress, words, resumed } = input;
      const { roundId } = progress;
      let flags = loadRoundFlags(store, roundId);
      if (!resumed) {
        flags = decide(roundId);
        saveRoundFlags(store, flags);
      }
      const day = roundDay(progress);
      const ids = new Set(progress.wordIds);
      const newCount = words.filter((w) => ids.has(w.id) && isNew(w, day)).length;
      deps.track("round_start", { size: progress.wordIds.length, newCount, resumed });
      if (flags?.variant) deps.expose(FUNNY_WRONG, flags.variant);
    },
  };
}
