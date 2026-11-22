import { describe, expect, it, vi } from "vitest";
import { attachLeaveHooks } from "./lifecycle";

function targets(visibility: "hidden" | "visible" = "visible") {
  const doc = Object.assign(new EventTarget(), { visibilityState: visibility });
  const win = new EventTarget();
  const sink = { leave: vi.fn(), resume: vi.fn() };
  const detach = attachLeaveHooks(doc, win, sink);
  return { doc, win, sink, detach };
}

describe("attachLeaveHooks", () => {
  it("가려지면 leave, 다시 보이면 resume", () => {
    const { doc, sink } = targets();
    doc.visibilityState = "hidden";
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(sink.leave).toHaveBeenCalledTimes(1);
    doc.visibilityState = "visible";
    doc.dispatchEvent(new Event("visibilitychange"));
    expect(sink.resume).toHaveBeenCalledTimes(1);
  });

  it("pagehide 에서 leave", () => {
    const { win, sink } = targets();
    win.dispatchEvent(new Event("pagehide"));
    expect(sink.leave).toHaveBeenCalledTimes(1);
  });

  it("detach 하면 더는 안 부른다", () => {
    const { win, sink, detach } = targets();
    detach();
    win.dispatchEvent(new Event("pagehide"));
    expect(sink.leave).not.toHaveBeenCalled();
  });

  it("leave 가 던져도 이벤트 처리가 던지지 않는다", () => {
    const doc = Object.assign(new EventTarget(), { visibilityState: "hidden" as const });
    const win = new EventTarget();
    attachLeaveHooks(doc, win, {
      leave: () => {
        throw new Error("x");
      },
      resume: () => {},
    });
    expect(() => win.dispatchEvent(new Event("pagehide"))).not.toThrow();
  });
});
