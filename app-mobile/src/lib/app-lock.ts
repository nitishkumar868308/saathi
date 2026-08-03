import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

/**
 * App lock — biometric (fingerprint / face) + ek PIN jo uske peeche khada rehta hai.
 *
 * Kyun dono, sirf biometric nahi: biometric fail ho jaata hai aur aksar sabse
 * bure waqt par — geela haath, kata hua ungli, dhoop me face, ya phone ne apne
 * aap hi "PIN se kholo" maang liya (Android har kuch ghante ye karta hai). Us
 * pal me agar app ke paas apna koi doosra raasta na ho, to user apne hi
 * documents se bahar khada reh jaata hai. Isliye PIN pehle set hota hai,
 * biometric uske UPAR ek shortcut ki tarah lagta hai.
 *
 * ⚠️ Sab kuch SIRF is phone par rehta hai. PIN kabhi server par nahi jaata,
 * aur PIN khud kahin save bhi nahi hota — sirf uska hash (salt ke saath). Iska
 * matlab hai ki phone kho jaye ya app uninstall ho to lock apne aap khatam:
 * user apni Supabase ID se dobara login kar leta hai. Ye kamzori nahi, seedha
 * faisla hai — lock ka kaam is PHONE ko rokna hai, account ko nahi.
 *
 * Salt kyun: bina salt ke "1234" ka SHA-256 duniya me har jagah ek jaisa hota
 * hai. Kisi ne phone ka storage padh liya to 4-ank ka PIN ek lookup me khul
 * jaata. Har install ka apna salt isse bekaar kar deta hai.
 */

const PIN_KEY = "saathi-lock-pin";
const SALT_KEY = "saathi-lock-salt";
const BIO_KEY = "saathi-lock-bio";
/**
 * App background me jaane ke baad itni der tak dobara nahi poochte.
 *
 * ⚠️ 0 rakhna (yaani har baar poochna) sunne me sabse safe lagta hai aur
 * asal me ulta padta hai: reminder ki notification par tap karo — lock; camera
 * se document scan karo — wapas aate hi lock; OTP dekhne SMS me jao — phir
 * lock. Log aise lock ko do din me band kar dete hain, aur phir koi lock hai hi
 * nahi. Chhoti si khidki lock ko zinda rakhti hai.
 */
const GRACE_MS = 60_000;

/* ------------------------------ storage ------------------------------ */

async function get(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

async function set(key: string, value: string): Promise<void> {
  await SecureStore.setItemAsync(key, value);
}

async function del(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    /* pehle se nahi hai */
  }
}

/** Random hex — har install ka apna salt. */
function randomHex(bytes = 16): string {
  const arr = Crypto.getRandomBytes(bytes);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPin(pin: string, salt: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${salt}:${pin}`,
  );
}

/* ------------------------------- state ------------------------------- */

export type LockState = {
  /** PIN set hai — yaani lock chalu hai. */
  enabled: boolean;
  /** Is phone par fingerprint/face hai aur usme kuch enroll bhi hai. */
  biometricAvailable: boolean;
  /** User ne biometric on rakha hai. */
  biometricOn: boolean;
};

/** Phone me fingerprint/face hai AUR usme kam se kam ek enroll hai? */
export async function biometricAvailable(): Promise<boolean> {
  try {
    // Dono zaroori hain. `hasHardwareAsync` sirf sensor ki baat karta hai —
    // sensor hote hue bhi user ne koi ungli enroll na ki ho to prompt turant
    // fail ho jaata hai, aur wo dikhta aisa hai jaise app hi tooti ho.
    const [hw, enrolled] = await Promise.all([
      LocalAuthentication.hasHardwareAsync(),
      LocalAuthentication.isEnrolledAsync(),
    ]);
    return hw && enrolled;
  } catch {
    return false;
  }
}

export async function getLockState(): Promise<LockState> {
  const [pin, bio, avail] = await Promise.all([
    get(PIN_KEY),
    get(BIO_KEY),
    biometricAvailable(),
  ]);
  return {
    enabled: !!pin,
    biometricAvailable: avail,
    // Sensor hat gaya / saari ungliyaan hat gayi — tab "on" dikhana jhooth hai.
    biometricOn: avail && bio === "1",
  };
}

/* ------------------------------- setup ------------------------------- */

export const PIN_LENGTH = 4;

export function isValidPin(pin: string): boolean {
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(pin);
}

/** PIN set/badlo. Lock isi se chalu hota hai. */
export async function setPin(pin: string): Promise<void> {
  if (!isValidPin(pin)) throw new Error("PIN sahi nahi hai");
  const salt = randomHex();
  // Salt PEHLE — agar beech me kuch ruk jaye to purana hash naye salt ke saath
  // padha jaata aur user apne hi sahi PIN se bahar reh jaata.
  await set(SALT_KEY, salt);
  await set(PIN_KEY, await hashPin(pin, salt));
}

/** Lock poori tarah band — PIN, salt aur biometric ki setting, teeno. */
export async function disableLock(): Promise<void> {
  await Promise.all([del(PIN_KEY), del(SALT_KEY), del(BIO_KEY)]);
  unlockedAt = 0;
}

export async function setBiometricOn(on: boolean): Promise<void> {
  await set(BIO_KEY, on ? "1" : "0");
}

/* ------------------------------ unlock ------------------------------- */

export async function checkPin(pin: string): Promise<boolean> {
  const [saved, salt] = await Promise.all([get(PIN_KEY), get(SALT_KEY)]);
  if (!saved || !salt) return false;
  return (await hashPin(pin, salt)) === saved;
}

/**
 * Fingerprint/face se kholne ki koshish.
 *
 * `false` ka matlab sirf "nahi khula" hai — user ne cancel kiya ho, ungli na
 * padhi ho, ya phone ne PIN maang liya ho. Teeno soorat me screen apna PIN
 * wala raasta dikhati rehti hai, koi error nahi. Yahi wo jagah hai jahan "sirf
 * biometric" wale lock log ko bahar chhod dete hain.
 */
export async function unlockWithBiometric(prompt: string, fallbackLabel: string): Promise<boolean> {
  try {
    const res = await LocalAuthentication.authenticateAsync({
      promptMessage: prompt,
      // Phone ka apna PIN/pattern nahi chahiye — app ka apna PIN peeche hai,
      // aur do alag PIN maangna user ko sabse zyada uljhata hai.
      disableDeviceFallback: true,
      cancelLabel: fallbackLabel,
    });
    return res.success;
  } catch {
    return false;
  }
}

/* ------------------------------- grace ------------------------------- */
//
// Ye jaan-boojh ke sirf memory me hai, storage me nahi. App poori tarah band
// hoke dobara khule to `unlockedAt` 0 hi hota hai — yaani lock lagta hai. Isse
// storage me rakhne par phone band karke kholne par bhi khidki chalti rehti,
// jo lock ka matlab hi kam kar deta.

let unlockedAt = 0;

/** Abhi-abhi khola tha — dobara mat poocho. */
export function markUnlocked(): void {
  unlockedAt = Date.now();
}

/** Background se wapas aane par: lock dikhana hai ya nahi. */
export function needsUnlock(): boolean {
  return Date.now() - unlockedAt > GRACE_MS;
}

/** Logout par sab bhool jao — agla user purani khidki me na ghus jaye. */
export function resetGrace(): void {
  unlockedAt = 0;
}
