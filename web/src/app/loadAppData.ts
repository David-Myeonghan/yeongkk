import { DEFAULT_CONFIG, type RemoteConfig } from "@yk/quiz-core/config";
import { loadConfig } from "../data/loadConfig";
import { loadWords, type LoadWordsResult } from "../data/loadWords";

export const WORDS_TIMEOUT_MS = 8000;
export const CONFIG_TIMEOUT_MS = 3000;

export interface TimerPair {
  set(fn: () => void, ms: number): unknown;
  clear(id: unknown): void;
}

export interface LoadHandlers {
  /** 판마다 한 번: 단어 결과 또는 8초 시간 초과(network). */
  words(result: LoadWordsResult): void;
  /** 3초 안에 안 오면 기본 설정, 그 뒤 진짜 설정이 오면 한 번 더. */
  config(config: RemoteConfig): void;
}

/** 단어와 설정을 따로 받는다. 설정은 단어를 기다리게 하지 않는다. 돌려준 함수로 취소. */
export function loadAppData(fetchFn: typeof fetch, locale: string, timers: TimerPair, on: LoadHandlers): () => void {
  let live = true;
  let wordsDone = false;
  let configDone = false;
  const abort = typeof AbortController === "function" ? new AbortController() : null;

  const finishWords = (result: LoadWordsResult) => {
    if (!live || wordsDone) return;
    wordsDone = true;
    timers.clear(wordsTimer);
    on.words(result);
  };
  const wordsTimer = timers.set(() => {
    finishWords({ ok: false, reason: "network" });
    abort?.abort();
  }, WORDS_TIMEOUT_MS);
  void loadWords(fetchFn, locale, abort?.signal).then(finishWords);

  const configTimer = timers.set(() => {
    if (!live || configDone) return;
    on.config(structuredClone(DEFAULT_CONFIG));
  }, CONFIG_TIMEOUT_MS);
  void loadConfig(fetchFn, locale).then((config) => {
    if (!live) return;
    configDone = true;
    timers.clear(configTimer);
    on.config(config);
  });

  return () => {
    live = false;
    timers.clear(wordsTimer);
    timers.clear(configTimer);
    abort?.abort();
  };
}
