import { describe, expect, it } from "vitest";
import { clearProgress, loadProgress, PROGRESS_KEY, saveProgress, type KeyValue, type Progress } from "./progress";

const HOUR = 3_600_000;
const T0 = Date.UTC(2026, 10, 23, 3, 0, 0);

function memory(): KeyValue & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: (k) => data.get(k) ?? null,
    set: (k, v) => void data.set(k, v),
    remove: (k) => void data.delete(k),
  };
}

const throwing: KeyValue = {
  get() {
    throw new Error("get");
  },
  set() {
    throw new Error("set");
  },
  remove() {
    throw new Error("remove");
  },
};

function sample(overrides: Partial<Progress> = {}): Progress {
  return {
    roundId: "r1",
    wordIds: ["a", "b", "c"],
    answers: [{ wordId: "a", choice: 2, correct: true }],
    startedAt: T0,
    ...overrides,
  };
}

describe("progress — 저장과 읽기", () => {
  it("저장 → 읽기 왕복", () => {
    const store = memory();
    saveProgress(store, sample());
    expect(store.data.has(PROGRESS_KEY)).toBe(true);
    expect(PROGRESS_KEY).toBe("yk.progress.v1");
    expect(loadProgress(store, T0 + HOUR)).toEqual(sample());
  });

  it("6시간 지나면 null, 바로 전까지는 그대로", () => {
    const store = memory();
    saveProgress(store, sample());
    expect(loadProgress(store, T0 + 6 * HOUR)).toEqual(sample());
    expect(loadProgress(store, T0 + 6 * HOUR + 1)).toBeNull();
  });

  it("아무것도 없으면 null", () => {
    expect(loadProgress(memory(), T0)).toBeNull();
  });

  it("깨진 JSON 은 던지지 않고 null", () => {
    const store = memory();
    store.set(PROGRESS_KEY, "{not json");
    expect(loadProgress(store, T0)).toBeNull();
  });

  it.each([
    ["null", null],
    ["배열", []],
    ["roundId 빈 문자열", { ...sample(), roundId: "" }],
    ["roundId 숫자", { ...sample(), roundId: 1 }],
    ["wordIds 없음", { ...sample(), wordIds: undefined }],
    ["wordIds 빈 배열", { ...sample(), wordIds: [], answers: [] }],
    ["wordIds 에 숫자", { ...sample(), wordIds: ["a", 2] }],
    ["answers 가 객체", { ...sample(), answers: {} }],
    ["answer.choice 음수", { ...sample(), answers: [{ wordId: "a", choice: -1, correct: true }] }],
    ["answer.choice 소수", { ...sample(), answers: [{ wordId: "a", choice: 1.5, correct: true }] }],
    ["answer.correct 문자열", { ...sample(), answers: [{ wordId: "a", choice: 0, correct: "yes" }] }],
    ["answer.wordId 순서 불일치", { ...sample(), answers: [{ wordId: "b", choice: 0, correct: true }] }],
    ["startedAt 문자열", { ...sample(), startedAt: "now" }],
    ["startedAt NaN 대신 null", { ...sample(), startedAt: null }],
    [
      "answers 가 wordIds 보다 길다",
      {
        ...sample({ wordIds: ["a"] }),
        answers: [
          { wordId: "a", choice: 0, correct: true },
          { wordId: "b", choice: 0, correct: true },
        ],
      },
    ],
  ])("모양이 틀리면 null: %s", (_name, value) => {
    const store = memory();
    store.set(PROGRESS_KEY, JSON.stringify(value));
    expect(loadProgress(store, T0)).toBeNull();
  });

  it("남는 필드는 버리고 돌려준다", () => {
    const store = memory();
    store.set(PROGRESS_KEY, JSON.stringify({ ...sample(), extra: 1 }));
    expect(loadProgress(store, T0)).toEqual(sample());
  });

  it("set 이 던지는 저장소에서도 saveProgress 는 던지지 않는다", () => {
    expect(() => saveProgress(throwing, sample())).not.toThrow();
  });

  it("get 이 던지면 loadProgress 는 null", () => {
    expect(loadProgress(throwing, T0)).toBeNull();
  });

  it("clearProgress 는 지우고, 던지는 저장소에서도 던지지 않는다", () => {
    const store = memory();
    saveProgress(store, sample());
    clearProgress(store);
    expect(loadProgress(store, T0)).toBeNull();
    expect(() => clearProgress(throwing)).not.toThrow();
  });
});
