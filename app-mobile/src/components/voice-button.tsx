import { useState, useRef, useEffect } from "react";
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
 * Aur bolte waqt awaaz ka level ring me dikhta hai — user ko pata rehta hai ki
 * mic sun raha hai, chup nahi baitha.
 *
 * ⚠️ Pehle yahan ek teesri cheez bhi thi: recognizer se 5 guess mangwa ke ek
 * `pickBest` callback unme se "sabse kaam ka" wakya chunta tha (screen us guess
 * ko chunti thi jisme local parser ko time/date dikh jaye). Wo hata diya gaya —
 * wo bhi ek tarah ki local parsing hi thi, aur ab reminder samajhna poori tarah
 * AI ka kaam hai. Recognizer ka apna pehla (sabse confident) guess seedha AI ko
 * jaata hai; AI kam saaf wakya bhi theek samajh leta hai, aur na samajhe to
 * khud poochh leta hai.
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

export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const toast = useToast();
  const { voice: v } = useT();
  const [listening, setListening] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  /** Awaaz ka live level (0-1) — ring isse phailti hai. */
  const level = useRef(new Animated.Value(0)).current;

  /**
   * Is session me awaaz kitni tez aayi — sabse oonchi aur kitni baar aayi.
   *
   * Ye sirf ginti ke liye nahi hai. Jab kuch samajh nahi aata to user ko wajah
   * batani hoti hai, aur wajah hamesha ek nahi hoti: kabhi wo bahut door se
   * bola (awaaz aayi hi nahi), kabhi aas-paas itna shor tha ki uski awaaz usme
   * dab gayi. Dono ka ilaaj alag hai, aur ek hi "samajh nahi aaya" dono par
   * bekaar lagta hai.
   */
  const peak = useRef(0);
  const loudTicks = useRef(0);
  const gotResult = useRef(false);

  // ⚠️ Pehle har interim result pe onText call hota tha, aur onText text ko
  // APPEND karta hai — isliye bolte waqt "call call mummy call mummy ko" jaisa
  // garble ho jaata tha. Ab sirf FINAL transcript ek baar emit karte hain.
  useSpeechRecognitionEvent("result", (e) => {
    if (!e.isFinal) return;
    const best = e.results?.[0]?.transcript?.trim();
    if (best) {
      gotResult.current = true;
      onText(best);
    }
  });
  useSpeechRecognitionEvent("end", () => {
    // Kuch mila hi nahi — tabhi kuch kehna hai. Mil gaya to chup rehna behtar.
    if (!gotResult.current) hintForSilence();
    stop();
  });
  useSpeechRecognitionEvent("error", (e) => {
    const err = e?.error;
    // "no-speech" ka apna, zyada kaam ka message neeche banta hai.
    if (err && err !== "no-speech") toast.show(v.unclear, "info");
    else if (!gotResult.current) hintForSilence();
    stop();
  });
  // Shor me ye bahut madad karta hai: user ko dikhta hai ki uski awaaz pahunch
  // rahi hai. Warna wo baar-baar button dabata hai aur session toot jaata hai.
  useSpeechRecognitionEvent("volumechange", (e) => {
    // -2..10 ko 0..1 me. 0 se neeche ko chuppi maante hain.
    const norm = Math.max(0, Math.min(1, (e.value ?? 0) / 8));
    level.setValue(norm);
    if (norm > peak.current) peak.current = norm;
    // Lagatar tez awaaz par ye ginti chadhti hai — bolne me itni der tak level
    // ooncha nahi rehta, par kamre ke shor me rehta hai.
    if (norm > 0.45) loudTicks.current += 1;
  });

  /**
   * Kuch samajh nahi aaya — wajah ke hisaab se alag baat kaho.
   *
   * ⚠️ Pehle yahan kuch bhi nahi hota tha: `no-speech` chup-chaap nigal liya
   * jaata tha. User bolta, kuch nahi hota, aur use lagta ki mic hi kharab hai.
   * Wo shor bhare kamre me sabse aam anubhav tha.
   */
  function hintForSilence() {
    // volumechange har 150ms par aata hai; ~1.5 second se zyada tez awaaz =
    // kamre ka shor, user ki baat nahi.
    if (loudTicks.current > 10) toast.show(v.tooNoisy, "info");
    else if (peak.current < 0.12) toast.show(v.tooQuiet, "info");
    else toast.show(v.unclear, "info");
  }

  function start() {
    setListening(true);
    peak.current = 0;
    loudTicks.current = 0;
    gotResult.current = false;
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

  /**
   * Screen band ho gayi par mic abhi bhi sun raha tha.
   *
   * ⚠️ Add-reminder aur add-document dono modal screens hain. User mic dabata
   * tha aur bina bole hi screen band kar deta tha — recognizer chalta rehta tha,
   * mic phone ke paas reserve pada rehta tha (kuch phone par upar mic ka nishaan
   * bhi dikhta rehta hai), aur wo tabhi chhutta tha jab timeout hota. Us beech
   * doosri screen par mic dabane par kuch hota hi nahi tha, aur user ko lagta
   * tha "voice kaam nahi kar raha".
   *
   * `abort()` (stop nahi) isliye: stop aakhri transcript emit karta hai, jo ab
   * ek band ho chuki screen me jaata — bekaar bhi hai aur uljhan wala bhi.
   */
  useEffect(() => {
    return () => {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        /* kuch chal hi nahi raha tha — theek hai */
      }
    };
  }, []);

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
        // Ek hi guess chahiye — recognizer ka sabse confident wala. (Pehle 5
        // mangwate the taaki `pickBest` unme se chun sake; wo hat chuka hai.)
        maxAlternatives: 1,
        contextualStrings: BIAS_WORDS,
        addsPunctuation: false,
        volumeChangeEventOptions: { enabled: true, intervalMillis: 150 },
        // iOS ka apna noise/echo suppression — mic par extra signal processing.
        iosVoiceProcessingEnabled: true,
        // `voiceChat` mode iOS ko batata hai ki ye insaan ki baat hai, gaana
        // nahi: system tonal equalization aur noise reduction aawaz ke hisaab
        // se laga deta hai. Default mode me wo nahi hota.
        iosCategory: {
          category: "playAndRecord",
          categoryOptions: ["defaultToSpeaker", "allowBluetooth"],
          mode: "voiceChat",
        },
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
                // ⚠️ Ye teen shor bhare kamre ke liye hain:
                //
                // free_form — poore wakya ke liye bana model. Kuch OEM default
                //   me web_search rakhte hain, jo chhote search-jaise tukdon ke
                //   liye hai: "kal subah aath baje dawai" ko wo tod-marod deta
                //   hai. Reminder hamesha ek wakya hota hai.
                EXTRA_LANGUAGE_MODEL: "free_form",
                // Online model chahiye. On-device model chhota hota hai aur shor
                // me sabse pehle wahi haar jaata hai; Android kabhi-kabhi bina
                // poochhe usi par chala jaata hai.
                EXTRA_PREFER_OFFLINE: false,
                // Phone ke apne sandarbh (contacts jaise naam) se pehchaan
                // sudhrti hai — "Mummy ko call" jaisi lines me saaf farq padta
                // hai. Android 13+ par hi asar karta hai, purane par anadekha.
                EXTRA_ENABLE_BIASING_DEVICE_CONTEXT: true,
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
