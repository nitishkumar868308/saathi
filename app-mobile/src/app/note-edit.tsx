import { useEffect, useRef, useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";

import { makeStyles, useColors } from "@/theme/theme";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { useToast } from "@/components/toast";
import { ConfirmModal } from "@/components/confirm-modal";
import { Loader, LoaderOverlay } from "@/components/loader";
import { VoiceButton } from "@/components/voice-button";
import { reportError } from "@/lib/report-error";
import { reportIfNetwork } from "@/lib/net-alert";
import {
  addNote,
  deleteNote,
  listNotesWithReminders,
  updateNote,
  noteTitle,
} from "@/lib/notes";
import { emitDataChanged } from "@/lib/data-events";
import { useKeyboardHeight } from "@/lib/use-keyboard";

/**
 * Ek note likho / badlo.
 *
 * `?id=` ho to purana note khulta hai, na ho to naya.
 *
 * Screen jaan-boojh ke lagbhag khaali hai — ek title ki line, aur baaki poora
 * safed kaagaz. Note likhne ka poora matlab hi "abhi, bina soche" hai; upar
 * chaar option aur neeche do toolbar daal dene se wahi jhijhak wapas aa jaati
 * hai jiski wajah se log note kahin aur likhte hain.
 *
 * "Reminder me daalo" isi screen par isliye hai ki baat aksar likhne ke BAAD
 * waqt maangti hai ("doodh lena hai" → "shaam 7 baje"). Wo button note ka text
 * `/add-reminder` ko de deta hai, jahan Saathi usi text se din/time khud samajh
 * leta hai — user ko wahi baat dobara nahi likhni padti. Note apni jagah bacha
 * rehta hai.
 */
export default function NoteEdit() {
  const tc = useColors();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const { notes: n, common: c, voice: v } = useT();
  const { locale } = useLocale();
  /** Keyboard ki oonchai — footer isse upar rehta hai (upar wajah likhi hai). */
  const kb = useKeyboardHeight();
  const bcp = locale === "hi" ? "hi-IN" : "en-IN";

  /** Reminder kab hai — "12 Aug, 6:00 pm". */
  const whenLabel = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    return d.toLocaleString(bcp, {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const { id } = useLocalSearchParams<{ id?: string }>();
  const noteId = typeof id === "string" && id ? id : null;

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [loading, setLoading] = useState(!!noteId);
  const [saving, setSaving] = useState(false);
  const [askDelete, setAskDelete] = useState(false);
  /**
   * Is note ka reminder — hai to uska abhi ka haal.
   *
   * ⚠️ Ye dikhana zaroori hai. Bina iske "Reminder me daalo" hamesha ek jaisa
   * dikhta tha, chahe reminder pehle se laga ho — aur user use dobara daba deta
   * tha. Ek hi baat ke do alarm, do alag waqt par.
   */
  const [reminder, setReminder] = useState<{
    remind_at: string | null;
    is_on: boolean;
  } | null>(null);

  /**
   * Jo aakhri baar server par gaya tha.
   *
   * ⚠️ Iske bina back dabate hi hamesha ek save chala jaata — user ne kuch badla
   * ho ya sirf note khol ke band kar diya ho. Wo `updated_at` ko chhoo deta hai
   * aur note list me sabse upar aa jaata: bina kisi wajah ke tarteeb badalti
   * rehti thi.
   */
  const saved = useRef({ title: "", body: "", pinned: false });

  /**
   * Jis note par hum likh rahe hain uski asli id.
   *
   * ⚠️ Pehle yahan ek `done` flag tha ("save ho chuka, ab dobara mat karo"). Wo
   * naye note ko do baar banne se to rokta tha, par ek aur cheez bhi rok deta
   * tha — uske BAAD ki har edit. Ye theek us raaste par hota tha jo sabse aam
   * hai: naya note likho → "Reminder me daalo" (yahan chup-chaap save hota
   * hai) → reminder screen se wapas aao → do line aur likho → back. Wo do line
   * kahin save hi nahi hoti thi, aur likhne wale ko kabhi pata nahi chalta.
   *
   * Asli sawaal "save ho chuka?" nahi hai, "kis id par likhein?" hai. Naya note
   * banne ke baad uski id yahan aa jaati hai, aur agla save INSERT ki jagah
   * UPDATE karta hai — duplicate bhi nahi banta aur edit bhi nahi khoti.
   */
  const savedId = useRef<string | null>(noteId);
  // Delete ke baad koi save nahi (row hi nahi bachi).
  const gone = useRef(false);

  useEffect(() => {
    if (!noteId) return;
    let alive = true;
    void (async () => {
      try {
        const found = (await listNotesWithReminders()).find((x) => x.id === noteId);
        if (!alive || !found) return;
        setTitle(found.title ?? "");
        setBody(found.body);
        setPinned(found.is_pinned);
        setReminder(found.reminder);
        saved.current = {
          title: found.title ?? "",
          body: found.body,
          pinned: found.is_pinned,
        };
      } catch (e) {
        if (alive) reportError(e, { screen: "note-edit", action: "load" });
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [noteId]);

  const dirty =
    title !== saved.current.title ||
    body !== saved.current.body ||
    pinned !== saved.current.pinned;
  const empty = !title.trim() && !body.trim();

  /**
   * Save.
   *
   * `silent` = user ne Save nahi dabaya, wo bas screen chhod raha hai. Aisi
   * soorat me toast dikhana galat hai — usne kuch maanga hi nahi tha.
   */
  async function save(silent = false): Promise<boolean> {
    // Bilkul khaali note banane ka koi matlab nahi — list me ek khaali card
    // pada rehta hai jise user baad me dhoondh ke delete karta hai.
    if (empty || !dirty || gone.current) return true;
    try {
      setSaving(true);
      const id = savedId.current;
      if (id) {
        await updateNote(id, { title, body, is_pinned: pinned });
      } else {
        // Naya note — id yaad rakho, warna agla save ek aur note bana dega.
        const made = await addNote({ title, body });
        savedId.current = made.id;
        // Pin naye note ke insert me nahi jaata (addNote sirf title+body leta
        // hai), isliye on ho to turant alag se laga do.
        if (pinned) await updateNote(made.id, { is_pinned: true });
      }
      saved.current = { title, body, pinned };
      emitDataChanged();
      if (!silent) toast.show(n.saved, "success");
      return true;
    } catch (e) {
      if (!reportIfNetwork(e, "save", () => void save(silent))) {
        reportError(e, { screen: "note-edit", action: "save" });
        toast.show(n.saveFailed, "error");
      }
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function onBack() {
    // Chup-chaap bacha lo. Note likhne wala "Save" dhoondhta nahi — wo back
    // dabata hai aur maan leta hai ki likha hua bach gaya. Us bharose ka toot-na
    // sabse mehngi galti hai, kyunki likha hua wapas nahi aata.
    await save(true);
    router.back();
  }

  async function onSave() {
    if (await save()) router.back();
  }

  function toReminder() {
    const text = `${title.trim()} ${body.trim()}`.trim();
    if (!text) {
      toast.show(n.toReminderEmpty, "info");
      return;
    }
    // Pehle note bacha lo — reminder banate waqt user wapas nahi aayega, aur
    // bina save kiye ye screen ud jaayegi.
    void save(true).then(() => {
      // `savedId` save ke BAAD bharta hai — isliye push usi ke andar hai. Naye
      // note par pehle id chahiye, warna reminder banega par kis note se juda
      // hai wo kabhi pata nahi chalega.
      const id = savedId.current;
      /**
       * ⚠️ Ab `/add-reminder` nahi — `/note-reminder`.
       *
       * Purani screen note ka poora text ek text-box me daal deti thi aur AI se
       * usme title/waqt dhoondhne ko kehti thi. Do cheezein wahi toot-ti thi:
       * note ka poora paragraph reminder ka title ban jaata (notification me
       * chaar line, jo koi padhta hi nahi), aur note me waqt hota hi nahi to AI
       * poochhta rehta — jabki user ne to sirf itna kaha tha ki "iska reminder
       * laga do".
       *
       * Nayi screen sirf EK sawaal poochhti hai: kab? Kaam ka text note se
       * waise ka waisa jaata hai.
       */
      router.push({
        pathname: "/note-reminder",
        params: id ? { text, noteId: id } : { text },
      } as never);
    });
  }

  async function doDelete() {
    setAskDelete(false);
    // Kabhi save hua hi nahi (naya note, kuch likha nahi) — hatane ko kuch hai
    // hi nahi.
    const id = savedId.current;
    if (!id) {
      gone.current = true;
      router.back();
      return;
    }
    try {
      await deleteNote(id);
      gone.current = true;
      emitDataChanged();
      toast.show(n.deleted, "success");
      router.back();
    } catch (e) {
      if (!reportIfNetwork(e, "save")) toast.show(c.delete + " ✕", "error");
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => void onBack()} hitSlop={10} style={styles.iconBtn}>
          <Ionicons name="chevron-back" size={24} color={tc.ink} />
        </Pressable>

        <View style={styles.headerRight}>
          <Pressable
            onPress={() => setPinned((p) => !p)}
            hitSlop={10}
            style={styles.iconBtn}
          >
            <Ionicons
              name={pinned ? "bookmark" : "bookmark-outline"}
              size={21}
              color={pinned ? tc.terracotta : tc.inkSoft}
            />
          </Pressable>
          {!!noteId && (
            <Pressable onPress={() => setAskDelete(true)} hitSlop={10} style={styles.iconBtn}>
              <Ionicons name="trash-outline" size={20} color={tc.inkSoft} />
            </Pressable>
          )}
          {/**
           * Save — loader BUTTON ke andar, poori screen par nahi.
           *
           * ⚠️ Pehle yahan sirf text tha aur save par ek full-screen
           * `LoaderOverlay` khul jaata tha. Do dikkatein thi:
           *
           *  • Note save hone me aksar aadha second lagta hai. Us aadhe second
           *    ke liye poori screen par ek gehra parda aur beech me bada logo
           *    aana ek chhote se kaam ke liye bahut bada jhatka hai — screen
           *    "blink" karti hui lagti thi.
           *  • Aur wo parda note ko dhak leta tha, to user ko ye dikhta hi nahi
           *    tha ki uska likha hua bach gaya ya nahi. Uske baad screen band ho
           *    jaati aur toast peeche kahin dikhta.
           *
           * Ab kaam wahin dikhta hai jahan user ne tap kiya (button ke andar
           * chhota loader), note saamne rehta hai, aur uske baad toast aata hai.
           *
           * `minWidth` isliye ki text aur loader ki chaudai alag hai — bina
           * iske button save karte hi sikud jaata aur header hil jaata.
           */}
          <Pressable
            onPress={() => void onSave()}
            disabled={empty || saving}
            style={({ pressed }) => [
              styles.saveBtn,
              empty && { opacity: 0.45 },
              pressed && !saving && { opacity: 0.85 },
            ]}
          >
            {saving ? (
              <Loader size={18} />
            ) : (
              <Text style={styles.saveText}>{c.save}</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/*
        ⚠️ `KeyboardAvoidingView` yahan se hata diya gaya hai — wo Android par
        kuch karta hi nahi tha, aur wahi user ki shikayat thi: note likhte hi
        neeche ke dono button (mic aur "Reminder set karo") keyboard ke peeche
        chale jaate the aur unka hona hi pata nahi chalta tha.

        Wajah edge-to-edge hai (Android 15 se zabardasti). Us haalat me window
        resize hoti hi nahi, aur KAV ka poora Android raasta usi resize par tika
        tha. Ab keyboard ki oonchai khud naapte hain (`useKeyboardHeight`) aur
        footer ko utna upar utha dete hain — dono platform par ek hi vyavhaar.
      */}
      <View style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder={n.titlePh}
            placeholderTextColor={tc.inkSoft}
            style={styles.titleInput}
          />
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder={n.bodyPh}
            placeholderTextColor={tc.inkSoft}
            multiline
            // Naya note khulte hi keyboard aa jaye — ek tap bacha, aur screen ka
            // maqsad turant saaf ho jaata hai.
            autoFocus={!noteId}
            textAlignVertical="top"
            style={styles.bodyInput}
          />
        </ScrollView>

        {/**
         * Bolo — Saathi likh lega.
         *
         * ⚠️ Note wahi ek jagah thi jahan sabse zyada likhna padta hai aur mic
         * tha hi nahi. Chat aur reminder me wo pehle se tha, isliye jo user
         * wahan bol ke kaam nikaal leta tha, wo note par aake ruk jaata tha —
         * aur bade akshar wale phone par lamba note type karna hi wo kaam hai
         * jo log sabse pehle chhod dete hain.
         *
         * Matn BODY me jaata hai, title me nahi: bola hua aksar poora wakya
         * hota hai, aur title ki ek line usse kaat deti. Title waise bhi list
         * me pehli line se apne aap ban jaata hai.
         *
         * ⚠️ Space ke saath jodte hain, seedha chipka ke nahi — warna do baar
         * bol ke jodne par "dawai lenibills bharna" ban jaata hai.
         */}
        {/* Footer — mic aur reminder, dono keyboard ke UPAR rehte hain. */}
        <View style={{ paddingBottom: kb }}>
        <View style={styles.voiceRow}>
          <VoiceButton onText={(t) => setBody((prev) => (prev.trim() ? `${prev.trim()} ${t}` : t))} />
          <Text style={styles.voiceHint} numberOfLines={2}>
            {v.micHint}
          </Text>
        </View>

        {/* Reminder pehle se laga ho to button ki jagah uska haal — dobara
            lagane ka mauka hi na mile. */}
        {reminder ? (
          <View style={styles.remindDone}>
            <Ionicons
              name={reminder.is_on ? "alarm" : "alarm-outline"}
              size={18}
              color={reminder.is_on ? tc.sage : tc.inkSoft}
            />
            <Text
              style={[styles.remindDoneText, !reminder.is_on && { color: tc.inkSoft }]}
            >
              {reminder.is_on
                ? reminder.remind_at
                  ? `${n.reminderOn} · ${whenLabel(reminder.remind_at)}`
                  : n.reminderOn
                : n.reminderOff}
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={toReminder}
            style={({ pressed }) => [styles.remindBtn, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="alarm-outline" size={18} color={tc.terracotta} />
            <Text style={styles.remindText}>{n.toReminder}</Text>
            <Ionicons name="chevron-forward" size={16} color={tc.terracotta} />
          </Pressable>
        )}
        </View>
      </View>

      <ConfirmModal
        visible={askDelete}
        title={n.deleteAsk}
        message={noteTitle({ title, body }, n.untitled)}
        confirmLabel={c.delete}
        cancelLabel={c.cancel}
        icon="trash"
        destructive
        onConfirm={() => void doDelete()}
        onCancel={() => setAskDelete(false)}
      />

      {/* Overlay SIRF pehli load par (note server se aa raha hai) — tab screen
          par dikhane ko kuch hai hi nahi. Save par nahi: uska loader button ke
          andar hai, taaki note saamne rahe aur screen blink na kare. */}
      <LoaderOverlay visible={loading} />
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.surface },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10,
    paddingTop: 4,
    paddingBottom: 8,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  iconBtn: { padding: 8 },
  saveBtn: {
    marginLeft: 4,
    height: 38,
    // Text aur loader ki chaudai alag hai — `minWidth` ke bina button save
    // karte hi sikud jaata aur poora header hil jaata.
    minWidth: 84,
    paddingHorizontal: 18,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.terracotta,
  },
  saveText: { fontSize: 14, fontWeight: "800", color: c.white },
  scroll: { paddingHorizontal: 20, paddingBottom: 24, ...CONTENT },
  titleInput: {
    fontSize: 22,
    fontWeight: "800",
    color: c.ink,
    paddingVertical: 8,
  },
  bodyInput: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 25,
    color: c.ink,
    // Kaagaz jaisa lage — poori screen likhne ke liye khuli rahe.
    minHeight: 320,
    padding: 0,
  },
  /* Mic + uske saath ek line ki samajh — "isse bol ke likhwa sakte ho". */
  voiceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 10,
  },
  voiceHint: { flex: 1, fontSize: 12.5, lineHeight: 18, color: c.inkSoft },
  remindBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.32)",
    backgroundColor: "rgba(194,90,55,0.07)",
  },
  remindText: { flex: 1, fontSize: 14.5, fontWeight: "700", color: c.terracotta },
  remindDone: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 16,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(124,138,107,0.35)",
    backgroundColor: "rgba(124,138,107,0.10)",
  },
  remindDoneText: { flex: 1, fontSize: 13.5, fontWeight: "700", color: c.sage },
}));
