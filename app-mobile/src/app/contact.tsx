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
import { router } from "expo-router";

import { makeStyles, useColors } from "@/theme/theme";
import { LoaderOverlay } from "@/components/loader";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useAuth } from "@/components/auth-provider";
import { useUserDetails } from "@/lib/user-details";
import { useToast } from "@/components/toast";
import { WEB_URL } from "@/lib/plan";
import { reportIfNetwork } from "@/lib/net-alert";
import { timed } from "@/lib/network";
import { logEvent } from "@/lib/analytics";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * "Humein likho" — app ke andar se seedha contact form (item 19).
 *
 * Pehle app me sirf Help page tha jo padhne ki cheez thi; kuch kehna ho to user
 * ke paas koi raasta hi nahi tha. Ab wahi form jo website par hai
 * (`/api/contact`) — message admin panel me aata hai aur email dono taraf
 * jaata hai.
 *
 * Naam aur email pehle se bhare aate hain (login se) — user ko sirf apni baat
 * likhni hai.
 */
export default function Contact() {
  const tc = useColors();
  const styles = useStyles();
  const t = useT();
  const c = t.contact;
  const toast = useToast();
  const { session } = useAuth();
  const { details } = useUserDetails();

  const meta = session?.user?.user_metadata;
  const [name, setName] = useState<string>(
    details?.full_name || meta?.full_name || meta?.name || "",
  );
  const [email, setEmail] = useState<string>(session?.user?.email ?? "");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const canSend = message.trim().length >= 2 && EMAIL_RE.test(email.trim());

  async function send() {
    if (sending) return;
    if (!EMAIL_RE.test(email.trim())) return toast.show(c.needEmail, "info");
    if (message.trim().length < 2) return toast.show(c.needMessage, "info");

    setSending(true);
    try {
      const res = await timed(
        fetch(`${WEB_URL}/api/contact`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            // Naam khaali ho to bhi server ko kuch chahiye — email hi bhej do.
            name: name.trim() || email.trim(),
            email: email.trim(),
            message: message.trim(),
          }),
        }),
      );
      if (!res.ok) throw new Error(`contact failed: ${res.status}`);
      logEvent("contact_sent");
      setSent(true);
    } catch (e) {
      // Net ki dikkat ho to poore app wala popup + "dobara koshish karo".
      if (!reportIfNetwork(e, "save", send)) toast.show(c.failed, "error");
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back}>
          <Ionicons name="chevron-back" size={22} color={tc.ink} />
        </Pressable>
        <Text style={styles.title}>{c.title}</Text>
        <View style={{ width: 30 }} />
      </View>

      {sent ? (
        <View style={styles.doneWrap}>
          <View style={styles.doneIcon}>
            <Ionicons name="checkmark" size={34} color={tc.white} />
          </View>
          <Text style={styles.doneTitle}>{c.sentTitle}</Text>
          <Text style={styles.doneBody}>{c.sentBody}</Text>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.send, pressed && { opacity: 0.9 }]}
          >
            <Text style={styles.sendText}>{t.common.done}</Text>
          </Pressable>
        </View>
      ) : (
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.sub}>{c.sub}</Text>

            <Text style={styles.label}>{c.nameLabel}</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder={c.namePlaceholder}
              placeholderTextColor={tc.inkSoft}
              style={styles.input}
            />

            <Text style={styles.label}>{c.emailLabel}</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder={c.emailPlaceholder}
              placeholderTextColor={tc.inkSoft}
              style={styles.input}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <Text style={styles.label}>{c.messageLabel}</Text>
            <TextInput
              value={message}
              onChangeText={setMessage}
              placeholder={c.messagePlaceholder}
              placeholderTextColor={tc.inkSoft}
              style={[styles.input, styles.textarea]}
              multiline
              textAlignVertical="top"
            />

            <View style={{ height: 20 }} />
          </ScrollView>

          <Pressable
            onPress={send}
            disabled={sending || !canSend}
            style={({ pressed }) => [
              styles.send,
              styles.sendFooter,
              (pressed || sending || !canSend) && { opacity: 0.55 },
            ]}
          >
            <Ionicons name="paper-plane" size={17} color={tc.white} />
            <Text style={styles.sendText}>{sending ? c.sending : c.send}</Text>
          </Pressable>
        </KeyboardAvoidingView>
      )}

      <LoaderOverlay visible={sending} />
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...CONTENT,
  },
  back: { padding: 4 },
  title: { fontSize: 18, fontWeight: "700", color: c.ink },
  content: { padding: 20, ...CONTENT },
  sub: { fontSize: 14.5, lineHeight: 21, color: c.inkSoft },
  label: {
    marginTop: 20,
    marginBottom: 8,
    fontSize: 13.5,
    fontWeight: "700",
    color: c.ink,
  },
  input: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: c.ink,
    fontSize: 15,
  },
  textarea: { minHeight: 140 },
  send: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 54,
    borderRadius: 18,
    backgroundColor: c.terracotta,
  },
  sendFooter: { margin: 20, marginTop: 8, ...CONTENT },
  sendText: { color: c.white, fontWeight: "800", fontSize: 16 },
  doneWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 10,
    ...CONTENT,
  },
  doneIcon: {
    height: 76,
    width: 76,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.sage,
    marginBottom: 6,
  },
  doneTitle: { fontSize: 22, fontWeight: "800", color: c.ink },
  doneBody: {
    fontSize: 15,
    lineHeight: 22,
    color: c.inkSoft,
    textAlign: "center",
    maxWidth: 300,
    marginBottom: 18,
  },
}));
