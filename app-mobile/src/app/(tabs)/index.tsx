import { useState, useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { colors } from "@/theme/colors";
import { SkeletonList } from "@/components/loader";
import { reportError } from "@/lib/report-error";
import { timed } from "@/lib/network";
import { UserAvatar } from "@/components/user-avatar";
import { UpgradeBanner } from "@/components/upgrade-banner";
import { listDocuments, type Document } from "@/lib/documents";
import { setReminderOn, type Reminder } from "@/lib/reminders";
import { isPendingId, listRemindersWithPending } from "@/lib/reminder-outbox";
import { hasBeenReferred } from "@/lib/plan";
import { ReferralCodeModal } from "@/components/referral-code-modal";
import { cancelReminder } from "@/lib/notifications";
import { expiryStatus } from "@/utils/expiry";
import { DocCard } from "@/components/doc-card";
import { useToast } from "@/components/toast";
import { useUserName, useAuth } from "@/components/auth-provider";
import { useUserDetails } from "@/lib/user-details";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";
import { useOffers } from "@/lib/use-offers";
import { emitDataChanged, useDataChanged } from "@/lib/data-events";
import { usePlan } from "@/lib/use-plan";
import { dailyBrief } from "@/lib/ai";

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export default function Home() {
  const router = useRouter();
  const toast = useToast();
  const firstName = useUserName();
  const { session } = useAuth();
  const meta = session?.user?.user_metadata;
  const fullName = (meta?.full_name || meta?.name || firstName || "") as string;
  const { home: h, notes: nt, reminders: r0 } = useT();
  const { locale } = useLocale();
  const offers = useOffers();
  const [docs, setDocs] = useState<Document[]>([]);
  const [today, setToday] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refModal, setRefModal] = useState(false);
  // Header ka avatar — shared cache se, taaki profile me photo badalte hi yahan
  // bhi turant badal jaye (pehle logout-login tak purani photo dikhti thi).
  const avatarUrl = useUserDetails().details?.avatar_url ?? null;

  // Referral code ek baar poochho — jinhone signup pe code nahi daala + pehle
  // se referred nahi. Dismiss/apply ke baad dobara nahi.
  useEffect(() => {
    if (!offers.referralsEnabled) return;
    let alive = true;
    (async () => {
      try {
        if (await AsyncStorage.getItem("referral_prompt_seen")) return;
        if (await hasBeenReferred()) {
          await AsyncStorage.setItem("referral_prompt_seen", "1");
          return;
        }
        if (alive) setRefModal(true);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      alive = false;
    };
  }, [offers.referralsEnabled]);

  const closeRefModal = useCallback(() => {
    setRefModal(false);
    AsyncStorage.setItem("referral_prompt_seen", "1").catch(() => {});
  }, []);

  /**
   * Saathi ka apna morning brief (Plus).
   *
   * ⚠️ Ye card kab se ek fixed template line dikha raha tha, jabki "Subah ka
   * daily brief" Plus ka bikaau feature hai aur server par (`task: "brief"`)
   * poora bana pada tha — app use bulati hi nahi thi.
   *
   * Din me ek hi baar banta hai aur device par cache hota hai: har baar Home
   * khulne par AI call karna na token ke hisaab se theek hai, na user ke liye
   * (brief har baar thoda badla hua dikhta, jo ajeeb lagta hai).
   */
  // `planLoading` bhi chahiye: pehle render par `isPlus` hamesha false hota hai
  // (plan abhi aaya hi nahi). Uspe seedha bharosa karte to Plus user ko ek pal
  // ke liye "Plus lo" wala upsell jhalak jaata — bilkul wahi cheez jiske uske
  // paise lag chuke hain. UpgradeBanner bhi thik yahi guard lagata hai.
  const { isPlus, loading: planLoading } = usePlan();
  const [brief, setBrief] = useState<string | null>(null);

  const loadBrief = useCallback(
    async (documents: Document[], reminders: Reminder[]) => {
      const uid = session?.user?.id;
      if (!isPlus || !uid) return;
      const day = new Date().toISOString().slice(0, 10);
      const key = `saathi-brief:${uid}:${day}`;
      try {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          setBrief(cached);
          return;
        }
      } catch {
        /* cache na mile to naya bana lenge */
      }

      const text = await dailyBrief(
        {
          today: day,
          reminders: reminders
            .filter((r) => r.is_on && !r.is_paused)
            .slice(0, 20)
            .map((r) => ({ title: r.title, when: r.remind_at })),
          documents: documents
            .filter((d) => d.expiry)
            .slice(0, 20)
            .map((d) => ({ name: d.name, expiry: d.expiry })),
        },
        firstName,
        locale,
      );
      if (!text) return; // net/AI fail — neeche wali template line hi chalegi
      setBrief(text);
      // Purane dinon ki keys apne aap bekaar ho jaati hain (date key me hai).
      AsyncStorage.setItem(key, text).catch(() => {});
    },
    [isPlus, session?.user?.id, firstName, locale],
  );

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);
        // `listRemindersWithPending` — kataar me pade (offline banaye) reminders
        // bhi "Aaj" wali list me aane chahiye.
        const [d, r] = await timed(
          Promise.all([listDocuments(), listRemindersWithPending()]),
        );
        setDocs(d);
        setToday(r.filter((x) => x.is_on && !x.is_paused && isToday(x.remind_at)));
        void loadBrief(d, r);
      } catch (e) {
        reportError(e, { screen: "home", action: "load" });
        toast.show(h.loadFailed, "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast, loadBrief],
  );

  async function markDone(r: Reminder) {
    /**
     * ⚠️ Kataar me pada (offline banaya) reminder yahan bhi dikhta hai, par uski
     * server wali row abhi bani hi nahi hai — `setReminderOn("local:…")` uuid
     * cast par fail hota hai. Neeche wala `catch` use chup-chaap nigal leta tha,
     * aur reminder list se HAT chuka hota tha: user ko lagta "ho gaya", phir
     * agle refresh par wahi reminder wapas aa jaata. Reminders tab par yahi
     * guard pehle se hai.
     */
    if (isPendingId(r.id)) {
      toast.show(r0.pendingBusy, "info");
      return;
    }
    setToday((prev) => prev.filter((x) => x.id !== r.id));
    try {
      await setReminderOn(r.id, false);
      await cancelReminder(r.id);
      toast.show(h.doneToast, "success");
    } catch {
      /* best-effort; list already updated */
    } finally {
      // Reminders tab bhi khula ho sakta hai — wahan bhi turant sudhar jaye.
      emitDataChanged();
    }
  }

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /**
   * Reminder ka alert modal poore app ke UPAR khulta hai — Home ka focus kabhi
   * jaata hi nahi, isliye upar wala `useFocusEffect` chalta hi nahi tha. "Ho
   * gaya" dabane ke baad bhi wahi purana reminder yahan dikhta rehta tha (item
   * 2). Ab badlaav ki khabar seedhe aati hai.
   *
   * `load(true)` — chup-chaap taaza karo: skeleton dobara dikhana yahan
   * jhatka lagta hai, list to pehle se saamne hai.
   */
  useDataChanged(() => {
    void load(true);
  });

  const attention = docs
    .filter((d) => d.expiry && expiryStatus(d.expiry) !== "safe")
    .slice(0, 3);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(true);
            }}
            tintColor={colors.terracotta}
            colors={[colors.terracotta]}
          />
        }
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.greeting}>
              {tpl(h.greeting, { name: firstName ? ` ${firstName}` : "" })}
            </Text>
            <Text style={styles.sub}>{h.briefLabel}</Text>
          </View>
          {/* Header ka avatar 46px tha — photo itni chhoti thi ki chehra
              pehchana hi nahi jaata tha (item 5). 56px par saaf dikhta hai
              aur naram ring se cut hua nahi lagta. */}
          <Pressable
            onPress={() => router.push("/profile-details" as never)}
            style={styles.avatarRing}
            hitSlop={8}
          >
            <UserAvatar
              uri={avatarUrl}
              name={fullName}
              seed={session?.user?.id}
              size={56}
              radius={19}
            />
          </Pressable>
        </View>

        <UpgradeBanner flush />

        {/* Daily brief card */}
        <View style={styles.briefCard}>
          <View style={styles.briefTag}>
            <Ionicons name="sunny" size={13} color={colors.amber} />
            <Text style={styles.briefTagText}>{h.briefLabel}</Text>
          </View>
          {/* Plus me Saathi ka apna brief; na aaya ho (ya free plan ho) to
              wahi purani template line — card kabhi khaali nahi rehta. */}
          <Text style={styles.briefBody}>
            {loading
              ? h.briefLoading
              : brief
                ? brief
                : attention.length > 0
                  ? tpl(h.briefAttention, {
                      name: firstName ? " " + firstName : "",
                      n: attention.length,
                    }) + " 🙂"
                  : docs.length === 0
                    ? tpl(h.briefStart, { name: firstName ? " " + firstName : "" }) + " 📄"
                    : tpl(h.briefAllSet, { name: firstName ? " " + firstName : "" }) + " 🌿"}
          </Text>

          {/* Free plan — batao ki Saathi ye khud likh ke de sakta hai.
              Card hataya nahi: aaj ki asli baat upar dikhti hi rehti hai. */}
          {!loading && !planLoading && !isPlus && (
            <Pressable
              onPress={() => router.push("/upgrade" as never)}
              style={({ pressed }) => [styles.briefUpsell, pressed && { opacity: 0.85 }]}
            >
              <Ionicons name="sparkles" size={14} color={colors.amber} />
              <Text style={styles.briefUpsellText}>{h.briefPlusHook}</Text>
              <View style={styles.briefUpsellCta}>
                <Text style={styles.briefUpsellCtaText}>{h.briefPlusCta}</Text>
                <Ionicons name="arrow-forward" size={12} color={colors.ink} />
              </View>
            </Pressable>
          )}
        </View>

        {/* Aaj ke reminders — kaam + kitne time ke liye set + "kiya?" */}
        {!loading && today.length > 0 && (
          <View style={styles.todayCard}>
            <View style={styles.todayHead}>
              <Ionicons name="alarm" size={16} color={colors.terracotta} />
              <Text style={styles.todayTitle}>{h.todayTitle}</Text>
            </View>
            {today.map((r) => (
              <View key={r.id} style={styles.todayRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.todayTask} numberOfLines={1}>
                    {r.title}
                  </Text>
                  {!!r.time_label && <Text style={styles.todayTime}>🕒 {r.time_label}</Text>}
                </View>
                <Pressable
                  onPress={() => markDone(r)}
                  style={({ pressed }) => [styles.doneBtn, pressed && { opacity: 0.85 }]}
                >
                  <Ionicons name="checkmark" size={15} color={colors.white} />
                  <Text style={styles.doneText}>{h.markDone}</Text>
                </Pressable>
              </View>
            ))}
          </View>
        )}

        {/* Quick actions */}
        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push("/add-document")}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <View style={[styles.actionIcon, { backgroundColor: "rgba(194,90,55,0.12)" }]}>
              <Ionicons name="add-circle" size={22} color={colors.terracotta} />
            </View>
            <Text style={styles.actionText}>{h.quickDoc}</Text>
          </Pressable>

          <Pressable
            onPress={() => router.push("/chat")}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <View style={[styles.actionIcon, { backgroundColor: "rgba(124,138,107,0.15)" }]}>
              <Ionicons name="chatbubble-ellipses" size={20} color={colors.sage} />
            </View>
            <Text style={styles.actionText}>{h.quickChat}</Text>
          </Pressable>

          {/* Notes ko tab bar me nahi daala — wahan pehle se paanch tab hain aur
              chhathe ka label Hindi me tab bar todd deta hai. Home se ek tap
              par hona hi kaafi hai: note likhne wala aksar app kholta hi isi
              kaam ke liye hai. */}
          <Pressable
            // `as never` — naya route hai, expo ke generated route types dev server
            // chalne par hi banti hain (codebase idiom, jaise _layout.tsx me).
            onPress={() => router.push("/notes" as never)}
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <View style={[styles.actionIcon, { backgroundColor: "rgba(224,164,88,0.18)" }]}>
              <Ionicons name="create" size={20} color={colors.amber} />
            </View>
            <Text style={styles.actionText}>{nt.title}</Text>
          </Pressable>
        </View>

        {/* Attention */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{h.attention}</Text>
          <Pressable onPress={() => router.push("/documents")}>
            <Text style={styles.link}>{h.seeAll}</Text>
          </Pressable>
        </View>

        {loading ? (
          <SkeletonList count={2} />
        ) : attention.length === 0 ? (
          <View style={styles.emptyBox}>
            <Ionicons name="checkmark-circle" size={22} color={colors.sage} />
            <Text style={styles.emptyText}>{h.nothingUrgent} 🌿</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {attention.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                onPress={() =>
                  router.push({
                    pathname: "/document-view",
                    params: {
                      uri: doc.file_uri ?? "",
                      path: doc.file_path ?? "",
                      name: doc.name,
                    },
                  } as never)
                }
              />
            ))}
          </View>
        )}

        {/* Refer & Earn — home pe (referrals band ho to nahi) */}
        {offers.referralsEnabled && (
          <Pressable
            onPress={() => router.push("/referral" as never)}
            style={({ pressed }) => [styles.referCard, pressed && { opacity: 0.92 }]}
          >
            <View style={styles.referIcon}>
              <Ionicons name="gift" size={20} color={colors.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.referTitle}>
                {tpl(h.referCard, { d: offers.referralDays })}
              </Text>
              <Text style={styles.referSub}>{h.referCardSub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={colors.terracotta} />
          </Pressable>
        )}
      </ScrollView>

      <ReferralCodeModal visible={refModal} onClose={closeRefModal} />
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingBottom: 32, ...CONTENT },
  referCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
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
  referTitle: { fontSize: 14.5, fontWeight: "800", color: colors.ink },
  referSub: { marginTop: 2, fontSize: 12.5, color: colors.inkSoft },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  greeting: { fontSize: 28, fontWeight: "700", color: colors.ink },
  sub: { marginTop: 3, fontSize: 15, color: colors.inkSoft },
  avatarRing: {
    height: 62,
    width: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  briefCard: {
    marginTop: 20,
    borderRadius: 24,
    backgroundColor: colors.ink,
    padding: 20,
  },
  briefTag: { flexDirection: "row", alignItems: "center", gap: 6 },
  briefTagText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.amber,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  briefBody: {
    marginTop: 10,
    fontSize: 15.5,
    lineHeight: 23,
    color: "rgba(247,242,233,0.9)",
  },
  briefUpsell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: "rgba(247,242,233,0.16)",
  },
  briefUpsellText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    color: "rgba(247,242,233,0.72)",
  },
  briefUpsellCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: colors.amber,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  briefUpsellCtaText: { fontSize: 12, fontWeight: "800", color: colors.ink },
  todayCard: {
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 16,
  },
  todayHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  todayTitle: { fontSize: 15, fontWeight: "800", color: colors.ink },
  todayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  todayTask: { fontSize: 15, fontWeight: "600", color: colors.ink },
  todayTime: { marginTop: 2, fontSize: 12.5, color: colors.inkSoft },
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: colors.sage,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  doneText: { fontSize: 12.5, fontWeight: "700", color: colors.white },
  actions: { flexDirection: "row", gap: 12, marginTop: 16 },
  action: {
    flex: 1,
    alignItems: "center",
    gap: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: 18,
  },
  pressed: { opacity: 0.8 },
  actionIcon: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  actionText: { fontSize: 14, fontWeight: "600", color: colors.ink },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 26,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 19, fontWeight: "700", color: colors.ink },
  link: { fontSize: 14, fontWeight: "600", color: colors.terracotta },
  loadingBox: { paddingVertical: 30, alignItems: "center" },
  emptyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 16,
  },
  emptyText: { fontSize: 14.5, color: colors.inkSoft, fontWeight: "500" },
});
