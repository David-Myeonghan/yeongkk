import type { Word } from "@yk/quiz-core/types";
import { useActivity, useFlow } from "@stackflow/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { match } from "ts-pattern";
import { clearProgress, loadProgress, type Progress } from "../state/progress";
import { parseIndex, routeFor, type QuizScreen } from "../state/session";
import { appBarTitle } from "../styles/screen.css";
import { vars } from "../styles/theme.css";
import { visuallyHidden } from "./a11y.css";
import { useAppData } from "./AppData";

export const WORDS_CHANGED = "단어가 바뀌어서 새로 시작해요.";
export const EXPIRED = "시간이 지나서 새로 시작해요.";

/** 화면이 바뀔 때 제목으로 포커스. 앱을 처음 연 첫 화면은 건드리지 않는다. */
export function useHeadingFocus<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const { isTop, isRoot } = useActivity();
  const wasTop = useRef(isTop);
  useEffect(() => {
    if (isTop && (!isRoot || !wasTop.current)) ref.current?.focus({ preventScroll: true });
    wasTop.current = isTop;
  }, [isTop, isRoot]);
  return ref;
}

/** 맨 위가 아닌 화면은 전환이 끝나기 전에도 보조 기술에서 빠지게 `inert` 로 쓴다. */
export function useBehind(): boolean {
  return !useActivity().isTop;
}

/** 두 번 눌러도 이동은 한 번. 화면이 다시 맨 위가 되면 풀린다. */
export function useOnce() {
  const used = useRef(false);
  const { isTop } = useActivity();
  useEffect(() => {
    if (isTop) used.current = false;
  }, [isTop]);
  return useCallback((fn: () => void) => {
    if (used.current) return;
    used.current = true;
    fn();
  }, []);
}

export type QuizView = { words: Word[]; progress: Progress; index: number | null };

/** 저장된 진행과 맞지 않는 화면이면 맞는 화면으로 보낸다. 보여도 되면 view 를 준다. */
export function useQuizRoute(screen: QuizScreen, rawIndex: string | undefined) {
  const app = useAppData();
  const { replace, pop } = useFlow();
  const { isTop } = useActivity();
  const [progress] = useState(() => loadProgress(app.store, Date.now()));
  const index = parseIndex(rawIndex);
  const words = app.data.status === "ready" ? app.data.words : null;
  const route = words ? routeFor(progress, screen, index) : ({ kind: "home" } as const);
  const moved = useRef(false);

  const leave = useCallback(
    (fn: () => void) => {
      if (moved.current) return;
      moved.current = true;
      fn();
    },
    [],
  );

  const restart = useCallback(() => {
    leave(() => {
      clearProgress(app.store);
      app.setNotice(WORDS_CHANGED);
      pop();
    });
  }, [app, leave, pop]);

  useEffect(() => {
    if (!isTop) return;
    match(route)
      .with({ kind: "show" }, () => {})
      .with({ kind: "home" }, () =>
        leave(() => {
          if (words && !progress) app.setNotice(EXPIRED);
          pop();
        }),
      )
      .with({ kind: "go", to: "Question" }, (r) => leave(() => replace("Question", { index: String(r.index) })))
      .with({ kind: "go", to: "Result" }, () => leave(() => replace("Result", {})))
      .exhaustive();
  }, [isTop, route, words, progress, app, leave, pop, replace]);

  const view: QuizView | null = route.kind === "show" && words && progress ? { words, progress, index } : null;
  return { view, restart, leave };
}

export function quizAppBar(position: { index: number; total: number } | string) {
  const title =
    typeof position === "string" ? (
      <span className={appBarTitle}>{position}</span>
    ) : (
      <span className={appBarTitle}>
        <span aria-hidden="true">
          {position.index + 1} / {position.total}
        </span>
        <span className={visuallyHidden}>
          {position.total}문제 중 {position.index + 1}번째
        </span>
      </span>
    );
  return { title, backgroundColor: vars.color.background, border: false };
}

export function Icon({ name, size = 20 }: { name: "check" | "cross"; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d={name === "check" ? "M5 12.5l4.5 4.5L19 7.5" : "M6.5 6.5l11 11M17.5 6.5l-11 11"}
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
