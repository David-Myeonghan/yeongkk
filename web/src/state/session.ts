import { makeQuestion, type Question } from "@yk/quiz-core/question";
import { seededRng } from "@yk/quiz-core/rng";
import { pickRound } from "@yk/quiz-core/round";
import type { Word } from "@yk/quiz-core/types";
import type { Progress } from "./progress";

export function startRound(words: Word[], opts: { today: string; roundId: string; now?: number }): Progress {
  const picked = pickRound(words, { today: opts.today, rng: seededRng(opts.roundId) });
  return { roundId: opts.roundId, wordIds: picked.map((w) => w.id), answers: [], startedAt: opts.now ?? Date.now() };
}

export function questionAt(
  progress: Progress,
  words: Word[],
  index: number,
  opts: { funnyWrong: boolean },
): Question | null {
  if (!Number.isInteger(index) || index < 0 || index >= progress.wordIds.length) return null;
  const target = words.find((w) => w.id === progress.wordIds[index]);
  if (!target) return null;
  const rng = seededRng(`${progress.roundId}:${index}`);
  const kind = rng() < 0.5 ? "meaning" : "word";
  return makeQuestion(target, words, { kind, rng, funnyWrong: opts.funnyWrong });
}

export function answer(progress: Progress, index: number, choice: number, correct: boolean): Progress {
  if (index !== progress.answers.length || index >= progress.wordIds.length) return progress;
  const wordId = progress.wordIds[index]!;
  return { ...progress, answers: [...progress.answers, { wordId, choice, correct }] };
}

export function isFinished(progress: Progress): boolean {
  return progress.answers.length >= progress.wordIds.length;
}

export function parseIndex(raw: string | undefined): number | null {
  if (raw === undefined || !/^(0|[1-9]\d{0,5})$/.test(raw)) return null;
  return Number(raw);
}

export type QuizScreen = "Question" | "WordCard" | "Result";

export type Route =
  | { kind: "show" }
  | { kind: "home" }
  | { kind: "go"; to: "Question"; index: number }
  | { kind: "go"; to: "Result" };

export function routeFor(progress: Progress | null, screen: QuizScreen, index: number | null): Route {
  if (progress === null) return { kind: "home" };
  const next = progress.answers.length;
  const onward: Route = isFinished(progress) ? { kind: "go", to: "Result" } : { kind: "go", to: "Question", index: next };
  if (screen === "Result") return isFinished(progress) ? { kind: "show" } : onward;
  if (screen === "WordCard") return index !== null && index < next ? { kind: "show" } : onward;
  return index === next && !isFinished(progress) ? { kind: "show" } : onward;
}
