import { useState } from "react";
import { View, Text, TextInput, Pressable, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { makeStyles, useColors } from "@/theme/theme";
import SaathiLogo from "@/components/saathi-logo";
import { KeyboardView } from "@/components/keyboard-view";
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
      {/**
       * ⚠️ Naam ka input aur "Shuru karo" ka button screen ke sabse NEECHE hain
       * (upar `flex: 1` ka spacer unhe wahan dhakelta hai). Naam likhne ke liye
       * tap karte hi keyboard dono ko poori tarah dhak leta tha — yaani is
       * screen se aage badhne ka koi raasta hi nahi bachta tha.
       *
       * `KeyboardView` dono platform par ek hi kaam karta hai; `KeyboardAvoidingView`
       * naye Android par chalta hi nahi (poori wajah `lib/use-keyboard.ts` par).
       */}
      {/**
       * ⚠️ ScrollView, seedha `View` nahi — chhoti screen par warna sabse neeche
       * ka hissa kat jaata hai.
       *
       * Is screen par gintee hui jagah lagbhag 670px maangti hai (76 ka logo,
       * 38px ka title jo Hindi me do line ho jaata hai, teen point, naam ka
       * khaana aur button). 320×568 wale phone par bachte hain ~548px, aur
       * 360×640 par ~616 — dono kam. Aur system ka font bada kiya ho (bada
       * text wali accessibility setting, jo hamare bahut se users ke liye
       * sabse zaroori setting hai) to har phone par kam pad jaate hain.
       *
       * `View` me RN ka koi bachaav nahi hai: bachche default me sikudte nahi
       * (`flexShrink: 0`), isliye "Shuru karo" ka button chup-chaap screen ke
       * neeche chala jaata — aur is screen se aage badhne ka koi raasta hi nahi
       * bachta. `flexGrow: 1` isliye ki badi screen par neeche wala spacer
       * pehle jaisa hi kaam karta rahe.
       */}
      <KeyboardView>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
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
        </ScrollView>
      </KeyboardView>
    </SafeAreaView>
  );
}

const CONTENT = { width: "100%", maxWidth: 560, alignSelf: "center" } as const;

const useStyles = makeStyles((c) => ({
  safe: { flex: 1, backgroundColor: c.cream },
  // `flexGrow` (na ki `flex`) — ScrollView ke contentContainer par `flex: 1`
  // uski height ko screen par baandh deta hai, yaani scroll hi khatam.
  content: { flexGrow: 1, padding: 28, paddingTop: 40, ...CONTENT },
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
