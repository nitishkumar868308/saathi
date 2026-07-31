import { useEffect, useState } from "react";
import { Platform, Vibration } from "react-native";
import * as Speech from "expo-speech";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { DEFAULT_LOCALE, type Locale } from "./i18n/dictionaries";

/**
 * App ke apne popup kaise "sunayi" dein — ring, vibrate, ya chup.
 *
 * Phone ka ringer mode app ke andar ke popup par lagu nahi hota: Saathi ka
 * internet-alert ya reminder-alert app ke andar khulta hai, isliye OS ka
 * silent switch use nahi rok paata. Aur ulta bhi sach hai — phone silent par ho
 * to bhi user chaahta hai ki zaroori baat kam se kam vibrate kare.
 *
 * Isliye app ka apna switch (item 6):
 *
 *   ring     — Saathi bolta hai ("Hello Ravi, Notification From Apka Saathi")
 *              aur saath me halka vibrate. Default yahi hai.
 *   vibrate  — koi awaaz nahi, sirf vibrate.
 *   silent   — kuch nahi, sirf popup dikhta hai.
 *
 * Setting device par local hai (AsyncStorage) — server par kuch nahi jaata.
 */

export const ALERT_MODES = ["ring", "vibrate", "silent"] as const;
export type AlertMode = (typeof ALERT_MODES)[number];

const KEY = "saathi-alert-mode";
export const DEFAULT_ALERT_MODE: AlertMode = "ring";

/** Alert khulte hi ek chhoti si thap — lamba pattern chidhchida lagta hai. */
const BUZZ_PATTERN = [0, 220, 120, 220];

/* --------------------------- store + subscribe --------------------------- */

// Yaad rakha hua mode — har alert par AsyncStorage padhna slow hai, aur popup
// khulne aur awaaz aane ke beech ka wo gap saaf mehsoos hota hai.
let cached: AlertMode = DEFAULT_ALERT_MODE;
let loaded = false;
const listeners = new Set<(m: AlertMode) => void>();

function isMode(v: unknown): v is AlertMode {
  return typeof v === "string" && (ALERT_MODES as readonly string[]).includes(v);
}

/** App start pe ek baar — uske baad sab kuch memory se chalta hai. */
export async function loadAlertMode(): Promise<AlertMode> {
  if (loaded) return cached;
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (isMode(saved)) cached = saved;
  } catch {
    /* storage na chale to default hi theek hai */
  }
  loaded = true;
  listeners.forEach((l) => l(cached));
  return cached;
}

export function getAlertMode(): AlertMode {
  return cached;
}

export async function setAlertMode(mode: AlertMode): Promise<void> {
  cached = mode;
  loaded = true;
  listeners.forEach((l) => l(mode));
  try {
    await AsyncStorage.setItem(KEY, mode);
  } catch {
    /* save na ho to is session me to laga hi rahega */
  }
}

/** Settings screen ke liye — mode aur usse badalne ka tareeka. */
export function useAlertMode(): [AlertMode, (m: AlertMode) => void] {
  const [mode, setMode] = useState<AlertMode>(cached);

  useEffect(() => {
    listeners.add(setMode);
    // Pehli baar mount hone par storage se padh lo (baad me cache se milega).
    void loadAlertMode();
    return () => {
      listeners.delete(setMode);
    };
  }, []);

  return [mode, (m) => void setAlertMode(m)];
}

/* ------------------------------- bolna ------------------------------- */

/** App me chuni bhasha → TTS ke liye BCP-47 tag. */
function ttsLang(loc: Locale): string {
  // Hinglish Roman script me hota hai — Hindi voice usse theek padh deti hai.
  return loc === "en" ? "en-IN" : "hi-IN";
}

/* ------------------------- achhi awaaz chunna ------------------------- */

/**
 * Phone me ek nahi, kai awaazein hoti hain — aur unme fark zameen-aasmaan ka
 * hai.
 *
 * ⚠️ Pehle hum sirf `language` deke chhod dete the. Us soorat me system apni
 * DEFAULT awaaz uthata hai, jo aksar sabse purani aur sabse robotic hoti hai
 * (Android par kai phone me abhi bhi eSpeak-type awaaz default hai). User ne
 * bilkul thik pakda: "lagta hai koi machine bol rahi hai" (item 3).
 *
 * Usi phone me aksar Google ki network/enhanced awaaz maujood hoti hai jo
 * kaafi insaani lagti hai — bas use maangna padta hai. Isliye ab ek baar saari
 * awaazein dekh ke sabse achhi chun lete hain, aur wahi har baar use hoti hai.
 */

/** Ek hi baar chunna hai — har alert par poori list padhna slow hai. */
const voiceCache = new Map<string, string | null>();

/** Jitna zyada number, utni insaani awaaz. */
function voiceScore(v: Speech.Voice, lang: string): number {
  const id = (v.identifier ?? "").toLowerCase();
  const vLang = (v.language ?? "").toLowerCase().replace("_", "-");
  let score = 0;

  // Theek wahi desh ka lehja (hi-IN / en-IN) — "en-US" se kahin behtar baithta hai.
  if (vLang === lang.toLowerCase()) score += 5;

  // iOS: Enhanced/Premium awaazein alag se download hoti hain aur saaf behtar hain.
  if (String(v.quality).toLowerCase() === "enhanced") score += 10;

  // Android: "network" wali Google ki server-side awaaz sabse natural hai.
  if (id.includes("network")) score += 8;
  if (id.includes("premium") || id.includes("enhanced") || id.includes("neural")) score += 8;
  // Google ka apna engine kisi bhi OEM ke default se behtar hota hai.
  if (id.includes("com.google")) score += 3;

  // ⚠️ Ye wahi purani robotic awaaz hai jisse bachna hai.
  if (id.includes("espeak") || id.includes("pico")) score -= 20;

  return score;
}

/**
 * Is bhasha ke liye sabse achhi awaaz ka identifier — na mile to null (tab
 * system apni default se hi bol lega, jo pehle hota hi tha).
 */
async function bestVoice(lang: string): Promise<string | null> {
  const hit = voiceCache.get(lang);
  if (hit !== undefined) return hit;

  let chosen: string | null = null;
  try {
    const all = await Speech.getAvailableVoicesAsync();
    const base = lang.split("-")[0].toLowerCase();
    const pool = all.filter((v) =>
      (v.language ?? "").toLowerCase().replace("_", "-").startsWith(base),
    );
    if (pool.length > 0) {
      const best = pool.reduce((a, b) => (voiceScore(b, lang) > voiceScore(a, lang) ? b : a));
      // Sirf tab chuno jab wo default se sach me behtar ho — warna system ko
      // hi chunne do, wo device ke hisaab se theek hota hai.
      if (voiceScore(best, lang) > 0) chosen = best.identifier ?? null;
    }
  } catch {
    /* list na mile to default awaaz se hi kaam chalega */
  }

  voiceCache.set(lang, chosen);
  return chosen;
}

async function savedLocale(): Promise<Locale> {
  try {
    const s = await AsyncStorage.getItem("saathi-locale");
    if (s === "hi" || s === "en" || s === "hinglish") return s;
  } catch {
    /* default */
  }
  return DEFAULT_LOCALE;
}

/** User ka naam — TTS greeting me. App start pe auth-provider ise bhar deta hai. */
let userName: string | null = null;

export function setAlertUserName(name: string | null | undefined): void {
  const n = name?.trim();
  // Email ya khaali naam se greeting bhaddi lagti hai ("Hello aapka@mail.com") —
  // aise me sirf "Hello" hi behtar hai.
  userName = n && !n.includes("@") ? n.split(/\s+/)[0] : null;
}

/**
 * Greeting — user ne bola tha: "Hello <naam>" + "Notification From Apka Saathi".
 *
 * Jaan-boojh ke English me hai, chaahe app kisi bhi bhasha me ho: user ne yahi
 * line maangi thi, aur "Apka Saathi" brand ka naam hai — usse anuvaad karna
 * galat hoga.
 */
export function greetingLine(): string {
  // Comma jaan-boojh ke hai: full-stop par TTS poora ruk ke dobara shuru karta
  // hai, jisse "Hello Nitish." aur "Notification From Apka Saathi." do alag
  // announcement lagti thi — bilkul machine jaisi. Comma par wo halka sa rukta
  // hai aur ek hi wakya lagta hai (item 3). Shabd wahi hain jo user ne maange the.
  return userName
    ? `Hello ${userName}, notification from Apka Saathi.`
    : "Hello, notification from Apka Saathi.";
}

/* ------------------------------ alert karo ------------------------------ */

/**
 * Popup khulte hi user ka dhyaan kheencho — mode ke hisaab se.
 *
 * `message` ho to greeting ke baad wo bhi bola jaata hai (reminder ka kaam,
 * document ka naam). Sirf greeting bhi chalti hai — internet wale popup me
 * padhne ko waise bhi screen par sab likha hai.
 *
 * Best-effort: TTS ya vibrator na ho to chup-chaap nikal jaata hai. Popup to
 * dikh hi raha hai — awaaz na aane par kuch tootna nahi chahiye.
 */
export async function alertUser(message?: string): Promise<void> {
  const mode = loaded ? cached : await loadAlertMode();
  if (mode === "silent") return;

  if (Platform.OS !== "web") {
    try {
      Vibration.vibrate(BUZZ_PATTERN);
    } catch {
      /* kuch device par vibrator nahi hota */
    }
  }
  if (mode !== "ring") return;

  try {
    const loc = await savedLocale();
    const lang = ttsLang(loc);
    // Do alert pass-pass aayein to pehli awaaz kaat do — warna dono ek saath
    // bolti hain aur kuch samajh nahi aata.
    Speech.stop();

    const voice = await bestVoice(lang);
    // Greeting aur kaam — dono alag utterance hain, to error bhi dono par aa
    // sakta hai. Fallback sirf EK baar bolna hai, warna user ko poori baat do
    // baar sunayi degi.
    let recovered = false;
    const opts: Speech.SpeechOptions = {
      language: lang,
      // Ek zara si ooncha pitch awaaz ko "flat machine" jaisa hone se bachata
      // hai; isse zyada karne par wo bachkani lagne lagti hai.
      pitch: 1.03,
      // 0.95 abhi bhi jaldbaazi me bolta tha — reminder ka kaam sun-ne se pehle
      // hi nikal jaata tha. Itne par har shabd alag sunayi deta hai.
      rate: 0.88,
      ...(voice ? { voice } : {}),
      // Network awaaz ke liye internet chahiye. Net na ho to wo chup-chaap fail
      // ho jaati thi — yaani popup par bilkul sannata. Aise me system ki apni
      // awaaz se dobara bol do; robotic sahi, chup se to behtar hai.
      onError: () => {
        if (recovered) return;
        recovered = true;
        // Wo awaaz is device par chali hi nahi — dobara mat chuno.
        voiceCache.set(lang, null);
        try {
          Speech.stop();
          Speech.speak(fullLine(message), { language: lang, pitch: 1.03, rate: 0.88 });
        } catch {
          /* ab kuch nahi ho sakta — vibrate to ho hi chuka hai */
        }
      },
    };

    /**
     * Greeting aur kaam — do alag utterance me.
     *
     * ⚠️ Pehle dono ek hi line me jud ke jaate the ("…Apka Saathi. Dawai leni
     * hai"), aur TTS use ek hi saans me bina ruke bol deta tha. Insaan aise
     * nahi bolta, aur yahi sabse zyada "AI bol raha hai" wala ehsaas deta tha.
     * Alag utterance ke beech engine khud ek swabhavik viraam leta hai.
     */
    Speech.speak(greetingLine(), opts);
    const body = message?.trim();
    if (body) Speech.speak(body, opts);
  } catch {
    /* TTS na ho to vibrate se hi kaam chal jaayega */
  }
}

/** Fallback ke liye ek hi line — wahan do utterance ka jhanjhat nahi chahiye. */
function fullLine(message?: string): string {
  const body = message?.trim();
  return body ? `${greetingLine()} ${body}` : greetingLine();
}

/** Popup band hua — bolna aur vibrate dono rok do. */
export function stopAlert(): void {
  try {
    Speech.stop();
  } catch {
    /* ignore */
  }
  try {
    Vibration.cancel();
  } catch {
    /* ignore */
  }
}
