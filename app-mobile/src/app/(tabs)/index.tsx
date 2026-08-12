import { useState, useCallback, useEffect } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { makeStyles, useColors } from "@/theme/theme";
import { SkeletonList } from "@/components/loader";
import { reportError } from "@/lib/report-error";
import { timed } from "@/lib/network";
import { UserAvatar } from "@/components/user-avatar";
import { UpgradeBanner } from "@/components/upgrade-banner";
import { deleteDocument, listDocuments, type Document } from "@/lib/documents";
import { setReminderOn, type Reminder } from "@/lib/reminders";
import { isPendingId, listRemindersWithPending } from "@/lib/reminder-outbox";
import { hasBeenReferred } from "@/lib/plan";
import { ReferralCodeModal } from "@/components/referral-code-modal";
import { cancelDocumentExpiry, cancelReminder } from "@/lib/notifications";
import { expiryStatus } from "@/utils/expiry";
import { DocCard } from "@/components/doc-card";
import { ConfirmModal } from "@/components/confirm-modal";
import { useToast } from "@/components/toast";
import { useUserName, useAuth } from "@/components/auth-provider";
import { useUserDetails } from "@/lib/user-details";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";
import { useOffers } from "@/lib/use-offers";
import { emitDataChanged, useDataChanged } from "@/lib/data-events";
import { usePlan } from "@/lib/use-plan";
import { dailyBrief, dayPart } from "@/lib/ai";
import { Reveal3D, Press3D } from "@/components/reveal-3d";
import { deviceOwner, getDeviceId } from "@/lib/device";
import { markFirstDocument, markFirstReminder } from "@/lib/reviews";

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
  const tc = useColors();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const firstName = useUserName();
  const { session } = useAuth();
  const meta = session?.user?.user_metadata;
  const fullName = (meta?.full_name || meta?.name || firstName || "") as string;
  const { home: h, notes: nt, reminders: r0, documents: dt, common: cm, deviceOwner: dw } = useT();
  const { locale } = useLocale();
  const offers = useOffers();
  const [docs, setDocs] = useState<Document[]>([]);
  const [today, setToday] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refModal, setRefModal] = useState(false);
  /** Kaunsa document delete hone wala hai — confirm ke intezaar me. */
  const [pendingDelete, setPendingDelete] = useState<Document | null>(null);
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
   * "Ye phone kisi aur ke naam par hai" — pehle din sirf ek toast.
   *
   * ⚠️ Poora modal ab document + reminder ke baad aata hai (wahan wo baat samajh
   * me aati hai), par tab tak user ko poori tarah andhere me rakhna galat hoga:
   * theek isi soorat me uske reminder is phone par aate hi nahi, aur usne wahi
   * shikayat ki thi — "reminder set kiya, notification aayi hi nahi, pata hi
   * nahi chala kyun".
   *
   * Toast rok nahi hai aur kuch poochta bhi nahi — bas ek line jo us khamoshi ko
   * khatam kar deti hai. Ek hi baar, har (device, user) jodi par.
   */
  const uid = session?.user?.id;
  useEffect(() => {
    if (!uid) return;
    let alive = true;
    void (async () => {
      try {
        const o = await deviceOwner();
        if (!o || o.isMe || !alive) return;
        const key = `saathi-device-owner-toast:${await getDeviceId()}:${uid}`;
        if (await AsyncStorage.getItem(key)) return;
        if (!alive) return;
        toast.show(tpl(dw.toast, { who: o.name || o.email || "" }), "info");
        await AsyncStorage.setItem(key, "1");
      } catch {
        /* toast na dikhe to kuch nahi bigadta — modal baad me aata hi hai */
      }
    })();
    return () => {
      alive = false;
    };
    // `toast`/`dw` har render par naye ban sakte hain; ye effect sirf user
    // badalne par chalna chahiye.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid]);

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
  /**
   * Saathi ka brief — aur wo KIS BHASHA ka hai.
   *
   * ⚠️ Bhasha yahan saath me rakhna zaroori hai. Sirf cache key me locale daal
   * dena kaafi nahi tha: wo agli baar sahi text laata hai, par SCREEN par
   * purani bhasha wala brief tab tak chipka rehta hai jab tak naya aa na jaye —
   * aur AI fail ho jaye (net na ho) to hamesha ke liye. Home ka sabse upar wala
   * card poore din galat bhasha me pada rehta tha jabki baaki screen badal
   * chuki hoti thi.
   *
   * Ise ek effect se reset karne ke bajaye SAATH rakhte hain, taaki render me
   * hi pata ho ki ye brief abhi kaam ka hai ya nahi — ek extra render bachta
   * hai aur "kabhi-kabhi ek pal ke liye purana text jhalak jaata hai" wali
   * soorat ban hi nahi sakti.
   */
  const [brief, setBriefState] = useState<{
    text: string;
    locale: string;
    part: string;
  } | null>(null);
  const setBrief = useCallback(
    (text: string, forLocale: string, forPart: string) =>
      setBriefState({ text, locale: forLocale, part: forPart }),
    [],
  );
  /**
   * Abhi ki bhasha AUR abhi ke waqt ka brief — warna hai hi nahi.
   *
   * ⚠️ `part` ki shart bhasha wali shart jitni hi zaroori hai. Bina uske subah
   * ka brief screen par tab tak chipka rehta hai jab tak naya AI se aa na jaye —
   * aur net na ho to poore din. User ne yahi dekha tha: 1 baje card ab bhi
   * subah wali baat keh raha tha.
   */
  const nowPart = dayPart();
  const briefText =
    brief && brief.locale === locale && brief.part === nowPart ? brief.text : null;

  const loadBrief = useCallback(
    async (documents: Document[], reminders: Reminder[]) => {
      const uid = session?.user?.id;
      if (!isPlus || !uid) return;
      const day = new Date().toISOString().slice(0, 10);
      /**
       * ⚠️ Key me `locale` hona ZAROORI hai.
       *
       * Pehle key sirf `uid:day` thi. Brief AI se user ki bhasha me banta hai
       * aur din bhar ke liye cache ho jaata hai — yaani subah Hinglish me brief
       * banne ke baad user din me bhasha English kar de, to `loadBrief` dobara
       * chalta to tha (dep me `locale` hai) par usi purani key se wahi purana
       * Hinglish text wapas padh leta tha. Home ka sabse upar wala card poore
       * din galat bhasha me chipka rehta tha, aur baaki screen badal chuki
       * hoti thi. Ab har bhasha ka apna cache hai.
       *
       * ⚠️ Aur key me DIN KA HISSA bhi hona zaroori hai (`part`).
       *
       * Pehle key sirf `uid:day:locale` thi, yaani subah 6 baje bana brief raat
       * 11 baje tak wahi rehta tha. User ne theek yahi pakda: 6 baje wala gym
       * reminder nipat chuka tha, par 1 baje card ab bhi "chalo jaldi ready ho
       * jao" keh raha tha. Ab din me chaar khidkiyan hain (subah/dopahar/shaam/
       * raat) aur har khidki me brief ek baar naya banta hai — na har baar (jo
       * mehnga aur ajeeb dono hai), na din me sirf ek baar.
       */
      const part = dayPart();
      const key = `saathi-brief:${uid}:${day}:${part}:${locale}`;
      try {
        const cached = await AsyncStorage.getItem(key);
        if (cached) {
          setBrief(cached, locale, part);
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
      setBrief(text, locale, part);
      // Purane dinon ki keys apne aap bekaar ho jaati hain (date key me hai).
      AsyncStorage.setItem(key, text).catch(() => {});
    },
    [isPlus, session?.user?.id, firstName, locale, setBrief],
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
        /**
         * Padav ko ASLI data se mila lo.
         *
         * ⚠️ `markFirstDocument`/`markFirstReminder` sirf tab likhte hain jab
         * cheez ISI install par banti hai. Purana user jo app dobara install
         * karta hai — ya doosre phone par login karta hai — uske paas 20
         * document aur 10 reminder hote hue bhi dono jhande khaali rehte the.
         * Ab modal inhi jhandon se tay hote hain, isliye us user ke liye "PIN
         * laga lo" aur "ye phone kisi aur ka hai" kabhi dikhte hi nahi.
         *
         * Home waise bhi dono list padh raha hai — yahan mila lena muft hai.
         */
        //
        // `silent` — ye "abhi-abhi banaya" nahi, "pehle se hai" hai. Bina iske
        // har Home load ek creation event ban jaata aur uspar chalne wale modal
        // app kholte hi khul jaate.
        if (d.length > 0) void markFirstDocument({ silent: true });
        if (r.length > 0) void markFirstReminder({ silent: true });
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

  /**
   * Home se document delete — bilkul wahi kaam jo Documents tab karta hai.
   *
   * ⚠️ Teen kadam, aur teenon zaroori hain:
   *   1. `deleteDocument` — DB row, R2 ki asli file, aur offline cache, teenon
   *   2. `cancelDocumentExpiry` — warna hataye hue document ki expiry wali
   *      notification mahino tak bajti rehti hai
   *   3. `emitDataChanged` — Documents tab bhi khula ho sakta hai
   */
  async function runDelete(doc: Document) {
    setPendingDelete(null);
    setDocs((prev) => prev.filter((x) => x.id !== doc.id));
    try {
      await deleteDocument(doc);
      await cancelDocumentExpiry(doc.id);
      toast.show(dt.deleted, "success");
    } catch (e) {
      reportError(e, { screen: "home", action: "delete_document" });
      toast.show(`${dt.deleted} ✕`, "error");
      // Delete nahi hua — list wapas sach par le aao, warna document screen se
      // gaayab hai par server par zinda hai.
      void load(true);
    } finally {
      emitDataChanged();
    }
  }

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
            tintColor={tc.terracotta}
            colors={[tc.terracotta]}
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

        {/* Daily brief card — home ka sabse pehla card, isliye 3D me sabse
            pehle aata hai (index 0). */}
        <Reveal3D index={0}>
          <View style={styles.briefCard}>
            <View style={styles.briefTag}>
              <View style={styles.briefTagIcon}>
                <Ionicons name="sunny" size={12} color={tc.amber} />
              </View>
              <Text style={styles.briefTagText}>{h.briefLabel}</Text>
            </View>
            {/* Plus me Saathi ka apna brief; na aaya ho (ya free plan ho) to
                wahi purani template line — card kabhi khaali nahi rehta. */}
            <Text style={styles.briefBody}>
              {loading
                ? h.briefLoading
                : briefText
                  ? briefText
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
                <Ionicons name="sparkles" size={14} color={tc.amber} />
                <Text style={styles.briefUpsellText}>{h.briefPlusHook}</Text>
                <View style={styles.briefUpsellCta}>
                  <Text style={styles.briefUpsellCtaText}>{h.briefPlusCta}</Text>
                  <Ionicons name="arrow-forward" size={12} color={tc.ink} />
                </View>
              </Pressable>
            )}
          </View>
        </Reveal3D>

        {/* Aaj ke reminders — kaam + kitne time ke liye set + "kiya?" */}
        {!loading && today.length > 0 && (
          <Reveal3D index={1} style={styles.todayCard}>
            <View style={styles.todayHead}>
              <Ionicons name="alarm" size={16} color={tc.terracotta} />
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
                  {/* `onAccent` — sage par safed nishaan dark theme me 2.4:1
                      par gir jaata tha. */}
                  <Ionicons name="checkmark" size={15} color={tc.onAccent} />
                  <Text style={styles.doneText}>{h.markDone}</Text>
                </Pressable>
              </View>
            ))}
          </Reveal3D>
        )}

        {/*
          Quick actions.

          ⚠️ Teenon label ki lambai teen bhashaon me bahut alag hai — English
          "Notes" ek shabd hai, Hinglish "Chat with Saathi" do line leta hai,
          aur Hindi "दस्तावेज़ जोड़ें" usse bhi lamba. Pehle label ek hi line me
          kaat diya jaata tha aur icon ke neeche adhoora sa dikhta tha
          (screenshot me "Add document" / "Chat with Saathi" wahi tha).
          `numberOfLines={2}` + tay oonchai se teenon card ek jaise dikhte hain,
          chahe bhasha koi bhi ho.
        */}
        <Reveal3D index={2} style={styles.actions}>
          <Press3D
            onPress={() => router.push("/add-document")}
            style={styles.actionSlot}
          >
            <View style={styles.action}>
              <View style={[styles.actionIcon, { backgroundColor: "rgba(194,90,55,0.12)" }]}>
                <Ionicons name="add-circle" size={22} color={tc.terracotta} />
              </View>
              <Text style={styles.actionText} numberOfLines={2}>
                {h.quickDoc}
              </Text>
            </View>
          </Press3D>

          <Press3D onPress={() => router.push("/chat")} style={styles.actionSlot}>
            <View style={styles.action}>
              <View style={[styles.actionIcon, { backgroundColor: "rgba(124,138,107,0.15)" }]}>
                <Ionicons name="chatbubble-ellipses" size={20} color={tc.sage} />
              </View>
              <Text style={styles.actionText} numberOfLines={2}>
                {h.quickChat}
              </Text>
            </View>
          </Press3D>

          {/* Notes ko tab bar me nahi daala — wahan pehle se paanch tab hain aur
              chhathe ka label Hindi me tab bar todd deta hai. Home se ek tap
              par hona hi kaafi hai: note likhne wala aksar app kholta hi isi
              kaam ke liye hai. */}
          <Press3D
            // `as never` — naya route hai, expo ke generated route types dev server
            // chalne par hi banti hain (codebase idiom, jaise _layout.tsx me).
            onPress={() => router.push("/notes" as never)}
            style={styles.actionSlot}
          >
            <View style={styles.action}>
              <View style={[styles.actionIcon, { backgroundColor: "rgba(224,164,88,0.18)" }]}>
                <Ionicons name="create" size={20} color={tc.amber} />
              </View>
              <Text style={styles.actionText} numberOfLines={2}>
                {nt.title}
              </Text>
            </View>
          </Press3D>
        </Reveal3D>

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
            <Ionicons name="checkmark-circle" size={22} color={tc.sage} />
            <Text style={styles.emptyText}>{h.nothingUrgent} 🌿</Text>
          </View>
        ) : (
          <View style={{ gap: 10 }}>
            {attention.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                onPress={() => {
                  // Locked document khulta nahi — wahi kaam jo Documents tab
                  // karta hai, warna dono jagah do alag vyavhaar dikhte hain.
                  if (doc.is_locked) {
                    router.push("/upgrade" as never);
                    return;
                  }
                  router.push({
                    pathname: "/document-view",
                    params: {
                      /**
                       * ⚠️ `id`, `mime` aur `type` — teenon yahan se CHHOOT gaye
                       * the, aur teenon ka apna nuksaan tha:
                       *
                       *   id   — offline cache ki chaabi hai. Iske bina
                       *          `resolveDocUri` cache me dekh hi nahi sakta,
                       *          yaani Home se khola gaya document net na hone
                       *          par kabhi nahi khulta tha — jabki wahi document
                       *          Documents tab se bina net ke khul jaata tha.
                       *   mime — PDF/PNG ko sahi tarah kholne ke liye.
                       *   type — renewal guide isi se chunta hai.
                       */
                      id: doc.id,
                      uri: doc.file_uri ?? "",
                      path: doc.file_path ?? "",
                      mime: doc.mime_type ?? "",
                      name: doc.name,
                      type: doc.type,
                    },
                  } as never);
                }}
                /**
                 * ⚠️ Ye prop yahan tha hi nahi, aur user ne theek pakda: card ka
                 * trash button DIKHTA tha (DocCard use hamesha banata hai) par
                 * uska `onPress` `undefined` tha — yaani dabane par bilkul kuch
                 * nahi hota tha. Aankh ko button dikhta hai, ungli ko kuch nahi
                 * milta; user ko lagta hai app hi atak gayi.
                 */
                onDelete={() => {
                  if (doc.is_locked) return;
                  setPendingDelete(doc);
                }}
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
              <Ionicons name="gift" size={20} color={tc.white} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.referTitle}>
                {tpl(h.referCard, { d: offers.referralDays })}
              </Text>
              <Text style={styles.referSub}>{h.referCardSub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={tc.terracotta} />
          </Pressable>
        )}
      </ScrollView>

      <ReferralCodeModal visible={refModal} onClose={closeRefModal} />

      {/* Delete wapas nahi aata — Documents tab ki tarah yahan bhi poochh
          ke hi. Dono jagah ek hi sawaal, ek hi shabd. */}
      <ConfirmModal
        visible={!!pendingDelete}
        icon="trash-outline"
        destructive
        title={dt.deleteConfirmTitle}
        message={pendingDelete ? tpl(dt.deleteConfirmBody, { name: pendingDelete.name }) : ""}
        confirmLabel={cm.delete}
        cancelLabel={cm.no}
        onConfirm={() => pendingDelete && runDelete(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
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
    backgroundColor: c.terracotta,
    alignItems: "center",
    justifyContent: "center",
  },
  referTitle: { fontSize: 14.5, fontWeight: "800", color: c.ink },
  referSub: { marginTop: 2, fontSize: 12.5, color: c.inkSoft },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  greeting: { fontSize: 28, fontWeight: "700", color: c.ink },
  sub: { marginTop: 3, fontSize: 15, color: c.inkSoft },
  avatarRing: {
    height: 62,
    width: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 22,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  briefCard: {
    marginTop: 20,
    borderRadius: 26,
    // ⚠️ `c.ink` NAHI. Wo text ka rang hai aur dark theme me ULTA (lagbhag
    // safed) ho jaata hai — card cream ka ban jaata tha aur uspar cream text
    // bilkul gayab. `inkCard` dono theme me gehra rehta hai.
    backgroundColor: c.inkCard,
    padding: 22,
    // Halka sa uthaav — 3D wali entry ke baad card ka apni jagah par "khada"
    // rehna isi se lagta hai. Bina shadow ke wo animation ke khatam hote hi
    // wapas flat ho jaata tha.
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  briefTag: { flexDirection: "row", alignItems: "center", gap: 8 },
  // Icon ko apna chhota dabba — akela sunny icon amber text ke bagal me
  // chipka hua lagta tha.
  briefTagIcon: {
    height: 22,
    width: 22,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(224,164,88,0.18)",
  },
  briefTagText: {
    fontSize: 11.5,
    fontWeight: "800",
    color: c.amber,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  briefBody: {
    marginTop: 12,
    fontSize: 16.5,
    lineHeight: 25,
    fontWeight: "600",
    color: c.onInk,
  },
  briefUpsell: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingTop: 13,
    borderTopWidth: 1,
    borderTopColor: c.onInkLine,
  },
  briefUpsellText: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    color: c.onInkSoft,
  },
  briefUpsellCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: c.amber,
    paddingHorizontal: 11,
    paddingVertical: 6,
  },
  // ⚠️ `c.ink` NAHI — wo dark theme me lagbhag safed ho jaata hai aur amber
  // chip par "Plus lo" poori tarah gayab ho jaata tha. `onAccent` dono theme
  // me gehra rehta hai.
  briefUpsellCtaText: { fontSize: 12, fontWeight: "800", color: c.onAccent },
  todayCard: {
    marginTop: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    padding: 16,
  },
  todayHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  todayTitle: { fontSize: 15, fontWeight: "800", color: c.ink },
  todayRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: c.line,
  },
  todayTask: { fontSize: 15, fontWeight: "600", color: c.ink },
  todayTime: { marginTop: 2, fontSize: 12.5, color: c.inkSoft },
  doneBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: c.sage,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  // Sage dono theme me ujla hai — safed text uspar 3.4:1 (light) aur 2.4:1
  // (dark) par gir jaata tha.
  doneText: { fontSize: 12.5, fontWeight: "700", color: c.onAccent },
  actions: { flexDirection: "row", gap: 12, marginTop: 16 },
  // `Press3D` ek Pressable hai — chaudai isi par baithti hai, andar wale card
  // par nahi (warna teenon apni-apni chaudai le lete aur pankti tedhi ho jaati).
  actionSlot: { flex: 1 },
  action: {
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    // Tay oonchai: teen bhashaon me label ek se do line ka hota hai, aur uske
    // bina teen card teen alag oonchai ke ho jaate the.
    minHeight: 122,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  actionIcon: {
    height: 44,
    width: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
  },
  actionText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: c.ink,
    textAlign: "center",
    lineHeight: 18,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 26,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 19, fontWeight: "700", color: c.ink },
  link: { fontSize: 14, fontWeight: "600", color: c.terracotta },
  loadingBox: { paddingVertical: 30, alignItems: "center" },
  emptyBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    padding: 16,
  },
  emptyText: { fontSize: 14.5, color: c.inkSoft, fontWeight: "500" },
}));
