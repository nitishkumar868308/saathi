import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  StyleSheet,
  Animated,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/theme/colors";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";
import {
  sendPhoneOtp,
  verifyPhoneOtp,
  type PhoneError,
} from "@/lib/phone-verify";

/**
 * "SMS wala 6 ank ka code daalo".
 *
 * OTP kabhi app tak nahi aata — wo Twilio Verify ke paas rehta hai. Ye screen
 * sirf user ka type kiya hua code server ko deti hai aur uska haan/na dikhati
 * hai.
 *
 * `visible` hote hi khud SMS bhej deta hai: user ne abhi-abhi "Verify karo"
 * dabaya hai, uske baad ek aur "bhejo" button dikhana bekaar ka ek qadam hai.
 */

const CODE_LEN = 6;
/** Dobara bhejne se pehle itna ruko — Twilio khud bhi jaldi-jaldi par rok deta hai. */
const RESEND_AFTER = 30;

export function OtpModal(props: {
  visible: boolean;
  /** E.164 — +919876543210 */
  phone: string;
  onClose: () => void;
  onVerified: () => void;
}) {
  /**
   * Andar wala hissa band hote hi UNMOUNT ho jaata hai.
   *
   * ⚠️ Ye sirf saaf-safai nahi hai. Warna har state ko khulne par haath se reset
   * karna padta (code, error, counter, sab) — aur ek bhi bhoolna iska matlab hai
   * ki user ko pichhli baar ka "code galat hai" dobara khulte hi dikh jaata,
   * bina kuch kiye. Mount hone par sab apne aap naya hota hai.
   */
  return (
    <Modal
      transparent
      animationType="fade"
      visible={props.visible}
      onRequestClose={props.onClose}
    >
      {props.visible && <OtpBody {...props} />}
    </Modal>
  );
}

function OtpBody({
  phone,
  onClose,
  onVerified,
}: {
  phone: string;
  onClose: () => void;
  onVerified: () => void;
}) {
  const { profileDetails: t, common: c } = useT();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  // Mount hote hi pehla SMS jaata hai — isliye shuruaat hi "bhej rahe hain" se.
  const [sending, setSending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [left, setLeft] = useState(RESEND_AFTER);
  const [scale] = useState(() => new Animated.Value(0.94));

  const message = (e: PhoneError): string =>
    ({
      unauthorized: t.errFailed,
      not_configured: t.errNotConfigured,
      bad_number: t.errBadNumber,
      rate_limited: t.errRateLimited,
      phone_taken: t.errTaken,
      wrong_code: t.errWrongCode,
      expired: t.errExpired,
      failed: t.errFailed,
      network: t.errNetwork,
    })[e];

  // Mount hote hi: animation + pehla SMS.
  useEffect(() => {
    Animated.timing(scale, {
      toValue: 1,
      duration: 210,
      easing: Easing.out(Easing.back(1.3)),
      useNativeDriver: true,
    }).start();

    let alive = true;
    void sendPhoneOtp(phone)
      .then((err) => {
        if (!alive) return;
        if (err) setError(message(err));
        else setNote(t.otpSent);
      })
      .finally(() => {
        if (alive) setSending(false);
      });
    return () => {
      alive = false;
    };
    // `message`/`t` har render par naye bante hain — unhe deps me daalne par ye
    // effect dobara chalta aur ek aur SMS chala jaata (paisa + user ki uljhan).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phone]);

  // Resend ka counter.
  useEffect(() => {
    if (left <= 0) return;
    const id = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(id);
  }, [left]);

  async function submit() {
    if (code.length < 4 || busy) return;
    setBusy(true);
    setError(null);
    setNote(null);
    const err = await verifyPhoneOtp(phone, code);
    setBusy(false);
    if (err) {
      setError(message(err));
      // Expire ho gaya to naya code chahiye — counter turant khol do, warna
      // user "Dobara bhejo" ke liye 30 second ghoorta rehta hai jabki uske paas
      // ab koi zinda code hai hi nahi.
      if (err === "expired") setLeft(0);
      return;
    }
    onVerified();
  }

  async function resend() {
    if (left > 0 || sending) return;
    setSending(true);
    setError(null);
    setNote(null);
    setCode("");
    const err = await sendPhoneOtp(phone);
    setSending(false);
    if (err) setError(message(err));
    else {
      setNote(t.otpSent);
      setLeft(RESEND_AFTER);
    }
  }

  return (
    <View style={styles.backdrop}>
      <Animated.View style={[styles.cardWrap, { transform: [{ scale }] }]}>
        <View style={styles.card}>
          <View style={styles.head}>
            <View style={styles.iconWrap}>
              <Ionicons
                name="chatbox-ellipses"
                size={22}
                color={colors.terracotta}
              />
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
              <Ionicons name="close" size={20} color={colors.inkSoft} />
            </Pressable>
          </View>

          <Text style={styles.title}>{tpl(t.otpTitle, { phone })}</Text>
          <Text style={styles.sub}>{t.otpSub}</Text>

          <TextInput
            value={code}
            onChangeText={(v) => {
              // Log SMS se copy karte waqt space/dash bhi le aate hain.
              const digits = v.replace(/\D/g, "").slice(0, CODE_LEN);
              setCode(digits);
              if (error) setError(null);
            }}
            placeholder={t.otpPh}
            placeholderTextColor={colors.inkSoft}
            keyboardType="number-pad"
            // Android/iOS dono SMS se code khud bhar dete hain — ek bhi tap
            // bachana yahan sach me kaam ka hai.
            autoComplete="sms-otp"
            textContentType="oneTimeCode"
            autoFocus
            maxLength={CODE_LEN}
            style={styles.input}
          />

          {!!error && <Text style={styles.err}>{error}</Text>}
          {!error && !!note && <Text style={styles.note}>{note}</Text>}

          <Pressable
            onPress={() => void submit()}
            disabled={code.length < 4 || busy}
            style={({ pressed }) => [
              styles.cta,
              (code.length < 4 || busy) && { opacity: 0.45 },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={styles.ctaText}>{busy ? c.loading : t.otpSubmit}</Text>
          </Pressable>

          <Pressable
            onPress={() => void resend()}
            disabled={left > 0 || sending}
            hitSlop={8}
            style={styles.resend}
          >
            <Text
              style={[
                styles.resendText,
                (left > 0 || sending) && { opacity: 0.5 },
              ]}
            >
              {sending
                ? t.otpSending
                : left > 0
                  ? tpl(t.otpResendIn, { s: left })
                  : t.otpResend}
            </Text>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(46,40,35,0.55)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  cardWrap: { width: "100%", maxWidth: 400 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  head: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  iconWrap: {
    height: 52,
    width: 52,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.12)",
  },
  close: { padding: 4 },
  title: {
    marginTop: 14,
    fontSize: 18,
    fontWeight: "800",
    color: colors.ink,
    lineHeight: 25,
  },
  sub: { marginTop: 6, fontSize: 13.5, lineHeight: 20, color: colors.inkSoft },
  input: {
    marginTop: 16,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cream,
    // Code padhne me aasan ho — bada, beech me, aur ank alag-alag dikhein.
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 8,
    textAlign: "center",
    color: colors.ink,
  },
  err: {
    marginTop: 9,
    fontSize: 13,
    fontWeight: "600",
    color: colors.terracottaDark,
  },
  note: { marginTop: 9, fontSize: 13, fontWeight: "600", color: colors.sage },
  cta: {
    marginTop: 16,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.terracotta,
  },
  ctaText: { fontSize: 15, fontWeight: "800", color: colors.white },
  resend: { marginTop: 12, alignItems: "center", paddingVertical: 4 },
  resendText: { fontSize: 13.5, fontWeight: "700", color: colors.terracotta },
});
