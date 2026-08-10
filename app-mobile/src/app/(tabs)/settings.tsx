import { useCallback, useEffect, useState } from "react";
import { View, Text, ScrollView, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import * as Application from "expo-application";

import { makeStyles, useColors } from "@/theme/theme";
import { UserAvatar } from "@/components/user-avatar";
import { ConfirmModal } from "@/components/confirm-modal";
import { BottomSheet } from "@/components/bottom-sheet";
import { ReferralCodeModal } from "@/components/referral-code-modal";
import { useAuth } from "@/components/auth-provider";
import { signOut } from "@/lib/auth";
import { useToast } from "@/components/toast";
import { usePlan } from "@/lib/use-plan";
import { useOffers } from "@/lib/use-offers";
import { useT, useLocale } from "@/lib/i18n/LanguageProvider";
import { LOCALES, LOCALE_META, tpl } from "@/lib/i18n/dictionaries";
import { useUserDetails, isDetailsComplete } from "@/lib/user-details";
import { PermissionModal } from "@/components/permission-modal";
import { getLockState } from "@/lib/app-lock";
import { ALERT_MODES, alertUser, useAlertMode, type AlertMode } from "@/lib/alert-mode";
import { THEME_MODES, useThemeMode, type ThemeMode } from "@/theme/theme";
import { clearDocCache } from "@/lib/doc-cache";
import { deletionAsked, requestAccountDeletion } from "@/lib/account";

/**
 * "You" tab — account, plan aur settings.
 *
 * ⚠️ Pehle yahan har cheez apna alag card thi: membership ka apna, referral ka
 * apna, referral-code ka apna — teen alag-alag box, teenon ke beech 22px ki
 * khaali jagah. Screen bikhri hui lagti thi (item 13).
 *
 * Ab teen saaf hisse hain: upar aap (photo + naam), phir plan, phir settings —
 * har hissa apne heading ke neeche EK card me. Aankh ko teen cheezein dikhti
 * hain, dus nahi.
 */

type RowId =
  | "profile"
  | "membership"
  | "refer"
  | "refer_code"
  | "saathi_name"
  | "reminders_reliable"
  | "app_lock"
  | "alert_mode"
  | "theme"
  | "language"
  | "privacy"
  | "contact"
  | "support"
  | "help"
  | "about"
  | "delete_all";

type Row = {
  id: RowId;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  /** Row ke daayin taraf chhota sa haal (jaise chuni hui bhasha). */
  value?: string;
  /** Delete jaisi row — laal rang me, taaki galti se na dabe. */
  danger?: boolean;
};

export default function Settings() {
  const tc = useColors();
  const styles = useStyles();
  const { session } = useAuth();
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
  /**
   * Plan saanjhe store se — is screen ki apni copy se nahi.
   *
   * ⚠️ Pehle yahan apna `useState` + apni `getPlan()` call thi, aur wo sirf
   * `rewardsVersion` par dobara chalti thi (yaani app khulne par). Beech session
   * me Plus milne par — referral qualify hote hi, ya Play se kharidte hi — ye
   * row "Saathi Plus lo" hi dikhati rehti thi. Ab saare screens ek hi jawab par
   * chalte hain.
   */
  const { isPlus } = usePlan();
  const [langOpen, setLangOpen] = useState(false);
  const [refModal, setRefModal] = useState(false);
  const [permModal, setPermModal] = useState(false);
  const [logoutAsk, setLogoutAsk] = useState(false);
  const [deleteAsk, setDeleteAsk] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  /**
   * App lock chalu hai ya nahi — sirf row ke daayin dikhane ke liye.
   *
   * `useFocusEffect` se padhte hain kyunki user lock wali screen se badal ke
   * wapas aata hai; ek baar mount par padhne se yahan hamesha purana haal
   * dikhta rehta.
   */
  const [lockOn, setLockOn] = useState(false);
  useFocusEffect(
    useCallback(() => {
      void getLockState().then((st) => setLockOn(st.enabled));
    }, []),
  );
  // Ring / vibrate / silent — device par local, server par kuch nahi jaata.
  const [alertMode, setAlertModePref] = useAlertMode();
  // Light / dark / system — ye bhi is PHONE ki setting hai, account ki nahi.
  const { mode: themeMode, setMode: setThemeMode } = useThemeMode();

  /**
   * Account delete ki request pehle se ja chuki hai?
   *
   * Sirf row ke daayin ek chhota nishaan dikhane ke liye. Iske bina user ko
   * pata hi nahi chalta ki uski baat pahunchi ya nahi, aur wo har din wahi
   * button dabata rehta hai.
   */
  const [askedBefore, setAskedBefore] = useState(false);
  const [deleting, setDeleting] = useState(false);
  useFocusEffect(
    useCallback(() => {
      void deletionAsked(session?.user?.id).then(setAskedBefore);
    }, [session?.user?.id]),
  );

  const THEME_COPY: Record<
    ThemeMode,
    { label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }
  > = {
    light: { label: s.themeLight, sub: s.themeLightSub, icon: "sunny" },
    dark: { label: s.themeDark, sub: s.themeDarkSub, icon: "moon" },
    system: { label: s.themeSystem, sub: s.themeSystemSub, icon: "phone-portrait" },
  };

  const ALERT_COPY: Record<AlertMode, { label: string; sub: string; icon: keyof typeof Ionicons.glyphMap }> = {
    ring: { label: s.alertRing, sub: s.alertRingSub, icon: "volume-high" },
    vibrate: { label: s.alertVibrate, sub: s.alertVibrateSub, icon: "phone-portrait" },
    silent: { label: s.alertSilent, sub: s.alertSilentSub, icon: "notifications-off" },
  };

  const groups: { title: string; rows: Row[] }[] = [
    {
      title: s.groupAccount,
      rows: [
        { id: "membership", icon: "ribbon-outline", label: s.membership },
        ...(offers.referralsEnabled
          ? ([
              {
                id: "refer",
                icon: "gift-outline",
                label: tpl(s.referRow, { d: offers.referralDays }),
              },
              { id: "refer_code", icon: "pricetag-outline", label: s.referralCodeRow },
            ] as Row[])
          : []),
      ],
    },
    {
      title: s.groupSaathi,
      rows: [
        { id: "saathi_name", icon: "happy-outline", label: s.saathiName },
        // ⚠️ Pehle yahan DO rows thi — "Notifications" aur "Reminders reliable
        //    banao" — aur dono bilkul wahi ek modal kholti thi. User ko lagta
        //    tha do alag settings hain (item 14). Ab ek hi row hai.
        { id: "reminders_reliable", icon: "notifications-outline", label: rel.settingsRow },
        // App lock "Saathi" wale group me hai, "Account" me nahi — ye is PHONE
        // ki setting hai, account ki nahi. PIN kabhi server par nahi jaata, aur
        // logout karte hi lock hat jaata hai.
        {
          id: "app_lock",
          icon: "finger-print-outline",
          label: t.lock.title,
          value: lockOn ? t.lock.savedOn.replace(" ✓", "") : undefined,
        },
        {
          id: "theme",
          icon: "contrast-outline",
          label: s.theme,
          value: THEME_COPY[themeMode].label,
        },
        {
          id: "alert_mode",
          icon: "volume-medium-outline",
          label: s.alertMode,
          value: ALERT_COPY[alertMode].label,
        },
        {
          id: "language",
          icon: "language-outline",
          label: s.language,
          value: LOCALE_META[locale].native,
        },
      ],
    },
    {
      title: s.groupMore,
      rows: [
        { id: "contact", icon: "mail-outline", label: t.contact.row },
        // Support "Contact" ke theek neeche: dono ek hi zarurat ke do roop hain
        // — ek taraf ka message, aur wo baat jiska jawab wapas aata hai.
        { id: "support", icon: "help-buoy-outline", label: t.support.title },
        { id: "help", icon: "help-circle-outline", label: s.help },
        { id: "privacy", icon: "lock-closed-outline", label: s.privacy },
        { id: "about", icon: "information-circle-outline", label: s.about },
        // Account delete karwane ka raasta — Play Store ki data-deletion
        // requirement bhi yahi maangti hai. Yahan se sirf REQUEST jaati hai;
        // asli delete admin panel se hota hai (wajah `lib/account.ts` me).
        {
          id: "delete_all",
          icon: "trash-outline",
          label: s.deleteAll,
          value: askedBefore ? s.deleteAsked : undefined,
          danger: true,
        },
      ],
    },
  ];


  async function logout() {
    setLogoutAsk(false);
    try {
      // ⚠️ Offline cache logout se PEHLE hataana zaroori hai — warna is phone
      // par pichhle user ke documents (list aur files dono) pade rehte, aur
      // agla user unhe offline dekh sakta tha.
      await clearDocCache(session?.user?.id);
      await signOut();
      // Logout ke baad language select screen — waha se login pe jaayega.
      router.replace("/language" as never);
    } catch {
      toast.show(s.logout + " ✕", "error");
    }
  }

  /**
   * Account delete ki REQUEST bhejo — yahan se kuch delete nahi hota.
   *
   * ⚠️ Pehle ye function seedha `documents` aur `reminders` delete kar deta tha.
   * Poori wajah `lib/account.ts` ke upar likhi hai; chhota roop:
   *
   *   • ek galti se laga tap par saara data hamesha ke liye chala jaata tha,
   *   • wo delete adhoora tha (notes, chat, tickets, aur storage ki asli files
   *     wahin padi rehti thi) — yaani "delete ho gaya" ek jhooth tha,
   *   • aur "kab maanga, kab poora hua" ka koi record nahi bachta tha.
   *
   * Ab request admin panel me jaati hai, jahan se do me se ek kaam hota hai —
   * hide (soft, wapas laaya ja sakta hai) ya purge (files + har table + login).
   */
  async function askDeleteAccount() {
    setDeleteAsk(false);
    setDeleting(true);
    try {
      const res = await requestAccountDeletion({ locale });
      if (res === "sent") {
        setAskedBefore(true);
        toast.show(s.deleted, "success");
      } else if (res === "pending") {
        setAskedBefore(true);
        toast.show(s.deletePending, "info");
      } else {
        toast.show(s.deleteFailed, "error");
      }
    } finally {
      setDeleting(false);
    }
  }

  function handleRow(id: RowId) {
    switch (id) {
      case "profile":
      case "saathi_name":
        // Naam + details ek hi jagah.
        router.push("/profile-details" as never);
        return;
      case "app_lock":
        router.push("/app-lock" as never);
        return;
      case "membership":
        router.push("/membership" as never);
        return;
      case "refer":
        router.push("/referral" as never);
        return;
      case "refer_code":
        setRefModal(true);
        return;
      case "reminders_reliable":
        // Notification, exact alarm, full-screen alert, battery aur OEM
        // auto-start — sab ek hi jagah, status ke saath.
        setPermModal(true);
        return;
      case "theme":
        setThemeOpen(true);
        return;
      case "alert_mode":
        setAlertOpen(true);
        return;
      case "language":
        setLangOpen(true);
        return;
      case "privacy":
        router.push("/privacy" as never);
        return;
      case "contact":
        router.push("/contact" as never);
        return;
      case "support":
        router.push("/support" as never);
        return;
      case "help":
        router.push("/help" as never);
        return;
      case "about":
        router.push("/about" as never);
        return;
      case "delete_all":
        // Request ja chuki ho ya abhi ja rahi ho to dobara poochhna bekaar hai.
        if (!deleting) setDeleteAsk(true);
        return;
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Aap — photo, naam, email. Poora card tappable hai.
            Photo pehle 72px thi aur cut dikhti thi (item 5); ab 104px hai,
            ek naram ring ke saath, aur poori bharti hai. */}
        <Pressable
          onPress={() => handleRow("profile")}
          style={({ pressed }) => [styles.profile, pressed && { opacity: 0.92 }]}
        >
          <View style={styles.avatarRing}>
            <UserAvatar
              uri={avatarUrl}
              name={name}
              seed={session?.user?.id}
              size={104}
              radius={36}
            />
            <View style={styles.avatarEdit}>
              <Ionicons name="camera" size={14} color={tc.white} />
            </View>
          </View>
          <Text style={styles.pName} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.pSub} numberOfLines={1}>
            {session?.user?.email ?? ""}
          </Text>
          <View style={styles.editChip}>
            <Ionicons name="create-outline" size={13} color={tc.terracotta} />
            <Text style={styles.editChipText}>{s.editProfile}</Text>
          </View>
        </Pressable>

        {/* Profile adhoora ho to ek nudge — sabse upar, taaki dikhe. */}
        {!profileComplete && (
          <Pressable
            onPress={() => handleRow("profile")}
            style={({ pressed }) => [styles.nudge, pressed && { opacity: 0.92 }]}
          >
            <Ionicons name="alert-circle" size={20} color={tc.terracotta} />
            <View style={{ flex: 1 }}>
              <Text style={styles.nudgeTitle}>{s.completeTitle}</Text>
              <Text style={styles.nudgeSub}>{s.completeSub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={tc.terracotta} />
          </Pressable>
        )}

        {/* Plan */}
        <Pressable
          onPress={() => router.push("/upgrade" as never)}
          style={({ pressed }) => [styles.planCard, pressed && { opacity: 0.92 }]}
        >
          <View style={styles.planIcon}>
            <Ionicons name={isPlus ? "star" : "sparkles"} size={22} color={tc.white} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.planTitle}>{isPlus ? s.plusActive : s.plusLo}</Text>
            <Text style={styles.planSub}>{isPlus ? s.plusActiveSub : s.plusSub}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={tc.onInkSoft} />
        </Pressable>

        {groups.map((g) => (
          <View key={g.title} style={styles.group}>
            <Text style={styles.groupTitle}>{g.title}</Text>
            <View style={styles.card}>
              {g.rows.map((r, i) => (
                <Pressable
                  key={r.id}
                  onPress={() => handleRow(r.id)}
                  style={({ pressed }) => [
                    styles.row,
                    i < g.rows.length - 1 && styles.rowBorder,
                    pressed && { backgroundColor: tc.creamDeep },
                  ]}
                >
                  <View style={[styles.rowIcon, r.danger && styles.rowIconDanger]}>
                    <Ionicons
                      name={r.icon}
                      size={18}
                      color={r.danger ? tc.danger : tc.terracotta}
                    />
                  </View>
                  <Text
                    style={[styles.rowLabel, r.danger && { color: tc.danger }]}
                    numberOfLines={1}
                  >
                    {r.label}
                  </Text>
                  {!!r.value && <Text style={styles.rowValue}>{r.value}</Text>}
                  <Ionicons name="chevron-forward" size={17} color={tc.line} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}

        <Pressable
          onPress={() => setLogoutAsk(true)}
          style={({ pressed }) => [styles.logout, pressed && { opacity: 0.85 }]}
        >
          <Ionicons name="log-out-outline" size={20} color={tc.danger} />
          <Text style={styles.logoutText}>{s.logout}</Text>
        </Pressable>

        {/* Version app.json se — hardcode karne par har release me purana ho
            jaata tha (settings me "v0.1.0" dikhta raha jabki app 1.0.0 thi). */}
        <Text style={styles.version}>
          {tpl(s.version, { v: Application.nativeApplicationVersion ?? "1.0.0" })} ❤️
        </Text>
      </ScrollView>

      <ReferralCodeModal visible={refModal} onClose={() => setRefModal(false)} />

      {/* Reminder reliability — notification, exact alarm, full-screen alert,
          battery, auto-start. Ek hi jagah (item 14). */}
      <PermissionModal visible={permModal} onClose={() => setPermModal(false)} />

      <ConfirmModal
        visible={logoutAsk}
        title={s.logout}
        confirmLabel={s.logout}
        cancelLabel={t.common.cancel}
        icon="log-out"
        destructive
        onConfirm={logout}
        onCancel={() => setLogoutAsk(false)}
      />

      {/* Account delete ki request — wapas nahi aata, isliye poochh ke hi. */}
      <ConfirmModal
        visible={deleteAsk}
        title={s.deleteTitle}
        message={s.deleteBody}
        confirmLabel={s.deleteYes}
        cancelLabel={t.common.cancel}
        icon="trash"
        destructive
        onConfirm={askDeleteAccount}
        onCancel={() => setDeleteAsk(false)}
      />

      {/* Alert kaise sunayi de — ring / vibrate / silent (item 6).
          "Sun ke dekho" jaan-boojh ke hai: awaaz ek aisi cheez hai jise padh ke
          nahi, sun ke hi chuna ja sakta hai. */}
      <BottomSheet
        visible={alertOpen}
        title={s.alertMode}
        subtitle={s.alertModeSub}
        onClose={() => setAlertOpen(false)}
      >
        <>
          {ALERT_MODES.map((m) => {
              const active = alertMode === m;
              const copy = ALERT_COPY[m];
              return (
                <Pressable
                  key={m}
                  onPress={() => {
                    setAlertModePref(m);
                    // Turant sunao — chunte hi pata chal jaaye ki kya hoga.
                    void alertUser();
                  }}
                  style={[styles.alertOpt, active && styles.alertOptActive]}
                >
                  <View style={[styles.alertIcon, active && styles.alertIconActive]}>
                    <Ionicons
                      name={copy.icon}
                      size={19}
                      color={active ? tc.white : tc.terracotta}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.alertLabel, active && { color: tc.terracotta }]}>
                      {copy.label}
                    </Text>
                    <Text style={styles.alertSub}>{copy.sub}</Text>
                  </View>
                  {active && (
                    <Ionicons name="checkmark-circle" size={22} color={tc.terracotta} />
                  )}
                </Pressable>
              );
            })}

          <Pressable
            onPress={() => void alertUser()}
            style={({ pressed }) => [styles.alertTest, pressed && { opacity: 0.85 }]}
          >
            <Ionicons name="play" size={16} color={tc.terracotta} />
            <Text style={styles.alertTestText}>{s.alertTest}</Text>
          </Pressable>
        </>
      </BottomSheet>

      {/* Theme picker — light / dark / phone ke hisaab se */}
      <BottomSheet
        visible={themeOpen}
        title={s.theme}
        subtitle={s.themeSub}
        onClose={() => setThemeOpen(false)}
      >
        <>
          {THEME_MODES.map((m) => {
              const active = themeMode === m;
              const copy = THEME_COPY[m];
              return (
                <Pressable
                  key={m}
                  onPress={() => setThemeMode(m)}
                  style={[styles.alertOpt, active && styles.alertOptActive]}
                >
                  <View style={[styles.alertIcon, active && styles.alertIconActive]}>
                    <Ionicons
                      name={copy.icon}
                      size={19}
                      color={active ? tc.white : tc.terracotta}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.alertLabel, active && { color: tc.terracotta }]}>
                      {copy.label}
                    </Text>
                    <Text style={styles.alertSub}>{copy.sub}</Text>
                  </View>
                {active && (
                  <Ionicons name="checkmark-circle" size={22} color={tc.terracotta} />
                )}
              </Pressable>
            );
          })}
        </>
      </BottomSheet>

      {/* Bhasha picker */}
      <BottomSheet
        visible={langOpen}
        title={s.language}
        subtitle={s.langAlertBody}
        onClose={() => setLangOpen(false)}
      >
        <>
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
                <Text style={[styles.langNative, active && { color: tc.terracotta }]}>
                  {LOCALE_META[l].native}
                </Text>
                <Text style={styles.langSub}>{LOCALE_META[l].sub}</Text>
                {active && (
                  <Ionicons
                    name="checkmark-circle"
                    size={22}
                    color={tc.terracotta}
                    style={{ marginLeft: "auto" }}
                  />
                )}
              </Pressable>
            );
          })}
        </>
      </BottomSheet>
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  content: { padding: 20, paddingBottom: 40, ...CONTENT },

  profile: { alignItems: "center", paddingTop: 8, paddingBottom: 4 },
  avatarRing: {
    height: 112,
    width: 112,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.line,
  },
  avatarEdit: {
    position: "absolute",
    right: 2,
    bottom: 2,
    height: 30,
    width: 30,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.terracotta,
    borderWidth: 2,
    borderColor: c.cream,
  },
  pName: { marginTop: 14, fontSize: 22, fontWeight: "800", color: c.ink },
  pSub: { marginTop: 3, fontSize: 14, color: c.inkSoft },
  editChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 12,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.3)",
    backgroundColor: "rgba(194,90,55,0.07)",
    paddingHorizontal: 13,
    paddingVertical: 6,
  },
  editChipText: { fontSize: 12.5, fontWeight: "700", color: c.terracotta },

  nudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.3)",
    backgroundColor: "rgba(194,90,55,0.07)",
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  nudgeTitle: { fontSize: 14.5, fontWeight: "800", color: c.ink },
  nudgeSub: { marginTop: 2, fontSize: 12.5, color: c.inkSoft },

  planCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginTop: 20,
    borderRadius: 22,
    padding: 16,
    // ⚠️ `c.ink` NAHI — dark theme me wo ulta ho ke card ko cream bana deta tha
    // aur uspar ka safed/cream text bilkul gayab ho jaata tha.
    backgroundColor: c.inkCard,
  },
  planIcon: {
    height: 46,
    width: 46,
    borderRadius: 16,
    backgroundColor: c.terracotta,
    alignItems: "center",
    justifyContent: "center",
  },
  planTitle: { fontSize: 15.5, fontWeight: "800", color: c.white },
  planSub: { marginTop: 2, fontSize: 12.5, color: c.onInkSoft },

  group: { marginTop: 26 },
  groupTitle: {
    fontSize: 12.5,
    fontWeight: "800",
    color: c.inkSoft,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 10,
    marginLeft: 4,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: c.line },
  rowIcon: {
    height: 36,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: "rgba(194,90,55,0.09)",
  },
  rowIconDanger: { backgroundColor: "rgba(178,59,59,0.10)" },
  rowLabel: { flex: 1, fontSize: 15, fontWeight: "600", color: c.ink },
  rowValue: { fontSize: 13.5, color: c.inkSoft, fontWeight: "600" },

  logout: {
    marginTop: 28,
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
  logoutText: { color: c.danger, fontWeight: "700", fontSize: 15 },
  version: {
    marginTop: 18,
    textAlign: "center",
    fontSize: 13,
    color: c.inkSoft,
  },

  // Sheet ka apna chrome (backdrop/handle/title) ab `components/bottom-sheet`
  // me hai — teenon sheet wahi use karte hain, isliye safe-area, maxHeight aur
  // theme-aware parda ek hi jagah theek hote hain.
  langOpt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginTop: 10,
  },
  langOptActive: { borderColor: c.terracotta, backgroundColor: "rgba(194,90,55,0.06)" },

  alertOpt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 14,
    paddingVertical: 13,
    marginTop: 10,
  },
  alertOptActive: { borderColor: c.terracotta, backgroundColor: "rgba(194,90,55,0.06)" },
  alertIcon: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(194,90,55,0.10)",
  },
  alertIconActive: { backgroundColor: c.terracotta },
  alertLabel: { fontSize: 15.5, fontWeight: "700", color: c.ink },
  alertSub: { marginTop: 2, fontSize: 12.5, lineHeight: 17, color: c.inkSoft },
  alertTest: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 16,
    height: 46,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.3)",
    backgroundColor: "rgba(194,90,55,0.06)",
  },
  alertTestText: { fontSize: 14.5, fontWeight: "700", color: c.terracotta },
  langNative: { fontSize: 16.5, fontWeight: "700", color: c.ink },
  langSub: { fontSize: 13, color: c.inkSoft, marginLeft: 10 },
}));
