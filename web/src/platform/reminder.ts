import type { WebBridge } from "@yk/bridge/web";
import { isObj } from "@yk/bridge/protocol";
import { getBridge } from "./bridge";

export type ReminderState = { kind: "hidden" } | { kind: "offer" } | { kind: "on" } | { kind: "denied" };

export interface Reminder {
  load(): Promise<ReminderState>;
  enable(): Promise<ReminderState>;
  disable(): Promise<ReminderState>;
}

export const HIDDEN: ReminderState = { kind: "hidden" };

// 권한 창이 떠 있는 동안 기다려야 한다.
const PROMPT_TIMEOUT_MS = 60_000;

type Answer = { granted: boolean; scheduled: boolean };

const asAnswer = (x: unknown): Answer | null =>
  isObj(x) && typeof x.granted === "boolean" && typeof x.scheduled === "boolean" ? { granted: x.granted, scheduled: x.scheduled } : null;

export function createReminder(getBridgeFn: () => WebBridge): Reminder {
  async function ask(action: string, opts?: { timeoutMs?: number }): Promise<Answer | null> {
    try {
      const bridge = getBridgeFn();
      await bridge.ready();
      if (!bridge.has("notify", 1)) return null;
      return asAnswer(await bridge.call("notify", { action }, opts));
    } catch {
      return null;
    }
  }

  const settled = (answer: Answer | null): ReminderState => {
    if (answer === null) return HIDDEN;
    if (!answer.scheduled) return { kind: "offer" };
    return answer.granted ? { kind: "on" } : { kind: "denied" };
  };

  return {
    async load() {
      return settled(await ask("status"));
    },
    async enable() {
      const answer = await ask("schedule-weekly", { timeoutMs: PROMPT_TIMEOUT_MS });
      if (answer === null) return HIDDEN;
      if (!answer.granted) return { kind: "denied" };
      return answer.scheduled ? { kind: "on" } : HIDDEN;
    },
    async disable() {
      return settled(await ask("cancel"));
    },
  };
}

export const reminder: Reminder = createReminder(getBridge);
