import { AppState, type AppStateStatus } from "react-native";

import { supabase } from "./supabase";
import { getDeviceId } from "./device";

/**
 * Analytics — sab kuch apne hi Supabase me (`analytics_events`).
 *
 * Pehle ye file Firebase ke liye ek no-op shell thi (USE_FIREBASE = false),
 * isliye poore app ke `logEvent()` call kahin jaate hi nahi the. Ab har event
 * seedha apne DB me jaata hai aur admin panel usi se user ka poora safar
 * (kaunsi screen, kaunsa button, kis order me) dikhata hai. Koi teesra vendor
 * beech me nahi.
 *
 * Design ke do niyam:
 *   1. Analytics kabhi UI ko rok na paaye — sab fire-and-forget, har error
 *      chup-chaap nigal liya jaata hai.
 *   2. Ek event = ek request nahi. Events 4 second ke chhote batch me jaate hain,
 *      warna scroll karte waqt darjanon request nikal jaayein.
 */

const FLUSH_MS = 4000;
const MAX_BATCH = 25;

type Event = {
  user_id: string | null;
  device_id: string | null;
  session_id: string;
  source: "app";
  name: string;
  target: string | null;
  props: Record<string, unknown> | null;
};

let userId: string | null = null;
let deviceId: string | null = null;
let sessionId = newSession();
let queue: Event[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

function newSession(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

void getDeviceId()
  .then((id) => {
    deviceId = id;
  })
  .catch(() => {});

// App background me gaya — jo bacha hai wo bhej do, warna wo events kabhi nahi
// pahunchte. Wapas aane par nayi session id (nayi baithak).
let wasBackground = false;
AppState.addEventListener("change", (s: AppStateStatus) => {
  if (s === "active") {
    if (wasBackground) sessionId = newSession();
    wasBackground = false;
  } else {
    wasBackground = true;
    void flush();
  }
});

async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!supabase || queue.length === 0) return;
  const batch = queue.slice(0, MAX_BATCH);
  queue = queue.slice(batch.length);
  try {
    await supabase.from("analytics_events").insert(batch);
  } catch {
    /* chala gaya to chala gaya — analytics ke liye retry nahi karte */
  }
}

function push(name: string, target?: string | null, props?: Record<string, unknown>) {
  queue.push({
    user_id: userId,
    device_id: deviceId,
    session_id: sessionId,
    source: "app",
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

/** Koi event log karo (jaise "reminder_created", "document_added"). */
export function logEvent(name: string, params?: Record<string, unknown>): void {
  push(name, (params?.target as string) ?? null, params);
}

/** Screen view — navigation ke liye. */
export function logScreen(name: string): void {
  push("screen_view", name);
}

/** Button/tap — journey ki sabse kaam ki line. */
export function logTap(target: string, props?: Record<string, unknown>): void {
  push("tap", target, props);
}

/** Non-fatal error record karo. `report-error.ts` alag se DB me bhi likhta hai. */
export function recordError(err: unknown, context?: string): void {
  const message = err instanceof Error ? err.message : String(err);
  push("error", context ?? null, { message: message.slice(0, 300) });
}

/** Logged-in user ko events se jodo. */
export function setAnalyticsUser(uid: string | null, plan?: string): void {
  const changed = uid !== userId;
  userId = uid;
  // Login/logout = nayi baithak, warna dono users ka safar ek hi session me mil
  // jaata hai aur journey padhne layak nahi rehti.
  if (changed) sessionId = newSession();
  if (uid && changed) push("session_start", null, plan ? { plan } : undefined);
}
