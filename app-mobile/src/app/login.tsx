import { useState } from "react";
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

import { colors } from "@/theme/colors";
import SaathiMark from "@/components/saathi-mark";
import { signInEmail, signUpEmail, signInGoogle } from "@/lib/auth";
import { useToast } from "@/components/toast";

export default function Login() {
  const toast = useToast();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function submit() {
    if (loading) return;
    if (mode === "signup" && name.trim().length < 2) {
      return toast.show("Apna naam daalo", "info");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return toast.show("Sahi email daalo", "info");
    }
    if (password.length < 6) {
      return toast.show("Password kam se kam 6 characters", "info");
    }
    try {
      setLoading(true);
      if (mode === "signup") {
        const { needsConfirm } = await signUpEmail(email.trim(), password, name.trim());
        if (needsConfirm) {
          toast.show("Email pe confirmation link bheja — check karo", "success");
        } else {
          toast.show("Welcome to Apka Saathi! 🎉", "success");
        }
      } else {
        await signInEmail(email.trim(), password);
        toast.show("Welcome back! 🙂", "success");
      }
    } catch (e: any) {
      toast.show(e?.message || "Kuch gadbad ho gayi", "error");
    } finally {
      setLoading(false);
    }
  }

  async function google() {
    if (googleLoading) return;
    try {
      setGoogleLoading(true);
      await signInGoogle();
    } catch (e: any) {
      if (e?.message !== "cancelled") {
        toast.show(e?.message || "Google login nahi hua", "error");
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
            {mode === "login" ? "Wapas aa gaye 🙂" : "Milo apne Saathi se"}
          </Text>
          <Text style={styles.sub}>
            {mode === "login"
              ? "Login karo aur apni life sambhalo"
              : "Naya account banao — free hai"}
          </Text>

          {/* name (signup only) */}
          {mode === "signup" && (
            <>
              <Text style={styles.label}>Aapka naam</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Jaise: Rahul"
                placeholderTextColor={colors.inkSoft}
                autoCapitalize="words"
                style={styles.input}
              />
            </>
          )}

          {/* email */}
          <Text style={styles.label}>Email</Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="aapka@email.com"
            placeholderTextColor={colors.inkSoft}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            style={styles.input}
          />

          {/* password */}
          <Text style={styles.label}>Password</Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Kam se kam 6 characters"
            placeholderTextColor={colors.inkSoft}
            secureTextEntry
            autoCapitalize="none"
            style={styles.input}
          />

          <Pressable
            onPress={submit}
            disabled={loading}
            style={({ pressed }) => [styles.btn, (pressed || loading) && { opacity: 0.85 }]}
          >
            {loading ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text style={styles.btnText}>{mode === "login" ? "Login karo" : "Account banao"}</Text>
            )}
          </Pressable>

          {/* divider */}
          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.or}>ya</Text>
            <View style={styles.line} />
          </View>

          {/* google */}
          <Pressable
            onPress={google}
            disabled={googleLoading}
            style={({ pressed }) => [styles.googleBtn, (pressed || googleLoading) && { opacity: 0.85 }]}
          >
            {googleLoading ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <>
                <Ionicons name="logo-google" size={19} color="#DB4437" />
                <Text style={styles.googleText}>Google se continue karo</Text>
              </>
            )}
          </Pressable>

          {/* toggle */}
          <Pressable
            onPress={() => setMode(mode === "login" ? "signup" : "login")}
            style={styles.toggle}
          >
            <Text style={styles.toggleText}>
              {mode === "login" ? "Naya ho? " : "Pehle se account hai? "}
              <Text style={styles.toggleLink}>
                {mode === "login" ? "Account banao" : "Login karo"}
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
