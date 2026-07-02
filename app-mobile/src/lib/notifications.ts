import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

// Foreground mein bhi notification dikhe
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function ensureNotifPermission(): Promise<boolean> {
  // Android channel — sound + screen pe theek se aaye
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "Reminders",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

/** Reminder ke id ko notification identifier bana ke schedule karta hai. */
export async function scheduleReminder(
  id: string,
  title: string,
  when: Date,
): Promise<boolean> {
  if (when.getTime() <= Date.now()) return false;
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: id,
      content: { title: "Saathi 🔔", body: title },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
      },
    });
    return true;
  } catch {
    return false;
  }
}

export async function cancelReminder(id: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
    // already gone — koi baat nahi
  }
}
