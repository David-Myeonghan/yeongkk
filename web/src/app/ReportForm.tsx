import { useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { match } from "ts-pattern";
import { LOCALE } from "../data/locale";
import * as q from "../styles/quiz.css";
import { submitReport, type ReportResult } from "../telemetry/report";
import { visuallyHidden } from "./a11y.css";
import { useAppData } from "./AppData";
import { shouldBlockEnter } from "./imeEnter";
import { anonId } from "./services";

const MAX_WORD = 20;

const messageFor = (result: ReportResult) =>
  match(result)
    .with("ok", () => "고마워요. 살펴볼게요.")
    .with("rejected", () => "이 말은 받을 수 없어요.")
    .with("limited", () => "오늘은 여기까지 받을게요.")
    .with("failed", () => "지금은 못 보냈어요. 잠시 뒤 다시 해 주세요.")
    .exhaustive();

/** 요즘 들은 말을 한 단어 적어 보낸다. 입력한 글은 이벤트로 가지 않고 이 요청에만 실린다. */
export function ReportForm() {
  const app = useAppData();
  const [word, setWord] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const busy = useRef(false);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = word.trim();
    if (trimmed === "" || busy.current) return;
    busy.current = true;
    setSending(true);
    setMessage(null);
    void submitReport((...args) => fetch(...args), app.config.api, { anonId: anonId(), locale: LOCALE, word: trimmed })
      .then((result) => {
        const text = messageFor(result);
        if (result === "ok") setWord("");
        setMessage(text);
        app.announce(text);
        busy.current = false;
        setSending(false);
      });
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (shouldBlockEnter({ key: event.key, isComposing: event.nativeEvent.isComposing, keyCode: event.keyCode })) event.preventDefault();
  };

  return (
    <form className={q.report} onSubmit={onSubmit}>
      <div className={q.reportRow}>
        <label className={visuallyHidden} htmlFor="report-word">
          요즘 들은 말
        </label>
        <input
          id="report-word"
          className={q.reportInput}
          type="text"
          value={word}
          maxLength={MAX_WORD}
          placeholder="요즘 들은 말 알려 주기"
          enterKeyHint="send"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          onChange={(e) => setWord(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <button type="submit" className={q.reportSend} disabled={sending}>
          보내기
        </button>
      </div>
      {message && <p className={q.reportNote}>{message}</p>}
    </form>
  );
}
