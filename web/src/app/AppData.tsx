import type { RemoteConfig } from "@yk/quiz-core/config";
import type { Word } from "@yk/quiz-core/types";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { loadConfig } from "../data/loadConfig";
import { loadWords, type LoadWordsResult } from "../data/loadWords";
import type { KeyValue } from "../state/progress";
import { createStore } from "../state/storage";
import { visuallyHidden } from "./a11y.css";

export type FailReason = Extract<LoadWordsResult, { ok: false }>["reason"];

export type DataState =
  | { status: "loading" }
  | { status: "ready"; words: Word[]; config: RemoteConfig }
  | { status: "failed"; reason: FailReason };

export interface AppData {
  data: DataState;
  retry(): void;
  store: KeyValue;
  notice: string | null;
  setNotice(text: string | null): void;
  announce(text: string): void;
}

const AppDataContext = createContext<AppData | null>(null);

const LOCALE = "ko-KR";

export function AppDataProvider(props: { children: ReactNode; fetchFn?: typeof fetch; store?: KeyValue }) {
  const [fetchFn] = useState(() => props.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args)));
  const [store] = useState(() => props.store ?? createStore());
  const [data, setData] = useState<DataState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let live = true;
    void Promise.all([loadWords(fetchFn, LOCALE), loadConfig(fetchFn, LOCALE)]).then(([words, config]) => {
      if (!live) return;
      setData(words.ok ? { status: "ready", words: words.words, config } : { status: "failed", reason: words.reason });
    });
    return () => {
      live = false;
    };
  }, [fetchFn, attempt]);

  const retry = useCallback(() => {
    setData({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const announce = useCallback((text: string) => {
    setMessage((prev) => (prev === text ? `${text}\u00a0` : text));
  }, []);

  const value = useMemo(
    () => ({ data, retry, store, notice, setNotice, announce }),
    [data, retry, store, notice, announce],
  );

  return (
    <AppDataContext.Provider value={value}>
      {props.children}
      <div aria-live="polite" role="status" className={visuallyHidden}>
        {message}
      </div>
    </AppDataContext.Provider>
  );
}

export function useAppData(): AppData {
  const value = useContext(AppDataContext);
  if (!value) throw new Error("AppDataProvider 밖에서 useAppData 를 불렀어요");
  return value;
}
