import { DEFAULT_CONFIG, type RemoteConfig } from "@yk/quiz-core/config";
import type { Experiment } from "@yk/quiz-core/experiment";
import type { Word } from "@yk/quiz-core/types";
import { describe, expect, it, vi } from "vitest";
import { createExperiments } from "../experiments";
import type { Progress, KeyValue } from "./progress";
import { createRoundTracker } from "./rounds";
import { funnyWrongOn, roundExperimentProps, ROUND_FLAGS_KEY } from "./variants";

const memoryStore = (): KeyValue & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, get: (k) => data.get(k) ?? null, set: (k, v) => void data.set(k, v), remove: (k) => void data.delete(k) };
};

const word = (i: number, addedAt: string): Word => ({ id: `w${i}`, word: `단어${i}`, meaning: `뜻${i}`, examples: [], funnyWrong: [], addedAt });
const words = [word(1, "2026-11-22"), word(2, "2026-11-21"), word(3, "2026-01-01")];
const progress = (roundId: string): Progress => ({
  roundId,
  wordIds: ["w1", "w2", "w3"],
  answers: [],
  startedAt: Date.UTC(2026, 10, 23, 3),
});

const only = (variant: "on" | "off" | "split", enabled = true): RemoteConfig => ({
  ...DEFAULT_CONFIG,
  experiments: [
    {
      id: "funny-wrong",
      enabled,
      variants:
        variant === "split"
          ? [
              { name: "on", weight: 1 },
              { name: "off", weight: 1 },
            ]
          : [{ name: variant, weight: 1 }],
    } satisfies Experiment,
  ],
});

function setup(initial: RemoteConfig | null) {
  const state = { cfg: initial };
  const track = vi.fn();
  const experiments = createExperiments({ getConfig: () => state.cfg, anonId: () => "anon-12345678", track });
  const rounds = createRoundTracker({ ...experiments, track });
  const store = memoryStore();
  const begin = (roundId: string, resumed = false) => rounds.begin({ store, progress: progress(roundId), words, resumed });
  const names = () => track.mock.calls.map((c) => c[0]);
  return { state, store, begin, track, names };
}

describe("funnyWrongOn", () => {
  it("저장된 깃발이 없으면 켜짐", () => {
    expect(funnyWrongOn(memoryStore(), "r1")).toBe(true);
  });

  it("저장소가 던져도 켜짐", () => {
    const boom = () => {
      throw new Error("x");
    };
    expect(funnyWrongOn({ get: boom, set: boom, remove: boom }, "r1")).toBe(true);
  });

  it("다른 판의 깃발은 읽지 않는다", () => {
    const { store, state, begin } = setup(only("off"));
    state.cfg = only("off");
    begin("r1");
    expect(funnyWrongOn(store, "r1")).toBe(false);
    expect(funnyWrongOn(store, "r2")).toBe(true);
  });

  it("깨진 저장값은 켜짐", () => {
    const store = memoryStore();
    store.data.set(ROUND_FLAGS_KEY, "{not json");
    expect(funnyWrongOn(store, "r1")).toBe(true);
    store.data.set(ROUND_FLAGS_KEY, JSON.stringify({ roundId: "r1", funnyWrong: "no" }));
    expect(funnyWrongOn(store, "r1")).toBe(true);
  });
});

describe("판이 시작될 때 웃긴 오답 여부를 한 번 정한다", () => {
  it("off 로 배정되면 그 판은 꺼짐, on 이면 켜짐", () => {
    const off = setup(only("off"));
    off.begin("r1");
    expect(funnyWrongOn(off.store, "r1")).toBe(false);
    const on = setup(only("on"));
    on.begin("r1");
    expect(funnyWrongOn(on.store, "r1")).toBe(true);
  });

  it("실험이 없거나 꺼져 있거나 설정이 아직이면 켜짐(기본 동작)", () => {
    for (const cfg of [null, only("off", false), { ...DEFAULT_CONFIG }]) {
      const s = setup(cfg);
      s.begin("r1");
      expect(funnyWrongOn(s.store, "r1")).toBe(true);
    }
  });

  it("판 도중 설정이 와도 그 판의 깃발은 그대로, 다음 판은 새 설정을 따른다", () => {
    const s = setup(null);
    s.begin("r1");
    expect(funnyWrongOn(s.store, "r1")).toBe(true);
    s.state.cfg = only("off");
    expect(funnyWrongOn(s.store, "r1")).toBe(true);
    s.begin("r2");
    expect(funnyWrongOn(s.store, "r2")).toBe(false);
  });

  it("이어 푸는 판은 저장된 깃발을 유지한다(설정이 바뀌었어도)", () => {
    const s = setup(only("off"));
    s.begin("r1");
    s.state.cfg = only("on");
    s.begin("r1", true);
    expect(funnyWrongOn(s.store, "r1")).toBe(false);
  });

  it("깃발이 없는 옛 판을 이어 풀면 새로 정하지 않고 켜짐, 노출도 없다", () => {
    const s = setup(only("off"));
    s.begin("old", true);
    expect(s.store.data.has(ROUND_FLAGS_KEY)).toBe(false);
    expect(funnyWrongOn(s.store, "old")).toBe(true);
    expect(s.names()).toEqual(["round_start"]);
  });
});

describe("이벤트", () => {
  it("round_start 는 판마다 size · newCount · resumed", () => {
    const s = setup(null);
    s.begin("r1");
    s.begin("r1", true);
    expect(s.track.mock.calls.filter((c) => c[0] === "round_start").map((c) => c[1])).toEqual([
      { size: 3, newCount: 2, resumed: false },
      { size: 3, newCount: 2, resumed: true },
    ]);
  });

  it("실험이 꺼져 있으면 experiment_exposure 가 없다", () => {
    const s = setup(only("off", false));
    s.begin("r1");
    expect(s.names()).not.toContain("experiment_exposure");
  });

  it("설정이 아직 없어도 노출은 없다", () => {
    const s = setup(null);
    s.begin("r1");
    expect(s.names()).not.toContain("experiment_exposure");
  });

  it("한 번 실행에서 판이 두 번이어도 노출은 한 번, 배정된 변형으로", () => {
    const s = setup(only("on"));
    s.begin("r1");
    s.begin("r2");
    const exposures = s.track.mock.calls.filter((c) => c[0] === "experiment_exposure");
    expect(exposures).toEqual([["experiment_exposure", { exp: "funny-wrong", variant: "on" }]]);
  });

  it("깃발에 variant 가 저장돼, 이어 풀기에서도 같은 변형으로 노출한다", () => {
    const s = setup(only("off"));
    s.begin("r1");
    const stored = JSON.parse(s.store.data.get(ROUND_FLAGS_KEY)!);
    expect(stored).toEqual({ roundId: "r1", funnyWrong: false, variant: "off" });
  });

  it("단어 글자는 이벤트 속성에 없다", () => {
    const s = setup(only("on"));
    s.begin("r1");
    expect(JSON.stringify(s.track.mock.calls)).not.toContain("단어");
  });
});

describe("roundExperimentProps", () => {
  it("배정된 변형이 있는 판은 exp 와 variant 를 돌려준다", () => {
    const store = memoryStore();
    store.set(ROUND_FLAGS_KEY, JSON.stringify({ roundId: "r1", funnyWrong: false, variant: "off" }));
    expect(roundExperimentProps(store, "r1")).toEqual({ exp: "funny-wrong", variant: "off" });
  });

  it("저장된 값이 없거나 변형이 null 이거나 다른 판이면 빈 객체", () => {
    const store = memoryStore();
    expect(roundExperimentProps(store, "r1")).toEqual({});
    store.set(ROUND_FLAGS_KEY, JSON.stringify({ roundId: "r1", funnyWrong: true, variant: null }));
    expect(roundExperimentProps(store, "r1")).toEqual({});
    store.set(ROUND_FLAGS_KEY, JSON.stringify({ roundId: "r1", funnyWrong: true, variant: "on" }));
    expect(roundExperimentProps(store, "r2")).toEqual({});
  });
});
