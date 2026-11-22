import { DEFAULT_CONFIG, type RemoteConfig } from "@yk/quiz-core/config";
import { assignVariant, type Experiment } from "@yk/quiz-core/experiment";
import { describe, expect, it, vi } from "vitest";
import { createExperiments } from "./experiments";

const exp = (over: Partial<Experiment> = {}): Experiment => ({
  id: "funny-wrong",
  enabled: true,
  variants: [
    { name: "on", weight: 1 },
    { name: "off", weight: 1 },
  ],
  ...over,
});
const config = (experiments: Experiment[]): RemoteConfig => ({ ...DEFAULT_CONFIG, experiments });

function setup(cfg: RemoteConfig | null, anonId = "anon-12345678") {
  const track = vi.fn();
  const state = { cfg };
  const experiments = createExperiments({ getConfig: () => state.cfg, anonId: () => anonId, track });
  return { experiments, track, state };
}

describe("variantOf", () => {
  it("설정이 아직 안 왔으면 null", () => {
    expect(setup(null).experiments.variantOf("funny-wrong")).toBeNull();
  });

  it("설정에 실험이 없으면 null", () => {
    expect(setup(config([])).experiments.variantOf("funny-wrong")).toBeNull();
    expect(setup(config([exp({ id: "other" })])).experiments.variantOf("funny-wrong")).toBeNull();
  });

  it("꺼져 있으면 null", () => {
    expect(setup(config([exp({ enabled: false })])).experiments.variantOf("funny-wrong")).toBeNull();
  });

  it("켜져 있으면 anonId 로 배정한 변형", () => {
    const e = exp();
    expect(setup(config([e])).experiments.variantOf("funny-wrong")).toBe(assignVariant("anon-12345678", e));
  });

  it("같은 기기는 늘 같은 변형, 기기마다 둘 다 나온다", () => {
    const seen = new Set<string | null>();
    for (let i = 0; i < 40; i++) {
      const { experiments } = setup(config([exp()]), `device-${i}-abcdef`);
      const first = experiments.variantOf("funny-wrong");
      expect(experiments.variantOf("funny-wrong")).toBe(first);
      seen.add(first);
    }
    expect(seen).toEqual(new Set(["on", "off"]));
  });

  it("anonId 를 못 만들어 던져도 null", () => {
    const experiments = createExperiments({
      getConfig: () => config([exp()]),
      anonId: () => {
        throw new Error("boom");
      },
      track: () => {},
    });
    expect(experiments.variantOf("funny-wrong")).toBeNull();
  });
});

describe("expose", () => {
  it("실험마다 실행(페이지 로드)당 한 번만 experiment_exposure", () => {
    const { experiments, track } = setup(config([exp()]));
    experiments.expose("funny-wrong", "off");
    experiments.expose("funny-wrong", "off");
    experiments.expose("funny-wrong", "on");
    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith("experiment_exposure", { exp: "funny-wrong", variant: "off" });
    experiments.expose("other", "a");
    expect(track).toHaveBeenCalledTimes(2);
  });
});
