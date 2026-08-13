import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

import { supabase } from "./supabase";

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
 * ── Lock ab ACCOUNT ke saath chalta hai, sirf phone ke saath nahi ─────────
 *
 * ⚠️ Pehle sab kuch SIRF is phone par rehta tha, aur wo ek soch thi: "lock ka
 * kaam is PHONE ko rokna hai, account ko nahi". Wo soch lock ko dikhawa bana
 * deti thi, kyunki teen aam raaste use poori tarah bypass kar dete the:
 *
 *   • App uninstall karke dobara install — SecureStore saaf, lock gayab.
 *   • Logout karke wapas login — wahi baat.
 *   • Doosre phone par usi ID se login — wahan lock kabhi tha hi nahi.
 *
 * Teenon me user ke saare documents bina PIN ke khul jaate the. Ab lock ka hash
 * server par bhi rehta hai (`supabase/app-lock.sql`), isliye jis user ne lock
 * chalu kiya hai uske account me login karte hi PIN maanga jaata hai — chahe
 * phone naya ho ya app abhi-abhi install hui ho.
 *
 * ⚠️ PIN khud phir bhi kabhi kahin save nahi hota — na phone par, na server
 * par. Sirf uska hash (salt ke saath). Server ke paas se PIN nikaala nahi ja
 * sakta, sirf milaaya ja sakta hai.
 *
 * ⚠️ Milaan hamesha LOCAL hota hai (hash+salt login ke baad phone par cache ho
 * jaate hain). Ye zaroori hai: flight mode me ya lift ke andar phone uthate hi
 * lock khul hi na paaye — us se bura kuch nahi. Server sirf ye batata hai ki
 * lock HAI ya nahi; kholta hamesha phone hi hai.
 *
 * Salt kyun: bina salt ke "1234" ka SHA-256 duniya me har jagah ek jaisa hota
 * hai, yaani ek hi banी-banayi list se lakhon phone ek saath khul jaate. Har
 * user ka apna salt us list ko bekaar kar deta hai.
 *
 * ── Ye lock kya NAHI rok sakta (saaf-saaf) ────────────────────────────────
 *
 * ⚠️ Yahan pehle likha tha ki salt aur "5 koshish" wali rok mil kar PIN ko
 * brute-force se bacha leti hain. **Wo galat tha, aur us par bharosa karna
 * khatarnak hai** — isliye asli baat likhi ja rahi hai:
 *
 *   • PIN 4 ank ka hai — sirf 10,000 sambhavnaayein. Hash ek hi SHA-256 hai.
 *     Jisne phone ka storage padh liya (root, ADB backup, ya chura kar khola
 *     hua phone) wo un 10,000 ko apne computer par SECOND ke andar chala kar
 *     PIN nikaal sakta hai. Salt ise dheema nahi karta — salt ka kaam sirf
 *     banी-banayi list rokna hai, ginti rokna nahi.
 *   • Neeche wali "5 koshish" wali rok SIRF app ke andar chalti hai. Jo hamla
 *     app ke bahar (apne computer par) hota hai, wo use chhoota bhi nahi.
 *   • Aur ye lock waise bhi UI ka lock hai: jiske paas account ka session hai
 *     wo REST API se seedha documents padh sakta hai, PIN ke aar-paar se.
 *
 * To phir ye lock kis kaam ka: **wahi kaam jiske liye user ne lagaya tha** —
 * phone kisi ke haath me de dena (bacha, dukaandar, rishtedaar) aur uska app
 * khol ke documents dekh lena. Wo hamla app ke ANDAR se hota hai, aur usi ke
 * liye neeche wali badhti hui rok banayi gayi hai (jo ab app band karne se bhi
 * nahi mitti).
 *
 * ⚠️ Asli behtari ek hi hai: PIN ko lamba karna (6 ank = 100 guna, 8 = 10,000
 * guna). Wo `PIN_LENGTH` badalne se hoga, aur uske saath purane 4-ank wale PIN
 * ke liye ek raasta rakhna padega — isliye wo alag faisla hai, chupke se badal
 * dene wali cheez nahi.
 */

const PIN_KEY = "saathi-lock-pin";
const SALT_KEY = "saathi-lock-salt";
const BIO_KEY = "saathi-lock-bio";
/**
 * Server par abhi tak nahi pahunchi hui badlaav.
 *
 * ⚠️ Iske bina ek chupa hua chhed reh jaata: user net ke bina PIN badalta hai,
 * server par purana hash pada rehta hai, aur agli baar sync usi purane hash ko
 * wapas local par likh deta — yaani user ka naya PIN chup-chaap gayab. Ye
 * jhanda sync ko batata hai ki abhi local sach hai, server nahi.
 */
const DIRTY_KEY = "saathi-lock-dirty";
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
  // Lock screen mount hote hi yahi chalta hai — galat koshishon ki ginti bhi
  // yahin storage se aa jaati hai, taaki `pinAttemptsLeft()` (jo sync hai)
  // pehle sawaal par hi sach bata sake.
  await hydrateGuard();
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

/** PIN set/badlo. Lock isi se chalu hota hai — is phone par AUR account par. */
export async function setPin(pin: string): Promise<void> {
  if (!isValidPin(pin)) throw new Error("PIN sahi nahi hai");
  const salt = randomHex();
  const hash = await hashPin(pin, salt);
  // Salt PEHLE — agar beech me kuch ruk jaye to purana hash naye salt ke saath
  // padha jaata aur user apne hi sahi PIN se bahar reh jaata.
  await set(SALT_KEY, salt);
  await set(PIN_KEY, hash);
  // Net na ho to bhi PIN turant chalu ho jaata hai; server ko baad me bata denge.
  await set(DIRTY_KEY, "1");
  await pushLock(hash, salt);
}

/** Lock poori tarah band — PIN, salt aur biometric ki setting, teeno. */
export async function disableLock(): Promise<void> {
  await Promise.all([del(PIN_KEY), del(SALT_KEY), del(BIO_KEY)]);
  await set(DIRTY_KEY, "1");
  // Purana intezaar bhi saaf — warna lock band karke naya PIN lagane wala user
  // apne hi naye PIN par "abhi 8 minute ruko" dekhta.
  await clearGuard();
  resetGrace();
  await pushClear();
}

export async function setBiometricOn(on: boolean): Promise<void> {
  await set(BIO_KEY, on ? "1" : "0");
  // Best-effort — biometric ki setting phone ki hai, par doosre phone par bhi
  // wahi pasand chale to behtar hai. Fail ho to kuch nahi bigadta.
  try {
    await supabase?.rpc("set_app_lock_biometric", { p_on: on });
  } catch {
    /* server baad me sync ho jaayega */
  }
}

/* ------------------------- server ke saath sync ------------------------- */

/**
 * Local hash+salt server par bhej do.
 *
 * Fail hone par `DIRTY_KEY` laga rehta hai, aur agla `syncAppLock()` ise dobara
 * bhejta hai. Isliye yahan koi error nahi uchhalte: PIN phone par lag CHUKA hai,
 * aur user ko "PIN set nahi hua" kehna jhooth hoga.
 */
async function pushLock(hash: string, salt: string): Promise<void> {
  try {
    const { error } = (await supabase?.rpc("set_app_lock", {
      p_hash: hash,
      p_salt: salt,
      p_biometric: (await get(BIO_KEY)) === "1",
    })) ?? { error: new Error("no client") };
    if (!error) await del(DIRTY_KEY);
  } catch {
    /* dirty laga rehne do */
  }
}

async function pushClear(): Promise<void> {
  try {
    const { error } = (await supabase?.rpc("clear_app_lock")) ?? {
      error: new Error("no client"),
    };
    if (!error) await del(DIRTY_KEY);
  } catch {
    /* dirty laga rehne do */
  }
}

type ServerLock = { enabled: boolean; hash: string | null; salt: string | null };

/**
 * Account ka lock is phone par le aao.
 *
 * Login ke baad (aur app khulne par) chalta hai. Teen soorat:
 *
 *   • Server par lock hai   → hash+salt phone par likh do. Yahi wo line hai
 *     jiske bina naya phone / naya install lock ke bina khul jaata tha.
 *   • Server par lock nahi hai, aur phone par bhi koi bina bheja badlaav nahi
 *     → phone se bhi hata do. (User ne doosre phone par lock band kiya hoga.)
 *   • Phone par bina bheja badlaav pada hai (`DIRTY_KEY`) → local hi sach hai;
 *     use server par bhej do, server se kuch mat lo.
 *
 * ⚠️ Net na ho to KUCH MAT BADLO. Ye sabse zaroori shart hai: fail hue call ko
 * "server par lock nahi hai" maan lena lock ko flight mode me poori tarah hata
 * deta — yaani lock bypass karne ka sabse aasan raasta ban jaata.
 */
export async function syncAppLock(): Promise<void> {
  if (!supabase) return;

  // Pehle apna bina bheja badlaav — warna server ka purana jawab use dabа dega.
  if ((await get(DIRTY_KEY)) === "1") {
    const [hash, salt] = await Promise.all([get(PIN_KEY), get(SALT_KEY)]);
    if (hash && salt) await pushLock(hash, salt);
    else await pushClear();
    return;
  }

  let row: ServerLock | null = null;
  try {
    const { data, error } = await supabase.rpc("get_app_lock");
    if (error) return; // net/RPC fail — upar wali wajah, kuch mat badlo
    const first = Array.isArray(data) ? data[0] : data;
    row = (first as ServerLock | undefined) ?? { enabled: false, hash: null, salt: null };
  } catch {
    return;
  }

  if (row.enabled && row.hash && row.salt) {
    const [localHash, localSalt] = await Promise.all([get(PIN_KEY), get(SALT_KEY)]);
    if (localHash !== row.hash || localSalt !== row.salt) {
      await set(SALT_KEY, row.salt);
      await set(PIN_KEY, row.hash);
      /**
       * ⚠️ Naya hash aaya = PIN kisi aur phone par badla gaya hai. Us haalat me
       * "abhi-abhi khola tha" wali chhoot rakhna galat hai — purane PIN se khuli
       * hui app khuli hi reh jaati.
       */
      resetGrace();
    }
    return;
  }

  // Server keh raha hai ki lock hai hi nahi — phone se bhi hata do.
  if (await get(PIN_KEY)) {
    await Promise.all([del(PIN_KEY), del(SALT_KEY), del(BIO_KEY)]);
  }
}

/**
 * Logout — is phone se lock ka nishaan hata do.
 *
 * ⚠️ Server par kuch nahi chhoota. Wahi poora point hai: dobara login karte hi
 * `syncAppLock()` lock wapas le aata hai, isliye "logout karke lock hata lo"
 * wala purana raasta ab band hai.
 *
 * Aur local hatana zaroori hai kyunki agla user is phone par koi AUR ho sakta
 * hai — use pehle wale ka PIN maangna sabse bekaar soorat hai.
 */
export async function forgetLocalLock(): Promise<void> {
  await Promise.all([del(PIN_KEY), del(SALT_KEY), del(BIO_KEY), del(DIRTY_KEY)]);
  // Galat koshishon ki ginti bhi — agla user is phone par koi AUR ho sakta hai,
  // aur use pehle wale ke intezaar me baithana bilkul bekaar hai.
  await clearGuard();
  resetGrace();
}

/**
 * PIN reset (email OTP) ke baad naya PIN phone par bitha do.
 *
 * Server par wo pehle hi likha ja chuka hai (web ka route), isliye yahan sirf
 * local copy — aur `DIRTY_KEY` bilkul nahi, warna agla sync isi ko wapas server
 * par bhej ke ek bekaar chakkar chalata rahega.
 */
export async function adoptResetPin(hash: string, salt: string): Promise<void> {
  await set(SALT_KEY, salt);
  await set(PIN_KEY, hash);
  await del(DIRTY_KEY);
  // Ginti bhi saaf — user ne abhi apni pehchaan email se saabit ki hai, use
  // purani galat koshishon ki saza dena bekaar hai. (Storage se bhi hatti hai,
  // warna app band karke kholne par purana intezaar wapas aa jaata.)
  await clearGuard();
}

/** Naya PIN ka hash + salt — reset ke liye (PIN khud kabhi nahi bhejte). */
export async function makePinHash(pin: string): Promise<{ hash: string; salt: string }> {
  if (!isValidPin(pin)) throw new Error("PIN sahi nahi hai");
  const salt = randomHex();
  return { hash: await hashPin(pin, salt), salt };
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
 * haath me aaye hue phone par 10,000 tap karne wale ko poori tarah rok deta hai.
 *
 * ── Ginti ab STORAGE me hai, sirf memory me nahi ──────────────────────────
 *
 * ⚠️ Pehle ye teenon sirf memory me the, aur us faisle ke saath ek daleel likhi
 * thi: "app data clear karne se PIN bhi chala jaata hai, isliye wo raasta waise
 * bhi lock hata deta hai." **Wo daleel ab sach nahi hai** — jab se lock account
 * ke saath chalta hai (`syncAppLock`), app data clear karne par agli login par
 * PIN server se WAPAS aa jaata hai. Yaani us raaste se lock hatta hi nahi.
 *
 * Par memory wali ginti se ek asli chhed khula reh jaata tha, aur wo bilkul
 * aasan tha: 5 galat koshish → 30 second ka intezaar → app ko recents se hata
 * do → dobara kholo → ginti phir 0. Koi root nahi, koi computer nahi, sirf
 * swipe. Us tarah 10,000 koshishein rok se guzre bina ki ja sakti thi, aur wo
 * theek WAHI hamla hai jiske liye ye rok banayi gayi thi.
 *
 * Ab ginti SecureStore me rehti hai, isliye app band karne se kuch nahi badalta.
 * Sahi PIN, logout, ya email se PIN reset — teeno use saaf kar dete hain.
 */
const MAX_TRIES = 5;
/** Har 5 galat koshish ke baad: 30s, 60s, 2m, 4m… (aakhir me 15 min par ruk). */
const LOCKOUT_STEPS_MS = [30_000, 60_000, 120_000, 240_000, 480_000, 900_000];

/** Galat koshishon ka hisaab — SecureStore me isi shakl me padta hai. */
const GUARD_KEY = "saathi-lock-guard";

let wrongTries = 0;
let lockoutRound = 0;
let lockedUntil = 0;
/**
 * Storage se padhne wala kaam khud — flag nahi, POORA PROMISE.
 *
 * ⚠️ Yahan promise rakhna zaroori hai, `let guardLoaded = false` jaisa boolean
 * nahi. Boolean wale roop me flag `await` se PEHLE `true` hota tha, aur app
 * khulte hi do jagah se ek saath `getLockState()` chalta hai (`lock-gate`, phir
 * `lock-screen`). Doosra caller flag `true` dekh kar TURANT laut jaata tha —
 * jabki ginti abhi storage se aayi hi nahi thi.
 *
 * Us jhiri me `pinAttemptsLeft()` zeroed ginti par "blocked: false" kehta, yaani
 * chal raha lockout us ek pal ke liye gayab ho jaata aur countdown bhi kabhi
 * dikhta hi nahi. Promise rakhne se doosra caller usi ek read ka intezaar karta
 * hai — read hoti phir bhi ek hi baar hai, par ab sab uske BAAD chalte hain.
 */
let guardLoaded: Promise<void> | null = null;

/**
 * Storage se ginti memory me le aao — ek hi baar.
 *
 * `getLockState()` se bulaya jaata hai, jo lock screen mount hote hi chalta hai.
 * Isliye pehla `checkPin()` aane se pehle ginti hamesha taiyaar hoti hai.
 */
function hydrateGuard(): Promise<void> {
  if (!guardLoaded) guardLoaded = readGuard();
  return guardLoaded;
}

async function readGuard(): Promise<void> {
  const raw = await get(GUARD_KEY);
  if (!raw) return;
  try {
    const g = JSON.parse(raw) as { tries?: number; round?: number; until?: number };
    wrongTries = Number(g.tries) || 0;
    lockoutRound = Number(g.round) || 0;
    lockedUntil = Number(g.until) || 0;
  } catch {
    /* toota hua likha hua — 0 se shuru, isse bura kuch nahi hota */
  }
}

async function saveGuard(): Promise<void> {
  try {
    await set(
      GUARD_KEY,
      JSON.stringify({ tries: wrongTries, round: lockoutRound, until: lockedUntil }),
    );
  } catch {
    /* best-effort — memory wali ginti phir bhi chalti rahegi */
  }
}

/** Ginti poori tarah saaf — sahi PIN, logout, ya email se reset ke baad. */
async function clearGuard(): Promise<void> {
  wrongTries = 0;
  lockoutRound = 0;
  lockedUntil = 0;
  // Ginti ab memory me sahi hai — storage dobara padhne ki zaroorat nahi, aur
  // padh lete to abhi-abhi saaf ki hui ginti wapas aa jaati.
  guardLoaded = Promise.resolve();
  await del(GUARD_KEY);
}

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
  // App abhi-abhi khuli ho to ginti storage se le aao — warna app band karke
  // kholna hi rok ke aar-paar nikalne ka raasta ban jaata hai.
  await hydrateGuard();

  // Intezaar chal raha hai — koshish ginte bhi nahi, warna hamlavar lagatar
  // bhej ke ginti aage badhata rehta aur asli user aur lamba phansta.
  if (pinAttemptsLeft().blocked) return false;

  const [saved, salt] = await Promise.all([get(PIN_KEY), get(SALT_KEY)]);
  if (!saved || !salt) return false;
  const ok = (await hashPin(pin, salt)) === saved;

  if (ok) {
    await clearGuard();
    return true;
  }

  wrongTries += 1;
  if (wrongTries >= MAX_TRIES) {
    const step = LOCKOUT_STEPS_MS[Math.min(lockoutRound, LOCKOUT_STEPS_MS.length - 1)];
    lockedUntil = Date.now() + step;
    lockoutRound += 1;
    wrongTries = 0;
  }
  await saveGuard();
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
