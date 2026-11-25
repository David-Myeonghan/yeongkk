import { useEffect, useRef, useState } from "react";
import { reminder, type ReminderState } from "../platform/reminder";
import * as q from "../styles/quiz.css";
import * as ui from "../styles/screen.css";
import { useAppData } from "./AppData";

const OFFER = "월요일에 알려 줄까요?";
const ON = "월요일에 알려 줄게요";
const TURN_OFF = "알림 끄기";
const TURNED_OFF = "알림을 껐어요";
const DENIED = "기기 설정에서 알림이 꺼져 있어요. 설정에서 켜 주세요.";

const HIDDEN: ReminderState = { kind: "hidden" };

/** 앱 안에서만 보인다. 월요일 아침 알림은 기기 안에서 예약되고 서버로는 아무것도 가지 않는다. */
export function ReminderControl() {
  const app = useAppData();
  const [state, setState] = useState<ReminderState>(HIDDEN);
  const [busy, setBusy] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const refocus = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    void reminder.load().then((next) => {
      if (alive.current) setState(next);
    });
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!refocus.current) return;
    refocus.current = false;
    const box = boxRef.current;
    if (box && !box.contains(document.activeElement)) (box.querySelector("button") ?? box).focus({ preventScroll: true });
  }, [state]);

  if (state.kind === "hidden") return null;

  const run = (action: () => Promise<ReminderState>, said: (next: ReminderState) => string | null) => {
    if (busy) return;
    setBusy(true);
    void action().then((next) => {
      if (!alive.current) return;
      const text = said(next);
      if (text) app.announce(text);
      refocus.current = true;
      setState(next);
      setBusy(false);
    });
  };

  const onEnable = () => run(() => reminder.enable(), (next) => (next.kind === "on" ? ON : next.kind === "denied" ? DENIED : null));
  const onDisable = () => run(() => reminder.disable(), (next) => (next.kind === "offer" ? TURNED_OFF : null));

  return (
    <div ref={boxRef} tabIndex={-1} className={q.reminder}>
      {state.kind === "offer" && (
        <button type="button" className={ui.button.secondary} disabled={busy} onClick={onEnable}>
          {OFFER}
        </button>
      )}
      {state.kind === "on" && (
        <>
          <p className={q.shareNote}>{ON}</p>
          <button type="button" className={ui.button.secondary} disabled={busy} onClick={onDisable}>
            {TURN_OFF}
          </button>
        </>
      )}
      {state.kind === "denied" && <p className={q.shareHint}>{DENIED}</p>}
    </div>
  );
}
