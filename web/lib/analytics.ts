"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";

/**
 * Web analytics — apne hi Supabase me (`analytics_events`), app ke saath ek hi
 * table. Isliye admin panel me ek user ka poora safar ek jagah dikhta hai:
 * pehle website par kaunse page dekhe, phir app me kya kiya.
 *
 * GA4 (components/Analytics.tsx) alag se chalta rehta hai — wo aggregate ke liye
 * hai, ye per-user journey ke liye. Dono ka kaam alag hai.
 *
 * Niyam wahi: kabhi UI block na kare, har error chup-chaap nigal liya jaaye.
 */

const FLUSH_MS = 3000;
const MAX_BATCH = 25;
const VISITOR_KEY = "saathi-visitor-id";

type Event = {
  user_id: string | null;
  device_id: string | null;
  session_id: string;
  source: "web";
  name: string;
  target: string | null;
  props: Record<string, unknown> | null;
};

let queue: Event[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
let sessionId = "";
let visitorId: string | null = null;
let userId: string | null = null;

function rand(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Visitor id localStorage me (device jaisa), session id sessionStorage me
 * (ek tab = ek baithak). Dono anonymous hain — koi PII nahi.
 */
function ids(): { visitor: string; session: string } {
  if (typeof window === "undefined") return { visitor: "", session: "" };
  if (!visitorId) {
    try {
      visitorId = window.localStorage.getItem(VISITOR_KEY);
      if (!visitorId) {
        visitorId = rand();
        window.localStorage.setItem(VISITOR_KEY, visitorId);
      }
    } catch {
      visitorId = rand(); // private mode — sirf is page ke liye
    }
  }
  if (!sessionId) {
    try {
      sessionId = window.sessionStorage.getItem("saathi-session-id") ?? "";
      if (!sessionId) {
        sessionId = rand();
        window.sessionStorage.setItem("saathi-session-id", sessionId);
      }
    } catch {
      sessionId = rand();
    }
  }
  return { visitor: visitorId, session: sessionId };
}

async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  const sb = supabaseBrowser;
  if (!sb || queue.length === 0) return;
  const batch = queue.slice(0, MAX_BATCH);
  queue = queue.slice(batch.length);
  try {
    await sb.from("analytics_events").insert(batch);
  } catch {
    /* analytics ke liye retry nahi */
  }
}

function push(name: string, target?: string | null, props?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  const { visitor, session } = ids();
  queue.push({
    user_id: userId,
    device_id: visitor,
    session_id: session,
    source: "web",
    name,
    target: target ?? null,
    props: props && Object.keys(props).length ? props : null,
  });
  if (queue.length >= MAX_BATCH) {
    void flush();
    return;
  }
  if (!timer) timer = setTimeout(() => void flush(), FLUSH_MS);
}

/** Page dekha gaya. */
export function trackPage(path: string, props?: Record<string, unknown>): void {
  push("page_view", path, props);
}

/** Button/link dabaya gaya. `target` chhota aur sthir rakho — "hero_download". */
export function trackClick(target: string, props?: Record<string, unknown>): void {
  push("click", target, props);
}

/** Koi bhi custom event. */
export function trackEvent(
  name: string,
  target?: string,
  props?: Record<string, unknown>,
): void {
  push(name, target ?? null, props);
}

/** Web par logged-in user ho (checkout waghera) to events usse jodo. */
export function setWebUser(uid: string | null): void {
  userId = uid;
}

/**
 * Tab band ho raha hai — jo bacha hai turant bhej do.
 * `visibilitychange` hi bharosemand hai; `beforeunload` mobile par nahi chalta.
 */
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
}
