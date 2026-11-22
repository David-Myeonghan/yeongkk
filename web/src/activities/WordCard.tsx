import { AppScreen } from "@stackflow/plugin-basic-ui";
import { useFlow, type ActivityComponentType } from "@stackflow/react";
import { useEffect, useMemo } from "react";
import { visuallyHidden } from "../app/a11y.css";
import { Icon, quizAppBar, useHeadingFocus, useQuizRoute, type QuizView } from "../app/screen";
import { questionAt } from "../state/session";
import { funnyWrongOn } from "../state/variants";
import * as q from "../styles/quiz.css";
import * as ui from "../styles/screen.css";
import { vars } from "../styles/theme.css";

export const WordCard: ActivityComponentType<"WordCard"> = ({ params }) => {
  const { view, restart, leave } = useQuizRoute("WordCard", params.index);
  return (
    <AppScreen
      backgroundColor={vars.color.background}
      appBar={quizAppBar(view && view.index !== null ? { index: view.index, total: view.progress.wordIds.length } : "")}
    >
      {view && view.index !== null ? <WordCardBody view={view} index={view.index} restart={restart} leave={leave} /> : null}
    </AppScreen>
  );
};

function WordCardBody(props: { view: QuizView; index: number; restart(): void; leave(fn: () => void): void }) {
  const { view, index, restart, leave } = props;
  const { replace } = useFlow();
  const headingRef = useHeadingFocus<HTMLHeadingElement>();
  const record = view.progress.answers[index];
  const question = useMemo(() => questionAt(view.progress, view.words, index, { funnyWrong: funnyWrongOn() }), [view, index]);
  const word = useMemo(() => view.words.find((w) => w.id === record?.wordId), [view.words, record]);

  useEffect(() => {
    if (!question || !word || !record) restart();
  }, [question, word, record, restart]);

  if (!question || !word || !record) return null;
  const last = index + 1 >= view.progress.wordIds.length;
  const right = record.correct;
  const answerText = question.choices[question.answerIndex];
  const pickedText = question.choices[record.choice];
  const verdict = right ? "맞았어요" : "아쉬워요";

  const next = () =>
    leave(() => (last ? replace("Result", {}) : replace("Question", { index: String(index + 1) })));

  return (
    <main className={ui.page}>
      <div className={`${q.verdict} ${q.verdictTone[right ? "right" : "wrong"]}`} aria-hidden="true">
        <span className={`${q.verdictIcon[right ? "right" : "wrong"]} ${ui.popIn}`}>
          <Icon name={right ? "check" : "cross"} />
        </span>
        {verdict}
      </div>
      <p className={q.answerLine}>정답: {answerText}</p>
      {!right && pickedText !== undefined && <p className={q.pickedLine}>고른 답: {pickedText}</p>}

      <h1 ref={headingRef} tabIndex={-1} className={`${ui.heading} ${ui.display} ${q.word}`}>
        <span className={visuallyHidden}>{verdict}. </span>
        {word.word}
      </h1>
      <p className={q.meaning}>{word.meaning}</p>

      {word.examples.length > 0 && (
        <section className={q.section} aria-labelledby="examples-label">
          <h2 id="examples-label" className={q.label}>
            예문
          </h2>
          <ul className={q.examples}>
            {word.examples.slice(0, 2).map((text, i) => (
              <li key={i} className={q.example}>
                {text}
              </li>
            ))}
          </ul>
        </section>
      )}

      {word.origin && (
        <section className={q.section} aria-labelledby="origin-label">
          <h2 id="origin-label" className={q.label}>
            유래
          </h2>
          <p className={q.origin}>{word.origin}</p>
        </section>
      )}

      <div className={ui.footer}>
        <button type="button" className={ui.button.primary} onClick={next}>
          {last ? "결과 보기" : "다음"}
        </button>
      </div>
    </main>
  );
}
