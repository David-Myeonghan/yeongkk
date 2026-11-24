import type { RemoteConfig } from "@yk/quiz-core/config";
import type { EventName } from "@yk/quiz-core/events";
import { assignVariant } from "@yk/quiz-core/experiment";
import type { PropValue } from "./telemetry/queue";

export interface ExperimentsDeps {
  getConfig: () => RemoteConfig | null;
  anonId: () => string;
  track: (name: EventName, props?: Record<string, PropValue>) => void;
}

export function createExperiments(deps: ExperimentsDeps) {
  const exposed = new Set<string>();

  return {
    /** 설정에 없거나 꺼져 있거나 설정이 아직 안 왔으면 null. */
    variantOf(expId: string): string | null {
      try {
        const exp = deps.getConfig()?.experiments.find((e) => e.id === expId);
        return exp ? assignVariant(deps.anonId(), exp) : null;
      } catch {
        return null;
      }
    },
    /** 실험마다 이 페이지를 연 동안 한 번만 알린다. */
    expose(expId: string, variant: string): void {
      if (exposed.has(expId)) return;
      exposed.add(expId);
      deps.track("experiment_exposure", { exp: expId, variant });
    },
  };
}
