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
  return userName
    ? `Hello ${userName}. Notification From Apka Saathi.`
    : "Hello. Notification From Apka Saathi.";
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
    // Do alert pass-pass aayein to pehli awaaz kaat do — warna dono ek saath
    // bolti hain aur kuch samajh nahi aata.
    Speech.stop();
    const body = message?.trim();
    Speech.speak(body ? `${greetingLine()} ${body}` : greetingLine(), {
      language: ttsLang(loc),
      pitch: 1.0,
      rate: 0.95, // thoda dheere — saaf samajh aaye
    });
  } catch {
    /* TTS na ho to vibrate se hi kaam chal jaayega */
  }
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
