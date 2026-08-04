import { useState, useRef, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { makeStyles, useColors } from "@/theme/theme";
import { TypingDots as Dots } from "@/components/typing-dots";
import SaathiLogo from "@/components/saathi-logo";
import { VoiceButton } from "@/components/voice-button";
import { UpgradeBanner } from "@/components/upgrade-banner";
import { useUserName, useAuth } from "@/components/auth-provider";
import { useRouter, useFocusEffect } from "expo-router";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";
import { askSaathi, ChatTurn, ChatContext, type AiFailure, type SaathiAction } from "@/lib/ai";
import { ReminderLimitError } from "@/lib/reminders";
import { listRemindersWithPending, saveReminder } from "@/lib/reminder-outbox";
import { listDocuments, type Document } from "@/lib/documents";
import { scheduleReminderSeries, ensureNotifPermission } from "@/lib/notifications";
import { PermissionModal } from "@/components/permission-modal";
import { reliabilityPromptShown } from "@/lib/reliability";
import { formatWhen } from "@/utils/parse-time";
import { reportNetFailure, reportIfNetwork } from "@/lib/net-alert";
import { markFirstReminder } from "@/lib/reviews";
import { useToast } from "@/components/toast";
import { emitDataChanged } from "@/lib/data-events";

/** Chat ki ek line — saathi ki line ke saath tappable document chips ho sakti hain. */
type DocRef = { id: string; name: string; uri: string; path: string; mime: string; type: string };
type Msg = {
  id: string;
  role: "user" | "saathi";
  text: string;
  docs?: DocRef[];
};

/** Reply/sawaal me jin documents ka naam aata hai unke chips niche dikhate hain. */
function matchDocs(text: string, docs: Document[]): DocRef[] {
  const low = text.toLowerCase();
  return docs
    .filter((d) => d.name && low.includes(d.name.toLowerCase()) && !d.is_locked)
    .slice(0, 4)
    .map((d) => ({
      id: d.id,
      name: d.name,
      uri: d.file_uri ?? "",
      path: d.file_path ?? "",
      mime: d.mime_type ?? "",
      type: d.type,
    }));
}

type ThinkingLines = { thinking: string; thinkingLong: string };

/**
 * Saathi kitni der se soch raha hai — 6s baad, phir 15s baad.
 *
 * ⚠️ Ye seedha usi shikayat ka jawab hai jiske liye pehle "internet dheema"
 * banner chal jaata tha. Gemini ko jawab banane me 5-20 second lagna bilkul
 * normal hai; galti ye thi ki us khamoshi ko app "aapka net dheema hai" bol ke
 * bharti thi — jo jhoot bhi tha, aur user ke haath me kuch chhodta bhi nahi tha.
 * Ab wahi khamoshi sach se bhari jaati hai: "main soch raha hoon". Intezaar utna
 * hi rehta hai, par samajh me aata hai.
 *
 * Ye alag component isliye hai (hook nahi): jawab aate hi TypingBubble ke saath
 * ye bhi unmount ho jaata hai, aur agle sawaal par ginti apne aap zero se shuru
 * hoti hai. Warna stage reset karna padta, aur wo effect ke andar setState hota.
 */
function ThinkingHint({ lines }: { lines: ThinkingLines }) {
  const styles = useStyles();
  const [stage, setStage] = useState(0);

  useEffect(() => {
    const soon = setTimeout(() => setStage(1), 6000);
    const late = setTimeout(() => setStage(2), 15_000);
    return () => {
      clearTimeout(soon);
      clearTimeout(late);
    };
  }, []);

  if (stage === 0) return null;
  return (
    <Text style={styles.thinkingHint}>
      {stage === 2 ? lines.thinkingLong : lines.thinking}
    </Text>
  );
}

/**
 * "Saathi type kar raha hai" — WhatsApp jaisa, teen dots.
 *
 * Pehle yahan app ka brand loader (ghoomta logo) tha. Chat me loader galat ishaara
 * deta hai — lagta hai app atak gaya. Dots batate hain ki saamne wala likh raha
 * hai, isliye intezaar swabhavik lagta hai.
 */
function TypingBubble({ lines }: { lines: ThinkingLines }) {
  const styles = useStyles();
  return (
    <View style={styles.saathiRow}>
      <View style={styles.miniAvatar}>
        <SaathiLogo size={26} radius={10} />
      </View>
      <View style={styles.saathiBubble}>
        <Dots />
        <ThinkingHint lines={lines} />
      </View>
    </View>
  );
}

/** Har user ki chat alag key me — device par local (AsyncStorage). */
const CHAT_KEY_PREFIX = "saathi-chat:";
const MAX_STORED = 60;

/** Greeting ka tay id — history banate waqt isi se pehchana jaata hai. */
const GREETING_ID = "1";

/**
 * Har message ka apna, kabhi na dohraaya jaane wala id.
 *
 * ⚠️ Pehle id `String(m.length + 1)` se banta tha — yaani "array me ye kaunsa
 * number hai". Wo tab tak theek chalta hai jab tak chat kabhi kaati na jaye.
 * Par har baar save karte waqt hum sirf aakhri 60 message rakhte hain
 * (`MAX_STORED`). App dobara khulne par array 60 lamba hota hai jiske ids
 * 61...120 tak ho sakte hain — aur agla naya message phir se id "61" le leta
 * tha, jo pehle se maujood hai.
 *
 * Do message ka ek hi `key` React ke liye "ye wahi wala hai" ka matlab rakhta
 * hai: wo purane bubble ko naye ke saath mila deta hai. Screen par uska natija
 * yahi dikhta tha ki lambi chat me jawab galat jagah chipak jaata ya bubble
 * gayab ho jaata.
 */
let msgSeq = 0;
function newMsgId(): string {
  msgSeq += 1;
  return `m${Date.now().toString(36)}-${msgSeq}`;
}

/** Chat me ek turn ke liye zaroori sab kuch — retry isi se dobara chalta hai. */
type Pending = { text: string; history: ChatTurn[] };

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function Chat() {
  const tc = useColors();
  const styles = useStyles();
  const router = useRouter();
  const name = useUserName();
  const { session } = useAuth();
  const toast = useToast();
  const t = useT();
  const ch = t.chat;
  const c = t.common;
  const { locale } = useLocale();
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  /** Aakhri turn jo fail hua — "Dobara bhejo" isi ko chalata hai. */
  const [failedTurn, setFailedTurn] = useState<Pending | null>(null);
  /**
   * Fail kyun hua. `offline` yahan kabhi nahi aata — uske liye poori screen wala
   * popup khulta hai. Baaki teenon me user ko chat me hi sach bata dete hain.
   */
  const [failReason, setFailReason] = useState<AiFailure | null>(null);
  /** Chat se pehla reminder banne par "reminder time pe aaye" wala setup. */
  const [permModal, setPermModal] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => [
    {
      id: GREETING_ID,
      role: "saathi",
      text: tpl(ch.greeting, { name: name ? " " + name : "" }),
    },
  ]);
  const scrollRef = useRef<ScrollView>(null);

  // Chat ko device par save/restore karo — app band karke kholne par gayab na ho.
  const storeKey = CHAT_KEY_PREFIX + (session?.user?.id ?? "guest");
  const hydrated = useRef(false);

  useEffect(() => {
    let alive = true;
    hydrated.current = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storeKey);
        if (alive && raw) {
          const saved = JSON.parse(raw) as Msg[];
          if (Array.isArray(saved) && saved.length > 0) setMessages(saved);
        }
      } catch {
        // corrupt/purana data — chhod do, greeting hi dikhega.
      } finally {
        if (alive) hydrated.current = true;
      }
    })();
    return () => {
      alive = false;
    };
  }, [storeKey]);

  useEffect(() => {
    if (!hydrated.current) return; // load hone se pehle overwrite mat karo
    AsyncStorage.setItem(storeKey, JSON.stringify(messages.slice(-MAX_STORED))).catch(() => {});
  }, [messages, storeKey]);

  /**
   * User ka data (reminders + documents) chat ke context ke liye.
   *
   * ⚠️ Pehle ye dono request HAR message par, AI call se PEHLE chalti thi —
   * yaani ek jawab ke liye teen round-trip lagti thi aur chat "slow" lagti thi
   * (item 7). Ab ye screen khulte hi ek baar aa jaata hai aur cache me rehta
   * hai; bhejte waqt sirf ek hi call jaati hai — AI ki.
   */
  const ctxRef = useRef<{ context: ChatContext; docs: Document[] }>({
    context: { today: new Date().toISOString(), reminders: [], documents: [] },
    docs: [],
  });

  const refreshContext = useCallback(async () => {
    const [rem, docs] = await Promise.all([
      listRemindersWithPending().catch(() => []),
      listDocuments().catch(() => []),
    ]);
    ctxRef.current = {
      docs,
      context: {
        today: new Date().toISOString(),
        reminders: rem
          .filter((r) => r.is_on && !r.is_paused)
          .slice(0, 30)
          .map((r) => ({ title: r.title, when: r.remind_at, on: r.is_on })),
        documents: docs.slice(0, 30).map((dd) => ({
          name: dd.name,
          type: dd.type,
          expiry: dd.expiry,
        })),
      },
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refreshContext();
    }, [refreshContext]),
  );

  async function sendText(text: string) {
    const t = text.trim();
    if (!t || sending) return;
    setInput("");
    setFailedTurn(null);

    const history: ChatTurn[] = messages
      .filter((m) => m.id !== GREETING_ID)
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));

    setMessages((m) => [...m, { id: newMsgId(), role: "user", text: t }]);
    await ask({ text: t, history });
  }

  /**
   * Ek turn AI ko bhejo. Retry bhi isi ko dobara chalata hai — isliye user ka
   * message dobara add nahi hota.
   */
  async function ask(turn: Pending) {
    setSending(true);
    setFailReason(null);
    try {
      const { context, docs } = ctxRef.current;
      const { reply, action, failure } = await askSaathi(turn.text, turn.history, name, {
        locale,
        context,
        fallback: ch.stubReply,
      });

      if (failure) {
        // ⚠️ Yahi wo jagah thi jahan sabse zyada gadbad hoti thi: net fail hone
        // par bhi Saathi ka "main sirf reminders/documents me madad kar sakta
        // hoon" wala decline message chipak jaata tha. User ko lagta tha Saathi
        // ne mana kar diya (item 7 & 15) — jabki baat pahunchi hi nahi thi.
        //
        // Ab: koi jhoota jawab nahi. Ek popup jo sach batata hai + wahi turn
        // dobara bhejne ka raasta.
        //
        // ⚠️ Yahan pehle ek local keyword-parser bhi chalta tha jo net fail hone
        // par khud reminder bana deta tha. Wo hata diya gaya: wo aksar galat
        // time nikaalta tha ("roz 6 baje 90 din tak" ko ek baar ka 6 baje samajh
        // ke) aur user ko lagta tha reminder theek lag gaya. Galat reminder
        // se behtar hai saaf keh dena ki net nahi tha — aur retry de dena.
        //
        // ⚠️ Yahan pehle HAR fail par `reportNetFailure("ai", …)` chalta tha —
        // yaani poori screen ka "internet ne saath nahi diya" popup, awaaz ke
        // saath. Char bilkul alag cheezein us ek popup me ghus jaati thi: sach
        // me offline hona, Gemini ka 429, key ka na hona, aur AI ka der karna.
        // Teen me se teen baar wo popup jhoot bolta tha, aur user ko lagta tha
        // "AI use karte hi internet chala jaata hai".
        //
        // Ab popup sirf `offline` par — jahan wo sach hai.
        setFailedTurn(turn);
        if (failure === "offline") {
          reportNetFailure("ai", () => ask(turn));
        } else {
          setFailReason(failure);
        }
        return;
      }

      // Reply ya sawaal me jis document ka naam aaya, uska tappable chip dikhao.
      const refs = matchDocs(reply + " " + turn.text, docs);
      setMessages((m) => [
        ...m,
        { id: newMsgId(), role: "saathi", text: reply, docs: refs },
      ]);
      if (action) await runAction(action);
    } finally {
      setSending(false);
    }
  }

  /** Reminder DB me daalo + OS me schedule karo. Dono jagah ek hi raasta. */
  async function createReminder(
    title: string,
    when: Date,
    /** Roz wala reminder — AI batata hai, app khud kuch nahi maanti. */
    repeat?: { everyDays?: number | null; until?: string | null },
  ): Promise<boolean> {
    try {
      const label = formatWhen(when, { today: c.today, tomorrow: c.tomorrow }, locale);
      const bucket = isSameDay(when, new Date()) ? "today" : "upcoming";
      // `saveReminder` = net ho to server par, na ho to phone ki kataar me.
      // Alarm dono soorat me lagta hai — usse internet chahiye hi nahi.
      const r = await saveReminder({
        title,
        time_label: label,
        remind_at: when.toISOString(),
        bucket,
        repeat_every_days: repeat?.everyDays ?? null,
        repeat_until: repeat?.until ?? null,
      });

      /**
       * ⚠️ Yahan chat "Add reminder" screen se poori tarah alag chal rahi thi,
       * aur wahi is shikayat ki jad thi ki "chat se bana reminder kaam nahi
       * karta".
       *
       * Pehle: permission na mile to `if (allowed)` chup-chaap schedule skip
       * kar deta tha. Chat me Saathi phir bhi "reminder set kar diya" keh deta
       * tha, koi toast nahi, koi popup nahi — reminder DB me pada rehta tha aur
       * alarm kabhi lagta hi nahi. Add-reminder screen par yahi soorat toast +
       * PermissionModal dono dikhati hai.
       *
       * Ab dono raaste ek jaise hain: sach batao (toast), aur pehli baar wo
       * modal kholo jisme notification, exact-alarm, battery aur OEM auto-start
       * — chaaron allow ho sakti hain. Android par exact-alarm/battery ke bina
       * notification allow hone par bhi reminder ghanton late aata hai.
       */
      const allowed = await ensureNotifPermission();
      const scheduled =
        allowed &&
        (await scheduleReminderSeries(
          r.id,
          title,
          when,
          repeat?.everyDays ?? null,
          repeat?.until ?? null,
        ));
      if (!scheduled) {
        toast.show(allowed ? t.addReminder.savedNoNotif : t.addReminder.savedNeedPerm, "info");
      } else if (r.pending) {
        // Alarm lag gaya par server par jaana baaki hai — chat ka reply "set kar
        // diya" keh chuka hai, isliye ye adhoora hissa alag se batana zaroori hai.
        toast.show(t.addReminder.setOkOffline, "info");
      }
      // Review popup ka padav — chat se bana reminder bhi ginta hai.
      markFirstReminder().catch(() => {});
      // Home/Reminders tab khule pade hain — chat se bana reminder wahan bhi
      // turant dikhna chahiye, tab badalne ka intezaar kiye bina.
      emitDataChanged();

      // Pehli baar reminder banne par reliability setup — bilkul waise hi jaise
      // add-reminder screen par. Android par hamesha (permission mil bhi jaye to
      // exact-alarm/battery/auto-start baaki rehte hain), iOS par sirf tab jab
      // permission mili hi na ho.
      const needsSetup = Platform.OS === "android" || !allowed;
      if (needsSetup && !(await reliabilityPromptShown())) setPermModal(true);
      return true;
    } catch (e) {
      if (e instanceof ReminderLimitError) {
        router.push("/upgrade" as never);
        return false;
      }
      if (reportIfNetwork(e, "save")) return false;
      toast.show(ch.reminderFailed, "error");
      return false;
    }
  }

  /** Saathi ka action client par chalao — limits + notifications reuse hote hain. */
  async function runAction(action: SaathiAction) {
    if (action.type === "navigate" && action.to === "add_document") {
      router.push("/add-document");
      return;
    }
    if (action.type === "create_reminder") {
      /**
       * ⚠️ Relative waqt ("30 second baad", "5 minute baad") ka hisaab YAHIN
       * hota hai — server par nahi. Server jis lamhe time banata hai, wo lamha
       * yahan pahunchte-pahunchte 5-20 second purana ho chuka hota hai.
       *
       * Absolute time par is der se kuch nahi bigadta, isliye ye kabhi pakda
       * nahi gaya. Par "30 second baad" wala reminder is der me poora hi mar
       * jaata tha: AI ka nikala hua time neeche wale `when <= Date.now()` guard
       * se takra ke Add-reminder screen par chala jaata tha. User ke liye iska
       * matlab tha "chat se reminder banta hi nahi".
       *
       * Ab `in_seconds` ki ginti jawab aane ke lamhe se shuru hoti hai — yaani
       * theek wahi jo user ne maanga tha.
       */
      const when =
        typeof action.in_seconds === "number" && action.in_seconds > 0
          ? new Date(Date.now() + action.in_seconds * 1000)
          : action.remind_at
            ? new Date(action.remind_at)
            : new Date(NaN);
      /**
       * ⚠️ Yahan pehle `return` tha — "reply already samhaal chuka hai" maan
       * ke. Wo maan lena galat nikla, aur yahi wo soorat hai jise user "chat se
       * reminder sahi se banta hi nahi" kehta hai: Saathi upar likh chuka hota
       * hai "theek hai, yaad dila dunga", aur neeche action chup-chaap gir jaata
       * hai. Kuch banta nahi, koi toast nahi, koi wajah nahi.
       *
       * Aisa hota kab hai — AI ne din to samajh liya par saal purana likh diya,
       * ya "subah 7 baje" bola aur abhi 9 baj chuke hain (matlab kal wala 7
       * chahiye tha). Dono me title bilkul theek hota hai; sirf time galat hota
       * hai.
       *
       * Isliye ab wahi baat Add-reminder screen par bhej dete hain: title pehle
       * se bhara milta hai, aur user ek tap me sahi time chun ke Save kar deta
       * hai. Baat khoti nahi.
       */
      if (isNaN(when.getTime()) || when.getTime() <= Date.now()) {
        toast.show(ch.reminderNeedsTime, "info");
        router.push({ pathname: "/add-reminder", params: { text: action.title } });
        return;
      }
      const ok = await createReminder(action.title, when, {
        everyDays: action.repeat_every_days,
        until: action.repeat_until,
      });
      // Naya reminder context me bhi aa jaye — agla sawaal usi par ho sakta hai.
      if (ok) void refreshContext();
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <SaathiLogo size={42} radius={16} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Saathi</Text>
          <View style={styles.onlineRow}>
            <View style={styles.dot} />
            <Text style={styles.headerSub}>{ch.online}</Text>
          </View>
        </View>
      </View>

      <UpgradeBanner compact />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m) =>
            m.role === "saathi" ? (
              <View key={m.id} style={styles.saathiRow}>
                <View style={styles.miniAvatar}>
                  <SaathiLogo size={26} radius={10} />
                </View>
                <View style={styles.saathiBubble}>
                  <Text style={styles.saathiText}>{m.text}</Text>
                  {m.docs && m.docs.length > 0 && (
                    <View style={styles.docChips}>
                      {m.docs.map((doc) => (
                        <Pressable
                          key={doc.id}
                          onPress={() =>
                            router.push({
                              pathname: "/document-view",
                              params: {
                                id: doc.id,
                                uri: doc.uri,
                                path: doc.path,
                                mime: doc.mime,
                                name: doc.name,
                                type: doc.type,
                              },
                            } as never)
                          }
                          style={styles.docChip}
                        >
                          <Ionicons name="document-text-outline" size={14} color={tc.terracotta} />
                          <Text style={styles.docChipText} numberOfLines={1}>
                            {doc.name}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </View>
              </View>
            ) : (
              <View key={m.id} style={styles.userBubble}>
                <Text style={styles.userText}>{m.text}</Text>
              </View>
            ),
          )}
          {sending && <TypingBubble lines={ch} />}

          {/* Jawab nahi aaya — message chat me chipka rehta hai, uske saath
              asli wajah aur ek saaf "dobara bhejo". Pehle yahan Saathi ka
              jhoota decline message aa jaata tha (item 7 & 15), aur uske baad
              har wajah ke liye ek hi "internet" wala popup. */}
          {!!failedTurn && !sending && (
            <View style={styles.failWrap}>
              {!!failReason && (
                <Text style={styles.failLine}>
                  {failReason === "busy"
                    ? ch.failBusy
                    : failReason === "slow"
                      ? ch.failSlow
                      : ch.failServer}
                </Text>
              )}
              <Pressable
                onPress={() => {
                  const turn = failedTurn;
                  setFailedTurn(null);
                  setFailReason(null);
                  void ask(turn);
                }}
                style={styles.retryRow}
              >
                <Ionicons name="refresh" size={15} color={tc.terracotta} />
                <Text style={styles.retryText}>{ch.retrySend}</Text>
              </Pressable>
            </View>
          )}
        </ScrollView>

        {/* suggestions */}
        <ScrollView
          horizontal
          style={styles.chipsScroll}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {ch.suggestions.map((s) => (
            <Pressable key={s} onPress={() => sendText(s)} style={styles.chip}>
              <Text style={styles.chipText}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* input */}
        <View style={styles.inputBar}>
          <VoiceButton onText={(t) => setInput((prev) => (prev ? prev + " " + t : t))} />
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={ch.inputPlaceholder}
            placeholderTextColor={tc.inkSoft}
            style={styles.input}
            onSubmitEditing={() => sendText(input)}
            returnKeyType="send"
            multiline
          />
          <Pressable
            onPress={() => sendText(input)}
            disabled={sending}
            style={({ pressed }) => [
              styles.sendBtn,
              (pressed || sending) && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="arrow-up" size={20} color={tc.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Chat se bana reminder time pe baje — notification, exact-alarm,
          battery aur OEM auto-start, sab ek hi jagah se allow. */}
      <PermissionModal visible={permModal} onClose={() => setPermModal(false)} />
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {
    height: 42,
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: c.terracotta,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: c.ink },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
  dot: { height: 7, width: 7, borderRadius: 4, backgroundColor: c.sage },
  headerSub: { fontSize: 12.5, color: c.sage, fontWeight: "500" },
  list: { padding: 16, gap: 14, paddingBottom: 8 },
  saathiRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, maxWidth: "88%" },
  miniAvatar: {
    height: 26,
    width: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: c.terracotta,
    marginBottom: 2,
  },
  saathiBubble: {
    flex: 1,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  saathiText: { color: c.ink, fontSize: 15, lineHeight: 22 },
  docChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  docChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 200,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.cream,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  docChipText: { fontSize: 12.5, fontWeight: "600", color: c.terracotta },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    backgroundColor: c.terracotta,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  userText: { color: c.white, fontSize: 15, lineHeight: 22 },
  thinkingHint: { marginTop: 8, fontSize: 12.5, color: c.inkSoft, fontWeight: "600" },
  failWrap: { alignSelf: "center", alignItems: "center", gap: 10, paddingHorizontal: 24 },
  failLine: {
    fontSize: 13,
    lineHeight: 19,
    color: c.inkSoft,
    fontWeight: "600",
    textAlign: "center",
  },
  retryRow: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.35)",
    backgroundColor: "rgba(194,90,55,0.07)",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  retryText: { fontSize: 13.5, fontWeight: "700", color: c.terracotta },
  chipsScroll: { flexGrow: 0, maxHeight: 56 },
  chips: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, alignItems: "center" },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
  },
  chipText: { fontSize: 13, color: c.ink, fontWeight: "500" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.cream,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: c.ink,
    fontSize: 15,
  },
  sendBtn: {
    height: 48,
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: c.terracotta,
  },
}));
