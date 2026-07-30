import { useState, useRef, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/theme/colors";
import { TypingDots as Dots } from "@/components/typing-dots";
import SaathiLogo from "@/components/saathi-logo";
import { VoiceButton } from "@/components/voice-button";
import { UpgradeBanner } from "@/components/upgrade-banner";
import { useUserName, useAuth } from "@/components/auth-provider";
import { useRouter, useFocusEffect } from "expo-router";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";
import { askSaathi, ChatTurn, ChatContext, type SaathiAction } from "@/lib/ai";
import { listReminders, addReminder, ReminderLimitError } from "@/lib/reminders";
import { listDocuments, type Document } from "@/lib/documents";
import { scheduleReminderSeries, ensureNotifPermission } from "@/lib/notifications";
import { formatWhen } from "@/utils/parse-time";
import { reportNetFailure, reportIfNetwork } from "@/lib/net-alert";
import { markFirstReminder } from "@/lib/reviews";
import { useToast } from "@/components/toast";

/** Chat ki ek line — saathi ki line ke saath tappable document chips ho sakti hain. */
type DocRef = { id: string; name: string; uri: string; path: string };
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
    }));
}

/**
 * "Saathi type kar raha hai" — WhatsApp jaisa, teen dots.
 *
 * Pehle yahan app ka brand loader (ghoomta logo) tha. Chat me loader galat ishaara
 * deta hai — lagta hai app atak gaya. Dots batate hain ki saamne wala likh raha
 * hai, isliye intezaar swabhavik lagta hai.
 */
function TypingBubble() {
  return (
    <View style={styles.saathiRow}>
      <View style={styles.miniAvatar}>
        <SaathiLogo size={26} radius={10} />
      </View>
      <View style={styles.saathiBubble}>
        <Dots />
      </View>
    </View>
  );
}

/** Har user ki chat alag key me — device par local (AsyncStorage). */
const CHAT_KEY_PREFIX = "saathi-chat:";
const MAX_STORED = 60;

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
  /** Aakhri turn jo net ki wajah se fail hua — "Dobara bhejo" isi ko chalata hai. */
  const [failedTurn, setFailedTurn] = useState<Pending | null>(null);
  const [messages, setMessages] = useState<Msg[]>(() => [
    {
      id: "1",
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
      listReminders().catch(() => []),
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
      .filter((m) => m.id !== "1")
      .map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }));

    setMessages((m) => [...m, { id: String(m.length + 1), role: "user", text: t }]);
    await ask({ text: t, history });
  }

  /**
   * Ek turn AI ko bhejo. Retry bhi isi ko dobara chalata hai — isliye user ka
   * message dobara add nahi hota.
   */
  async function ask(turn: Pending) {
    setSending(true);
    try {
      const { context, docs } = ctxRef.current;
      const { reply, action, failed } = await askSaathi(turn.text, turn.history, name, {
        locale,
        context,
        fallback: ch.stubReply,
      });

      if (failed) {
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
        setFailedTurn(turn);
        reportNetFailure("ai", () => ask(turn));
        return;
      }

      // Reply ya sawaal me jis document ka naam aaya, uska tappable chip dikhao.
      const refs = matchDocs(reply + " " + turn.text, docs);
      setMessages((m) => [
        ...m,
        { id: String(m.length + 1), role: "saathi", text: reply, docs: refs },
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
      const r = await addReminder({
        title,
        time_label: label,
        remind_at: when.toISOString(),
        bucket,
        repeat_every_days: repeat?.everyDays ?? null,
        repeat_until: repeat?.until ?? null,
      });
      const allowed = await ensureNotifPermission();
      if (allowed) {
        await scheduleReminderSeries(
          r.id,
          r.title,
          when,
          repeat?.everyDays ?? null,
          repeat?.until ?? null,
        );
      }
      // Review popup ka padav — chat se bana reminder bhi ginta hai.
      markFirstReminder().catch(() => {});
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
      const when = new Date(action.remind_at);
      // Galat/past time — reply already samhaal chuka hai, chup-chaap chhod do.
      if (isNaN(when.getTime()) || when.getTime() <= Date.now()) return;
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
                              params: { uri: doc.uri, path: doc.path, name: doc.name },
                            } as never)
                          }
                          style={styles.docChip}
                        >
                          <Ionicons name="document-text-outline" size={14} color={colors.terracotta} />
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
          {sending && <TypingBubble />}

          {/* Net ki wajah se jawab nahi aaya — message chat me chipka rehta
              hai, aur ek saaf "dobara bhejo". Pehle yahan Saathi ka jhoota
              decline message aa jaata tha (item 7 & 15). */}
          {!!failedTurn && !sending && (
            <Pressable
              onPress={() => {
                const turn = failedTurn;
                setFailedTurn(null);
                void ask(turn);
              }}
              style={styles.retryRow}
            >
              <Ionicons name="refresh" size={15} color={colors.terracotta} />
              <Text style={styles.retryText}>{ch.retrySend}</Text>
            </Pressable>
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
            placeholderTextColor={colors.inkSoft}
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
            <Ionicons name="arrow-up" size={20} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {
    height: 42,
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.terracotta,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
  dot: { height: 7, width: 7, borderRadius: 4, backgroundColor: colors.sage },
  headerSub: { fontSize: 12.5, color: colors.sage, fontWeight: "500" },
  list: { padding: 16, gap: 14, paddingBottom: 8 },
  saathiRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, maxWidth: "88%" },
  miniAvatar: {
    height: 26,
    width: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.terracotta,
    marginBottom: 2,
  },
  saathiBubble: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  saathiText: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  docChips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  docChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: 200,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cream,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  docChipText: { fontSize: 12.5, fontWeight: "600", color: colors.terracotta },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    backgroundColor: colors.terracotta,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  userText: { color: colors.white, fontSize: 15, lineHeight: 22 },
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
  retryText: { fontSize: 13.5, fontWeight: "700", color: colors.terracotta },
  chipsScroll: { flexGrow: 0, maxHeight: 56 },
  chips: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, alignItems: "center" },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
  },
  chipText: { fontSize: 13, color: colors.ink, fontWeight: "500" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cream,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 15,
  },
  sendBtn: {
    height: 48,
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.terracotta,
  },
});
