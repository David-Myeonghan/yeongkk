import { lazy, Suspense, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ComponentRef } from "react";
import { AppState, BackHandler, Linking, Platform, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type {
  WebViewHttpErrorEvent,
  ShouldStartLoadRequest,
  WebViewNavigation,
  WebViewNavigationEvent,
} from "react-native-webview/lib/WebViewTypes";
import { WEB_ORIGIN, WEB_URL } from "./config";
import { backAction } from "./back";
import { decideNavigation, isMainDocumentFailure } from "./navigation";
import { appHost } from "./nativeHost";
import { renderableBanner } from "./bannerState";
import { bannerStore } from "./nativeAds";
import { Offline } from "./Offline";
import { receiveScript } from "./reply";
import { recoveryFor, type WebViewDeath } from "./recovery";
import { paletteFor } from "./theme";

const AdBanner = lazy(() => import("./AdBanner"));

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
  const [canGoBack, setCanGoBack] = useState(false);
  const insets = useSafeAreaInsets();
  const palette = paletteFor(useColorScheme());
  const requested = useSyncExternalStore(bannerStore.subscribe, bannerStore.get);
  const banner = renderableBanner(requested, failed);

  const send = useCallback((message: string) => webView.current?.injectJavaScript(receiveScript(message)), []);

  useEffect(() => {
    let previous = AppState.currentState;
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active" && previous !== "active") send(appHost.event("resume"));
      previous = next;
    });
    return () => subscription.remove();
  }, [send]);

  useEffect(() => {
    if (Platform.OS !== "android") return undefined;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (backAction({ canGoBack, offline: failed }) !== "webview-back") return false;
      webView.current?.goBack();
      return true;
    });
    return () => subscription.remove();
  }, [canGoBack, failed]);

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
  const onNavigationStateChange = (state: WebViewNavigation) => setCanGoBack(state.canGoBack);
  const remount = () => {
    setFailed(false);
    setCanGoBack(false);
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
          onNavigationStateChange={onNavigationStateChange}
          onError={onError}
          onHttpError={onHttpError}
          onContentProcessDidTerminate={() => recover("ios-content-process-terminated")}
          onRenderProcessGone={() => recover("android-render-process-gone")}
          style={{ flex: 1, backgroundColor: palette.background }}
        />
      )}
      {banner !== null && (
        <Suspense fallback={null}>
          <AdBanner unitId={banner.unitId} nonPersonalized={banner.nonPersonalized} />
        </Suspense>
      )}
    </View>
  );
}
