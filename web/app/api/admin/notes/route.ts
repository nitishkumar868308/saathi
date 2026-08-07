import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Admin: Notes ka hisaab — kisne kitne note banaye, aur unme se kitno ka
 * reminder bhi bana.
 *
 * ⚠️ Note ka MATN (title/body) yahan JAAN-BOOJH KE nahi aata, aur ye ek soch
 * samajh ke liya faisla hai. Note user ki sabse niji cheez hai — bazaar ki
 * list, ek idea, kisi ka number, kabhi paise ka hisaab. Admin ko jo sach me
 * jaanna hai wo hai "feature chal raha hai ya nahi, aur note se reminder banta
 * bhi hai ya log sirf likh ke chhod dete hain" — us poore sawaal ka jawab
 * ginti aur waqt se mil jaata hai. Uske liye kisi ka likha hua padhne ki
 * zaroorat nahi.
 *
 * Poora hisaab `admin_notes_summary()` (security definer) lagata hai — do table
 * ka join client par karne se har baar poori `notes` table kheenchni padti,
 * jisme wahi matn aa jaata jise hum jaan-boojh ke nahi mangwa rahe.
 */
export async function GET() {
  const g = await guard("notes");
  if (!g.ok) return g.res;
  if (!SUPABASE_URL || !SERVICE) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/admin_notes_summary`, {
      method: "POST",
      headers: {
        apikey: SERVICE,
        Authorization: `Bearer ${SERVICE}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ p_limit: 300 }),
      cache: "no-store",
    });

    if (!res.ok) {
      const detail = await res.text();
      // 404 ka matlab lagbhag hamesha ek hi hota hai: migration chali hi nahi.
      // Use "kuch gadbad ho gayi" me badalna wo ek din bekaar kar deta hai jo
      // wajah dhoondhne me jaata hai.
      const missing = res.status === 404 || detail.includes("admin_notes_summary");
      return NextResponse.json(
        {
          error: missing ? "migration_missing" : "fetch failed",
          detail: missing
            ? "supabase/notes.sql aur supabase/notes-reminder-link.sql chalao"
            : detail.slice(0, 300),
        },
        { status: missing ? 503 : 500 },
      );
    }

    return NextResponse.json(await res.json());
  } catch (e) {
    return NextResponse.json({ error: "fetch failed", detail: String(e) }, { status: 500 });
  }
}
