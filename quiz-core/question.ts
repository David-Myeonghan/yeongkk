import { match } from "ts-pattern";
import { shuffled, type Rng } from "./rng";
import type { Word } from "./types";

export type QuestionKind = "meaning" | "word";

export interface Question {
  wordId: string;
  kind: QuestionKind;
  prompt: string;
  choices: string[];
  answerIndex: number;
  hasFunnyWrong: boolean;
}

export interface QuestionOptions {
  kind: QuestionKind;
  rng: Rng;
  funnyWrong: boolean;
}

const CHOICE_COUNT = 4;

export function makeQuestion(target: Word, pool: Word[], opts: QuestionOptions): Question {
  const { kind, rng } = opts;
  const { prompt, answer, textOf, promptOf } = match(kind)
    .with("meaning", () => ({
      prompt: target.word,
      answer: target.meaning,
      textOf: (w: Word) => w.meaning,
      promptOf: (w: Word) => w.word,
    }))
    .with("word", () => ({
      prompt: target.meaning,
      answer: target.word,
      textOf: (w: Word) => w.word,
      promptOf: (w: Word) => w.meaning,
    }))
    .exhaustive();

  const taken = new Set<string>([answer]);
  const wrong: string[] = [];
  const addWrong = (text: string): boolean => {
    if (taken.has(text) || wrong.length >= CHOICE_COUNT - 1) return false;
    taken.add(text);
    wrong.push(text);
    return true;
  };

  let hasFunnyWrong = false;
  if (opts.funnyWrong && kind === "meaning") {
    for (const funny of shuffled(target.funnyWrong ?? [], rng)) {
      if (addWrong(funny)) {
        hasFunnyWrong = true;
        break;
      }
    }
  }

  for (const other of shuffled(
    pool.filter((w) => w.id !== target.id && promptOf(w) !== prompt),
    rng,
  )) {
    addWrong(textOf(other));
  }

  const choices = shuffled([answer, ...wrong], rng);
  return { wordId: target.id, kind, prompt, choices, answerIndex: choices.indexOf(answer), hasFunnyWrong };
}
