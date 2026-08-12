import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  Animated,
  Easing,
  AppState,
  useWindowDimensions,
  type AppStateStatus,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { makeStyles, useColors } from "@/theme/theme";
import { useT } from "@/lib/i18n/LanguageProvider";
import { syncNotifications } from "@/lib/notifications";
import {
  checkReadiness,
  confirmStep,
  requestStep,
  markReliabilityPromptShown,
  type Readiness,
  type StepKey,
} from "@/lib/reliability";

/**
 * "Reminder time pe aaye" wala setup modal.
 *
 * Har zaroori permission ek row hai — apna status khud dikhati hai (green tick
 * ya "Allow" button). Allow dabate hi OS ka asli popup/screen khulta hai; user
 * wapas aata hai to modal AppState se dobara check karke row ko green kar deta
 * hai. Yaani user ko dikhta hai ki kaam hua ya nahi — pehle sirf settings khul
 * jaati thi aur pata hi nahi chalta tha.
 */

const ICONS: Record<StepKey, keyof typeof Ionicons.glyphMap> = {
  notif: "notifications-outline",
  alarm: "alarm-outline",
  fsi: "phone-portrait-outline",
  battery: "battery-charging-outline",
  oem: "shield-checkmark-outline",
};

export function PermissionModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const tc = useColors();
  const styles = useStyles();
  const { reliability: r, common } = useT();
  const [state, setState] = useState<Readiness | null>(null);
  const [busy, setBusy] = useState<StepKey | null>(null);
  const scale = useRef(new Animated.Value(0.94)).current;

  /**
   * ⚠️ Card ki koi height limit nahi thi aur list ki `maxHeight: 380` fix thi.
   * Chhoti screen par poora card screen se bahar nikal jaata tha: upar ka icon
   * status bar ke peeche chala jaata, aur "Baad me" button aakhri card ke upar
   * chadh jaata tha. Sabse buri baat — battery aur auto-start wale steps neeche
   * chhup jaate the, isliye user "sab allow kar diya" samajh ke chala jaata aur
   * reminder phir bhi late aata.
   *
   * Ab card screen (minus safe area) se bada ho hi nahi sakta, aur beech wali
   * list jitni jagah bache utni me scroll karti hai.
   */
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxCardHeight = Math.max(320, height - insets.top - insets.bottom - 48);

  const refresh = useCallback(async () => {
    setState(await checkReadiness());
  }, []);

  useEffect(() => {
    if (!visible) return;
    void refresh();
    void markReliabilityPromptShown();
    scale.setValue(0.94);
    Animated.timing(scale, {
      toValue: 1,
      duration: 210,
      easing: Easing.out(Easing.back(1.3)),
      useNativeDriver: true,
    }).start();
  }, [visible, refresh, scale]);

  // User OS settings se wapas aaya — status dobara padho taaki tick lag jaye.
  useEffect(() => {
    if (!visible) return;
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s === "active") {
        setBusy(null);
        void refresh();
      }
    });
    return () => sub.remove();
  }, [visible, refresh]);

  async function allow(key: StepKey) {
    setBusy(key);
    await requestStep(key);
    // Notification permission in-app dialog hai — AppState change nahi aata.
    await refresh();
    setBusy(null);

    // ⚠️ Ye missing tha, aur isi wajah se sabse aam shikayat aati thi:
    // "sab allow kar diya, phir bhi notification nahi aayi."
    //
    // `syncNotifications()` permission na hone par shuru me hi lautaa deta hai.
    // Yaani permission se PEHLE bane reminders ka koi alarm laga hi nahi hota.
    // Permission milne par pehle kuch bhi dobara sync nahi karta tha — notif
    // ka dialog in-app hai, isliye AppState "active" bhi nahi aata. Reminder
    // chup-chaap bina alarm ke pada rehta tha.
    //
    // Exact-alarm ke baad bhi sync zaroori hai: pehle se lage inexact alarms
    // ab exact ban jaate hain.
    //
    // `force` zaroori hai: exact-alarm ke liye user Android settings me jaata
    // hai, aur wapas aate hi AppState wala sync chal chukta hai. Bina force ke
    // ye wala 60-second throttle me atak jaata — yaani permission mil to jaati
    // par alarm phir bhi na lagte, jo bilkul wahi purani shikayat hai.
    if (key === "notif" || key === "alarm") void syncNotifications({ force: true });
  }

  /** "Haan, on kar diya" — sirf un steps par jinka status OS nahi batata. */
  async function confirm(key: StepKey) {
    await confirmStep(key);
    await refresh();
  }

  const steps = (state?.steps ?? []).filter((s) => s.supported);
  const allOk = !!state?.allOk;

  const copy: Record<StepKey, { title: string; sub: string }> = {
    notif: { title: r.stepNotif, sub: r.stepNotifSub },
    alarm: { title: r.stepAlarm, sub: r.stepAlarmSub },
    fsi: { title: r.stepFsi, sub: r.stepFsiSub },
    battery: { title: r.stepBattery, sub: r.stepBatterySub },
    oem: {
      title: r.stepOem,
      sub: state?.oemName ? `${state.oemName} · ${r.stepOemSub}` : r.stepOemSub,
    },
  };

  return (
    <Modal statusBarTranslucent transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
        <Animated.View style={[styles.cardWrap, { transform: [{ scale }] }]}>
          <View style={[styles.card, { maxHeight: maxCardHeight }]}>
            <View style={styles.iconWrap}>
              <Ionicons
                name={allOk ? "checkmark-circle" : "alarm"}
                size={26}
                color={allOk ? tc.sage : tc.terracotta}
              />
            </View>

            <Text style={styles.title}>{allOk ? r.allSetTitle : r.promptTitle}</Text>
            <Text style={styles.body}>{allOk ? r.allSetBody : r.promptBody}</Text>

            {/* Full-screen alert Android 14+ par default se BAND hota hai —
                yahi sabse zyada log miss karte hain (item 11). Baaki sab green
                hone par bhi bada popup isi ke bina nahi aata, isliye ye pending
                ho to alag se upar bataate hain. */}
            {!allOk && steps.some((s) => s.key === "fsi" && !s.ok) && (
              <View style={styles.spotlight}>
                <Ionicons name="sparkles" size={16} color={tc.terracotta} />
                <Text style={styles.spotlightText}>{r.fsiSpotlight}</Text>
              </View>
            )}

            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {steps.map((s) => (
                <View
                  key={s.key}
                  style={[
                    styles.step,
                    s.ok && styles.stepDone,
                    !s.ok && s.key === "fsi" && styles.stepKey,
                  ]}
                >
                  <View style={[styles.stepIcon, s.ok && styles.stepIconDone]}>
                    <Ionicons
                      name={s.ok ? "checkmark" : ICONS[s.key]}
                      size={17}
                      // Ho chuka wala gola SAGE ka hai — dono theme me ujla,
                      // isliye uspar safed nishaan 2.4:1 par gir jaata tha.
                      color={s.ok ? tc.onAccent : tc.terracotta}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.stepTitle}>{copy[s.key].title}</Text>
                    <Text style={styles.stepSub}>{copy[s.key].sub}</Text>
                  </View>
                  {s.ok ? (
                    <Text style={styles.stepOk}>{r.stepDone}</Text>
                  ) : s.awaiting ? (
                    /*
                      User settings screen tak ja chuka hai, par uske toggle ka
                      status Android kisi API se batata hi nahi (full-screen
                      intent aur OEM auto-start, dono).

                      ⚠️ Pehle yahan kuch tha hi nahi — screen KHULTE HI step
                      green ho jaata tha. Jo user toggle dabana bhool gaya, uska
                      bada popup hamesha ke liye band reh jaata tha, aur modal
                      use "sab set hai" bhi keh deta tha. Yahi "sab allow kar
                      diya, phir bhi popup nahi aata" wali sabse aam shikayat ki
                      jad thi. Ab jawab user deta hai, app andaza nahi lagati.
                    */
                    <View style={styles.confirmRow}>
                      <Pressable
                        onPress={() => confirm(s.key)}
                        style={({ pressed }) => [styles.allowBtn, pressed && { opacity: 0.7 }]}
                      >
                        <Text style={styles.allowText}>{r.stepConfirmYes}</Text>
                      </Pressable>
                      <Pressable onPress={() => allow(s.key)} hitSlop={6}>
                        <Text style={styles.retryText}>{r.stepOpenAgain}</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => allow(s.key)}
                      disabled={busy === s.key}
                      style={({ pressed }) => [
                        styles.allowBtn,
                        (pressed || busy === s.key) && { opacity: 0.7 },
                      ]}
                    >
                      <Text style={styles.allowText}>{r.stepAllow}</Text>
                    </Pressable>
                  )}
                </View>
              ))}
            </ScrollView>

            <Pressable
              onPress={onClose}
              style={({ pressed }) => [
                styles.cta,
                allOk && styles.ctaDone,
                pressed && { opacity: 0.88 },
              ]}
            >
              {/* Sab ho gaya to button sage ka ho jaata hai (`ctaDone`) — uspar
                  safed text nahi chalta, wajah `ctaDone` ke paas likhi hai. */}
              <Text style={[styles.ctaText, allOk && styles.ctaTextDone]}>
                {allOk ? common.done : r.promptLater}
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: {
    flex: 1,
    backgroundColor: c.scrim,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  cardWrap: { width: "100%", maxWidth: 440 },
  card: {
    backgroundColor: c.surface,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: c.line,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  iconWrap: {
    height: 60,
    width: 60,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.12)",
  },
  title: {
    marginTop: 15,
    fontSize: 21,
    fontWeight: "800",
    color: c.ink,
    lineHeight: 28,
  },
  body: { marginTop: 8, fontSize: 14.5, lineHeight: 22, color: c.inkSoft },
  spotlight: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginTop: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.3)",
    backgroundColor: "rgba(194,90,55,0.07)",
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  spotlightText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: c.ink,
  },
  stepKey: { borderColor: c.terracotta, borderWidth: 1.5 },
  // flexShrink: card ki maxHeight lagne par sirf yahi hissa chhota hota hai —
  // heading upar aur button neeche hamesha dikhte rehte hain.
  list: { marginTop: 14, flexShrink: 1 },
  listContent: { paddingBottom: 2 },
  step: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.cream,
    padding: 12,
    marginBottom: 9,
  },
  stepDone: { backgroundColor: "rgba(124,138,107,0.09)", borderColor: "rgba(124,138,107,0.35)" },
  stepIcon: {
    height: 34,
    width: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.12)",
  },
  stepIconDone: { backgroundColor: c.sage },
  stepTitle: { fontSize: 14.5, fontWeight: "700", color: c.ink },
  stepSub: { marginTop: 2, fontSize: 12.5, lineHeight: 17, color: c.inkSoft },
  stepOk: { fontSize: 12.5, fontWeight: "700", color: c.sage },
  allowBtn: {
    borderRadius: 999,
    backgroundColor: c.terracotta,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  allowText: { fontSize: 12.5, fontWeight: "800", color: c.white },
  // "Ho gaya?" ke saath "phir se kholo" — dono chhote, ek ke neeche doosra,
  // taaki row ki chaudai teen bhashaon me na toote.
  confirmRow: { alignItems: "flex-end", gap: 5 },
  retryText: { fontSize: 11.5, fontWeight: "600", color: c.inkSoft, textDecorationLine: "underline" },
  cta: {
    marginTop: 12,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    // ⚠️ `c.ink` NAHI — dark theme me button cream ka ho jaata tha aur uspar
    // ka SAFED text (`ctaText`) bilkul gayab.
    backgroundColor: c.inkCard,
  },
  // ⚠️ Sage dono theme me UJLA hai (dark me to aur bhi). Uspar `ctaText` ka
  // safed 3.4:1 / 2.4:1 par tha — aur yahi wo button hai jo user ko batata hai
  // ki uske reminder ab sach me bajenge.
  ctaDone: { backgroundColor: c.sage },
  ctaText: { fontSize: 15.5, fontWeight: "800", color: c.white },
  ctaTextDone: { color: c.onAccent },
}));
