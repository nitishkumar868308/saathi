import { logServiceUsage } from "@/lib/usage-server";

/**
 * Phone number ka SMS OTP — Twilio Verify se.
 *
 * Kyun Verify, khud ka OTP nahi: OTP khud banane ka matlab hai use kahin store
 * karna, uski expiry sambhalna, galat koshishein ginna, aur brute-force rokna —
 * chaaron me se ek bhi galti poore verification ko bekaar kar deti hai. Verify
 * ye chaaron apne paas rakhta hai. Hum na OTP banate hain, na dekhte hain, na
 * kabhi save karte hain — sirf "bhejo" aur "ye code sahi hai kya" poochte hain.
 *
 * .env.local:
 *   TWILIO_ACCOUNT_SID=AC...
 *   TWILIO_AUTH_TOKEN=...
 *   TWILIO_VERIFY_SERVICE_SID=VA...
 */

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const SERVICE = process.env.TWILIO_VERIFY_SERVICE_SID;

export function verifyConfigured(): boolean {
  return Boolean(SID && TOKEN && SERVICE);
}

function auth(): string {
  return `Basic ${Buffer.from(`${SID}:${TOKEN}`).toString("base64")}`;
}

async function call(path: string, form: URLSearchParams) {
  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${SERVICE}/${path}`,
    {
      method: "POST",
      headers: {
        Authorization: auth(),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      cache: "no-store",
    },
  );
  const body = (await res.json().catch(() => ({}))) as {
    status?: string;
    code?: number;
    message?: string;
  };
  return { ok: res.ok, http: res.status, body };
}

export type SendResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "bad_number" | "rate_limited" | "failed" };

/**
 * Is number par OTP bhejo. `phone` = E.164 (jaise +919876543210).
 *
 * Twilio ke error codes jaan-boojh ke alag-alag samjhe jaate hain: user ko
 * "number galat hai" aur "abhi bahut baar koshish ho chuki" me farak dikhna
 * chahiye. Dono ko ek jaisa "nahi bheja ja saka" batana wahi bekaar message hai
 * jiske baad user wahi galat number dobara-dobara daalta rehta hai.
 */
export async function sendOtp(phone: string, userId?: string | null): Promise<SendResult> {
  if (!verifyConfigured()) return { ok: false, reason: "not_configured" };

  const { ok, body } = await call(
    "Verifications",
    new URLSearchParams({ To: phone, Channel: "sms" }),
  );

  if (ok && body.status === "pending") {
    logServiceUsage("twilio", "otp_send", { userId });
    return { ok: true };
  }

  logServiceUsage("twilio", "otp_send", {
    ok: false,
    userId,
    meta: { code: body.code, status: body.status },
  });

  // 60200 = "To" ki shakal hi galat hai, 60033 = Twilio us number tak nahi ja
  // sakta (landline, band number, ya jis desh me service nahi hai).
  if (body.code === 60200 || body.code === 60033) return { ok: false, reason: "bad_number" };
  // 60203 = ek hi number par bahut saari koshishein, 429 = account ka rate limit.
  if (body.code === 60203 || body.code === 20429) return { ok: false, reason: "rate_limited" };
  return { ok: false, reason: "failed" };
}

export type CheckResult =
  | { ok: true }
  | { ok: false; reason: "not_configured" | "wrong_code" | "expired" | "failed" };

/**
 * User ne jo 6 digit daale, wo sahi hain kya.
 *
 * ⚠️ `expired` ko `wrong_code` se alag rakhna zaroori hai. Verify ka code 10
 * minute me marr jaata hai, aur uske baad Twilio 404 deta hai — jo bilkul waisa
 * hi dikhta hai jaise galat code. User apna bilkul SAHI code teen baar daal ke
 * "galat code" padhta rehta tha, jabki karna sirf "dobara bhejo" tha.
 */
export async function checkOtp(
  phone: string,
  code: string,
  userId?: string | null,
): Promise<CheckResult> {
  if (!verifyConfigured()) return { ok: false, reason: "not_configured" };

  const { ok, http, body } = await call(
    "VerificationCheck",
    new URLSearchParams({ To: phone, Code: code }),
  );

  if (ok && body.status === "approved") {
    logServiceUsage("twilio", "otp_check", { userId });
    return { ok: true };
  }

  logServiceUsage("twilio", "otp_check", {
    ok: false,
    userId,
    meta: { code: body.code, status: body.status, http },
  });

  // 404 / 20404 = is number ka koi zinda verification hai hi nahi — yaani wo
  // expire ho chuka (ya pehle hi approve ho chuka hai).
  if (http === 404 || body.code === 20404) return { ok: false, reason: "expired" };
  if (body.status === "pending" || body.status === "canceled") {
    return { ok: false, reason: "wrong_code" };
  }
  return { ok: false, reason: "failed" };
}
