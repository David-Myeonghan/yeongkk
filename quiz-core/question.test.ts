import { describe, expect, it } from "vitest";
import { makeQuestion } from "./question";
import { seededRng } from "./rng";
import type { Word } from "./types";

function word(i: number, extra: Partial<Word> = {}): Word {
  return { id: `w${i}`, word: `단어${i}`, meaning: `뜻${i}`, examples: [], addedAt: "2026-01-01", ...extra };
}

const pool = (n: number) => Array.from({ length: n }, (_, i) => word(i));

describe("makeQuestion — 문제 만들기", () => {
  it("meaning: prompt 는 단어, 보기 4개, 정답은 뜻", () => {
    const q = makeQuestion(word(0), pool(10), { kind: "meaning", rng: seededRng("a"), funnyWrong: false });
    expect(q.wordId).toBe("w0");
    expect(q.kind).toBe("meaning");
    expect(q.prompt).toBe("단어0");
    expect(q.choices).toHaveLength(4);
    expect(q.choices[q.answerIndex]).toBe("뜻0");
    expect(q.hasFunnyWrong).toBe(false);
  });

  it("word: prompt 는 뜻, 정답은 단어", () => {
    const q = makeQuestion(word(0), pool(10), { kind: "word", rng: seededRng("a"), funnyWrong: false });
    expect(q.prompt).toBe("뜻0");
    expect(q.choices).toHaveLength(4);
    expect(q.choices[q.answerIndex]).toBe("단어0");
  });

  it("보기는 서로 다르고 정답은 한 번만 나온다", () => {
    for (const seed of ["a", "b", "c", "d"]) {
      const q = makeQuestion(word(0), pool(10), { kind: "meaning", rng: seededRng(seed), funnyWrong: false });
      expect(new Set(q.choices).size).toBe(q.choices.length);
      expect(q.choices.filter((c) => c === "뜻0")).toHaveLength(1);
    }
  });

  it("같은 뜻을 가진 다른 단어가 있어도 보기가 겹치지 않는다", () => {
    const words = [word(0), word(1, { meaning: "뜻0" }), word(2, { meaning: "뜻2" }), word(3, { meaning: "뜻2" }), word(4)];
    for (const seed of ["a", "b", "c", "d"]) {
      const q = makeQuestion(words[0]!, words, { kind: "meaning", rng: seededRng(seed), funnyWrong: false });
      expect(new Set(q.choices).size).toBe(q.choices.length);
      expect(q.choices.filter((c) => c === "뜻0")).toHaveLength(1);
    }
  });

  it("정답 위치는 rng 가 정한다", () => {
    const positions = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h"].map(
        (seed) => makeQuestion(word(0), pool(10), { kind: "meaning", rng: seededRng(seed), funnyWrong: false }).answerIndex,
      ),
    );
    expect(positions.size).toBeGreaterThan(1);
  });

  it("funnyWrong true 면 오답 하나가 웃긴 문구", () => {
    const target = word(0, { funnyWrong: ["외계어 인사"] });
    const q = makeQuestion(target, pool(10), { kind: "meaning", rng: seededRng("a"), funnyWrong: true });
    expect(q.choices).toContain("외계어 인사");
    expect(q.hasFunnyWrong).toBe(true);
    expect(q.choices).toHaveLength(4);
    expect(q.choices[q.answerIndex]).toBe("뜻0");
  });

  it("funnyWrong false 면 쓰지 않는다", () => {
    const target = word(0, { funnyWrong: ["외계어 인사"] });
    const q = makeQuestion(target, pool(10), { kind: "meaning", rng: seededRng("a"), funnyWrong: false });
    expect(q.choices).not.toContain("외계어 인사");
    expect(q.hasFunnyWrong).toBe(false);
  });

  it("word 유형에서는 funnyWrong 을 쓰지 않는다", () => {
    const target = word(0, { funnyWrong: ["외계어 인사"] });
    const q = makeQuestion(target, pool(10), { kind: "word", rng: seededRng("a"), funnyWrong: true });
    expect(q.choices).not.toContain("외계어 인사");
    expect(q.hasFunnyWrong).toBe(false);
  });

  it("funnyWrong 이 정답과 같으면 쓰지 않고 보기는 겹치지 않는다", () => {
    const target = word(0, { funnyWrong: ["뜻0", "뜻1"] });
    const q = makeQuestion(target, pool(10), { kind: "meaning", rng: seededRng("a"), funnyWrong: true });
    expect(new Set(q.choices).size).toBe(q.choices.length);
    expect(q.choices.filter((c) => c === "뜻0")).toHaveLength(1);
    expect(q.choices).toContain("뜻1");
  });

  it("다른 단어가 3개 미만이면 보기를 줄이고 던지지 않는다", () => {
    const q = makeQuestion(word(0), [word(0), word(1)], { kind: "meaning", rng: seededRng("a"), funnyWrong: false });
    expect(q.choices).toHaveLength(2);
    expect(q.choices[q.answerIndex]).toBe("뜻0");
    const alone = makeQuestion(word(0), [], { kind: "word", rng: seededRng("a"), funnyWrong: false });
    expect(alone.choices).toEqual(["단어0"]);
    expect(alone.answerIndex).toBe(0);
  });
});
