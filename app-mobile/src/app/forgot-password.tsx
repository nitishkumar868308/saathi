import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { makeStyles, useColors } from "@/theme/theme";
import { LoaderOverlay } from "@/components/loader";
import SaathiLogo from "@/components/saathi-logo";
import { sendPasswordReset } from "@/lib/auth";
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

  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  /** Link bhej diya — ab screen sirf "inbox dekho" kehti hai. */
  const [sent, setSent] = useState(false);

  const valid = /\S+@\S+\.\S+/.test(email.trim());

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

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
                <Ionicons name="mail-open-outline" size={28} color={tc.sage} />
              </View>
              <Text style={styles.title}>{l.forgotTitle}</Text>
              <Text style={styles.sent}>{l.forgotSent}</Text>
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
      </KeyboardAvoidingView>

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
