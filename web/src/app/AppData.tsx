import { DEFAULT_CONFIG, type RemoteConfig } from "@yk/quiz-core/config";
import type { Word } from "@yk/quiz-core/types";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { LoadWordsResult } from "../data/loadWords";
import type { KeyValue } from "../state/progress";
import { visuallyHidden } from "./a11y.css";
import { setLiveConfig } from "./liveConfig";
import { loadAppData, type TimerPair } from "./loadAppData";
import { appStore } from "./services";

export type FailReason = Extract<LoadWordsResult, { ok: false }>["reason"];

export type DataState =
  | { status: "loading" }
  | { status: "ready"; words: Word[] }
  | { status: "failed"; reason: FailReason };

export interface AppData {
  data: DataState;
  /** 기본값으로 시작해 받은 설정으로 바뀐다. 바뀌어도 data 는 그대로. */
  config: RemoteConfig;
  retry(): void;
  store: KeyValue;
  notice: string | null;
  /** 처음 화면 한 줄 안내. 화면에 보이고 live region 으로도 읽힌다. */
  setNotice(text: string | null): void;
  announce(text: string): void;
}

const AppDataContext = createContext<AppData | null>(null);

const LOCALE = "ko-KR";
const browserTimers: TimerPair = {
  set: (fn, ms) => setTimeout(fn, ms),
  clear: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
};

export function AppDataProvider(props: { children: ReactNode; fetchFn?: typeof fetch; store?: KeyValue }) {
  const [fetchFn] = useState(() => props.fetchFn ?? ((...args: Parameters<typeof fetch>) => fetch(...args)));
  const [store] = useState(() => props.store ?? appStore);
  const [data, setData] = useState<DataState>({ status: "loading" });
  const [config, setConfig] = useState<RemoteConfig>(() => structuredClone(DEFAULT_CONFIG));
  const [attempt, setAttempt] = useState(0);
  const [notice, setNoticeText] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  useEffect(
    () =>
      loadAppData(fetchFn, LOCALE, browserTimers, {
        words: (r) => setData(r.ok ? { status: "ready", words: r.words } : { status: "failed", reason: r.reason }),
        config: (next) => {
          setLiveConfig(next);
          setConfig(next);
        },
      }),
    [fetchFn, attempt],
  );

  const retry = useCallback(() => {
    setData({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  const announce = useCallback((text: string) => {
    setMessage((prev) => (prev === text ? `${text}\u00a0` : text));
  }, []);

  const setNotice = useCallback(
    (text: string | null) => {
      setNoticeText(text);
      if (text) announce(text);
    },
    [announce],
  );

  const value = useMemo(
    () => ({ data, config, retry, store, notice, setNotice, announce }),
    [data, config, retry, store, notice, setNotice, announce],
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
