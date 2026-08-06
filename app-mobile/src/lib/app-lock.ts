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
  resetGrace();
}

export async function setBiometricOn(on: boolean): Promise<void> {
  await set(BIO_KEY, on ? "1" : "0");
}

/* ------------------------------ unlock ------------------------------- */

/**
 * Galat PIN ki ginti — brute-force ki rok.
 *
 * ⚠️ Iske bina lock lagbhag dikhawa tha. PIN 4 ank ka hai, yaani sirf 10,000
 * sambhavnaayein, aur check poori tarah local aur turant hai — koi network nahi,
 * koi der nahi. Jis kisi ke haath phone lag jaye wo aaram se baith ke saare
 * combination try kar sakta tha; 10,000 tap bahut lagte hain par ye ek insaan
 * ke liye bhi ek shaam ka kaam hai, aur wo bhi bina kisi rok-tok ke.
 *
 * Ab har 5 galat koshish ke baad intezaar badhta jaata hai. Ye asli user ko
 * mushkil se chhoota hai (wo aksar pehli ya doosri baar me sahi daalta hai) par
 * brute-force ko poori tarah bekaar kar deta hai: 10,000 koshishon me ghanton
 * nahi, dinon lag jaate hain.
 *
 * Memory me hai, storage me nahi — soch samajh ke. Storage me rakhne par ek
 * hamlavar app ka data clear karke ginti reset kar sakta tha (aur app data
 * clear karne se PIN bhi chala jaata, yaani wo raasta waise bhi lock hata deta
 * hai). Memory me hone ka matlab hai ki app poori tarah band karke ginti reset
 * ho sakti hai — par uske liye har 5 koshish par app restart karni padegi, jo
 * apne aap me ek badi rok hai.
 */
const MAX_TRIES = 5;
/** Har 5 galat koshish ke baad: 30s, 60s, 2m, 4m… (aakhir me 15 min par ruk). */
const LOCKOUT_STEPS_MS = [30_000, 60_000, 120_000, 240_000, 480_000, 900_000];

let wrongTries = 0;
let lockoutRound = 0;
let lockedUntil = 0;

/** Abhi PIN daala ja sakta hai? Nahi to kitne second baad. */
export function pinAttemptsLeft(): { blocked: boolean; waitSeconds: number; left: number } {
  const now = Date.now();
  if (lockedUntil > now) {
    return {
      blocked: true,
      waitSeconds: Math.ceil((lockedUntil - now) / 1000),
      left: 0,
    };
  }
  return { blocked: false, waitSeconds: 0, left: MAX_TRIES - wrongTries };
}

export async function checkPin(pin: string): Promise<boolean> {
  // Intezaar chal raha hai — koshish ginte bhi nahi, warna hamlavar lagatar
  // bhej ke ginti aage badhata rehta aur asli user aur lamba phansta.
  if (pinAttemptsLeft().blocked) return false;

  const [saved, salt] = await Promise.all([get(PIN_KEY), get(SALT_KEY)]);
  if (!saved || !salt) return false;
  const ok = (await hashPin(pin, salt)) === saved;

  if (ok) {
    wrongTries = 0;
    lockoutRound = 0;
    lockedUntil = 0;
    return true;
  }

  wrongTries += 1;
  if (wrongTries >= MAX_TRIES) {
    const step = LOCKOUT_STEPS_MS[Math.min(lockoutRound, LOCKOUT_STEPS_MS.length - 1)];
    lockedUntil = Date.now() + step;
    lockoutRound += 1;
    wrongTries = 0;
  }
  return false;
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
// Ye sab jaan-boojh ke sirf memory me hai, storage me nahi. App poori tarah
// band hoke dobara khule to sab 0 se shuru hota hai — yaani lock lagta hai.
// Storage me rakhne par phone band karke kholne par bhi khidki chalti rehti,
// jo lock ka matlab hi kam kar deta.

/** Ek baar bhi khula tha is session me? */
let unlocked = false;
/** App background me kab gaya (0 = abhi saamne hai). */
let leftAt = 0;
/**
 * Kitne "jaan-boojh ke bahar jaane wale" kaam abhi chal rahe hain.
 *
 * Ginti hai, boolean nahi: camera khulte waqt hi share sheet bhi khul sakti
 * hai, aur pehle wale ka `end` doosre ki chhoot chheen leta.
 */
let interludes = 0;

/** Abhi-abhi khola tha — dobara mat poocho. */
export function markUnlocked(): void {
  unlocked = true;
  leftAt = 0;
}

/**
 * App background me chala gaya — ghadi ab se chalegi.
 *
 * ⚠️ **Yahi wo cheez thi jiske bina lock "apne aap" lag jaata tha.** Pehle
 * khidki `unlockedAt` (yaani KHOLNE ke waqt) se naapi jaati thi. Iska matlab
 * ye tha ki khidki tab bhi kat rahi hoti thi jab user app ke andar hi kaam kar
 * raha ho. Nateeja bilkul wahi tha jo shikayat me hai:
 *
 *   User ne subah lock khola, 5 minute documents dekhe, phir document ki photo
 *   lene camera kholi (10 second) — aur wapas aate hi lock. Kyunki 5 minute 10
 *   second > 60 second. Usne app chhodi hi nahi thi.
 *
 * AI ka kaam aur bhi bura tha: scan ke liye gallery/camera kholna, phir jawab
 * ka intezaar — beech me app kai baar background me jaati hai, aur har baar
 * lock.
 *
 * Ab ghadi tabhi chalti hai jab app SACH ME bahar ho. Andar bitaya gaya waqt
 * kabhi ginti me nahi aata.
 */
export function markBackgrounded(): void {
  // Jaan-boojh ke bahar gaye hain (camera / share / browser) — ye "chhodna"
  // nahi hai. Ghadi shuru hi mat karo.
  if (interludes > 0) return;
  if (leftAt === 0) leftAt = Date.now();
}

/** Background se wapas aane par: lock dikhana hai ya nahi. */
export function needsUnlock(): boolean {
  // Is session me kabhi khola hi nahi (app abhi-abhi chali hai) — lock lagega.
  if (!unlocked) return true;
  // Koi jaan-boojh ke bahar jaane wala kaam abhi chal raha hai — kabhi nahi.
  if (interludes > 0) {
    leftAt = 0;
    return false;
  }
  if (leftAt === 0) return false;
  const away = Date.now() - leftAt;
  leftAt = 0;
  return away > GRACE_MS;
}

/**
 * "Main jaan-boojh ke app se bahar bhej raha hoon — is par lock mat lagana."
 *
 * Camera, gallery, share sheet, PDF viewer, browser (payment) — in sab me app
 * background me jaati hai, par user ne app CHHODI nahi hai; app hi use bahar
 * bhej rahi hai. In par lock lagana user ko apne hi kaam ke beech me rok dena
 * hai, aur wahi sabse zyada chidhata hai.
 *
 * ⚠️ Hamesha `finally` me `endTrustedInterlude()` bulana — warna ginti kabhi
 * 0 par nahi aayegi aur lock us session me poori tarah band ho jayega.
 */
export function beginTrustedInterlude(): void {
  interludes += 1;
  leftAt = 0;
}

export function endTrustedInterlude(): void {
  interludes = Math.max(0, interludes - 1);
  // Bahar jaane wala kaam khatam. Ghadi ab se — na ki tab se jab camera khuli
  // thi. Warna lamba scan khatam hote hi lock lag jaata.
  leftAt = 0;
}

/**
 * Camera/share/browser jaisa koi kaam — uske dauraan lock nahi lagta.
 *
 * Isse lapetna sabse surakshit tareeka hai: `finally` bhoolna namumkin hai.
 */
export async function withoutLock<T>(work: () => Promise<T>): Promise<T> {
  beginTrustedInterlude();
  try {
    return await work();
  } finally {
    endTrustedInterlude();
  }
}

/** Logout par sab bhool jao — agla user purani khidki me na ghus jaye. */
export function resetGrace(): void {
  unlocked = false;
  leftAt = 0;
  interludes = 0;
}
