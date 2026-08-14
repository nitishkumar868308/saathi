import { useCallback, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView, Switch } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { KeyboardView } from "@/components/keyboard-view";
import { makeStyles, useColors } from "@/theme/theme";
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
  const tc = useColors();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const { lock: l, common: c } = useT();

  const [state, setState] = useState<LockState | null>(null);
  const [step, setStep] = useState<Step>("idle");
  const [first, setFirst] = useState("");
  const [second, setSecond] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [askOff, setAskOff] = useState(false);
  /**
   * Dots par tap = keyboard wapas.
   *
   * ⚠️ Yahan pehle ye tha hi nahi. `autoFocus` ek baar keyboard laata hai, par
   * user ek baar back daba de (ya "Ho gaya" wale key se keyboard band kar de) to
   * use wapas laane ka koi raasta hi nahi bachta tha — screen par chaar gol
   * dikhte the aur unpar ungli lagane se kuch nahi hota tha. Bilkul wahi bug jo
   * lock screen par tha.
   *
   * Do raaste chalte hain (dots ke beech tap = seedha input; kisi dot ke upar
   * tap = Pressable ka `focus()`), aur dono ka hona jaan-boojh ke hai — poori
   * wajah `components/lock-screen.tsx` par `inputRef` ke upar likhi hai.
   */
  const pinRef = useRef<TextInput>(null);

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
          <Ionicons name="chevron-back" size={24} color={tc.ink} />
        </Pressable>
        <Text style={styles.title}>{l.title}</Text>
      </View>

      <KeyboardView>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {step === "idle" ? (
          <>
            <View style={styles.hero}>
              <View style={styles.heroIcon}>
                <Ionicons
                  name={enabled ? "lock-closed" : "lock-open-outline"}
                  size={26}
                  color={tc.terracotta}
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
                    trackColor={{ true: tc.terracotta, false: tc.line }}
                    thumbColor={tc.white}
                  />
                </View>

                <Pressable
                  onPress={startSetup}
                  style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}
                >
                  <Ionicons name="keypad-outline" size={19} color={tc.ink} />
                  <Text style={styles.actionText}>{l.changePin}</Text>
                  <Ionicons name="chevron-forward" size={17} color={tc.inkSoft} />
                </Pressable>

                <Pressable
                  onPress={() => setAskOff(true)}
                  style={({ pressed }) => [styles.action, pressed && { opacity: 0.85 }]}
                >
                  <Ionicons name="lock-open-outline" size={19} color={tc.terracottaDark} />
                  <Text style={[styles.actionText, { color: tc.terracottaDark }]}>
                    {l.turnOff}
                  </Text>
                </Pressable>
              </>
            ) : (
              <Pressable
                onPress={startSetup}
                style={({ pressed }) => [styles.cta, pressed && { opacity: 0.88 }]}
              >
                <Ionicons name="lock-closed" size={18} color={tc.white} />
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

            <Pressable
              style={styles.dots}
              onPress={() => pinRef.current?.focus()}
              hitSlop={20}
              accessibilityRole="button"
              accessibilityLabel={step === "new" ? l.setTitle : l.confirmTitle}
            >
              <TextInput
                key={step}
                ref={pinRef}
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
            </Pressable>

            {!!error && <Text style={styles.err}>{error}</Text>}

            <Pressable onPress={() => setStep("idle")} hitSlop={10} style={styles.cancel}>
              <Text style={styles.cancelText}>{c.cancel}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
      </KeyboardView>

      <ConfirmModal
        visible={askOff}
        title={l.turnOffAsk}
        message={l.turnOffBody}
        /**
         * ⚠️ Yahan pehle `l.turnOff` tha — "App lock band karo" / "ऐप लॉक बंद
         * करें". Wo settings ki LIST ka label hai (jahan poori jagah hai), par
         * modal ke aadhe-chaudai wale button par wo do line me toot ke button ko
         * hi bigaad deta tha, aur Hindi me to teen line le leta tha.
         *
         * Sawaal upar poora likha hai ("App lock band kar dein?"), isliye button
         * par ek shabd hi kaafi hai — aur ek shabd teenon bhashaon me theek
         * baithta hai.
         */
        confirmLabel={c.yes}
        cancelLabel={c.cancel}
        icon="lock-open-outline"
        destructive
        onConfirm={() => void turnOff()}
        onCancel={() => setAskOff(false)}
      />
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 10,
  },
  back: { padding: 4 },
  title: { fontSize: 21, fontWeight: "800", color: c.ink },
  scroll: { padding: 16, paddingBottom: 40, ...CONTENT },
  hero: { alignItems: "center", paddingVertical: 18 },
  heroIcon: {
    height: 66,
    width: 66,
    borderRadius: 23,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.12)",
  },
  heroTitle: { marginTop: 14, fontSize: 19, fontWeight: "800", color: c.ink },
  heroSub: {
    marginTop: 7,
    fontSize: 13.5,
    lineHeight: 20,
    color: c.inkSoft,
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
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  rowLabel: { fontSize: 14.5, fontWeight: "700", color: c.ink },
  rowHint: { marginTop: 4, fontSize: 12.5, lineHeight: 18, color: c.inkSoft },
  action: {
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginTop: 10,
    height: 54,
    paddingHorizontal: 14,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  actionText: { flex: 1, fontSize: 14.5, fontWeight: "700", color: c.ink },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 20,
    height: 52,
    borderRadius: 17,
    backgroundColor: c.terracotta,
  },
  ctaText: { fontSize: 15, fontWeight: "800", color: c.white },
  setup: { alignItems: "center", paddingTop: 30 },
  setupTitle: { fontSize: 19, fontWeight: "800", color: c.ink },
  setupSub: {
    marginTop: 8,
    fontSize: 13.5,
    lineHeight: 20,
    color: c.inkSoft,
    textAlign: "center",
    paddingHorizontal: 20,
  },
  /**
   * Dots ka patta — lock screen jaisa hi.
   *
   * ⚠️ Dono jagah ek jaisa dikhna aur ek jaisa chalna zaroori hai. Yahan PIN
   * banta hai aur wahan wahi PIN daala jaata hai; naap alag hone par user ko
   * lagta hai ye do alag cheezein hain.
   */
  dots: {
    marginTop: 30,
    flexDirection: "row",
    gap: 18,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 68,
    paddingVertical: 14,
    paddingHorizontal: 22,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  hiddenInput: { position: "absolute", opacity: 0, height: 60, width: "100%" },
  // 15px → 26px: lock screen ke dots ke barabar (wahan wajah poori likhi hai).
  dot: {
    height: 26,
    width: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: c.line,
    backgroundColor: c.cream,
  },
  dotOn: { backgroundColor: c.terracotta, borderColor: c.terracotta },
  err: { marginTop: 18, fontSize: 13.5, fontWeight: "700", color: c.terracottaDark },
  cancel: { marginTop: 26, minHeight: 44, justifyContent: "center", paddingHorizontal: 16 },
  cancelText: { fontSize: 14, fontWeight: "700", color: c.inkSoft },
}));
