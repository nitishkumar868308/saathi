import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  TextInput,
  Animated,
  Easing,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";

import { makeStyles, useColors } from "@/theme/theme";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";
import { useAuth } from "@/components/auth-provider";
import { getDeviceId } from "@/lib/device";
import {
  confirmApprovalCode,
  deviceState,
  onDeviceState,
  refreshDeviceState,
  sendApprovalCode,
  type DeviceApprovalError,
  type DeviceState,
} from "@/lib/device-approval";
import { syncNotifications } from "@/lib/notifications";

/**
 * "Ye naya phone hai — reminder yahan tab tak nahi aayenge."
 *
 * ⚠️ Ye `DeviceOwnerWarning` aur `MultiDeviceWarning` se ALAG cheez hai, unki
 * teesri nakal nahi. Wo dono sirf CHETAVNI hain — baat keh dete hain aur band ho
 * jaate hain. Ye ek HAALAT hai jo abhi chal rahi hai: is phone par sach me alarm
 * nahi lag rahe aur notification nahi aa rahi (`device-approval.sql`).
 *
 * Isi wajah se yahan ek patti hai jo hat-ti nahi, sirf popup nahi. Popup ek baar
 * dikhta hai aur user use bina padhe band kar deta hai — aur phir hafton tak use
 * samajh nahi aata ki uske reminder kyun nahi aa rahe. Wahi wo sabse mehnga chup
 * rehna hai jiske liye ye poora feature bana hai.
 *
 * Popup pehli baar apne aap khulta hai (jab wo baat sabse zyada kaam ki hai),
 * uske baad patti par tap karke.
 */

const SEEN_PREFIX = "saathi-device-approval-seen:";

export function DeviceApprovalGate() {
  const tc = useColors();
  const styles = useStyles();
  const { deviceApproval: d } = useT();
  const { session } = useAuth();
  const router = useRouter();
  const uid = session?.user?.id;

  const [state, setState] = useState<DeviceState>(deviceState());
  const [open, setOpen] = useState(false);
  // useState ka initializer — `useRef(new Animated.Value(...)).current` render ke
  // beech ref chhoo leta hai (react-hooks/refs). Value banti ek hi baar hai.
  const [scale] = useState(() => new Animated.Value(0.94));

  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxCardHeight = Math.max(320, height - insets.top - insets.bottom - 48);

  /* code bhejne/daalne ki haalat */
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => onDeviceState(setState), []);

  // Login ke baad aur har baar screen par aane par asli haal poochho.
  useEffect(() => {
    if (!uid) return;
    void refreshDeviceState();
  }, [uid]);

  /** Pehli baar apne aap khol do — uske baad sirf patti se. */
  useEffect(() => {
    if (!uid || !state.needsApproval) return;
    let alive = true;
    void (async () => {
      const key = `${SEEN_PREFIX}${await getDeviceId()}:${uid}`;
      const seen = await AsyncStorage.getItem(key).catch(() => null);
      if (!alive || seen === "1") return;
      await AsyncStorage.setItem(key, "1").catch(() => {});
      setOpen(true);
    })();
    return () => {
      alive = false;
    };
  }, [uid, state.needsApproval]);

  useEffect(() => {
    if (!open) return;
    scale.setValue(0.94);
    Animated.timing(scale, {
      toValue: 1,
      duration: 210,
      easing: Easing.out(Easing.back(1.3)),
      useNativeDriver: true,
    }).start();
  }, [open, scale]);

  // "Dobara bhejo" ka thehraav — server 60 second maangta hai.
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const message = useCallback(
    (e: DeviceApprovalError): string => {
      switch (e) {
        case "no_email":
          return d.errNoEmail;
        case "not_configured":
          return d.errNotConfigured;
        case "cooldown":
        case "too_many":
          return d.errTooMany;
        case "wrong_code":
          return d.errWrongCode;
        case "expired":
          return d.errExpired;
        case "locked":
          return d.errLocked;
        case "network":
          return d.errNetwork;
        default:
          return d.errFailed;
      }
    },
    [d],
  );

  async function onSend() {
    setSending(true);
    setErr(null);
    const res = await sendApprovalCode();
    setSending(false);
    if (!res.ok) {
      setErr(message(res.error));
      return;
    }
    setSentTo(res.email);
    setCooldown(res.retryAfter || 60);
  }

  async function onVerify() {
    if (code.length !== 6) return;
    setVerifying(true);
    setErr(null);
    const e = await confirmApprovalCode(code);
    setVerifying(false);
    if (e) {
      setErr(message(e));
      // Galat/expire hua code screen par pada rehna sabse chidhchida hai —
      // user ko pehle mitana padta hai.
      setCode("");
      return;
    }
    setOpen(false);
    /**
     * Ab ye phone active hai — alarm turant laga do.
     *
     * ⚠️ `force: true` zaroori hai. `syncNotifications` ki apni 60-second wali
     * rok hai, aur wo abhi-abhi (gate band hone par) chal chuki ho sakti hai.
     * Bina force ke user verify karke bhi ek minute tak bina alarm ke rehta.
     */
    void syncNotifications({ force: true });
  }

  // Logout par gayab. Active phone par kuch nahi dikhta.
  if (!uid || !state.needsApproval) return null;

  return (
    <>
      {/* ── Patti — hat-ti nahi, kyunki haalat abhi chal rahi hai ────────── */}
      <Pressable
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.banner, pressed && { opacity: 0.9 }]}
      >
        <Ionicons name="notifications-off" size={16} color={tc.onAccent} />
        <Text style={styles.bannerText} numberOfLines={2}>
          {d.bannerText}
        </Text>
        <Text style={styles.bannerCta}>{d.bannerCta}</Text>
      </Pressable>

      <Modal
        statusBarTranslucent
        transparent
        animationType="fade"
        visible={open}
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={[
            styles.backdrop,
            { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
          ]}
        >
          <Animated.View style={[styles.cardWrap, { transform: [{ scale }] }]}>
            <View style={[styles.card, { maxHeight: maxCardHeight }]}>
              <View style={styles.iconWrap}>
                <Ionicons name="phone-portrait" size={26} color={tc.terracotta} />
              </View>

              <Text style={styles.title}>{d.title}</Text>

              <ScrollView
                style={styles.scroll}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.body}>{d.intro}</Text>

                <Point icon="alarm" title={d.alarmTitle} body={d.alarmBody} />
                <Point icon="notifications" title={d.notifTitle} body={d.notifBody} />
                <Point icon="eye" title={d.dataTitle} body={d.dataBody} />

                {/* Code aane ke baad hi input dikhta hai — pehle wo bekaar
                    khaali khaana hota hai jise user bharna chahta hai par
                    bhar nahi sakta. */}
                {sentTo ? (
                  <>
                    <View style={styles.sentBox}>
                      <Ionicons name="mail" size={15} color={tc.sage} />
                      <Text style={styles.sentText}>
                        {tpl(d.sentTo, { email: sentTo })}
                      </Text>
                    </View>
                    <TextInput
                      value={code}
                      onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
                      keyboardType="number-pad"
                      maxLength={6}
                      placeholder="000000"
                      placeholderTextColor={tc.inkSoft}
                      style={styles.codeInput}
                      autoFocus
                    />
                  </>
                ) : null}

                {err ? (
                  <View style={styles.errBox}>
                    <Ionicons name="alert-circle" size={15} color={tc.danger} />
                    <Text style={styles.errText}>{err}</Text>
                  </View>
                ) : null}
              </ScrollView>

              {sentTo ? (
                <Pressable
                  onPress={() => void onVerify()}
                  disabled={verifying || code.length !== 6}
                  style={({ pressed }) => [
                    styles.cta,
                    (pressed || verifying || code.length !== 6) && { opacity: 0.6 },
                  ]}
                >
                  <Text style={styles.ctaText}>
                    {verifying ? d.verifying : d.verify}
                  </Text>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => void onSend()}
                  disabled={sending}
                  style={({ pressed }) => [styles.cta, (pressed || sending) && { opacity: 0.85 }]}
                >
                  <Text style={styles.ctaText}>{sending ? d.sending : d.sendCode}</Text>
                </Pressable>
              )}

              {sentTo ? (
                <Pressable
                  onPress={() => void onSend()}
                  disabled={cooldown > 0 || sending}
                  style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.85 }]}
                >
                  <Text style={styles.ghostText}>
                    {cooldown > 0 ? tpl(d.resendIn, { s: String(cooldown) }) : d.resend}
                  </Text>
                </Pressable>
              ) : null}

              {/**
               * Support ka raasta — iske bina wo log hamesha ke liye atak jaate
               * hain jinke account ka email ab khulta hi nahi (purana email,
               * ya code spam me chala jaata hai). Admin panel se unka phone
               * haath se chaalu kiya ja sakta hai.
               */}
              <Pressable
                onPress={() => {
                  setOpen(false);
                  router.push("/support" as never);
                }}
                style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.linkText}>{d.support}</Text>
              </Pressable>

              <Pressable
                onPress={() => setOpen(false)}
                style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.linkText}>{d.later}</Text>
              </Pressable>
            </View>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

function Point({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  const tc = useColors();
  const styles = useStyles();
  return (
    <View style={styles.point}>
      <View style={styles.pointIcon}>
        <Ionicons name={icon} size={16} color={tc.terracotta} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.pointTitle}>{title}</Text>
        <Text style={styles.pointBody}>{body}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  /**
   * Patti amber par — `terracotta` jaan-boojh ke nahi.
   *
   * Terracotta app ka "aage badho" wala rang hai (har CTA usi ka hai). Ye patti
   * kuch karne ko nahi keh rahi, ek haalat bata rahi hai. Amber par `onAccent`
   * baithta hai jo dono theme me gehra rehta hai — `white` yahan 1.9:1 par gir
   * jaata (dekho theme/colors.ts).
   */
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    backgroundColor: c.amber,
  },
  bannerText: { flex: 1, fontSize: 12.5, lineHeight: 17, fontWeight: "700", color: c.onAccent },
  bannerCta: {
    fontSize: 12.5,
    fontWeight: "800",
    color: c.onAccent,
    textDecorationLine: "underline",
  },

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
  title: { marginTop: 15, fontSize: 21, fontWeight: "800", color: c.ink, lineHeight: 28 },
  scroll: { marginTop: 12, flexShrink: 1 },
  scrollContent: { paddingBottom: 4 },
  body: { fontSize: 14.5, lineHeight: 22, color: c.inkSoft },
  point: {
    flexDirection: "row",
    gap: 11,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.cream,
    padding: 12,
  },
  pointIcon: {
    height: 32,
    width: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.12)",
  },
  pointTitle: { fontSize: 14, fontWeight: "700", color: c.ink },
  pointBody: { marginTop: 3, fontSize: 12.5, lineHeight: 18.5, color: c.inkSoft },

  sentBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(124,138,107,0.35)",
    backgroundColor: "rgba(124,138,107,0.08)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  sentText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: "600", color: c.ink },
  codeInput: {
    marginTop: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.cream,
    paddingVertical: 14,
    textAlign: "center",
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 10,
    color: c.ink,
  },
  errBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(178,59,59,0.3)",
    backgroundColor: "rgba(178,59,59,0.07)",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  errText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: "600", color: c.danger },

  cta: {
    marginTop: 14,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.terracotta,
  },
  ctaText: { fontSize: 15.5, fontWeight: "800", color: c.white },
  ghost: {
    marginTop: 9,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  ghostText: { fontSize: 14, fontWeight: "700", color: c.inkSoft },
  link: { marginTop: 10, alignItems: "center" },
  linkText: { fontSize: 13, fontWeight: "700", color: c.inkSoft, textDecorationLine: "underline" },
}));
