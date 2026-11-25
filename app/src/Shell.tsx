import { Linking, useColorScheme, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import type { ShouldStartLoadRequest } from "react-native-webview/lib/WebViewTypes";
import { WEB_ORIGIN, WEB_URL } from "./config";
import { decideNavigation } from "./navigation";
import { paletteFor } from "./theme";

function shouldStart(request: ShouldStartLoadRequest): boolean {
  const decision = decideNavigation(request.url, WEB_ORIGIN);
  if (decision === "open-external") Linking.openURL(request.url).catch(() => undefined);
  return decision === "load";
}

export function Shell() {
  const insets = useSafeAreaInsets();
  const palette = paletteFor(useColorScheme());
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
        source={{ uri: WEB_URL }}
        originWhitelist={[WEB_ORIGIN]}
        onShouldStartLoadWithRequest={shouldStart}
        style={{ flex: 1, backgroundColor: palette.background }}
      />
    </View>
  );
}
