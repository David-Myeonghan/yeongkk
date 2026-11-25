import * as Haptics from "expo-haptics";
import { Platform, Share } from "react-native";
import pkg from "../package.json";
import { createAppHost, type HapticKind, type ShareContent } from "./host";

const FEEDBACK: Record<HapticKind, Haptics.NotificationFeedbackType> = {
  success: Haptics.NotificationFeedbackType.Success,
  error: Haptics.NotificationFeedbackType.Error,
};

function toShareArgument(content: ShareContent): Parameters<typeof Share.share>[0] {
  const { message, url, title } = content;
  if (message !== undefined) return { message, ...(url === undefined ? {} : { url }), ...(title === undefined ? {} : { title }) };
  return { url: url ?? "", ...(title === undefined ? {} : { title }) };
}

export const appHost = createAppHost({
  appVersion: pkg.version,
  platform: Platform.OS,
  dismissedAction: Share.dismissedAction,
  share: (content) => Share.share(toShareArgument(content)),
  haptic: (kind) => Haptics.notificationAsync(FEEDBACK[kind]),
});
