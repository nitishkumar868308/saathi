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
import { expiryStatus } from "@/utils/expiry";
import { DocCard } from "@/components/doc-card";
import { useToast } from "@/components/toast";

type Filter = "all" | "soon" | "expired";
const filters: { key: Filter; label: string }[] = [
  { key: "all", label: "Sab" },
  { key: "soon", label: "Jald expire" },
  { key: "expired", label: "Expired" },
];

export default function Documents() {
  const router = useRouter();
  const toast = useToast();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);
        const data = await listDocuments();
        setDocs(data);
      } catch (e) {
        toast.show("Documents load nahi ho paye", "error");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast],
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  function confirmDelete(doc: Document) {
    Alert.alert("Delete karein?", `"${doc.name}" hata denge?`, [
      { text: "Nahi", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDocument(doc.id);
            setDocs((prev) => prev.filter((d) => d.id !== doc.id));
            toast.show("Document delete ho gaya", "success");
          } catch {
            toast.show("Delete nahi ho paya", "error");
          }
        },
      },
    ]);
  }

  const list = docs.filter((d) => {
    if (filter === "all") return true;
    if (!d.expiry) return false;
    const s = expiryStatus(d.expiry);
    return filter === "soon" ? s === "soon" : s === "expired";
  });

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.headerWrap}>
        <View style={styles.header}>
          <Text style={styles.title}>Documents</Text>
          <Text style={styles.sub}>{docs.length} saved · expiry auto-tracked</Text>
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

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.terracotta} size="large" />
          <Text style={styles.centerText}>Load ho raha hai...</Text>
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
                {docs.length === 0 ? "Abhi koi document nahi" : "Is category mein kuch nahi"}
              </Text>
              <Text style={styles.emptyBody}>
                Neeche + dabake apna pehla document add karo — Saathi expiry yaad rakhega.
              </Text>
            </View>
          ) : (
            list.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                onPress={() =>
                  router.push({
                    pathname: "/document-view",
                    params: { uri: doc.file_uri ?? "", name: doc.name },
                  } as never)
                }
                onLongPress={() => confirmDelete(doc)}
              />
            ))
          )}
          <Text style={styles.hint}>Delete karne ke liye card ko dabaye rakho</Text>
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
