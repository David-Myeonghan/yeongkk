import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Shell } from "./src/Shell";

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      <Shell />
    </SafeAreaProvider>
  );
}
