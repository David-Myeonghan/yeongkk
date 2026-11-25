import { match } from "ts-pattern";

export type WebViewDeath = "ios-content-process-terminated" | "android-render-process-gone";
export type Recovery = "reload" | "remount";

// Android: the dead WebView must leave the view hierarchy (WebViewClient.onRenderProcessGone docs), so reload() on it is wrong.
export const recoveryFor = (death: WebViewDeath): Recovery =>
  match(death)
    .with("ios-content-process-terminated", (): Recovery => "reload")
    .with("android-render-process-gone", (): Recovery => "remount")
    .exhaustive();
