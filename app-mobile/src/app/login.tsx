import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";

import { colors } from "@/theme/colors";
import { Loader } from "@/components/loader";
import SaathiMark from "@/components/saathi-mark";
import { signInEmail, signUpEmail, signInGoogle } from "@/lib/auth";
import { useToast } from "@/components/toast";
import { savePendingReferral } from "@/lib/referral-pending";
import { useOffers } from "@/lib/use-offers";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";

/** apkasaathi.com/r/CODE ya koi bhi ?ref=CODE se code nikalta hai. */
function referralFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const { path, queryParams } = Linking.parse(url);
    const q = queryParams?.ref;
    if (typeof q === "string" && q.trim()) return q.trim().toUpperCase();
    const m = path?.match(/^r\/([A-Za-z0-9]+)$/);
    return m ? m[1].toUpperCase() : null;
  } catch {
    return null;
  }
}

export default function Login() {
  const toast = useToast();
  const offers = useOffers();
  const { login: l } = useT();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [refCode, setRefCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  // Share-link (apkasaathi.com/r/CODE) se app khule to code apne aap bhar do.
  const url = Linking.useURL();
  useEffect(() => {
    const code = referralFromUrl(url);
    if (code) {
      setRefCode(code);
      setMode("signup");
    }
  }, [url]);

  async function submit() {
    if (loading) return;
    if (mode === "signup" && name.trim().length < 2) {
      return toast.show(l.nameRequired, "info");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return toast.show(l.badEmail, "info");
    }
    if (password.length < 6) {
      return toast.show(l.shortPassword, "info");
    }
    try {
      setLoading(true);
      if (mode === "signup") {
        // Login hone ke baad auth-provider isko apply karega.
        await savePendingReferral(refCode);
        const { needsConfirm } = await signUpEmail(email.trim(), password, name.trim());
        if (needsConfirm) {
          toast.show(l.confirmSent, "success");
        } else {
          toast.show(l.welcomeNew, "success");
        }
      } else {
        await signInEmail(email.trim(), password);
        toast.show(l.welcomeBackToast, "success");
      }
    } catch (e: any) {
      toast.show(e?.message || l.somethingWrong, "error");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    if (googleLoading) return;
    try {
      setGoogleLoading(true);
      // Referral code ho to hamesha save karo — naya Google user chahe "login"
      // dabaye, uska referral + welcome (server-side) miss na ho.
      if (refCode.trim()) await savePendingReferral(refCode);
      await signInGoogle();
    } catch (e: any) {
      if (e?.message !== "cancelled") {
        // Google flow ke technical errors user ko localized dikhao — lib ke
        // raw (Hinglish) messages leak na ho.
        toast.show(l.googleFailed, "error");
      }
    } finally {
      setGoogleLoading(false);
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
          <View style={styles.logo}>
            <SaathiMark size={36} color={colors.white} />
          </View>
          <Text style={styles.title}>
            {mode === "login" ? `${l.welcomeBack} 🙂` : l.signupTitle}
          </Text>
          <Text style={styles.sub}>{mode === "login" ? l.loginSub : l.signupSub}</Text>

          {/* name (signup only) */}
          {mode === "signup" && (
            <>
              <Text style={styles.label}>{l.name}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={l.namePlaceholder}
                placeholderTextColor={colors.inkSoft}
                autoCapitalize="words"
                style={styles.input}
              />
            </>
          )}

          {/* email */}
          <Text style={styles.label}>{l.email}</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder={l.emailPlaceholder}
            placeholderTextColor={colors.inkSoft}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            style={styles.input}
          />

          {/* password */}
          <Text style={styles.label}>{l.password}</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={l.passwordPlaceholder}
            placeholderTextColor={colors.inkSoft}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />

          {/* referral code (signup only, optional; referrals band ho to nahi) */}
          {mode === "signup" && offers.referralsEnabled && (
            <>
              <Text style={styles.label}>
                {l.referralCode} <Text style={styles.optional}>({l.referralOptional})</Text>
              </Text>
              <TextInput
                value={refCode}
                onChangeText={(txt) => setRefCode(txt.toUpperCase())}
                placeholder={tpl(l.referralPlaceholderTpl, { d: offers.referralDays })}
                placeholderTextColor={colors.inkSoft}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={10}
                style={styles.input}
              />
              <Text style={styles.refHint}>{l.referralHint}</Text>
            </>
          )}

          <Pressable
            onPress={submit}
            disabled={loading}
            style={({ pressed }) => [styles.btn, (pressed || loading) && { opacity: 0.85 }]}
          >
            {loading ? (
              <Loader size={30} color={colors.white} />
            ) : (
              <Text style={styles.btnText}>{mode === "login" ? l.loginBtn : l.signupBtn}</Text>
            )}
          </Pressable>

          {/* divider */}
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.or}>{l.or}</Text>
            <View style={styles.line} />
          </View>

          {/* google */}
          <Pressable
            onPress={google}
            disabled={googleLoading}
            style={({ pressed }) => [styles.googleBtn, (pressed || googleLoading) && { opacity: 0.85 }]}
          >
            {googleLoading ? (
              <Loader size={30} color={colors.ink} />
            ) : (
              <>
                <Ionicons name="logo-google" size={19} color="#DB4437" />
                <Text style={styles.googleText}>{l.google}</Text>
              </>
            )}
          </Pressable>

          {/* toggle */}
          <Pressable
            onPress={() => setMode(mode === "login" ? "signup" : "login")}
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>
              {mode === "login" ? `${l.noAccount} ` : `${l.haveAccount} `}
              <Text style={styles.toggleLink}>
                {mode === "login" ? l.createAccount : l.loginInstead}
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 440, alignSelf: "center" } as const;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { padding: 28, paddingTop: 48, flexGrow: 1, justifyContent: "center", ...CONTENT },
  logo: {
    height: 72,
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: colors.terracotta,
    marginBottom: 20,
  },
  title: { fontSize: 30, fontWeight: "800", color: colors.ink },
  sub: { marginTop: 8, fontSize: 15, color: colors.inkSoft, lineHeight: 22 },
  label: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "700",
    color: colors.ink,
  },
  optional: { fontWeight: "500", color: colors.inkSoft },
  refHint: { marginTop: 8, fontSize: 12.5, lineHeight: 18, color: colors.inkSoft },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: colors.ink,
    fontSize: 15,
  },
  btn: {
    marginTop: 24,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.terracotta,
  },
  btnText: { color: colors.white, fontWeight: "700", fontSize: 16 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 22 },
  line: { flex: 1, height: 1, backgroundColor: colors.line },
  or: { fontSize: 13, color: colors.inkSoft, fontWeight: "600" },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  googleText: { fontSize: 15, fontWeight: "700", color: colors.ink },
  toggle: { marginTop: 24, alignItems: "center" },
  toggleText: { fontSize: 14.5, color: colors.inkSoft },
  toggleLink: { color: colors.terracotta, fontWeight: "700" },
});
