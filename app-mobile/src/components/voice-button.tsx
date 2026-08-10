import { useState, useRef, useEffect } from "react";
import { Platform, Pressable, Animated, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

import { makeStyles, useColors } from "@/theme/theme";
import { useToast } from "@/components/toast";
import { useT } from "@/lib/i18n/LanguageProvider";
import { reportError } from "@/lib/report-error";

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

/**
 * ── Kyun "voice bilkul kaam nahi kar raha" tha (aur ab kya badla) ────────
 *
 * Char alag-alag cheezein ek jaisi dikhti thi — har baar wahi "awaaz nahi
 * aayi" / "shor bahut hai" wala toast. Chaaron ki jad alag thi:
 *
 *  1. **Kai Android phone `isFinal: true` bhejte hi nahi.** Samsung/Xiaomi ke
 *     kai recognizer sirf partial (interim) result dete hain aur seedha `end`
 *     bhej dete hain. Hum `interimResults: false` maang rahe the aur sirf
 *     `isFinal` par likhte the — yaani un phones par transcript AATA THA par
 *     hum use girate the, aur har baar "kuch samajh nahi aaya" kehte the.
 *     Ab interim on hai, par SCREEN PAR nahi likha jaata — bas yaad rakha
 *     jaata hai, aur session khatam hone par final na mile to wahi likh dete
 *     hain. (Interim ko seedha likhne se hi wo purana "call call mummy call
 *     mummy ko" wala garble hota tha — wo wapas nahi aayega.)
 *
 *  2. **Do `start()` ek saath.** `onPressIn` ka `if (listening) return` React
 *     STATE padhta hai, jo `beginUi()` ke baad hi sach hota hai — aur
 *     `beginUi()` permission wale `await` ke baad chalta hai. Jaldi se do tap
 *     (bujurg haath me aam baat) par dono press "listening = false" dekhte the
 *     aur do `start()` chal padte the. Doosra `ERROR_RECOGNIZER_BUSY` deta tha,
 *     uska `release()` pehle session ka maalikana chheen leta tha, aur pehle
 *     wale ka transcript kahin gir jaata tha. Ab ek `starting` ref hai jo state
 *     ka intezaar nahi karta.
 *
 *  3. **Shor/chuppi ka andaza galat tha.** `loudTicks > 10` = 1.5 second tak
 *     tez awaaz. Normal bolne me hi 3 second me itna aaram se ho jaata hai —
 *     yaani user ki APNI awaaz ko "aas-paas shor bahut hai" bata dete the. Aur
 *     kai OEM `volumechange` bhejte hi nahi: tab `peak` hamesha 0 rehta tha,
 *     yaani har fail "awaaz nahi pahunchi" ban jaata tha — chahe user chillaya
 *     ho. Ab ye dono baatein sirf tab kahi jaati hain jab volume ke saboot
 *     sach me maujood hon; warna seedha "saaf nahi aaya".
 *
 *  4. **Har error ka ek hi message.** Permission, service band, bhasha na hona,
 *     net na hona, mic kisi aur app ke paas hona — sab "awaaz saaf nahi aayi"
 *     dikhate the. In sab ka ilaaj alag hai; ab message bhi alag hai.
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
 * `stop()` ke baad `end` ka intezaar itni der — uske baad hum khud sambhal
 * lenge.
 *
 * Recognizer ko final result banane me thoda waqt lagta hai (network wale
 * model par ~1-2s), isliye ye utna chhota nahi rakh sakte. 4 second me har
 * theek chalta hua recognizer jawab de deta hai; jo nahi deta, wo phansa hua
 * hai — aur wahan button ko hamesha ke liye laal chhod dena sabse bura hai.
 */
const END_GUARD_MS = 4000;

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

/**
 * Ek session itni jaldi mar jaye to wo "user chup tha" nahi hai.
 *
 * ⚠️ Ye number is file ke sabse zaroori sudhaar ka dil hai. Recognizer ko user
 * ki chuppi maanne me hi 2 second lagte hain (`COMPLETE_SILENCE_LENGTH`) —
 * yaani agar session 1.5 second se pehle hi khatam ho gaya aur na koi transcript
 * aaya na koi volume tick, to baat awaaz ki thi hi nahi. Wahan sach ye hota hai
 * ki recognizer ne humari di hui KOI OPTION nahi maani, ya wo recognizer hi
 * kaam ka nahi hai — aur usne turant haath khada kar diya.
 */
const INSTANT_DEATH_MS = 1500;

/**
 * ── "Voice bilkul kaam nahi karta" — asli do wajah ──────────────────────
 *
 * Dono `expo-speech-recognition` ke NATIVE code me hain, aur dono par app ka
 * seedha koi bas nahi chalta. Isliye ilaaj yahan JS me karna padta hai.
 *
 * **1. Anjaan intent-extra poora session maar deta hai.**
 *
 * Native side har `androidIntentOptions` key ko REFLECTION se resolve karta hai
 * (`ExpoSpeechService.kt`):
 *
 *     val field = RecognizerIntent::class.java.getDeclaredField(key)
 *
 * Iske aage-peeche koi try/catch nahi hai. Jis Android par wo field maujood
 * nahi, wahan `NoSuchFieldException` uthta hai, poora `createSpeechIntent()`
 * gir jaata hai, aur `start()` ka bahar wala catch ek hi jhatke me
 * `error: "audio-capture"` + `end` bhej deta hai — mic khulne se PEHLE.
 *
 * Hamari list me se DO field sirf Android 13 (API 33) me aaye hain:
 * `EXTRA_MASK_OFFENSIVE_WORDS` aur `EXTRA_ENABLE_BIASING_DEVICE_CONTEXT`.
 * Yaani Android 12 aur usse purane HAR phone par voice kabhi chala hi nahi —
 * na hold pe, na tap pe. Isliye ab ye dono `Platform.Version` ke peeche hain.
 *
 * **2. Phone ka DEFAULT recognizer aksar Google ka hota hi nahi.**
 *
 * Samsung par default `com.samsung.android.bixby.agent` hota hai, kuch Xiaomi/
 * Oppo par unka apna. Wo bind to ho jaate hain par aksar kuch lautate hi nahi —
 * `ERROR_CLIENT`, ya seedha khaali `end`. Usi phone me Google ka recognizer
 * padda hota hai aur bilkul theek chalta hai; use bas naam le ke maangna padta
 * hai (`androidRecognitionServicePackage`).
 *
 * ── Isliye teen koshish, isi tarteeb me ────────────────────────────────
 *
 *   tuned  — poori tuning. Jahan chalti hai wahan pehchaan saaf behtar hai.
 *   plain  — koi extra nahi, koi biasing nahi, sirf bhasha. Ye lagbhag har us
 *            phone par chalti hai jahan koi bhi recognizer maujood hai.
 *   google — Google ka recognizer naam le kar. Ye Bixby jaise OEM recognizer
 *            wale phone bachata hai.
 *
 * Koshish tabhi badalti hai jab session BINA KUCH SUNE turant mar jaye — yaani
 * jab galti options/recognizer ki ho, user ki chuppi ki nahi.
 *
 * ⚠️ Aur jo koshish chal gayi wo phone par YAAD rakhi jaati hai. Iske bina har
 * baar do bekaar koshishein hoti aur mic ek second der se khulta — jo hold-to-
 * talk me sabse bura hai (pehle do-teen shabd nikal jaate hain).
 */
type Attempt = "tuned" | "plain" | "google";
const ATTEMPTS: Attempt[] = ["tuned", "plain", "google"];

/** Is phone par kaunsi koshish chali thi. */
const MODE_KEY = "saathi-voice-mode";
let learnedAttempt: Attempt | null = null;
let learnedLoaded = false;

function isAttempt(v: unknown): v is Attempt {
  return typeof v === "string" && (ATTEMPTS as readonly string[]).includes(v);
}

async function loadLearnedAttempt(): Promise<void> {
  if (learnedLoaded) return;
  learnedLoaded = true;
  try {
    const saved = await AsyncStorage.getItem(MODE_KEY);
    if (isAttempt(saved)) learnedAttempt = saved;
  } catch {
    /* na mile to "tuned" se hi shuru karenge */
  }
}

function rememberAttempt(a: Attempt): void {
  if (learnedAttempt === a) return;
  learnedAttempt = a;
  AsyncStorage.setItem(MODE_KEY, a).catch(() => {});
}

/** Iske baad kaunsi koshish bachi hai? */
function nextAttempt(a: Attempt): Attempt | null {
  const i = ATTEMPTS.indexOf(a);
  return i >= 0 && i + 1 < ATTEMPTS.length ? ATTEMPTS[i + 1] : null;
}

/**
 * Google ka recognition service package — `google` wali koshish ke liye.
 *
 * `getSpeechRecognitionServices()` sirf wo package deta hai jo manifest ki
 * `<queries>` me dikhte hain; plugin Google ka package wahan daal deta hai.
 * Na mile to `null`, aur wo koshish chhod di jaati hai.
 */
function googleService(): string | null {
  if (Platform.OS !== "android") return null;
  let services: string[] = [];
  try {
    services = ExpoSpeechRecognitionModule.getSpeechRecognitionServices();
  } catch {
    return null;
  }
  // Tarteeb soch ke: quicksearchbox asli Google app ka recognizer hai, `.as`
  // (Android System Intelligence) on-device wala, `tts` aakhri sahara.
  const prefer = [
    "com.google.android.googlequicksearchbox",
    "com.google.android.as",
    "com.google.android.tts",
  ];
  for (const p of prefer) if (services.includes(p)) return p;
  return services.find((s) => s.startsWith("com.google.")) ?? null;
}

/**
 * Android ke wo intent extras jo pehchaan sudhaarte hain.
 *
 * ⚠️ Android 13 (API 33) wale do field yahan SHART ke peeche hain — upar wajah
 * #1 poori likhi hai. Naya extra jodo to pehle ye dekh lena ki wo kis API level
 * me aaya, warna usse purane har phone par voice poori tarah band ho jaayegi
 * aur kahin koi error bhi nahi dikhega.
 */
function androidTuning(): Record<string, string | number | boolean> {
  const tiramisu = Number(Platform.Version) >= 33;
  return {
    // Beech me saans lene par session band na ho — 2s chuppi ke baad hi "baat
    // khatam" maano. Default (~1s) bahut jaldi kaat deta tha.
    EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2000,
    EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 1600,
    /**
     * ⚠️ Pehle yahan 2000 tha, aur wo hold-to-talk ko todta tha.
     *
     * Android is extra ko "itni der se pehle recording band mat karna" ki tarah
     * leta hai. User "dawai" bol ke 1 second me ungli utha deta hai, hum
     * `stop()` bhejte hain, par recognizer apne 2 second poore hone ka intezaar
     * karta rehta hai — aur us khaali samay ka shor uski pehchaan kharab kar
     * deta hai. 600ms chhoti "hmm" wali dikkat se abhi bhi bachata hai par asli
     * chhoti baat ko kaatta nahi.
     */
    EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 600,
    // free_form — poore wakya ke liye bana model. Kuch OEM default me
    // web_search rakhte hain, jo chhote search-jaise tukdon ke liye hai:
    // "kal subah aath baje dawai" ko wo tod-marod deta hai.
    EXTRA_LANGUAGE_MODEL: "free_form",
    /**
     * ⚠️ Yahan pehle `EXTRA_PREFER_OFFLINE: false` tha. Hata diya — wapas mat
     * laana. Soch thi "online model shor me behtar hai", par jis phone par net
     * dheema/band hai wahan recognizer `ERROR_NETWORK` de ke chup ho jaata tha,
     * jabki usi phone me offline model bilkul chal sakta tha. Kuch na dene par
     * Android khud behtar raasta chun leta hai.
     */
    // ── Sirf Android 13+ ──
    ...(tiramisu
      ? {
          // Gaali-mask se "***" aa jaata tha — reminder text me bekaar.
          EXTRA_MASK_OFFENSIVE_WORDS: false,
          // Phone ke apne sandarbh (contacts jaise naam) se pehchaan sudhrti hai.
          EXTRA_ENABLE_BIASING_DEVICE_CONTEXT: true,
        }
      : {}),
  };
}

export function VoiceButton({ onText }: { onText: (text: string) => void }) {
  const tc = useColors();
  const styles = useStyles();
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
   * `startListening` abhi beech me hai (permission ka `await` chal raha hai).
   *
   * ⚠️ Iske bina ek pakka bug tha. `onPressIn` ka pehla check `if (listening)`
   * React STATE padhta hai, aur wo state `beginUi()` me set hoti hai — jo
   * permission wale `await` ke BAAD chalta hai. Yaani do jaldi-jaldi tap
   * (bujurg haath me bilkul aam) par dono press "listening = false" dekhte the
   * aur DO `start()` chal padte the. Android ka recognizer ek waqt me ek hi
   * chalata hai: doosra `ERROR_RECOGNIZER_BUSY` deta tha, uska `release()`
   * pehle session ka maalikana chheen leta tha (`activeOwner = null`), aur phir
   * pehle session ka asli transcript `isMine()` par ruk ke gir jaata tha.
   * User ko ek error toast dikhta tha aur likha kuch nahi jaata tha.
   *
   * Ye ref state ka intezaar nahi karta — usi tick me sach ho jaata hai.
   */
  const starting = useRef(false);

  /** `stop()` ke baad `end` na aaye to khud sambhalne wala timer. */
  const endGuard = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const volumeTicks = useRef(0);
  const gotResult = useRef(false);

  /** Ye session kab shuru hua — "turant mar gaya" pehchaanne ke liye. */
  const startedAt = useRef(0);
  /** Abhi kaunsi koshish chal rahi hai (tuned / plain / google). */
  const attemptRef = useRef<Attempt>("tuned");
  /**
   * Ye session mar chuka hai aur agli koshish raaste me hai — iske baaki event
   * anadekhe karo.
   *
   * ⚠️ Iske bina agli koshish apne hi pichhle session ke haath maari jaati hai.
   * Native side ek fail par DO event bhejta hai: pehle `error`, phir `end`. Hum
   * `error` par agli koshish chala dete hain, aur uske turant baad wo purana
   * `end` aa jaata hai — usi maalik ke naam par, kyunki maalik to wahi hai. Wo
   * `end` chalti hui nayi koshish par `release()` maar deta aur user ko phir
   * wahi "kuch samajh nahi aaya" dikhta. Ye jhanda us purane event ko wahin rok
   * deta hai.
   */
  const deadSession = useRef(false);

  /**
   * Aakhri interim transcript — screen par NAHI likha jaata.
   *
   * ⚠️ Yahi wo cheez hai jiske bina kai Android phone par voice kabhi kaam
   * karta hi nahi tha. Samsung/Xiaomi ke kai recognizer `isFinal: true` bhejte
   * hi nahi — wo bas partial results dete hain aur seedha `end` bhej dete hain.
   * Hum sirf final par likhte the, isliye un phones par transcript aane ke
   * baawajood har baar "kuch samajh nahi aaya" milta tha.
   *
   * Ab interim aate hain par sirf yahan jama hote hain. Session khatam hone par
   * final na mila ho to yahi likh dete hain — ek hi baar. (Interim ko seedha
   * `onText` me bhejna wapas mat laana: `onText` APPEND karta hai, isliye wo
   * purana "call call mummy call mummy ko" wala garble laut aayega.)
   */
  const lastInterim = useRef("");

  /**
   * Ek session me transcript sirf EK BAAR jaata hai.
   *
   * `stop()` ke baad final `result` aata hai aur uske turant baad `end` — dono
   * emit kar dete to text do baar append ho jaata.
   */
  function emitOnce(text: string) {
    const t = text.trim();
    if (!t || gotResult.current) return;
    gotResult.current = true;
    // Jo koshish sach me chali, wo phone par yaad rakh lo — agli baar seedha
    // wahi chalegi aur mic bina der ke khulega.
    rememberAttempt(attemptRef.current);
    onText(t);
  }

  /** Ye event abhi wale, zinda session ka hai? */
  const live = () => isMine() && !deadSession.current;

  useSpeechRecognitionEvent("result", (e) => {
    if (!live()) return;
    const best = e.results?.[0]?.transcript?.trim();
    if (!best) return;
    if (e.isFinal) emitOnce(best);
    // Final nahi hai — abhi likhna nahi, bas yaad rakhna.
    else lastInterim.current = best;
  });
  /**
   * Session bina kuch sune hi turant mar gaya — agli koshish par chalo.
   *
   * `true` lauta to caller ko kuch nahi kehna hai (na toast, na release): nayi
   * koshish raaste me hai. Poori soch `ATTEMPTS` ke upar likhi hai.
   */
  function escalated(why: string): boolean {
    if (gotResult.current || lastInterim.current) return false;
    if (volumeTicks.current > 0) return false; // mic sach me sun rahi thi
    if (Date.now() - startedAt.current > INSTANT_DEATH_MS) return false;
    if (intent.current === "none") return false; // user ne haath hi hata liya

    let next = nextAttempt(attemptRef.current);
    // Google wali koshish ka koi matlab nahi agar us phone par Google ka
    // recognizer hai hi nahi.
    if (next === "google" && !googleService()) next = null;
    if (!next) return false;

    /**
     * ⚠️ Ye admin > Logs me dikhna zaroori hai. Warna pata hi nahi chalega ki
     * kis phone par kaunsi koshish chalti hai — aur "voice kaam nahi karta"
     * wali shikayat phir se bina saboot ke rah jaayegi. Android ka version
     * saath me isliye ki wo pehli wajah (API 33 wale extras) seedha isi se
     * pakdi jaati hai.
     */
    reportError(
      new Error(`voice: ${attemptRef.current} fail (${why}) -> ${next}`),
      {
        screen: "voice",
        action: "escalate",
        platform: Platform.OS,
        osVersion: String(Platform.Version),
        lang: v.recogLang,
      },
      "warn",
    );

    /**
     * ⚠️ Yahan `abort()` MAT bulana. Session already marr chuka hai, aur
     * `abort()` khud ek aur `error: "aborted"` event bhejta hai (module ka
     * `Function("abort")` dekho) — jo turant wapas isi handler me aata hai aur
     * user ko ek bekaar ka toast dikha jaata hai.
     *
     * Bas purane session ko murda chihnit karo, thoda ruk jao (taaki uska
     * trailing `end` guzar jaye), phir nayi koshish chalao.
     */
    deadSession.current = true;
    setTimeout(() => {
      if (!isMine() || intent.current === "none") {
        deadSession.current = false;
        release();
        return;
      }
      void startListening({ attempt: next });
    }, 200);
    return true;
  }

  useSpeechRecognitionEvent("end", () => {
    if (!live()) return;
    // Final kabhi aaya hi nahi par interim mil chuka hai — wahi sach hai.
    if (!gotResult.current && lastInterim.current) emitOnce(lastInterim.current);
    if (!gotResult.current && escalated("end")) return;
    // Ab bhi kuch nahi — tabhi kuch kehna hai. Mil gaya to chup rehna behtar.
    if (!gotResult.current) hintForSilence();
    release();
  });
  useSpeechRecognitionEvent("error", (e) => {
    if (!live()) return;
    // Error ke baad bhi wo interim sach hi hai jo mic ne sun liya tha —
    // "no-speech" ke saath aksar aadha wakya pehle hi aa chuka hota hai.
    if (!gotResult.current && lastInterim.current) emitOnce(lastInterim.current);
    if (!gotResult.current) {
      /**
       * ⚠️ Permission wale error par agli koshish NAHI. Wo ek asli, samjhaane
       * laayak wajah hai jiska ilaaj user ke haath me hai; use chupchaap dobara
       * chalane se user ko kuch pata hi nahi chalta aur wo baar-baar wahi button
       * dabata rehta hai.
       *
       * ⚠️ Par `service-not-allowed` yahan JAAN-BOOJH KE nahi hai — pehle wo
       * bhi is list me tha aur wo galat tha. Uska matlab hi ye hota hai ki JO
       * recognizer chuna gaya wo mana kar raha hai, aur theek wahi soorat hai
       * jise `google` wali koshish bachati hai (Bixby mana karta hai, Google ka
       * chal jaata hai). Us par ruk jaana matlab us phone par voice hamesha ke
       * liye band.
       */
      /**
       * `aborted` bhi yahan hai, aur ye zaroori hai: abort HAMESHA humne khud
       * kiya hota hai (doosri mic chali, screen band hui, ya atka hua session
       * saaf kiya). Wo device ki kami nahi hai, isliye uspar agli koshish
       * chalane ka koi matlab nahi — ulta wo ek aisi koshish chala deta jise
       * user ne maanga hi nahi tha.
       */
      const fatal = e?.error === "not-allowed" || e?.error === "aborted";
      if (!fatal && escalated(e?.error ?? "unknown")) return;
      toast.show(errorLine(e?.error), "info");
    }
    release();
  });
  // Shor me ye bahut madad karta hai: user ko dikhta hai ki uski awaaz pahunch
  // rahi hai. Warna wo baar-baar button dabata hai aur session toot jaata hai.
  useSpeechRecognitionEvent("volumechange", (e) => {
    if (!isMine()) return;
    // -2..10 ko 0..1 me. 0 se neeche ko chuppi maante hain.
    const norm = Math.max(0, Math.min(1, (e.value ?? 0) / 8));
    level.setValue(norm);
    volumeTicks.current += 1;
    if (norm > peak.current) peak.current = norm;
    // Lagatar tez awaaz par ye ginti chadhti hai.
    if (norm > 0.45) loudTicks.current += 1;
  });

  /**
   * Recognizer ne jo galti batayi, uska seedha matlab.
   *
   * ⚠️ Pehle `no-speech` ke alawa har error par ek hi line thi ("awaaz saaf
   * nahi aayi"). Us line se user wahi karta hai jo usne abhi kiya — dobara
   * bolta hai — aur wo kabhi chalega hi nahi, kyunki dikkat awaaz ki thi hi
   * nahi. Permission, band service, missing language pack, net aur busy mic —
   * paanchon ka ilaaj alag hai, isliye ab paanchon ki line alag hai.
   */
  function errorLine(err: string | undefined): string {
    switch (err) {
      case "not-allowed":
        return v.micPermission;
      case "service-not-allowed":
        return v.noService;
      case "language-not-supported":
        return v.langMissing;
      case "network":
        return v.needsNet;
      case "busy":
      case "audio-capture":
        return v.micBusy;
      /**
       * `aborted` = humne khud session kaata (doosri mic, ya screen band).
       * `client` = recognizer andar hi toot gaya.
       *
       * ⚠️ Ye dono pehle `default` par gir ke "awaaz saaf nahi aayi" dikhate
       * the — yaani user ko lagta tha uski awaaz me kami hai, aur wo dobara,
       * phir dobara bolta rehta tha. Dono me awaaz ka koi kasoor hai hi nahi.
       */
      case "aborted":
      case "client":
        return v.unavailable;
      // "no-speech" / "speech-timeout" = sach me kuch sunayi nahi diya. Wajah
      // volume ke saboot se hi tay hoti hai.
      case "no-speech":
      case "speech-timeout":
        return silenceLine();
      default:
        return v.unclear;
    }
  }

  /**
   * Kuch samajh nahi aaya — wajah ke hisaab se alag baat kaho.
   *
   * ⚠️ Do purane bug yahin the, aur user ne dono ke shabd bilkul theek pakde
   * ("awaz nhi aaya ya shor bahut h"):
   *
   *   • `loudTicks > 10` = sirf 1.5 second tak tez awaaz (tick har 150ms).
   *     Normal bolne me hi 3 second me itna aaram se ho jaata hai — yaani hum
   *     user ki APNI awaaz ko "aas-paas shor bahut hai" bata dete the. Ab shart
   *     do-tarfa hai: bahut lambe waqt tak tez (>4s) AUR session ka bada hissa
   *     tez — jo bolne me nahi, lagatar shor me hi hota hai.
   *
   *   • Kai OEM `volumechange` bhejte hi nahi. Tab `peak` hamesha 0 rehta tha,
   *     yaani HAR fail "awaaz nahi pahunchi" ban jaata tha — chahe user
   *     chillaya ho. Ab jab tak volume ka koi saboot na ho, hum awaaz ke baare
   *     me koi daawa hi nahi karte.
   */
  function silenceLine(): string {
    // Volume ki koi khabar hi nahi mili — awaaz ke baare me kuch mat kaho.
    if (volumeTicks.current < 5) return v.unclear;
    const loudShare = loudTicks.current / volumeTicks.current;
    // ~4 second se zyada lagatar tez, aur session ka 70%+ hissa tez = kamra
    // shor bhara hai. Bolne ke beech saans/viraam se share itna oopar nahi
    // jaata.
    if (loudTicks.current > 26 && loudShare > 0.7) return v.tooNoisy;
    if (peak.current < 0.12) return v.tooQuiet;
    return v.unclear;
  }

  function hintForSilence() {
    toast.show(silenceLine(), "info");
  }

  /** UI ko "sun raha hoon" wali haalat me le jao. */
  function beginUi() {
    setListening(true);
    peak.current = 0;
    loudTicks.current = 0;
    volumeTicks.current = 0;
    gotResult.current = false;
    lastInterim.current = "";
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
    starting.current = false;
    // Agli baar taazi shuruaat — warna ek murda-chihnit session ka jhanda agle
    // press par bhi laga rehta aur uske saare event chup-chaap gir jaate.
    deadSession.current = false;
    if (endGuard.current) {
      clearTimeout(endGuard.current);
      endGuard.current = null;
    }
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
    const guard = endGuard;
    return () => {
      ownerReset.delete(me);
      // Screen ja chuki hai — safety timer ab setState karega to warning
      // milegi (aur `onText` ek mari hui screen me jaayega).
      if (guard.current) {
        clearTimeout(guard.current);
        guard.current = null;
      }
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

  /**
   * Mic chalu karo. Permission na mile to kuch nahi hota.
   *
   * `attempt` na do to phone par jo koshish pehle chal chuki hai wahi (aur
   * pehli baar `tuned`). Poori soch `ATTEMPTS` ke upar likhi hai.
   */
  async function startListening({ attempt }: { attempt?: Attempt } = {}) {
    // Pehla `start()` abhi raaste me hai — doosra bhejna sirf
    // ERROR_RECOGNIZER_BUSY laayega aur pehle wale ka transcript gira dega.
    if (starting.current) return;
    starting.current = true;

    /**
     * Setup ke dauraan aane wala har event PURANE session ka hai — ignore.
     *
     * ⚠️ Ye zaroori hai kyunki neeche do jagah `abort()` chalta hai (doosre
     * button ki mic, aur apna hi atka hua session), aur module ka `abort()`
     * turant ek `error: "aborted"` event bhejta hai. Bina is jhande ke wo event
     * abhi wale, zinda session ka maan liya jaata — aur `escalated()` use ek
     * asli fail samajh ke ek aur koshish chala deta. Do koshishein saath me
     * chalti aur dono ek doosre ko maar deti.
     *
     * Jhanda `start()` se theek pehle hatta hai.
     */
    deadSession.current = true;

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
      /**
       * Is phone par voice service hai bhi ya nahi.
       *
       * ⚠️ Bahut se Android (khaas kar custom ROM, aur wo phone jinme Google app
       * disable hai) par koi RecognitionService hoti hi nahi. Wahan `start()`
       * chup-chaap fail hota tha ya `service-not-allowed` deta tha, aur user ko
       * "awaaz saaf nahi aayi" dikhta tha — to wo dobara, phir dobara bolta
       * rehta tha. Ye kabhi chalne wala nahi tha. Pehle hi saaf keh dena behtar
       * hai.
       *
       * Sirf Android par: iOS par ye API khaali list deti hai.
       */
      if (Platform.OS === "android") {
        let services: string[] = [];
        try {
          services = ExpoSpeechRecognitionModule.getSpeechRecognitionServices();
        } catch {
          // API hi na chale to andaza mat lagao — aage badh ke start karke dekho.
          services = ["unknown"];
        }
        if (services.length === 0) {
          toast.show(v.noService, "error");
          release();
          return;
        }
      }

      /**
       * Pichhla session abhi poori tarah band nahi hua.
       *
       * ⚠️ Android ek waqt me ek hi recognizer chalata hai. Agar pichhla session
       * "stopping" par atka hai (kuch OEM par `end` aane me 1-2 second lagte
       * hain) to naya `start()` seedha `ERROR_RECOGNIZER_BUSY` deta hai — aur
       * user ke liye wo bilkul "mic dabaya, kuch nahi hua" jaisa dikhta hai.
       * Ek `abort()` se wo purani haalat saaf ho jaati hai.
       */
      try {
        const state = await ExpoSpeechRecognitionModule.getStateAsync();
        if (state !== "inactive") ExpoSpeechRecognitionModule.abort();
      } catch {
        /* API na chale to seedha aage — start khud bata dega */
      }

      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        toast.show(v.micPermission, "info");
        release();
        return;
      }
      // Permission ka popup khula tha aur us beech iraada khatam ho gaya (user ne
      // ungli hata li ya doosri jagah tap kar diya) — ab mic chalu karna bekaar
      // hai, aur wo chup kamre me chalti rehti.
      if (intent.current === "none") {
        starting.current = false;
        deadSession.current = false;
        return;
      }

      // Pehli baar phone se poochho ki kaunsi koshish pehle chal chuki hai.
      await loadLearnedAttempt();
      const mode: Attempt = attempt ?? learnedAttempt ?? "tuned";
      const service = mode === "google" ? googleService() : null;

      activeOwner = meRef.current;
      beginUi();
      startedAt.current = Date.now();
      attemptRef.current = mode;
      // Purane, murda session ka pehra ab hata do — yahan se aage ke event is
      // nayi koshish ke hain.
      deadSession.current = false;
      ExpoSpeechRecognitionModule.start({
        lang: v.recogLang,
        /**
         * ⚠️ Ye `true` hona ZAROORI hai, wapas `false` mat karna.
         *
         * Kai Android recognizer (Samsung/Xiaomi ke kai build) kabhi
         * `isFinal: true` bhejte hi nahi — wo sirf partial results dete hain
         * aur seedha `end` bhej dete hain. `false` rakhne par un phones par
         * voice KABHI kaam nahi karta tha.
         *
         * Purana darr (interim se "call call mummy call mummy ko" wala garble)
         * ab bhi sahi hai — isliye interim SCREEN PAR nahi jaate. Wo sirf
         * `lastInterim` me jama hote hain, aur session ke aakhir me final na
         * mile tabhi ek baar likhe jaate hain.
         */
        interimResults: true,
        continuous: false,
        // Ek hi guess chahiye — recognizer ka sabse confident wala. (Pehle 5
        // mangwate the taaki `pickBest` unme se chun sake; wo hat chuka hai.)
        maxAlternatives: 1,
        // Biasing sirf `tuned` me. Saadi/Google wali koshish ka poora matlab hi
        // ye hai ki recognizer ko kuch anjaan na bheja jaye (upar `ATTEMPTS`).
        ...(mode === "tuned" ? { contextualStrings: BIAS_WORDS } : {}),
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
        ...(Platform.OS === "android" && mode === "tuned"
          ? { androidIntentOptions: androidTuning() }
          : {}),
        // Google ka recognizer naam le kar — Bixby jaise OEM recognizer wale
        // phone yahi bachata hai.
        ...(service ? { androidRecognitionServicePackage: service } : {}),
      });
      // `start()` chal pada — ab session ka anth `end`/`error` hi karega.
      starting.current = false;
    } catch {
      release();
      toast.show(v.unavailable, "error");
    }
  }

  /**
   * Mic band karo, par aakhri transcript aane do (abort nahi — stop).
   *
   * `stop()` ke baad recognizer ko `result` (final) aur phir `end` bhejna
   * chahiye. Kuch OEM build me `end` kabhi aata hi nahi — aur uske bina
   * `release()` bhi kabhi nahi chalta: button hamesha ke liye laal/active pada
   * reh jaata tha, aur us screen par mic dobara chalti hi nahi thi (kyunki
   * `activeOwner` chhoota hi nahi). Isliye ek safety timer.
   */
  function stopListening() {
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {
      release();
      return;
    }
    if (endGuard.current) clearTimeout(endGuard.current);
    endGuard.current = setTimeout(() => {
      endGuard.current = null;
      // `live()` — `isMine()` nahi. Agli koshish raaste me ho to ye purana
      // timer use beech me hi maar deta.
      if (!live()) return;
      // Final nahi aaya par interim mil chuka tha — wahi likh do.
      if (!gotResult.current && lastInterim.current) emitOnce(lastInterim.current);
      if (!gotResult.current) hintForSilence();
      release();
    }, END_GUARD_MS);
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
      // ⚠️ Shart `listening` (React state) par nahi, `isMine()` (module ref)
      // par hai. `listening` `beginUi()` ke baad ke render me hi sach hoti
      // hai; us ek frame ke andar ungli uth jaye to purani soorat me mic chalu
      // reh jaati thi aur band karne ka koi raasta hi nahi bachta tha —
      // recognizer apne timeout tak chalta rehta aur us beech koi doosra mic
      // kaam nahi karta tha. Ref usi tick me sach hota hai.
      //
      // `deadSession` ki shart isliye: us pal recognizer chal hi nahi raha
      // (agli koshish 200ms baad shuru hoti hai). Wahan `stop()` bhejna bekaar
      // hai — escalation ka timer khud `intent === "none"` dekh ke ruk jaata
      // hai aur UI shaant kar deta hai.
      if (live()) stopListening();
      return;
    }

    // Chhota tap, aur pehle bhi tap se hi chalu hua tha → ye band karne wala tap.
    if (intent.current === "tap") {
      intent.current = "none";
      // `live()` — beech me agli koshish raaste me ho to us pal recognizer chal
      // hi nahi raha; escalation ka timer `intent === "none"` dekh ke khud ruk
      // jaata hai aur UI shaant kar deta hai.
      if (live()) stopListening();
      else release();
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
        hitSlop={12}
        /**
         * Ungli ka hilna hold ko na kaate.
         *
         * ⚠️ Ye is button ki sabse chupi hui dikkat thi. RN press ko CANCEL kar
         * deta hai jaise hi ungli button (+hitSlop) se bahar khiskti hai — aur
         * cancel par `onPressOut` chalta hai. Bujurg haath 20-30 second... nahi,
         * 2-3 second dabaye rakhne me hi 15-20px khisak jaata hai. Natija: aadhe
         * wakya par mic band, aur aksar "kuch samajh nahi aaya". User ke liye ye
         * bilkul "voice kaam hi nahi karta" jaisa dikhta tha.
         *
         * `pressRetentionOffset` hitSlop se alag hai: hitSlop tay karta hai ki
         * press SHURU kahan se ho sakta hai, ye tay karta hai ki shuru hone ke
         * baad ungli kitni door tak ja sakti hai. 40px me haath ka kudrati
         * hilna aa jaata hai.
         */
        pressRetentionOffset={{ top: 40, bottom: 40, left: 40, right: 40 }}
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
            color={listening ? tc.white : tc.terracotta}
          />
        </View>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  btn: {
    height: 48,
    width: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.terracotta,
    backgroundColor: c.surface,
    overflow: "hidden",
  },
  btnActive: { backgroundColor: c.terracotta, borderColor: c.terracotta },
  level: {
    position: "absolute",
    height: 46,
    width: 46,
    borderRadius: 23,
    backgroundColor: c.white,
  },
}));
