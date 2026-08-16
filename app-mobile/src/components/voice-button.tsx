import { useState, useRef, useEffect } from "react";
import { Platform, Pressable, Animated, Text, View } from "react-native";
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
 * AI ka kaam hai.
 *
 * ── Par baaki guess phenkna bhi galat tha (issue: "kabhi sahi, kabhi nahi") ──
 *
 * ⚠️ `pickBest` ke saath hum `maxAlternatives` bhi 1 par le aaye the — yaani
 * recognizer ka sirf pehla guess bachta tha aur baaki chup-chaap gir jaate the.
 * Aur yahi wo jagah hai jahan Hinglish sabse zyada tootti hai: recognizer ka
 * pehla guess `en-IN` model ka hota hai, aur wo aksar "dawai" ko "the way",
 * "baje" ko "budget", "Sonu ko" ko "so new co" sunta hai — jabki uske apne
 * doosre/teesre guess me theek shabd pada hota hai. Ek hi baat do baar bolne par
 * do alag nateeje isi wajah se aate the: kabhi sahi guess pehle number par aa
 * jaata, kabhi doosre par — aur doosre par aane ka matlab tha ki wo AI tak
 * pahunchta hi nahi.
 *
 * Ab saare guess AI ko jaate hain, aur chunav wahi karta hai. Ye `pickBest` ki
 * wapsi NAHI hai — wahan faisla ek local time-parser karta tha (jo apni hi
 * galtiyan laata tha); yahan app kuch chunti hi nahi, sirf jo suna wo poora aage
 * de deti hai. Pehla guess phir bhi pehla hi rehta hai (screen par wahi likha
 * jaata hai); baaki sirf AI ke liye saath jaate hain.
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
 * ── "Bolne ka mauka hi nahi milta" ──────────────────────────────────────
 *
 * ⚠️ Ye is file ka sabse asli sudhaar hai, aur pehle ye tha hi nahi.
 *
 * Android ka recognizer apni marzi se faisla karta hai ki "ab bas". Jab tak
 * awaaz shuru na ho, wo aksar 2-5 second me hi `ERROR_SPEECH_TIMEOUT` ya
 * `ERROR_NO_MATCH` de deta hai — aur ye timeout kisi intent extra se badla nahi
 * ja sakta (Google ka recognizer un extras ko poori tarah anadekha karta hai).
 *
 * Iska seedha nateeja user ki shikayat thi: mic dabao, saans lo, bolna shuru
 * karne hi wale ho — aur tab tak toast aa chuka hota tha "awaaz saaf nahi aayi".
 * Bujurg haath aur naya user dono ko 2 second me bolna shuru karna hi padta tha,
 * jo asli baat-cheet me hota hi nahi.
 *
 * `escalated()` bhi yahan kaam nahi aata: wo sirf DED SE PEHLE (1.5s) marne wale
 * session ko pakadta hai, kyunki uska maqsad alag hai — galat options/recognizer
 * pehchaanna, chuppi nahi.
 *
 * Ilaaj seedha hai: agar user ka IRAADA abhi bhi bolne ka hai (ungli lagi hui
 * hai, ya tap-mode chalu hai) aur abhi tak kuch suna hi nahi gaya, to chup-chaap
 * recognizer dobara chala do. User ko kuch dikhta hi nahi — uske liye mic bas
 * sunta rehta hai, jitni der wo chahe.
 *
 * Do chhat, aur dono zaroori hain:
 *   • `RESTART_MAX` — jis phone par recognizer sach me toota hua hai wahan ye
 *     hamesha ke liye nahi ghoomta rahega.
 *   • `LISTEN_MAX_MS` — mic khuli chhod dena battery aur privacy dono ke liye
 *     bura hai. Ek minute me har asli baat khatam ho jaati hai.
 *
 * ⚠️ `RESTART_MAX` 5 se 2 par laaya gaya, aur wajah AWAAZ hai.
 *
 * Android ka recognizer har `start()` par ek "ting" aur har `end()` par doosri
 * bajata hai — ye tone system ki hai, app use band nahi kar sakti. 5 restart ka
 * matlab tha ek hi hold me 10 tak beep. User ne bilkul yahi likha: "beech beech
 * me start band ka sound aata hai".
 *
 * Aur ye sirf shor ki baat nahi thi. Har restart ke beech mic ~200-400ms ke liye
 * BAND hoti hai, aur us khidki me bola hua sab kuch gir jaata hai. Jo user
 * lagatar bolta rehta hai (aur wahi swabhavik hai) uske liye ye "bol raha hoon
 * par kuch ho nahi raha" jaisa hi dikhta hai.
 *
 * Do restart chuppi wale asli maamle (user ne 2-3 second sochne me lagaye) ko
 * ab bhi sambhaal lete hain, par shor aur gum hui baat dono ek-tihaayi reh
 * jaate hain. Iske saath neeche `androidTuning()` me chuppi ka sabra bhi badha
 * diya gaya hai — yaani restart ki zaroorat hi pehle se kam padti hai.
 */
const RESTART_MAX = 2;

/**
 * Jab kuch SUNA JA CHUKA ho, tab kitni baar dobara chalu karein.
 *
 * ⚠️ Ye 6 tha, aur 6 GALAT tha. Wo ek "kitni baar" wali chhat thi, jabki asli
 * sawaal "kitni der" ka hai — aur uska jawab pehle se `LISTEN_MAX_MS` (2 minute)
 * de raha hai.
 *
 * Purane Android par (jahan recognizer continuous ko anadekha kar deta hai) har
 * viraam ek restart banta hai. Jo aadmi soch-soch kar bolta hai — yaani theek
 * wahi aadmi jiske liye ye app bani hai — uske saatven viraam par app uski baat
 * beech me kaat ke bhej deti thi, jabki uski ungli abhi bhi button par hoti thi.
 * Wo phir wahi purani shikayat hai: "aadhi baat gayi".
 *
 * 40 chhat nahi, ek BACKSTOP hai — sirf us pathological soorat ke liye jahan
 * recognizer turant-turant khaali nateeje deta rahe. Asli rok do hi hain, aur
 * dono sahi hain: user ka rukna, aur 2 minute.
 *
 * `RESTART_MAX` (2) chhota hi rehta hai — wo KHAALI koshishon ke liye hai, jahan
 * kuch suna hi nahi gaya. Wahan lambi ginti sirf beep ka loop deti hai.
 */
const RESTART_MAX_HEARD = 40;
/**
 * Mic zyada se zyada itni der khuli reh sakti hai.
 *
 * ⚠️ 60 se 120 second — `continuous` ke saath ye ab SACH ME lagne wali chhat
 * hai, pehle jaisi kaagzi nahi. Pehle recognizer khud 3 second me ruk jaata tha,
 * isliye 60 kabhi lagta hi nahi tha. Ab session tab tak zinda rehta hai jab tak
 * user na roke, aur ye ginti seedha kaat deti hai.
 *
 * 60 reminder ke liye kaafi tha par note likhwane ke liye nahi (`note-edit` par
 * bhi yahi button hai) — wahan aadmi soch-soch kar bolta hai. 2 minute me har
 * asli baat poori ho jaati hai, aur bhooli hui khuli mic se bachaav bhi rehta
 * hai (battery aur privacy, dono).
 */
const LISTEN_MAX_MS = 120_000;

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

/**
 * ⚠️ Tarteeb badli gayi: `google` ab `plain` se PEHLE hai. Wajah `continuous` hai.
 *
 * Mic ka khula rehna (`continuous`) sirf `tuned` aur `google` me hai — `plain`
 * ka poora maqsad hi "kuch mat bhejo" hai, aur wahi aakhri sahara hona chahiye.
 *
 * Purani tarteeb (tuned -> plain -> google) me Samsung/Xiaomi wale users — jinka
 * default recognizer Bixby jaisa hota hai aur jinka `tuned` aksar fail hota hai
 * — seedha `plain` par gir jaate the, yaani unhe continuous KABHI milta hi nahi.
 * Wo India me bahut bada hissa hai. Ab wo `google` par jaate hain, jahan Google
 * ka recognizer bhi hai aur mic khuli bhi rehti hai.
 *
 * Agar sach me `continuous` hi is phone par toota ho, to dono (tuned aur google)
 * fail honge aur `plain` phir bhi bacha rehta hai — sirf ek koshish zyada lagti
 * hai, aur wo ek hi baar (jo chali wo yaad rakh li jaati hai).
 */
const ATTEMPTS: Attempt[] = ["tuned", "google", "plain"];

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
/**
 * Is koshish me mic khuli rakhni hai?
 *
 * ⚠️ Yahan pehle `Android 13+` ki shart thi, aur wo GALAT thi. Library ka apna
 * native code (`ExpoSpeechService.kt`) dono raaste rakhta hai:
 *
 *   • **Android 13+ (API 33)** — asli segmented session: audio seedha recognizer
 *     ko stream hota hai (`EXTRA_AUDIO_SOURCE` + `EXTRA_SEGMENTED_SESSION`).
 *     `onSegmentResults()` kai baar final deta hai aur session KHATAM NAHI karta.
 *     Native code ka apna comment: isse start/stop wali **beep bhi nahi bajti**.
 *
 *   • **Android 12 aur purane** — wahan wo teen silence-extras 600000 (10 minute)
 *     par set kar deta hai. Google ka recognizer inhe aksar anadekha karta hai,
 *     par jahan maanta hai wahan mic khuli rehti hai. Aur jahan nahi maanta,
 *     wahan hamara jama-karne wala raasta (`keepListening`) sambhal leta hai.
 *
 * Yaani purane Android par ise band karna kuch bachata nahi tha — sirf ek mauka
 * chheenta tha. Ab har version par chalu hai.
 *
 * `plain` me JAAN-BOOJH KE nahi: wo aakhri sahara hai jiska poora matlab hi
 * "recognizer ko kuch anjaan mat bhejo" hai.
 */
function canContinuous(mode: Attempt): boolean {
  return mode === "tuned" || mode === "google";
}

function androidTuning(continuous: boolean): Record<string, string | number | boolean> {
  const tiramisu = Number(Platform.Version) >= 33;
  return {
    /**
     * Beech me saans lene par session band na ho.
     *
     * ⚠️ 2000 → 3000 (aur 1600 → 2400). Ye seedha us shikayat ka ilaaj hai ki
     * "bol rahe hain par kuch nahi hota, aur beech-beech me start/band ka sound
     * aata hai".
     *
     * Chain aisi thi: recognizer 2 second ki chuppi par session khatam maan leta
     * tha → `keepListening()` use dobara chalu karta tha → Android start/end ki
     * tone bajata tha → aur us restart ki khidki me bola hua hissa gir jaata tha.
     * Jo user bolte waqt rukta hai (naam yaad karne me, ya wakya soch ke) — yaani
     * lagbhag har wo user jiske liye ye app bani hai — uske liye ye har baar
     * hota tha.
     *
     * 3 second aam viraam se lamba hai par itna bhi nahi ki hold chhodne ke baad
     * ka intezaar mehsoos ho (chhodte hi `stop()` waise bhi chala jaata hai).
     */
    /**
     * ⚠️⚠️ Ye teen extras SIRF tab jaate hain jab `continuous` BAND ho — aur ye
     * shart is poore feature ki sabse zaroori line hai.
     *
     * Native code (`ExpoSpeechService.kt`) user ke `androidIntentOptions` ko
     * SABSE AAKHIR me lagata hai — continuous wale extras set karne ke BAAD.
     * Yaani continuous purane Android par silence ko 600000 (10 minute) karta
     * hai, aur uske turant baad hamari ye teen line use wapas 3000 (3 second)
     * kar deti thi.
     *
     * Nateeja: `continuous: true` bhejne ke baawajood mic wahi 3 second wali
     * command-mode me chalti rehti — yaani poora sudhaar chup-chaap bekaar. Aur
     * pakadna namumkin, kyunki bhejne wale ki taraf sab kuch sahi dikhta hai.
     *
     * Android 13+ par ye extras nuksaan nahi karte (wahan session `EXTRA_AUDIO_
     * SOURCE` se bandha hota hai, silence se nahi), par bhejne ka koi matlab bhi
     * nahi — isliye dono jagah ek hi niyam.
     */
    ...(continuous
      ? {}
      : {
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 3000,
          EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS: 2400,
          EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS: 600,
        }),
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

/**
 * Recognizer se kitne guess maangein.
 *
 * ⚠️ 1 se 5 par wapas laaya gaya — poori wajah file ke sar par likhi hai. Chhota
 * karke wapas mat le jaana: 1 par Hinglish ka har wo wakya gir jaata hai jiska
 * sahi roop recognizer ke doosre/teesre guess me hota hai (aur wo aam baat hai).
 * Ye mehnga bhi nahi: alternatives ek hi pehchaan ke nateeje hain, koi doosri
 * call nahi jaati.
 */
const MAX_ALTERNATIVES = 5;

export function VoiceButton({
  onText,
}: {
  /**
   * Jo suna gaya.
   *
   * `alts` = recognizer ke BAAKI guess (pehla `text` khud hai). Ye sirf AI ke
   * liye hain — screen par hamesha `text` hi likhna hai. Poori wajah file ke sar
   * par likhi hai.
   */
  onText: (text: string, alts?: string[]) => void;
}) {
  const tc = useColors();
  const styles = useStyles();
  const toast = useToast();
  const { voice: v } = useT();
  const [listening, setListening] = useState(false);
  /**
   * Kitne second se sun rahe hain — patti me dikhta hai.
   *
   * ⚠️ Ye sirf sajawat nahi hai. Mic khuli hone par user ko KOI nishaan nahi
   * milta tha ki wo abhi chalu hai — aur `continuous` ke baad wo ghanton khuli
   * reh sakti hai. WhatsApp/ChatGPT dono me ye ginti isiliye dikhti hai: wahi
   * ek cheez hai jo "chal raha hai" aur "atak gaya" me farq karti hai.
   */
  const [secs, setSecs] = useState(0);
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
   * Mic ki apni chhat — {@link LISTEN_MAX_MS} ke baad khud band.
   *
   * ⚠️ `continuous` ke saath ye ZAROORI ho gaya. Pehle chhat `keepListening()`
   * me lagti thi, aur wo sirf tab chalta hai jab recognizer khud session khatam
   * kare. Continuous me wo kabhi khatam karta hi nahi — yaani user ne galti se
   * tap kar diya aur phone jeb me rakh diya, to mic ghanton khuli rehti. Battery
   * aur privacy, dono ke liye ye sabse buri soorat hai.
   */
  const maxTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  /**
   * User ne pehli baar mic kab dabaya (restart ke aar-paar bhi wahi rehta hai).
   *
   * ⚠️ `startedAt` se alag hona ZAROORI hai. `startedAt` har restart par naya ho
   * jaata hai, isliye usse "kitni der se sun rahe hain" naapa hi nahi ja sakta —
   * aur bina us naap ke `LISTEN_MAX_MS` wali chhat lagti hi nahi, yaani mic
   * hamesha ke liye khuli reh sakti hai.
   */
  const listeningSince = useRef(0);
  /** Chuppi par kitni baar chup-chaap dobara chala chuke hain. */
  const restarts = useRef(0);
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
   * Aakhri result ke BAAKI guess — pehle guess ke alawa.
   *
   * Ye screen par kabhi nahi jaate; sirf AI ko saath bheje jaate hain taaki wo
   * sahi wala chun sake. Poori wajah file ke sar par likhi hai.
   */
  const lastAlts = useRef<string[]>([]);

  /**
   * ── POORE hold/tap ka jama hua text (restart ke aar-paar) ──────────────
   *
   * ⚠️ Ye is file ka sabse zaroori sudhaar hai, aur iske bina ek asli bug tha
   * jise "kabhi sahi kar raha hai, kabhi nahi" ke alawa kisi tarah bayan hi nahi
   * kiya ja sakta.
   *
   * Android ka recognizer 3 second ki chuppi par session KHATAM maan leta hai
   * (`EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS`). Aadmi bolte waqt
   * rukta hai — naam yaad karne me, wakya sochne me — aur wo viraam aksar 3
   * second se lamba hota hai. Us pal recognizer `isFinal` bhej deta hai, ya
   * seedha `end`.
   *
   * Purana code us pehle tukde ko hi POORI baat maan ke `onText` bhej deta tha
   * aur `release()` kar deta tha — mic band. User ki ungli abhi bhi button par
   * hoti thi, wo aage bolta rehta tha, aur wo poora hissa ek band mic me jaata
   * tha. "Kal subah aath baje… dawai leni hai" me se sirf "kal subah aath baje"
   * pahunchta tha.
   *
   * Aur yahi wo cheez hai jo use RANDOM banati thi: viraam chhota hua to poora
   * wakya ek hi tukde me aa gaya (sahi), lamba hua to aadha kat gaya (galat).
   * Ek hi user, ek hi wakya, do alag nateeje.
   *
   * Ab har tukda yahan jama hota hai, aur `onText` tabhi chalta hai jab user
   * SACH ME ruk chuka ho (ungli uth gayi, ya tap se band kiya).
   */
  const sessionText = useRef("");
  /**
   * Guess sirf PEHLE tukde ke.
   *
   * Baad wale tukdon ke guess poore wakya par lagane laayak nahi hote — wo kisi
   * aur hisse ke roop hain, aur AI ko dikhane par wo unhe poore wakya ka
   * vikalp samajh leta hai.
   */
  const sessionAlts = useRef<string[]>([]);
  /** `onText` ek session me sirf EK BAAR. */
  const emitted = useRef(false);

  /** Is hold/tap me ab tak kuch suna gaya hai? */
  const heard = () => sessionText.current.trim().length > 0;

  /**
   * Ek TUKDA jama karo — abhi bhejna nahi hai.
   *
   * Bhejna tabhi hota hai jab user sach me ruk jaye (`flushSession`). Poori
   * wajah `sessionText` par likhi hai.
   */
  function commitPiece(text: string, alts: string[] = []) {
    const t = text.trim();
    if (!t) return;
    // Wahi tukda dobara (final ke baad `end` par interim) — jodna nahi hai.
    if (sessionText.current.endsWith(t)) return;
    sessionText.current = sessionText.current ? `${sessionText.current} ${t}` : t;
    if (sessionAlts.current.length === 0 && alts.length) sessionAlts.current = alts;
    // Jo koshish sach me chali, wo phone par yaad rakh lo — agli baar seedha
    // wahi chalegi aur mic bina der ke khulega.
    rememberAttempt(attemptRef.current);
  }

  /**
   * Jama hua poora text screen ko de do — ek session me sirf EK BAAR.
   *
   * ⚠️ `release()` se PEHLE chalna chahiye: release session ka jama hua sab kuch
   * saaf kar deta hai, aur uske baad bhejne ko kuch bachta hi nahi.
   */
  function flushSession() {
    if (emitted.current) return;
    const t = sessionText.current.trim();
    if (!t) return;
    emitted.current = true;
    // Khaali/duplicate guess AI ke liye sirf shor hain — chhaan ke bhejo.
    const extra = sessionAlts.current
      .map((a) => a.trim())
      .filter((a, i, all) => a && a !== t && all.indexOf(a) === i);
    onText(t, extra.length ? extra : undefined);
  }

  /** Ye event abhi wale, zinda session ka hai? */
  const live = () => isMine() && !deadSession.current;

  /**
   * Aisi galti jispar dobara koshish ka koi matlab nahi.
   *
   * `not-allowed` = permission (ilaaj user ke haath me hai, chup-chaap dobara
   * chalane se use kuch pata hi nahi chalta). `aborted` = humne KHUD kaata
   * (doosri mic, screen band) — wo device ki kami nahi hai.
   */
  const fatalError = (err: string | undefined) => err === "not-allowed" || err === "aborted";

  useSpeechRecognitionEvent("result", (e) => {
    if (!live()) return;
    const best = e.results?.[0]?.transcript?.trim();
    if (!best) return;
    // Baaki guess — pehle ke alawa. Interim par bhi rakh lete hain, kyunki kai
    // OEM `isFinal` bhejte hi nahi (upar `lastInterim` par poori wajah likhi
    // hai) aur wahan bhi ye guess utne hi kaam ke hain.
    const alts = (e.results ?? []).slice(1).map((r) => r?.transcript ?? "");
    if (e.isFinal) {
      // ⚠️ Jama karo, bhejo NAHI. Final ka matlab sirf itna hai ki RECOGNIZER ne
      // is tukde par faisla kar liya — user ne apni baat khatam ki, ye uska
      // saboot nahi hai. Bhejna `end` par hota hai, aur tabhi jab user sach me
      // ruk chuka ho. (Poori wajah `sessionText` par likhi hai.)
      commitPiece(best, alts);
      gotResult.current = true;
      /**
       * ⚠️ Is tukde ka interim ab khatam — use saaf karna ZAROORI hai.
       *
       * Interim final se PEHLE aate hain aur aksar aadhe hote hain ("kal su"
       * jabki final "kal subah" hai). Continuous me session ke aakhir me hum
       * bacha hua interim bhi jama karte hain (neeche `end` me) — bina yahan
       * saaf kiye wo aadha tukda poore wakya ke aage dobara jud jaata.
       */
      lastInterim.current = "";
      lastAlts.current = [];
    }
    // Final nahi hai — abhi likhna nahi, bas yaad rakhna.
    else {
      lastInterim.current = best;
      lastAlts.current = alts;
    }
  });
  /**
   * Session bina kuch sune hi turant mar gaya — agli koshish par chalo.
   *
   * `true` lauta to caller ko kuch nahi kehna hai (na toast, na release): nayi
   * koshish raaste me hai. Poori soch `ATTEMPTS` ke upar likhi hai.
   */
  function escalated(why: string): boolean {
    // Ek tukda bhi jama ho chuka ho to ye galat options/recognizer wali soorat
    // hai hi nahi — wahan sab kuch chal raha hai.
    if (heard() || gotResult.current || lastInterim.current) return false;
    if (volumeTicks.current > 0) return false; // mic sach me sun rahi thi
    if (Date.now() - startedAt.current > INSTANT_DEATH_MS) return false;
    if (intent.current === "none") return false; // user ne haath hi hata liya

    let next = nextAttempt(attemptRef.current);
    /**
     * Google wali koshish ka koi matlab nahi agar us phone par Google ka
     * recognizer hai hi nahi.
     *
     * ⚠️ Yahan pehle `next = null` tha, aur tarteeb badalne ke baad wo ek asli
     * bug ban jaata: ab `google` beech me hai, isliye uspar ruk jaane ka matlab
     * hota ki `plain` (aakhri sahara) tak kabhi pahuncha hi na jaye. Us phone
     * par voice hamesha ke liye band ho jaati. Isliye ab uske AAGE badhte hain.
     */
    if (next === "google" && !googleService()) next = nextAttempt("google");
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
        // Yahan text khaali hi hota hai (escalation tabhi chalta hai jab kuch
        // suna hi na gaya ho), par har raaste par ek hi tarteeb rakhni hai:
        // pehle bhejo, phir chhodo.
        flushSession();
        release();
        return;
      }
      void startListening({ attempt: next });
    }, 200);
    return true;
  }

  /**
   * User abhi bhi bolna chahta hai aur recognizer ne bina kuch sune chhod diya —
   * chup-chaap dobara chalu kar do.
   *
   * `true` lauta to caller ko kuch nahi karna: na toast, na release. Poori soch
   * `RESTART_MAX` ke upar likhi hai.
   */
  function keepListening(): boolean {
    /**
     * ⚠️ Yahan pehle sabse pehli line ye thi:
     *
     *     if (gotResult.current || lastInterim.current) return false;
     *
     * Yaani "kuch mil gaya — ab dobara sunne ka koi matlab nahi". Aur wahi is
     * poore feature ka sabse bada bug tha.
     *
     * Kuch MIL jaana ye nahi batata ki user ki baat KHATAM ho gayi. Recognizer 3
     * second ki chuppi par tukda band kar deta hai; aadmi bolte waqt itna rukta
     * hi hai. Us line ki wajah se mic wahin band ho jaati thi, jabki ungli abhi
     * bhi button par hoti thi — aur aage bola hua sab kuch ek band mic me jaata
     * tha.
     *
     * Ab faisla sirf USER ke iraade se hota hai: ungli lagi hai (ya tap-mode
     * chalu hai) to sunte raho, chahe ek tukda mil chuka ho. Jo mila hai wo
     * `sessionText` me surakshit pada hai — kuch khota nahi.
     */
    // User ne haath hi hata liya (hold chhoda / tap se band kiya).
    if (intent.current === "none") return false;
    if (listeningSince.current && Date.now() - listeningSince.current > LISTEN_MAX_MS) {
      return false;
    }
    /**
     * Do alag chhat, aur ye farq zaroori hai:
     *   • Kuch suna hi nahi -> sirf 2 koshish. Toote hue recognizer par har
     *     restart do beep bajata hai; wahan chhat chhoti honi chahiye.
     *   • Kuch suna ja chuka hai -> 6 tak. Yahan har restart ka asli kaam hai:
     *     user ke agle shabd pakadna.
     */
    if (restarts.current >= (heard() ? RESTART_MAX_HEARD : RESTART_MAX)) return false;

    restarts.current += 1;
    /**
     * ⚠️ Purane session ko murda chihnit karna zaroori hai — bilkul wahi wajah
     * jo `escalated()` me likhi hai. Native side ek fail par DO event bhejta hai
     * (`error` phir `end`); bina is jhande ke doosra event nayi koshish ko hi
     * maar deta.
     */
    deadSession.current = true;
    setTimeout(() => {
      if (!isMine() || intent.current === "none") {
        deadSession.current = false;
        /**
         * ⚠️ `flushSession()` yahan hona ZAROORI hai. Ungli theek is 150ms ke
         * beech me uth jaana bilkul aam hai (user ne bolna khatam kiya aur
         * chhod diya), aur bina is line ke us poore hold ka jama hua text
         * `release()` ke saath chup-chaap mit jaata — user bolta rehta aur
         * screen par kuch aata hi nahi.
         */
        flushSession();
        release();
        return;
      }
      // Wahi koshish (attempt) dobara — yahan galti options ki nahi, sirf
      // recognizer ke sabra ki hai.
      void startListening({ attempt: attemptRef.current, keepAlive: true });
    }, 150);
    return true;
  }

  useSpeechRecognitionEvent("end", () => {
    if (!live()) return;
    /**
     * Bacha hua interim bhi jama karo.
     *
     * ⚠️ Shart ab `!gotResult` par NAHI hai, aur ye continuous mode ki wajah se
     * zaroori hai: wahan ek hi sunwaai me KAI final aate hain, aur `gotResult`
     * pehle final par hi sach ho jaata hai. Purani shart ke saath aakhri wo
     * tukda gir jaata jise recognizer stop hone se pehle finalize nahi kar paya
     * — yaani user ka aakhri wakya. (Final aate hi uska interim saaf ho jaata
     * hai, isliye yahan kuch dobara nahi judta.)
     */
    if (lastInterim.current) {
      commitPiece(lastInterim.current, lastAlts.current);
      gotResult.current = true;
    }
    // Kuch suna hi nahi — options/recognizer galat ho sakta hai.
    if (!heard() && escalated("end")) return;
    /**
     * User abhi bhi bolna chahta hai — mic band mat karo.
     *
     * ⚠️ Ye shart ab `gotResult` par NAHI hai. Pehle thi, aur wahi bug tha: ek
     * tukda milte hi mic band ho jaati thi jabki ungli button par hi thi. Ab
     * faisla sirf user ke iraade se hota hai (poori wajah `keepListening()` par).
     */
    if (keepListening()) return;
    // Ab bhi kuch nahi — tabhi kuch kehna hai. Mil gaya to chup rehna behtar.
    if (!heard()) hintForSilence();
    flushSession();
    release();
  });
  useSpeechRecognitionEvent("error", (e) => {
    if (!live()) return;
    // Error ke baad bhi wo interim sach hi hai jo mic ne sun liya tha —
    // "no-speech" ke saath aksar aadha wakya pehle hi aa chuka hota hai.
    if (lastInterim.current) {
      commitPiece(lastInterim.current, lastAlts.current);
      gotResult.current = true;
    }
    if (!heard()) {
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
      const fatal = fatalError(e?.error);
      if (!fatal && escalated(e?.error ?? "unknown")) return;
      /**
       * ⚠️ "Kuch sunayi nahi diya" par toast NAHI — dobara sunna.
       *
       * `no-speech` / `speech-timeout` ka matlab sirf itna hai ki recognizer ne
       * apne hisaab se sabra khatam kar diya (Android par wo 2-5 second me hi
       * kar deta hai, aur wo waqt badla nahi ja sakta). Us par user ko "awaaz
       * saaf nahi aayi" dikhana do tarah se galat tha: baat awaaz ki thi hi
       * nahi, aur user abhi bolna shuru hi kar raha tha. Wahi "bolne ka mauka
       * hi nahi milta" wali shikayat thi.
       */
      const silence = e?.error === "no-speech" || e?.error === "speech-timeout";
      if (!fatal && silence && keepListening()) return;
      toast.show(errorLine(e?.error), "info");
    } else if (!fatalError(e?.error) && keepListening()) {
      /**
       * Kuch suna ja chuka hai aur user abhi bhi bol raha hai — error ke baad
       * bhi sunte raho.
       *
       * ⚠️ Ye branch pehle thi hi nahi: kuch mil jaane par error seedha
       * `release()` par gir jaata tha aur baaki baat kho jaati thi. Aur yahi
       * sabse aam raasta hai — lamba viraam par Android `no-speech` bhejta hai,
       * `end` nahi.
       */
      return;
    }
    flushSession();
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
    // Restart par ginti wapas 0 nahi honi chahiye — user ke liye wo ek hi
    // lagatar sunwaai hai. Isliye reset sirf nayi shuruaat par (`startListening`
    // me, `!keepAlive` wale hisse me).

    peak.current = 0;
    loudTicks.current = 0;
    volumeTicks.current = 0;
    gotResult.current = false;
    lastInterim.current = "";
    lastAlts.current = [];
    /**
     * ⚠️ Purani loop pehle ROKO.
     *
     * `beginUi()` har restart par dobara chalta hai (chuppi wala `keepListening`,
     * aur `escalated` wala doosra attempt). Bina is line ke har baar ek NAYI
     * `Animated.loop` chadh jaati thi aur purani chalti rehti — do-teen loop ek
     * hi value ko alag-alag taraf kheenchte hain, aur mic ka button kaanpta hua
     * dikhne lagta hai. Us kaanpte button ko dekh ke user ko lagta hai app hi
     * atak gayi.
     */
    pulse.stopAnimation();
    pulse.setValue(1);
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
    // Sunwaai poori tarah khatam — agli baar ginti 0 se (warna ek purani lambi
    // koshish agli baar ke restarts kha jaati).
    restarts.current = 0;
    listeningSince.current = 0;
    // Agli baar taazi shuruaat — warna ek murda-chihnit session ka jhanda agle
    // press par bhi laga rehta aur uske saare event chup-chaap gir jaate.
    deadSession.current = false;
    /**
     * Jama hua text yahin khatam hota hai.
     *
     * ⚠️ `release()` hamesha `flushSession()` ke BAAD chalta hai — har raaste
     * par. Ulta kar diya to bhejne ko kuch bachta hi nahi, aur user ki poori
     * baat chup-chaap mit jaati hai. Yahan saaf karna zaroori hai warna pichhle
     * hold ka text agle hold ke aage jud jaata.
     */
    sessionText.current = "";
    sessionAlts.current = [];
    emitted.current = false;
    if (endGuard.current) {
      clearTimeout(endGuard.current);
      endGuard.current = null;
    }
    if (maxTimer.current) {
      clearTimeout(maxTimer.current);
      maxTimer.current = null;
    }
    setListening(false);
    setSecs(0);
    pulse.stopAnimation();
    pulse.setValue(1);
    level.setValue(0);
  }

  /**
   * Ginti chalti rahe jab tak mic khuli hai.
   *
   * ⚠️ `setSecs(0)` yahan JAAN-BOOJH KE nahi hai (wo `startListening` me hota
   * hai). Effect ke body me seedha setState karna is repo me rok hua hai
   * (`react-hooks/set-state-in-effect`) aur wo rok sahi hai — wo ek extra
   * render chain banata hai. Yahan sirf interval lagta hai.
   *
   * Restart ke aar-paar `listening` sach hi rehta hai, isliye ginti tootti nahi
   * — user ke liye wo ek hi lagatar sunwaai hai.
   */
  useEffect(() => {
    if (!listening) return;
    const from = Date.now();
    const id = setInterval(() => setSecs(Math.floor((Date.now() - from) / 1000)), 500);
    return () => clearInterval(id);
  }, [listening]);

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
    /**
     * Maalik badalne par purana button apna UI shaant kar sake — registry me
     * apna haath rakh do.
     *
     * ⚠️ `release` akela NAHI — pehle `flushSession()`. Add-reminder par DO mic
     * hain; user pehle wale me bol chuka ho aur doosra daba de, to uska jama hua
     * text yahin mit jaata tha (release sab saaf kar deta hai). Wo baat user ne
     * sach me boli thi, aur wo usi field ki hai jahan bola tha.
     */
    ownerReset.set(me, () => {
      flushSession();
      release();
    });
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
  async function startListening({
    attempt,
    /**
     * Ye ek chalti hui sunwaai ka agla hissa hai (chuppi ke baad dobara), nayi
     * shuruaat nahi.
     *
     * ⚠️ Ye jhanda isliye chahiye ki `beginUi()` sab kuch reset kar deta hai —
     * `restarts` aur `listeningSince` samet. Bina iske dono ginti har restart
     * par 0 ho jaati aur DONO chhat (RESTART_MAX, LISTEN_MAX_MS) kabhi lagti hi
     * nahi: mic hamesha ke liye khuli reh sakti thi.
     */
    keepAlive,
  }: { attempt?: Attempt; keepAlive?: boolean } = {}) {
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
      /**
       * Permission ka popup khula tha aur us beech iraada khatam ho gaya (user
       * ne ungli hata li ya doosri jagah tap kar diya) — ab mic chalu karna
       * bekaar hai, aur wo chup kamre me chalti rehti.
       *
       * ⚠️ Yahan pehle sirf DO ref saaf hote the (`starting`, `deadSession`) aur
       * `release()` chalta hi nahi tha. Wahi is file ka sabse bura bug tha, aur
       * user ki shikayat theek uske upar baithti hai ("voice kaam nahi kar raha,
       * bol rahe hain lekin kuch nahi hota"):
       *
       *   • `listening` (React state) TRUE pada reh jaata tha — mic ka button
       *     hamesha ke liye laal, jaise wo abhi bhi sun raha ho.
       *   • `activeOwner` is button ke naam par claimed reh jaata tha — yaani us
       *     screen par (aur kisi bhi doosre mic par) agli baar `startListening`
       *     pehle `abort()` maarta aur sab kuch aur uljh jaata.
       *
       * Aur ye soorat aam hai, kinare ki nahi: `keepListening()` ka restart
       * 150ms ke timer par chalta hai, aur ungli uske theek beech me uthna
       * bilkul normal hai. Ek baar aisa hote hi us screen par voice khatam.
       */
      if (intent.current === "none") {
        release();
        return;
      }

      // Pehli baar phone se poochho ki kaunsi koshish pehle chal chuki hai.
      await loadLearnedAttempt();
      const mode: Attempt = attempt ?? learnedAttempt ?? "tuned";
      const service = mode === "google" ? googleService() : null;

      activeOwner = meRef.current;
      beginUi();
      startedAt.current = Date.now();
      if (!keepAlive) {
        listeningSince.current = Date.now();
        restarts.current = 0;
        /**
         * Nayi sunwaai — purana jama hua text saath mat le jao.
         *
         * `release()` waise bhi saaf kar deta hai, par har raaste par release
         * chalta ho ye maan lena is file me pehle bhi mehnga pad chuka hai
         * (permission ka popup, unmount, doosri mic). Do jagah saaf karna sasta
         * hai; ek purana wakya agle reminder ke aage chipak jaana nahi.
         */
        sessionText.current = "";
        sessionAlts.current = [];
        emitted.current = false;
        setSecs(0);
        // Mic ki chhat — continuous me recognizer khud kabhi nahi rukta.
        if (maxTimer.current) clearTimeout(maxTimer.current);
        maxTimer.current = setTimeout(() => {
          maxTimer.current = null;
          if (!isMine()) return;
          intent.current = "none";
          if (live()) stopListening();
          else {
            flushSession();
            release();
          }
        }, LISTEN_MAX_MS);
      }
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
        /**
         * ── Mic khuli rahe, jab tak USER na roke ──────────────────────────
         *
         * ⚠️ Yahan pehle `false` tha, aur wahi is poore feature aur WhatsApp ke
         * beech ka asli farq tha.
         *
         * `false` par Android ka recognizer ek "command" sunta hai: 3 second ki
         * chuppi milte hi wo session KHATAM kar deta hai. Aadmi bolte waqt rukta
         * hai, isliye ek hi wakya kai tukdon me tootta tha — aur har tukde ke
         * beech mic band hoti thi, do system beep bajte the, aur us khidki me
         * bola hua girta tha.
         *
         * `true` par (Android 13+ aur iOS) session tab tak zinda rehta hai jab
         * tak hum khud `stop()` na bhejein — theek WhatsApp ke voice note jaisa.
         * Beech ke viraam se kuch nahi hota, koi beep nahi, kuch girta nahi.
         *
         * ⚠️ Ye SIRF `tuned` me hai, aur ye jaan-boojh ke hai. Android 12 aur
         * usse purane par ye option hai hi nahi, aur kuch OEM recognizer ise
         * maante hi nahi. Wahan session bina kuch sune turant marta hai — aur
         * wahi `escalated()` ki shart hai, jo agli koshish (`plain`) par le
         * jaata hai jahan continuous hai hi nahi. Us phone par jo koshish chali
         * wo yaad rakh li jaati hai, isliye ye jaanch ek hi baar hoti hai.
         *
         * Restart wala purana raasta hataya NAHI gaya — wo ab bhi un phones ko
         * sambhalta hai jahan continuous nahi chalta (`keepListening()`).
         */
        continuous: canContinuous(mode),
        // Saare guess chahiye — chunav AI karta hai, app nahi. Poori wajah file
        // ke sar par likhi hai ("kabhi sahi, kabhi nahi" ki asli jad yahi thi).
        maxAlternatives: MAX_ALTERNATIVES,
        /**
         * Biasing `tuned` aur `google` dono me — sirf `plain` me nahi.
         *
         * ⚠️ Pehle ye sirf `tuned` me tha, is darr se ki koi anjaan option
         * purane Android par session maar dega. Wo darr `androidIntentOptions`
         * ke liye SAHI hai (wahan native reflection use karta hai aur field na
         * milne par poora intent gir jaata hai), par `contextualStrings` uska
         * hissa hai hi nahi — native khud `Build.VERSION >= TIRAMISU` dekh ke
         * lagata hai, warna chup-chaap chhod deta hai.
         *
         * Isliye Samsung/Xiaomi wale users (jo ab `google` par aate hain) bina
         * wajah ke biasing se mehroom the — aur wo India me bahut bada hissa hai.
         * `plain` aakhri sahara hai; wahan bare-minimum hi jaana chahiye.
         */
        ...(mode === "plain" ? {} : { contextualStrings: BIAS_WORDS }),
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
          ? { androidIntentOptions: androidTuning(canContinuous(mode)) }
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
      // Bacha hua interim bhi jama karo (final aate hi wo saaf ho chuka hota
      // hai, isliye yahan kuch dobara nahi judta).
      if (lastInterim.current) commitPiece(lastInterim.current, lastAlts.current);
      if (!heard()) hintForSilence();
      flushSession();
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
      // hi nahi raha; restart/escalation ka timer `intent === "none"` dekh ke
      // khud ruk jaata hai, jama hua text bhejta hai aur UI shaant kar deta hai.
      //
      // ⚠️ Yahan seedha `release()` MAT karna. Wo session ka jama hua saara text
      // saaf kar deta hai, aur uske baad timer ke paas bhejne ko kuch bachta hi
      // nahi — user ki poori boli hui baat chup-chaap gum ho jaati. Bhejna
      // pehle, chhodna baad me — poore file me yahi ek tarteeb hai.
      if (live()) stopListening();
      else {
        flushSession();
        release();
      }
      return;
    }

    // Warna: ye chalu karne wala tap tha — mic chalti rehne do, agle tap tak.
    intent.current = "tap";
  }

  /** 0:07 */
  const clock = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  return (
    /**
     * ⚠️ Ye bahar wala `View` sirf patti ke liye hai, aur patti `Animated.View`
     * ke BAHAR honi chahiye. Andar rakhne par wo `pulse` ke saath phoolti-sikudti
     * hai aur text kaanpta hua dikhta hai.
     */
    <View>
      {/**
       * "Sun raha hoon 0:07 · tap karke roko"
       *
       * ⚠️ Ye patti isliye hai ki tap-se-band karne wala raasta MAUJOOD to tha
       * par kahin DIKHTA nahi tha — button dono haalat me bilkul ek jaisa lagta
       * tha. User ungli dabaye rakhta tha aur haath thakne par chhod deta tha.
       * WhatsApp aur ChatGPT dono me yahi baat timer aur stop se saaf dikhti hai.
       *
       * `position: absolute` — isse kisi bhi screen ka layout nahi hilta (ye
       * button chaar alag jagah lagta hai, aur wahan chaudai badalna sabse bura
       * hota). `pointerEvents="none"` taaki tap patti me nahi, button me jaye.
       */}
      {listening && (
        <View pointerEvents="none" style={styles.pill}>
          <View style={styles.pillDot} />
          <Text style={styles.pillText} numberOfLines={1}>
            {v.listening} {clock} · {v.tapToStop}
          </Text>
        </View>
      )}
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
          {/* ⚠️ Sunte waqt STOP ka nishaan, mic ka nahi. Mic ka icon "abhi
              bologe" kehta hai; user ko us pal ye jaanna hai ki "ab rok sakte
              ho". Yahi ek nishaan tap-se-band wale raaste ko dikhata hai. */}
          <Ionicons
            name={listening ? "stop" : "mic-outline"}
            size={listening ? 18 : 20}
            color={listening ? tc.white : tc.terracotta}
          />
        </View>
      </Pressable>
      </Animated.View>
    </View>
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
  /**
   * Button ke UPAR taerti patti. `absolute` isliye ki ye chaar alag screens par
   * lagta hai — wahan chaudai badalna input ko hila deta.
   */
  pill: {
    position: "absolute",
    bottom: 56,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: c.ink,
    // Android par bina iske ye patti bhai-behen views ke NEECHE chali jaati hai.
    elevation: 6,
    zIndex: 10,
  },
  /** Laal bindi — "abhi chal raha hai" ka sabse seedha nishaan. */
  pillDot: { height: 7, width: 7, borderRadius: 4, backgroundColor: c.danger },
  pillText: { color: c.cream, fontSize: 12, fontWeight: "700" },
  level: {
    position: "absolute",
    height: 46,
    width: 46,
    borderRadius: 23,
    backgroundColor: c.white,
  },
}));
