import { useEffect, useState } from "react";
import {
  View,
  Text,
  ScrollView,
  Pressable,
  StyleSheet,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import * as WebBrowser from "expo-web-browser";

import { colors } from "@/theme/colors";
import { UserAvatar } from "@/components/user-avatar";
import { ReferralCodeModal } from "@/components/referral-code-modal";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { useAuth } from "@/components/auth-provider";
import { signOut } from "@/lib/auth";
import { useToast } from "@/components/toast";
import { getPlan, WEB_URL } from "@/lib/plan";
import { useOffers } from "@/lib/use-offers";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { LOCALES, LOCALE_META, tpl } from "@/lib/i18n/dictionaries";
import { useUserDetails, isDetailsComplete } from "@/lib/user-details";
import { PermissionModal } from "@/components/permission-modal";

type RowId =
  | "saathi_name"
  | "notifications"
  | "reminders_reliable"
  | "language"
  | "privacy"
  | "delete_all"
  | "help"
  | "about";

type Row = { id: RowId; icon: string; label: string; tint?: string };

export default function Settings() {
  const { session, rewardsVersion } = useAuth();
  const toast = useToast();
  const offers = useOffers();
  const t = useT();
  const { locale, setLocale } = useLocale();
  const s = t.settings;
  const rel = t.reliability;
  // Live details — profile save karte hi naam/photo yahan apne aap badal jaate hain.
  const { details, loading: detailsLoading } = useUserDetails();
  const meta = session?.user?.user_metadata;
  const name = details?.full_name || meta?.full_name || meta?.name || s.account;
  const avatarUrl = details?.avatar_url ?? null;
  const profileComplete = detailsLoading || isDetailsComplete(details);
  const [isPlus, setIsPlus] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [refModal, setRefModal] = useState(false);
  const [permModal, setPermModal] = useState(false);

  const groups: { title: string; rows: Row[] }[] = [
    {
      title: s.groupSaathi,
      rows: [
        { id: "saathi_name", icon: "happy-outline", label: s.saathiName },
        { id: "notifications", icon: "notifications-outline", label: s.notifications },
        // Sirf Android — battery optimization se reminders reliable banane ke liye.
        ...(Platform.OS === "android"
          ? [
              {
                id: "reminders_reliable" as RowId,
                icon: "battery-charging-outline",
                label: rel.settingsRow,
              },
            ]
          : []),
        {
          id: "language",
          icon: "language-outline",
          label: `${s.language} · ${LOCALE_META[locale].native}`,
        },
      ],
    },
    {
      title: s.groupPrivacy,
      rows: [
        { id: "privacy", icon: "lock-closed-outline", label: s.privacy },
        // Delete-all-data abhi band — baad me chahiye to yeh row wapas enable karo.
        // { id: "delete_all", icon: "trash-outline", label: s.deleteAll, tint: "#B23B3B" },
      ],
    },
    {
      title: s.groupMore,
      rows: [
        { id: "help", icon: "help-circle-outline", label: s.help },
        { id: "about", icon: "information-circle-outline", label: s.about },
      ],
    },
  ];

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
      // Logout ke baad language select screen — waha se login pe jaayega.
      router.replace("/language" as never);
    } catch {
      toast.show(s.logout + " ✕", "error");
    }
  }

  async function openUrl(path: string) {
    try {
      await WebBrowser.openBrowserAsync(`${WEB_URL}${path}`);
    } catch {
      toast.show(s.linkFailed, "error");
    }
  }

  /** Sirf apna data (documents + reminders) delete — account nahi. */
  async function deleteAllData() {
    Alert.alert(s.deleteTitle, s.deleteBody, [
      { text: t.common.no, style: "cancel" },
      {
        text: s.deleteYes,
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
            toast.show(s.deleted, "success");
          } catch {
            toast.show(s.deleteAll + " ✕", "error");
          }
        },
      },
    ]);
  }

  function handleRow(id: RowId) {
    switch (id) {
      case "saathi_name":
        // Naam + details ek hi jagah.
        router.push("/profile-details" as never);
        return;
      case "notifications":
      case "reminders_reliable":
        // Dono rows ab wahi setup modal kholti hain — notification, exact alarm,
        // battery aur OEM auto-start ek hi jagah, status ke saath.
        setPermModal(true);
        return;
      case "language":
        setLangOpen(true);
        return;
      case "privacy":
        router.push("/privacy" as never);
        return;
      case "delete_all":
        deleteAllData();
        return;
      case "help":
        router.push("/help" as never);
        return;
      case "about":
        router.push("/about" as never);
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
            <UserAvatar
              uri={avatarUrl}
              name={name}
              seed={session?.user?.id}
              size={72}
              radius={26}
            />
          </View>
          <Text style={styles.pName}>{name}</Text>
          <Text style={styles.pSub}>{session?.user?.email ?? ""}</Text>
        </View>

        {/* Plan / Saathi Plus — sabse upar */}
        <Pressable
          onPress={() => router.push("/upgrade" as never)}
          style={({ pressed }) => [styles.planCard, pressed && { opacity: 0.92 }]}
        >
          <View style={styles.planIcon}>
            <Ionicons name={isPlus ? "star" : "sparkles"} size={22} color={colors.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.planTitle}>{isPlus ? s.plusActive : s.plusLo}</Text>
            <Text style={styles.planSub}>{isPlus ? s.plusActiveSub : s.plusSub}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color="rgba(247,242,233,0.7)" />
        </Pressable>

        {/* Profile complete karo — nudge (adhoora ho to) */}
        {!profileComplete && (
          <Pressable
            onPress={() => router.push("/profile-details" as never)}
            style={({ pressed }) => [styles.nudge, pressed && { opacity: 0.92 }]}
          >
            <Ionicons name="alert-circle" size={20} color={colors.terracotta} />
            <View style={{ flex: 1 }}>
              <Text style={styles.nudgeTitle}>{s.completeTitle}</Text>
              <Text style={styles.nudgeSub}>{s.completeSub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.terracotta} />
          </Pressable>
        )}

        {/* Meri membership */}
        <Pressable
          onPress={() => router.push("/membership" as never)}
          style={({ pressed }) => [styles.detailsRow, pressed && { opacity: 0.9 }]}
        >
          <Ionicons name="ribbon-outline" size={20} color={colors.terracotta} />
          <Text style={styles.detailsText}>{s.membership}</Text>
          <Ionicons name="chevron-forward" size={18} color={colors.line} />
        </Pressable>

        {/* Refer & Earn — referral (band ho to row hi nahi) */}
        {offers.referralsEnabled && (
          <Pressable
            onPress={() => router.push("/referral" as never)}
            style={({ pressed }) => [styles.detailsRow, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="gift-outline" size={20} color={colors.terracotta} />
            <Text style={styles.detailsText}>
              {tpl(s.referRow, { d: offers.referralDays })}
            </Text>
            <Ionicons name="chevron-forward" size={18} color={colors.line} />
          </Pressable>
        )}

        {/* Kisi ka referral code baad me daalne ke liye */}
        {offers.referralsEnabled && (
          <Pressable
            onPress={() => setRefModal(true)}
            style={({ pressed }) => [styles.detailsRow, pressed && { opacity: 0.9 }]}
          >
            <Ionicons name="pricetag-outline" size={20} color={colors.terracotta} />
            <Text style={styles.detailsText}>{s.referralCodeRow}</Text>
            <Ionicons name="chevron-forward" size={18} color={colors.line} />
          </Pressable>
        )}

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
          <Text style={styles.logoutText}>{s.logout}</Text>
        </Pressable>

        <Text style={styles.version}>{s.version} ❤️</Text>
      </ScrollView>

      <ReferralCodeModal visible={refModal} onClose={() => setRefModal(false)} />

      {/* Reminder reliability — notification, exact alarm, battery, auto-start */}
      <PermissionModal visible={permModal} onClose={() => setPermModal(false)} />

      {/* Bhasha picker */}
      <Modal
        visible={langOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setLangOpen(false)}
      >
        <Pressable style={styles.sheetBackdrop} onPress={() => setLangOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{s.language}</Text>
            <Text style={styles.sheetSub}>{s.langAlertBody}</Text>
            {LOCALES.map((l) => {
              const active = locale === l;
              return (
                <Pressable
                  key={l}
                  onPress={() => {
                    setLocale(l);
                    setLangOpen(false);
                  }}
                  style={[styles.langOpt, active && styles.langOptActive]}
                >
                  <Text style={[styles.langNative, active && { color: colors.terracotta }]}>
                    {LOCALE_META[l].native}
                  </Text>
                  <Text style={styles.langSub}>{LOCALE_META[l].sub}</Text>
                  {active && (
                    <Ionicons
                      name="checkmark-circle"
                      size={22}
                      color={colors.terracotta}
                      style={{ marginLeft: "auto" }}
                    />
                  )}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>
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
    overflow: "hidden",
  },
  pAvatarImg: { height: 72, width: 72, borderRadius: 26 },
  nudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.3)",
    backgroundColor: "rgba(194,90,55,0.07)",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  nudgeTitle: { fontSize: 14.5, fontWeight: "800", color: colors.ink },
  nudgeSub: { marginTop: 2, fontSize: 12.5, color: colors.inkSoft },
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
  sheetBackdrop: {
    flex: 1,
    backgroundColor: "rgba(46,40,35,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 34,
  },
  sheetHandle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    marginBottom: 16,
  },
  sheetTitle: { fontSize: 20, fontWeight: "800", color: colors.ink },
  sheetSub: { marginTop: 4, fontSize: 13.5, color: colors.inkSoft, marginBottom: 14 },
  langOpt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 10,
  },
  langOptActive: { borderColor: colors.terracotta, backgroundColor: "rgba(194,90,55,0.06)" },
  langNative: { fontSize: 16.5, fontWeight: "700", color: colors.ink },
  langSub: { fontSize: 13, color: colors.inkSoft, marginLeft: 10 },
});

