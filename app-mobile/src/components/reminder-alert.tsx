import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, StyleSheet, Modal, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import notifee, { EventType, type Notification } from "@notifee/react-native";

import { colors } from "@/theme/colors";
import { useT } from "@/lib/i18n/LanguageProvider";
import { speakReminder, stopSpeaking } from "@/lib/speak";
import { setReminderOn } from "@/lib/reminders";
import { cancelReminder } from "@/lib/notifications";
import { acknowledgeDocument } from "@/lib/doc-ack";

type Alert = { id: string; title: string; body: string; kind: "reminder" | "expiry" };

function fromNotification(n?: Notification | null): Alert | null {
  if (!n) return null;
  const data = (n.data ?? {}) as { kind?: string; body?: string; id?: string };
  return {
    // Reminder me id = reminder id; expiry me "doc:<id>:<lead>".
    id: (data.id as string) ?? n.id ?? "",
    title: n.title ?? "Saathi",
    body: n.body ?? (data.body as string) ?? "",
    kind: data.kind === "expiry" ? "expiry" : "reminder",
  };
}

/** "doc:<uuid>:<lead>" se document id nikaalo (expiry ack ke liye). */
function docIdFrom(identifier: string): string | null {
  const m = identifier.match(/^doc:(.+):\d+$/);
  return m ? m[1] : null;
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
  const handledId = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    const show = (notif?: Notification | null) => {
      const a = fromNotification(notif);
      if (!a || !alive) return;
      if (handledId.current === a.id) return; // dobara na dikhe
      handledId.current = a.id;
      setAlert(a);
    };

    // Foreground: notification aaye (DELIVERED) ya tap ho (PRESS) -> modal.
    const unsub = notifee.onForegroundEvent(({ type, detail }) => {
      if (type === EventType.DELIVERED || type === EventType.PRESS) {
        show(detail.notification);
      }
    });

    // Cold-start: app band tha, notification/full-screen se khula.
    notifee.getInitialNotification().then((initial) => show(initial?.notification));

    return () => {
      alive = false;
      unsub();
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
    // Reminder/document ka naam + kaam bol ke sunao — user ko dekhna na pade.
    speakReminder(alert.body);
  }, [alert, scale]);

  // Alert band ho ya component unmount ho to bolna rok do.
  function dismiss() {
    stopSpeaking();
    setAlert(null);
  }

  // Reminder "ho gaya" — off karo + notification cancel.
  function onDone() {
    if (alert?.kind === "reminder" && alert.id) {
      setReminderOn(alert.id, false).catch(() => {});
      cancelReminder(alert.id).catch(() => {});
    }
    dismiss();
  }

  // Expiry "OK/dekh liya" — server pe ack (WhatsApp follow-up skip, #8).
  function onOk() {
    if (alert?.kind === "expiry") {
      const docId = docIdFrom(alert.id);
      if (docId) acknowledgeDocument(docId);
    }
    dismiss();
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

          {isExpiry ? (
            <Pressable
              onPress={onOk}
              style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}
            >
              <Ionicons name="checkmark" size={18} color={colors.white} />
              <Text style={styles.btnText}>{n.alertOk}</Text>
            </Pressable>
          ) : (
            <>
              <Text style={styles.didText}>{n.alertDid}</Text>
              <View style={styles.btnRow}>
                <Pressable
                  onPress={dismiss}
                  style={({ pressed }) => [styles.btnAlt, pressed && { opacity: 0.9 }]}
                >
                  <Text style={styles.btnAltText}>{n.alertLater}</Text>
                </Pressable>
                <Pressable
                  onPress={onDone}
                  style={({ pressed }) => [styles.btn, { flex: 1, marginTop: 0 }, pressed && { opacity: 0.9 }]}
                >
                  <Ionicons name="checkmark" size={18} color={colors.white} />
                  <Text style={styles.btnText}>{n.alertDone}</Text>
                </Pressable>
              </View>
            </>
          )}
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
  didText: {
    marginTop: 18,
    fontSize: 14,
    fontWeight: "600",
    color: colors.inkSoft,
    textAlign: "center",
  },
  btnRow: { flexDirection: "row", gap: 10, alignSelf: "stretch", marginTop: 12 },
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
  btnAlt: {
    alignItems: "center",
    justifyContent: "center",
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
  },
  btnAltText: { fontSize: 15, fontWeight: "700", color: colors.inkSoft },
});
