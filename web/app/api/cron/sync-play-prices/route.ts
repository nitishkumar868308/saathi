import { NextResponse } from "next/server";
import { beatCron } from "@/lib/cron-heartbeat";
import { playPricesConfigured, playPricesStatus, syncPlayPrices } from "@/lib/play-prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Play Console ke price roz ek baar `play_prices` me utar lo.
 *
 * ── Roz kyun kaafi hai ─────────────────────────────────────────────────────
 * Subscription ka daam mahine-saal me ek baar badalta hai, ghante-ghante nahi.
 * Aur jab aap khud badlo, to intezar karne ki zaroorat hi nahi — admin panel me
 * "Sync now" hai, wo turant chalata hai. Cron sirf is baat ka bima hai ki koi
 * Console me price badal kar admin panel kholna bhool jaye.
 *
 * ⚠️ Sync fail hone par bhi ye 200 lautata hai, 500 nahi — jaan-boojh ke.
 *    Yahan fail hone ka matlab itna hi hai ki price PURANA reh gaya, koi kaam
 *    ruka nahi. 500 dene se cron runner isse retry karta rehta aur (Vercel par)
 *    alert bhi bhejta — us shor ka koi faida nahi. Asli haal `ok` field me hai
 *    aur admin panel me saaf dikhta hai ("aakhri sync: 3 din pehle").
 *
 * Schedule (Vercel cron ya pg_cron, jo bhi chal raha ho):
 *   POST /api/cron/sync-play-prices
 *   Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: Request) {
  const auth = request.headers.get("authorization");
  if (!CRON_SECRET || auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  // Auth paar ho gayi — yaani cron ki call sach me aayi AUR secret bhi sahi
  // tha. Yahi wo ek nishaan hai jo admin ko "job hi nahi hai" aur "job hai par
  // secret purana hai" me farq karne deta hai (wajah `lib/cron-heartbeat.ts`).
  beatCron("sync-play-prices");

  if (!playPricesConfigured()) {
    // 503 — "abhi chalu hi nahi hai" aur "chal ke fail ho gaya" do alag baatein
    // hain, aur setup ke waqt yahi farak sabse zyada kaam aata hai.
    return NextResponse.json(
      { ok: false, skipped: true, reason: playPricesStatus() },
      { status: 503 },
    );
  }

  const result = await syncPlayPrices();
  if (!result.ok) console.error("[cron/sync-play-prices]", result.message);
  return NextResponse.json(result);
}
