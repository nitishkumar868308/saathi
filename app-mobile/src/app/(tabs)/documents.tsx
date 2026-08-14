import { useState, useCallback } from "react";
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
import { useDataChanged } from "@/lib/data-events";
import { SkeletonList } from "@/components/loader";
import { reportError } from "@/lib/report-error";
import { timed } from "@/lib/network";
import { listDocuments, deleteDocument, type Document } from "@/lib/documents";
import { cancelDocumentExpiry } from "@/lib/notifications";
import { shareDocuments } from "@/lib/share";
import { expiryStatus } from "@/utils/expiry";
import { DocCard } from "@/components/doc-card";
import { ConfirmModal } from "@/components/confirm-modal";
import { Pagination, usePaged, PAGE_SIZE } from "@/components/pagination";
import { UpgradeBanner } from "@/components/upgrade-banner";
import { useToast } from "@/components/toast";
import { EmptyState } from "@/components/empty-state";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";

type Filter = "all" | "soon" | "expired";

export default function Documents() {
  const tc = useColors();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const { documents: d, common: c } = useT();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingDelete, setPendingDelete] = useState<Document | null>(null);

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: d.filterAll },
    { key: "soon", label: d.filterSoon },
    { key: "expired", label: d.filterExpired },
  ];

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);
        const data = await timed(listDocuments());
        setDocs(data);
      } catch (e) {
        reportError(e, { screen: "documents", action: "load" });
        toast.show(d.title + " ✕", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast, d.title],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /**
   * Badlaav ki khabar seedhe — focus ke intezaar ke bina.
   *
   * ⚠️ Ye tab, Home/Reminders/Notes ke ulta, sirf `useFocusEffect` par tika tha —
   * aur wahi wo galti hai jo `lib/data-events.ts` band karne ke liye bana tha.
   * `document-renew` aur Home ka delete dono `emitDataChanged()` chalate hain aur
   * unki tippani saaf kehti hai "Documents tab bhi khula ho sakta hai" — par
   * yahan use sunne wala koi tha hi nahi.
   *
   * Jo raaste focus chhodte hi nahi, wahan farak dikhta hai: reminder/expiry ka
   * alert MODAL hai (poore app ke upar khulta hai, kisi screen ka focus nahi
   * leta), aur offline upload ki kataar app khuli rehte hue hi khali hoti hai.
   * Un dono par ye list purani padi rehti thi jab tak user doosre tab pe jaake
   * wapas na aaye.
   *
   * `load(true)` — chup-chaap taaza karo. Skeleton dobara dikhana yahan jhatka
   * lagta hai; list to pehle se saamne hai (wahi tareeka Home par hai).
   */
  useDataChanged(() => {
    void load(true);
  });

  async function runDelete(doc: Document) {
    setPendingDelete(null);
    try {
      await deleteDocument(doc);
      // Warna delete kiye document ki expiry notification aati rehti.
      await cancelDocumentExpiry(doc.id);
      setDocs((prev) => prev.filter((x) => x.id !== doc.id));
      toast.show(d.deleted, "success");
    } catch {
      toast.show(d.deleted + " ✕", "error");
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exitSelect() {
    setSelectMode(false);
    setSelected(new Set());
  }

  async function onShareSelected() {
    const chosen = docs.filter((x) => selected.has(x.id) && !x.is_locked);
    if (chosen.length === 0) return;
    const n = await shareDocuments(chosen).catch(() => 0);
    toast.show(n > 0 ? tpl(d.sharedN, { n }) : d.shareFailed, n > 0 ? "success" : "error");
    exitSelect();
  }

  const list = docs.filter((x) => {
    if (filter === "all") return true;
    if (!x.expiry) return false;
    const s = expiryStatus(x.expiry);
    return filter === "soon" ? s === "soon" : s === "expired";
  });

  // 10 per page — filter badle to page 1 pe wapas.
  // Poore app me ek hi page size (7) — pagination.tsx me PAGE_SIZE.
  const { page, setPage, pageCount, pageItems } = usePaged(list, PAGE_SIZE, filter);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerWrap}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{d.title}</Text>
            <Text style={styles.sub}>
              {selectMode ? tpl(d.selectCount, { n: selected.size }) : tpl(d.savedSub, { n: docs.length })}
            </Text>
          </View>
          {docs.length > 0 &&
            (selectMode ? (
              <Pressable onPress={exitSelect} hitSlop={8} style={styles.selBtn}>
                <Ionicons name="close" size={20} color={tc.ink} />
              </Pressable>
            ) : (
              <Pressable onPress={() => setSelectMode(true)} hitSlop={8} style={styles.selBtn}>
                <Ionicons name="checkmark-done-outline" size={20} color={tc.ink} />
              </Pressable>
            ))}
        </View>

        <View style={styles.chips}>
          {filters.map((f) => {
            const active = filter === f.key;
            return (
              <Pressable
                key={f.key}
                onPress={() => setFilter(f.key)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <UpgradeBanner compact />

      {loading ? (
        // Spinner ki jagah skeleton — content ka shape dikhta hai, jump nahi hota
        <View style={styles.list}>
          <SkeletonList count={4} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
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
          {list.length === 0 ? (
            <EmptyState
              icon="document-text-outline"
              title={docs.length === 0 ? d.emptyTitle : d.emptyInCategory}
              body={docs.length === 0 ? d.emptyBodyFirst : d.emptyBodyFilter}
            >
              {docs.length === 0 && (
                <Pressable
                  onPress={() => router.push("/add-document")}
                  style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.9 }]}
                >
                  <Ionicons name="add" size={18} color={tc.white} />
                  <Text style={styles.emptyBtnText}>{d.addBtn}</Text>
                </Pressable>
              )}
            </EmptyState>
          ) : (
            <>
              {pageItems.map((doc) => (
                <DocCard
                  key={doc.id}
                  doc={doc}
                  selectMode={selectMode}
                  selected={selected.has(doc.id)}
                  onPress={() => {
                    if (selectMode) {
                      if (!doc.is_locked) toggleSelect(doc.id);
                      return;
                    }
                    if (doc.is_locked) {
                      router.push("/upgrade" as never);
                      return;
                    }
                    router.push({
                      pathname: "/document-view",
                      params: {
                        // `id` cache ki chaabi hai — iske bina offline file
                        // dhoondhi hi nahi ja sakti.
                        id: doc.id,
                        uri: doc.file_uri ?? "",
                        path: doc.file_path ?? "",
                        mime: doc.mime_type ?? "",
                        name: doc.name,
                        // Renewal guide isi se chunta hai.
                        type: doc.type,
                        // Renew wale button par kya likha jaaye — "nayi expiry
                        // daalo" ya "expiry add karo". Asli document renew screen
                        // khud padhti hai, isliye ye purana ho to bhi nuksan nahi.
                        expiry: doc.expiry ?? "",
                      },
                    } as never);
                  }}
                  onDelete={() => {
                    if (selectMode || doc.is_locked) return;
                    setPendingDelete(doc);
                  }}
                />
              ))}
              <Pagination page={page} pageCount={pageCount} onPage={setPage} />
            </>
          )}
        </ScrollView>
      )}

      {selectMode ? (
        /**
         * ⚠️ Do parat — patti poori chaudai par, button andar CONTENT ke bheetar.
         *
         * Pehle `CONTENT` (maxWidth 560 + alignSelf center) seedha is absolute
         * patti par laga tha, aur wo tablet par galat baithta hai: jis absolute
         * view par `left` aur `right` dono set hon, uspar `alignSelf` lagta hi
         * nahi — patti 560px ki hoke screen ke BAAYIN kinare chipak jaati thi,
         * jabki uske upar ki poori list beech me centered thi.
         */
        <View style={styles.shareBar}>
          <View style={styles.shareInner}>
            <Pressable
              onPress={onShareSelected}
              disabled={selected.size === 0}
              style={({ pressed }) => [
                styles.shareBtn,
                (pressed || selected.size === 0) && { opacity: 0.55 },
              ]}
            >
              <Ionicons name="share-outline" size={18} color={tc.white} />
              <Text style={styles.shareBtnText}>{tpl(d.shareSelected, { n: selected.size })}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => router.push("/add-document")}
          style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="add" size={28} color={tc.white} />
        </Pressable>
      )}

      <ConfirmModal
        visible={!!pendingDelete}
        icon="trash-outline"
        destructive
        title={d.deleteConfirmTitle}
        message={pendingDelete ? tpl(d.deleteConfirmBody, { name: pendingDelete.name }) : ""}
        confirmLabel={c.delete}
        cancelLabel={c.no}
        onConfirm={() => pendingDelete && runDelete(pendingDelete)}
        onCancel={() => setPendingDelete(null)}
      />
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  headerWrap: { ...CONTENT },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 16 },
  selBtn: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  title: { fontSize: 26, fontWeight: "700", color: c.ink },
  sub: { marginTop: 4, fontSize: 14, color: c.inkSoft },
  chips: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 16 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: c.ink, borderColor: c.ink },
  chipText: { fontSize: 13.5, fontWeight: "600", color: c.inkSoft },
  chipTextActive: { color: c.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  centerText: { color: c.inkSoft, fontSize: 14 },
  list: { padding: 20, gap: 10, paddingBottom: 100, ...CONTENT },
  emptyBtn: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 16,
    backgroundColor: c.terracotta,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  emptyBtnText: { color: c.white, fontWeight: "700", fontSize: 14.5 },
  skeleton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    padding: 14,
    opacity: 0.65,
  },
  skelIcon: { height: 44, width: 44, borderRadius: 14, backgroundColor: c.line },
  skelLine: { height: 12, borderRadius: 6, backgroundColor: c.line },
  hint: {
    textAlign: "center",
    marginTop: 8,
    fontSize: 12,
    color: c.inkSoft,
    opacity: 0.7,
  },
  shareBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 16,
    backgroundColor: c.surface,
    borderTopWidth: 1,
    borderTopColor: c.line,
  },
  // Button khud utni hi chaudai le jitni list — `CONTENT` yahan lagta hai,
  // upar wali absolute patti par nahi (wajah JSX me likhi hai).
  shareInner: { ...CONTENT },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 16,
    backgroundColor: c.terracotta,
  },
  shareBtnText: { color: c.white, fontWeight: "700", fontSize: 15.5 },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    height: 58,
    width: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: c.terracotta,
    shadowColor: c.terracotta,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
}));
