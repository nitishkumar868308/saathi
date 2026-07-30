import { useEffect, useState } from "react";

/**
 * "Net ki wajah se kaam nahi hua" — ek jagah se poore app ka popup.
 *
 * Pehle aisa hota tha: internet slow tha, request chup-chaap fail ho jaati thi,
 * loader hat jaata tha, banner bhi 8 second baad khud gayab ho jaata tha — aur
 * user ke saamne kuch bhi nahi bachta tha. Usse lagta tha app hi kaam nahi kar
 * raha (item 12 & 20).
 *
 * Ab har failed kaam yahan report hota hai. Ek center-screen modal khulta hai
 * jo saaf kehta hai ki dikkat internet ki hai, aur "Dobara koshish karo" deta
 * hai — wahi kaam dobara chal jaata hai, user ko screen chhodni nahi padti.
 *
 * `retry` optional hai: jahan dobara chalane layak kaam ho wahan do, warna modal
 * sirf batata hai.
 */

export type NetFailKind =
  | "load" /** data padhne me (GET) */
  | "save" /** data bhejne me (POST/PATCH) */
  | "ai"; /** AI ne padha/samjha hi nahi */

export type NetFailure = {
  kind: NetFailKind;
  /** Dobara koshish — na ho to modal me sirf "Theek hai" aata hai. */
  retry?: () => void | Promise<void>;
};

let current: NetFailure | null = null;
const listeners = new Set<(f: NetFailure | null) => void>();

function emit() {
  listeners.forEach((l) => l(current));
}

/**
 * Kya ye error internet ki wajah se hai?
 *
 * Supabase/fetch har layer alag shakal me error deta hai — kahin `TypeError:
 * Network request failed`, kahin `AbortError`, kahin supabase ka apna
 * `FetchError`. Isliye message par match karte hain, class par nahi.
 *
 * Jaan-boojh ke thoda "udaar" hai: net ki galti ko app ki galti dikhane se
 * behtar hai ki kabhi-kabhi app ki galti ko net keh dein — user ko retry to
 * milta hai.
 */
export function isNetworkError(e: unknown): boolean {
  if (!e) return false;
  const msg = (
    typeof e === "string" ? e : ((e as Error)?.message ?? String(e))
  ).toLowerCase();
  return (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("abort") ||
    msg.includes("connection") ||
    msg.includes("offline") ||
    msg.includes("econnreset") ||
    msg.includes("enotfound") ||
    msg.includes("failed to")
  );
}

/** Net ki wajah se kaam ruk gaya — poore app ka popup dikhao. */
export function reportNetFailure(kind: NetFailKind, retry?: () => void | Promise<void>): void {
  current = { kind, retry };
  emit();
}

/**
 * Error net ka ho tabhi popup dikhao. Baaki errors caller khud sambhale
 * (toast/report-error) — har cheez ko "internet ki dikkat" kehna jhooth hoga.
 *
 * `true` lauta to popup dikh gaya, matlab caller ko apna toast dikhane ki
 * zaroorat nahi.
 */
export function reportIfNetwork(
  e: unknown,
  kind: NetFailKind,
  retry?: () => void | Promise<void>,
): boolean {
  if (!isNetworkError(e)) return false;
  reportNetFailure(kind, retry);
  return true;
}

export function clearNetFailure(): void {
  if (!current) return;
  current = null;
  emit();
}

export function useNetFailure(): NetFailure | null {
  const [f, setF] = useState<NetFailure | null>(current);
  useEffect(() => {
    listeners.add(setF);
    return () => {
      listeners.delete(setF);
    };
  }, []);
  return f;
}
