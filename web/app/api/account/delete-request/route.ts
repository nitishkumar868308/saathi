import { NextResponse } from "next/server";
import { sendAccountDeletionEmails } from "@/lib/email";
import { asLocale } from "@/lib/user-locale";

export const runtime = "nodejs";

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Account deletion request (Play Store data-deletion requirement).
 *
 * ⚠️ Pehle ye request `contact_messages` me ek prefix ke saath jaati thi
 * ("[ACCOUNT DELETE REQUEST] …"). Wo aam sandeshon ke beech dab jaati thi, uska
 * koi status nahi tha (kis par kaam hua, kis par nahi), aur admin uspar kuch
 * KAR nahi sakta tha — sirf padh sakta tha. Request lena kaafi nahi hai; use
 * poora karna bhi padta hai, aur uska saboot rakhna bhi.
 *
 * Ab apni table me jaati hai, jahan se admin panel use hide (soft) ya purge
 * (hard) kar sakta hai.
 */

function headers(extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_KEY as string,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

/**
 * Is email ka user id, agar mile.
 *
 * Form bina login ke bhara ja sakta hai (Play Store yahi maangta hai), isliye
 * `user_id` optional hai. Yahin mil jaye to admin ko ek kadam kam karna padta
 * hai — wo seedha dekh sakta hai ki is user ka kya-kya data hai.
 */
async function findUserId(email: string): Promise<string | null> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=id&limit=1`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { id: string }[];
    return rows[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Is email ki koi request pehle se pending to nahi?
 *
 * ⚠️ Ye ab zaroori hai. Pehle form sirf website par tha aur user usse ek hi baar
 * bharta tha. Ab app ke profile me bhi wahi button hai — aur wahan user usse
 * dobara, teesri baar dabata hai ("kuch hua hi nahi lagta"). Har tap par ek nayi
 * row banti to admin ke saamne ek hi banda das baar pending dikhta, aur asli
 * pending requests unme dab jaati.
 *
 * Fail hone par `false` — dobara poochhna ek request kho dene se behtar hai.
 */
async function alreadyPending(email: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_KEY) return false;
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/account_delete_requests` +
        `?email=eq.${encodeURIComponent(email)}&status=eq.pending&select=id&limit=1`,
      { headers: headers(), cache: "no-store" },
    );
    if (!res.ok) return false;
    const rows = (await res.json()) as { id: string }[];
    return rows.length > 0;
  } catch {
    return false;
  }
}

export async function POST(request: Request) {
  let name = "";
  let email = "";
  let reason = "";
  // Website par chuni hui bhasha — confirmation usi me jaana chahiye.
  let locale = asLocale(undefined);
  try {
    const body = await request.json();
    name = String(body?.name ?? "").trim();
    email = String(body?.email ?? "").trim();
    reason = String(body?.reason ?? "").trim();
    locale = asLocale(body?.locale);
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!name || !emailOk) {
    return NextResponse.json({ error: "invalid fields" }, { status: 400 });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return NextResponse.json({ error: "not configured" }, { status: 503 });
  }

  /**
   * Pehle se pending hai — nayi row mat banao, par user ko "fail" bhi mat kaho.
   *
   * Uske liye dono ka matlab ek hi hai: "meri baat pahunch chuki hai". `pending`
   * flag app ko ye batane deta hai ki "aapki request pehle se darj hai" — ek
   * duplicate confirmation email bhejne ki bhi zaroorat nahi.
   */
  if (await alreadyPending(email)) {
    return NextResponse.json({ ok: true, pending: true });
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/account_delete_requests`, {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify([
        {
          user_id: await findUserId(email),
          name,
          email,
          reason: reason || null,
          status: "pending",
        },
      ]),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
  } catch (err) {
    // ⚠️ Yahan chup rehna galat hai. Request ka kho jaana Play Store ki shart
    // ka seedha ullanghan hai — user ko pata hona chahiye ki dobara bhejna hai.
    console.error("[delete-request] save failed:", err);
    return NextResponse.json({ error: "could not save request" }, { status: 500 });
  }

  // Email na jaye to bhi request save ho chuki hai — usse rokna nahi chahiye.
  try {
    await sendAccountDeletionEmails(name, email, reason, locale);
  } catch (err) {
    console.error("[delete-request] email failed:", err);
  }

  return NextResponse.json({ ok: true });
}
