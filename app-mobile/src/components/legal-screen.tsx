import { View, Text, ScrollView, Pressable, StyleSheet, Linking } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors } from "@/theme/colors";

export type LegalSection = { h: string; p: string; icon?: keyof typeof Ionicons.glyphMap };

/** Privacy / About / Help jaisi text screens ke liye ek common, sundar layout. */
export default function LegalScreen({
  title,
  intro,
  sections,
  heroIcon = "sparkles",
  contactEmail,
  contactLabel,
}: {
  title: string;
  intro?: string;
  sections: LegalSection[];
  heroIcon?: keyof typeof Ionicons.glyphMap;
  /** Diya to niche ek "Email karein" CTA card dikhega. */
  contactEmail?: string;
  contactLabel?: string;
}) {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {title}
        </Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name={heroIcon} size={28} color={colors.terracotta} />
          </View>
          <Text style={styles.heroTitle}>{title}</Text>
          {intro ? <Text style={styles.intro}>{intro}</Text> : null}
        </View>

        {/* Sections as cards */}
        {sections.map((s, i) => (
          <View key={i} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={styles.cardIcon}>
                <Ionicons name={s.icon ?? "ellipse-outline"} size={18} color={colors.terracotta} />
              </View>
              <Text style={styles.h}>{s.h}</Text>
            </View>
            <Text style={styles.p}>{s.p}</Text>
          </View>
        ))}

        {/* Contact CTA */}
        {contactEmail ? (
          <Pressable
            onPress={() => Linking.openURL(`mailto:${contactEmail}`).catch(() => {})}
            style={({ pressed }) => [styles.contact, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="mail-outline" size={20} color={colors.white} />
            <Text style={styles.contactText}>{contactLabel ?? contactEmail}</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
    ...CONTENT,
  },
  back: {
    height: 38,
    width: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  headerTitle: { flex: 1, textAlign: "center", fontSize: 16, fontWeight: "700", color: colors.ink },
  content: { padding: 20, paddingBottom: 44, ...CONTENT },
  hero: { alignItems: "center", paddingVertical: 12, marginBottom: 8 },
  heroIcon: {
    height: 64,
    width: 64,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.12)",
    marginBottom: 14,
  },
  heroTitle: { fontSize: 24, fontWeight: "800", color: colors.ink, textAlign: "center" },
  intro: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 23,
    color: colors.inkSoft,
    textAlign: "center",
    maxWidth: 340,
  },
  card: {
    marginTop: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 16,
  },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8 },
  cardIcon: {
    height: 34,
    width: 34,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.10)",
  },
  h: { flex: 1, fontSize: 15.5, fontWeight: "700", color: colors.ink },
  p: { fontSize: 14.5, lineHeight: 22, color: colors.inkSoft },
  contact: {
    marginTop: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.terracotta,
  },
  contactText: { color: colors.white, fontWeight: "700", fontSize: 15 },
});
