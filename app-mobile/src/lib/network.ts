import { useEffect, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import * as Network from "expo-network";

/**
 * Network status — user ko batana ki internet nahi hai ya dheema hai.
 *
 *  - offline : sach me internet nahi pahunch raha.
 *  - slow    : koi request 4s+ le gayi. Screens `reportSlow()` call karti hain.
 *
 * ⚠️ Yahan ka poora design ek hi baat par tika hai: **flag jhoot bol sakta hai,
 * request nahi.** expo-network ka `isInternetReachable` kai Android phones par
 * (khaaskar dual-SIM / 5G par) `false` pe atak jaata hai jabki net bilkul chalu
 * hota hai. Pehle hum us flag par banner dikha dete the — isliye "No internet"
 * dikhta tha jabki sab kaam kar raha tha.
 *
 * Ab banner tabhi aata hai jab do alag-alag probe request lagatar fail hon.
 */

let slowUntil = 0;
/** App ki kisi asli request ne last kab kaamyabi se jawab diya. */
let lastSuccessAt = 0;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

/** Koi kaam bahut dheema chala — kuch der "dheema internet" dikhao. */
export function reportSlow(): void {
  slowUntil = Date.now() + 8000;
  emit();
}

/** Kaam theek chala — dheema wala message turant hata do. */
export function clearSlow(): void {
  if (slowUntil > 0) {
    slowUntil = 0;
    emit();
  }
}

/**
 * App ki koi bhi request kaamyab hui — matlab internet pakka hai.
 * Isse OS ke jhoote "offline" flag ko turant kaat dete hain.
 */
export function reportOnline(): void {
  lastSuccessAt = Date.now();
  emit();
}

const SLOW_MS = 4000;
/** Itni der pehle tak koi request chali thi to probe ki zaroorat hi nahi. */
const FRESH_SUCCESS_MS = 10_000;

/**
 * Kisi async kaam ko time karo. 4s se zyada laga to "dheema" flag on.
 * Jaldi ho gaya to flag off. Error waisa hi aage bhejta hai.
 */
export async function timed<T>(work: Promise<T>): Promise<T> {
  const t = setTimeout(reportSlow, SLOW_MS);
  try {
    const out = await work;
    clearTimeout(t);
    clearSlow();
    reportOnline();
    return out;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

export type NetStatus = { offline: boolean; slow: boolean };

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

/**
 * Do-teen alag hosts try karo — ek block/down ho to doosra bata dega.
 * Ek bhi jawaab de diya to online.
 */
async function probeInternet(): Promise<boolean> {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const targets = [
    base ? `${base}/auth/v1/health` : null,
    "https://www.gstatic.com/generate_204",
    "https://cloudflare.com/cdn-cgi/trace",
  ].filter(Boolean) as string[];

  for (const url of targets) {
    if (await probeOnce(url, 4000)) return true;
  }
  return false;
}

export function useNetworkStatus(): NetStatus {
  const net = Network.useNetworkState();
  const [slow, setSlow] = useState(false);
  const [offline, setOffline] = useState(false);
  // Lagatar kitni baar probe fail hua. Do se kam par banner nahi dikhate — ek
  // akela fail aksar sirf ek flaky request hota hai, offline nahi.
  const fails = useRef(0);

  useEffect(() => {
    const update = () => setSlow(Date.now() < slowUntil);
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

        const ok = await probeInternet();
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
      void probeInternet().then((ok) => {
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
