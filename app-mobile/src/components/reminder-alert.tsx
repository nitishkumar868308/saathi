import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";

import { colors } from "@/theme/colors";
import { useT } from "@/lib/i18n/LanguageProvider";
import { speakReminder, stopSpeaking } from "@/lib/speak";

type Alert = { title: string; body: string; kind: "reminder" | "expiry" };

function fromNotification(n: Notifications.Notification): Alert {
  const c = n.request.content;
  const data = (c.data ?? {}) as { kind?: string; body?: string };
  return {
    title: c.title ?? "Saathi",
    body: c.body ?? (data.body as string) ?? "",
    kind: data.kind === "expiry" ? "expiry" : "reminder",
  };
}

/**
 * Reminder/expiry ka full-screen alert — screen ke beech me ek zaroori message
 * ki tarah (spec #5). Sirf notification tray me chup-chaap nahi rehta:
 *   - App khula ho aur notification aaye        -> turant modal.
 *   - Notification pe tap (app pehle se chalu)   -> modal.
 *   - App poori tarah band tha, tap se khula     -> modal (cold-start).
 * Root me mount hai (_layout), isliye kisi bhi screen pe kaam karta hai.
 */
export function ReminderAlertHost() {
  const { notif: n } = useT();
  const [alert, setAlert] = useState<Alert | null>(null);
  const scale = useRef(new Animated.Value(0.9)).current;

  // ⚠️ Cold-start: app killed tha aur user notification tap karke laaya. Response
  // listener ye case miss karta hai (wo app chalu hone se pehle fire ho chuka
  // hota hai). useLastNotificationResponse() us aakhri response ko pakadta hai.
  const lastResponse = Notifications.useLastNotificationResponse();
  const handledId = useRef<string | null>(null);

  useEffect(() => {
    // Sirf foreground me aayi notification (tap warm/cold dono neeche hook se).
    const recv = Notifications.addNotificationReceivedListener((notif) =>
      setAlert(fromNotification(notif)),
    );
    return () => recv.remove();
  }, []);

  useEffect(() => {
    if (!lastResponse) return;
    // Same response dobara process na ho (dismiss ke baad bhi hook wahi rakhta hai).
    const id = lastResponse.notification.request.identifier;
    if (handledId.current === id) return;
    handledId.current = id;
    setAlert(fromNotification(lastResponse.notification));
  }, [lastResponse]);

  useEffect(() => {
    if (!alert) return;
    scale.setValue(0.9);
    Animated.timing(scale, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
    // Reminder/document ka naam + kaam bol ke sunao — user ko dekhna na pade.
    speakReminder(alert.body);
  }, [alert, scale]);

  // Alert band ho ya component unmount ho to bolna rok do.
  function dismiss() {
    stopSpeaking();
    setAlert(null);
  }
  useEffect(() => () => stopSpeaking(), []);

  if (!alert) return null;
  const isExpiry = alert.kind === "expiry";

  return (
    <Modal transparent animationType="fade" visible onRequestClose={dismiss}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <View style={[styles.iconWrap, isExpiry && styles.iconExpiry]}>
            <Ionicons
              name={isExpiry ? "document-text" : "alarm"}
              size={34}
              color={colors.white}
            />
          </View>
          <Text style={styles.kicker}>{isExpiry ? n.alertExpiry : n.alertReminder}</Text>
          <Text style={styles.body}>{alert.body}</Text>

          <Pressable
            onPress={dismiss}
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="checkmark" size={18} color={colors.white} />
            <Text style={styles.btnText}>{n.alertOk}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(46,40,35,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    borderRadius: 28,
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 30,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  iconWrap: {
    height: 76,
    width: 76,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.terracotta,
  },
  iconExpiry: { backgroundColor: colors.amber },
  kicker: {
    marginTop: 16,
    fontSize: 12.5,
    fontWeight: "800",
    letterSpacing: 1,
    textTransform: "uppercase",
    color: colors.inkSoft,
  },
  body: {
    marginTop: 8,
    fontSize: 20,
    lineHeight: 28,
    fontWeight: "700",
    color: colors.ink,
    textAlign: "center",
  },
  btn: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.terracotta,
  },
  btnText: { fontSize: 16, fontWeight: "800", color: colors.white },
});
