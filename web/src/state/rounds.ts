import { isNew } from "@yk/quiz-core/round";
import type { EventName } from "@yk/quiz-core/events";
import type { Word } from "@yk/quiz-core/types";
import type { PropValue } from "../telemetry/queue";
import type { Progress } from "./progress";
import { roundDay } from "./session";

export interface RoundTrackerDeps {
  track: (name: EventName, props?: Record<string, PropValue>) => void;
}

export function createRoundTracker(deps: RoundTrackerDeps) {
  return {
    begin(input: { progress: Progress; words: Word[]; resumed: boolean }): void {
      const { progress, words, resumed } = input;
      const day = roundDay(progress);
      const ids = new Set(progress.wordIds);
      const newCount = words.filter((w) => ids.has(w.id) && isNew(w, day)).length;
      deps.track("round_start", { size: progress.wordIds.length, newCount, resumed });
    },
  };
}
