import { useState } from "react";
import { View, Text, TextInput, Pressable } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { makeStyles, useColors } from "@/theme/theme";
import SaathiLogo from "@/components/saathi-logo";
import { useT } from "@/lib/i18n/LanguageProvider";

const pointIcons = ["documents-outline", "sunny-outline", "lock-closed-outline"];

export default function Onboarding() {
  const tc = useColors();
  const styles = useStyles();
  const router = useRouter();
  const { onboarding: o } = useT();
  const [name, setName] = useState("");
  const points = o.points.map((text, i) => ({ icon: pointIcons[i], text }));

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.content}>
        <View style={styles.logo}>
          <SaathiLogo size={76} radius={26} />
        </View>

        <Text style={styles.title}>{o.title} 🙂</Text>
        <Text style={styles.sub}>{o.sub}</Text>

        <View style={styles.points}>
          {points.map((p) => (
            <View key={p.text} style={styles.point}>
              <View style={styles.pIcon}>
                <Ionicons name={p.icon as any} size={18} color={tc.terracotta} />
              </View>
              <Text style={styles.pText}>{p.text}</Text>
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }} />

        <Text style={styles.label}>{o.nameLabel}</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder={o.namePlaceholder}
          placeholderTextColor={tc.inkSoft}
          style={styles.input}
        />

        <Pressable
          onPress={() => router.replace("/")}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.85 }]}
        >
          <Text style={styles.btnText}>{o.start}</Text>
          <Ionicons name="arrow-forward" size={18} color={tc.white} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  content: { flex: 1, padding: 28, paddingTop: 40, ...CONTENT },
  logo: {
    height: 76,
    width: 76,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 26,
    backgroundColor: c.terracotta,
  },
  title: {
    marginTop: 24,
    fontSize: 38,
    fontWeight: "800",
    color: c.ink,
    lineHeight: 44,
  },
  sub: { marginTop: 12, fontSize: 16, lineHeight: 24, color: c.inkSoft },
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
  pText: { flex: 1, fontSize: 15, color: c.ink },
  label: { fontSize: 15, fontWeight: "700", color: c.ink, marginBottom: 10 },
  input: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
    paddingHorizontal: 18,
    paddingVertical: 15,
    color: c.ink,
    fontSize: 16,
  },
  btn: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 18,
    backgroundColor: c.terracotta,
    paddingVertical: 16,
  },
  btnText: { color: c.white, fontWeight: "700", fontSize: 16 },
}));
