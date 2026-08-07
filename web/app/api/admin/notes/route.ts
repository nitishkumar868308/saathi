import { NextResponse } from "next/server";
import { guard } from "@/lib/admin-guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Admin: Notes.
 *
 *   GET                 → hisaab (kisne kitne likhe, kitno ka reminder bana)
 *   GET ?view=content   → poora matn, jaisa likha gaya waisa
 *
 * ⚠️ Pehle matn yahan JAAN-BOOJH KE nahi aata tha. Ab aata hai, kyunki maalik
 * ne yahi maanga. Par jo baat pehle sach thi wo ab bhi utni hi sach hai:
 *
 *   Note user ki sabse niji cheez hai — bazaar ki list, ek idea, kisi ka
 *   number, kabhi paise ka hisaab. User ne ye is bharose par likha ki ye uska
 *   apna hai.
 *
 * Isliye do cheezein poori honi chahiye, aur inhe nibhana code ka nahi, chalane
 * wale ka kaam hai:
 *
 *   1. Privacy policy me saaf likha ho ki support/admin notes ka matn dekh
 *      sakta hai. (India ka DPDP, EU ka GDPR — dono me ye likhe bina dekhna
 *      galat hai.)
 *   2. `notes` menu ki permission sirf unhe mile jinhe sach me chahiye
 *      (dekho lib/admin-menus.ts aur AdminTeam).
 *
 * Hisaab aur matn do alag call me isliye hain ki page khulte hi kisi ka likha
 * hua chup-chaap load na ho jaye — matn tabhi aata hai jab admin ne use maanga
 * ho.
 */

function svcHeaders() {
  return {
    apikey: SERVICE as string,
    Authorization: `Bearer ${SERVICE}`,
    "content-type": "application/json",
  };
}

async function rpc(name: string, args: Record<string, unknown>) {
  return fetch(`${SUPABASE_URL}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: svcHeaders(),
    body: JSON.stringify(args),
    cache: "no-store",
  });
}

export async function GET(request: Request) {
  const g = await guard("notes");
  if (!g.ok) return g.res;
  if (!SUPABASE_URL || !SERVICE) {
    return NextResponse.json({ error: "supabase not configured" }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const wantContent = searchParams.get("view") === "content";

  try {
    const res = wantContent
      ? await rpc("admin_notes_list", {
          p_user: searchParams.get("user") || null,
          p_search: searchParams.get("q") || null,
          // Server bhi in dono ko apni hadd me baandhta hai — yahan sirf
          // bekaar ki badi request ko pehle hi rok dete hain.
          p_limit: Math.min(Math.max(Number(searchParams.get("limit")) || 25, 1), 200),
          p_offset: Math.max(Number(searchParams.get("offset")) || 0, 0),
        })
      : await rpc("admin_notes_summary", { p_limit: 300 });

    if (!res.ok) {
      const detail = await res.text();
      // 404 ka matlab lagbhag hamesha ek hi hota hai: migration chali hi nahi.
      // Use "kuch gadbad ho gayi" me badalna wo ek din bekaar kar deta hai jo
      // wajah dhoondhne me jaata hai.
      const fn = wantContent ? "admin_notes_list" : "admin_notes_summary";
      const missing = res.status === 404 || detail.includes(fn);
      return NextResponse.json(
        {
          error: missing ? "migration_missing" : "fetch failed",
          detail: missing
            ? wantContent
              ? "supabase/notes-admin-content.sql chalao"
              : "supabase/notes.sql aur supabase/notes-reminder-link.sql chalao"
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
