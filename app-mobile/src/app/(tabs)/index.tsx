import { useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";

import { colors } from "@/theme/colors";
import SaathiMark from "@/components/saathi-mark";
import { UpgradeBanner } from "@/components/upgrade-banner";
import { listDocuments, type Document } from "@/lib/documents";
import { expiryStatus } from "@/utils/expiry";
import { DocCard } from "@/components/doc-card";
import { useToast } from "@/components/toast";
import { useUserName } from "@/components/auth-provider";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";

export default function Home() {
  const router = useRouter();
  const toast = useToast();
  const firstName = useUserName();
  const { home: h } = useT();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (isRefresh = false) => {
      try {
        if (!isRefresh) setLoading(true);
        setDocs(await listDocuments());
      } catch {
        toast.show("Data load nahi ho paya", "error");
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
              {tpl(h.greeting, { name: firstName ? ` ${firstName}` : "" })} 👋
            </Text>
            <Text style={styles.sub}>{h.briefLabel}</Text>
          </View>
          <View style={styles.avatar}>
            <SaathiMark size={24} color={colors.white} />
          </View>
        </View>

        <UpgradeBanner flush />

        {/* Daily brief card */}
        <View style={styles.briefCard}>
          <View style={styles.briefTag}>
            <Ionicons name="sunny" size={13} color={colors.amber} />
            <Text style={styles.briefTagText}>{h.briefLabel}</Text>
          </View>
          <Text style={styles.briefBody}>
            {loading
              ? h.briefLoading
              : attention.length > 0
                ? tpl(h.briefAttention, {
                    name: firstName ? " " + firstName : "",
                    n: attention.length,
                  }) + " 🙂"
                : docs.length === 0
                  ? tpl(h.briefStart, { name: firstName ? " " + firstName : "" }) + " 📄"
                  : tpl(h.briefAllSet, { name: firstName ? " " + firstName : "" }) + " 🌿"}
          </Text>
        </View>

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
        </View>

        {/* Attention */}
        <View style={styles.sectionHead}>
          <Text style={styles.sectionTitle}>{h.attention}</Text>
          <Pressable onPress={() => router.push("/documents")}>
            <Text style={styles.link}>{h.seeAll}</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={colors.terracotta} />
          </View>
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
                    params: { uri: doc.file_uri ?? "", name: doc.name },
                  } as never)
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingBottom: 32, ...CONTENT },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  greeting: { fontSize: 28, fontWeight: "700", color: colors.ink },
  sub: { marginTop: 3, fontSize: 15, color: colors.inkSoft },
  avatar: {
    height: 46,
    width: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.terracotta,
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
