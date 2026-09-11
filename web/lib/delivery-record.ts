import { logServerError } from "@/lib/errors-server";
import type { DeliveryChannel, DeliveryKind, DeliveryReason } from "@/lib/delivery-log";

/**
 * "Kis kaam ke liye kis raaste par kya hua" — `delivery_log` me.
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

export type DeliveryRecord = {
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
};

/**
 * Poore cron run ka record — EK call me, sabse aakhir me.
 *
 * ⚠️ Ye sirf safai nahi hai, aur na hi baad me karne wali baat.
 *
 * `send-reminders` ek baar me 50 reminder uthata hai, aur har ek par do raaste
 * likhne hote hain. Ek-ek karke bhejne par wo 100 seedhi network call ban jaati
 * hain — ek ke baad ek, har ek par poora round-trip. Us cron ke paas Vercel par
 * sirf kuch second hote hain.
 *
 * Aur wo kat gaya to sirf ye record hi nahi rukta — REMINDER BHEJNA ruk jaata
 * hai, aur wo bhi beech me. Khabar RAKHNE ki koshish khabar BHEJNE ko maar de,
 * ye kabhi theek nahi ho sakta. Isliye poora run jamaa hota hai aur ek hi baar
 * me jaata hai.
 *
 * Best-effort — ye kabhi throw nahi karta. Fail ho to wo baat Logs me chali
 * jaati hai, chup-chaap nahi jaati.
 */
export async function flushDeliveryRecords(rows: DeliveryRecord[]): Promise<void> {
  if (!SUPABASE_URL || !SUPABASE_KEY || rows.length === 0) return;

  /**
   * ⚠️ Ek (kaam, moment, raasta) sirf EK baar — bhejne se pehle chhaan lo.
   *
   * Postgres ek hi statement me ek row ko do baar `on conflict do update` nahi
   * karne deta: wo "cannot affect row a second time" phenk deta hai aur POORA
   * batch gir jaata hai. Yaani ek duplicate poore run ka record uda deta —
   * theek wo cheez jise ye file bachane ke liye bani hai.
   *
   * Baad wali entry jeetti hai: wo hamesha zyada taaza hoti hai (pehle "failed"
   * likha ho aur baad me "sent" ho gaya ho, to sach doosra wala hai).
   */
  const byKey = new Map<string, DeliveryRecord>();
  for (const r of rows) {
    byKey.set(`${r.kind}|${r.itemId}|${r.dueAt}|${r.channel}`, r);
  }
  const unique = Array.from(byKey.values());

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/log_delivery_batch`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_rows: unique.map((r) => ({
          kind: r.kind,
          item_id: r.itemId,
          user_id: r.userId,
          due_at: r.dueAt,
          channel: r.channel,
          status: r.status,
          reason: r.reason ?? null,
          plan: r.plan,
          detail: r.detail ?? null,
        })),
      }),
      cache: "no-store",
    });
    if (!res.ok) {
      void logServerError(
        new Error(
          `delivery_log batch likha nahi gaya — HTTP ${res.status} ` +
            `(supabase/delivery-log.sql run kiya?)`,
        ),
        { screen: "cron", action: "delivery-record", count: String(unique.length) },
        { source: "delivery", level: "warn" },
      );
    }
  } catch {
    /* net/DB ki dikkat — khabar bhejna phir bhi chalta rahe */
  }
}
