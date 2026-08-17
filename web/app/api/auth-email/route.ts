import crypto from "crypto";
import { NextResponse } from "next/server";

import { emailConfigured, sendAuthEmail, type AuthEmailKind } from "@/lib/email";
import { asLocale, localeForUserOrNull } from "@/lib/user-locale";
import { logServerError } from "@/lib/errors-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Supabase ka **Send Email Hook** — auth ke saare email yahan se jaate hain.
 *
 * ── Ye kyun bana ────────────────────────────────────────────────────────
 *
 * ⚠️ Supabase ke Authentication > Emails wale template poore project ke liye EK
 * hote hain. Wahan `{{ .Token }}` aur `{{ .ConfirmationURL }}` to milte hain,
 * par ye jaanne ka koi zariya nahi ki jise mail ja rahi hai usne app me Hindi
 * chuni thi ya English. Isliye reminder, document, welcome, ticket — sab user
 * ki bhasha me jaate the, aur theek wo do email jo sabse pehle aate hain
 * (account banate waqt aur password bhool jaane par) hamesha ek hi bhasha me.
 *
 * Hook chalu hote hi GoTrue khud mail bhejna BAND kar deta hai aur har auth
 * email ke liye yahan POST karta hai. Bhasha `profiles.language` se uthti hai
 * aur mail hamare usi SMTP se jaata hai jisse baaki sab — wahi logo, wahi
 * footer, wahi shakl.
 *
 * ── Chalu kaise karna hai ───────────────────────────────────────────────
 *
 * Poora step-by-step `docs/auth-emails.md` me hai. Chhota roop:
 *   1. Wahan jo secret milta hai use `SEND_EMAIL_HOOK_SECRET` me daalo + deploy.
 *   2. Supabase > Authentication > Auth Hooks > "Send Email hook" > HTTPS
 *      URL: https://apkasaathi.com/api/auth-email
 *
 * ⚠️ Ye endpoint FAIL hone par 4xx/5xx lautata hai, 200 nahi — aur us soorat me
 * user ka sign-up / password-reset bhi fail ho jaata hai. Ye jaan-boojh ke hai.
 * 200 keh dene ka matlab hota "email chala gaya", jabki gaya kuch nahi hota:
 * user "inbox dekho" wali screen par baith kar us mail ka intezaar karta rehta
 * jo kabhi aane wali hi nahi thi. Saaf error kam se kam dobara koshish karwa
 * deta hai.
 */

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const HOOK_SECRET = process.env.SEND_EMAIL_HOOK_SECRET;

/**
 * Code/link kitni der chalte hain — sirf email me likhne ke liye.
 *
 * ⚠️ Asli umar Supabase tay karta hai (Authentication > Sign In / Providers >
 * Email > Email OTP Expiration, default 3600s). Yahan wahi ginti minute me likh
 * do. Ye badalne se code jaldi nahi marta — sirf email ka jhooth band hota hai.
 */
const OTP_MINUTES = Number(process.env.AUTH_EMAIL_OTP_MINUTES ?? 60);

/** GoTrue ke `email_action_type` ko hamare template ke naam par le aao. */
function kindOf(action: string): AuthEmailKind | null {
  switch (action) {
    case "recovery":
      return "recovery";
    case "signup":
      return "signup";
    case "magiclink":
      return "magiclink";
    case "invite":
      return "invite";
    case "email_change":
    case "email_change_current":
    case "email_change_new":
      return "email_change";
    case "reauthentication":
      return "reauthentication";
    default:
      return null;
  }
}

/**
 * Standard Webhooks ka dastakhat — "ye POST sach me Supabase ka hai".
 *
 * ⚠️ Bina iske ye URL duniya ke liye khula ek mail-gun hota: koi bhi kisi bhi
 * pate par hamare naam se "apna password reset karo" wala email bhijwa sakta
 * tha, hamare hi logo aur domain ke saath. Isliye secret na ho to endpoint
 * chalta hi nahi (neeche 503), warna use band samajhne ke bajaye log bhool
 * jaate hain ki wo kabhi laga hi nahi tha.
 *
 * Ganit wahi hai jo standardwebhooks package karta hai — sirf itna sa hai ki
 * uske liye ek aur dependency laane ka koi matlab nahi:
 *   signed = "<webhook-id>.<webhook-timestamp>.<raw body>"
 *   sig    = base64( HMAC-SHA256( base64decode(secret), signed ) )
 */
function signatureOk(headers: Headers, raw: string, secret: string): boolean {
  const id = headers.get("webhook-id");
  const ts = headers.get("webhook-timestamp");
  const sigHeader = headers.get("webhook-signature");
  if (!id || !ts || !sigHeader) return false;

  // Purana (ya bhavishya ka) dastakhat mat maano — warna ek baar leak hua POST
  // hamesha ke liye dobara bheja ja sakta hai (replay).
  const skew = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(skew) || skew > 5 * 60) return false;

  // Dashboard `v1,whsec_…` deta hai; env me kabhi sirf `whsec_…` bhi pad jaata
  // hai. Dono chal jaane chahiye — warna copy-paste ki ek chhoti si galti par
  // saare auth email chup-chaap band ho jaate hain.
  const key = Buffer.from(secret.replace(/^v1,/, "").replace(/^whsec_/, ""), "base64");
  const expected = crypto
    .createHmac("sha256", key)
    .update(`${id}.${ts}.${raw}`)
    .digest("base64");

  // Header me space se alag kai dastakhat ho sakte hain (secret rotate karte
  // waqt) — kisi ek se mil jaye to kaafi hai.
  return sigHeader.split(" ").some((part) => {
    const got = part.startsWith("v1,") ? part.slice(3) : part;
    const a = Buffer.from(got);
    const b = Buffer.from(expected);
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  });
}

/** Supabase hook isi shakl me error padhta hai. */
function hookError(status: number, message: string) {
  return NextResponse.json(
    { error: { http_code: status, message } },
    { status },
  );
}

type HookPayload = {
  user?: {
    id?: string;
    email?: string;
    new_email?: string | null;
    user_metadata?: { full_name?: string; name?: string; language?: string } | null;
  };
  email_data?: {
    token?: string;
    token_hash?: string;
    token_new?: string;
    token_hash_new?: string;
    redirect_to?: string;
    email_action_type?: string;
    site_url?: string;
  };
};

export async function POST(request: Request) {
  if (!HOOK_SECRET) {
    return hookError(503, "SEND_EMAIL_HOOK_SECRET not set");
  }

  // ⚠️ Body ko RAW padhna zaroori hai. `request.json()` ke baad body dobara
  // nahi milta, aur dastakhat un hi bytes par bana hai jo aaye the —
  // JSON.stringify se banaya hua text bilkul waisa nahi hota (spacing, keys ka
  // kram, unicode escaping), yaani har POST galat nikalta.
  const raw = await request.text();
  if (!signatureOk(request.headers, raw, HOOK_SECRET)) {
    return hookError(401, "bad signature");
  }

  // ⚠️ Baaki config ki jaanch dastakhat ke BAAD. Pehle karne par ye URL kisi
  // bhi anjaan se hamare setup ki baat kar leta hai — "SMTP not configured"
  // jaisa jawab bina kisi chaabi ke mil jaata.
  if (!SUPABASE_URL) {
    return hookError(503, "SUPABASE_URL not set");
  }
  if (!emailConfigured()) {
    // SMTP env na ho to `sendMail` chup-chaap skip kar deta hai. Yahan wo skip
    // sabse bura roop le leta: Supabase maan leta ki mail chali gayi, aur user
    // ek na-bheji hui mail ka intezaar karta rehta.
    return hookError(503, "SMTP not configured");
  }

  let payload: HookPayload;
  try {
    payload = JSON.parse(raw) as HookPayload;
  } catch {
    return hookError(400, "invalid body");
  }

  const user = payload.user ?? {};
  const data = payload.email_data ?? {};
  const action = String(data.email_action_type ?? "");
  const kind = kindOf(action);
  if (!kind) return hookError(400, `unknown email_action_type: ${action || "(none)"}`);

  /**
   * Email badalne wale do mail ka rukh ulta hota hai.
   *
   * `email_change_current` PURANE pate par jaata hai (purane token ke saath),
   * `email_change_new` NAYE par — aur uska code `token_new` me hota hai,
   * `token` me nahi. "Secure email change" band ho to GoTrue sirf ek
   * `email_change` bhejta hai, wo bhi naye pate par. Galat token bhej dene par
   * user ke saamne ek aisa code aata hai jo kabhi kaam nahi karta.
   */
  const toNewAddress = action === "email_change" || action === "email_change_new";
  const to = (toNewAddress ? user.new_email || user.email : user.email) ?? "";
  if (!to) return hookError(400, "no recipient email");

  const code = (toNewAddress ? data.token_new || data.token : data.token) ?? "";
  const hash = (toNewAddress ? data.token_hash_new || data.token_hash : data.token_hash) ?? "";

  /**
   * Wahi link jo Supabase ka `{{ .ConfirmationURL }}` banata hai.
   *
   * `email_change_current` / `_new` sirf hook ke naam hain — verify endpoint
   * dono ke liye `type=email_change` hi jaanta hai.
   */
  const verifyType = kind === "email_change" ? "email_change" : action;
  const redirect = data.redirect_to || data.site_url || "";
  const link =
    kind === "reauthentication" || !hash
      ? ""
      : `${SUPABASE_URL}/auth/v1/verify?token=${encodeURIComponent(hash)}` +
        `&type=${encodeURIComponent(verifyType)}` +
        (redirect ? `&redirect_to=${encodeURIComponent(redirect)}` : "");

  /**
   * Bhasha: pehle `profiles.language` (app ka switcher wahin likhta hai).
   *
   * ⚠️ Sign-up par wo row abhi bani hi nahi hoti — us ek email ke liye bhasha
   * sirf `user_metadata.language` me hoti hai, jo app `signUpEmail()` ke saath
   * bhejti hai. Isliye yahan `…OrNull` chahiye: "row nahi mili" aur "user ne
   * Hinglish chuni" do alag baatein hain.
   */
  const locale =
    (await localeForUserOrNull(user.id)) ?? asLocale(user.user_metadata?.language);

  const name = user.user_metadata?.full_name || user.user_metadata?.name || "";

  try {
    await sendAuthEmail({
      to,
      kind,
      name,
      code,
      link,
      minutes: OTP_MINUTES,
      locale,
      userId: user.id ?? null,
    });
  } catch (err) {
    // Log karo, par user ko SMTP ki andar ki baat mat dikhao.
    await logServerError(err, { route: "auth-email", kind, action }).catch(() => {});
    return hookError(500, "could not send email");
  }

  return NextResponse.json({ ok: true });
}
