interface Sink {
  leave(): void;
  resume(): void;
}

type DocLike = EventTarget & { visibilityState: string };

/** 화면이 가려지거나 페이지가 닫힐 때 남은 이벤트를 내보내고, 다시 보이면 보통 상태로 돌린다. */
export function attachLeaveHooks(doc: DocLike, win: EventTarget, sink: Sink): () => void {
  const safely = (fn: () => void) => () => {
    try {
      fn();
    } catch {
      // 떠나는 길에서 던져도 소용없다
    }
  };
  const onVisibility = safely(() => (doc.visibilityState === "hidden" ? sink.leave() : sink.resume()));
  const onPageHide = safely(() => sink.leave());
  doc.addEventListener("visibilitychange", onVisibility);
  win.addEventListener("pagehide", onPageHide);
  return () => {
    doc.removeEventListener("visibilitychange", onVisibility);
    win.removeEventListener("pagehide", onPageHide);
  };
}
