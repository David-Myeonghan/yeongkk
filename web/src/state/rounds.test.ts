import type { Word } from "@yk/quiz-core/types";
import { describe, expect, it, vi } from "vitest";
import type { Progress } from "./progress";
import type { KeyValue } from "./progress";
import { createRoundTracker } from "./rounds";

const store: KeyValue = { get: () => null, set: () => {}, remove: () => {} };

const word = (i: number, addedAt: string): Word => ({ id: `w${i}`, word: `단어${i}`, meaning: `뜻${i}`, examples: [], funnyWrong: [], addedAt });
const words = [word(1, "2026-11-22"), word(2, "2026-11-21"), word(3, "2026-01-01")];
const progress: Progress = { roundId: "r1", wordIds: ["w1", "w2", "w3"], answers: [], startedAt: Date.UTC(2026, 10, 23, 3) };

describe("createRoundTracker", () => {
  it("round_start 는 size · newCount · resumed 만 보낸다", () => {
    const track = vi.fn();
    const rounds = createRoundTracker({ track, variantOf: () => null, expose: () => {} });
    rounds.begin({ store, progress, words, resumed: false });
    rounds.begin({ store, progress, words, resumed: true });
    expect(track.mock.calls).toEqual([
      ["round_start", { size: 3, newCount: 2, resumed: false }],
      ["round_start", { size: 3, newCount: 2, resumed: true }],
    ]);
    expect(JSON.stringify(track.mock.calls)).not.toContain("단어");
  });
});
