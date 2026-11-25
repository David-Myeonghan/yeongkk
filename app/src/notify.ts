import { BridgeError, isObj } from "../../bridge/protocol";

export const REMINDER_TITLE = "뭔말이야";
export const REMINDER_BODY = "이번 주 새 말이 올라왔어요.";

// weekday 는 일요일이 1이다(expo-notifications WeeklyTriggerInput). 월요일은 2.
export const REMINDER_TRIGGER = { type: "weekly", weekday: 2, hour: 9, minute: 0 } as const;

export type ReminderTrigger = typeof REMINDER_TRIGGER;
export interface ReminderContent {
  title: string;
  body: string;
}

export interface NotifyDeps {
  permissionGranted(): Promise<boolean>;
  requestPermission(): Promise<boolean>;
  isScheduled(): Promise<boolean>;
  cancel(): Promise<void>;
  schedule(content: ReminderContent, trigger: ReminderTrigger): Promise<void>;
}

export interface NotifyState {
  granted: boolean;
  scheduled: boolean;
}

const report = async (deps: NotifyDeps): Promise<NotifyState> => ({
  granted: await deps.permissionGranted(),
  scheduled: await deps.isScheduled(),
});

const cancelIfScheduled = async (deps: NotifyDeps): Promise<void> => {
  if (await deps.isScheduled()) await deps.cancel();
};

const ACTIONS: Record<string, (deps: NotifyDeps) => Promise<NotifyState>> = {
  status: report,
  async request(deps) {
    await deps.requestPermission();
    return report(deps);
  },
  async "schedule-weekly"(deps) {
    const granted = (await deps.permissionGranted()) || (await deps.requestPermission());
    if (granted) {
      await cancelIfScheduled(deps);
      await deps.schedule({ title: REMINDER_TITLE, body: REMINDER_BODY }, REMINDER_TRIGGER);
    }
    return report(deps);
  },
  async cancel(deps) {
    await cancelIfScheduled(deps);
    return report(deps);
  },
};

export function notifyHandler(deps: NotifyDeps) {
  return {
    version: 1,
    async handle(payload: unknown): Promise<NotifyState> {
      const action = isObj(payload) ? payload.action : undefined;
      const run = typeof action === "string" && Object.hasOwn(ACTIONS, action) ? ACTIONS[action] : undefined;
      if (run === undefined) throw new BridgeError("BAD_REQUEST", "unknown notify action");
      return run(deps);
    },
  };
}
