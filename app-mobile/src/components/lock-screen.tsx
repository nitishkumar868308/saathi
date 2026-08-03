import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/theme/colors";
import { useT } from "@/lib/i18n/LanguageProvider";
import SaathiLogo from "@/components/saathi-logo";
import {
  PIN_LENGTH,
  checkPin,
  getLockState,
  markUnlocked,
  unlockWithBiometric,
} from "@/lib/app-lock";

/**
 * Lock screen — poore app ke UPAR.
 *
 * Biometric khud hi try hota hai (mount hote hi): jab wo chal jaata hai to user
 * ko kuch karna hi nahi padta, aur wahi is feature ka poora maza hai. Uske
 * peeche PIN hamesha khada rehta hai — ungli na padhe, dhoop me face na chale,
 * ya phone khud PIN maang le, teeno soorat me raasta band nahi hota.
 *
 * ⚠️ Yahan "bhool gaye?" wala koi raasta nahi hai, aur ye jaan-boojh ke hai.
 * PIN sirf is phone par hai — server par uska koi nishaan hi nahi, isliye use
 * "reset" karna bhi kahin se nahi ho sakta. Bhool jaane par asli raasta yahi hai
 * ki app hata ke dobara login karo (Supabase ka account waise ka waisa rehta
 * hai, saara data wapas aa jaata hai). Jhootha "Forgot PIN" button laga dena —
 * jo asal me sirf lock hata deta ho — lock ko dikhawa bana deta.
 */
export function LockScreen({ onUnlocked }: { onUnlocked: () => void }) {
  const { lock: l } = useT();
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [bioOn, setBioOn] = useState(false);
  const [checking, setChecking] = useState(false);

  function done() {
    markUnlocked();
    onUnlocked();
  }

  // Mount hote hi biometric — user ne on kiya ho to.
  useEffect(() => {
    let alive = true;
    void (async () => {
      const st = await getLockState();
      if (!alive) return;
      setBioOn(st.biometricOn);
      if (!st.biometricOn) return;
      const ok = await unlockWithBiometric(l.biometricPrompt, l.enterPin);
      // Fail hone par kuch nahi dikhate — PIN wala raasta neeche khula hi hai.
      // Yahan error dikhana user ko dara deta hai jabki kuch toota nahi.
      if (alive && ok) done();
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function submit(value: string) {
    setChecking(true);
    const ok = await checkPin(value);
    setChecking(false);
    if (ok) {
      done();
      return;
    }
    setError(l.wrongPin);
    setPin("");
  }

  function onChange(v: string) {
    const digits = v.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setPin(digits);
    if (error) setError(null);
    // Poore ank aate hi khud check — 4 ank ke baad "OK" dabwana ek bekaar tap hai.
    if (digits.length === PIN_LENGTH) void submit(digits);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <SaathiLogo size={64} radius={22} />
        <Text style={styles.title}>{l.unlockTitle}</Text>
        <Text style={styles.sub}>{l.unlockSub}</Text>

        {/* Asli input chhupa hua hai; dikhne wale dots neeche hain. Isse har
            platform par apne aap secure keyboard aur paste-block milta hai,
            bina apna keypad likhe. */}
        <Pressable style={styles.dots} onPress={() => {}}>
          <TextInput
            value={pin}
            onChangeText={onChange}
            keyboardType="number-pad"
            secureTextEntry
            autoFocus
            editable={!checking}
            maxLength={PIN_LENGTH}
            style={styles.hiddenInput}
            caretHidden
          />
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View key={i} style={[styles.dot, i < pin.length && styles.dotOn]} />
          ))}
        </Pressable>

        {!!error && <Text style={styles.err}>{error}</Text>}

        {bioOn && (
          <Pressable
            onPress={() =>
              void unlockWithBiometric(l.biometricPrompt, l.enterPin).then(
                (ok) => ok && done(),
              )
            }
            style={({ pressed }) => [styles.bioBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="finger-print" size={19} color={colors.terracotta} />
            <Text style={styles.bioText}>{l.useBiometric}</Text>
          </Pressable>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 28 },
  title: { marginTop: 22, fontSize: 22, fontWeight: "800", color: colors.ink },
  sub: { marginTop: 7, fontSize: 14, color: colors.inkSoft, textAlign: "center" },
  dots: { marginTop: 30, flexDirection: "row", gap: 16, alignItems: "center" },
  // Input dikhta nahi par tappable rehna chahiye — warna keyboard band hone ke
  // baad wapas laane ka koi raasta hi nahi bachta.
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
  bioBtn: {
    marginTop: 30,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 46,
    paddingHorizontal: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.32)",
    backgroundColor: "rgba(194,90,55,0.07)",
  },
  bioText: { fontSize: 14, fontWeight: "700", color: colors.terracotta },
});
