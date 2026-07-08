import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { colors } from "@/theme/colors";
import SaathiMark from "@/components/saathi-mark";

const points = [
  { icon: "documents-outline", text: "Documents ki expiry kabhi na bhoole" },
  { icon: "sunny-outline", text: "Har subah pyaara daily brief" },
  { icon: "lock-closed-outline", text: "100% private — sab aapke control mein" },
];

export default function Onboarding() {
  const router = useRouter();
  const [name, setName] = useState("");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.logo}>
          <SaathiMark size={40} color={colors.white} />
        </View>

        <Text style={styles.title}>Milo apne{"\n"}Saathi se 🙂</Text>
        <Text style={styles.sub}>
          Ek dost jo aapki life ka khayal rakhta hai — bina pooche.
        </Text>

        <View style={styles.points}>
          {points.map((p) => (
            <View key={p.text} style={styles.point}>
              <View style={styles.pIcon}>
                <Ionicons name={p.icon as any} size={18} color={colors.terracotta} />
              </View>
              <Text style={styles.pText}>{p.text}</Text>
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <Text style={styles.label}>Aap Saathi ko kya bulaoge?</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Saathi"
          placeholderTextColor={colors.inkSoft}
          style={styles.input}
        />

        <Pressable
          onPress={() => router.replace("/")}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.btnText}>Shuru karo</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.white} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.cream },
  content: { flex: 1, padding: 28, paddingTop: 40 },
  logo: {
    height: 76,
    width: 76,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: colors.terracotta,
  },
  title: {
    marginTop: 24,
    fontSize: 38,
    fontWeight: "800",
    color: colors.ink,
    lineHeight: 44,
  },
  sub: { marginTop: 12, fontSize: 16, lineHeight: 24, color: colors.inkSoft },
  points: { marginTop: 28, gap: 14 },
  point: { flexDirection: "row", alignItems: "center", gap: 12 },
  pIcon: {
    height: 40,
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    backgroundColor: "rgba(194,90,55,0.10)",
  },
  pText: { flex: 1, fontSize: 15, color: colors.ink },
  label: { fontSize: 15, fontWeight: "700", color: colors.ink, marginBottom: 10 },
  input: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    paddingHorizontal: 18,
    paddingVertical: 15,
    color: colors.ink,
    fontSize: 16,
  },
  btn: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 18,
    backgroundColor: colors.terracotta,
    paddingVertical: 16,
  },
  btnText: { color: colors.white, fontWeight: "700", fontSize: 16 },
});
