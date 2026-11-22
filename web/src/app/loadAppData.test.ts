import { DEFAULT_CONFIG, type RemoteConfig } from "@yk/quiz-core/config";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LoadWordsResult } from "../data/loadWords";
import { CONFIG_TIMEOUT_MS, loadAppData, WORDS_TIMEOUT_MS } from "./loadAppData";

const WORDS = JSON.stringify({
  words: [{ id: "a", word: "갓생", meaning: "부지런한 삶", examples: ["x", "y"], addedAt: "2026-11-20" }],
});
const CONFIG = JSON.stringify({ version: 7, features: { report: true, ask: true, ads: false }, experiments: [], api: "/api" });

type Gate = { resolve(body: string): void; signal: AbortSignal | undefined };

function controlledFetch() {
  const gates = new Map<string, Gate>();
  const fetchFn = vi.fn<typeof fetch>((input, init) => {
    const url = String(input);
    return new Promise<Response>((resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
      gates.set(url.includes("words") ? "words" : "config", {
        resolve: (body) => resolve(new Response(body, { status: 200 })),
        signal: init?.signal ?? undefined,
      });
    });
  });
  return { fetchFn, gate: (name: "words" | "config") => gates.get(name)! };
}

const timers = { set: (fn: () => void, ms: number) => setTimeout(fn, ms), clear: (id: unknown) => clearTimeout(id as number) };

function start(fetchFn: typeof fetch) {
  const words: LoadWordsResult[] = [];
  const configs: RemoteConfig[] = [];
  const cancel = loadAppData(fetchFn, "ko-KR", timers, { words: (r) => words.push(r), config: (c) => configs.push(c) });
  return { words, configs, cancel };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("loadAppData — 설정은 퀴즈를 막지 않는다", () => {
  it("단어가 오면 설정을 기다리지 않고 바로 알린다", async () => {
    const { fetchFn, gate } = controlledFetch();
    const run = start(fetchFn);
    gate("words").resolve(WORDS);
    await vi.advanceTimersByTimeAsync(0);
    expect(run.words).toHaveLength(1);
    expect(run.words[0]!.ok).toBe(true);
    expect(run.configs).toEqual([]);
  });

  it("설정이 3초 안에 안 오면 기본 설정, 늦게 오면 그때 덮어쓴다", async () => {
    const { fetchFn, gate } = controlledFetch();
    const run = start(fetchFn);
    await vi.advanceTimersByTimeAsync(CONFIG_TIMEOUT_MS - 1);
    expect(run.configs).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(run.configs).toEqual([DEFAULT_CONFIG]);
    expect(run.configs[0]).not.toBe(DEFAULT_CONFIG);
    gate("config").resolve(CONFIG);
    await vi.advanceTimersByTimeAsync(0);
    expect(run.configs).toHaveLength(2);
    expect(run.configs[1]!.version).toBe(7);
  });

  it("설정이 제때 오면 기본 설정은 보내지 않는다", async () => {
    const { fetchFn, gate } = controlledFetch();
    const run = start(fetchFn);
    gate("config").resolve(CONFIG);
    await vi.advanceTimersByTimeAsync(CONFIG_TIMEOUT_MS * 2);
    expect(run.configs.map((c) => c.version)).toEqual([7]);
  });

  it("단어가 8초 안에 안 오면 network 실패, 요청은 취소, 늦은 답은 무시", async () => {
    const { fetchFn, gate } = controlledFetch();
    const run = start(fetchFn);
    await vi.advanceTimersByTimeAsync(WORDS_TIMEOUT_MS - 1);
    expect(run.words).toEqual([]);
    await vi.advanceTimersByTimeAsync(1);
    expect(run.words).toEqual([{ ok: false, reason: "network" }]);
    expect(gate("words").signal?.aborted).toBe(true);
    gate("words").resolve(WORDS);
    await vi.advanceTimersByTimeAsync(0);
    expect(run.words).toHaveLength(1);
  });

  it("signal 을 무시하는 fetch 여도 8초면 실패를 알린다", async () => {
    const fetchFn = vi.fn<typeof fetch>(() => new Promise<Response>(() => {}));
    const run = start(fetchFn);
    await vi.advanceTimersByTimeAsync(WORDS_TIMEOUT_MS);
    expect(run.words).toEqual([{ ok: false, reason: "network" }]);
  });

  it("시간 초과 뒤 다시 부르면 새로 받는다", async () => {
    const first = controlledFetch();
    const failed = start(first.fetchFn);
    await vi.advanceTimersByTimeAsync(WORDS_TIMEOUT_MS);
    expect(failed.words).toEqual([{ ok: false, reason: "network" }]);
    const second = controlledFetch();
    const retried = start(second.fetchFn);
    second.gate("words").resolve(WORDS);
    await vi.advanceTimersByTimeAsync(0);
    expect(retried.words[0]!.ok).toBe(true);
  });

  it("취소하면 아무것도 알리지 않고 타이머도 남기지 않는다", async () => {
    const { fetchFn, gate } = controlledFetch();
    const run = start(fetchFn);
    run.cancel();
    expect(gate("words").signal?.aborted).toBe(true);
    gate("words").resolve(WORDS);
    gate("config").resolve(CONFIG);
    await vi.advanceTimersByTimeAsync(WORDS_TIMEOUT_MS * 2);
    expect(run.words).toEqual([]);
    expect(run.configs).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  });
});
