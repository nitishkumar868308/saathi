import { useState } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { colors } from "@/theme/colors";
import SaathiMark from "@/components/saathi-mark";
import { useLocale } from "@/lib/i18n/LanguageProvider";
import { LOCALES, LOCALE_META, dictionaries, type Locale } from "@/lib/i18n/dictionaries";

/**
 * Pehli baar: welcome + bhasha chuno. Jo user chunta hai wahi poore app me
 * chalti hai (AsyncStorage me save). Text har option apni bhasha me dikhta hai.
 */
export default function LanguageSelect() {
  const { locale, setLocale } = useLocale();
  const [picked, setPicked] = useState<Locale>(locale);

  // Preview text picked bhasha me — taaki chunte hi feel aa jaye.
  const t = dictionaries[picked].langSelect;

  function done() {
    setLocale(picked);
    router.replace("/login");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.logo}>
          <SaathiMark size={38} color={colors.white} />
        </View>

        <Text style={styles.welcome}>{t.welcome}</Text>
        <Text style={styles.tagline}>{t.tagline}</Text>

        <Text style={styles.choose}>{t.choose}</Text>

        <View style={styles.options}>
          {LOCALES.map((l) => {
            const active = picked === l;
            const meta = LOCALE_META[l];
            return (
              <Pressable
                key={l}
                onPress={() => setPicked(l)}
                style={[styles.opt, active && styles.optActive]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={[styles.optNative, active && styles.optActiveText]}>
                    {meta.native}
                  </Text>
                  <Text style={[styles.optSub, active && styles.optActiveSub]}>{meta.sub}</Text>
                </View>
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active && <Ionicons name="checkmark" size={15} color={colors.white} />}
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
          <Text style={styles.ctaText}>{t.continue}</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.white} />
        </Pressable>
        <Text style={styles.note}>{t.changeLater}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream, justifyContent: "space-between" },
  content: { paddingHorizontal: 26, paddingTop: 40 },
  logo: {
    height: 72,
    width: 72,
    borderRadius: 24,
    backgroundColor: colors.terracotta,
    alignItems: "center",
    justifyContent: "center",
  },
  welcome: { marginTop: 26, fontSize: 28, fontWeight: "800", color: colors.ink, lineHeight: 34 },
  tagline: { marginTop: 10, fontSize: 15.5, lineHeight: 22, color: colors.inkSoft },
  choose: {
    marginTop: 34,
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.inkSoft,
  },
  options: { marginTop: 14, gap: 12 },
  opt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  optActive: {
    borderColor: colors.terracotta,
    backgroundColor: "rgba(194,90,55,0.06)",
  },
  optNative: { fontSize: 18, fontWeight: "700", color: colors.ink },
  optActiveText: { color: colors.terracotta },
  optSub: { marginTop: 2, fontSize: 13, color: colors.inkSoft },
  optActiveSub: { color: colors.terracottaDark },
  radio: {
    height: 26,
    width: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
  },
  radioActive: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  footer: { paddingHorizontal: 26, paddingBottom: 20 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.terracotta,
  },
  ctaText: { fontSize: 17, fontWeight: "800", color: colors.white },
  note: { marginTop: 12, textAlign: "center", fontSize: 13, color: colors.inkSoft },
});
