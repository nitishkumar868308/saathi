import { logServerError } from "@/lib/errors-server";
import type { DeliveryChannel, DeliveryKind, DeliveryReason } from "@/lib/delivery-log";

/**
 * "Kis kaam ke liye kis raaste par kya hua" — ek row, `delivery_log` me.
 *
 * ── Ye `delivery-log.ts` se ALAG kyun hai ──────────────────────────────
 *
 * Dono ka naam milta-julta hai, par kaam bilkul alag hai — aur dono chahiye:
 *
 *   • `delivery-log.ts` admin ke **Logs** page ke liye hai. Wo sirf RUKI hui
 *     delivery likhta hai, aur jaan-boojh ke BINA user-id ke, taaki ek jaisi
 *     lines group ho kar ek row banein ("12 logon ko WhatsApp nahi gaya —
 *     number verify nahi hua"). Wahan sawaal hai "aaj kya toota hai".
 *
 *   • Ye file har user ke apne ITIHAAS ke liye hai. Yahan har nateeja jaata
 *     hai — kaamyabi bhi, aur "Free plan isliye nahi gaya" bhi — aur hamesha
 *     user aur item ke saath. Wahan sawaal hai "is user ke is reminder ka kya
 *     hua".
 *
 * Ek ko doosre me milaane ki koshish dono ko kharab karti: Logs page lakhon
 * alag-alag rows se bhar jaata, aur itihaas me se kaamyabi gayab rehti.
 */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** `delivery_log.status` — bhejne ka nateeja. */
export type DeliveryStatus = "sent" | "skipped" | "failed";

/**
 * `delivery-log.ts` ki wajahon ke saath ek aur: Plus ka feature hai.
 *
 * ⚠️ Ye wajah pehle kahin likhi hi nahi jaati thi — cron me wo sirf ek ginti
 * thi (`skippedFree++`), bina kisi user ke naam ke. Yaani "mujhe WhatsApp nahi
 * aaya" ka sabse AAM jawab admin panel me kahin dikhta hi nahi tha.
 */
export type RecordReason = DeliveryReason | "free_plan";

/**
 * Ek delivery ka nateeja likho.
 *
 * Best-effort — ye kabhi throw nahi karta aur cron ko kabhi nahi rokta. Khabar
 * RAKHNE ki koshish khabar BHEJNE se zyada zaroori nahi ho sakti. Fail ho to
 * wo baat Logs me chali jaati hai, chup-chaap nahi jaati.
 */
export async function recordDelivery(opts: {
  kind: DeliveryKind;
  itemId: string;
  userId: string | null;
  /** Kis moment ki khabar — 7/1/0 din wala alert, ya reminder ka apna waqt. */
  dueAt: string;
  channel: DeliveryChannel;
  status: DeliveryStatus;
  reason?: RecordReason | null;
  /** Us waqt ka plan — baad me `profiles` se nikaalna galat hota (SQL par wajah). */
  plan: "free" | "plus";
  detail?: string | null;
}): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return;
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/log_delivery`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_kind: opts.kind,
        p_item_id: opts.itemId,
        p_user_id: opts.userId,
        p_due_at: opts.dueAt,
        p_channel: opts.channel,
        p_status: opts.status,
        p_reason: opts.reason ?? null,
        p_plan: opts.plan,
        p_detail: opts.detail ?? null,
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      void logServerError(
        new Error(`delivery_log likha nahi gaya — HTTP ${res.status}`),
        { screen: "cron", action: "delivery-record" },
        { source: "delivery", level: "warn" },
      );
    }
  } catch {
    /* net/DB ki dikkat — khabar bhejna phir bhi chalta rahe */
  }
}
