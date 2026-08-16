import { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Pressable, Modal, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import notifee, { EventType } from "@notifee/react-native";

import { makeStyles, useColors } from "@/theme/theme";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";
import { countDocuments, countReminders, getOffers } from "@/lib/plan";
import { usePlanSnapshot } from "@/lib/plan-store";
import { onPlanExpiredSignal } from "@/lib/plan-expired-signal";
import { reportError } from "@/lib/report-error";

/**
 * "Aapka Plus khatam ho gaya" — poori screen wala samjhane wala page.
 *
 * ── Ye kyun bana ──────────────────────────────────────────────────────
 *
 * ⚠️ Downgrade ab apne aap hota hai (`supabase/cron-plan-expiry.sql`, har
 * ghante): Plus ki expiry nikalte hi free hadd se AAGE ke documents lock ho
 * jaate hain aur aage ke reminders pause. Ye theek hai — par user ko iski khabar
 * kahin se milti hi nahi thi.
 *
 * Uske liye wo bilkul aisa dikhta tha jaise app kharab ho gayi ho: "mere
 * documents kahan gaye", "reminder aana band kyun ho gaya". Ye sabse bura kism
 * ka bharosa-todne wala pal hai, kyunki hua kuch galat nahi tha — bas plan
 * khatam ho gaya, aur wo ek line kisi ne kahi hi nahi.
 *
 * ── Do darwaze, aur DONO zaroori hain ─────────────────────────────────
 *
 *   1. **App khud pehchaanti hai** — plan snapshot me `plan === "plus"` par
 *      `isPlus === false` ka matlab hi yahi hai ki Plus tha aur nikal chuka.
 *   2. **Admin ki notification** — `data.kind === "plan_expired"` (admin panel
 *      ka "Plus khatam" section).
 *
 * ⚠️ Sirf notification par tikna galat hota, aur ye seedhi baat hai: notification
 * ki permission nahi di ho, Firebase ka token na bana ho, ya wo phone abhi
 * "active" na ho — teenon soorat me user ko kuch pata hi na chalta, jabki uske
 * documents lock ho chuke hote. Isliye asli bharosa (1) par hai; (2) sirf usse
 * jaldi pahunchane ka raasta hai.
 *
 * ⚠️ Aur sirf app ke pehchaanne par tikna bhi kaafi nahi tha: wo tabhi chalta
 * hai jab user app kholta hai, aur ye khabar aksar usse PEHLE deni hoti hai
 * (isliye email aur notification alag se jaate hain).
 *
 * Ek expiry par ek hi baar — nishaan `plan_expires_at` ki value par lagta hai,
 * isliye naya Plus khatam hone par ye apne aap dobara aa jaata hai.
 *
 * Bhasha wahi jo user ne chuni hai (`useT()`) — bilkul waise hi jaise email aur
 * notification `profiles.language` se jaate hain.
 */

const SEEN_KEY = "saathi-plan-expired-seen";

export function PlanExpiredAlert() {
  const tc = useColors();
  const styles = useStyles();
  const { planExpired: d, common: c } = useT();
  const plan = usePlanSnapshot();

  const [open, setOpen] = useState(false);
  /** Kitne lock/pause hue — khulne par hi ginte hain (do sasti count queries). */
  const [counts, setCounts] = useState<{ docs: number; reminders: number } | null>(null);
  /**
   * Ek hi baar khulna hai.
   *
   * ⚠️ Ref me, state me nahi: plan snapshot har foreground par dobara aata hai
   * aur AsyncStorage ka jawab async hai. Bina is ref ke do jawab pass-pass aane
   * par modal do baar khul sakta tha (aur nishaan do baar lagta).
   */
  const handled = useRef(false);

  /**
   * Plus tha, aur ab nahi hai.
   *
   * ⚠️ `plan === "plus" && !isPlus` — yahi wo ek shart hai jo "downgrade ho
   * chuka" batati hai. `plan` column jaan-boojh ke `'free'` nahi kiya jaata (wo
   * itihaas hai — dekho `supabase/cron-plan-expiry.sql`), aur `isPlus` expiry
   * khud dekh leta hai. Isliye ye dono ka farq hi asli saboot hai.
   */
  const downgraded = !plan.loading && plan.plan === "plus" && !plan.isPlus;

  const show = useCallback(async () => {
    if (handled.current) return;
    handled.current = true;
    setOpen(true);
    try {
      const [docs, reminders, offers] = await Promise.all([
        countDocuments(),
        countReminders(),
        getOffers(),
      ]);
      setCounts({
        // Free hadd se AAGE jitne the, utne hi lock/pause hue — bilkul wahi
        // hisaab jo `enforce_plan_limits()` DB me lagata hai.
        docs: Math.max(0, docs - offers.freeDocuments),
        reminders: Math.max(0, reminders - offers.freeReminders),
      });
    } catch (e) {
      // Ginti na mile to bhi baat poori hai — sirf do line kam dikhengi. Modal
      // rok dena sabse bura hoga: wo poora maqsad hi khatam kar deta.
      reportError(e, { screen: "plan-expired", action: "counts" }, "warn");
    }
  }, []);

  /* --------- Darwaza 1: app khud pehchaanti hai --------- */
  useEffect(() => {
    if (!downgraded || handled.current) return;
    let alive = true;
    void (async () => {
      // Is expiry ki khabar pehle di ja chuki? (Nishaan value par hai, isliye
      // agla Plus khatam hone par ye khud wapas aa jaata hai.)
      const stamp = plan.expiresAt ?? "unknown";
      try {
        if ((await AsyncStorage.getItem(SEEN_KEY)) === stamp) return;
        await AsyncStorage.setItem(SEEN_KEY, stamp);
      } catch {
        // Storage na chale to ek baar dikha dena hi theek hai — chup rehne se
        // behtar hai.
      }
      if (alive) await show();
    })();
    return () => {
      alive = false;
    };
  }, [downgraded, plan.expiresAt, show]);

  /* --------- Darwaza 2: admin ki notification --------- */
  /**
   * Tap — teenon raaston se (app khuli thi / peeche thi / band thi).
   *
   * ⚠️ Yahan sirf notifee sunna KAAFI NAHI hai, aur wahi sabse aam galti hoti.
   * App background me ho ya band, notification OS/Firebase dikhata hai aur
   * notifee ko wo dikhti hi nahi. Isliye tap ka faisla `lib/push.ts` me ek hi
   * jagah hota hai (jahan teenon raaste milte hain) aur wahan se ek chhoti si
   * khabar yahan aati hai. Poori wajah `lib/plan-expired-signal.ts` par likhi hai.
   */
  useEffect(() => {
    return onPlanExpiredSignal(() => {
      // Nishaan yahan bhi, warna app dobara khulne par ye page ek baar aur aata.
      AsyncStorage.setItem(SEEN_KEY, "pushed").catch(() => {});
      void show();
    });
  }, [show]);

  /**
   * App KHULI thi aur notification abhi-abhi aayi — tap ka intezaar mat karo.
   *
   * Foreground me notification `push.ts` khud notifee se dikhata hai, isliye ye
   * event yahin milta hai. User saamne baitha hai; use ye baat us pal batani hai.
   */
  useEffect(() => {
    let stop = () => {};
    try {
      stop = notifee.onForegroundEvent(({ type, detail }) => {
        if (type !== EventType.DELIVERED) return;
        const data = detail.notification?.data as { kind?: string } | undefined;
        if (data?.kind !== "plan_expired") return;
        AsyncStorage.setItem(SEEN_KEY, "pushed").catch(() => {});
        void show();
      });
    } catch {
      /* notifee na ho (Expo Go) to ye raasta bas band rehta hai */
    }
    return () => stop();
  }, [show]);

  if (!open) return null;

  const locked = counts && (counts.docs > 0 || counts.reminders > 0);

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={() => setOpen(false)}>
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.icon}>
            <Ionicons name="shield-checkmark" size={34} color={tc.sage} />
          </View>

          <Text style={styles.title}>{d.title}</Text>
          {/* ⚠️ Sabse zaroori line sabse upar aur sabse mota — user ka pehla
              sawaal "mera data gaya to nahi" hi hota hai, "kitna kharcha hoga"
              nahi. */}
          <Text style={styles.safeLine}>{d.safe}</Text>
          <Text style={styles.body}>{d.body}</Text>

          {counts && (
            <View style={styles.box}>
              {locked ? (
                <>
                  {counts.docs > 0 && (
                    <View style={styles.row}>
                      <Ionicons name="lock-closed" size={15} color={tc.inkSoft} />
                      <Text style={styles.rowText}>
                        {tpl(d.lockedDocs, { docs: counts.docs })}
                      </Text>
                    </View>
                  )}
                  {counts.reminders > 0 && (
                    <View style={styles.row}>
                      <Ionicons name="pause-circle" size={15} color={tc.inkSoft} />
                      <Text style={styles.rowText}>
                        {tpl(d.pausedReminders, { reminders: counts.reminders })}
                      </Text>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.row}>
                  <Ionicons name="checkmark-circle" size={15} color={tc.sage} />
                  <Text style={styles.rowText}>{d.nothingLocked}</Text>
                </View>
              )}
            </View>
          )}

          <Pressable
            onPress={() => {
              setOpen(false);
              router.push("/upgrade" as never);
            }}
            style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}
          >
            <Text style={styles.ctaText}>{d.back}</Text>
          </Pressable>

          {/**
           * ⚠️ "Baad me" ka hona ZAROORI hai. Bina uske ye page ek paywall ban
           * jaata hai jise band karne ka koi raasta nahi — aur wo is app ke poore
           * mizaaj se ulta hai. Free plan ek asli plan hai, koi saza nahi.
           */}
          <Pressable
            onPress={() => setOpen(false)}
            hitSlop={8}
            style={({ pressed }) => [styles.later, pressed && { opacity: 0.6 }]}
          >
            <Text style={styles.laterText}>{d.later || c.close}</Text>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const CONTENT = { width: "100%", maxWidth: 460, alignSelf: "center" } as const;

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  content: { padding: 24, paddingTop: 40, alignItems: "center", ...CONTENT },
  icon: {
    height: 76,
    width: 76,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,138,107,0.14)",
    marginBottom: 20,
  },
  title: { fontSize: 24, fontWeight: "800", color: c.ink, textAlign: "center" },
  safeLine: {
    marginTop: 10,
    fontSize: 16.5,
    fontWeight: "700",
    color: c.sage,
    textAlign: "center",
  },
  body: {
    marginTop: 12,
    fontSize: 14.5,
    lineHeight: 22,
    color: c.inkSoft,
    textAlign: "center",
  },
  box: {
    width: "100%",
    marginTop: 22,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    padding: 16,
    gap: 10,
  },
  row: { flexDirection: "row", alignItems: "flex-start", gap: 9 },
  rowText: { flex: 1, fontSize: 14, lineHeight: 20, color: c.ink },
  cta: {
    width: "100%",
    marginTop: 28,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.terracotta,
  },
  ctaText: { fontSize: 16, fontWeight: "700", color: c.white },
  later: { marginTop: 16, paddingVertical: 8 },
  laterText: { fontSize: 14.5, fontWeight: "700", color: c.inkSoft },
}));
