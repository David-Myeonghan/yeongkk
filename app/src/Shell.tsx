import { useCallback, useEffect, useRef, useState, type ComponentRef } from "react";
import { AppState, Linking, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type {
  WebViewHttpErrorEvent,
  ShouldStartLoadRequest,
  WebViewNavigationEvent,
} from "react-native-webview/lib/WebViewTypes";
import { WEB_ORIGIN, WEB_URL } from "./config";
import { decideNavigation, isMainDocumentFailure } from "./navigation";
import { appHost } from "./nativeHost";
import { Offline } from "./Offline";
import { receiveScript } from "./reply";
import { recoveryFor, type WebViewDeath } from "./recovery";
import { paletteFor } from "./theme";

function shouldStart(request: ShouldStartLoadRequest): boolean {
  const decision = decideNavigation(request.url, WEB_ORIGIN);
  if (decision === "open-external") Linking.openURL(request.url).catch(() => undefined);
  return decision === "load";
}

export function Shell() {
  const webView = useRef<ComponentRef<typeof WebView>>(null);
  const mainUrl = useRef(WEB_URL);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const insets = useSafeAreaInsets();
  const palette = paletteFor(useColorScheme());

  const send = useCallback((message: string) => webView.current?.injectJavaScript(receiveScript(message)), []);

  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active" && previous !== "active") send(appHost.event("resume"));
      previous = next;
    });
    return () => subscription.remove();
  }, [send]);

  const onMessage = (event: WebViewMessageEvent) => {
    appHost
      .handle(event.nativeEvent.data)
      .then((reply) => {
        if (reply !== null) send(reply);
      })
      .catch(() => undefined);
  };

  const onLoadStart = (event: WebViewNavigationEvent) => {
    mainUrl.current = event.nativeEvent.url;
  };
  const onError = () => setFailed(true);
  const onHttpError = (event: WebViewHttpErrorEvent) => {
    if (isMainDocumentFailure(event.nativeEvent.url, mainUrl.current)) setFailed(true);
  };
  const remount = () => {
    setFailed(false);
    setAttempt((n) => n + 1);
  };
  const recover = (death: WebViewDeath) => {
    if (recoveryFor(death) === "remount") remount();
    else webView.current?.reload();
  };

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: palette.background,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
        paddingLeft: insets.left,
        paddingRight: insets.right,
      }}
    >
      {failed ? (
        <Offline onRetry={remount} />
      ) : (
        <WebView
          key={attempt}
          ref={webView}
          source={{ uri: WEB_URL }}
          originWhitelist={[WEB_ORIGIN]}
          injectedJavaScriptObject={appHost.info()}
          onMessage={onMessage}
          onShouldStartLoadWithRequest={shouldStart}
          onLoadStart={onLoadStart}
          onError={onError}
          onHttpError={onHttpError}
          onContentProcessDidTerminate={() => recover("ios-content-process-terminated")}
          onRenderProcessGone={() => recover("android-render-process-gone")}
          style={{ flex: 1, backgroundColor: palette.background }}
        />
      )}
    </View>
  );
}
