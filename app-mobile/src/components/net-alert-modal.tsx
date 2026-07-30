import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Modal, StyleSheet, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/theme/colors";
import { useT } from "@/lib/i18n/LanguageProvider";
import { clearNetFailure, useNetFailure } from "@/lib/net-alert";
import { alertUser, stopAlert } from "@/lib/alert-mode";

/**
 * "Internet ne saath nahi diya" — poore app ka ek hi popup (item 6, 12 & 20).
 *
 * Root me mount hai, isliye kisi bhi screen ka failed kaam yahan aa ke dikh
 * jaata hai. Pehle aisa tha: loader hat gaya, banner 8 second baad gayab, aur
 * screen par kuch nahi bacha — user ko lagta tha app hi kaam nahi kar raha.
 *
 * ⚠️ Ye popup jaan-boojh ke POORI SCREEN leta hai, chhota center-card nahi.
 * Wajah: chhota card peeche ki screen ke saath ghul-mil jaata tha aur bade phone
 * par log use dekhe bina hi aage tap karte rehte the. Poori screen ke saath do
 * cheezein pakki ho jaati hain — user isse dekhega, aur galti se peeche ka
 * button nahi dabayega.
 *
 * Khulte hi Saathi user ka naam le ke bolta bhi hai ("Hello Ravi. Notification
 * From Apka Saathi.") — ring/vibrate/silent me se jo mode Settings me chuna ho
 * (`lib/alert-mode.ts`).
 */
export function NetAlertModal() {
  const { network: n } = useT();
  const failure = useNetFailure();
  const [busy, setBusy] = useState(false);
  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (!failure) return;
    setBusy(false);
    fade.setValue(0);
    rise.setValue(24);
    Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 260,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start();

    // Awaaz/vibrate — mode Settings se aata hai. Screen ka text waise bhi saaf
    // hai, isliye yahan sirf greeting bolte hain, poora message nahi.
    void alertUser();
    return () => stopAlert();
  }, [failure, fade, rise]);

  if (!failure) return null;

  const line =
    failure.kind === "ai" ? n.failAi : failure.kind === "save" ? n.failSave : n.failLoad;

  function close() {
    stopAlert();
    clearNetFailure();
  }

  async function onRetry() {
    if (busy) return;
    const again = failure?.retry;
    close();
    if (!again) return;
    setBusy(true);
    try {
      await again();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      transparent={false}
      animationType="fade"
      visible
      statusBarTranslucent
      onRequestClose={close}
    >
      <SafeAreaView style={styles.screen} edges={["top", "bottom"]}>
        {/* Peeche naram teal glow — khaali screen thandi/khaali na lage. */}
        <View style={styles.glow} pointerEvents="none" />

        <Animated.View
          style={[styles.body, { opacity: fade, transform: [{ translateY: rise }] }]}
        >
          <View style={styles.iconOuter}>
            <View style={styles.iconWrap}>
              <Ionicons name="cloud-offline" size={44} color={colors.terracotta} />
            </View>
          </View>

          <Text style={styles.title}>{n.failTitle}</Text>
          <Text style={styles.line}>{line}</Text>
          <Text style={styles.hint}>{n.failHint}</Text>
        </Animated.View>

        {/* Buttons neeche — angootha yahin pahunchta hai. */}
        <Animated.View style={[styles.actions, { opacity: fade }]}>
          {!!failure.retry && (
            <Pressable
              onPress={onRetry}
              disabled={busy}
              style={({ pressed }) => [styles.btn, (pressed || busy) && { opacity: 0.85 }]}
            >
              <Ionicons name="refresh" size={19} color={colors.white} />
              <Text style={styles.btnText}>{n.tryAgain}</Text>
            </Pressable>
          )}
          <Pressable
            onPress={close}
            style={({ pressed }) => [styles.btnAlt, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.btnAltText}>{n.later}</Text>
          </Pressable>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.cream,
    paddingHorizontal: 28,
  },
  glow: {
    position: "absolute",
    top: "18%",
    alignSelf: "center",
    height: 300,
    width: 300,
    borderRadius: 150,
    backgroundColor: "rgba(18,81,86,0.06)",
  },
  body: { flex: 1, alignItems: "center", justifyContent: "center" },
  iconOuter: {
    height: 132,
    width: 132,
    borderRadius: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.08)",
  },
  iconWrap: {
    height: 96,
    width: 96,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.14)",
  },
  title: {
    marginTop: 30,
    fontSize: 25,
    fontWeight: "800",
    color: colors.ink,
    textAlign: "center",
  },
  line: {
    marginTop: 12,
    fontSize: 17,
    lineHeight: 25,
    fontWeight: "600",
    color: colors.ink,
    textAlign: "center",
    maxWidth: 340,
  },
  hint: {
    marginTop: 12,
    fontSize: 14.5,
    lineHeight: 22,
    color: colors.inkSoft,
    textAlign: "center",
    maxWidth: 320,
  },
  actions: { gap: 10, paddingBottom: 20 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.terracotta,
  },
  btnText: { fontSize: 16.5, fontWeight: "800", color: colors.white },
  btnAlt: {
    alignItems: "center",
    justifyContent: "center",
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  btnAltText: { fontSize: 15.5, fontWeight: "700", color: colors.inkSoft },
});

export default NetAlertModal;
