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
 * ── Button kaise chalta hai (item 3) ─────────────────────────────────────
 *
 * Do tareeke, aur dono ek hi button par:
 *
 *   • **Dabaye rakho, bolo, chhod do** (hold-to-talk) — WhatsApp ke voice note
 *     jaisa. Sabse swabhavik tareeka, aur log yahi pehle try karte hain.
 *   • **Ek tap** — mic chalu, bolo, phir tap se band. Un logon ke liye jinko
 *     lambi baat karni hai aur phone haath me pakad ke rakhna mushkil hai.
 *
 * ⚠️ Pehle sirf DOOSRA tareeka tha, aur wo dikhta bhi nahi tha. Button `onPress`
 * par chalta tha, yaani "dabao aur chhodo" ke BAAD. Jo user dabaye rakhta tha
 * (aur log yahi karte hain) uske liye mic uske chhodne ke baad shuru hota tha —
 * yaani wo poori baat mic chalu hone se PEHLE bol chuka hota tha, aur screen par
 * kuch nahi aata tha. Uske baad mic chup kamre me chalti rehti aur "kuch samajh
 * nahi aaya" de deti. Bilkul wahi shikayat: "click karke rakhne ka nahi aata".
 *
 * Ab pehchaan `onPressIn`/`onPressOut` se hoti hai:
 *   – Ungli lagte hi mic shuru (intezaar khatam).
 *   – `HOLD_MS` se pehle chhoda → wo TAP tha; mic chalu rehti hai, dobara tap se
 *     band. (Chhoti si dabaav par mic turant band karna sabse bura hota: user ne
 *     dabaya hi tha bolne ke liye.)
 *   – `HOLD_MS` se zyada dabaye rakha → hold tha; chhodte hi band.
 *
 * ── Shor bhare kamre me pehchaan (item 16) ──────────────────────────────
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

/**
 * Itni der se lamba dabaav "hold" maana jaata hai.
 *
 * 350ms jaan-boojh ke: normal tap 80-150ms ka hota hai, aur bujurg haath ka tap
 * 250ms tak chala jaata hai. Isse kam rakhte to unka tap "hold" gina jaata aur
 * mic bolne se pehle hi band ho jaata — jo is button ki sabse buri haalat hai.
 */
const HOLD_MS = 350;

/**
 * Abhi kis button ki mic chal rahi hai.
 *
 * ⚠️ Ye module-level hona ZAROORI hai, aur iske bina do saaf bug the. Add-reminder
 * screen par DO VoiceButton hote hain (ek upar wale box ka, ek "Kya" slot ka), aur
 * `useSpeechRecognitionEvent` ek GLOBAL listener lagata hai — har event har mounted
 * button ko milta hai. Natija:
 *
 *   • Ek mic dabao aur bolo → transcript DONO fields me chala jaata tha. Title me
 *     bhi, subject me bhi. User ko lagta tha app ne uski baat do jagah likh di.
 *   • "kuch samajh nahi aaya" wala toast do baar aata tha (dono buttons se).
 *
 * Aur unmount par bhi wahi baat: pehle `abort()` bina poochhe chalta tha, to jaise
 * hi doosra button mount/unmount hota (`started` badalne par ye hota hai), pehle
 * button ki chalti hui mic beech me kat jaati thi.
 *
 * Isliye ab har event se pehle ek sawaal: ye session mera hai?
 */
let activeOwner: number | null = null;
let ownerSeq = 0;

/**
 * Har mounted button ka "apna sab kuch shaant kar do" wala haath.
 *
 * ⚠️ Iske bina ek saaf bug reh jaata tha: doosra mic dabate hi hum pehle wale ka
 * session `abort()` kar dete hain, par uske `end`/`error` event ab `isMine()` par
 * ruk jaate hain (kyunki maalik badal chuka hai) — yaani uska `listening` kabhi
 * false hota hi nahi. Screen par wo mic HAMESHA ke liye laal/active pada rehta,
 * jabki wo kuch sun hi nahi raha. Isliye maalik badalne se pehle purane maalik ko
 * seedha khabar karte hain.
 */
const ownerReset = new Map<number, () => void>();

export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const toast = useToast();
  const { voice: v } = useT();
  const [listening, setListening] = useState(false);
  const pulse = useRef(new Animated.Value(1)).current;
  /** Awaaz ka live level (0-1) — ring isse phailti hai. */
  const level = useRef(new Animated.Value(0)).current;

  /** Is button ki apni pehchaan — global events me "mera kaun sa hai" ke liye. */
  const meRef = useRef(0);
  if (meRef.current === 0) {
    ownerSeq += 1;
    meRef.current = ownerSeq;
  }
  const isMine = () => activeOwner === meRef.current;

  /** Ungli kab lagi. 0 = abhi dabaya hua nahi hai. */
  const pressedAt = useRef(0);
  /**
   * User is waqt kya chaahta hai.
   *
   *   "none" — kuch nahi, mic band honi chahiye
   *   "hold" — ungli lagi hui hai; uthte hi band
   *   "tap"  — ek tap se chalu hua tha; agle tap tak chalta rahe
   *
   * ⚠️ Pehle ye do alag ref the ("ungli lagi hai?" aur "tap-mode hai?") aur wo
   * ek doosre se jhagad sakte the: permission ka popup khulne ke beech me ungli
   * uth jaati, ek ref badal jaata, doosra nahi — aur mic ek aisi haalat me chali
   * jaati jahan button idle dikhta par recognizer chal raha hota. Ek hi ref me
   * poora iraada rakhne se wo soorat ban hi nahi sakti.
   */
  const intent = useRef<"none" | "hold" | "tap">("none");

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
    if (!isMine() || !e.isFinal) return;
    const best = e.results?.[0]?.transcript?.trim();
    if (best) {
      gotResult.current = true;
      onText(best);
    }
  });
  useSpeechRecognitionEvent("end", () => {
    if (!isMine()) return;
    // Kuch mila hi nahi — tabhi kuch kehna hai. Mil gaya to chup rehna behtar.
    if (!gotResult.current) hintForSilence();
    release();
  });
  useSpeechRecognitionEvent("error", (e) => {
    if (!isMine()) return;
    const err = e?.error;
    // "no-speech" ka apna, zyada kaam ka message neeche banta hai.
    if (err && err !== "no-speech") toast.show(v.unclear, "info");
    else if (!gotResult.current) hintForSilence();
    release();
  });
  // Shor me ye bahut madad karta hai: user ko dikhta hai ki uski awaaz pahunch
  // rahi hai. Warna wo baar-baar button dabata hai aur session toot jaata hai.
  useSpeechRecognitionEvent("volumechange", (e) => {
    if (!isMine()) return;
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

  /** UI ko "sun raha hoon" wali haalat me le jao. */
  function beginUi() {
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

  /** Session khatam — UI shaant, aur mic ka haq chhod do. */
  function release() {
    if (isMine()) activeOwner = null;
    intent.current = "none";
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
   *
   * ⚠️ Aur `isMine()` ki shart zaroori hai. Pehle ye bina poochhe chalta tha, to
   * jab add-reminder par doosra VoiceButton unmount hota (`started` badalne par),
   * pehle button ki CHALTI HUI mic beech me kat jaati thi.
   */
  useEffect(() => {
    const me = meRef.current;
    // Maalik badalne par purana button apna UI shaant kar sake — registry me
    // apna haath rakh do.
    ownerReset.set(me, release);
    return () => {
      ownerReset.delete(me);
      if (activeOwner !== me) return;
      activeOwner = null;
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        /* kuch chal hi nahi raha tha — theek hai */
      }
    };
    // `release` har render par naya banta hai par kaam wahi karta hai (sab kuch
    // ref/setState par chalta hai), isliye ise dep me daalne ki zaroorat nahi —
    // aur daalne se ye effect har render par chalta, jo mount/unmount ke matlab
    // ko hi tod deta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Mic chalu karo. Permission na mile to kuch nahi hota. */
  async function startListening() {
    /**
     * Doosre button ki mic pehle band karo.
     *
     * Ek waqt me ek hi recognizer chal sakta hai (OS ki rok hai). Pehle ye check
     * hi nahi tha: doosra mic dabane par native call chup-chaap fail ho jaati aur
     * user ko lagta "voice kaam nahi kar raha".
     */
    if (activeOwner !== null && activeOwner !== meRef.current) {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        /* kuch chal hi nahi raha tha */
      }
      // Purane maalik ka UI bhi shaant karo — uske event ab is naye maalik ke
      // saamne ruk jaayenge, isliye wo khud kabhi shaant nahi hoga.
      ownerReset.get(activeOwner)?.();
      activeOwner = null;
    }

    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        toast.show(v.micPermission, "info");
        return;
      }
      // Permission ka popup khula tha aur us beech iraada khatam ho gaya (user ne
      // ungli hata li ya doosri jagah tap kar diya) — ab mic chalu karna bekaar
      // hai, aur wo chup kamre me chalti rehti.
      if (intent.current === "none") return;

      activeOwner = meRef.current;
      beginUi();
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
      release();
      toast.show(v.unavailable, "error");
    }
  }

  /** Mic band karo, par aakhri transcript aane do (abort nahi — stop). */
  function stopListening() {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      release();
    }
  }

  /**
   * Ungli lagi.
   *
   * Yahi wo badlaav hai jiske bina "dabaye rakh ke bolna" kaam nahi karta tha:
   * pehle sab kuch `onPress` par hota tha, yaani ungli UTHNE ke baad.
   */
  function onPressIn() {
    pressedAt.current = Date.now();

    // Pehle se sun raha hai — ye doosra press band karne ka ishaara ho sakta hai.
    // Faisla `onPressOut` par hota hai, taaki galti se lagi chhoti si dabaav
    // bolte-bolte mic na kaat de.
    if (listening) return;

    // Shuru me hamesha "hold" maante hain. Wajah: tap ka pata sirf ungli uthne ke
    // BAAD chalta hai, aur tab tak mic chalu ho jaani chahiye — warna user ki
    // pehli do-teen shabd nikal jaate hain.
    intent.current = "hold";
    void startListening();
  }

  /** Ungli uthi — tap tha ya hold, isse tay hota hai. */
  function onPressOut() {
    const held = pressedAt.current ? Date.now() - pressedAt.current : 0;
    pressedAt.current = 0;

    // Lamba dabaav = hold-to-talk. Chhodte hi baat khatam.
    if (held >= HOLD_MS) {
      intent.current = "none";
      if (listening) stopListening();
      return;
    }

    // Chhota tap, aur pehle bhi tap se hi chalu hua tha → ye band karne wala tap.
    if (intent.current === "tap") {
      intent.current = "none";
      stopListening();
      return;
    }

    // Warna: ye chalu karne wala tap tha — mic chalti rehne do, agle tap tak.
    intent.current = "tap";
  }

  return (
    <Animated.View style={{ transform: [{ scale: pulse }] }}>
      <Pressable
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        // Dabaye rakhne par Android/iOS ka apna long-press "ripple" beech me aa
        // jaata hai aur `onPressOut` late milta hai. `delayLongPress` bada rakh
        // ke wo raasta band kar dete hain — is button par long-press ka koi alag
        // matlab nahi hai, hold khud hi asli kaam hai.
        delayLongPress={10_000}
        style={[styles.btn, listening && styles.btnActive]}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel={v.micHint}
        accessibilityState={{ busy: listening }}
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
