import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import * as Device from "expo-device";
import * as Application from "expo-application";
import * as Crypto from "expo-crypto";

import { supabase } from "./supabase";

/**
 * Device ki pehchaan — do kaam ke liye:
 *
 *  1. App khulte hi pata chal jaaye ki ye phone pehle aa chuka hai. Naya ho to
 *     language-select dikhate hain, purana ho to seedha login (item 26).
 *  2. Ek phone sirf EK BAAR referral reward le sake. Pehle naya email banake,
 *     apna hi code daal ke, usi phone se baar-baar 15-15 din liye ja sakte the.
 *
 * Do ID hain, aur dono ki zaroorat hai:
 *
 *   • **install id** (`getDeviceId`) — pehli baar ek random UUID banake
 *     SecureStore me rakh dete hain. Logout/login aur app update se nahi jaata.
 *     Ye "is install" ki pehchaan hai.
 *
 *   • **hardware id** (`getHardwareId`) — is PHONE ki pehchaan, jo app hatane se
 *     bhi nahi jaati.
 *
 * ⚠️ Doosri ID kyun aayi — yahi wo chhed tha jisse referral ka poora anti-fraud
 * bekaar ho jaata tha. Android par SecureStore ka data app ke saath hi mit jaata
 * hai. Yaani: app uninstall karo, dobara download karo, nayi email se signup
 * karo, apna hi purana referral code daal do — server ko ek BILKUL NAYA device
 * dikhta tha aur 15 din phir mil jaate the. Jitni baar chaaho. `devices` table
 * me `referral_claimed_at` ki mohar lagti thi ek aisi ID par jo agli baar
 * maujood hi nahi hoti.
 *
 * Hardware id kahan se: Android par `ANDROID_ID` (app-signing key + user +
 * device ka jod — uninstall se nahi badalta, factory reset se badalta hai), iOS
 * par `identifierForVendor`. Dono Play/App Store policy me fraud-prevention ke
 * liye theek hain — ye advertising ID bhi nahi hai, IMEI bhi nahi.
 *
 * ⚠️ Aur wo asli ID server par KABHI nahi jaati — sirf uska SHA-256 hash. Hash
 * se hum do install ko "wahi phone" keh sakte hain (bas itna hi chahiye), par
 * hash se device ki pehchaan wapas nahi nikalti. Ek app-ka-apna salt bhi milta
 * hai, taaki ye hash kisi doosre system ke hash se milaya na ja sake.
 */

const KEY = "saathi-device-id";

/**
 * Hash me milaya jaane wala app ka apna salt.
 *
 * Iske bina hash sirf "SHA-256 of ANDROID_ID" hota, jo har us system me wahi
 * nikalta jo yahi hisaab lagata ho. Salt use sirf Saathi ke liye maayne rakhne
 * wala bana deta hai.
 */
const HW_SALT = "apka-saathi-device-v1";

/**
 * RFC-4122 v4 UUID — asli crypto RNG se.
 *
 * ⚠️ Yahan pehle `Math.random()` tha, aur wo is ek jagah par galat chunav tha.
 * `Math.random()` surakhsha ke liye bana hi nahi hai: Hermes me wo ek saadha
 * sa PRNG hai jise ek hi seed se chalaya jaata hai, aur uski nikli hui ginti
 * dekh kar aage ki ginti batayi ja sakti hai.
 *
 * Aur ye koi aam id nahi hai — poora anti-fraud isi par khada hai:
 * `device_seen`, `device_owner`, `apply_referral_code`,
 * `check_referral_qualification` aur `forget_my_device_tokens`, sab isi ko
 * chaabi ki tarah lete hain. `device_owner()` to `anon` ko bhi mil jaata hai
 * (login screen ki patti ke liye), yaani ek andaaza lagayi ja sakne wali id ka
 * matlab hai kisi aur ke phone ka masked naam aur email bahar aa jaana.
 *
 * `expo-crypto` is file me pehle se maujood tha (hardware-id ka hash usi se
 * banta hai) — yaani ye galti muft me theek ho jaati thi.
 *
 * ⚠️ Purani id jaan-boojh ke NAHI badalte: wo SecureStore me padi hai aur
 * `getDeviceId()` use waise hi lauta deta hai. Badal dene par har purana phone
 * server ko naya dikhta, aur referral ka `device_already_rewarded` wala nishaan
 * ek hi jhatke me bekaar ho jaata — yaani jis chhed ko ye id band karti hai,
 * wahi khul jaata. Ye sirf NAYI id par lagta hai.
 */
function uuid(): string {
  const b = Crypto.getRandomBytes(16);
  // Version 4 (random) aur RFC-4122 variant ke do nishaan.
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
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

/* ------------------------ phone ki apni pehchaan ------------------------ */

let memoHw: string | null = null;
/**
 * Ek hi baar poochho, phir wahi jawab.
 *
 * iOS wali call async hai aur app khulte hi do-teen jagah se ek saath poochi
 * jaati hai (device_seen, referral check). Bina is promise-cache ke teen alag
 * native call jaati thi aur teenon ka jawab aane tak teen alag "abhi pata nahi"
 * raaste chal jaate the.
 */
let hwPromise: Promise<string | null> | null = null;

/** Platform se aane wali asli hardware ID (hash se pehle). */
async function rawHardwareId(): Promise<string | null> {
  try {
    if (Platform.OS === "android") {
      // Sync hai. Emulator/kuch OEM par khaali ya "9774d56d682e549c" (ek jaana
      // hua bekaar default) bhi aa sakta hai — usko ID maanna sabse bura hoga,
      // kyunki tab hazaaron phone ek hi device lagte.
      const id = Application.getAndroidId?.() ?? "";
      const bad = !id || id.length < 8 || /^0+$/.test(id) || id === "9774d56d682e549c";
      return bad ? null : id;
    }
    if (Platform.OS === "ios") {
      // Apple isse `nil` de sakta hai jab phone restart ke baad ek baar bhi
      // unlock na hua ho — tab jaan-boojh ke null, koi bana hua ID nahi.
      const id = await Application.getIosIdForVendorAsync();
      return id && id.length >= 8 ? id : null;
    }
  } catch {
    /* module na chale (web/expo-go) — neeche null */
  }
  return null;
}

/**
 * Is PHONE ki pehchaan ka hash — app hatane-dobara-daalne se bhi wahi.
 *
 * Asli ID kabhi na kabhi na mile (emulator, web, purana OEM) to `null` lauta
 * dete hain, koi bana hua ID NAHI. Wajah: ek jhootha "stable" ID sabse mehnga
 * hota — do bilkul alag phone ek jaise dikhne lagte aur asli user ka referral
 * reward "device already rewarded" keh ke ruk jaata. Server null ko "pata nahi"
 * maanta hai aur install-id wale purane raaste par chala jaata hai.
 */
export async function getHardwareId(): Promise<string | null> {
  if (memoHw) return memoHw;
  if (hwPromise) return hwPromise;
  hwPromise = (async () => {
    const raw = await rawHardwareId();
    if (!raw) return null;
    try {
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `${HW_SALT}:${raw}`,
      );
      memoHw = hash;
      return hash;
    } catch {
      // Hash na ban paaye to kuch NA bhejo. Asli ANDROID_ID bhejna sabse bura
      // rasta hai — wo hum jaan-boojh ke server se door rakhte hain.
      return null;
    }
  })();
  return hwPromise;
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
  const hardware = await getHardwareId().catch(() => null);
  try {
    const { data, error } = await supabase.rpc("device_seen", {
      p_id: id,
      p_fingerprint: fingerprint(),
      p_platform: Platform.OS,
      p_language: language ?? null,
      p_hardware_id: hardware,
    });
    if (!error && data) {
      const d = data as { known?: boolean; language?: string | null };
      return { id, known: !!d.known, language: d.language ?? null };
    }
    /**
     * Purana server — `p_hardware_id` wala version abhi deploy nahi hua
     * (supabase/device-hardware.sql chalna baaki hai). Postgres us call ko
     * "function does not exist" keh ke mana kar deta hai, aur bina is fallback ke
     * app ka pehla screen hi atak jaata: device kabhi register nahi hota, yaani
     * language-select har baar dikhta rehta.
     */
    const legacy = await supabase.rpc("device_seen", {
      p_id: id,
      p_fingerprint: fingerprint(),
      p_platform: Platform.OS,
      p_language: language ?? null,
    });
    if (legacy.error || !legacy.data) return { id, known: false, language: null };
    const d = legacy.data as { known?: boolean; language?: string | null };
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

/**
 * "Baaki sab phones se logout" — `devices` table par bhi lagu karo.
 *
 * ⚠️ Iske bina wo button poori tarah jhooth bolta tha. `signOutOtherDevices()`
 * sirf Supabase ke refresh TOKEN revoke karta hai; ginti `my_other_devices()`
 * se aati hai jo `devices` table padhta hai — aur us table ko token revoke hone
 * se koi farak nahi padta.
 *
 * Natija wahi tha jo user ne pakda: button dabao, "ho gaya" toast bhi aaye, aur
 * agli login par phir se wahi chetavni. Row 30 din tak padi rehti thi, isliye
 * chetavni 30 din tak lauttti rehti thi.
 *
 * Fail ho to chup — asli logout (token revoke) ho hi chuka hota hai, aur uspar
 * ye rukna nahi chahiye.
 */
export async function releaseOtherDevices(): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.rpc("release_my_other_devices", { p_id: await getDeviceId() });
  } catch {
    /* best-effort — agli baar sync ho jaayega */
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
