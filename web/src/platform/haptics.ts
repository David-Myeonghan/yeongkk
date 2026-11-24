import type { WebBridge } from "@yk/bridge/web";

export function hapticForAnswer(bridge: WebBridge, correct: boolean): void {
  try {
    if (!bridge.has("haptics")) return;
    bridge.call("haptics", { kind: correct ? "success" : "error" }).catch(() => undefined);
  } catch {
    // haptics never affects the quiz
  }
}
