import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors } from "@/theme/colors";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { getPlan, markProfilePlus, type PlanId } from "@/lib/plan";
import {
  purchasesAvailable,
  initPurchases,
  getPlusPackages,
  purchasePlus,
} from "@/lib/purchases";
import { getUserDetails, isDetailsComplete } from "@/lib/user-details";

const FREE_FEATURES = [
  "10 documents tak",
  "Expiry reminders",
  "Voice + text reminders",
  "Hindi + English",
];

const PLUS_FEATURES = [
  "Unlimited documents",
  "Family sharing (parivaar ke docs)",
  "Subah ka daily brief",
  "Priority + WhatsApp reminders",
  "Sab kuch Free wala",
];

export default function Upgrade() {
  const { session } = useAuth();
  const toast = useToast();
  const [yearly, setYearly] = useState(true);
  const [isPlus, setIsPlus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  async function refresh() {
    try {
      const p = await getPlan();
      setIsPlus(p.isPlus);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    initPurchases(session?.user?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const base = yearly ? 999 : 99;
  // GST abhi off (registration nahi) — base price hi lenge.
  // const total = Math.round(base * 1.18);
  const period = yearly ? "/saal" : "/mahina";

  async function startCheckout() {
    if (paying) return;
    const user = session?.user;
    if (!user) {
      toast.show("Pehle login karo", "error");
      return;
    }

    // 1. Details complete? nahi to form bharwao.
    let details = null;
    try {
      details = await getUserDetails();
    } catch {
      /* ignore, treat as incomplete */
    }
    if (!isDetailsComplete(details)) {
      toast.show("Pehle apni details bharo", "info");
      router.push({
        pathname: "/profile-details",
        params: { returnTo: "/upgrade" },
      } as never);
      return;
    }

    // 2. RevenueCat available? (dev build + key chahiye)
    if (!purchasesAvailable()) {
      toast.show("Payment abhi is build me available nahi (dev build chahiye)", "info");
      return;
    }

    setPaying(true);
    try {
      const pkgs = await getPlusPackages();
      const wanted: PlanId = yearly ? "plus_yearly" : "plus_monthly";
      const pkg =
        pkgs.find((p) =>
          String(p.product?.identifier ?? "").includes(wanted),
        ) ?? pkgs[0];
      if (!pkg) {
        toast.show("Koi plan available nahi", "error");
        return;
      }
      const ok = await purchasePlus(pkg);
      if (ok) {
        await markProfilePlus();
        await refresh();
        toast.show("Saathi Plus active ho gaya! 🎉", "success");
      } else {
        toast.show("Purchase complete nahi hua", "error");
      }
    } catch {
      toast.show("Payment shuru nahi hua", "error");
    } finally {
      setPaying(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back} hitSlop={10}>
          <Ionicons name="chevron-back" size={22} color={colors.ink} />
        </Pressable>
        <Text style={styles.headerTitle}>Saathi Plus</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ActivityIndicator color={colors.terracotta} style={{ marginTop: 40 }} />
        ) : isPlus ? (
          <View style={styles.plusActive}>
            <View style={styles.plusBadge}>
              <Ionicons name="checkmark-circle" size={30} color={colors.white} />
            </View>
            <Text style={styles.plusActiveTitle}>Aap Saathi Plus par ho 🎉</Text>
            <Text style={styles.plusActiveSub}>
              Unlimited documents, family sharing aur daily brief — sab unlocked.
            </Text>
          </View>
        ) : (
          <>
            {/* Waitlist reward */}
            <View style={styles.reward}>
              <Ionicons name="gift" size={18} color={colors.terracotta} />
              <Text style={styles.rewardText}>
                Pehle 1000 users ko Saathi Plus 3 mahine FREE!
              </Text>
            </View>

            {/* Billing toggle */}
            <View style={styles.toggle}>
              <Pressable
                onPress={() => setYearly(false)}
                style={[styles.toggleBtn, !yearly && styles.toggleActive]}
              >
                <Text style={[styles.toggleText, !yearly && styles.toggleTextActive]}>
                  Mahina
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setYearly(true)}
                style={[styles.toggleBtn, yearly && styles.toggleActive]}
              >
                <Text style={[styles.toggleText, yearly && styles.toggleTextActive]}>
                  Saal · 2 mahine free
                </Text>
              </Pressable>
            </View>

            {/* Plus card */}
            <View style={styles.plusCard}>
              <Text style={styles.plusName}>Saathi Plus</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>₹{base}</Text>
                <Text style={styles.period}>{period}</Text>
              </View>
              {/* GST abhi off: <Text style={styles.gst}>+ 18% GST · Total ₹{total}{period}</Text> */}

              <View style={{ marginTop: 16, gap: 12 }}>
                {PLUS_FEATURES.map((f) => (
                  <View key={f} style={styles.featRow}>
                    <View style={styles.tickPlus}>
                      <Ionicons name="checkmark" size={13} color={colors.white} />
                    </View>
                    <Text style={styles.featTextPlus}>{f}</Text>
                  </View>
                ))}
              </View>

              <Pressable
                onPress={startCheckout}
                disabled={paying}
                style={({ pressed }) => [
                  styles.payBtn,
                  pressed && { opacity: 0.9 },
                  paying && { opacity: 0.7 },
                ]}
              >
                {paying ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <>
                    <Ionicons name="lock-closed" size={16} color={colors.white} />
                    <Text style={styles.payText}>₹{base} — Securely pay</Text>
                  </>
                )}
              </Pressable>
              <Text style={styles.payNote}>
                Razorpay se secure · UPI, card, netbanking
              </Text>
            </View>

            {/* Free card */}
            <View style={styles.freeCard}>
              <Text style={styles.freeName}>Free</Text>
              <Text style={styles.freePrice}>₹0 / hamesha</Text>
              <View style={{ marginTop: 12, gap: 10 }}>
                {FREE_FEATURES.map((f) => (
                  <View key={f} style={styles.featRow}>
                    <Ionicons
                      name="checkmark-circle-outline"
                      size={16}
                      color={colors.sage}
                    />
                    <Text style={styles.featText}>{f}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}
      </ScrollView>
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
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  content: { padding: 20, paddingBottom: 40 },
  reward: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.25)",
    backgroundColor: "rgba(194,90,55,0.1)",
    padding: 14,
  },
  rewardText: { flex: 1, fontSize: 13.5, fontWeight: "700", color: colors.ink },
  toggle: {
    flexDirection: "row",
    marginTop: 18,
    padding: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  toggleBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
  },
  toggleActive: { backgroundColor: colors.terracotta },
  toggleText: { fontSize: 13, fontWeight: "700", color: colors.inkSoft },
  toggleTextActive: { color: colors.white },
  plusCard: {
    marginTop: 18,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: colors.terracotta,
    backgroundColor: colors.ink,
    padding: 22,
  },
  plusName: { fontSize: 18, fontWeight: "700", color: colors.white },
  priceRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 8, gap: 4 },
  price: { fontSize: 38, fontWeight: "800", color: colors.white },
  period: { fontSize: 15, color: "rgba(247,242,233,0.6)", paddingBottom: 6 },
  gst: { marginTop: 2, fontSize: 12.5, color: "rgba(247,242,233,0.6)", fontWeight: "600" },
  tickPlus: {
    height: 20,
    width: 20,
    borderRadius: 10,
    backgroundColor: colors.terracotta,
    alignItems: "center",
    justifyContent: "center",
  },
  featRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featTextPlus: { fontSize: 14.5, color: "rgba(247,242,233,0.92)", flex: 1 },
  payBtn: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 18,
    backgroundColor: colors.terracotta,
  },
  payText: { color: colors.white, fontWeight: "800", fontSize: 16 },
  payNote: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 12,
    color: "rgba(247,242,233,0.55)",
  },
  freeCard: {
    marginTop: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 20,
  },
  freeName: { fontSize: 17, fontWeight: "700", color: colors.ink },
  freePrice: { marginTop: 4, fontSize: 15, color: colors.inkSoft, fontWeight: "600" },
  featText: { fontSize: 14.5, color: colors.ink, flex: 1 },
  plusActive: { alignItems: "center", paddingTop: 40 },
  plusBadge: {
    height: 68,
    width: 68,
    borderRadius: 24,
    backgroundColor: colors.sage,
    alignItems: "center",
    justifyContent: "center",
  },
  plusActiveTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: "800",
    color: colors.ink,
  },
  plusActiveSub: {
    marginTop: 8,
    fontSize: 15,
    color: colors.inkSoft,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 22,
  },
});
