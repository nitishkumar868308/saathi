import { NextResponse } from "next/server";
import { sendAccountDeletionEmails } from "@/lib/email";
import { asLocale } from "@/lib/user-locale";
import { hit, requestKey } from "@/lib/rate-limit";
import { appUser } from "@/lib/app-auth";

export const runtime = "nodejs";
// Rate-limit ki ginti memory me rehti hai — cache/prerender ho gaya to wo
// kabhi chalti hi nahi.
export const dynamic = "force-dynamic";

/**
 * Ek ghante me ek jagah se itni hi delete request.
 *
 * Yahan hadd contact se thodi kadi hai (3): ye form asli zindagi me ek hi baar
 * bhara jaata hai, aur har request ek email bhejti hai us pate par jo FORM me
 * likha ho — yaani bina rok ke ye bhi ek mail-bomb ka auzaar tha. `alreadyPending`
 * sirf UNHI par lagta hai jo pehle se darj hain; naye pate har baar nayi row
 * banate hain.
 */
const MAX_PER_HOUR = 3;
const WINDOW_MS = 60 * 60_000;

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
 * Request bhejne wala sach me is email ka maalik hai? Hai to uska user id.
 *
 * ⚠️ Pehle yahan form ke EMAIL se hi profile dhoondh ke `user_id` jod diya
 * jaata tha. Form bina login ke khula hai — yaani koi bhi kisi ka email daal ke
 * uske account ki request bana deta, aur admin panel me wo bilkul asli jaisi
 * dikhti (account juda hua, data ginti ke saath). Ek galat purge aur kisi ka
 * poora data gaya.
 *
 * Ab `user_id` sirf tab judta hai jab request ke saath Supabase ka access token
 * aaye (`Authorization: Bearer …`) AUR us token wale user ka email wahi ho jo
 * form me hai. Bina token ke request phir bhi darj hoti hai (Play Store yahi
 * maangta hai) — bas `user_id` khaali rehta hai, aur admin panel use "email
 * verified nahi hai" dikha ke alag pushti maangta hai.
 */
async function verifiedUserId(request: Request, email: string): Promise<string | null> {
  const user = await appUser(request);
  if (!user?.email) return null;
  return user.email.trim().toLowerCase() === email.trim().toLowerCase() ? user.id : null;
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
  const gate = hit("delete-request", requestKey(request), MAX_PER_HOUR, WINDOW_MS);
  if (!gate.allowed) {
    return NextResponse.json(
      { error: "bahut zyada request — thodi der baad try karo" },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

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
  const userId = await verifiedUserId(request, email);

  if (await alreadyPending(email)) {
    /**
     * ⚠️ Pehle se pending row kisi aur ne (bina login) bhi banayi ho sakti hai.
     * Asli maalik token ke saath aaye to use wahi row par jod do — warna uski
     * verified request "pending" keh ke hamesha unverified hi padi rehti.
     */
    if (userId) {
      try {
        await fetch(
          `${SUPABASE_URL}/rest/v1/account_delete_requests` +
            `?email=eq.${encodeURIComponent(email)}&status=eq.pending&user_id=is.null`,
          {
            method: "PATCH",
            headers: headers({ Prefer: "return=minimal" }),
            body: JSON.stringify({ user_id: userId }),
            cache: "no-store",
          },
        );
      } catch {
        /* request darj hai — judna na ho paaye to admin email se pushti kar lega */
      }
    }
    return NextResponse.json({ ok: true, pending: true });
  }

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/account_delete_requests`, {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify([
        {
          // Sirf verified maalik — upar `verifiedUserId` dekho.
          user_id: userId,
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
