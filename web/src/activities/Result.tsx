import { AppScreen } from "@stackflow/plugin-basic-ui";
import { useFlow, type ActivityComponentType } from "@stackflow/react";
import { RESULT_COPY, resultTier, score } from "@yk/quiz-core/score";
import { visuallyHidden } from "../app/a11y.css";
import { useAppData } from "../app/AppData";
import { quizAppBar, useHeadingFocus, useQuizRoute, type QuizView } from "../app/screen";
import { newRoundId } from "../state/ids";
import { clearProgress, saveProgress } from "../state/progress";
import { startRound } from "../state/session";
import { localDate } from "../state/today";
import * as q from "../styles/quiz.css";
import * as ui from "../styles/screen.css";
import { vars } from "../styles/theme.css";

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

  const again = () =>
    leave(() => {
      clearProgress(app.store);
      const now = Date.now();
      const progress = startRound(view.words, { today: localDate(new Date(now)), roundId: newRoundId(), now });
      saveProgress(app.store, progress);
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
      <div className={ui.footer}>
        <button type="button" className={ui.button.primary} onClick={again}>
          다시 하기
        </button>
        <button type="button" className={ui.button.secondary} onClick={() => leave(() => pop())}>
          처음으로
        </button>
      </div>
    </main>
  );
}
