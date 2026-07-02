import { View, Text, ScrollView, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/theme/colors";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { signOut } from "@/lib/auth";
import { useToast } from "@/components/toast";

type Row = { icon: string; label: string; tint?: string };

const groups: { title: string; rows: Row[] }[] = [
  {
    title: "Saathi",
    rows: [
      { icon: "happy-outline", label: "Saathi ka naam" },
      { icon: "notifications-outline", label: "Notifications" },
      { icon: "language-outline", label: "Bhasha (Hindi / English)" },
    ],
  },
  {
    title: "Privacy",
    rows: [
      { icon: "lock-closed-outline", label: "Privacy & data" },
      { icon: "download-outline", label: "Mera data export karo" },
      { icon: "trash-outline", label: "Sab data delete", tint: "#B23B3B" },
    ],
  },
  {
    title: "Aur",
    rows: [
      { icon: "help-circle-outline", label: "Help & support" },
      { icon: "information-circle-outline", label: "About Saathi" },
    ],
  },
];

export default function Settings() {
  const { session } = useAuth();
  const toast = useToast();
  const meta = session?.user?.user_metadata;
  const name = meta?.full_name || meta?.name || "Aapka account";

  async function logout() {
    try {
      await signOut();
    } catch {
      toast.show("Logout nahi hua", "error");
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
            <Ionicons name="heart" size={26} color={colors.white} />
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

        {groups.map((g) => (
          <View key={g.title} style={{ marginTop: 22 }}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            <View style={styles.card}>
              {g.rows.map((r, i) => (
                <Pressable
                  key={r.label}
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

        <Text style={styles.version}>Saathi · v0.1.0 · Made in India ❤️</Text>
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

