import { useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";

import { makeStyles, useColors } from "@/theme/theme";
import { LoaderOverlay } from "@/components/loader";
import SaathiLogo from "@/components/saathi-logo";
import { signInEmail, signUpEmail, signInGoogle } from "@/lib/auth";
import { useToast } from "@/components/toast";
import { savePendingReferral } from "@/lib/referral-pending";
import { useOffers } from "@/lib/use-offers";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";
import { deviceOwner, type DeviceOwner } from "@/lib/device";

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
  const tc = useColors();
  const styles = useStyles();
  const toast = useToast();
  const offers = useOffers();
  const { login: l, deviceOwner: d } = useT();
  const [mode, setMode] = useState<"login" | "signup">("login");
  /**
   * Ye phone pehle se kisi ke naam par set hai kya.
   *
   * Login se pehle poochna zaroori hai: baad me batane par banda apni ID daal
   * chuka hota hai, aur usi lamhe purane user ki notification band ho jaati hai.
   * Fail ho to `null` — chetavni na dikhna login rokne se kahin behtar hai.
   */
  const [owner, setOwner] = useState<DeviceOwner | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Password hamesha chhupa hua shuru hota hai — user khud aankh dabaye to dikhe.
  const [showPassword, setShowPassword] = useState(false);
  const [refCode, setRefCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    void deviceOwner().then((o) => {
      // `isMe` yahan kabhi sach nahi hota (login screen par session hai hi
      // nahi), par guard rakha hai — logout ke turant baad ka lamha bhi isi
      // screen par guzarta hai.
      if (alive && o && !o.isMe) setOwner(o);
    });
    return () => {
      alive = false;
    };
  }, []);

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
            <SaathiLogo size={72} radius={24} />
          </View>
          <Text style={styles.title}>
            {mode === "login" ? `${l.welcomeBack} 🙂` : l.signupTitle}
          </Text>
          <Text style={styles.sub}>{mode === "login" ? l.loginSub : l.signupSub}</Text>

          {/* Ye phone pehle se kisi aur ke naam par set hai — login se PEHLE.
              Poori baat login ke baad wale modal me hai; yahan sirf itna ki
              banda galat phone par apni ID daalne se pehle ruk ke soch le. */}
          {!!owner && (
            <View style={styles.ownerNote}>
              <Ionicons name="phone-portrait-outline" size={16} color={tc.terracotta} />
              <View style={{ flex: 1 }}>
                <Text style={styles.ownerTitle}>{d.bannerTitle}</Text>
                <Text style={styles.ownerBody}>
                  {tpl(d.bannerBody, { who: owner.email ?? owner.name ?? "" })}
                </Text>
              </View>
            </View>
          )}

          {/* name (signup only) */}
          {mode === "signup" && (
            <>
              <Text style={styles.label}>{l.name}</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={l.namePlaceholder}
                placeholderTextColor={tc.inkSoft}
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
            placeholderTextColor={tc.inkSoft}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            style={styles.input}
          />

          {/* password — default chhupa hua, aankh dabao to dikhta hai */}
          <Text style={styles.label}>{l.password}</Text>
          <View style={styles.passWrap}>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder={l.passwordPlaceholder}
              placeholderTextColor={tc.inkSoft}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, styles.passInput]}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? l.hidePassword : l.showPassword}
              style={({ pressed }) => [styles.eye, pressed && { opacity: 0.6 }]}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={tc.inkSoft}
              />
            </Pressable>
          </View>

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
                placeholderTextColor={tc.inkSoft}
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
            <Text style={styles.btnText}>{mode === "login" ? l.loginBtn : l.signupBtn}</Text>
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
            {(
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

      {/* Login / Google — dono ke liye ek hi center overlay loader. */}
      <LoaderOverlay visible={loading || googleLoading} />
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 440, alignSelf: "center" } as const;

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  content: { padding: 28, paddingTop: 48, flexGrow: 1, justifyContent: "center", ...CONTENT },
  logo: {
    height: 72,
    width: 72,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 24,
    backgroundColor: c.terracotta,
    marginBottom: 20,
  },
  title: { fontSize: 30, fontWeight: "800", color: c.ink },
  sub: { marginTop: 8, fontSize: 15, color: c.inkSoft, lineHeight: 22 },
  ownerNote: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.3)",
    backgroundColor: "rgba(194,90,55,0.07)",
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  ownerTitle: { fontSize: 13.5, fontWeight: "800", color: c.ink },
  ownerBody: { marginTop: 2, fontSize: 12.5, lineHeight: 18, color: c.inkSoft },
  label: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 14,
    fontWeight: "700",
    color: c.ink,
  },
  optional: { fontWeight: "500", color: c.inkSoft },
  refHint: { marginTop: 8, fontSize: 12.5, lineHeight: 18, color: c.inkSoft },
  input: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: c.ink,
    fontSize: 15,
  },
  passWrap: { position: "relative", justifyContent: "center" },
  // Text aankh ke neeche na chala jaaye.
  passInput: { paddingRight: 52 },
  eye: {
    position: "absolute",
    right: 4,
    top: 0,
    bottom: 0,
    width: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  btn: {
    marginTop: 24,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: c.terracotta,
  },
  btnText: { color: c.white, fontWeight: "700", fontSize: 16 },
  divider: { flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 22 },
  line: { flex: 1, height: 1, backgroundColor: c.line },
  or: { fontSize: 13, color: c.inkSoft, fontWeight: "600" },
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  googleText: { fontSize: 15, fontWeight: "700", color: c.ink },
  toggle: { marginTop: 24, alignItems: "center" },
  toggleText: { fontSize: 14.5, color: c.inkSoft },
  toggleLink: { color: c.terracotta, fontWeight: "700" },
}));
