import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";

import { colors } from "@/theme/colors";
import { useAuth } from "@/components/auth-provider";
import { getMyRewards, type MyRewards, type MyReferral } from "@/lib/plan";

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

const SOURCE: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  first_n: { label: "Shuruaati offer se", icon: "sparkles" },
  referral: { label: "Referral se", icon: "gift" },
  google_play: { label: "Aapne kharida hai", icon: "card" },
  admin: { label: "Team ne diya", icon: "shield-checkmark" },
  reward: { label: "Reward se", icon: "gift" },
};

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
  const { rewardsVersion, refreshRewards } = useAuth();
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
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.title}>Meri membership</Text>
        <View style={{ width: 22 }} />
      </View>

      {loading ? (
        <ActivityIndicator color={colors.terracotta} style={{ marginTop: 40 }} />
      ) : !data ? (
        <View style={styles.center}>
          <Text style={styles.muted}>Info load nahi hui. Neeche kheench ke dobara try karo.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.terracotta}
            />
          }
        >
          <PlanCard data={data} />

          <Section title="Aapka safar" />
          <Row icon="calendar" label="Saathi se jude" value={fmt(data.joined_at)} />
          {data.first_n_granted && (
            <Row
              icon="sparkles"
              label={
                data.first_n_rank
                  ? `Shuruaati offer — aap #${data.first_n_rank} the`
                  : "Shuruaati offer"
              }
              value={`${data.first_n_days ?? 0} din · ${fmt(data.first_n_granted_at)}`}
            />
          )}
          {data.referred_by_code && (
            <Row icon="person-add" label="Kis code se aaye" value={data.referred_by_code} />
          )}
          {data.referral_days_earned > 0 && (
            <Row
              icon="gift"
              label="Referral se kamaaye"
              value={`${data.referral_days_earned} / ${data.cap_days} din`}
            />
          )}

          {data.referrals_enabled && (
            <>
              <Section
                title="Aapke referrals"
                right={
                  <Pressable onPress={() => router.push("/referral" as never)}>
                    <Text style={styles.link}>Bulao</Text>
                  </Pressable>
                }
              />
              {data.referrals.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="people-outline" size={22} color={colors.inkSoft} />
                  <Text style={styles.emptyText}>
                    Abhi kisi ne aapke code se join nahi kiya.
                  </Text>
                </View>
              ) : (
                data.referrals.map((r) => <ReferralRow key={r.id} r={r} />)
              )}
              {data.referrals.some((r) => !r.rewarded_at) && (
                <Text style={styles.note}>
                  Din tabhi milte hain jab dost apna pehla document daale AUR Saathi se ek baar
                  baat kare.
                </Text>
              )}
            </>
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

/* ------------------------------- pieces ------------------------------- */

function PlanCard({ data }: { data: MyRewards }) {
  const st = stateOf(data);
  const src = data.plan_source ? SOURCE[data.plan_source] : undefined;
  const plus = st.kind === "plus_forever" || st.kind === "plus_until";

  return (
    <View style={[styles.planCard, plus ? styles.planPlus : styles.planFree]}>
      <View style={styles.planTop}>
        <View style={styles.planBadge}>
          <Ionicons
            name={plus ? "star" : "leaf-outline"}
            size={14}
            color={plus ? colors.white : colors.inkSoft}
          />
          <Text style={[styles.planBadgeText, plus && { color: colors.white }]}>
            {plus ? "Saathi Plus" : "Free plan"}
          </Text>
        </View>
        {st.kind === "plus_until" && (
          <Text style={styles.planLeft}>{st.left} din bache</Text>
        )}
      </View>

      <Text style={[styles.planLine, plus && { color: colors.white }]}>
        {st.kind === "plus_forever" && "Aapka Plus chalu hai — koi expiry nahi."}
        {st.kind === "plus_until" && `Plus ${fmt(st.until)} tak active hai.`}
        {st.kind === "expired" && `Plus ${fmt(st.until)} ko khatam ho gaya.`}
        {st.kind === "free" && "Free plan pe ho — 10 documents tak."}
      </Text>

      {plus && src && (
        <View style={styles.planSrc}>
          <Ionicons name={src.icon} size={13} color="rgba(255,255,255,0.85)" />
          <Text style={styles.planSrcText}>{src.label}</Text>
        </View>
      )}

      {!plus && (
        <Pressable onPress={() => router.push("/upgrade" as never)} style={styles.upgradeBtn}>
          <Text style={styles.upgradeText}>Plus lo</Text>
          <Ionicons name="arrow-forward" size={15} color={colors.white} />
        </Pressable>
      )}
    </View>
  );
}

function ReferralRow({ r }: { r: MyReferral }) {
  const done = Boolean(r.rewarded_at);
  const who = r.name?.trim() || r.email || "Naya dost";

  // Reward mila par din 0 — matlab us waqt cap bhar chuka tha.
  const detail = !done
    ? `Joined ${fmt(r.joined_at)} · abhi pending`
    : r.cap_skipped
      ? `${fmt(r.rewarded_at)} · cap bhar chuka tha`
      : `${fmt(r.rewarded_at)} · +${r.days} din`;

  return (
    <View style={styles.refRow}>
      <View style={[styles.refIcon, done ? styles.refIconDone : styles.refIconPending]}>
        <Ionicons
          name={done ? "checkmark" : "time-outline"}
          size={16}
          color={done ? colors.white : colors.inkSoft}
        />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.refWho} numberOfLines={1}>
          {who}
        </Text>
        <Text style={styles.refDetail}>{detail}</Text>
      </View>
      {done && !r.cap_skipped && <Text style={styles.refDays}>+{r.days}</Text>}
    </View>
  );
}

function Section({ title, right }: { title: string; right?: React.ReactNode }) {
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
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <Ionicons name={icon} size={16} color={colors.terracotta} />
      </View>
      <Text style={styles.rowLabel} numberOfLines={2}>
        {label}
      </Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

/* ------------------------------- styles ------------------------------- */

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
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 30 },
  muted: { fontSize: 14, color: colors.inkSoft, textAlign: "center" },

  planCard: { borderRadius: 22, padding: 20 },
  planPlus: { backgroundColor: colors.terracotta },
  planFree: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
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
  planBadgeText: { fontSize: 12.5, fontWeight: "800", color: colors.inkSoft },
  planLeft: { fontSize: 12.5, fontWeight: "700", color: "rgba(255,255,255,0.9)" },
  planLine: { marginTop: 14, fontSize: 16, fontWeight: "700", color: colors.ink, lineHeight: 23 },
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
    backgroundColor: colors.terracotta,
  },
  upgradeText: { color: colors.white, fontWeight: "800", fontSize: 15 },

  sectionRow: {
    marginTop: 28,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  section: { fontSize: 15, fontWeight: "800", color: colors.ink },
  link: { fontSize: 13.5, fontWeight: "700", color: colors.terracotta },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
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
  rowLabel: { flex: 1, fontSize: 14, color: colors.inkSoft },
  rowValue: { fontSize: 13.5, fontWeight: "700", color: colors.ink, textAlign: "right" },

  refRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  refIcon: { height: 32, width: 32, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  refIconDone: { backgroundColor: colors.sage },
  refIconPending: { backgroundColor: colors.creamDeep },
  refWho: { fontSize: 14.5, fontWeight: "700", color: colors.ink },
  refDetail: { marginTop: 2, fontSize: 12.5, color: colors.inkSoft },
  refDays: { fontSize: 15, fontWeight: "800", color: colors.sage },

  empty: {
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 26,
  },
  emptyText: { fontSize: 13.5, color: colors.inkSoft },
  note: { marginTop: 12, fontSize: 12.5, lineHeight: 19, color: colors.inkSoft },
});
