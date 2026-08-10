import { useEffect, useState } from "react";
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

/* --------------------------- offline: ek hi sach --------------------------- */

/**
 * `offline` poore app ka EK sajha sach hai — har hook ka apna nahi.
 *
 * ⚠️ Ye module-level hona zaroori hai. `useNetworkStatus()` teen jagah se
 * bulaya jaata hai (`_layout`, `NetworkBanner`, `OfflineGate`). Pehle har
 * instance ka apna `useState` aur apna probe-loop tha, yaani teen alag jawab
 * ek doosre se ladte the: Gate "offline" kehta tha aur usi pal doosra hook
 * "online" par pahunch jaata tha. Screen offline aur home ke beech jhilmilaati
 * thi. Ab ek hi jagah faisla hota hai aur teenon usse padhte hain.
 */
let offlineNow = false;
const offlineListeners = new Set<(v: boolean) => void>();

function setOffline(v: boolean): void {
  if (offlineNow === v) return;
  offlineNow = v;
  offlineListeners.forEach((l) => l(v));
}

/** Lagatar kitne probe fail hue — do se kam par offline nahi maante. */
let probeFails = 0;
/** Ek waqt me ek hi probe-chakkar. */
let monitorRunning = false;

/**
 * OS ke flag ki aakhri haalat.
 *
 * ⚠️ Ye faisla nahi karte (upar `monitorLoop` me wajah likhi hai) — ye sirf ye
 * batate hain ki probe ki ZAROORAT hai ya nahi. Sab theek dikh raha ho aur hum
 * offline bhi na hon, to har 15 second me ek probe bhejna sirf battery aur data
 * kharch karna hai; wahan chup rehna hi theek hai. Shak hote hi probe wapas
 * chalu ho jaata hai.
 */
let flagsHealthy = true;

/**
 * Net ka pehra — app ke chalte rehne tak.
 *
 * ⚠️ Iska sabse zaroori niyam: **offline sirf ek KAAMYAB probe se hatta hai,
 * kisi flag se nahi.** Purana code ulta karta tha —
 *
 *     } else { fails.current = 0; setOffline(false); }
 *
 * yaani jaise hi `expo-network` ke dono flag theek dikhte, offline turant band
 * kar diya jaata tha, bina kuch jaanche. Aur wahi flags sabse zyada jhooth
 * bolte hain: data band karte hi Android kuch second ke liye `isConnected:
 * true` / `isInternetReachable: undefined` bhejta rehta hai (Wi-Fi jo juda to
 * hai par internet nahi de raha, ya SIM ka transition). Uska seedha natija
 * wahi tha jo user ne dekha — **offline screen ek pal ke liye aati thi aur
 * uske baad app ka home page wapas aa jaata tha.**
 *
 * Ab flags sirf itna tay karte hain ki AGLA probe kitni jaldi chale. Faisla
 * hamesha probe ka hai.
 */
async function monitorLoop(): Promise<void> {
  if (monitorRunning) return;
  monitorRunning = true;

  try {
    while (offlineListeners.size > 0) {

      /**
       * App ki koi asli request abhi-abhi kaamyab hui thi — wo probe se bhi
       * bada saboot hai.
       *
       * ⚠️ Par ye chhoot sirf tab hai jab hum PEHLE SE offline na hon. Purana
       * code offline hote hue bhi is raaste par `setOffline(false)` kar deta
       * tha, yaani ek 10 second purani kaamyabi offline screen ko hata deti thi
       * — chahe net abhi bhi na ho.
       */
      if (!offlineNow && Date.now() - lastSuccessAt < FRESH_SUCCESS_MS) {
        probeFails = 0;
        await wait(6000);
        continue;
      }

      // Online hain aur OS ko bhi koi shak nahi — bekaar me probe mat bhejo.
      if (!offlineNow && flagsHealthy) {
        await wait(10_000);
        continue;
      }

      const ok = await isReachable();
      if (ok) {
        probeFails = 0;
        setOffline(false);
        // Online hai — ab aaram se dekhte rahenge.
        await wait(15_000);
        continue;
      }

      probeFails += 1;
      // Ek akela fail aksar sirf ek flaky request hota hai, offline nahi.
      if (probeFails >= 2) setOffline(true);
      // Offline hone ke baad thodi-thodi der me dekhte raho — net wapas aate hi
      // screen khud hat jaati hai.
      await wait(4000);
    }
  } finally {
    monitorRunning = false;
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** "Abhi dekho" — retry button aur foreground par aane ke liye. */
export async function recheckNow(): Promise<boolean> {
  const ok = await isReachable();
  if (ok) {
    probeFails = 0;
    setOffline(false);
  }
  return ok;
}

export function useNetworkStatus(): NetStatus {
  const net = Network.useNetworkState();
  const [slow, setSlow] = useState(false);
  const [offline, setOfflineState] = useState(offlineNow);

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

  // Sajhe sach se judo, aur pehra chalu rakho.
  useEffect(() => {
    offlineListeners.add(setOfflineState);
    /**
     * ⚠️ `useState(offlineNow)` upar pehli value de chuka hai, par uske aur is
     * effect ke beech me wo badal sakti hai (probe doosre hook ke loop se chal
     * raha hota hai) — aur us beech hum listener me the hi nahi. Isliye ek
     * baar mila lete hain.
     *
     * Functional update se React barabar hone par render skip kar deta hai, to
     * ye "cascading render" wali baat nahi banti — lint us farak ko dekh nahi
     * paata, isliye rule yahan band hai.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOfflineState((prev) => (prev === offlineNow ? prev : offlineNow));
    void monitorLoop();
    return () => {
      offlineListeners.delete(setOfflineState);
    };
  }, []);

  const connected = net.isConnected;
  const reachable = net.isInternetReachable;

  /**
   * OS ka ishaara — sirf "abhi jaancho" ke liye.
   *
   * Flag kabhi apne aap offline nahi banata aur na hi hataata hai (upar wali
   * wajah). Wo bas ek jaldi probe chala deta hai, taaki data band karte hi
   * offline screen 15 second ka intezaar na kare.
   */
  useEffect(() => {
    flagsHealthy = connected !== false && reachable !== false;
    if (!flagsHealthy) {
      let cancelled = false;
      const t = setTimeout(() => {
        if (cancelled) return;
        void isReachable(OFFLINE_PROBE_MS).then((ok) => {
          if (cancelled) return;
          if (ok) {
            probeFails = 0;
            setOffline(false);
          } else {
            probeFails += 1;
            if (probeFails >= 2) setOffline(true);
          }
        });
      }, connected === false ? 500 : 1500);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }
  }, [connected, reachable]);

  // App wapas foreground me aayi — purana "offline" leke mat baitho, dobara jaancho.
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
      if (s !== "active" || !offlineNow) return;
      void recheckNow();
    });
    return () => sub.remove();
  }, []);

  return { offline, slow: slow && !offline };
}
