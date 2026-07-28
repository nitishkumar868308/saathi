import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";

import { colors } from "@/theme/colors";
import { useToast } from "@/components/toast";
import {
  getReferralInfo,
  getReferralGate,
  WEB_URL,
  type ReferralInfo,
  type ReferralGate,
} from "@/lib/plan";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";
import { ScreenLoader } from "@/components/loader";

export default function Referral() {
  const toast = useToast();
  const { referral: t } = useT();
  const [info, setInfo] = useState<ReferralInfo | null>(null);
  const [gate, setGate] = useState<ReferralGate | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [i, g] = await Promise.all([getReferralInfo(), getReferralGate()]);
      setInfo(i);
      setGate(g);
    } catch {
      toast.show(t.loadError, "error");
    } finally {
      setLoading(false);
    }
  }, [toast, t.loadError]);

  // Focus pe reload — user document/reminder/profile karke wapas aaye to unlock dikhe.
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const days = info?.referralDays ?? 15;
  const link = info?.code ? `${WEB_URL}/r/${info.code}` : WEB_URL;
  const earned = info?.daysEarned ?? 0;
  const unlocked = gate?.unlocked ?? false;

  async function share() {
    if (!info?.code) return;
    try {
      await Share.share({ message: tpl(t.shareMessage, { d: days, link }) });
    } catch {
      /* user cancelled */
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>{t.title}</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ScreenLoader />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero */}
          <View style={styles.hero}>
            <View style={styles.giftIcon}>
              <Ionicons name="gift" size={30} color={colors.white} />
            </View>
            <Text style={styles.heroTitle}>{tpl(t.heroTitle, { d: days })}</Text>
            <Text style={styles.heroSub}>{tpl(t.heroSub, { d: days })}</Text>
          </View>

          {unlocked ? (
            <>
              {/* Code */}
              <Text style={styles.label}>{t.yourCode}</Text>
              <View style={styles.codeBox}>
                <Text style={styles.code}>{info?.code ?? "—"}</Text>
              </View>

              <Pressable onPress={share} disabled={!info?.code} style={styles.shareBtn}>
                <Ionicons name="share-social" size={18} color={colors.white} />
                <Text style={styles.shareText}>{t.shareBtn}</Text>
              </Pressable>

              {/* Stats */}
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{info?.rewardedReferrals ?? 0}</Text>
                  <Text style={styles.statLabel}>{t.statReferrals}</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={styles.statNum}>{earned}</Text>
                  <Text style={styles.statLabel}>{t.statDays}</Text>
                </View>
              </View>

              <Text style={styles.capLabel}>{tpl(t.noLimit, { d: days })}</Text>

              {(info?.totalReferrals ?? 0) > (info?.rewardedReferrals ?? 0) && (
                <Text style={styles.pending}>
                  {tpl(t.pending, {
                    x: (info?.totalReferrals ?? 0) - (info?.rewardedReferrals ?? 0),
                  })}
                </Text>
              )}
            </>
          ) : (
            /* Locked — conditions checklist */
            <View style={styles.lockCard}>
              <Text style={styles.lockTitle}>{t.lockedTitle}</Text>
              <Text style={styles.lockSub}>{t.lockedSub}</Text>

              <Condition
                done={gate?.hasDocument ?? false}
                label={t.condDocument}
                cta={t.goDo}
                onPress={() => router.push("/add-document")}
              />
              <Condition
                done={gate?.hasReminder ?? false}
                label={t.condReminder}
                cta={t.goDo}
                onPress={() => router.push("/add-reminder")}
              />
            </View>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Condition({
  done,
  label,
  cta,
  onPress,
}: {
  done: boolean;
  label: string;
  cta: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.cond}>
      <View style={[styles.condTick, done ? styles.condTickDone : styles.condTickTodo]}>
        <Ionicons
          name={done ? "checkmark" : "ellipse-outline"}
          size={16}
          color={done ? colors.white : colors.inkSoft}
        />
      </View>
      <Text style={[styles.condLabel, done && styles.condLabelDone]}>{label}</Text>
      {!done && (
        <Pressable onPress={onPress} style={styles.condCta}>
          <Text style={styles.condCtaText}>{cta}</Text>
          <Ionicons name="arrow-forward" size={13} color={colors.terracotta} />
        </Pressable>
      )}
    </View>
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
  /* Locked */
  lockCard: {
    marginTop: 26,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 20,
  },
  lockTitle: { fontSize: 17, fontWeight: "800", color: colors.ink },
  lockSub: { marginTop: 4, fontSize: 13.5, lineHeight: 20, color: colors.inkSoft, marginBottom: 8 },
  cond: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  condTick: {
    height: 28,
    width: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  condTickDone: { backgroundColor: colors.sage },
  condTickTodo: { backgroundColor: colors.creamDeep },
  condLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink },
  condLabelDone: { color: colors.inkSoft, textDecorationLine: "line-through" },
  condCta: { flexDirection: "row", alignItems: "center", gap: 3 },
  condCtaText: { fontSize: 13.5, fontWeight: "700", color: colors.terracotta },
  /* Unlocked */
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
  capLabel: { marginTop: 22, fontSize: 13, fontWeight: "600", color: colors.inkSoft, lineHeight: 19 },
  pending: { marginTop: 16, fontSize: 13.5, lineHeight: 20, color: colors.inkSoft },
});
