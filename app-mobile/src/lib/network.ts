import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Network from "expo-network";

/**
 * Network status — user ko batana ki internet nahi hai ya dheema hai.
 *
 *  - offline : sach me internet nahi pahunch raha.
 *  - slow    : internet sach me dheema hai (probe se verify kiya hua).
 *
 * ⚠️ Yahan ka poora design ek hi baat par tika hai: **flag jhoot bol sakta hai,
 * request nahi.** expo-network ka `isInternetReachable` kai Android phones par
 * (khaaskar dual-SIM / 5G par) `false` pe atak jaata hai jabki net bilkul chalu
 * hota hai. Pehle hum us flag par banner dikha dete the — isliye "No internet"
 * dikhta tha jabki sab kaam kar raha tha.
 *
 * Ab dono banner probe se verify hote hain: `offline` ke liye do lagatar fail,
 * aur `slow` ke liye ek halka probe jo har baar naya bhejta hai.
 */

let slowUntil = 0;
/** App ki kisi asli request ne last kab kaamyabi se jawab diya. */
let lastSuccessAt = 0;
/**
 * Abhi kitni AI call chal rahi hain.
 *
 * ⚠️ Ye counter poore is file ki sabse zaroori cheez hai. AI ka jawab banne me
 * hi 5-20 second lagte hain — us dauraan agar app ki koi BHI doosri request
 * (Home ka refresh, documents ka load) dheemi nikle aur banner chala de, to
 * user use AI ka hi samajhta hai: "AI use karte hi internet slow ho jaata hai".
 * Isliye jab tak koi AI call chalu hai, `slow` banner bilkul nahi dikhta.
 *
 * `offline` is rok se bahar hai — net sach me chala gaya ho to wo AI ke dauraan
 * bhi dikhna chahiye.
 */
let aiBusy = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Kaam theek chala — dheema wala message turant hata do. */
function clearSlow(): void {
  if (slowUntil > 0) {
    slowUntil = 0;
    emit();
  }
}

/**
 * App ki koi request kaamyab hui — matlab internet pakka hai.
 * Isse OS ke jhoote "offline" flag ko turant kaat dete hain.
 */
export function reportOnline(): void {
  lastSuccessAt = Date.now();
  emit();
}

/* ------------------------------ AI ka pehra ------------------------------ */

/** Ek AI call shuru hui. Har call ka apna `aiCallEnded()` hona chahiye. */
export function aiCallStarted(): void {
  aiBusy++;
  // Pehle se koi banner khula ho to abhi hata do — warna wo AI ke sar chadhega.
  clearSlow();
}

/** Ek AI call khatam (chahe kaamyab ho ya fail). */
export function aiCallEnded(): void {
  aiBusy = Math.max(0, aiBusy - 1);
}

/* -------------------------------- probe -------------------------------- */

const SLOW_MS = 4000;
/** Itni der pehle tak koi request chali thi to probe ki zaroorat hi nahi. */
const FRESH_SUCCESS_MS = 10_000;
/** Banner kitni der dikhe (agar probe ne haan kaha). */
const SLOW_SHOW_MS = 8000;
/** Slow-probe itne me jawab de de to net theek hai. */
const SLOW_PROBE_MS = 2500;
/** Offline-probe ko thodi zyada mohlat — wahan galat "No internet" mehnga hai. */
const OFFLINE_PROBE_MS = 4000;

/**
 * Ek halki request bhej ke sach pata karo.
 * Koi bhi HTTP jawaab (200/400/401 — kuch bhi) = internet chalu hai.
 * Sirf network error / timeout = sach me offline.
 */
async function probeOnce(url: string, timeoutMs: number): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    await fetch(url, { method: "GET", signal: ctrl.signal, cache: "no-store" });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

function probeTargets(): string[] {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  return [
    base ? `${base}/auth/v1/health` : null,
    "https://www.gstatic.com/generate_204",
    "https://cloudflare.com/cdn-cgi/trace",
  ].filter(Boolean) as string[];
}

/**
 * Internet pahunch raha hai ya nahi.
 *
 * ⚠️ Teeno host EK SAATH try hote hain, ek ke baad ek nahi. Pehle ye sequential
 * tha, matlab sabse kharab soorat me 3 × 4s = 12 second lagte the — itni der me
 * user ke saamne kuch bhi na dikhna apne aap me ek dikkat thi. Ek bhi host ne
 * jawaab diya to internet chalu hai, isliye saath bhejne me kuch nuksaan nahi.
 */
export async function isReachable(timeoutMs: number = OFFLINE_PROBE_MS): Promise<boolean> {
  const results = await Promise.all(probeTargets().map((u) => probeOnce(u, timeoutMs)));
  return results.some(Boolean);
}

/**
 * Kisi async kaam ko time karo. Error waisa hi aage bhejta hai.
 *
 * ⚠️ **Ghadi shak hai, saboot nahi.** Ye is file ka sabse zaroori niyam hai.
 *
 * Pehle niyam ye tha: "request 4 second se zyada le gayi → internet dheema".
 * Wo niyam hi galat tha. Request der se aane ke chaar alag kaaran hote hain —
 * dheema internet, slow server, bhaari DB query, aur AI ka sochna — aur inme se
 * sirf EK ka internet se lena-dena hai. Ghadi in chaaron me fark nahi kar
 * sakti, isliye wo teen baar me se teen baar jhoot bolti thi. Yahi wo "net
 * bilkul theek hai phir bhi slow bolta hai" wali shikayat thi, jo threshold
 * badal-badal ke do baar 'fix' ho chuki thi aur dono baar wapas aa gayi —
 * kyunki har baar number badla gaya tha, niyam nahi.
 *
 * Ab der hone par ek halka probe bheja jaata hai. Wo turant aa gaya to galti
 * net ki nahi hai — banner nahi dikhta, chahe asli request kitni bhi der le.
 * Probe bhi atak gaya, tabhi banner sach bolta hai.
 */
export async function timed<T>(work: Promise<T>, slowMs: number = SLOW_MS): Promise<T> {
  // Probe ke aane tak kaam khatam ho sakta hai — tab banner bemtlab hai.
  let pending = true;
  const t = setTimeout(() => {
    void confirmSlow(() => pending);
  }, slowMs);
  try {
    const out = await work;
    pending = false;
    clearTimeout(t);
    clearSlow();
    reportOnline();
    return out;
  } catch (e) {
    pending = false;
    clearTimeout(t);
    throw e;
  }
}

/**
 * Request der kar rahi hai — ab saboot dhoondo.
 *
 * `stillPending` isliye: probe khud 2.5 second le sakta hai, aur utni der me
 * asli request aa bhi sakti hai. Kaam ho chukne ke baad banner dikhana ulta
 * aur zyada confusing hai.
 */
async function confirmSlow(stillPending: () => boolean): Promise<void> {
  if (aiBusy > 0) return; // AI chal rahi hai — banner bilkul nahi
  if (!stillPending()) return;

  const ok = await isReachable(SLOW_PROBE_MS);
  if (ok) return; // net theek hai, galti doosre chhor ki — chup raho
  if (!stillPending()) return;
  if (aiBusy > 0) return; // probe ke beech me AI shuru ho gayi

  slowUntil = Date.now() + SLOW_SHOW_MS;
  emit();
}

export type NetStatus = { offline: boolean; slow: boolean };

export function useNetworkStatus(): NetStatus {
  const net = Network.useNetworkState();
  const [slow, setSlow] = useState(false);
  const [offline, setOffline] = useState(false);
  // Lagatar kitni baar probe fail hua. Do se kam par banner nahi dikhate — ek
  // akela fail aksar sirf ek flaky request hota hai, offline nahi.
  const fails = useRef(0);

  useEffect(() => {
    // `aiBusy` ek plain module variable hai (reactive nahi), isliye use yahan
    // har tick par dobara padha jaata hai — AI shuru hote hi banner hat jaye.
    const update = () => setSlow(Date.now() < slowUntil && aiBusy === 0);
    listeners.add(update);
    // slowUntil apne aap expire ho jaata hai — halka sa timer usse clear karta hai.
    const iv = setInterval(update, 1000);
    return () => {
      listeners.delete(update);
      clearInterval(iv);
    };
  }, []);

  const connected = net.isConnected;
  const reachable = net.isInternetReachable;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    function verify(delay: number) {
      timer = setTimeout(async () => {
        if (cancelled) return;

        // App ki koi request abhi-abhi chali thi? To net pakka hai — probe skip.
        if (Date.now() - lastSuccessAt < FRESH_SUCCESS_MS) {
          fails.current = 0;
          setOffline(false);
          verify(6000);
          return;
        }

        const ok = await isReachable();
        if (cancelled) return;

        if (ok) {
          fails.current = 0;
          setOffline(false);
          // Online hai — dobara check karne ki jaldi nahi.
          return;
        }

        fails.current += 1;
        // Do lagatar fail ke baad hi banner. Uske baad har 5s me dobara check,
        // taaki net wapas aate hi banner khud hat jaye.
        if (fails.current >= 2) setOffline(true);
        verify(5000);
      }, delay);
    }

    // OS kehta hai connection hi nahi hai — sabse strong ishaara, par phir bhi
    // confirm karte hain (flags galat hote hain), bas jaldi.
    if (connected === false) {
      verify(800);
    } else if (reachable === false) {
      // Connection hai par reachability `false` — yahi flag sabse zyada jhooth
      // bolta hai, isliye aaram se confirm karo.
      verify(2500);
    } else {
      // Sab theek lag raha hai — banner turant hata do.
      fails.current = 0;
      setOffline(false);
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [connected, reachable]);

  // App wapas foreground me aayi — purana "offline" leke mat baitho, dobara jaancho.
  useEffect(() => {
    if (!offline) return;
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s !== "active") return;
      void isReachable().then((ok) => {
        if (ok) {
          fails.current = 0;
          setOffline(false);
        }
      });
    });
    return () => sub.remove();
  }, [offline]);

  return { offline, slow: slow && !offline };
}
