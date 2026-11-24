export const EVENT_NAMES = [
  "app_open",
  "round_start",
  "question_answered",
  "round_complete",
  "share_click",
  "share_done",
  "bridge_hello",
  "experiment_exposure",
] as const;

export type EventName = (typeof EVENT_NAMES)[number];
