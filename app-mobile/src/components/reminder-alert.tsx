import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Notifications from "expo-notifications";

import { colors } from "@/theme/colors";
import { useT } from "@/lib/i18n/LanguageProvider";

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
 *   - App khula ho aur notification aaye  -> turant modal.
 *   - Notification pe tap karke aaye      -> modal.
 * Root me mount hai (_layout), isliye kisi bhi screen pe kaam karta hai.
 */
export function ReminderAlertHost() {
  const { notif: n } = useT();
  const [alert, setAlert] = useState<Alert | null>(null);
  const scale = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    // App khula hai aur notification fire hui
    const recv = Notifications.addNotificationReceivedListener((n) =>
      setAlert(fromNotification(n)),
    );
    // Notification pe tap (background se aaya, app pehle se chal raha tha)
    const resp = Notifications.addNotificationResponseReceivedListener((r) =>
      setAlert(fromNotification(r.notification)),
    );
    return () => {
      recv.remove();
      resp.remove();
    };
  }, []);

  useEffect(() => {
    if (!alert) return;
    scale.setValue(0.9);
    Animated.timing(scale, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.back(1.4)),
      useNativeDriver: true,
    }).start();
  }, [alert, scale]);

  if (!alert) return null;
  const isExpiry = alert.kind === "expiry";

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => setAlert(null)}>
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
            onPress={() => setAlert(null)}
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
