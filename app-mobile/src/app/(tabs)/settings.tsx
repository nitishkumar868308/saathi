import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { colors } from "@/theme/colors";
import SaathiMark from "@/components/saathi-mark";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { signOut } from "@/lib/auth";
import { useToast } from "@/components/toast";
import { getPlan, WEB_URL } from "@/lib/plan";
import { useOffers } from "@/lib/use-offers";

type RowId =
  | "saathi_name"
  | "notifications"
  | "language"
  | "privacy"
  | "export"
  | "delete_all"
  | "help"
  | "about";

type Row = { id: RowId; icon: string; label: string; tint?: string };

const groups: { title: string; rows: Row[] }[] = [
  {
    title: "Saathi",
    rows: [
      { id: "saathi_name", icon: "happy-outline", label: "Saathi ka naam" },
      { id: "notifications", icon: "notifications-outline", label: "Notifications" },
      { id: "language", icon: "language-outline", label: "Bhasha (Hindi / English)" },
    ],
  },
  {
    title: "Privacy",
    rows: [
      { id: "privacy", icon: "lock-closed-outline", label: "Privacy & data" },
      { id: "export", icon: "download-outline", label: "Mera data export karo" },
      { id: "delete_all", icon: "trash-outline", label: "Sab data delete", tint: "#B23B3B" },
    ],
  },
  {
    title: "Aur",
    rows: [
      { id: "help", icon: "help-circle-outline", label: "Help & support" },
      { id: "about", icon: "information-circle-outline", label: "About Apka Saathi" },
    ],
  },
];

export default function Settings() {
  const { session, rewardsVersion } = useAuth();
  const toast = useToast();
  const offers = useOffers();
  const meta = session?.user?.user_metadata;
  const name = meta?.full_name || meta?.name || "Aapka account";
  const [isPlus, setIsPlus] = useState(false);

  // rewardsVersion dep zaroori hai: first-N / referral grant login ke baad
  // background me hota hai. Iske bina screen "Free" pe atki rehti thi.
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getPlan()
      .then((p) => setIsPlus(p.isPlus))
      .catch(() => {});
  }, [rewardsVersion]);

  async function logout() {
    try {
      await signOut();
    } catch {
      toast.show("Logout nahi hua", "error");
    }
  }

  async function openUrl(path: string) {
    try {
      await WebBrowser.openBrowserAsync(`${WEB_URL}${path}`);
    } catch {
      toast.show("Link nahi khula", "error");
    }
  }

  /** Sirf apna data (documents + reminders) delete — account nahi. */
  async function deleteAllData() {
    Alert.alert(
      "Sab data delete karein?",
      "Aapke saare documents aur reminders hamesha ke liye hat jaayenge. Account nahi hatega. Ye wapas nahi aayega.",
      [
        { text: "Nahi", style: "cancel" },
        {
          text: "Haan, delete karo",
          style: "destructive",
          onPress: async () => {
            try {
              const sb = supabase;
              const uid = session?.user?.id;
              if (!sb || !uid) throw new Error("no session");
              await Promise.all([
                sb.from("documents").delete().eq("user_id", uid),
                sb.from("reminders").delete().eq("user_id", uid),
              ]);
              toast.show("Aapka data delete ho gaya", "success");
            } catch {
              toast.show("Delete nahi ho paya", "error");
            }
          },
        },
      ],
    );
  }

  function handleRow(id: RowId) {
    switch (id) {
      case "saathi_name":
      case "export":
        // Naam + details (aur export ke liye contact) ek hi jagah.
        router.push("/profile-details" as never);
        if (id === "export") {
          toast.show("Data export ke liye help se contact karo", "info");
        }
        return;
      case "notifications":
        Linking.openSettings().catch(() =>
          toast.show("Settings nahi khuli", "error"),
        );
        return;
      case "language":
        Alert.alert(
          "Bhasha",
          "Apka Saathi abhi Hinglish (Hindi + English) me hai — dono samajh me aata hai. Aur bhashaayein jald aa rahi hain.",
        );
        return;
      case "privacy":
        openUrl("/privacy");
        return;
      case "delete_all":
        deleteAllData();
        return;
      case "help":
        openUrl("/contact");
        return;
      case "about":
        openUrl("/about");
        return;
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile card */}
        <View style={styles.profile}>
          <View style={styles.pAvatar}>
            <SaathiMark size={32} color={colors.white} />
          </View>
          <Text style={styles.pName}>{name}</Text>
          <Text style={styles.pSub}>{session?.user?.email ?? ""}</Text>
          <View
            style={[
              styles.statusChip,
              { backgroundColor: isSupabaseConfigured ? "rgba(124,138,107,0.15)" : "rgba(194,90,55,0.12)" },
            ]}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: isSupabaseConfigured ? colors.sage : colors.terracotta },
              ]}
            />
            <Text
              style={[
                styles.statusText,
                { color: isSupabaseConfigured ? colors.sage : colors.terracotta },
              ]}
            >
              {isSupabaseConfigured ? "Backend juda hai" : "Backend set nahi (.env bharo)"}
            </Text>
          </View>
        </View>

        {/* Meri membership — kab aaye, kab tak Plus, kis wajah se */}
        <Pressable
          onPress={() => router.push("/membership" as never)}
          style={({ pressed }) => [styles.detailsRow, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="ribbon-outline" size={20} color={colors.terracotta} />
          <Text style={styles.detailsText}>Meri membership</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.line} />
        </Pressable>

        {/* Meri details */}
        <Pressable
          onPress={() => router.push("/profile-details" as never)}
          style={({ pressed }) => [styles.detailsRow, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="person-outline" size={20} color={colors.terracotta} />
          <Text style={styles.detailsText}>Meri details (name, phone, address…)</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.line} />
        </Pressable>

        {/* Dost bulao — referral (band ho to row hi nahi) */}
        {offers.referralsEnabled && (
          <Pressable
            onPress={() => router.push("/referral" as never)}
            style={({ pressed }) => [styles.detailsRow, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="gift-outline" size={20} color={colors.terracotta} />
            <Text style={styles.detailsText}>
              Dost bulao — dono ko {offers.referralDays} din Plus free
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.line} />
          </Pressable>
        )}

        {/* Plan / Saathi Plus */}
        <Pressable
          onPress={() => router.push("/upgrade" as never)}
          style={({ pressed }) => [styles.planCard, pressed && { opacity: 0.92 }]}
        >
          <View style={styles.planIcon}>
            <Ionicons
              name={isPlus ? "star" : "sparkles"}
              size={22}
              color={colors.white}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.planTitle}>
              {isPlus ? "Saathi Plus — active" : "Saathi Plus lo"}
            </Text>
            <Text style={styles.planSub}>
              {isPlus
                ? "Unlimited docs, family sharing, daily brief"
                : "Unlimited docs, family sharing + aur bahut kuch"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(247,242,233,0.7)" />
        </Pressable>

        {groups.map((g) => (
          <View key={g.title} style={{ marginTop: 22 }}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            <View style={styles.card}>
              {g.rows.map((r, i) => (
                <Pressable
                  key={r.id}
                  onPress={() => handleRow(r.id)}
                  style={({ pressed }) => [
                    styles.row,
                    i < g.rows.length - 1 && styles.rowBorder,
                    pressed && { backgroundColor: colors.creamDeep },
                  ]}
                >
                  <Ionicons
                    name={r.icon as any}
                    size={20}
                    color={r.tint ?? colors.inkSoft}
                  />
                  <Text style={[styles.rowLabel, r.tint && { color: r.tint }]}>
                    {r.label}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.line} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Pressable
          onPress={logout}
          style={({ pressed }) => [styles.logout, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="log-out-outline" size={20} color="#B23B3B" />
          <Text style={styles.logoutText}>Logout</Text>
        </Pressable>

        <Text style={styles.version}>Apka Saathi · v0.1.0 · Made in India ❤️</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 20, paddingBottom: 40 },
  profile: { alignItems: "center", paddingVertical: 12 },
  pAvatar: {
    height: 72,
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: colors.terracotta,
  },
  pName: { marginTop: 12, fontSize: 22, fontWeight: "700", color: colors.ink },
  pSub: { marginTop: 2, fontSize: 14, color: colors.inkSoft },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginTop: 12,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusDot: { height: 7, width: 7, borderRadius: 4 },
  statusText: { fontSize: 12.5, fontWeight: "600" },
  detailsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  detailsText: { flex: 1, fontSize: 15, fontWeight: "600", color: colors.ink },
  planCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 22,
    borderRadius: 20,
    padding: 16,
    backgroundColor: colors.ink,
  },
  planIcon: {
    height: 44,
    width: 44,
    borderRadius: 15,
    backgroundColor: colors.terracotta,
    alignItems: "center",
    justifyContent: "center",
  },
  planTitle: { fontSize: 15.5, fontWeight: "700", color: colors.white },
  planSub: { marginTop: 2, fontSize: 12.5, color: "rgba(247,242,233,0.65)" },
  groupTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowLabel: { flex: 1, fontSize: 15, color: colors.ink },
  logout: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(178,59,59,0.3)",
    backgroundColor: "rgba(178,59,59,0.06)",
  },
  logoutText: { color: "#B23B3B", fontWeight: "700", fontSize: 15 },
  version: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 13,
    color: colors.inkSoft,
  },
});

