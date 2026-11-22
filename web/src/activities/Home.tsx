import { AppScreen } from "@stackflow/plugin-basic-ui";
import { useActivity, useFlow, type ActivityComponentType } from "@stackflow/react";
import { useReducer } from "react";
import { match } from "ts-pattern";
import { visuallyHidden } from "../app/a11y.css";
import { useAppData, type FailReason } from "../app/AppData";
import { useHeadingFocus, useOnce } from "../app/screen";
import { newRoundId } from "../state/ids";
import { clearProgress, loadProgress, saveProgress } from "../state/progress";
import { isFinished, startRound } from "../state/session";
import { localDate } from "../state/today";
import * as home from "../styles/home.css";
import * as ui from "../styles/screen.css";
import { vars } from "../styles/theme.css";

const EXPIRED = "시간이 지나서 새로 시작해요.";

const failCopy = (reason: FailReason) =>
  match(reason)
    .with("network", () => "단어를 못 받았어요. 연결을 확인해 주세요.")
    .with("empty", () => "아직 단어가 없어요. 곧 채울게요.")
    .with("bad-shape", () => "단어 파일이 이상해요. 잠시 뒤 다시 열어 주세요.")
    .exhaustive();

export const Home: ActivityComponentType<"Home"> = () => {
  const app = useAppData();
  const { push } = useFlow();
  const { isTop } = useActivity();
  const once = useOnce();
  const headingRef = useHeadingFocus<HTMLHeadingElement>();
  const [, recheck] = useReducer((n: number) => n + 1, 0);
  const saved = isTop ? loadProgress(app.store, Date.now()) : null;
  const resumable = saved && !isFinished(saved) ? saved : null;

  const start = () =>
    once(() => {
      if (app.data.status !== "ready") return;
      const now = Date.now();
      const progress = startRound(app.data.words, { today: localDate(new Date(now)), roundId: newRoundId(), now });
      saveProgress(app.store, progress);
      app.setNotice(null);
      push("Question", { index: "0" });
    });

  const resume = () => {
    const current = loadProgress(app.store, Date.now());
    if (!current || isFinished(current)) {
      clearProgress(app.store);
      app.setNotice(EXPIRED);
      recheck();
      return;
    }
    once(() => {
      app.setNotice(null);
      push("Question", { index: String(current.answers.length) });
    });
  };

  return (
    <AppScreen backgroundColor={vars.color.background}>
      <main className={`${ui.page} ${ui.rootPage}`} aria-busy={app.data.status === "loading"}>
        <div className={home.hero}>
          <h1 ref={headingRef} tabIndex={-1} className={`${ui.heading} ${ui.bubble.brand} ${ui.display}`}>
            뭔말이야
          </h1>
          <p className={`${ui.bubble.reply} ${home.reply}`}>
            요즘 말, 얼마나 알아요?
          </p>
        </div>
        {app.notice && (
          <p className={ui.notice}>
            {app.notice}
          </p>
        )}
        <div className={ui.footer}>
          {match(app.data)
            .with({ status: "loading" }, () => (
              <>
                <span className={visuallyHidden}>단어를 불러오는 중이에요.</span>
                <div className={ui.skeleton} aria-hidden="true" />
              </>
            ))
            .with({ status: "failed" }, ({ reason }) => (
              <>
                <p role="alert" className={ui.errorText}>
                  {failCopy(reason)}
                </p>
                <button type="button" className={ui.button.primary} onClick={app.retry}>
                  다시
                </button>
              </>
            ))
            .with({ status: "ready" }, () =>
              resumable ? (
                <>
                  <button type="button" className={ui.button.primary} onClick={resume}>
                    이어 풀기 ({resumable.answers.length}/{resumable.wordIds.length})
                  </button>
                  <button type="button" className={ui.button.secondary} onClick={start}>
                    새로 시작
                  </button>
                </>
              ) : (
                <button type="button" className={ui.button.primary} onClick={start}>
                  시작
                </button>
              ),
            )
            .exhaustive()}
        </div>
      </main>
    </AppScreen>
  );
};
