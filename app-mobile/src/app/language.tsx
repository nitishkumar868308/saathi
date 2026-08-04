import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Animated, Easing } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { makeStyles, useColors } from "@/theme/theme";
import SaathiLogo from "@/components/saathi-logo";
import { useLocale } from "@/lib/i18n/LanguageProvider";
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/dictionaries";

/**
 * App ka landing screen — welcome + bhasha chuno.
 *
 * ⚠️ Yahan ka saara text jaan-boojh ke **English** me hai, dictionary se nahi.
 * Wajah seedhi hai: is screen par user ne abhi bhasha chuni hi nahi. Pehle hum
 * chuni-hui-bhasha ka text dikhate the, to naye user ko Hinglish me "Apni bhasha
 * chuno" dikhta tha — jo Hindi na jaanne wale ke liye bekaar hai. English ek
 * aisi bhasha hai jise teeno group ke log padh lete hain.
 *
 * "Apka Saathi" naam har bhasha me waisa hi rehta hai — wo brand hai, translate
 * nahi hota. Neeche wali tagline zaroor English me hai.
 */

const COPY = {
  welcome: "Welcome to Apka Saathi",
  tagline: "Never forget what matters.",
  choose: "Choose your language",
  continue: "Continue",
  note: "You can change this anytime in Settings.",
};

export default function LanguageSelect() {
  const tc = useColors();
  const styles = useStyles();
  const { locale, setLocale } = useLocale();
  const [picked, setPicked] = useState<Locale>(locale);

  // Logo ka halka sa entry — screen zinda lagti hai, dhakka nahi lagta.
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(rise, {
      toValue: 1,
      duration: 520,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [rise]);

  function done() {
    setLocale(picked);
    router.replace("/login");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.content}>
        {/* Logo center me — pehle brand, phir baaki sab. */}
        <Animated.View
          style={[
            styles.hero,
            {
              opacity: rise,
              transform: [
                { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) },
              ],
            },
          ]}
        >
          <View style={styles.logoGlow} />
          <View style={styles.logo}>
            <SaathiLogo size={84} radius={28} />
          </View>
          <Text style={styles.welcome}>{COPY.welcome}</Text>
          <Text style={styles.tagline}>{COPY.tagline}</Text>
        </Animated.View>

        <Text style={styles.choose}>{COPY.choose}</Text>

        <View style={styles.options}>
          {LOCALES.map((l) => {
            const active = picked === l;
            const meta = LOCALE_META[l];
            return (
              <Pressable
                key={l}
                onPress={() => setPicked(l)}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [
                  styles.opt,
                  active && styles.optActive,
                  pressed && { opacity: 0.9 },
                ]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optNative, active && styles.optActiveText]}>
                    {meta.native}
                  </Text>
                  <Text style={[styles.optSub, active && styles.optActiveSub]}>{meta.sub}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active && <Ionicons name="checkmark" size={15} color={tc.white} />}
                </View>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <Pressable
          onPress={done}
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.9 }]}
        >
          <Text style={styles.ctaText}>{COPY.continue}</Text>
          <Ionicons name="arrow-forward" size={18} color={tc.white} />
        </Pressable>
        <Text style={styles.note}>{COPY.note}</Text>
      </View>
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream, justifyContent: "space-between" },
  content: { paddingHorizontal: 26, paddingTop: 30 },
  hero: { alignItems: "center" },
  logoGlow: {
    position: "absolute",
    top: -22,
    height: 172,
    width: 172,
    borderRadius: 86,
    backgroundColor: "rgba(18,81,86,0.06)",
  },
  logo: {
    height: 84,
    width: 84,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    // Logo apni halki chhaya ke saath thoda uthta hua lage.
    shadowColor: "#125156",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  welcome: {
    marginTop: 22,
    fontSize: 27,
    fontWeight: "800",
    color: c.ink,
    lineHeight: 34,
    textAlign: "center",
    letterSpacing: -0.4,
  },
  tagline: {
    marginTop: 8,
    fontSize: 15.5,
    lineHeight: 22,
    color: c.inkSoft,
    textAlign: "center",
  },
  choose: {
    marginTop: 34,
    fontSize: 12.5,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: c.inkSoft,
  },
  options: { marginTop: 14, gap: 12 },
  opt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  optActive: {
    borderColor: c.terracotta,
    backgroundColor: "rgba(194,90,55,0.06)",
  },
  optNative: { fontSize: 18, fontWeight: "700", color: c.ink },
  optActiveText: { color: c.terracotta },
  optSub: { marginTop: 2, fontSize: 13, color: c.inkSoft },
  optActiveSub: { color: c.terracottaDark },
  radio: {
    height: 26,
    width: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: c.line,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { backgroundColor: c.terracotta, borderColor: c.terracotta },
  footer: { paddingHorizontal: 26, paddingBottom: 20 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 18,
    backgroundColor: c.terracotta,
  },
  ctaText: { fontSize: 17, fontWeight: "800", color: c.white },
  note: { marginTop: 12, textAlign: "center", fontSize: 13, color: c.inkSoft },
}));
