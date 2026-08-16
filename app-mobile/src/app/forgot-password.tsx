import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";

import { KeyboardView } from "@/components/keyboard-view";
import { makeStyles, useColors } from "@/theme/theme";
import { LoaderOverlay } from "@/components/loader";
import SaathiLogo from "@/components/saathi-logo";
import {
  pendingPasswordReset,
  sendPasswordReset,
  verifyPasswordResetCode,
} from "@/lib/auth";
import { reportIfNetwork } from "@/lib/net-alert";
import { reportError } from "@/lib/report-error";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * "Password bhool gaye" — reset link mangwane ki screen.
 *
 * ⚠️ Ye screen pehle thi hi nahi, aur uska nateeja seedha tha: email+password
 * se bana account, password bhool gaye — aur app me kahin koi rasta nahi.
 * Google wale phir bhi andar aa jaate the; email wale hamesha ke liye apne hi
 * documents aur reminders se bahar. Support bhi kuch nahi kar sakta tha,
 * kyunki password Supabase ke paas hashed hai — hum use dekh hi nahi sakte.
 *
 * ⚠️ Jawab HAMESHA ek jaisa hai — "agar ye email register hai to link bhej
 * diya hai" — chahe wo email hamare paas ho ya na ho. Ye jaan-boojh ke hai:
 * "ye email register nahi hai" bata dena kisi ko bhi ye jaanne ka tareeka de
 * deta hai ki kaun-kaun is app par hai (account enumeration). Isliye screen
 * bhejne ke baad seedha "bhej diya" wale haal me chali jaati hai.
 */
export default function ForgotPassword() {
  const tc = useColors();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const { login: l, common: c } = useT();
  /**
   * `expired=1` — user link par tap karke YAHIN laut ke aaya hai, kyunki wo link
   * nahi chala (`app/auth.tsx` bhejta hai).
   *
   * ⚠️ Pehle wo user chup-chaap LOGIN screen par pahunchta tha, bina kisi wajah
   * ke — aur uske paas dobara wahi link dabane ke alawa kuch tha hi nahi, jo
   * (ek baar chalne wale token ki wajah se) kabhi chalne wala hi nahi tha. Wahi
   * poori "reset link kaam nahi karta" wali shikayat thi.
   */
  const { expired } = useLocalSearchParams<{ expired?: string }>();

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  /** Link bhej diya — ab screen sirf "inbox dekho" kehti hai. */
  const [sent, setSent] = useState(String(expired ?? "") === "1");
  /** Email me aaya 6-ank ka code — link ka doosra raasta. */
  const [code, setCode] = useState("");

  /**
   * Toote hue link se aaye ho to email dobara mat poochho.
   *
   * Wo email pehle hi is phone se maanga gaya tha (`sendPasswordReset` use yaad
   * rakhta hai). Dobara poochhna bekaar hai — aur code wale raaste ke liye email
   * chahiye hi chahiye (`verifyOtp` bina uske chalta hi nahi).
   */
  useEffect(() => {
    if (String(expired ?? "") !== "1") return;
    let alive = true;
    void pendingPasswordReset().then((saved) => {
      if (alive && saved) setEmail(saved);
    });
    return () => {
      alive = false;
    };
  }, [expired]);

  const valid = /\S+@\S+\.\S+/.test(email.trim());
  const codeReady = code.replace(/\D/g, "").length >= 6;

  async function submit() {
    if (busy || !valid) return;
    setBusy(true);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (e) {
      // Net ki dikkat ka apna popup + retry hota hai — uske upar toast dikhana
      // user ko do baar wahi baat kehna hai.
      if (!reportIfNetwork(e, "save", () => void submit())) {
        reportError(e, { screen: "forgot-password", action: "send" });
        toast.show(l.somethingWrong, "error");
      }
    } finally {
      setBusy(false);
    }
  }

  /**
   * Code se aage badho — link ko haath lagaye bina.
   *
   * Kaamyab hone par yahan wahi recovery session ban jaata hai jo link se banta
   * hai, isliye seedha `new-password` par ja sakte hain — bilkul wahi jagah
   * jahan link chalne par pahunchte.
   */
  async function submitCode() {
    if (busy || !codeReady) return;
    if (!valid) return toast.show(l.resetCodeNeedsEmail, "info");
    setBusy(true);
    try {
      await verifyPasswordResetCode(email, code);
      router.replace("/new-password" as never);
    } catch (e) {
      if (!reportIfNetwork(e, "save", () => void submitCode())) {
        // ⚠️ Yahan `reportError` NAHI. Galat/purana code user ki aam galti hai,
        // server ki kharabi nahi — use Logs me bhejne se asli errors us shor me
        // dab jaate hain.
        toast.show(l.resetCodeBad, "error");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardView>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoWrap}>
            <SaathiLogo size={62} />
          </View>

          {sent ? (
            /* Bhej diya — ab sirf ek saaf agla kadam. */
            <View style={styles.doneBox}>
              <View style={styles.doneIcon}>
                <Ionicons
                  name={String(expired ?? "") === "1" ? "alert-circle-outline" : "mail-open-outline"}
                  size={28}
                  color={String(expired ?? "") === "1" ? tc.danger : tc.sage}
                />
              </View>
              <Text style={styles.title}>{l.forgotTitle}</Text>
              <Text style={styles.sent}>
                {String(expired ?? "") === "1" ? l.resetLinkDead : l.forgotSent}
              </Text>

              {/**
               * ── Code wala doosra raasta ──────────────────────────────────
               *
               * ⚠️ Ye isliye hai ki LINK ka raasta bahut si aisi jagah tootta hai
               * jahan hamara koi bas nahi chalta: Gmail/Outlook ka scanner link
               * ko user se pehle khol ke token kha jaata hai (aur recovery token
               * ek hi baar chalta hai), mail laptop par khula ho to `saathi://`
               * ko wahan koi nahi jaanta, aur link ki apni umar 1 ghante ki hai.
               * Poori list `lib/auth.ts` ke `verifyPasswordResetCode()` par hai.
               *
               * Code in sab se bacha hua hai — wo email ke TEXT me hota hai,
               * kisi tap ki zaroorat hi nahi, aur kisi bhi device se padh ke
               * yahan type kiya ja sakta hai.
               */}
              <View style={styles.codeBox}>
                <Text style={styles.codeTitle}>{l.resetCodeTitle}</Text>
                <Text style={styles.codeSub}>{l.resetCodeSub}</Text>

                {/* Email — toote hue link se aaye ho to pehle se bhara hua. */}
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  placeholder={l.emailPlaceholder}
                  placeholderTextColor={tc.inkSoft}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  style={styles.input}
                />
                <TextInput
                  value={code}
                  onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
                  placeholder={l.resetCodePlaceholder}
                  placeholderTextColor={tc.inkSoft}
                  keyboardType="number-pad"
                  autoComplete="one-time-code"
                  textContentType="oneTimeCode"
                  maxLength={6}
                  returnKeyType="done"
                  onSubmitEditing={() => void submitCode()}
                  style={[styles.input, styles.codeInput]}
                />
                <Pressable
                  onPress={() => void submitCode()}
                  disabled={busy || !codeReady}
                  style={({ pressed }) => [
                    styles.btn,
                    styles.codeBtn,
                    (pressed || busy || !codeReady) && { opacity: 0.6 },
                  ]}
                >
                  <Text style={styles.btnText}>{l.resetCodeSubmit}</Text>
                </Pressable>

                {/* Link/code dono khatam — ek aur bhej do. */}
                <Pressable
                  onPress={() => void submit()}
                  disabled={busy || !valid}
                  hitSlop={8}
                  style={({ pressed }) => [
                    styles.again,
                    (pressed || busy || !valid) && { opacity: 0.6 },
                  ]}
                >
                  <Ionicons name="refresh" size={15} color={tc.terracotta} />
                  <Text style={styles.againText}>{l.resetSendAgain}</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.title}>{l.forgotTitle}</Text>
              <Text style={styles.sub}>{l.forgotSub}</Text>

              <Text style={styles.label}>{l.email}</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder={l.emailPlaceholder}
                placeholderTextColor={tc.inkSoft}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                autoFocus
                returnKeyType="send"
                onSubmitEditing={() => void submit()}
                style={styles.input}
              />

              <Pressable
                onPress={() => void submit()}
                disabled={busy || !valid}
                style={({ pressed }) => [
                  styles.btn,
                  (pressed || busy || !valid) && { opacity: 0.6 },
                ]}
              >
                <Text style={styles.btnText}>{l.forgotSend}</Text>
              </Pressable>
            </>
          )}

          <Pressable
            onPress={() => router.back()}
            hitSlop={8}
            style={({ pressed }) => [styles.back, pressed && { opacity: 0.6 }]}
          >
            <Ionicons name="arrow-back" size={16} color={tc.terracotta} />
            <Text style={styles.backText}>{sent ? l.forgotBack : c.back}</Text>
          </Pressable>
        </ScrollView>
      </KeyboardView>

      <LoaderOverlay visible={busy} />
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 460, alignSelf: "center" } as const;

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  content: { padding: 24, paddingTop: 40, ...CONTENT },
  logoWrap: { alignItems: "center", marginBottom: 22 },
  title: { fontSize: 24, fontWeight: "800", color: c.ink, textAlign: "center" },
  sub: {
    marginTop: 8,
    marginBottom: 22,
    fontSize: 14,
    lineHeight: 21,
    color: c.inkSoft,
    textAlign: "center",
  },
  label: { marginBottom: 8, fontSize: 14, fontWeight: "700", color: c.ink },
  input: {
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    color: c.ink,
    fontSize: 15,
  },
  btn: {
    marginTop: 20,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.terracotta,
  },
  btnText: { fontSize: 16, fontWeight: "700", color: c.white },
  doneBox: { alignItems: "center", paddingVertical: 8 },
  doneIcon: {
    height: 64,
    width: 64,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(124,138,107,0.14)",
    marginBottom: 16,
  },
  sent: {
    marginTop: 10,
    fontSize: 14.5,
    lineHeight: 22,
    color: c.inkSoft,
    textAlign: "center",
  },
  /** Code wala raasta — "bhej diya" wale box ke neeche, apni alag patti me. */
  codeBox: {
    width: "100%",
    marginTop: 24,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: c.line,
  },
  codeTitle: { fontSize: 16, fontWeight: "800", color: c.ink },
  codeSub: {
    marginTop: 6,
    marginBottom: 14,
    fontSize: 13.5,
    lineHeight: 20,
    color: c.inkSoft,
  },
  /**
   * 6 ank — bade, khule hue akshar.
   *
   * Ye khaana aksar wo log bharte hain jinko email doosre device par dikh raha
   * hai; unhe ank ek-ek karke dekh ke type karne padte hain. Chhote, chipke hue
   * akshar me ek ank ki galti pakadna mushkil hota hai.
   */
  codeInput: {
    marginTop: 10,
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 6,
    textAlign: "center",
  },
  codeBtn: { marginTop: 14 },
  again: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 16,
    paddingVertical: 6,
  },
  againText: { fontSize: 14, fontWeight: "700", color: c.terracotta },
  back: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: 26,
    paddingVertical: 8,
  },
  backText: { fontSize: 14.5, fontWeight: "700", color: c.terracotta },
}));
