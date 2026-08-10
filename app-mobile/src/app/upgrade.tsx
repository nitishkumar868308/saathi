import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { makeStyles, useColors } from "@/theme/theme";
import { LoaderOverlay, ScreenLoader } from "@/components/loader";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { waitForPlusFromServer, enforcePlanLimits, type PlanId } from "@/lib/plan";
import { usePlan } from "@/lib/use-plan";
import { refreshPlan } from "@/lib/plan-store";
import {
  purchasesAvailable,
  initPurchases,
  getPlusPackages,
  purchasePlus,
  type PurchasePackage,
} from "@/lib/purchases";
import { getUserDetails, isDetailsComplete } from "@/lib/user-details";
import { logEvent } from "@/lib/analytics";
import { useOffers } from "@/lib/use-offers";
import {
  DEFAULT_PRICE,
  detectCountry,
  getPlayPrices,
  type PlayPrices,
} from "@/lib/pricing";
import { countryFromTimezone } from "@/lib/tz-country";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";

export default function Upgrade() {
  const tc = useColors();
  const styles = useStyles();
  const { session, rewardsVersion } = useAuth();
  const toast = useToast();
  const offers = useOffers();
  const { upgrade: u } = useT();
  const PLUS_FEATURES = u.plusFeatures;
  const [yearly, setYearly] = useState(true);
  /**
   * Plan ab poore app ke saanjhe store se aata hai, is screen ki apni copy se
   * nahi.
   *
   * ⚠️ Pehle yahan `useState(false)` + apni `getPlan()` call thi. Do jagah do
   * sach rakhne ka natija saaf tha: Play se kharidne ke baad ye screen "Plus
   * chalu hai" dikhati thi, aur peeche baaki screens par "Plus lo" ka banner
   * waise hi baitha rehta tha (unki apni copy purani thi). Ek hi store se dono
   * ek saath badalte hain.
   */
  const { isPlus, loading } = usePlan();
  const [paying, setPaying] = useState(false);

  // IP se country → us desh ka daam. Profile se mismatch ho to ek baar modal
  // poochhta hai kaunse desh ka price dikhaayein.
  const [ipCode, setIpCode] = useState<string | null>(null);
  const [profileCode, setProfileCode] = useState<string | null>(null);
  const [showMismatch, setShowMismatch] = useState(false);
  /**
   * Us desh ka Play Console wala daam (server ke `play_prices` se).
   *
   * Ye beech ka kadam hai: store ka apna `priceString` sabse accha hai, par wo
   * Expo Go / billing-off build me milta hi nahi. Aise me bhi daam Play Console
   * ka hi rehna chahiye — website bhi yahi table padhti hai, isliye dono par ek
   * number dikhta hai.
   */
  const [playPrices, setPlayPrices] = useState<PlayPrices | null>(null);

  /**
   * Store ke apne packages — inme Google Play ka ASLI, uske hisaab se local
   * kiya hua price hota hai (`product.priceString`).
   *
   * ⚠️ Abhi Play Billing chalu nahi hai, isliye ye list khaali rehti hai aur
   * screen par wahi country-pricing wala price dikhta hai jo `app_config` +
   * admin panel se aata hai — bilkul waise hi jaise pehle tha.
   *
   * Ye isliye pehle se laga diya hai ki jis din Play chalu hoga, us din **jo
   * price dikh raha hai wahi kata bhi jayega**. Warna wo din ek chhupa hua bug
   * lekar aata: screen ₹99 dikhati aur Play Console apne configure kiye hue
   * price par kaat leta. Ye sirf user ka bharosa todne wali baat nahi — Play
   * ki policy bhi sahi price dikhana maangti hai, aur uspe app reject hoti hai.
   */
  const [pkgs, setPkgs] = useState<PurchasePackage[]>([]);

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
      const play = await getPlayPrices(useCode);
      if (!alive) return;
      setPlayPrices(play);
      if (ip && prof && ip !== prof) setShowMismatch(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  async function chooseCountry(code: string) {
    setShowMismatch(false);
    setPlayPrices(await getPlayPrices(code));
  }

  // rewardsVersion dep: first-N / referral grant background me hota hai. Iske
  // bina user ko "Plus lo" dikhta rehta tha jabki uska Plus already chalu hai.
  // (Plan khud `usePlan()` sambhalta hai; yahan sirf store ko ek dhakka dete
  // hain, taaki is screen par aate hi taaza jawab mile.)
  useEffect(() => {
    void refreshPlan();
    let alive = true;
    (async () => {
      await initPurchases(session?.user?.id);
      // Play band ho to ye khaali array deta hai — screen par kuch nahi badalta.
      const list = await getPlusPackages().catch(() => []);
      if (alive) setPkgs(list);
    })();
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rewardsVersion]);

  /** Chuni hui avadhi ka store package (Play chalu ho tabhi milta hai). */
  function packageFor(wantYearly: boolean) {
    const wanted: PlanId = wantYearly ? "plus_yearly" : "plus_monthly";
    return (
      pkgs.find((p) => String(p?.product?.identifier ?? "").includes(wanted)) ??
      (pkgs.length === 1 ? pkgs[0] : null)
    );
  }

  const period = yearly ? u.perYear : u.perMonth;

  /**
   * Jo dikhega wahi kata jayega — teen sahare, isi tarteeb me.
   *
   * 1. **Store ka apna `priceString`** — sabse sahi. Ye Play khud deta hai, user
   *    ke ACCOUNT wale desh aur currency me (₹, $, £). Jo yahan likha hai wahi
   *    kata jaata hai, isliye iske hote hue kuch aur dekhna hi nahi chahiye.
   * 2. **`play_prices`** — wahi Play Console ka daam, par server ke raaste. Ye
   *    tab kaam aata hai jab store hi na mile: Expo Go, ya billing off wali
   *    build. Website bhi bilkul yahi table padhti hai, isliye dono par ek
   *    number dikhta hai.
   * 3. **`DEFAULT_PRICE`** — sirf tab jab sync ek baar bhi na chala ho.
   *
   * ⚠️ Tarteeb kabhi ulti mat karna, aur beech me koi "apna hisaab" mat ghusana.
   *    Pehle yahan admin ka manual base × multiplier × conversion_rate tha; wo
   *    Play se hamesha thoda alag ho jaata tha, yaani screen ek daam dikhati aur
   *    Play doosra kaat leta. Bharosa to jaata hi hai, Play ki policy bhi yahi
   *    maangti hai ki jo dikhe wahi kate.
   */
  const storePrice = String(packageFor(yearly)?.product?.priceString ?? "").trim();
  const playLabel = (yearly ? playPrices?.yearly : playPrices?.monthly) ?? "";
  const fallback = yearly ? DEFAULT_PRICE.yearlyLabel : DEFAULT_PRICE.monthlyLabel;
  const priceLabel = storePrice || playLabel || fallback;

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
      // Taaza list lo (screen khule ko der ho sakti hai), par chunne ka niyam
      // wahi ek — `packageFor`. Warna dikhaya hua price ek package ka hota aur
      // kharida doosra jaata.
      const fresh = await getPlusPackages();
      if (fresh.length) setPkgs(fresh);
      const wanted: PlanId = yearly ? "plus_yearly" : "plus_monthly";
      const pkg =
        fresh.find((p) => String(p?.product?.identifier ?? "").includes(wanted)) ??
        (fresh.length === 1 ? fresh[0] : null);
      if (!pkg) {
        toast.show(u.noPlan, "error");
        return;
      }
      const result = await purchasePlus(pkg);
      if (result.active) {
        /**
         * Plan ab APP nahi likhti — SERVER likhta hai.
         *
         * ⚠️ Yahan pehle `markProfilePlus(result.expiresAt)` tha, yaani app khud
         * `profiles.plan = 'plus'` set kar deti thi. Wo "webhook aane tak ka
         * bridge" nahi, ek khula darwaza tha: wahi do line koi bhi bhej sakta tha
         * (anon key APK me hai), bina kuch kharide, `plan_expires_at` 2099 ke
         * saath. Ab wo column app se band hai (supabase/column-grants.sql), aur
         * Plus dene ka ek hi raasta hai — RevenueCat ka webhook.
         *
         * Isliye ab likhte nahi, poochte hain. Webhook aksar kuch second me aa
         * jaata hai, isliye 99% baar user ko farak bhi nahi padta.
         */
        const active = await waitForPlusFromServer();
        // Plus milte hi pehle se locked docs / paused reminders turant
        // unlock/unpause ho jaayein (warna agle session tak locked rehte the).
        if (active) await enforcePlanLimits();
        // Saanjhe store ko taaza karo — ye screen AUR peeche khule saare tab,
        // dono ek hi call se sahi ho jaate hain.
        await refreshPlan();
        logEvent("plus_purchased", { plan: yearly ? "yearly" : "monthly" });
        /**
         * ⚠️ Webhook der se aaya to "purchase fail" kehna jhooth hoga — paisa
         * kat chuka hai. Alag line dena hi imaandaari hai, aur wo user ko
         * dobara kharidne se bhi rokti hai.
         */
        toast.show(active ? u.activated : u.activating, active ? "success" : "info");
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
          <Ionicons name="chevron-back" size={22} color={tc.ink} />
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
              {/* Badge sage ka hai — safed nishaan uspar dono theme me kamzor
                  tha (3.4:1 / 2.4:1). */}
              <Ionicons name="checkmark-circle" size={30} color={tc.onAccent} />
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
                      <Ionicons name="checkmark" size={13} color={tc.white} />
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
                    <Ionicons name="lock-closed" size={16} color={tc.white} />
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
                  <Ionicons name="gift" size={20} color={tc.white} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.referTitle}>
                    {tpl(u.referTitle, { d: offers.referralDays })}
                  </Text>
                  <Text style={styles.referSub}>
                    {tpl(u.referSub, { d: offers.referralDays })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={tc.terracotta} />
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
                      color={tc.sage}
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
      <Modal statusBarTranslucent transparent visible={showMismatch} animationType="fade" onRequestClose={() => setShowMismatch(false)}>
        <View style={styles.mmBackdrop}>
          <View style={styles.mmCard}>
            <View style={styles.mmIcon}>
              <Ionicons name="globe-outline" size={26} color={tc.white} />
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
  headerTitle: { fontSize: 18, fontWeight: "700", color: c.ink },
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
  rewardText: { flex: 1, fontSize: 13.5, fontWeight: "700", color: c.ink },
  toggle: {
    flexDirection: "row",
    marginTop: 18,
    padding: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  toggleBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 12,
  },
  toggleActive: { backgroundColor: c.terracotta },
  toggleText: { fontSize: 13, fontWeight: "700", color: c.inkSoft },
  toggleTextActive: { color: c.white },
  plusCard: {
    marginTop: 18,
    borderRadius: 26,
    borderWidth: 2,
    borderColor: c.terracotta,
    // ⚠️ `c.ink` NAHI — dark theme me card cream ban jaata tha aur uspar ka
    // safed price/feature text gayab ho jaata tha.
    backgroundColor: c.inkCard,
    padding: 22,
  },
  plusName: { fontSize: 18, fontWeight: "700", color: c.white },
  priceRow: { flexDirection: "row", alignItems: "flex-end", marginTop: 8, gap: 4 },
  price: { fontSize: 38, fontWeight: "800", color: c.white },
  period: { fontSize: 15, color: c.onInkSoft, paddingBottom: 6 },
  gst: { marginTop: 2, fontSize: 12.5, color: c.onInkSoft, fontWeight: "600" },
  tickPlus: {
    height: 20,
    width: 20,
    borderRadius: 10,
    backgroundColor: c.terracotta,
    alignItems: "center",
    justifyContent: "center",
  },
  featRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  featTextPlus: { fontSize: 14.5, color: c.onInk, flex: 1 },
  payBtn: {
    marginTop: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 18,
    backgroundColor: c.terracotta,
  },
  payText: { color: c.white, fontWeight: "800", fontSize: 16 },
  payNote: {
    marginTop: 10,
    textAlign: "center",
    fontSize: 12,
    color: c.onInkSoft,
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
    backgroundColor: c.terracotta,
    alignItems: "center",
    justifyContent: "center",
  },
  referTitle: { fontSize: 15, fontWeight: "800", color: c.ink },
  referSub: { marginTop: 2, fontSize: 12.5, color: c.inkSoft },
  freeCard: {
    marginTop: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    padding: 20,
  },
  freeName: { fontSize: 17, fontWeight: "700", color: c.ink },
  freePrice: { marginTop: 4, fontSize: 15, color: c.inkSoft, fontWeight: "600" },
  featText: { fontSize: 14.5, color: c.ink, flex: 1 },
  plusActive: { alignItems: "center", paddingTop: 40 },
  plusBadge: {
    height: 68,
    width: 68,
    borderRadius: 24,
    backgroundColor: c.sage,
    alignItems: "center",
    justifyContent: "center",
  },
  plusActiveTitle: {
    marginTop: 16,
    fontSize: 22,
    fontWeight: "800",
    color: c.ink,
  },
  plusActiveSub: {
    marginTop: 8,
    fontSize: 15,
    color: c.inkSoft,
    textAlign: "center",
    paddingHorizontal: 20,
    lineHeight: 22,
  },
  mmBackdrop: {
    flex: 1,
    backgroundColor: c.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: 26,
  },
  mmCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 26,
    backgroundColor: c.surface,
    padding: 24,
    alignItems: "center",
  },
  mmIcon: {
    height: 58,
    width: 58,
    borderRadius: 20,
    backgroundColor: c.terracotta,
    alignItems: "center",
    justifyContent: "center",
  },
  mmTitle: {
    marginTop: 14,
    fontSize: 19,
    fontWeight: "800",
    color: c.ink,
    textAlign: "center",
  },
  mmBody: {
    marginTop: 8,
    fontSize: 14,
    color: c.inkSoft,
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
    backgroundColor: c.terracotta,
  },
  mmBtnText: { color: c.white, fontWeight: "800", fontSize: 15 },
  mmBtnAlt: {
    marginTop: 10,
    alignSelf: "stretch",
    alignItems: "center",
    height: 50,
    justifyContent: "center",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: c.line,
  },
  mmBtnAltText: { color: c.ink, fontWeight: "700", fontSize: 15 },
}));
