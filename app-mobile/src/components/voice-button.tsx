import { useState, useRef } from "react";
import { Pressable, Animated, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

import { colors } from "@/theme/colors";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n/LanguageProvider";

export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const toast = useToast();
  const { voice: v } = useT();
  const [listening, setListening] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  // ⚠️ Pehle har interim result pe onText call hota tha, aur onText text ko
  // APPEND karta hai — isliye bolte waqt "call call mummy call mummy ko" jaisa
  // garble ho jaata tha. Ab sirf FINAL transcript ek baar emit karte hain.
  useSpeechRecognitionEvent("result", (e) => {
    if (!e.isFinal) return;
    const t = e.results?.[0]?.transcript?.trim();
    if (t) onText(t);
  });
  useSpeechRecognitionEvent("end", () => stop());
  useSpeechRecognitionEvent("error", (e) => {
    stop();
    if (e?.error && e.error !== "no-speech") {
      toast.show(v.unclear, "info");
    }
  });

  function start() {
    setListening(true);
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.18, duration: 500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
    ).start();
  }

  function stop() {
    setListening(false);
    pulse.stopAnimation();
    pulse.setValue(1);
  }

  async function toggle() {
    if (listening) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        toast.show(v.micPermission, "info");
        return;
      }
      start();
      ExpoSpeechRecognitionModule.start({
        lang: v.recogLang,
        interimResults: false, // sirf final chahiye (append-garble se bachne ke liye)
        continuous: false,
      });
    } catch {
      stop();
      toast.show(v.unavailable, "error");
    }
  }

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <Pressable
        onPress={toggle}
        style={[styles.btn, listening && styles.btnActive]}
        hitSlop={6}
      >
        <Ionicons
          name={listening ? "mic" : "mic-outline"}
          size={20}
          color={listening ? colors.white : colors.terracotta}
        />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  btn: {
    height: 48,
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.terracotta,
    backgroundColor: colors.surface,
  },
  btnActive: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
});
