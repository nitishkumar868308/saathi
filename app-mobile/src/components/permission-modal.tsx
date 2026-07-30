import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
  AppState,
  type AppStateStatus,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/theme/colors";
import { useT } from "@/lib/i18n/LanguageProvider";
import {
  checkReadiness,
  requestStep,
  markReliabilityPromptShown,
  type Readiness,
  type StepKey,
} from "@/lib/reliability";

/**
 * "Reminder time pe aaye" wala setup modal.
 *
 * Har zaroori permission ek row hai — apna status khud dikhati hai (green tick
 * ya "Allow" button). Allow dabate hi OS ka asli popup/screen khulta hai; user
 * wapas aata hai to modal AppState se dobara check karke row ko green kar deta
 * hai. Yaani user ko dikhta hai ki kaam hua ya nahi — pehle sirf settings khul
 * jaati thi aur pata hi nahi chalta tha.
 */

const ICONS: Record<StepKey, keyof typeof Ionicons.glyphMap> = {
  notif: "notifications-outline",
  alarm: "alarm-outline",
  fsi: "phone-portrait-outline",
  battery: "battery-charging-outline",
  oem: "shield-checkmark-outline",
};

export function PermissionModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const { reliability: r, common } = useT();
  const [state, setState] = useState<Readiness | null>(null);
  const [busy, setBusy] = useState<StepKey | null>(null);
  const scale = useRef(new Animated.Value(0.94)).current;

  const refresh = useCallback(async () => {
    setState(await checkReadiness());
  }, []);

  useEffect(() => {
    if (!visible) return;
    void refresh();
    void markReliabilityPromptShown();
    scale.setValue(0.94);
    Animated.timing(scale, {
      toValue: 1,
      duration: 210,
      easing: Easing.out(Easing.back(1.3)),
      useNativeDriver: true,
    }).start();
  }, [visible, refresh, scale]);

  // User OS settings se wapas aaya — status dobara padho taaki tick lag jaye.
  useEffect(() => {
    if (!visible) return;
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s === "active") {
        setBusy(null);
        void refresh();
      }
    });
    return () => sub.remove();
  }, [visible, refresh]);

  async function allow(key: StepKey) {
    setBusy(key);
    await requestStep(key);
    // Notification permission in-app dialog hai — AppState change nahi aata.
    await refresh();
    setBusy(null);
  }

  const steps = (state?.steps ?? []).filter((s) => s.supported);
  const allOk = !!state?.allOk;

  const copy: Record<StepKey, { title: string; sub: string }> = {
    notif: { title: r.stepNotif, sub: r.stepNotifSub },
    alarm: { title: r.stepAlarm, sub: r.stepAlarmSub },
    fsi: { title: r.stepFsi, sub: r.stepFsiSub },
    battery: { title: r.stepBattery, sub: r.stepBatterySub },
    oem: {
      title: r.stepOem,
      sub: state?.oemName ? `${state.oemName} · ${r.stepOemSub}` : r.stepOemSub,
    },
  };

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Animated.View style={[styles.cardWrap, { transform: [{ scale }] }]}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons
                name={allOk ? "checkmark-circle" : "alarm"}
                size={26}
                color={allOk ? colors.sage : colors.terracotta}
              />
            </View>

            <Text style={styles.title}>{allOk ? r.allSetTitle : r.promptTitle}</Text>
            <Text style={styles.body}>{allOk ? r.allSetBody : r.promptBody}</Text>

            {/* Full-screen alert Android 14+ par default se BAND hota hai —
                yahi sabse zyada log miss karte hain (item 11). Baaki sab green
                hone par bhi bada popup isi ke bina nahi aata, isliye ye pending
                ho to alag se upar bataate hain. */}
            {!allOk && steps.some((s) => s.key === "fsi" && !s.ok) && (
              <View style={styles.spotlight}>
                <Ionicons name="sparkles" size={16} color={colors.terracotta} />
                <Text style={styles.spotlightText}>{r.fsiSpotlight}</Text>
              </View>
            )}

            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {steps.map((s) => (
                <View
                  key={s.key}
                  style={[
                    styles.step,
                    s.ok && styles.stepDone,
                    !s.ok && s.key === "fsi" && styles.stepKey,
                  ]}
                >
                  <View style={[styles.stepIcon, s.ok && styles.stepIconDone]}>
                    <Ionicons
                      name={s.ok ? "checkmark" : ICONS[s.key]}
                      size={17}
                      color={s.ok ? colors.white : colors.terracotta}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepTitle}>{copy[s.key].title}</Text>
                    <Text style={styles.stepSub}>{copy[s.key].sub}</Text>
                  </View>
                  {s.ok ? (
                    <Text style={styles.stepOk}>{r.stepDone}</Text>
                  ) : (
                    <Pressable
                      onPress={() => allow(s.key)}
                      disabled={busy === s.key}
                      style={({ pressed }) => [
                        styles.allowBtn,
                        (pressed || busy === s.key) && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={styles.allowText}>{r.stepAllow}</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </ScrollView>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.cta,
                allOk && styles.ctaDone,
                pressed && { opacity: 0.88 },
              ]}
            >
              <Text style={styles.ctaText}>{allOk ? common.done : r.promptLater}</Text>
            </Pressable>
          </View>
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
    padding: 22,
  },
  cardWrap: { width: "100%", maxWidth: 440 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  iconWrap: {
    height: 60,
    width: 60,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.12)",
  },
  title: {
    marginTop: 15,
    fontSize: 21,
    fontWeight: "800",
    color: colors.ink,
    lineHeight: 28,
  },
  body: { marginTop: 8, fontSize: 14.5, lineHeight: 22, color: colors.inkSoft },
  spotlight: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.3)",
    backgroundColor: "rgba(194,90,55,0.07)",
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  spotlightText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: colors.ink,
  },
  stepKey: { borderColor: colors.terracotta, borderWidth: 1.5 },
  list: { marginTop: 16, maxHeight: 380 },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cream,
    padding: 12,
    marginBottom: 9,
  },
  stepDone: { backgroundColor: "rgba(124,138,107,0.09)", borderColor: "rgba(124,138,107,0.35)" },
  stepIcon: {
    height: 34,
    width: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.12)",
  },
  stepIconDone: { backgroundColor: colors.sage },
  stepTitle: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  stepSub: { marginTop: 2, fontSize: 12.5, lineHeight: 17, color: colors.inkSoft },
  stepOk: { fontSize: 12.5, fontWeight: "700", color: colors.sage },
  allowBtn: {
    borderRadius: 999,
    backgroundColor: colors.terracotta,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  allowText: { fontSize: 12.5, fontWeight: "800", color: colors.white },
  cta: {
    marginTop: 6,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink,
  },
  ctaDone: { backgroundColor: colors.sage },
  ctaText: { fontSize: 15.5, fontWeight: "800", color: colors.white },
});
