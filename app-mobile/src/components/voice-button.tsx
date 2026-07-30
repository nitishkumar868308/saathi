import { useState, useRef } from "react";
import { Platform, Pressable, Animated, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

import { colors } from "@/theme/colors";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * Bolo — Saathi likh lega.
 *
 * Shor bhare kamre me pehchaan sudharne ke liye teen cheezein (item 16):
 *
 *  1. **Biasing words** — recognizer ko pehle hi bata dete hain ki yahan kis
 *     tarah ke shabd aane wale hain ("reminder", "subah", "baje", "dawai"…).
 *     Isse "baje" ko "badge" aur "dawai" ko "the way" sunne wali galtiyan
 *     bahut kam ho jaati hain.
 *
 *  2. **Chup rehne ka sabra** — Android ko kehte hain ki 2 second ki chuppi ke
 *     baad hi maano ki baat khatam hui. Pehle default ~1s tha, isliye beech me
 *     saans lete hi recognizer band ho jaata tha aur aadha wakya jaata tha.
 *
 *  3. **Kai vikalp, sabse achha chuno** — recognizer ek nahi, kai guess deta
 *     hai. `pickBest` (jo screen deti hai) unme se wo chunta hai jo sach me
 *     kaam ka ho. Reminder screen isse wo wakya chunti hai jisme time/date
 *     samajh aa raha ho.
 *
 * Aur bolte waqt awaaz ka level ring me dikhta hai — user ko pata rehta hai ki
 * mic sun raha hai, chup nahi baitha.
 */

/** Reminder/document bolte waqt aksar aane wale shabd — recognizer ko hint. */
const BIAS_WORDS = [
  "reminder",
  "yaad",
  "dila",
  "subah",
  "dopahar",
  "shaam",
  "raat",
  "baje",
  "minute",
  "ghante",
  "kal",
  "parso",
  "aaj",
  "tarikh",
  "dawai",
  "medicine",
  "bill",
  "insurance",
  "passport",
  "licence",
  "document",
  "expiry",
  "birthday",
  "meeting",
  "call",
];

export function VoiceButton({
  onText,
  /**
   * Recognizer ke kai guess me se sabse kaam ka chuno. Na do to pehla hi
   * chalta hai (recognizer ka apna confidence order).
   */
  pickBest,
}: {
  onText: (text: string) => void;
  pickBest?: (options: string[]) => string;
}) {
  const toast = useToast();
  const { voice: v } = useT();
  const [listening, setListening] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  /** Awaaz ka live level (0-1) — ring isse phailti hai. */
  const level = useRef(new Animated.Value(0)).current;

  // ⚠️ Pehle har interim result pe onText call hota tha, aur onText text ko
  // APPEND karta hai — isliye bolte waqt "call call mummy call mummy ko" jaisa
  // garble ho jaata tha. Ab sirf FINAL transcript ek baar emit karte hain.
  useSpeechRecognitionEvent("result", (e) => {
    if (!e.isFinal) return;
    const options = (e.results ?? [])
      .map((r) => r?.transcript?.trim())
      .filter((t): t is string => !!t);
    if (options.length === 0) return;
    const best = pickBest ? pickBest(options) : options[0];
    if (best) onText(best);
  });
  useSpeechRecognitionEvent("end", () => stop());
  useSpeechRecognitionEvent("error", (e) => {
    stop();
    if (e?.error && e.error !== "no-speech") {
      toast.show(v.unclear, "info");
    }
  });
  // Shor me ye bahut madad karta hai: user ko dikhta hai ki uski awaaz pahunch
  // rahi hai. Warna wo baar-baar button dabata hai aur session toot jaata hai.
  useSpeechRecognitionEvent("volumechange", (e) => {
    // -2..10 ko 0..1 me. 0 se neeche ko chuppi maante hain.
    const norm = Math.max(0, Math.min(1, (e.value ?? 0) / 8));
    level.setValue(norm);
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
    level.setValue(0);
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
        // Kai guess maango — `pickBest` inme se sahi wala chun leta hai.
        maxAlternatives: 5,
        contextualStrings: BIAS_WORDS,
        addsPunctuation: false,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 150 },
        // iOS ka apna noise/echo suppression — mic par extra signal processing.
        iosVoiceProcessingEnabled: true,
        ...(Platform.OS === "android"
          ? {
              androidIntentOptions: {
                // Beech me saans lene par session band na ho — 2s chuppi ke baad
                // hi "baat khatam" maano. Default (~1s) bahut jaldi kaat deta tha.
                EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2000,
                EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 1600,
                // Itni der to suno hi — chhoti si "hmm" par band mat ho jao.
                EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 2000,
                // Gaali-mask se "***" aa jaata tha — reminder text me bekaar.
                EXTRA_MASK_OFFENSIVE_WORDS: false,
              },
            }
          : {}),
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
        {/* Awaaz ka level — sunte waqt andar se ek naram ring phailti hai. */}
        {listening && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.level,
              {
                opacity: level.interpolate({ inputRange: [0, 1], outputRange: [0.15, 0.5] }),
                transform: [
                  { scale: level.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.5] }) },
                ],
              },
            ]}
          />
        )}
        <View>
          <Ionicons
            name={listening ? "mic" : "mic-outline"}
            size={20}
            color={listening ? colors.white : colors.terracotta}
          />
        </View>
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
    overflow: "hidden",
  },
  btnActive: { backgroundColor: colors.terracotta, borderColor: colors.terracotta },
  level: {
    position: "absolute",
    height: 46,
    width: 46,
    borderRadius: 23,
    backgroundColor: colors.white,
  },
});
