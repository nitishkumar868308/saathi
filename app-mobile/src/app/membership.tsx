import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { makeStyles, useColors } from "@/theme/theme";
import { useAuth } from "@/components/auth-provider";
import { getMyRewards, type MyRewards, type MyReferral } from "@/lib/plan";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl, type Dict } from "@/lib/i18n/dictionaries";
import { ScreenLoader } from "@/components/loader";

/* ------------------------------ helpers ------------------------------ */

function fmt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Aaj se kitne din bache. Negative = nikal chuka. */
function daysLeft(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

const SOURCE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  referral: "gift",
  google_play: "card",
  admin: "shield-checkmark",
  reward: "gift",
};

function sourceLabel(m: Dict["membership"], src: string | null): string | undefined {
  switch (src) {
    case "referral":
      return m.sourceReferral;
    case "google_play":
      return m.sourcePaid;
    case "admin":
      return m.sourceAdmin;
    case "reward":
      return m.sourceReward;
    default:
      return undefined;
  }
}

/**
 * Plan ki asli haalat. `plan_expires_at` null + plus = chalti hui subscription
 * (ya lifetime) — expiry set hi nahi hai. Date nikal chuki ho to plan column
 * abhi bhi 'plus' keh sakta hai, isliye date pe bharosa karo.
 */
type State =
  | { kind: "free" }
  | { kind: "plus_forever" }
  | { kind: "plus_until"; until: string; left: number }
  | { kind: "expired"; until: string };

function stateOf(r: MyRewards): State {
  if (r.plan !== "plus") return { kind: "free" };
  if (!r.plan_expires_at) return { kind: "plus_forever" };
  const left = daysLeft(r.plan_expires_at);
  return left > 0
    ? { kind: "plus_until", until: r.plan_expires_at, left }
    : { kind: "expired", until: r.plan_expires_at };
}

/* ------------------------------- screen ------------------------------- */

export default function Membership() {
  const tc = useColors();
  const styles = useStyles();
  const { rewardsVersion, refreshRewards } = useAuth();
  const { membership: m } = useT();
  const [data, setData] = useState<MyRewards | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const r = await getMyRewards();
    setData(r);
    setLoading(false);
  }, []);

  // rewardsVersion bhi dep hai — grant hote hi screen apne aap sach dikhaye.
  useEffect(() => {
    void load();
  }, [load, rewardsVersion]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshRewards(); // dobara claim/qualify check karo
    await load();
    setRefreshing(false);
  }, [refreshRewards, load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={tc.ink} />
        </Pressable>
        <Text style={styles.title}>{m.title}</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ScreenLoader />
      ) : !data ? (
        <View style={styles.center}>
          <Text style={styles.muted}>{m.title} ✕</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={tc.terracotta}
            />
          }
        >
          <PlanCard data={data} m={m} />

          <Section title={m.journey} />
          <Row icon="calendar" label={m.joined} value={fmt(data.joined_at)} />
          {data.referred_by_code && (
            <Row icon="person-add" label={m.referredByCode} value={data.referred_by_code} />
          )}
          {data.referral_days_earned > 0 && (
            <Row icon="gift" label={m.referralEarned} value={tpl(m.daysTpl, { n: data.referral_days_earned })} />
          )}

          {data.referrals_enabled && (
            <>
              <Section
                title={m.yourReferrals}
                right={
                  <Pressable onPress={() => router.push("/referral" as never)}>
                    <Text style={styles.link}>{m.invite}</Text>
                  </Pressable>
                }
              />
              {data.referrals.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="people-outline" size={22} color={tc.inkSoft} />
                  <Text style={styles.emptyText}>{m.noReferrals}</Text>
                </View>
              ) : (
                data.referrals.map((r) => <ReferralRow key={r.id} r={r} m={m} />)
              )}
              {data.referrals.some((r) => !r.rewarded_at) && (
                <Text style={styles.note}>{m.referNote}</Text>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ------------------------------- pieces ------------------------------- */

function PlanCard({ data, m }: { data: MyRewards; m: Dict["membership"] }) {
  const tc = useColors();
  const styles = useStyles();
  const st = stateOf(data);
  const srcLabel = data.plan_source ? sourceLabel(m, data.plan_source) : undefined;
  const srcIcon = data.plan_source ? SOURCE_ICON[data.plan_source] : undefined;
  const plus = st.kind === "plus_forever" || st.kind === "plus_until";

  return (
    <View style={[styles.planCard, plus ? styles.planPlus : styles.planFree]}>
      <View style={styles.planTop}>
        <View style={styles.planBadge}>
          <Ionicons
            name={plus ? "star" : "leaf-outline"}
            size={14}
            color={plus ? tc.white : tc.inkSoft}
          />
          <Text style={[styles.planBadgeText, plus && { color: tc.white }]}>
            {plus ? m.planPlus : m.planFree}
          </Text>
        </View>
        {st.kind === "plus_until" && (
          <Text style={styles.planLeft}>{tpl(m.daysLeft, { n: st.left })}</Text>
        )}
      </View>

      <Text style={[styles.planLine, plus && { color: tc.white }]}>
        {st.kind === "plus_forever" && m.lineForever}
        {st.kind === "plus_until" && tpl(m.lineUntil, { date: fmt(st.until) })}
        {st.kind === "expired" && tpl(m.lineExpired, { date: fmt(st.until) })}
        {st.kind === "free" && m.lineFree}
      </Text>

      {plus && srcLabel && srcIcon && (
        <View style={styles.planSrc}>
          <Ionicons name={srcIcon} size={13} color="rgba(255,255,255,0.85)" />
          <Text style={styles.planSrcText}>{srcLabel}</Text>
        </View>
      )}

      {!plus && (
        <Pressable onPress={() => router.push("/upgrade" as never)} style={styles.upgradeBtn}>
          <Text style={styles.upgradeText}>{m.plusLo}</Text>
          <Ionicons name="arrow-forward" size={15} color={tc.white} />
        </Pressable>
      )}
    </View>
  );
}

function ReferralRow({ r, m }: { r: MyReferral; m: Dict["membership"] }) {
  const tc = useColors();
  const styles = useStyles();
  const done = Boolean(r.rewarded_at);
  const who = r.name?.trim() || r.email || "—";

  const detail = done
    ? `${fmt(r.rewarded_at)} · +${tpl(m.daysTpl, { n: r.days })}`
    : `${fmt(r.joined_at)} · ${m.pending}`;

  return (
    <View style={styles.refRow}>
      <View style={[styles.refIcon, done ? styles.refIconDone : styles.refIconPending]}>
        <Ionicons
          name={done ? "checkmark" : "time-outline"}
          size={16}
          color={done ? tc.white : tc.inkSoft}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.refWho} numberOfLines={2}>
          {who}
        </Text>
        <Text style={styles.refDetail}>{detail}</Text>
      </View>
      {done && <Text style={styles.refDays}>+{r.days}</Text>}
    </View>
  );
}

function Section({ title, right }: { title: string; right?: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.section}>{title}</Text>
      {right}
    </View>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  const tc = useColors();
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={16} color={tc.terracotta} />
      </View>
      <Text style={styles.rowLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

/* ------------------------------- styles ------------------------------- */

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
  content: { padding: 20, paddingBottom: 40 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  muted: { fontSize: 14, color: c.inkSoft, textAlign: "center" },

  planCard: { borderRadius: 22, padding: 20 },
  planPlus: { backgroundColor: c.terracotta },
  planFree: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.line },
  planTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  planBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: "rgba(255,255,255,0.18)",
  },
  planBadgeText: { fontSize: 12.5, fontWeight: "800", color: c.inkSoft },
  planLeft: { fontSize: 12.5, fontWeight: "700", color: "rgba(255,255,255,0.9)" },
  planLine: { marginTop: 14, fontSize: 16, fontWeight: "700", color: c.ink, lineHeight: 23 },
  planSrc: { marginTop: 8, flexDirection: "row", alignItems: "center", gap: 6 },
  planSrcText: { fontSize: 13, color: "rgba(255,255,255,0.85)", fontWeight: "600" },
  upgradeBtn: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    height: 46,
    borderRadius: 14,
    backgroundColor: c.terracotta,
  },
  upgradeText: { color: c.white, fontWeight: "800", fontSize: 15 },

  sectionRow: {
    marginTop: 28,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  section: { fontSize: 15, fontWeight: "800", color: c.ink },
  link: { fontSize: 13.5, fontWeight: "700", color: c.terracotta },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginBottom: 8,
  },
  rowIcon: {
    height: 32,
    width: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.10)",
  },
  rowLabel: { flex: 1, fontSize: 14, color: c.inkSoft },
  rowValue: { fontSize: 13.5, fontWeight: "700", color: c.ink, textAlign: "right" },

  refRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  refIcon: { height: 32, width: 32, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  refIconDone: { backgroundColor: c.sage },
  refIconPending: { backgroundColor: c.creamDeep },
  refWho: { fontSize: 14.5, fontWeight: "700", color: c.ink },
  refDetail: { marginTop: 2, fontSize: 12.5, color: c.inkSoft },
  refDays: { fontSize: 15, fontWeight: "800", color: c.sage },

  empty: {
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingVertical: 26,
  },
  emptyText: { fontSize: 13.5, color: c.inkSoft },
  note: { marginTop: 12, fontSize: 12.5, lineHeight: 19, color: c.inkSoft },
}));
