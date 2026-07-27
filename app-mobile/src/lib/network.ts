import { useEffect, useState } from "react";
import * as Network from "expo-network";

/**
 * Network status — user ko batana ki internet nahi hai ya dheema hai.
 *
 *  - offline : device connected hi nahi, YA connected hai par internet
 *              pahunch nahi raha (wifi hai par net nahi — sabse aam case).
 *  - slow    : koi request 4s+ le gayi. Screens `reportSlow()` call karti hain.
 */

let slowUntil = 0;
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

const SLOW_MS = 4000;

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
    return out;
  } catch (e) {
    clearTimeout(t);
    throw e;
  }
}

export type NetStatus = { offline: boolean; slow: boolean };

/**
 * Sach me internet hai ya nahi — ek chhoti si request bhej ke check karo.
 * expo-network ka `isInternetReachable` kai Android phones par galti se `false`
 * atka reh jaata hai (net chalu hone par bhi). Isliye banner dikhane se pehle
 * hum khud ek halki request bhej ke confirm karte hain.
 */
async function probeInternet(): Promise<boolean> {
  const base = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const target = base ? `${base}/auth/v1/health` : "https://www.gstatic.com/generate_204";
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    // Koi bhi HTTP jawaab (200/400/401 kuch bhi) = internet chalu hai.
    // Sirf network error / timeout = sach me offline.
    await fetch(target, { method: "GET", signal: ctrl.signal, cache: "no-store" });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

export function useNetworkStatus(): NetStatus {
  const net = Network.useNetworkState();
  const [slow, setSlow] = useState(false);
  const [offline, setOffline] = useState(false);

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

    // 1) Device ke paas koi connection hi nahi (wifi/data band) = pakka offline.
    if (connected === false) {
      const t = setTimeout(() => !cancelled && setOffline(true), 1500);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }

    // 2) Connection hai par reachability `false` — yeh flag bharosemand nahi hai.
    //    Khud probe karke confirm karo; probe pass hua to banner mat dikhao.
    if (reachable === false) {
      const t = setTimeout(async () => {
        const ok = await probeInternet();
        if (!cancelled) setOffline(!ok);
      }, 2500);
      return () => {
        cancelled = true;
        clearTimeout(t);
      };
    }

    // 3) Sab theek — banner turant hata do.
    setOffline(false);
    return () => {
      cancelled = true;
    };
  }, [connected, reachable]);

  return { offline, slow: slow && !offline };
}
