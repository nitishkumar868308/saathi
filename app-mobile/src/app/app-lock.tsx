import { useCallback, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { colors } from "@/theme/colors";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useToast } from "@/components/toast";
import { ConfirmModal } from "@/components/confirm-modal";
import { reportError } from "@/lib/report-error";
import {
  PIN_LENGTH,
  disableLock,
  getLockState,
  isValidPin,
  markUnlocked,
  setBiometricOn,
  setPin,
  type LockState,
} from "@/lib/app-lock";

/**
 * App lock ki settings — chalu/band, PIN badlo, biometric on/off.
 *
 * PIN banane ka tarika do-qadam ka hai (daalo, phir dobara daalo) aur ye zaroori
 * hai: PIN kahin likha nahi jaata aur server par uska koi nishaan hi nahi hai,
 * isliye ek typo ka matlab hai user apne hi app se bahar. Ek baar aur poochh
 * lena us poore nuksaan ko rok deta hai.
 */

type Step = "idle" | "new" | "confirm";

export default function AppLock() {
  const router = useRouter();
  const toast = useToast();
  const { lock: l, common: c } = useT();

  const [state, setState] = useState<LockState | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [askOff, setAskOff] = useState(false);

  const refresh = useCallback(async () => {
    setState(await getLockState());
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  function startSetup() {
    setFirst("");
    setSecond("");
    setError(null);
    setStep("new");
  }

  async function finish(pin: string) {
    try {
      await setPin(pin);
      // Abhi-abhi khud PIN banaya hai — turant lock screen dikhana bemtlab hai.
      markUnlocked();
      await refresh();
      setStep("idle");
      toast.show(l.savedOn, "success");
    } catch (e) {
      reportError(e, { screen: "app-lock", action: "set_pin" });
      toast.show(l.saveFailed, "error");
      setStep("idle");
    }
  }

  function onFirst(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setFirst(digits);
    if (error) setError(null);
    if (digits.length === PIN_LENGTH) {
      setSecond("");
      setStep("confirm");
    }
  }

  function onSecond(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setSecond(digits);
    if (error) setError(null);
    if (digits.length < PIN_LENGTH) return;
    if (digits !== first) {
      // Wapas pehle qadam par — aadha bhara hua khaana chhod dena user ko yahi
      // sochne par majboor karta hai ki ab kya karein.
      setError(l.mismatch);
      setFirst("");
      setSecond("");
      setStep("new");
      return;
    }
    if (!isValidPin(digits)) {
      setError(l.mismatch);
      return;
    }
    void finish(digits);
  }

  async function toggleBiometric(on: boolean) {
    try {
      await setBiometricOn(on);
      await refresh();
    } catch (e) {
      reportError(e, { screen: "app-lock", action: "toggle_biometric" });
      toast.show(l.saveFailed, "error");
    }
  }

  async function turnOff() {
    setAskOff(false);
    try {
      await disableLock();
      await refresh();
      toast.show(l.savedOff, "info");
    } catch (e) {
      reportError(e, { screen: "app-lock", action: "disable" });
      toast.show(l.saveFailed, "error");
    }
  }

  const enabled = !!state?.enabled;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{l.title}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {step === "idle" ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <Ionicons
                  name={enabled ? "lock-closed" : "lock-open-outline"}
                  size={26}
                  color={colors.terracotta}
                />
              </View>
              <Text style={styles.heroTitle}>{l.title}</Text>
              <Text style={styles.heroSub}>{l.subtitle}</Text>
            </View>

            {enabled ? (
              <>
                {/* Biometric sirf PIN ke UPAR — isliye ye row tabhi dikhti hai
                    jab PIN set ho. Iske bina "sirf fingerprint" wala lock ban
                    jaata, jo ungli na padhne wale din user ko bahar chhod deta. */}
                <View style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel}>{l.biometricRow}</Text>
                    <Text style={styles.rowHint}>
                      {state?.biometricAvailable ? l.biometricHint : l.biometricNone}
                    </Text>
                  </View>
                  <Switch
                    value={!!state?.biometricOn}
                    onValueChange={(v) => void toggleBiometric(v)}
                    disabled={!state?.biometricAvailable}
                    trackColor={{ true: colors.terracotta, false: colors.line }}
                    thumbColor={colors.white}
                  />
                </View>

                <Pressable
                  onPress={startSetup}
                  style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}
                >
                  <Ionicons name="keypad-outline" size={19} color={colors.ink} />
                  <Text style={styles.actionText}>{l.changePin}</Text>
                  <Ionicons name="chevron-forward" size={17} color={colors.inkSoft} />
                </Pressable>

                <Pressable
                  onPress={() => setAskOff(true)}
                  style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}
                >
                  <Ionicons name="lock-open-outline" size={19} color={colors.terracottaDark} />
                  <Text style={[styles.actionText, { color: colors.terracottaDark }]}>
                    {l.turnOff}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={startSetup}
                style={({ pressed }) => [styles.cta, pressed && { opacity: 0.88 }]}
              >
                <Ionicons name="lock-closed" size={18} color={colors.white} />
                <Text style={styles.ctaText}>{l.offerYes}</Text>
              </Pressable>
            )}
          </>
        ) : (
          <View style={styles.setup}>
            <Text style={styles.setupTitle}>
              {step === "new" ? l.setTitle : l.confirmTitle}
            </Text>
            <Text style={styles.setupSub}>{step === "new" ? l.setSub : l.confirmSub}</Text>

            <View style={styles.dots}>
              <TextInput
                key={step}
                value={step === "new" ? first : second}
                onChangeText={step === "new" ? onFirst : onSecond}
                keyboardType="number-pad"
                secureTextEntry
                autoFocus
                maxLength={PIN_LENGTH}
                style={styles.hiddenInput}
                caretHidden
              />
              {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.dot,
                    i < (step === "new" ? first : second).length && styles.dotOn,
                  ]}
                />
              ))}
            </View>

            {!!error && <Text style={styles.err}>{error}</Text>}

            <Pressable onPress={() => setStep("idle")} hitSlop={8} style={styles.cancel}>
              <Text style={styles.cancelText}>{c.cancel}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>

      <ConfirmModal
        visible={askOff}
        title={l.turnOffAsk}
        message={l.turnOffBody}
        confirmLabel={l.turnOff}
        cancelLabel={c.cancel}
        icon="lock-open-outline"
        destructive
        onConfirm={() => void turnOff()}
        onCancel={() => setAskOff(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 10,
  },
  back: { padding: 4 },
  title: { fontSize: 21, fontWeight: "800", color: colors.ink },
  scroll: { padding: 16, paddingBottom: 40 },
  hero: { alignItems: "center", paddingVertical: 18 },
  heroIcon: {
    height: 66,
    width: 66,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.12)",
  },
  heroTitle: { marginTop: 14, fontSize: 19, fontWeight: "800", color: colors.ink },
  heroSub: {
    marginTop: 7,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.inkSoft,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    padding: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  rowLabel: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  rowHint: { marginTop: 4, fontSize: 12.5, lineHeight: 18, color: colors.inkSoft },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginTop: 10,
    height: 54,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  actionText: { flex: 1, fontSize: 14.5, fontWeight: "700", color: colors.ink },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 20,
    height: 52,
    borderRadius: 17,
    backgroundColor: colors.terracotta,
  },
  ctaText: { fontSize: 15, fontWeight: "800", color: colors.white },
  setup: { alignItems: "center", paddingTop: 30 },
  setupTitle: { fontSize: 19, fontWeight: "800", color: colors.ink },
  setupSub: {
    marginTop: 8,
    fontSize: 13.5,
    lineHeight: 20,
    color: colors.inkSoft,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  dots: { marginTop: 30, flexDirection: "row", gap: 16, alignItems: "center" },
  hiddenInput: { position: "absolute", opacity: 0, height: 48, width: "100%" },
  dot: {
    height: 15,
    width: 15,
    borderRadius: 8,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  dotOn: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  err: { marginTop: 18, fontSize: 13.5, fontWeight: "700", color: colors.terracottaDark },
  cancel: { marginTop: 26, padding: 8 },
  cancelText: { fontSize: 14, fontWeight: "700", color: colors.inkSoft },
});
