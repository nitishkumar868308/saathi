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

  // Raw offline: device connected hi nahi, YA internet reach nahi kar raha.
  // isInternetReachable undefined ho sakta hai (abhi pata nahi) — tab offline mat kaho.
  const rawOffline = net.isConnected === false || net.isInternetReachable === false;

  // ⚠️ expo-network shuruaat me kuch pal ke liye galat `false` de deta hai (net on hone
  //    par bhi) — isliye offline turant mat dikhao. 3s tak lagataar offline rahe tabhi
  //    banner dikhao. Wapas online hote hi turant hata do.
  useEffect(() => {
    if (!rawOffline) {
      setOffline(false);
      return;
    }
    const t = setTimeout(() => setOffline(true), 3000);
    return () => clearTimeout(t);
  }, [rawOffline]);

  return { offline, slow: slow && !offline };
}
