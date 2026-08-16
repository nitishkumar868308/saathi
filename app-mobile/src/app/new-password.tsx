import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { KeyboardView } from "@/components/keyboard-view";
import { makeStyles, useColors } from "@/theme/theme";
import { LoaderOverlay } from "@/components/loader";
import SaathiLogo from "@/components/saathi-logo";
import { clearPendingPasswordReset, setNewPassword } from "@/lib/auth";
import { reportIfNetwork } from "@/lib/net-alert";
import { reportError } from "@/lib/report-error";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * Naya password — email ke recovery link par tap karne ke BAAD wali screen.
 *
 * Yahan tak sirf `app/auth.tsx` bhejta hai, aur wo tabhi bhejta hai jab
 * Supabase ne link se ek recovery session bana diya ho. Bina us session ke
 * `updateUser` khud hi mana kar deta hai — yaani koi bhi bina link ke kisi ka
 * password nahi badal sakta. Isliye yahan koi purana password nahi poocha
 * jaata (user use bhool hi chuka hai — wahi to poori dikkat thi).
 */
export default function NewPassword() {
  const tc = useColors();
  const styles = useStyles();
  const router = useRouter();
  const toast = useToast();
  const { login: l } = useT();

  const [pass, setPass] = useState("");
  const [again, setAgain] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  const longEnough = pass.length >= 6;
  const matches = pass === again;
  const valid = longEnough && matches;

  async function submit() {
    if (busy) return;
    if (!longEnough) return toast.show(l.shortPassword, "info");
    if (!matches) return toast.show(l.newPassMismatch, "info");
    setBusy(true);
    try {
      await setNewPassword(pass);
      /**
       * Kaam poora — "reset chal raha hai" wala nishaan hata do.
       *
       * ⚠️ Iske bina wo nishaan 24 ghante tak pada rehta, aur us dauraan koi
       * Google login toot jaye to `app/auth.tsx` use reset ka natija samajh ke
       * forgot-password screen par bhej deta — jabki us user ne reset kabhi
       * maanga hi nahi tha.
       */
      await clearPendingPasswordReset();
      toast.show(l.newPassOk, "success");
      // Recovery session ab poora login hai — seedha app me. Dobara login
      // karwana yahan bekaar hai (aur user ko lagta hai kuch hua hi nahi).
      router.replace("/");
    } catch (e) {
      if (!reportIfNetwork(e, "save", () => void submit())) {
        reportError(e, { screen: "new-password", action: "save" });
        toast.show(l.somethingWrong, "error");
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

          <Text style={styles.title}>{l.newPassTitle}</Text>
          <Text style={styles.sub}>{l.newPassSub}</Text>

          <Text style={styles.label}>{l.newPassLabel}</Text>
          <View style={styles.passWrap}>
            <TextInput
              value={pass}
              onChangeText={setPass}
              placeholder={l.newPassPlaceholder}
              placeholderTextColor={tc.inkSoft}
              secureTextEntry={!show}
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
              style={[styles.input, styles.passInput]}
            />
            <Pressable
              onPress={() => setShow((v) => !v)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={show ? l.hidePassword : l.showPassword}
              style={({ pressed }) => [styles.eye, pressed && { opacity: 0.6 }]}
            >
              <Ionicons
                name={show ? "eye-off-outline" : "eye-outline"}
                size={20}
                color={tc.inkSoft}
              />
            </Pressable>
          </View>

          <Text style={styles.label}>{l.newPassConfirm}</Text>
          <TextInput
            value={again}
            onChangeText={setAgain}
            placeholder={l.newPassConfirm}
            placeholderTextColor={tc.inkSoft}
            // Dono jagah ek hi `show` — do alag aankh dena user ko uljhata hai,
            // aur "dobara likho" ka poora matlab hi tab khatam ho jaata hai jab
            // wo pehle wale se copy kar sake.
            secureTextEntry={!show}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={() => void submit()}
            style={styles.input}
          />
          {/* Galti turant dikhe — submit ka intezaar karwana bekaar hai. */}
          {again.length > 0 && !matches && (
            <Text style={styles.err}>{l.newPassMismatch}</Text>
          )}

          <Pressable
            onPress={() => void submit()}
            disabled={busy || !valid}
            style={({ pressed }) => [
              styles.btn,
              (pressed || busy || !valid) && { opacity: 0.6 },
            ]}
          >
            <Text style={styles.btnText}>{l.newPassSave}</Text>
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
  label: { marginTop: 14, marginBottom: 8, fontSize: 14, fontWeight: "700", color: c.ink },
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
  passWrap: { justifyContent: "center" },
  passInput: { paddingRight: 48 },
  eye: { position: "absolute", right: 14, padding: 4 },
  err: { marginTop: 8, fontSize: 13, fontWeight: "600", color: c.terracotta },
  btn: {
    marginTop: 24,
    height: 54,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.terracotta,
  },
  btnText: { fontSize: 16, fontWeight: "700", color: c.white },
}));
