import { NextResponse } from "next/server";

import { playBillingEnabled } from "@/lib/play-billing";
import { planDbConfigured } from "@/lib/plan-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * "Kharidari ke baad Plus DIYA ja sakega ya nahi" — app isse poochh kar hi
 * payment shuru karti hai.
 *
 * ── Ye kyun bana ───────────────────────────────────────────────────────────
 *
 * ⚠️ App khud `profiles.plan` likh HI nahi sakti (supabase/column-grants.sql) —
 * aur wo bilkul sahi hai, warna APK me padi anon key se koi bhi khud ko Plus de
 * leta. Iska seedha natija ye hai ki Plus dene ka **ek hi raasta** bacha hai:
 * RevenueCat ka webhook.
 *
 * Aur wo webhook default me BAND hai (`PLAY_BILLING_ENABLED=1` +
 * `REVENUECAT_WEBHOOK_SECRET`). In do env ke bina ek chup-chaap aur sabse bura
 * haal banta tha:
 *
 *   1. User Play par paisa de deta hai — wo sach me kat jaata hai.
 *   2. RevenueCat webhook maarta hai, hamara server 503 kehta hai.
 *   3. `profiles.plan` kabhi nahi badalta.
 *   4. App "Plus chalu ho raha hai…" par hamesha ke liye atki rehti hai.
 *
 * Kahin koi error nahi, koi alert nahi. Sirf ek user jisne paisa diya aur use
 * kuch nahi mila — aur pata tab chalta jab wo shikayat karta.
 *
 * Ab wo soorat ban hi nahi sakti: payment shuru hone se PEHLE app yahan poochh
 * leti hai. Jawab "nahi" ho to kharidari shuru hi nahi hoti.
 *
 * ⚠️ Jawab me sirf `ready` jaata hai, wajah nahi. Ye endpoint khula hai (app ko
 * login se pehle bhi chahiye ho sakta hai), aur "kaunsa env set nahi hai" ye
 * baat bahar batane ki koi zaroorat nahi. Poori wajah admin > Payments me
 * dikhti hai, jahan wo dekhni chahiye.
 */
export async function GET() {
  return NextResponse.json(
    { ready: playBillingEnabled() && planDbConfigured() },
    {
      /**
       * ⚠️ Cache bilkul nahi. Ye jawab theek us lamhe ka sach hona chahiye jab
       * user paisa dene ja raha hai. Ek purana "ready: true" wahi chhed wapas
       * khol deta hai jise ye band karne aaya hai.
       */
      headers: { "Cache-Control": "no-store" },
    },
  );
}
