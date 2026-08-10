import { useCallback, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  Share,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { router, useFocusEffect } from "expo-router";

import { makeStyles, useColors } from "@/theme/theme";
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
  const tc = useColors();
  const styles = useStyles();
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

  /**
   * Code/link clipboard me.
   *
   * Share sheet har baar kholna bhaari lagta hai — aksar user ko bas code
   * chipkana hota hai (WhatsApp me, ya kisi ko bol ke). Isliye code aur link
   * dono ke saath ek tap wala copy hai.
   */
  async function copy(value: string, doneMsg: string) {
    if (!value) return;
    try {
      await Clipboard.setStringAsync(value);
      toast.show(doneMsg, "success");
    } catch {
      toast.show(t.loadError, "error");
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={tc.ink} />
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
              <Ionicons name="gift" size={30} color={tc.white} />
            </View>
            <Text style={styles.heroTitle}>{tpl(t.heroTitle, { d: days })}</Text>
            <Text style={styles.heroSub}>{tpl(t.heroSub, { d: days })}</Text>
          </View>

          {unlocked ? (
            <>
              {/* Code — dikhta bhi hai, ek tap me copy bhi ho jaata hai. */}
              <Text style={styles.label}>{t.yourCode}</Text>
              <Pressable
                onPress={() => copy(info?.code ?? "", t.copiedCode)}
                disabled={!info?.code}
                style={({ pressed }) => [styles.codeBox, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.code}>{info?.code ?? "—"}</Text>
                <View style={styles.copyChip}>
                  <Ionicons name="copy-outline" size={15} color={tc.terracotta} />
                  <Text style={styles.copyChipText}>{t.copyCode}</Text>
                </View>
              </Pressable>

              {/* Link — WhatsApp me bhejne ke liye aksar poora link chahiye hota hai. */}
              <Text style={styles.label}>{t.yourLink}</Text>
              <Pressable
                onPress={() => copy(link, t.copiedLink)}
                disabled={!info?.code}
                style={({ pressed }) => [styles.linkBox, pressed && { opacity: 0.85 }]}
              >
                <Text style={styles.linkText} numberOfLines={1}>
                  {link}
                </Text>
                <View style={styles.linkCopyBtn}>
                  <Ionicons name="copy-outline" size={17} color={tc.white} />
                </View>
              </Pressable>

              <Pressable onPress={share} disabled={!info?.code} style={styles.shareBtn}>
                <Ionicons name="share-social" size={18} color={tc.white} />
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
  const tc = useColors();
  const styles = useStyles();
  return (
    <View style={styles.cond}>
      <View style={[styles.condTick, done ? styles.condTickDone : styles.condTickTodo]}>
        <Ionicons
          name={done ? "checkmark" : "ellipse-outline"}
          size={16}
          // Ho chuka wala gola sage ka hai — uspar safed nishaan dono theme
          // me kamzor tha (3.4:1 / 2.4:1).
          color={done ? tc.onAccent : tc.inkSoft}
        />
      </View>
      <Text style={[styles.condLabel, done && styles.condLabelDone]}>{label}</Text>
      {!done && (
        <Pressable onPress={onPress} style={styles.condCta}>
          <Text style={styles.condCtaText}>{cta}</Text>
          <Ionicons name="arrow-forward" size={13} color={tc.terracotta} />
        </Pressable>
      )}
    </View>
  );
}

const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  back: { padding: 4 },
  title: { fontSize: 18, fontWeight: "700", color: c.ink },
  content: { padding: 20, paddingBottom: 40, ...CONTENT },
  hero: { alignItems: "center", paddingVertical: 8 },
  giftIcon: {
    height: 64,
    width: 64,
    borderRadius: 22,
    backgroundColor: c.terracotta,
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: {
    marginTop: 14,
    fontSize: 22,
    fontWeight: "800",
    color: c.ink,
    textAlign: "center",
  },
  heroSub: {
    marginTop: 8,
    fontSize: 14.5,
    lineHeight: 21,
    color: c.inkSoft,
    textAlign: "center",
  },
  /* Locked */
  lockCard: {
    marginTop: 26,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    padding: 20,
  },
  lockTitle: { fontSize: 17, fontWeight: "800", color: c.ink },
  lockSub: { marginTop: 4, fontSize: 13.5, lineHeight: 20, color: c.inkSoft, marginBottom: 8 },
  cond: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: c.line,
  },
  condTick: {
    height: 28,
    width: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  condTickDone: { backgroundColor: c.sage },
  condTickTodo: { backgroundColor: c.creamDeep },
  condLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: c.ink },
  condLabelDone: { color: c.inkSoft, textDecorationLine: "line-through" },
  condCta: { flexDirection: "row", alignItems: "center", gap: 3 },
  condCtaText: { fontSize: 13.5, fontWeight: "700", color: c.terracotta },
  /* Unlocked */
  label: {
    marginTop: 26,
    marginBottom: 10,
    fontSize: 15,
    fontWeight: "700",
    color: c.ink,
  },
  codeBox: {
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 2,
    borderStyle: "dashed",
    borderColor: c.terracotta,
    backgroundColor: "rgba(194,90,55,0.08)",
    paddingVertical: 18,
  },
  code: { fontSize: 28, fontWeight: "800", letterSpacing: 4, color: c.terracotta },
  copyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.35)",
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  copyChipText: { fontSize: 12.5, fontWeight: "700", color: c.terracotta },
  linkBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingLeft: 14,
    paddingRight: 6,
    paddingVertical: 6,
  },
  linkText: { flex: 1, fontSize: 13.5, fontWeight: "600", color: c.inkSoft },
  linkCopyBtn: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    backgroundColor: c.terracotta,
  },
  shareBtn: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 18,
    backgroundColor: c.terracotta,
  },
  shareText: { color: c.white, fontWeight: "800", fontSize: 16 },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 26 },
  stat: {
    flex: 1,
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingVertical: 18,
  },
  statNum: { fontSize: 26, fontWeight: "800", color: c.ink },
  statLabel: { marginTop: 4, fontSize: 12.5, color: c.inkSoft, textAlign: "center" },
  capLabel: { marginTop: 22, fontSize: 13, fontWeight: "600", color: c.inkSoft, lineHeight: 19 },
  pending: { marginTop: 16, fontSize: 13.5, lineHeight: 20, color: c.inkSoft },
}));
