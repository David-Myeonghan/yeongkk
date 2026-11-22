import { AppScreen } from "@stackflow/plugin-basic-ui";
import { useFlow, type ActivityComponentType } from "@stackflow/react";
import { share, type ShareData, type ShareResult } from "@yk/bridge/share";
import { RESULT_COPY, resultTier, score } from "@yk/quiz-core/score";
import { useEffect, useRef, useState } from "react";
import { match } from "ts-pattern";
import { visuallyHidden } from "../app/a11y.css";
import { useAppData } from "../app/AppData";
import { ReportForm } from "../app/ReportForm";
import { rounds, track } from "../app/services";
import { quizAppBar, useHeadingFocus, useQuizRoute, type QuizView } from "../app/screen";
import { getBridge } from "../platform/bridge";
import { shareEnvFrom } from "../platform/shareEnv";
import { shareDataFor } from "../platform/shareData";
import { newRoundId } from "../state/ids";
import { markRoundCompleted } from "../state/completed";
import { clearProgress, saveProgress } from "../state/progress";
import { startRound } from "../state/session";
import { localDate } from "../state/today";
import * as q from "../styles/quiz.css";
import * as ui from "../styles/screen.css";
import { vars } from "../styles/theme.css";

const COPIED = "복사했어요";
const MANUAL_HINT = "주소를 길게 눌러 복사해 주세요";
const MANUAL_TEXT_HINT = "글을 길게 눌러 복사해 주세요";

type ShareNote = { kind: "copied" } | { kind: "manual"; hint: string; copyable: string } | null;

function manualNote(data: ShareData): ShareNote {
  return data.url
    ? { kind: "manual", hint: MANUAL_HINT, copyable: data.url }
    : { kind: "manual", hint: MANUAL_TEXT_HINT, copyable: data.text ?? "" };
}

async function shareResult(data: ShareData): Promise<{ note: ShareNote; result: ShareResult }> {
  try {
    const result = await share(getBridge(), data, shareEnvFrom(navigator));
    const note = match(result.via)
      .with("clipboard", () => ({ kind: "copied" }) as const)
      .with("none", () => manualNote(data))
      .with("native", "web-share", () => null)
      .exhaustive();
    return { note, result };
  } catch {
    return { note: manualNote(data), result: { via: "none", completed: false } };
  }
}

export const Result: ActivityComponentType<"Result"> = () => {
  const { view, leave } = useQuizRoute("Result", undefined);
  return (
    <AppScreen backgroundColor={vars.color.background} appBar={quizAppBar("결과")}>
      {view ? <ResultBody view={view} leave={leave} /> : null}
    </AppScreen>
  );
};

function ResultBody({ view, leave }: { view: QuizView; leave(fn: () => void): void }) {
  const app = useAppData();
  const { replace, pop } = useFlow();
  const headingRef = useHeadingFocus<HTMLHeadingElement>();
  const { correct, total } = score(view.progress.answers);
  const copy = RESULT_COPY["ko-KR"][resultTier(correct, total)];

  const [sharing, setSharing] = useState(false);
  const [note, setNote] = useState<ShareNote>(null);

  const shareButtonRef = useRef<HTMLButtonElement>(null);
  const refocus = useRef(false);

  const { roundId } = view.progress;
  useEffect(() => {
    if (markRoundCompleted(app.store, roundId)) track("round_complete", { correct, total });
  }, [app.store, roundId, correct, total]);

  useEffect(() => {
    if (!sharing && refocus.current) {
      refocus.current = false;
      shareButtonRef.current?.focus({ preventScroll: true });
    }
  }, [sharing]);

  const onShare = () => {
    if (sharing) return;
    setSharing(true);
    setNote(null);
    track("share_click");
    void shareResult(shareDataFor(correct, total, window.location.origin)).then(({ note: next, result }) => {
      track("share_done", { via: result.via, completed: result.completed });
      setNote(next);
      if (next?.kind === "copied") app.announce(COPIED);
      if (next?.kind === "manual") app.announce(next.hint);
      refocus.current = true;
      setSharing(false);
    });
  };

  const again = () =>
    leave(() => {
      clearProgress(app.store);
      const now = Date.now();
      const progress = startRound(view.words, { today: localDate(new Date(now)), roundId: newRoundId(), now });
      saveProgress(app.store, progress);
      rounds.begin({ progress, words: view.words, resumed: false });
      replace("Question", { index: "0" });
    });

  return (
    <main className={ui.page}>
      <h1 ref={headingRef} tabIndex={-1} className={ui.heading}>
        <span className={visuallyHidden}>
          {total}문제 중 {correct}개 맞혔어요.
        </span>
        <span aria-hidden="true" className={`${ui.bubble.brand} ${ui.display} ${q.scoreLine}`}>
          {correct} / {total}
        </span>
        <span className={`${ui.bubble.reply} ${q.tierLine}`}>{copy}</span>
      </h1>
      {note?.kind === "copied" && <p className={q.shareNote}>{COPIED}</p>}
      {note?.kind === "manual" && (
        <div className={q.shareNote}>
          <p className={q.shareHint}>{note.hint}</p>
          <p className={q.shareUrl}>{note.copyable}</p>
        </div>
      )}
      <div className={ui.footer}>
        <button ref={shareButtonRef} type="button" className={ui.button.primary} disabled={sharing} onClick={onShare}>
          공유하기
        </button>
        <button type="button" className={ui.button.secondary} onClick={again}>
          다시 하기
        </button>
        <button type="button" className={ui.button.secondary} onClick={() => leave(() => pop())}>
          처음으로
        </button>
        {app.config.features.report && <ReportForm />}
      </div>
    </main>
  );
}
