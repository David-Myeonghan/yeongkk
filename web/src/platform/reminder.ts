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

// 앱에 알림 기능이 없는 것(ABSENT)과 호출이 실패했거나 답이 이상한 것(FAILED)을 가른다. 앞은 컨트롤을 숨기고 뒤는 다시 누를 수 있게 둔다.
const ABSENT = "absent";
const FAILED = "failed";
type Reply = Answer | typeof ABSENT | typeof FAILED;

export function createReminder(getBridgeFn: () => WebBridge): Reminder {
  async function ask(action: string, opts?: { timeoutMs?: number }): Promise<Reply> {
    let bridge: WebBridge;
    try {
      bridge = getBridgeFn();
      await bridge.ready();
      if (!bridge.has("notify", 1)) return ABSENT;
    } catch {
      return ABSENT;
    }
    try {
      return asAnswer(await bridge.call("notify", { action }, opts)) ?? FAILED;
    } catch {
      return FAILED;
    }
  }

  const settled = (reply: Reply, failed: ReminderState): ReminderState => {
    if (reply === ABSENT) return HIDDEN;
    if (reply === FAILED) return failed;
    if (!reply.scheduled) return { kind: "offer" };
    return reply.granted ? { kind: "on" } : { kind: "denied" };
  };

  return {
    async load() {
      return settled(await ask("status"), { kind: "offer" });
    },
    async enable() {
      const reply = await ask("schedule-weekly", { timeoutMs: PROMPT_TIMEOUT_MS });
      if (reply === ABSENT) return HIDDEN;
      if (reply === FAILED) return { kind: "offer" };
      if (!reply.granted) return { kind: "denied" };
      return reply.scheduled ? { kind: "on" } : { kind: "offer" };
    },
    async disable() {
      return settled(await ask("cancel"), { kind: "on" });
    },
  };
}

export const reminder: Reminder = createReminder(getBridge);
