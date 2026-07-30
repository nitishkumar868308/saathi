import { Platform } from "react-native";
import Constants from "expo-constants";

import { supabase } from "./supabase";
import { recordError } from "./analytics";

/**
 * App me kuch bhi toote to yahan bhejo — Supabase `app_errors` me chala jaata
 * hai, jahan se admin > Logs me dikhta hai aur email alert nikalta hai.
 *
 * Best-effort: reporting fail ho to app pe koi asar nahi.
 * `supabase/error-logs.sql` chal chuka hona chahiye.
 */

const APP_VERSION =
  (Constants.expoConfig?.version as string | undefined) ?? "dev";

/** Ek hi error baar-baar na bheje (loop/rerender se spam). */
const recent = new Map<string, number>();
const DEDUPE_MS = 60_000;

function shouldSend(key: string): boolean {
  const now = Date.now();
  const last = recent.get(key);
  if (last && now - last < DEDUPE_MS) return false;
  recent.set(key, now);
  if (recent.size > 60) {
    for (const [k, t] of recent) if (now - t > DEDUPE_MS) recent.delete(k);
  }
  return true;
}

export type ErrorContext = {
  /** Kaunsi screen — "documents", "add-reminder"… */
  screen?: string;
  /** Kya kar raha tha — "save", "load", "upload"… */
  action?: string;
  [k: string]: unknown;
};

/** Jin fields me asli message chhupa hota hai — pehla jo mile wahi lete hain. */
const MESSAGE_KEYS = ["message", "error_description", "msg", "error", "reason"] as const;
/** Ye alag se context me jaate hain, taaki admin > Logs me poora haal dikhe. */
const DETAIL_KEYS = ["code", "status", "statusCode", "details", "hint", "name"] as const;

function objectMessage(o: Record<string, unknown>): string {
  for (const k of MESSAGE_KEYS) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    // Nested error object (jaise `{ error: { message } }`).
    if (v && typeof v === "object") {
      const nested = objectMessage(v as Record<string, unknown>);
      if (nested !== "Unknown error") return nested;
    }
  }
  try {
    const json = JSON.stringify(o);
    if (json && json !== "{}") return json.slice(0, 300);
  } catch {
    /* circular object */
  }
  return "Unknown error";
}

/**
 * `throw error` se aksar Error nahi, plain object aata hai — Supabase ka
 * PostgrestError, fetch ka response, ya AuthError. Pehle hum seedha
 * `String(err)` karte the, jisse admin > Logs me har aisi error
 * "[object Object]" ban jaati thi — na message, na code, kuch pata nahi chalta
 * tha. Ab message andar se nikalte hain aur code/details context me bhejte hain.
 */
function normalize(err: unknown): { error: Error; details: Record<string, unknown> } {
  if (err instanceof Error) return { error: err, details: {} };
  if (typeof err === "string") {
    return { error: new Error(err.trim() || "Unknown error"), details: {} };
  }
  if (err && typeof err === "object") {
    const o = err as Record<string, unknown>;
    const error = new Error(objectMessage(o));
    // Original stack ho to wahi rakho — reportError ka apna stack bekaar hai.
    if (typeof o.stack === "string" && o.stack) error.stack = o.stack;
    const details: Record<string, unknown> = {};
    for (const k of DETAIL_KEYS) {
      const v = o[k];
      if (v !== undefined && v !== null && v !== "") details[k] = v;
    }
    return { error, details };
  }
  // null / undefined / number / boolean
  return { error: new Error(err == null ? "Unknown error" : String(err)), details: {} };
}

export function reportError(
  err: unknown,
  context: ErrorContext = {},
  level: "error" | "warn" = "error",
): void {
  const { error: e, details } = normalize(err);
  const message = e.message || "Unknown error";

  // Crashlytics (jab Firebase on ho) — dono jagah record ho.
  recordError(e, context.screen);

  if (!shouldSend(`${context.screen ?? ""}|${context.action ?? ""}|${message}`)) return;
  if (!supabase) return;

  void Promise.resolve(
    supabase.rpc("log_app_error", {
      p_message: message,
      p_source: "app",
      p_level: level,
      p_stack: e.stack ?? null,
      p_context: Object.keys(details).length ? { ...context, ...details } : context,
      p_platform: Platform.OS,
      p_app_version: APP_VERSION,
    }),
  )
    .then(({ error }) => {
      // ⚠️ `rpc()` fail par throw nahi karta — `{ error }` lautata hai. Isliye
      // logging khud toot jaye (RPC hi na ho, grant na ho) to admin > Logs
      // hamesha ke liye khaali rehti aur kisi ko bhanak bhi na lagti. Server
      // par ise bhej nahi sakte (wahi raasta toota hai), par logcat me dikha
      // dena kaafi hai — build me `adb logcat` se turant pata chal jaata hai.
      if (error) console.warn("[report-error] log_app_error failed:", error.message);
    })
    .catch(() => {
      /* best-effort */
    });
}

/**
 * Uncaught errors bhi pakdo (jo try/catch me nahi aate).
 * App start pe ek baar root se call hota hai.
 */
let installed = false;

export function installGlobalErrorHandler(): void {
  if (installed) return;
  installed = true;

  // React Native ka global JS error handler.
  const g = globalThis as {
    ErrorUtils?: {
      getGlobalHandler: () => (e: unknown, isFatal?: boolean) => void;
      setGlobalHandler: (h: (e: unknown, isFatal?: boolean) => void) => void;
    };
  };
  const prev = g.ErrorUtils?.getGlobalHandler?.();
  g.ErrorUtils?.setGlobalHandler?.((e, isFatal) => {
    reportError(e, { screen: "global", fatal: !!isFatal });
    prev?.(e, isFatal);
  });
}
