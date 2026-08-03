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

/* ---------------------------- device ka maalik ---------------------------- */

export type DeviceOwner = {
  /** Is phone par pehle kisi ne login kiya tha? */
  claimed: boolean;
  /** Wahi banda abhi login hai? (tab kuch dikhana nahi) */
  isMe: boolean;
  /** Sirf pehla naam — poora naam server bhejta hi nahi. */
  name: string | null;
  /** Mask kiya hua email — "ra*****@gmail.com". */
  email: string | null;
};

/**
 * Ye phone kiske naam par set hai.
 *
 * ⚠️ Ye rok nahi hai. Ek phone par doosra banda login kar sakta hai — par tab
 * Saathi ki aadhi cheezein chup-chaap us doosre ke naam par chali jaati hain
 * (notification ka token, alarm, referral). Pehle ye kahin likha hi nahi tha,
 * isliye do log samajh nahi paate the ki ek ke reminder kyun aana band ho gaye.
 *
 * Login se PEHLE bhi chalti hai (anon RPC) — login screen par patti dikhane ke
 * liye. Kuch bhi galat ho to `null`: chetavni na dikhna login rokne se behtar hai.
 */
export type OtherDevice = { platform: string | null; lastSeenAt: string | null };

/**
 * Mera account aur kitne phones par login hai (abhi wale ko chhod kar).
 *
 * ⚠️ `deviceOwner()` ka ulta sawaal. Wo poochta hai "is phone par koi aur tha
 * kya"; ye poochta hai "main aur kahan-kahan login hoon". Doosre wale ka jawab
 * kahin tha hi nahi — isliye ek hi ID se paanch phone par login karne par bhi
 * kabhi kuch nahi dikhta tha, jabki reminder ke alarm har phone me alag lagte
 * hain aur admin ka message har phone par jaata hai.
 *
 * Kuch bhi galat ho to `null` — chetavni na dikhna app rok dene se behtar hai.
 */
export async function otherDevices(): Promise<{ count: number; devices: OtherDevice[] } | null> {
  if (!supabase) return null;
  try {
    const id = await getDeviceId();
    const { data, error } = await supabase.rpc("my_other_devices", { p_id: id });
    if (error || !data) return null;
    const d = data as {
      count?: number;
      devices?: { platform?: string | null; last_seen_at?: string | null }[];
    };
    return {
      count: d.count ?? 0,
      devices: (d.devices ?? []).map((x) => ({
        platform: x.platform ?? null,
        lastSeenAt: x.last_seen_at ?? null,
      })),
    };
  } catch {
    return null;
  }
}

export async function deviceOwner(): Promise<DeviceOwner | null> {
  if (!supabase) return null;
  try {
    const id = await getDeviceId();
    const { data, error } = await supabase.rpc("device_owner", { p_id: id });
    if (error || !data) return null;
    const d = data as {
      claimed?: boolean;
      is_me?: boolean;
      name?: string | null;
      email?: string | null;
    };
    if (!d.claimed) return null;
    return {
      claimed: true,
      isMe: !!d.is_me,
      name: d.name ?? null,
      email: d.email ?? null,
    };
  } catch {
    return null;
  }
}
