import { Platform } from "react-native";
import type { NotifyDeps } from "./notify";

const REMINDER_ID = "yk-weekly-new-words";
const CHANNEL_ID = "weekly-new-words";
const CHANNEL_NAME = "새 말 알림";

const load = () => import("expo-notifications");

async function ensureChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  const Notifications = await load();
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: CHANNEL_NAME,
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

export const nativeNotify: NotifyDeps = {
  async permissionGranted() {
    const Notifications = await load();
    const settings = await Notifications.getPermissionsAsync();
    return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  },
  async requestPermission() {
    const Notifications = await load();
    await ensureChannel();
    const settings = await Notifications.requestPermissionsAsync();
    return settings.granted || settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  },
  async isScheduled() {
    const Notifications = await load();
    const all = await Notifications.getAllScheduledNotificationsAsync();
    return all.some((entry) => entry.identifier === REMINDER_ID);
  },
  async cancel() {
    const Notifications = await load();
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  },
  async schedule(content, trigger) {
    const Notifications = await load();
    await ensureChannel();
    await Notifications.scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content,
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
        weekday: trigger.weekday,
        hour: trigger.hour,
        minute: trigger.minute,
        channelId: CHANNEL_ID,
      },
    });
  },
};
