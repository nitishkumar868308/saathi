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

export function reportError(
  err: unknown,
  context: ErrorContext = {},
  level: "error" | "warn" = "error",
): void {
  const e = err instanceof Error ? err : new Error(String(err));
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
      p_context: context,
      p_platform: Platform.OS,
      p_app_version: APP_VERSION,
    }),
  ).catch(() => {
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
