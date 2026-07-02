import { useState, useRef } from "react";
import { Pressable, Animated, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

import { colors } from "@/theme/colors";
import { useToast } from "@/components/toast";

export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const toast = useToast();
  const [listening, setListening] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;

  useSpeechRecognitionEvent("result", (e) => {
    const t = e.results?.[0]?.transcript;
    if (t) onText(t);
  });
  useSpeechRecognitionEvent("end", () => stop());
  useSpeechRecognitionEvent("error", () => stop());

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
        toast.show("Mic permission chahiye", "info");
        return;
      }
      start();
      ExpoSpeechRecognitionModule.start({
        lang: "en-IN",
        interimResults: true,
        continuous: false,
      });
    } catch {
      stop();
      toast.show("Voice available nahi hai is device pe", "error");
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
