import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";

import { supabase } from "./supabase";

/**
 * Device ki pehchaan — do kaam ke liye:
 *
 *  1. App khulte hi pata chal jaaye ki ye phone pehle aa chuka hai. Naya ho to
 *     language-select dikhate hain, purana ho to seedha login (item 26).
 *  2. Ek phone sirf EK BAAR referral reward le sake. Pehle naya email banake,
 *     apna hi code daal ke, usi phone se baar-baar 15-15 din liye ja sakte the.
 *
 * ID kaise banti hai: pehli baar ek random UUID banake SecureStore me rakh dete
 * hain. Ye logout/login aur app update se nahi jaata (uninstall se jaata hai —
 * isliye fingerprint alag se bhejte hain, taaki server ke paas ek doosra ishaara
 * bhi rahe).
 *
 * ⚠️ Yahan koi advertising ID / IMEI nahi — Play Store policy safe.
 */

const KEY = "saathi-device-id";

/** RFC-4122 v4 jaisa UUID, bina kisi native crypto ke. */
function uuid(): string {
  const hex = "0123456789abcdef";
  let out = "";
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) out += "-";
    else if (i === 14) out += "4";
    // Variant nibble: 8, 9, a ya b.
    else if (i === 19) out += hex[8 + ((Math.random() * 4) | 0)];
    else out += hex[(Math.random() * 16) | 0];
  }
  return out;
}

let memoId: string | null = null;

/** Is install ki sthir ID. Pehli baar par banti hai, phir wahi milti hai. */
export async function getDeviceId(): Promise<string> {
  if (memoId) return memoId;
  try {
    const saved = await SecureStore.getItemAsync(KEY);
    if (saved) {
      memoId = saved;
      return saved;
    }
  } catch {
    /* SecureStore na chale to neeche naya bana denge (session-bhar chalega) */
  }
  const fresh = uuid();
  memoId = fresh;
  try {
    await SecureStore.setItemAsync(KEY, fresh);
  } catch {
    /* best-effort */
  }
  return fresh;
}

/**
 * Brand/model/OS ka chhota sa nishaan. Ye unique NAHI hai (hazaaron phone ek
 * jaise honge) — bas ek extra ishaara hai jab UUID uninstall se mit jaaye.
 */
function fingerprint(): string {
  return [Device.brand, Device.modelName, Device.osName, Device.osVersion]
    .filter(Boolean)
    .join("|")
    .slice(0, 120);
}

export type DeviceInfo = { id: string; known: boolean; language: string | null };

/**
 * Server ko batao ki ye device zinda hai, aur poochho ki pehle dekha tha kya.
 *
 * Login se pehle bhi chalti hai (anon RPC). Server na mile to `known: false`
 * lauta dete hain — app tab language-select dikha dega, jo naye user ke liye
 * sahi default hai.
 */
export async function registerDevice(language?: string): Promise<DeviceInfo> {
  const id = await getDeviceId();
  if (!supabase) return { id, known: false, language: null };
  try {
    const { data, error } = await supabase.rpc("device_seen", {
      p_id: id,
      p_fingerprint: fingerprint(),
      p_platform: Platform.OS,
      p_language: language ?? null,
    });
    if (error || !data) return { id, known: false, language: null };
    const d = data as { known?: boolean; language?: string | null };
    return { id, known: !!d.known, language: d.language ?? null };
  } catch {
    return { id, known: false, language: null };
  }
}
