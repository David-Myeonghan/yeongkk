import type { Word } from "@yk/quiz-core/types";
import { describe, expect, it } from "vitest";
import type { Progress } from "./progress";
import { answer, isFinished, parseIndex, questionAt, roundDay, routeFor, startRound } from "./session";

const TODAY = "2026-11-23";
const NOW = Date.UTC(2026, 10, 23, 3);
const OFF = { funnyWrong: false };

function word(i: number, addedAt = "2026-01-01"): Word {
  return {
    id: `w${i}`,
    word: `단어${i}`,
    meaning: `뜻${i}`,
    examples: [`예문${i}-1`, `예문${i}-2`],
    funnyWrong: [`엉뚱${i}`],
    addedAt,
  };
}

const words = (n: number) => Array.from({ length: n }, (_, i) => word(i, i < 4 ? "2026-11-20" : "2026-01-01"));

function answered(p: Progress, count: number): Progress {
  let next = p;
  for (let i = 0; i < count; i++) next = answer(next, i, 0, i % 2 === 0);
  return next;
}

describe("startRound", () => {
  it("10개 판, 답 없음, roundId·startedAt 그대로", () => {
    const p = startRound(words(20), { today: TODAY, roundId: "r1", now: NOW });
    expect(p.roundId).toBe("r1");
    expect(p.wordIds).toHaveLength(10);
    expect(new Set(p.wordIds).size).toBe(10);
    expect(p.answers).toEqual([]);
    expect(p.startedAt).toBe(NOW);
  });

  it("같은 roundId 면 같은 판", () => {
    const a = startRound(words(20), { today: TODAY, roundId: "same", now: NOW });
    const b = startRound(words(20), { today: TODAY, roundId: "same", now: NOW + 5 });
    expect(a.wordIds).toEqual(b.wordIds);
  });

  it("NEW 단어 3개가 들어간다", () => {
    const p = startRound(words(20), { today: TODAY, roundId: "r2", now: NOW });
    expect(p.wordIds.filter((id) => Number(id.slice(1)) < 4)).toHaveLength(3);
  });

  it("단어가 10개보다 적으면 그만큼 짧은 판", () => {
    const p = startRound(words(6), { today: TODAY, roundId: "r3", now: NOW });
    expect(p.wordIds).toHaveLength(6);
  });
});

describe("questionAt — 같은 판은 같은 문제", () => {
  const list = words(20);
  const p = startRound(list, { today: TODAY, roundId: "det", now: NOW });

  it("여러 번 불러도 종류·보기·정답이 같다", () => {
    for (let i = 0; i < p.wordIds.length; i++) {
      expect(questionAt(p, list, i, OFF)).toEqual(questionAt(p, list, i, OFF));
    }
  });

  it("저장 후 이어 풀면(JSON 왕복) 같은 보기", () => {
    const saved = answered(p, 4);
    const resumed = JSON.parse(JSON.stringify(saved)) as Progress;
    expect(questionAt(resumed, list, 4, OFF)).toEqual(questionAt(p, list, 4, OFF));
  });

  it("문제는 그 칸의 단어, 보기 4개", () => {
    const q = questionAt(p, list, 2, OFF);
    expect(q?.wordId).toBe(p.wordIds[2]);
    expect(q?.choices).toHaveLength(4);
  });

  it("두 종류가 모두 나온다(판 하나 안에서)", () => {
    const kinds = new Set(p.wordIds.map((_, i) => questionAt(p, list, i, OFF)?.kind));
    expect(kinds).toEqual(new Set(["meaning", "word"]));
  });

  it("roundId 가 다르면 같은 단어라도 보기가 달라질 수 있다", () => {
    const other: Progress = { ...p, roundId: "det-2" };
    const differs = p.wordIds.some((_, i) => {
      const a = questionAt(p, list, i, OFF);
      const b = questionAt(other, list, i, OFF);
      return a?.kind !== b?.kind || a?.choices.join() !== b?.choices.join();
    });
    expect(differs).toBe(true);
  });

  it("단어 목록에서 빠진 단어면 null", () => {
    const missing = list.filter((w) => w.id !== p.wordIds[3]);
    expect(questionAt(p, missing, 3, OFF)).toBeNull();
  });

  it("범위 밖 index 는 null", () => {
    expect(questionAt(p, list, -1, OFF)).toBeNull();
    expect(questionAt(p, list, p.wordIds.length, OFF)).toBeNull();
    expect(questionAt(p, list, 1.5, OFF)).toBeNull();
  });

  it("단어가 4개뿐이어도 보기 4개", () => {
    const four = words(4);
    const small = startRound(four, { today: TODAY, roundId: "small", now: NOW });
    expect(small.wordIds).toHaveLength(4);
    const q = questionAt(small, four, 0, OFF);
    expect(q?.choices).toHaveLength(4);
  });
});

describe("answer — 한 번만 기록", () => {
  const p = startRound(words(12), { today: TODAY, roundId: "ans", now: NOW });

  it("다음 칸이면 붙인다", () => {
    const next = answer(p, 0, 1, true);
    expect(next.answers).toEqual([{ wordId: p.wordIds[0], choice: 1, correct: true }]);
    expect(p.answers).toEqual([]);
  });

  it("두 번 누르기·지난 칸·건너뛴 칸은 무시하고 같은 progress", () => {
    const one = answer(p, 0, 1, true);
    expect(answer(one, 0, 2, false)).toBe(one);
    expect(answer(one, 2, 0, false)).toBe(one);
    expect(answer(one, -1, 0, false)).toBe(one);
  });

  it("끝난 판에는 더 붙지 않는다", () => {
    const done = answered(p, p.wordIds.length);
    expect(isFinished(done)).toBe(true);
    expect(answer(done, done.wordIds.length, 0, true)).toBe(done);
  });

  it("isFinished 는 답 수가 판 크기에 닿을 때", () => {
    expect(isFinished(p)).toBe(false);
    expect(isFinished(answered(p, p.wordIds.length - 1))).toBe(false);
  });
});

describe("parseIndex", () => {
  it.each([
    ["0", 0],
    ["9", 9],
    ["12", 12],
  ])("%s → %i", (raw, n) => expect(parseIndex(raw)).toBe(n));

  it.each([undefined, "", "-1", "1.5", "01", "abc", " 1", "1e1", "99999999999999999999"])("%s → null", (raw) =>
    expect(parseIndex(raw)).toBeNull(),
  );
});

describe("routeFor — 잘못된 화면은 맞는 화면으로", () => {
  const p = startRound(words(12), { today: TODAY, roundId: "route", now: NOW });
  const three = answered(p, 3);
  const done = answered(p, p.wordIds.length);

  it("progress 가 없으면 처음으로", () => {
    expect(routeFor(null, "Question", 0)).toEqual({ kind: "home" });
    expect(routeFor(null, "WordCard", 0)).toEqual({ kind: "home" });
    expect(routeFor(null, "Result", null)).toEqual({ kind: "home" });
  });

  it("Question: 다음 칸이면 보여 주고, 아니면 다음 칸으로", () => {
    expect(routeFor(three, "Question", 3)).toEqual({ kind: "show" });
    expect(routeFor(three, "Question", 1)).toEqual({ kind: "go", to: "Question", index: 3 });
    expect(routeFor(three, "Question", 7)).toEqual({ kind: "go", to: "Question", index: 3 });
    expect(routeFor(three, "Question", null)).toEqual({ kind: "go", to: "Question", index: 3 });
  });

  it("끝난 판의 Question 은 결과로", () => {
    expect(routeFor(done, "Question", 0)).toEqual({ kind: "go", to: "Result" });
  });

  it("WordCard: 답한 칸만 보여 주고, 아니면 다음 문제로", () => {
    expect(routeFor(three, "WordCard", 2)).toEqual({ kind: "show" });
    expect(routeFor(three, "WordCard", 0)).toEqual({ kind: "show" });
    expect(routeFor(three, "WordCard", 3)).toEqual({ kind: "go", to: "Question", index: 3 });
    expect(routeFor(three, "WordCard", null)).toEqual({ kind: "go", to: "Question", index: 3 });
    expect(routeFor(done, "WordCard", null)).toEqual({ kind: "go", to: "Result" });
  });

  it("Result: 끝난 판만", () => {
    expect(routeFor(done, "Result", null)).toEqual({ kind: "show" });
    expect(routeFor(three, "Result", null)).toEqual({ kind: "go", to: "Question", index: 3 });
  });
});

describe("roundDay — 판을 시작한 날(기기 시간대)", () => {
  const at = (iso: string): Progress => ({ roundId: "d", wordIds: ["w0"], answers: [], startedAt: Date.parse(iso) });

  it("서울 자정 직전·직후", () => {
    expect(roundDay(at("2026-11-23T14:59:59Z"))).toBe("2026-11-23");
    expect(roundDay(at("2026-11-23T15:00:00Z"))).toBe("2026-11-24");
  });

  it("자정을 넘겨 이어 풀어도 시작한 날 그대로", () => {
    const p = at("2026-11-23T14:50:00Z");
    expect(roundDay(answer(p, 0, 0, true))).toBe("2026-11-23");
  });
});
