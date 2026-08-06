import { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { makeStyles, useColors, useThemeMode } from "@/theme/theme";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";
import { useToast } from "@/components/toast";
import { EmptyState } from "@/components/empty-state";
import { ScreenLoader } from "@/components/loader";
import { ConfirmModal } from "@/components/confirm-modal";
import { reportError } from "@/lib/report-error";
import { reportIfNetwork } from "@/lib/net-alert";
import {
  listNotesWithReminders,
  deleteNote,
  updateNote,
  noteTitle,
  notePreview,
  type NoteWithReminder,
} from "@/lib/notes";
import { useDataChanged } from "@/lib/data-events";

/**
 * Notes ki list.
 *
 * Layout do-column ka hai (masonry jaisa), kyunki note aksar chhote hote hain —
 * "doodh, atta, chini" ke liye poori chaudi row lena list ko bevajah lamba kar
 * deta hai aur ek screen par 4-5 se zyada note dikhte hi nahi. Do column me
 * ek nazar me poora hafta dikh jaata hai.
 *
 * Pin kiye hue note hamesha upar — 40 note ho jaane par yahi ek cheez list ko
 * kaam ka rakhti hai.
 */

/**
 * Har note ko uska apna halka rang — ek jaisi cardon ki deewar padhne me
 * thakati hai.
 *
 * ⚠️ DO set, aur ye zaroori hai. Pehle sirf ek (light wala) tha aur wo
 * hardcoded chipka rehta tha. Dark theme me card halka-pastel hi rehta tha
 * jabki uske andar ka text `c.ink` se aata hai — jo dark me UJLA ho jaata hai.
 * Natija: cream card par cream text, yaani poora note gayab. List me sirf
 * rangeen khaali cards dikhte the.
 *
 * Dark wale rang jaan-boojh ke gehre-rangeen hain (halke nahi): card page se
 * alag to dikhna chahiye, par uspar ujla text 10:1 se upar padhna chahiye.
 */
const TINTS_LIGHT = [
  { bg: "#FFF6E8", edge: "#F0DFC0" },
  { bg: "#F1F5EC", edge: "#D9E3CE" },
  { bg: "#FDF0EA", edge: "#F2D9CC" },
  { bg: "#F4F1FA", edge: "#DFD8EE" },
] as const;

const TINTS_DARK = [
  { bg: "#332B1E", edge: "#4A3F2C" },
  { bg: "#242C22", edge: "#374030" },
  { bg: "#332420", edge: "#4A342E" },
  { bg: "#2A2634", edge: "#3C3748" },
] as const;

/**
 * Rang note ki ID se chunte hain, list me uski jagah se nahi.
 *
 * ⚠️ Index se chunna bhaddi baat karta hai: ek note pin karte hi neeche ke saare
 * note ek khaana khisak jaate hain aur poori screen ke rang ek saath badal jaate
 * hain — lagta hai kuch toot gaya. ID kabhi badalti nahi, isliye note ka rang
 * uska apna rehta hai.
 */
function tintFor(id: string, dark: boolean) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  const set = dark ? TINTS_DARK : TINTS_LIGHT;
  return set[h % set.length];
}

export default function Notes() {
  const tc = useColors();
  const { scheme } = useThemeMode();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const { notes: n, common: c } = useT();
  const { locale } = useLocale();
  const bcp = locale === "hi" ? "hi-IN" : "en-IN";

  const [items, setItems] = useState<NoteWithReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [query, setQuery] = useState("");
  const [toDelete, setToDelete] = useState<NoteWithReminder | null>(null);

  // Named function expression: `load` apne hi andar se khud ko bula sakta hai
  // (net-alert ka "Dobara koshish karo" isse chalta hai). Bahar wale `const` ko
  // andar se padhna TDZ me girta hai, isliye naam yahan diya gaya hai.
  const load = useCallback(
    async function load(silent = false) {
      try {
        if (!silent) setLoading(true);
        setItems(await listNotesWithReminders());
      } catch (e) {
        if (!reportIfNetwork(e, "load", () => void load(silent))) {
          reportError(e, { screen: "notes", action: "load" });
          toast.show(n.loadFailed, "error");
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast, n.loadFailed],
  );

  useFocusEffect(
    useCallback(() => {
      void load(items.length > 0);
      // `items.length` jaan-boojh ke bahar hai: use deps me daalne par har note
      // add/delete ke baad ye effect dobara chalta aur list do baar aati.
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );

  // Note edit screen se wapas aane par list turant taaza — screen chhodni na pade.
  useDataChanged(() => {
    void load(true);
  });

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (x) =>
        (x.title ?? "").toLowerCase().includes(q) || x.body.toLowerCase().includes(q),
    );
  }, [items, query]);

  /** Do column — chhote cards ki wajah se list aadhi lambai me aa jaati hai. */
  const columns = useMemo(() => {
    const left: NoteWithReminder[] = [];
    const right: NoteWithReminder[] = [];
    shown.forEach((x, i) => (i % 2 === 0 ? left : right).push(x));
    return [left, right];
  }, [shown]);

  async function togglePin(note: NoteWithReminder) {
    const next = !note.is_pinned;
    // Pehle screen par, phir server par — pin dabate hi card upar chala jaana
    // chahiye, warna ek tap ke baad kuch hua hi nahi lagta.
    setItems((prev) =>
      [...prev.map((x) => (x.id === note.id ? { ...x, is_pinned: next } : x))].sort(
        (a, b) =>
          Number(b.is_pinned) - Number(a.is_pinned) ||
          b.updated_at.localeCompare(a.updated_at),
      ),
    );
    try {
      await updateNote(note.id, { is_pinned: next });
    } catch (e) {
      if (!reportIfNetwork(e, "save")) toast.show(n.saveFailed, "error");
      void load(true);
    }
  }

  async function doDelete() {
    const note = toDelete;
    setToDelete(null);
    if (!note) return;
    try {
      await deleteNote(note.id);
      setItems((prev) => prev.filter((x) => x.id !== note.id));
      toast.show(n.deleted, "success");
    } catch (e) {
      if (!reportIfNetwork(e, "save")) toast.show(c.delete + " ✕", "error");
    }
  }

  const dayLabel = (iso: string) =>
    new Date(iso).toLocaleDateString(bcp, { day: "numeric", month: "short" });

  /** Reminder kab hai — chip me date + time dono, taaki dobara na lagaya jaye. */
  const whenLabel = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return n.reminderOn;
    return d.toLocaleString(bcp, {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  if (loading) return <ScreenLoader />;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={24} color={tc.ink} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{n.title}</Text>
          {items.length > 0 && (
            <Text style={styles.sub}>
              {items.length === 1 ? n.countOne : tpl(n.count, { n: items.length })}
            </Text>
          )}
        </View>
      </View>

      {/* Search sirf tab jab dhoondhne layak note ho hi — 3 note ke upar ek
          khaali search box screen ko bhara-bhara aur uljha hua dikhata hai. */}
      {items.length > 4 && (
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={17} color={tc.inkSoft} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={n.searchPh}
            placeholderTextColor={tc.inkSoft}
            style={styles.search}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={tc.inkSoft} />
            </Pressable>
          )}
        </View>
      )}

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(true);
            }}
            tintColor={tc.terracotta}
          />
        }
      >
        {shown.length === 0 ? (
          <EmptyState
            icon="create-outline"
            title={query ? n.searchEmpty : n.empty}
            body={query ? undefined : n.emptyHint}
          />
        ) : (
          <View style={styles.grid}>
            {columns.map((col, ci) => (
              <View key={ci} style={styles.col}>
                {col.map((note) => {
                  const tint = tintFor(note.id, scheme === "dark");
                  const preview = notePreview(note);
                  return (
                    <Pressable
                      key={note.id}
                      onPress={() =>
                        router.push({
                          pathname: "/note-edit" as never,
                          params: { id: note.id },
                        })
                      }
                      onLongPress={() => setToDelete(note)}
                      style={({ pressed }) => [
                        styles.card,
                        { backgroundColor: tint.bg, borderColor: tint.edge },
                        pressed && { opacity: 0.85 },
                      ]}
                    >
                      {note.is_pinned && (
                        <Ionicons
                          name="bookmark"
                          size={13}
                          color={tc.terracotta}
                          style={styles.pinMark}
                        />
                      )}
                      <Text style={styles.cardTitle} numberOfLines={2}>
                        {noteTitle(note, n.untitled)}
                      </Text>
                      {!!preview && (
                        <Text style={styles.cardBody} numberOfLines={6}>
                          {preview}
                        </Text>
                      )}
                      {/* Reminder ban chuka hai — user ko yahin dikhna chahiye,
                          warna wo wahi reminder dobara laga deta hai aur ek hi
                          baat ka alarm do baar bajta hai. */}
                      {!!note.reminder && (
                        <View style={styles.remChip}>
                          <Ionicons
                            name={note.reminder.is_on ? "alarm" : "alarm-outline"}
                            size={12}
                            color={note.reminder.is_on ? tc.sage : tc.inkSoft}
                          />
                          <Text
                            style={[
                              styles.remChipText,
                              !note.reminder.is_on && { color: tc.inkSoft },
                            ]}
                            numberOfLines={1}
                          >
                            {note.reminder.is_on
                              ? note.reminder.remind_at
                                ? whenLabel(note.reminder.remind_at)
                                : n.reminderOn
                              : n.reminderOff}
                          </Text>
                        </View>
                      )}

                      <View style={styles.cardFoot}>
                        <Text style={styles.cardDate}>{dayLabel(note.updated_at)}</Text>
                        <Pressable
                          onPress={() => void togglePin(note)}
                          hitSlop={10}
                          style={styles.pinBtn}
                        >
                          <Ionicons
                            name={note.is_pinned ? "bookmark" : "bookmark-outline"}
                            size={15}
                            color={note.is_pinned ? tc.terracotta : tc.inkSoft}
                          />
                        </Pressable>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      <Pressable
        onPress={() => router.push("/note-edit" as never)}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}
      >
        <Ionicons name="add" size={24} color={tc.white} />
        <Text style={styles.fabText}>{n.add}</Text>
      </Pressable>

      <ConfirmModal
        visible={!!toDelete}
        title={n.deleteAsk}
        message={toDelete ? noteTitle(toDelete, n.untitled) : undefined}
        confirmLabel={c.delete}
        cancelLabel={c.cancel}
        icon="trash"
        destructive
        onConfirm={() => void doDelete()}
        onCancel={() => setToDelete(null)}
      />
    </SafeAreaView>
  );
}

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 10,
  },
  back: { padding: 4 },
  title: { fontSize: 24, fontWeight: "800", color: c.ink },
  sub: { marginTop: 1, fontSize: 12.5, color: c.inkSoft },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 10,
    paddingHorizontal: 12,
    height: 42,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  search: { flex: 1, fontSize: 14.5, color: c.ink, padding: 0 },
  // FAB list ke aakhri card ko dhak na le.
  scroll: { paddingHorizontal: 12, paddingBottom: 110 },
  grid: { flexDirection: "row", gap: 10 },
  col: { flex: 1, gap: 10 },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 13,
    // Chhota sa uthaav — cream background par card alag dikhe.
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  pinMark: { position: "absolute", top: 10, right: 10 },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: "700",
    color: c.ink,
    lineHeight: 20,
    // Pin ke nishaan ke neeche title na chale jaye.
    paddingRight: 16,
  },
  cardBody: { marginTop: 5, fontSize: 12.5, lineHeight: 18, color: c.inkSoft },
  remChip: {
    marginTop: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 9,
    backgroundColor: "rgba(124,138,107,0.16)",
  },
  remChipText: { flexShrink: 1, fontSize: 11, fontWeight: "700", color: c.sage },
  cardFoot: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardDate: { fontSize: 11, color: c.inkSoft, opacity: 0.85 },
  pinBtn: { padding: 2 },
  fab: {
    position: "absolute",
    right: 18,
    bottom: 26,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    height: 52,
    paddingHorizontal: 20,
    borderRadius: 26,
    backgroundColor: c.terracotta,
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabText: { fontSize: 14.5, fontWeight: "800", color: c.white },
}));
