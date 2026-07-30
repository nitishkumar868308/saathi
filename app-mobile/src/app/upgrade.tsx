import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { colors } from "@/theme/colors";
import { LoaderOverlay, ScreenLoader } from "@/components/loader";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { getPlan, markProfilePlus, enforcePlanLimits, type PlanId } from "@/lib/plan";
import {
  purchasesAvailable,
  initPurchases,
  getPlusPackages,
  purchasePlus,
} from "@/lib/purchases";
import { getUserDetails, isDetailsComplete } from "@/lib/user-details";
import { logEvent } from "@/lib/analytics";
import { useOffers } from "@/lib/use-offers";
import {
  detectCountry,
  getPricingRow,
  localAmount,
  type LocalPricing,
} from "@/lib/pricing";
import { countryFromTimezone } from "@/lib/tz-country";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";

export default function Upgrade() {
  const { session, rewardsVersion } = useAuth();
  const toast = useToast();
  const offers = useOffers();
  const { upgrade: u } = useT();
  const PLUS_FEATURES = u.plusFeatures;
  const [yearly, setYearly] = useState(true);
  const [isPlus, setIsPlus] = useState(false);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState(false);

  // Country-wise pricing (#11): IP se country → local price. Profile se mismatch
  // ho to ek baar modal poochhta hai kaunse desh ka price dikhaayein.
  const [pricing, setPricing] = useState<LocalPricing | null>(null);
  const [ipCode, setIpCode] = useState<string | null>(null);
  const [profileCode, setProfileCode] = useState<string | null>(null);
  const [showMismatch, setShowMismatch] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [ip, details] = await Promise.all([
        detectCountry(),
        getUserDetails().catch(() => null),
      ]);
      if (!alive) return;
      /**
       * Doosri raay — IP ke saamne rakhne ke liye.
       *
       * Pehle sirf profile ka country dekha jaata tha. Dikkat: zyadatar log
       * profile bharte hi nahi, aur unke liye ye check chup-chaap band pada
       * rehta tha — VPN chalake koi bhi sasta price dekh leta.
       *
       * Phone ka TIMEZONE VPN se nahi badalta, isliye wo achhi doosri raay hai.
       * Profile pehle (user ne khud bhara hai), warna timezone.
       */
      const prof =
        details?.phone_country?.toUpperCase() || countryFromTimezone() || null;
      setIpCode(ip);
      setProfileCode(prof);
      const useCode = ip || prof || "IN";
      const row = await getPricingRow(useCode);
      if (!alive) return;
      setPricing(row);
      if (ip && prof && ip !== prof) setShowMismatch(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function chooseCountry(code: string) {
    setShowMismatch(false);
    const row = await getPricingRow(code);
    setPricing(row);
  }

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

  // rewardsVersion dep: first-N / referral grant background me hota hai. Iske
  // bina user ko "Plus lo" dikhta rehta tha jabki uska Plus already chalu hai.
  useEffect(() => {
    refresh();
    initPurchases(session?.user?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewardsVersion]);

  // Price aur Free limits admin se (app_config) aate hain.
  const base = yearly ? offers.plusPriceYearly : offers.plusPriceMonthly;
  const period = yearly ? u.perYear : u.perMonth;
  // Country-wise local price (base × multiplier × conversion). Row na ho to ₹base.
  const sym = pricing?.symbol ?? "₹";
  const priceLabel = `${sym}${localAmount(base, pricing).toLocaleString("en-IN")}`;

  const FREE_FEATURES = u.freeFeatures.map((f) =>
    tpl(f, { rem: offers.freeReminders, docs: offers.freeDocuments }),
  );

  async function startCheckout() {
    if (paying) return;
    const user = session?.user;
    if (!user) {
      toast.show(u.loginFirst, "error");
      return;
    }

    // 1. Details complete? nahi to form bharwao.
    let details = null;
    try {
      // force — payment se pehle DB ka taaza sach chahiye, cache nahi.
      details = await getUserDetails(true);
    } catch {
      /* ignore, treat as incomplete */
    }
    if (!isDetailsComplete(details)) {
      toast.show(u.needDetails, "info");
      router.push({
        pathname: "/profile-details",
        params: { returnTo: "/upgrade" },
      } as never);
      return;
    }

    // 2. RevenueCat available? (dev build + key chahiye)
    if (!purchasesAvailable()) {
      toast.show(u.notAvailable, "info");
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
        toast.show(u.noPlan, "error");
        return;
      }
      const result = await purchasePlus(pkg);
      if (result.active) {
        // Asli expiry bhejo — warna plan "hamesha" jaisa reh jaata hai.
        await markProfilePlus(result.expiresAt);
        // Plus wapas lete hi pehle se locked docs / paused reminders turant
        // unlock/unpause ho jaayein (warna agle session tak locked rehte the).
        await enforcePlanLimits();
        await refresh();
        logEvent("plus_purchased", { plan: yearly ? "yearly" : "monthly" });
        toast.show(u.activated, "success");
      } else {
        toast.show(u.purchaseFailed, "error");
      }
    } catch {
      toast.show(u.paymentFailed, "error");
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
        <Text style={styles.headerTitle}>{u.title}</Text>
        <View style={{ width: 22 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <ScreenLoader />
        ) : isPlus ? (
          <View style={styles.plusActive}>
            <View style={styles.plusBadge}>
              <Ionicons name="checkmark-circle" size={30} color={colors.white} />
            </View>
            <Text style={styles.plusActiveTitle}>{u.activeTitle} 🎉</Text>
            <Text style={styles.plusActiveSub}>{u.activeSub}</Text>
          </View>
        ) : (
          <>
            {/* Billing toggle */}
            <View style={styles.toggle}>
              <Pressable
                onPress={() => setYearly(false)}
                style={[styles.toggleBtn, !yearly && styles.toggleActive]}
              >
                <Text style={[styles.toggleText, !yearly && styles.toggleTextActive]}>
                  {u.monthly}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setYearly(true)}
                style={[styles.toggleBtn, yearly && styles.toggleActive]}
              >
                <Text style={[styles.toggleText, yearly && styles.toggleTextActive]}>
                  {u.yearlyTab}
                </Text>
              </Pressable>
            </View>

            {/* Plus card */}
            <View style={styles.plusCard}>
              <Text style={styles.plusName}>{u.planName}</Text>
              <View style={styles.priceRow}>
                <Text style={styles.price}>{priceLabel}</Text>
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
                {(
                  <>
                    <Ionicons name="lock-closed" size={16} color={colors.white} />
                    <Text style={styles.payText}>{tpl(u.payBtn, { price: priceLabel })}</Text>
                  </>
                )}
              </Pressable>
              <Text style={styles.payNote}>{u.payNote}</Text>
            </View>

            {/* Referral — paise ke bina Plus (spec item 11) */}
            {offers.referralsEnabled && (
              <Pressable
                onPress={() => router.push("/referral" as never)}
                style={({ pressed }) => [styles.referCard, pressed && { opacity: 0.9 }]}
              >
                <View style={styles.referIcon}>
                  <Ionicons name="gift" size={20} color={colors.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.referTitle}>
                    {tpl(u.referTitle, { d: offers.referralDays })}
                  </Text>
                  <Text style={styles.referSub}>
                    {tpl(u.referSub, { d: offers.referralDays })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.terracotta} />
              </Pressable>
            )}

            {/* Free card */}
            <View style={styles.freeCard}>
              <Text style={styles.freeName}>{u.freeName}</Text>
              <Text style={styles.freePrice}>{u.freePrice}</Text>
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

      {/* IP-country vs profile-country mismatch — kaunse desh ka price? */}
      <Modal transparent visible={showMismatch} animationType="fade" onRequestClose={() => setShowMismatch(false)}>
        <View style={styles.mmBackdrop}>
          <View style={styles.mmCard}>
            <View style={styles.mmIcon}>
              <Ionicons name="globe-outline" size={26} color={colors.white} />
            </View>
            <Text style={styles.mmTitle}>{u.mismatchTitle}</Text>
            <Text style={styles.mmBody}>
              {tpl(u.mismatchBody, { ip: ipCode ?? "", profile: profileCode ?? "" })}
            </Text>
            <Pressable
              onPress={() => chooseCountry(ipCode ?? "IN")}
              style={({ pressed }) => [styles.mmBtn, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.mmBtnText}>{tpl(u.mismatchUseIp, { ip: ipCode ?? "" })}</Text>
            </Pressable>
            <Pressable
              onPress={() => chooseCountry(profileCode ?? "IN")}
              style={({ pressed }) => [styles.mmBtnAlt, pressed && { opacity: 0.9 }]}
            >
              <Text style={styles.mmBtnAltText}>
                {tpl(u.mismatchUseProfile, { profile: profileCode ?? "" })}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Payment chal raha hai — screen block, beech me loader. */}
      <LoaderOverlay visible={paying} />
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
  referCard: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.25)",
    backgroundColor: "rgba(194,90,55,0.07)",
    padding: 16,
  },
  referIcon: {
    height: 42,
    width: 42,
    borderRadius: 14,
    backgroundColor: colors.terracotta,
    alignItems: "center",
    justifyContent: "center",
  },
  referTitle: { fontSize: 15, fontWeight: "800", color: colors.ink },
  referSub: { marginTop: 2, fontSize: 12.5, color: colors.inkSoft },
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
  mmBackdrop: {
    flex: 1,
    backgroundColor: "rgba(46,40,35,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 26,
  },
  mmCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 26,
    backgroundColor: colors.surface,
    padding: 24,
    alignItems: "center",
  },
  mmIcon: {
    height: 58,
    width: 58,
    borderRadius: 20,
    backgroundColor: colors.terracotta,
    alignItems: "center",
    justifyContent: "center",
  },
  mmTitle: {
    marginTop: 14,
    fontSize: 19,
    fontWeight: "800",
    color: colors.ink,
    textAlign: "center",
  },
  mmBody: {
    marginTop: 8,
    fontSize: 14,
    color: colors.inkSoft,
    textAlign: "center",
    lineHeight: 20,
  },
  mmBtn: {
    marginTop: 18,
    alignSelf: "stretch",
    alignItems: "center",
    height: 50,
    justifyContent: "center",
    borderRadius: 15,
    backgroundColor: colors.terracotta,
  },
  mmBtnText: { color: colors.white, fontWeight: "800", fontSize: 15 },
  mmBtnAlt: {
    marginTop: 10,
    alignSelf: "stretch",
    alignItems: "center",
    height: 50,
    justifyContent: "center",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.line,
  },
  mmBtnAltText: { color: colors.ink, fontWeight: "700", fontSize: 15 },
});
