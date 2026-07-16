import { useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { colors } from "@/theme/colors";
import { useToast } from "@/components/toast";
import { getReferralInfo, WEB_URL, type ReferralInfo } from "@/lib/plan";

export default function Referral() {
  const toast = useToast();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getReferralInfo()
      .then(setInfo)
      .catch(() => toast.show("Referral info load nahi hui", "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const link = info?.code ? `${WEB_URL}/r/${info.code}` : WEB_URL;

  async function share() {
    if (!info?.code) return;
    try {
      await Share.share({
        message:
          `Main Apka Saathi use karta hoon — documents ki expiry aur zaroori kaam khud yaad dila deta hai. 🙂\n\n` +
          `Mere code se join karo, dono ko ${info.referralDays} din Saathi Plus FREE:\n${link}`,
      });
    } catch {
      /* user cancelled */
    }
  }

  const earned = info?.daysEarned ?? 0;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Dost bulao</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.terracotta} style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.giftIcon}>
              <Ionicons name="gift" size={30} color={colors.white} />
            </View>
            <Text style={styles.heroTitle}>
              Dono ko {info?.referralDays ?? 15} din Plus FREE
            </Text>
            <Text style={styles.heroSub}>
              Aapka dost aapke code se join kare, apna pehla document daale aur Saathi se
              baat kare — dono ko {info?.referralDays ?? 15} din Saathi Plus mil jaayega.
            </Text>
          </View>

          {/* Code */}
          <Text style={styles.label}>Aapka referral code</Text>
          <View style={styles.codeBox}>
            <Text style={styles.code}>{info?.code ?? "—"}</Text>
          </View>

          <Pressable onPress={share} disabled={!info?.code} style={styles.shareBtn}>
            <Ionicons name="share-social" size={18} color={colors.white} />
            <Text style={styles.shareText}>Dost ko bhejo</Text>
          </Pressable>

          {/* Stats */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{info?.rewardedReferrals ?? 0}</Text>
              <Text style={styles.statLabel}>Successful referrals</Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{earned}</Text>
              <Text style={styles.statLabel}>Din kamaaye</Text>
            </View>
          </View>

          {/* Koi limit nahi — jitne chaaho refer karo */}
          <Text style={styles.capLabel}>
            Jitne dost bulao — har successful referral pe {info?.referralDays ?? 15} din
            Plus. Koi limit nahi.
          </Text>

          {(info?.totalReferrals ?? 0) > (info?.rewardedReferrals ?? 0) && (
            <Text style={styles.pending}>
              {(info!.totalReferrals - info!.rewardedReferrals)} dost join to hue, par abhi
              unhone document + chat poora nahi kiya.
            </Text>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  back: { padding: 4 },
  title: { fontSize: 18, fontWeight: "700", color: colors.ink },
  content: { padding: 20, paddingBottom: 40 },
  hero: { alignItems: "center", paddingVertical: 8 },
  giftIcon: {
    height: 64,
    width: 64,
    borderRadius: 22,
    backgroundColor: colors.terracotta,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink,
    textAlign: "center",
  },
  heroSub: {
    marginTop: 8,
    fontSize: 14.5,
    lineHeight: 21,
    color: colors.inkSoft,
    textAlign: "center",
  },
  label: {
    marginTop: 26,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: "700",
    color: colors.ink,
  },
  codeBox: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: colors.terracotta,
    backgroundColor: "rgba(194,90,55,0.08)",
    paddingVertical: 18,
  },
  code: { fontSize: 28, fontWeight: "800", letterSpacing: 4, color: colors.terracotta },
  shareBtn: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.terracotta,
  },
  shareText: { color: colors.white, fontWeight: "800", fontSize: 16 },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 26 },
  stat: {
    flex: 1,
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 18,
  },
  statNum: { fontSize: 26, fontWeight: "800", color: colors.ink },
  statLabel: { marginTop: 4, fontSize: 12.5, color: colors.inkSoft, textAlign: "center" },
  capLabel: { marginTop: 22, fontSize: 13, fontWeight: "600", color: colors.inkSoft },
  bar: {
    marginTop: 8,
    height: 10,
    borderRadius: 999,
    backgroundColor: colors.line,
    overflow: "hidden",
  },
  barFill: { height: 10, borderRadius: 999, backgroundColor: colors.sage },
  pending: { marginTop: 16, fontSize: 13.5, lineHeight: 20, color: colors.inkSoft },
});
