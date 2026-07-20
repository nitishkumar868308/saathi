import * as Speech from "expo-speech";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { DEFAULT_LOCALE, type Locale } from "./i18n/dictionaries";

/**
 * Reminder/expiry ko bol ke sunana (TTS).
 *
 * Notification me sirf beep aati thi — user ko phone uthake padhna padta tha.
 * Ab Saathi document/reminder ka naam aur kaam bol deta hai ("Car insurance kal
 * expire ho raha hai"), taaki bina dekhe samajh aa jaaye.
 *
 * Ye tabhi bolta hai jab app JS chala sakti ho — yaani app khula ho, ya user
 * notification tap karke aaye. (App poori tarah killed ho to koi JS/TTS nahi
 * chal sakta — wo OS ki limitation hai.)
 */

/** App me chuni bhasha → TTS ke liye BCP-47 tag. */
function ttsLang(loc: Locale): string {
  switch (loc) {
    case "hi":
      return "hi-IN";
    case "en":
      return "en-IN";
    case "hinglish":
    default:
      // Hinglish Roman script me hota hai — Hindi voice usse theek padh deti hai.
      return "hi-IN";
  }
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

/** Reminder/expiry text bol do (user ki chuni bhasha me). Best-effort. */
export async function speakReminder(text: string): Promise<void> {
  const body = text?.trim();
  if (!body) return;
  try {
    const loc = await savedLocale();
    // Pehli awaaz ko rok do (agar do notification pass-pass aayein).
    Speech.stop();
    Speech.speak(body, {
      language: ttsLang(loc),
      pitch: 1.0,
      rate: 0.95, // thoda dheere — saaf samajh aaye
    });
  } catch {
    /* TTS na ho to sirf notification sound se kaam chalega */
  }
}

/** Bolna band karo (alert dismiss pe). */
export function stopSpeaking(): void {
  try {
    Speech.stop();
  } catch {
    /* ignore */
  }
}
