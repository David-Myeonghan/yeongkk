import { useRef, type ComponentRef } from "react";
import { Linking, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { WEB_ORIGIN, WEB_URL } from "./config";
import { decideNavigation } from "./navigation";
import { appHost } from "./nativeHost";
import { receiveScript } from "./reply";
import { paletteFor } from "./theme";

function shouldStart(request: ShouldStartLoadRequest): boolean {
  const decision = decideNavigation(request.url, WEB_ORIGIN);
  if (decision === "open-external") Linking.openURL(request.url).catch(() => undefined);
  return decision === "load";
}

export function Shell() {
  const webView = useRef<ComponentRef<typeof WebView>>(null);
  const insets = useSafeAreaInsets();
  const palette = paletteFor(useColorScheme());
  const onMessage = (event: WebViewMessageEvent) => {
    appHost
      .handle(event.nativeEvent.data)
      .then((reply) => {
        if (reply !== null) webView.current?.injectJavaScript(receiveScript(reply));
      })
      .catch(() => undefined);
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
      <WebView
        ref={webView}
        source={{ uri: WEB_URL }}
        originWhitelist={[WEB_ORIGIN]}
        injectedJavaScriptObject={appHost.info()}
        onMessage={onMessage}
        onShouldStartLoadWithRequest={shouldStart}
        style={{ flex: 1, backgroundColor: palette.background }}
      />
    </View>
  );
}
