import { describe, expect, it } from "vitest";
import { seededRng } from "./rng";
import { isNew, pickRound } from "./round";
import type { Word } from "./types";

const TODAY = "2026-12-08";

function word(i: number, addedAt: string, status?: "active" | "retired"): Word {
  return { id: `w${i}`, word: `단어${i}`, meaning: `뜻${i}`, examples: [], addedAt, ...(status ? { status } : {}) };
}

function thirty(): Word[] {
  const words: Word[] = [];
  for (let i = 0; i < 5; i++) words.push(word(i, "2026-12-05"));
  for (let i = 5; i < 28; i++) words.push(word(i, "2026-01-01"));
  words.push(word(28, "2026-01-01", "retired"), word(29, "2026-12-06", "retired"));
  return words;
}

const isNewWord = (w: Word) => w.addedAt >= "2026-12-01";

describe("pickRound — 판 구성", () => {
  it("10개, NEW 정확히 3개, 중복 0, retired 0", () => {
    const round = pickRound(thirty(), { today: TODAY, rng: seededRng("a") });
    expect(round).toHaveLength(10);
    expect(round.filter(isNewWord)).toHaveLength(3);
    expect(new Set(round.map((w) => w.id)).size).toBe(10);
    expect(round.filter((w) => w.status === "retired")).toHaveLength(0);
  });

  it("같은 seed 는 같은 판, 다른 seed 는 다른 판", () => {
    const ids = (seed: string) => pickRound(thirty(), { today: TODAY, rng: seededRng(seed) }).map((w) => w.id);
    expect(ids("a")).toEqual(ids("a"));
    expect(ids("a")).not.toEqual(ids("b"));
  });

  it("NEW 가 1개뿐이면 NEW 1개 + 나머지 9개", () => {
    const words = [word(0, "2026-12-07"), ...Array.from({ length: 20 }, (_, i) => word(i + 1, "2026-01-01"))];
    const round = pickRound(words, { today: TODAY, rng: seededRng("x") });
    expect(round).toHaveLength(10);
    expect(round.filter((w) => w.id === "w0")).toHaveLength(1);
  });

  it("단어 6개는 6개짜리 판, 0개는 빈 판", () => {
    const six = Array.from({ length: 6 }, (_, i) => word(i, i < 2 ? "2026-12-07" : "2026-01-01"));
    expect(pickRound(six, { today: TODAY, rng: seededRng("x") })).toHaveLength(6);
    expect(pickRound([], { today: TODAY, rng: seededRng("x") })).toEqual([]);
  });

  it("NEW 가 3개 넘게 있어도 NEW 만 있는 창고는 던지지 않고 있는 만큼 채운다", () => {
    const words = Array.from({ length: 8 }, (_, i) => word(i, "2026-12-07"));
    const round = pickRound(words, { today: TODAY, rng: seededRng("x") });
    expect(round).toHaveLength(8);
    expect(new Set(round.map((w) => w.id)).size).toBe(8);
  });

  it("7일 이내만 NEW: 12-01 은 NEW, 11-30 은 아님", () => {
    const words = [
      ...Array.from({ length: 5 }, (_, i) => word(i, "2026-12-01")),
      ...Array.from({ length: 5 }, (_, i) => word(i + 5, "2026-11-30")),
      ...Array.from({ length: 20 }, (_, i) => word(i + 10, "2026-01-01")),
    ];
    for (const seed of ["a", "b", "c", "d", "e", "f"]) {
      const round = pickRound(words, { today: TODAY, rng: seededRng(seed) });
      expect(round.filter((w) => w.addedAt === "2026-12-01")).toHaveLength(3);
    }
  });

  it("잘못된 addedAt 은 NEW 가 아니고 던지지 않는다", () => {
    const words = [word(0, "어제"), word(1, "2026-13-45"), word(2, "2026-12-07")];
    const round = pickRound(words, { today: TODAY, rng: seededRng("x"), size: 3, newCount: 3 });
    expect(round).toHaveLength(3);
    const one = pickRound(words, { today: TODAY, rng: seededRng("x"), size: 1, newCount: 1 });
    expect(one.map((w) => w.id)).toEqual(["w2"]);
  });

  it("입력 배열을 바꾸지 않는다", () => {
    const words = thirty();
    const ids = words.map((w) => w.id);
    pickRound(words, { today: TODAY, rng: seededRng("a") });
    expect(words.map((w) => w.id)).toEqual(ids);
  });

  it("경계 직접 확인: 11-30 과 12-01 중 size 1, newCount 1 이면 12-01", () => {
    const words = [word(0, "2026-11-30"), word(1, "2026-12-01")];
    const round = pickRound(words, { today: TODAY, rng: seededRng("x"), size: 1, newCount: 1 });
    expect(round.map((w) => w.id)).toEqual(["w1"]);
  });

  it("미래 addedAt 은 NEW 가 아니다", () => {
    const words = [word(0, "2026-12-09"), word(1, "2026-12-08")];
    const round = pickRound(words, { today: TODAY, rng: seededRng("x"), size: 1, newCount: 1 });
    expect(round.map((w) => w.id)).toEqual(["w1"]);
  });

  it("today 가 잘못돼도 던지지 않는다", () => {
    const words = [word(0, "2026-12-07"), word(1, "2026-01-01")];
    expect(pickRound(words, { today: "오늘", rng: seededRng("x") })).toHaveLength(2);
  });

  it("NEW 0개에 12개면 서로 다른 10개", () => {
    const words = Array.from({ length: 12 }, (_, i) => word(i, "2026-01-01"));
    const round = pickRound(words, { today: TODAY, rng: seededRng("x") });
    expect(new Set(round.map((w) => w.id)).size).toBe(10);
  });

  it("id 가 겹치는 입력은 한 번만 쓴다", () => {
    const words = [...Array.from({ length: 6 }, (_, i) => word(i, "2026-01-01")), ...Array.from({ length: 6 }, (_, i) => word(i, "2026-01-01"))];
    const round = pickRound(words, { today: TODAY, rng: seededRng("x") });
    expect(round).toHaveLength(6);
    expect(new Set(round.map((w) => w.id)).size).toBe(6);
  });
});

describe("isNew — 최근 추가 단어", () => {
  it("기본 7일: 오늘·7일 전은 NEW, 8일 전·미래는 아님", () => {
    expect(isNew(word(0, "2026-12-08"), TODAY)).toBe(true);
    expect(isNew(word(0, "2026-12-01"), TODAY)).toBe(true);
    expect(isNew(word(0, "2026-11-30"), TODAY)).toBe(false);
    expect(isNew(word(0, "2026-12-09"), TODAY)).toBe(false);
  });

  it("withinDays 를 바꿀 수 있다", () => {
    expect(isNew(word(0, "2026-12-06"), TODAY, 1)).toBe(false);
    expect(isNew(word(0, "2026-12-07"), TODAY, 1)).toBe(true);
  });

  it("날짜가 잘못되면 던지지 않고 false", () => {
    expect(isNew(word(0, "어제"), TODAY)).toBe(false);
    expect(isNew(word(0, "2026-12-08"), "2026-02-30")).toBe(false);
  });
});
