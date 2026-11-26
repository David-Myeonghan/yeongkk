export type BackAction = "webview-back" | "system-default";

export interface BackFacts {
  canGoBack: boolean;
  offline: boolean;
}

export const backAction = ({ canGoBack, offline }: BackFacts): BackAction =>
  canGoBack && !offline ? "webview-back" : "system-default";
