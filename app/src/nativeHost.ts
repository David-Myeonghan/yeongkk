import * as Haptics from "expo-haptics";
import { Platform, Share } from "react-native";
import pkg from "../package.json";
import { createAppHost, type HapticKind } from "./host";

const FEEDBACK: Record<HapticKind, Haptics.NotificationFeedbackType> = {
  success: Haptics.NotificationFeedbackType.Success,
  error: Haptics.NotificationFeedbackType.Error,
};

export const appHost = createAppHost({
  appVersion: pkg.version,
  platform: Platform.OS,
  dismissedAction: Share.dismissedAction,
  share: (content) => Share.share(content),
  haptic: (kind) => Haptics.notificationAsync(FEEDBACK[kind]),
});
