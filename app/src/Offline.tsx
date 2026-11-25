import { Pressable, StyleSheet, Text, useColorScheme, View } from "react-native";
import { paletteFor } from "./theme";

export function Offline({ onRetry }: { onRetry: () => void }) {
  const palette = paletteFor(useColorScheme());
  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]} accessibilityRole="alert">
      <Text style={[styles.title, { color: palette.text }]} accessibilityLabel="연결 후 다시">
        연결 후 다시
      </Text>
      <Text style={[styles.body, { color: palette.text }]}>인터넷에 연결되면 퀴즈를 열 수 있어요.</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="다시"
        accessibilityHint="퀴즈 화면을 다시 불러와요"
        onPress={onRetry}
        style={[styles.button, { backgroundColor: palette.accent }]}
      >
        <Text style={[styles.buttonText, { color: palette.onAccent }]}>다시</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 12 },
  title: { fontSize: 22, fontWeight: "700" },
  body: { fontSize: 16, textAlign: "center" },
  button: { marginTop: 12, minHeight: 48, minWidth: 120, borderRadius: 12, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  buttonText: { fontSize: 17, fontWeight: "600" },
});
