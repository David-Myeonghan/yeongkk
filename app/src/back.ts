import { originOf } from "./navigation";

export type BackAction = "webview-back" | "system-default";

export interface BackFacts {
  canGoBack: boolean;
  offline: boolean;
  currentUrl: string;
  startUrl: string;
}

const pathOf = (url: string): string => {
  const path = /^https?:\/\/[^/?#]*([^?#]*)/i.exec(url)?.[1] ?? "";
  return path.replace(/\/+$/, "");
};

export const atStartPage = (currentUrl: string, startUrl: string): boolean => {
  const origin = originOf(currentUrl);
  return origin !== null && origin === originOf(startUrl) && pathOf(currentUrl) === pathOf(startUrl);
};

export const backAction = ({ canGoBack, offline, currentUrl, startUrl }: BackFacts): BackAction => {
  if (!canGoBack || offline || originOf(currentUrl) === null) return "system-default";
  return atStartPage(currentUrl, startUrl) ? "system-default" : "webview-back";
};
