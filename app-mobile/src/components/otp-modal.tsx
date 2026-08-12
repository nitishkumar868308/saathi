import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  Modal,
  Animated,
  Easing,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { makeStyles, useColors } from "@/theme/theme";
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
  /**
   * OTP ki hadd poori ho gayi — is user ko ab support se reset karwana padega.
   *
   * ⚠️ Ye modal se BAHAR bhi dikhna chahiye, aur yahi is callback ki poori
   * wajah hai. Modal band hote hi uske andar ka error gayab ho jaata hai, aur
   * user ko sirf ek "Verify karo" button dikhta rehta hai jo dabane par har
   * baar fail hota hai — bina ye bataye ki karna kya hai. Ab profile screen
   * phone field ke neeche wo note tikaye rakhti hai, support ke button ke saath.
   */
  onBlocked?: () => void;
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
      statusBarTranslucent
      animationType="fade"
      visible={props.visible}
      onRequestClose={props.onClose}
    >
      {props.visible && (
        <OtpBody
          phone={props.phone}
          onClose={props.onClose}
          onVerified={props.onVerified}
          onBlocked={props.onBlocked}
        />
      )}
    </Modal>
  );
}

function OtpBody({
  phone,
  onClose,
  onVerified,
  onBlocked,
}: {
  phone: string;
  onClose: () => void;
  onVerified: () => void;
  onBlocked?: () => void;
}) {
  const tc = useColors();
  const styles = useStyles();
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
      cooldown: t.errCooldown,
      too_many: t.errTooMany,
      blocked: t.errBlockedCountry,
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
        if (err) {
          setError(message(err));
          if (err === "too_many") onBlocked?.();
        } else setNote(t.otpSent);
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
    if (err) {
      setError(message(err));
      if (err === "too_many") onBlocked?.();
      // Server ne "abhi-abhi bheja hai" kaha — button ko dobara zinda mat
      // dikhao, warna user usi diwaar se baar-baar takrata rahega.
      if (err === "cooldown") setLeft(RESEND_AFTER);
      return;
    }
    setNote(t.otpSent);
    setLeft(RESEND_AFTER);
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
                color={tc.terracotta}
              />
            </View>
            <Pressable onPress={onClose} hitSlop={10} style={styles.close}>
              <Ionicons name="close" size={20} color={tc.inkSoft} />
            </Pressable>
          </View>

          {/*
            ⚠️ Title tabhi "code bheja hai" kehta hai jab SMS SACH ME chala ho.

            Pehle wo hamesha "{phone} par code bheja hai" likh deta tha — modal
            khulte hi, bhejne se pehle. Fail hone par (number kisi aur ka hai,
            hadd poori hai, net nahi) screen ek saath do ulti baatein kehti thi:
            upar "code bheja hai", neeche laal me "nahi bheja ja saka". User 6
            ank ka intezaar karta baitha rehta tha jo aane hi nahi the.
          */}
          <Text style={styles.title}>
            {sending ? t.otpSending : error ? t.otpTitleFailed : tpl(t.otpTitle, { phone })}
          </Text>
          <Text style={styles.sub}>{error ? tpl(t.otpForPhone, { phone }) : t.otpSub}</Text>

          <TextInput
            value={code}
            onChangeText={(v) => {
              // Log SMS se copy karte waqt space/dash bhi le aate hain.
              const digits = v.replace(/\D/g, "").slice(0, CODE_LEN);
              setCode(digits);
              if (error) setError(null);
            }}
            placeholder={t.otpPh}
            placeholderTextColor={tc.inkSoft}
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

const useStyles = makeStyles((c) => ({
  backdrop: {
    flex: 1,
    // Theme-aware parda. Pehle yahan ek hardcoded rgba tha jo dark mode me
    // gehre page par bilkul dikhta hi nahi tha.
    backgroundColor: c.scrim,
    alignItems: "center",
    justifyContent: "center",
    padding: 18,
  },
  cardWrap: { width: "100%", maxWidth: 400 },
  card: {
    backgroundColor: c.surface,
    borderRadius: 26,
    padding: 20,
    borderWidth: 1,
    borderColor: c.line,
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
    color: c.ink,
    lineHeight: 25,
  },
  sub: { marginTop: 6, fontSize: 13.5, lineHeight: 20, color: c.inkSoft },
  input: {
    marginTop: 16,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.cream,
    // Code padhne me aasan ho — bada, beech me, aur ank alag-alag dikhein.
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 8,
    textAlign: "center",
    color: c.ink,
  },
  err: {
    marginTop: 9,
    fontSize: 13,
    fontWeight: "600",
    color: c.terracottaDark,
  },
  note: { marginTop: 9, fontSize: 13, fontWeight: "600", color: c.sage },
  cta: {
    marginTop: 16,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.terracotta,
  },
  ctaText: { fontSize: 15, fontWeight: "800", color: c.white },
  resend: { marginTop: 12, alignItems: "center", paddingVertical: 4 },
  resendText: { fontSize: 13.5, fontWeight: "700", color: c.terracotta },
}));
