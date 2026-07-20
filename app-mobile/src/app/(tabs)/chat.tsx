import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/theme/colors";
import SaathiMark from "@/components/saathi-mark";
import { VoiceButton } from "@/components/voice-button";
import { UpgradeBanner } from "@/components/upgrade-banner";
import { useUserName } from "@/components/auth-provider";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";

type Msg = { id: string; role: "user" | "saathi"; text: string };

export default function Chat() {
  const name = useUserName();
  const { chat: ch } = useT();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>(() => [
    {
      id: "1",
      role: "saathi",
      text: tpl(ch.greeting, { name: name ? " " + name : "" }),
    },
  ]);
  const scrollRef = useRef<ScrollView>(null);

  function sendText(text: string) {
    const t = text.trim();
    if (!t) return;

    // Abhi Saathi bahar ke sawaal nahi leta aur na hi koi AI hit hota hai —
    // sirf ek fixed, pyaara jawab jo user ko documents/reminders ki taraf le
    // jaata hai. Smart chat jald aa raha hai.
    setMessages((m) => [
      ...m,
      { id: String(m.length + 1), role: "user", text: t },
      { id: String(m.length + 2), role: "saathi", text: ch.stubReply },
    ]);
    setInput("");
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      {/* header */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <SaathiMark size={22} color={colors.white} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Saathi</Text>
          <View style={styles.onlineRow}>
            <View style={styles.dot} />
            <Text style={styles.headerSub}>{ch.online}</Text>
          </View>
        </View>
      </View>

      <UpgradeBanner compact />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.map((m) =>
            m.role === "saathi" ? (
              <View key={m.id} style={styles.saathiRow}>
                <View style={styles.miniAvatar}>
                  <SaathiMark size={15} color={colors.white} />
                </View>
                <View style={styles.saathiBubble}>
                  <Text style={styles.saathiText}>{m.text}</Text>
                </View>
              </View>
            ) : (
              <View key={m.id} style={styles.userBubble}>
                <Text style={styles.userText}>{m.text}</Text>
              </View>
            ),
          )}
        </ScrollView>

        {/* suggestions */}
        <ScrollView
          horizontal
          style={styles.chipsScroll}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          {ch.suggestions.map((s) => (
            <Pressable key={s} onPress={() => sendText(s)} style={styles.chip}>
              <Text style={styles.chipText}>{s}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* input */}
        <View style={styles.inputBar}>
          <VoiceButton onText={(t) => setInput((prev) => (prev ? prev + " " + t : t))} />
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={ch.inputPlaceholder}
            placeholderTextColor={colors.inkSoft}
            style={styles.input}
            onSubmitEditing={() => sendText(input)}
            returnKeyType="send"
            multiline
          />
          <Pressable
            onPress={() => sendText(input)}
            style={({ pressed }) => [
              styles.sendBtn,
              pressed && { opacity: 0.85 },
            ]}
          >
            <Ionicons name="arrow-up" size={20} color={colors.white} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  avatar: {
    height: 42,
    width: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    backgroundColor: colors.terracotta,
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: colors.ink },
  onlineRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 1 },
  dot: { height: 7, width: 7, borderRadius: 4, backgroundColor: colors.sage },
  headerSub: { fontSize: 12.5, color: colors.sage, fontWeight: "500" },
  list: { padding: 16, gap: 14, paddingBottom: 8 },
  saathiRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, maxWidth: "88%" },
  miniAvatar: {
    height: 26,
    width: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: colors.terracotta,
    marginBottom: 2,
  },
  saathiBubble: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    borderBottomLeftRadius: 6,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  saathiText: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    backgroundColor: colors.terracotta,
    borderRadius: 20,
    borderBottomRightRadius: 6,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  userText: { color: colors.white, fontSize: 15, lineHeight: 22 },
  chipsScroll: { flexGrow: 0, maxHeight: 56 },
  chips: { paddingHorizontal: 12, paddingVertical: 10, gap: 8, alignItems: "center" },
  chip: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginRight: 8,
  },
  chipText: { fontSize: 13, color: colors.ink, fontWeight: "500" },
  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 48,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cream,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 15,
  },
  sendBtn: {
    height: 48,
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: colors.terracotta,
  },
});
