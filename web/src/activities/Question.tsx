import { AppScreen } from "@stackflow/plugin-basic-ui";
import { useActivity, useFlow, type ActivityComponentType } from "@stackflow/react";
import { isNew } from "@yk/quiz-core/round";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAppData } from "../app/AppData";
import { Icon, quizAppBar, useHeadingFocus, useQuizRoute, type QuizView } from "../app/screen";
import { saveProgress } from "../state/progress";
import { answer, questionAt, roundDay } from "../state/session";
import { funnyWrongOn } from "../state/variants";
import * as q from "../styles/quiz.css";
import * as ui from "../styles/screen.css";
import { vars } from "../styles/theme.css";

const REVEAL_MS = 650;

export const Question: ActivityComponentType<"Question"> = ({ params }) => {
  const { view, restart, leave } = useQuizRoute("Question", params.index);
  return (
    <AppScreen
      backgroundColor={vars.color.background}
      appBar={quizAppBar(view && view.index !== null ? { index: view.index, total: view.progress.wordIds.length } : "")}
    >
      {view && view.index !== null ? <QuestionBody view={view} index={view.index} restart={restart} leave={leave} /> : null}
    </AppScreen>
  );
};

function QuestionBody(props: { view: QuizView; index: number; restart(): void; leave(fn: () => void): void }) {
  const { view, index, restart, leave } = props;
  const app = useAppData();
  const { replace } = useFlow();
  const { isTop } = useActivity();
  const headingRef = useHeadingFocus<HTMLHeadingElement>();
  const question = useMemo(() => questionAt(view.progress, view.words, index, { funnyWrong: funnyWrongOn() }), [view, index]);
  const word = useMemo(() => view.words.find((w) => w.id === question?.wordId), [view.words, question]);
  const [picked, setPicked] = useState<number | null>(null);
  const pickedRef = useRef(false);
  const isTopRef = useRef(isTop);
  isTopRef.current = isTop;

  useEffect(() => {
    if (!question) restart();
  }, [question, restart]);

  useEffect(() => {
    if (picked === null) return;
    const timer = setTimeout(() => {
      if (isTopRef.current) leave(() => replace("WordCard", { index: String(index) }));
    }, REVEAL_MS);
    return () => clearTimeout(timer);
  }, [picked, index, leave, replace]);

  if (!question || !word) return null;
  const total = view.progress.wordIds.length;
  const answerText = question.choices[question.answerIndex];

  const choose = (choice: number) => {
    if (pickedRef.current) return;
    pickedRef.current = true;
    setPicked(choice);
    const correct = choice === question.answerIndex;
    saveProgress(app.store, answer(view.progress, index, choice, correct));
    app.announce(correct ? "맞았어요." : `아쉬워요. 정답은 ${answerText}.`);
  };

  const stateOf = (i: number) => {
    if (picked === null) return "idle" as const;
    if (i === question.answerIndex) return "right" as const;
    if (i === picked) return "picked" as const;
    return "rest" as const;
  };

  return (
    <main className={ui.page}>
      <div className={q.segments} aria-hidden="true">
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={q.segment[i < index ? "done" : i === index ? "current" : "todo"]} />
        ))}
      </div>
      <h1 ref={headingRef} tabIndex={-1} className={ui.heading}>
        <span className={q.askRow}>
          {isNew(word, roundDay(view.progress)) && <span className={q.newBadge}>NEW</span>}
          <span>{question.kind === "meaning" ? "이 말, 무슨 뜻일까요?" : "이 뜻, 무슨 말일까요?"}</span>
        </span>
        <span className={`${ui.bubble.said} ${q.promptText[question.kind]}`}>{question.prompt}</span>
      </h1>
      <div className={q.choices} role="group" aria-label="보기">
        {question.choices.map((text, i) => {
          const state = stateOf(i);
          return (
            <button
              key={i}
              type="button"
              className={`${q.choice[state]} ${q.choiceSize[question.kind]}`}
              aria-disabled={picked !== null}
              onClick={() => choose(i)}
            >
              <span className={q.choiceText}>{text}</span>
              {state === "right" && (
                <span className={q.mark.right}>
                  <Icon name="check" size={18} />
                  정답
                </span>
              )}
              {state === "picked" && (
                <span className={q.mark.picked}>
                  <Icon name="cross" size={18} />
                  내 답
                </span>
              )}
            </button>
          );
        })}
      </div>
    </main>
  );
}
