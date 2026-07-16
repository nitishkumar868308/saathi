import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { colors } from "@/theme/colors";
import { listDocuments, deleteDocument, type Document } from "@/lib/documents";
import { cancelDocumentExpiry } from "@/lib/notifications";
import { expiryStatus } from "@/utils/expiry";
import { DocCard } from "@/components/doc-card";
import { UpgradeBanner } from "@/components/upgrade-banner";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";

type Filter = "all" | "soon" | "expired";

export default function Documents() {
  const router = useRouter();
  const toast = useToast();
  const { documents: d, common: c } = useT();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const filters: { key: Filter; label: string }[] = [
    { key: "all", label: d.filterAll },
    { key: "soon", label: d.filterSoon },
    { key: "expired", label: d.filterExpired },
  ];

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);
        const data = await listDocuments();
        setDocs(data);
      } catch (e) {
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

  function confirmDelete(doc: Document) {
    Alert.alert(d.deleteConfirmTitle, tpl(d.deleteConfirmBody, { name: doc.name }), [
      { text: c.no, style: "cancel" },
      {
        text: c.delete,
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDocument(doc.id);
            // Warna delete kiye document ki expiry notification aati rehti.
            await cancelDocumentExpiry(doc.id);
            setDocs((prev) => prev.filter((x) => x.id !== doc.id));
            toast.show(d.deleted, "success");
          } catch {
            toast.show(d.deleted + " ✕", "error");
          }
        },
      },
    ]);
  }

  const list = docs.filter((x) => {
    if (filter === "all") return true;
    if (!x.expiry) return false;
    const s = expiryStatus(x.expiry);
    return filter === "soon" ? s === "soon" : s === "expired";
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerWrap}>
        <View style={styles.header}>
          <Text style={styles.title}>{d.title}</Text>
          <Text style={styles.sub}>{tpl(d.savedSub, { n: docs.length })}</Text>
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
          {[0, 1, 2].map((i) => (
            <View key={i} style={styles.skeleton}>
              <View style={styles.skelIcon} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={[styles.skelLine, { width: "62%" }]} />
                <View style={[styles.skelLine, { width: "38%", height: 10 }]} />
              </View>
            </View>
          ))}
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
              tintColor={colors.terracotta}
              colors={[colors.terracotta]}
            />
          }
        >
          {list.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="document-text-outline" size={28} color={colors.terracotta} />
              </View>
              <Text style={styles.emptyTitle}>
                {docs.length === 0 ? d.emptyTitle : d.emptyInCategory}
              </Text>
              <Text style={styles.emptyBody}>
                {docs.length === 0 ? d.emptyBodyFirst : d.emptyBodyFilter}
              </Text>
              {docs.length === 0 && (
                <Pressable
                  onPress={() => router.push("/add-document")}
                  style={({ pressed }) => [styles.emptyBtn, pressed && { opacity: 0.9 }]}
                >
                  <Ionicons name="add" size={18} color={colors.white} />
                  <Text style={styles.emptyBtnText}>{d.addBtn}</Text>
                </Pressable>
              )}
            </View>
          ) : (
            list.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                onPress={() =>
                  doc.is_locked
                    ? router.push("/upgrade" as never)
                    : router.push({
                        pathname: "/document-view",
                        params: {
                          uri: doc.file_uri ?? "",
                          path: doc.file_path ?? "",
                          name: doc.name,
                        },
                      } as never)
                }
                onLongPress={() => confirmDelete(doc)}
              />
            ))
          )}
          <Text style={styles.hint}>{d.longPressHint}</Text>
        </ScrollView>
      )}

      <Pressable
        onPress={() => router.push("/add-document")}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.9 }]}
      >
        <Ionicons name="add" size={28} color={colors.white} />
      </Pressable>
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  headerWrap: { ...CONTENT },
  header: { paddingHorizontal: 20, paddingTop: 16 },
  title: { fontSize: 26, fontWeight: "700", color: colors.ink },
  sub: { marginTop: 4, fontSize: 14, color: colors.inkSoft },
  chips: { flexDirection: "row", gap: 8, paddingHorizontal: 20, paddingTop: 16 },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  chipActive: { backgroundColor: colors.ink, borderColor: colors.ink },
  chipText: { fontSize: 13.5, fontWeight: "600", color: colors.inkSoft },
  chipTextActive: { color: colors.cream },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  centerText: { color: colors.inkSoft, fontSize: 14 },
  list: { padding: 20, gap: 10, paddingBottom: 100, ...CONTENT },
  empty: { alignItems: "center", paddingVertical: 48, gap: 10 },
  emptyIcon: {
    height: 64,
    width: 64,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: "rgba(194,90,55,0.10)",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 18, fontWeight: "600", color: colors.ink },
  emptyBody: {
    fontSize: 14,
    lineHeight: 21,
    color: colors.inkSoft,
    textAlign: "center",
    maxWidth: 280,
  },
  emptyBtn: {
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 16,
    backgroundColor: colors.terracotta,
    paddingHorizontal: 20,
    paddingVertical: 13,
  },
  emptyBtnText: { color: colors.white, fontWeight: "700", fontSize: 14.5 },
  skeleton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 14,
    opacity: 0.65,
  },
  skelIcon: { height: 44, width: 44, borderRadius: 14, backgroundColor: colors.line },
  skelLine: { height: 12, borderRadius: 6, backgroundColor: colors.line },
  hint: {
    textAlign: "center",
    marginTop: 8,
    fontSize: 12,
    color: colors.inkSoft,
    opacity: 0.7,
  },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 24,
    height: 58,
    width: 58,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 20,
    backgroundColor: colors.terracotta,
    shadowColor: colors.terracotta,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});
