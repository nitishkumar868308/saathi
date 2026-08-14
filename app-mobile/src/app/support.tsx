import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  Keyboard,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";

import { KeyboardView } from "@/components/keyboard-view";
import { makeStyles, useColors } from "@/theme/theme";
import { Loader } from "@/components/loader";
import SaathiLogo from "@/components/saathi-logo";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";
import { logEvent } from "@/lib/analytics";
import { reportIfNetwork } from "@/lib/net-alert";
import {
  listTickets,
  listMessages,
  createTicket,
  replyToTicket,
  markSeen,
  SupportError,
  type Ticket,
  type TicketMessage,
} from "@/lib/support";

/**
 * Support — app se sawaal poochho, jawab yahin aata hai.
 *
 * ⚠️ Pehle app me sirf "Contact" tha: user message likhta, wo email me chala
 * jaata, aur baat wahin khatam. User ke paas na koi number hota tha jisse wo
 * poochh sake "mere sawaal ka kya hua", na jawab kabhi app me wapas aata tha.
 * Admin ke paas bhi bikhre hue email ke alawa kuch nahi tha.
 *
 * Ab har sawaal ek baatcheet hai — WhatsApp jaisi — apne number ke saath
 * (jaise AS-310726-143052, jisme taarikh aur samay dono dikhte hain). Jawab
 * teen jagah pahunchta hai: yahan, email par, aur phone ki notification me.
 *
 * Teen halat ek hi screen me (alag route nahi): list, naya sawaal, aur
 * baatcheet. Alag routes me back button ka vyavhaar uljhan wala ho jaata hai —
 * ticket bhejne ke baad "back" user ko khaali form par wapas le aata.
 */

type Screen = "list" | "new" | "thread";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function Support() {
  const tc = useColors();
  const styles = useStyles();
  const t = useT();
  const s = t.support;
  const toast = useToast();

  /**
   * `ticketId` — notification se aaye to seedha usi ticket me khol do.
   * `subject`  — kisi screen ne pehle se bhara hua subject bheja hai.
   *
   * Abhi `subject` ek hi jagah se aata hai: profile ka "OTP limit poori ho
   * gayi" wala note. Wahan user ko apni dikkat likhni hi nahi padti (aur wo
   * aksar "verify nahi ho raha" jaisa kuch likhta hai, jisse admin ko kuch
   * pata nahi chalta). Ek jaisa subject aane se admin ko har aisi ticket ek hi
   * shakal me milti hai — dhoondhne aur nipatane me kahin aasan.
   */
  const params = useLocalSearchParams<{ ticketId?: string; subject?: string }>();

  const [view, setView] = useState<Screen>("list");
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[] | null>(null);

  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);

  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    const list = await listTickets();
    setTickets(list);
    return list;
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const openThread = useCallback(async (ticket: Ticket) => {
    setOpenTicket(ticket);
    setMessages(null);
    setReply("");
    setView("thread");
    const msgs = await listMessages(ticket.id);
    setMessages(msgs);
    // Khulte hi "padh liya" — admin ko dikhta hai ki jawab pahunch gaya.
    void markSeen(ticket.id);
  }, []);

  /**
   * Keyboard khula to aakhri message par aa jao.
   *
   * Keyboard ke liye list chhoti ho jaati hai par uska content nahi badalta,
   * isliye `onContentSizeChange` nahi chalta — aur jis message ka jawab dena
   * hai wahi upar khisak ke gayab ho jaata tha.
   */
  useEffect(() => {
    if (view !== "thread") return;
    const sub = Keyboard.addListener("keyboardDidShow", () => {
      scrollRef.current?.scrollToEnd({ animated: true });
    });
    return () => sub.remove();
  }, [view]);

  // Notification par tap se aaye — us ticket ko dhoondh ke kholo.
  const deepLinked = useRef(false);
  useEffect(() => {
    const id = params.ticketId;
    if (!id || deepLinked.current || !tickets) return;
    const found = tickets.find((x) => x.id === id);
    if (found) {
      deepLinked.current = true;
      void openThread(found);
    }
  }, [params.ticketId, tickets, openThread]);

  /**
   * Pehle se bhara hua subject leke aaye — seedha "nayi ticket" wala form kholo.
   *
   * `prefilled` ref ke bina ye har render par chalta aur user ka apna likha hua
   * subject wapas mita deta.
   */
  const prefilled = useRef(false);
  useEffect(() => {
    const sub = typeof params.subject === "string" ? params.subject.trim() : "";
    if (!sub || prefilled.current) return;
    prefilled.current = true;
    setSubject(sub);
    setView("new");
  }, [params.subject]);

  /* ------------------------------- actions ------------------------------- */

  function handleError(e: unknown) {
    if (e instanceof SupportError) {
      toast.show(e.setupMissing ? s.setupMissing : s.failed, "error");
      return;
    }
    // Net ki dikkat ka apna popup + retry hota hai — usse yahan dobara toast
    // dikhana user ko do baar wahi baat kehna hai.
    if (reportIfNetwork(e, "save")) return;
    toast.show(s.failed, "error");
  }

  async function submitNew() {
    const sub = subject.trim();
    const msg = body.trim();
    if (sub.length < 3 || msg.length < 3) {
      toast.show(s.tooShort, "info");
      return;
    }
    setBusy(true);
    try {
      const no = await createTicket(sub, msg);
      logEvent("click", { target: "support_ticket_created" });
      setSubject("");
      setBody("");
      const list = await load();
      toast.show(tpl(s.created, { no: no ?? "" }), "success");
      // Naya ticket sabse upar hota hai — seedha usi me le jao, taaki user ko
      // apna bheja hua message aur number dono turant dikhein.
      if (list[0]) await openThread(list[0]);
      else setView("list");
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  async function submitReply() {
    const msg = reply.trim();
    if (!openTicket || msg.length < 1) return;
    setBusy(true);
    try {
      await replyToTicket(openTicket.id, msg);
      setReply("");
      setMessages(await listMessages(openTicket.id));
      void load();
    } catch (e) {
      handleError(e);
    } finally {
      setBusy(false);
    }
  }

  /* -------------------------------- header -------------------------------- */

  const header = (
    <View style={styles.header}>
      <Pressable
        onPress={() => {
          if (view === "list") router.back();
          else setView("list");
        }}
        hitSlop={10}
        style={styles.backBtn}
      >
        <Ionicons name="chevron-back" size={22} color={tc.ink} />
      </Pressable>
      <View style={{ flex: 1 }}>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {view === "thread" ? openTicket?.subject : s.title}
        </Text>
        {view === "thread" && !!openTicket && (
          <Text style={styles.headerNo}>{openTicket.ticket_no}</Text>
        )}
      </View>
      {view === "list" && (
        <Pressable onPress={() => setView("new")} hitSlop={8} style={styles.newBtn}>
          <Ionicons name="add" size={17} color={tc.white} />
          <Text style={styles.newBtnText}>{s.newBtn}</Text>
        </Pressable>
      )}
    </View>
  );

  /* --------------------------------- views --------------------------------- */

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {header}

      {view === "list" && (
        <ScrollView
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={async () => {
                setRefreshing(true);
                await load();
                setRefreshing(false);
              }}
              tintColor={tc.terracotta}
            />
          }
        >
          <Text style={styles.sub}>{s.sub}</Text>

          {tickets === null ? (
            <View style={styles.center}>
              <Loader size={40} />
            </View>
          ) : tickets.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="help-buoy-outline" size={34} color={tc.terracotta} />
              <Text style={styles.emptyTitle}>{s.empty}</Text>
              <Text style={styles.emptyHint}>{s.emptyHint}</Text>
              <Pressable onPress={() => setView("new")} style={styles.cta}>
                <Text style={styles.ctaText}>{s.newBtn}</Text>
              </Pressable>
            </View>
          ) : (
            tickets.map((x) => (
              <Pressable
                key={x.id}
                onPress={() => void openThread(x)}
                style={({ pressed }) => [styles.row, pressed && { opacity: 0.9 }]}
              >
                <View style={styles.rowTop}>
                  <Text style={styles.rowNo}>{x.ticket_no}</Text>
                  <StatusChip status={x.status} s={s} />
                </View>
                <Text style={styles.rowSubject} numberOfLines={2}>
                  {x.subject}
                </Text>
                <Text style={styles.rowTime}>{fmt(x.last_message_at)}</Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      )}

      {view === "new" && (
        // Yahan bhi wahi baat: keyboard message wale bade box ko dhak leta tha.
        // (Poori wajah `components/keyboard-view.tsx` par likhi hai.)
        <KeyboardView>
          <ScrollView contentContainerStyle={styles.listContent} keyboardShouldPersistTaps="handled">
            <Text style={styles.formTitle}>{s.newTitle}</Text>

            <Text style={styles.label}>{s.subjectLabel}</Text>
            <TextInput
              value={subject}
              onChangeText={setSubject}
              placeholder={s.subjectPh}
              placeholderTextColor={tc.inkSoft}
              style={styles.input}
            />

            <Text style={styles.label}>{s.messageLabel}</Text>
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={s.messagePh}
              placeholderTextColor={tc.inkSoft}
              multiline
              style={[styles.input, styles.textarea]}
            />

            <Pressable
              onPress={() => void submitNew()}
              disabled={busy}
              style={({ pressed }) => [styles.cta, (pressed || busy) && { opacity: 0.85 }]}
            >
              {busy ? (
                <Loader size={22} />
              ) : (
                <Ionicons name="paper-plane" size={17} color={tc.white} />
              )}
              <Text style={styles.ctaText}>{busy ? s.sending : s.send}</Text>
            </Pressable>

            <Text style={styles.hint}>{s.createdHint}</Text>
          </ScrollView>
        </KeyboardView>
      )}

      {view === "thread" && (
        /**
         * ⚠️ Yahan pehle `KeyboardAvoidingView` tha aur wo naye Android par kuch
         * karta hi nahi (edge-to-edge me window keyboard ke liye chhoti hoti hi
         * nahi — poori wajah `components/keyboard-view.tsx` par likhi hai).
         * Natija: keyboard khulte hi likhne ka box uske NEECHE chala jaata tha,
         * aur user ko apna type kiya hua dikhta hi nahi tha (item 5).
         */
        <KeyboardView>
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.threadContent}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages === null ? (
              <View style={styles.center}>
                <Loader size={40} />
              </View>
            ) : (
              <>
                {messages.map((m) =>
                  m.sender === "admin" ? (
                    <View key={m.id} style={styles.themRow}>
                      <View style={styles.avatar}>
                        <SaathiLogo size={24} radius={9} />
                      </View>
                      <View style={styles.themBubble}>
                        <Text style={styles.themText}>{m.body}</Text>
                        <Text style={styles.themTime}>
                          {s.team} · {fmt(m.created_at)}
                        </Text>
                      </View>
                    </View>
                  ) : (
                    <View key={m.id} style={styles.youBubble}>
                      <Text style={styles.youText}>{m.body}</Text>
                      <Text style={styles.youTime}>{fmt(m.created_at)}</Text>
                    </View>
                  ),
                )}
                {/* Jawab abhi aaya nahi — chup screen se behtar hai keh dena ki
                    baat pahunch gayi hai. Warna user dobara ticket banata hai. */}
                {openTicket?.status === "open" && (
                  <Text style={styles.waiting}>{s.waiting}</Text>
                )}
              </>
            )}
          </ScrollView>

          <View style={styles.inputBar}>
            <TextInput
              value={reply}
              onChangeText={setReply}
              placeholder={s.replyPh}
              placeholderTextColor={tc.inkSoft}
              multiline
              style={styles.replyInput}
            />
            <Pressable
              onPress={() => void submitReply()}
              disabled={busy || !reply.trim()}
              style={({ pressed }) => [
                styles.sendBtn,
                (pressed || busy || !reply.trim()) && { opacity: 0.6 },
              ]}
            >
              <Ionicons name="arrow-up" size={19} color={tc.white} />
            </Pressable>
          </View>
        </KeyboardView>
      )}
    </SafeAreaView>
  );
}

function StatusChip({
  status,
  s,
}: {
  status: string;
  s: ReturnType<typeof useT>["support"];
}) {
  const tc = useColors();
  const styles = useStyles();
  const map: Record<string, { label: string; bg: string; fg: string }> = {
    open: { label: s.stOpen, bg: "rgba(224,164,88,0.2)", fg: tc.terracottaDark },
    answered: { label: s.stAnswered, bg: "rgba(124,138,107,0.16)", fg: tc.sage },
    closed: { label: s.stClosed, bg: tc.creamDeep, fg: tc.inkSoft },
  };
  const v = map[status] ?? map.open;
  return (
    <View style={[styles.chip, { backgroundColor: v.bg }]}>
      <Text style={[styles.chipText, { color: v.fg }]}>{v.label}</Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "800", color: c.ink },
  headerNo: {
    marginTop: 1,
    fontSize: 11.5,
    fontWeight: "700",
    letterSpacing: 0.4,
    color: c.terracotta,
  },
  newBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: c.terracotta,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  newBtnText: { fontSize: 12.5, fontWeight: "800", color: c.white },

  listContent: { padding: 16, gap: 12, paddingBottom: 40 },
  sub: { fontSize: 14, lineHeight: 21, color: c.inkSoft },
  center: { paddingVertical: 40, alignItems: "center" },

  emptyCard: {
    alignItems: "center",
    gap: 10,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 22,
    paddingVertical: 30,
  },
  emptyTitle: { fontSize: 17, fontWeight: "800", color: c.ink },
  emptyHint: {
    fontSize: 13.5,
    lineHeight: 20,
    color: c.inkSoft,
    textAlign: "center",
  },

  row: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    padding: 14,
  },
  rowTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  rowNo: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: "800",
    letterSpacing: 0.4,
    color: c.terracotta,
  },
  rowSubject: { marginTop: 6, fontSize: 15, fontWeight: "700", color: c.ink },
  rowTime: { marginTop: 4, fontSize: 11.5, color: c.inkSoft },
  chip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  chipText: { fontSize: 10.5, fontWeight: "800" },

  formTitle: { fontSize: 19, fontWeight: "800", color: c.ink },
  label: { marginTop: 6, fontSize: 13, fontWeight: "700", color: c.ink },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: c.ink,
  },
  textarea: { minHeight: 140, textAlignVertical: "top" },
  cta: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: c.terracotta,
  },
  ctaText: { fontSize: 15.5, fontWeight: "800", color: c.white },
  hint: { fontSize: 12.5, lineHeight: 18.5, color: c.inkSoft },

  threadContent: { padding: 16, gap: 12, paddingBottom: 8 },
  themRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, maxWidth: "90%" },
  avatar: {
    height: 24,
    width: 24,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: c.terracotta,
    marginBottom: 2,
  },
  themBubble: {
    flex: 1,
    borderRadius: 18,
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  themText: { fontSize: 14.5, lineHeight: 21, color: c.ink },
  themTime: { marginTop: 5, fontSize: 10.5, color: c.inkSoft },
  youBubble: {
    alignSelf: "flex-end",
    maxWidth: "86%",
    borderRadius: 18,
    borderBottomRightRadius: 6,
    backgroundColor: c.terracotta,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  youText: { fontSize: 14.5, lineHeight: 21, color: c.white },
  youTime: { marginTop: 5, fontSize: 10.5, color: "rgba(255,255,255,0.75)" },
  waiting: {
    alignSelf: "center",
    marginTop: 6,
    maxWidth: "85%",
    fontSize: 12.5,
    lineHeight: 18,
    color: c.inkSoft,
    textAlign: "center",
  },

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
  replyInput: {
    flex: 1,
    maxHeight: 120,
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.cream,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: c.ink,
  },
  sendBtn: {
    height: 46,
    width: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: c.terracotta,
  },
}));
