/**
 * Google service account se access token — bina kisi library ke.
 *
 * ── Kyun apna likha ────────────────────────────────────────────────────────
 * Sirf ek API call ke liye `googleapis` (~50 MB, poore Google ka har API) laane
 * ka koi tuk nahi tha. Google ka OAuth "2-legged" flow poora teen qadam ka hai:
 * ek JWT banao, apni private key se sign karo, aur use token ke badle bech do.
 * Node ke apne `crypto` me ye 40 line ka kaam hai.
 *
 * ── Key kahan se ───────────────────────────────────────────────────────────
 * Google Cloud Console > IAM > Service Accounts > Keys > "Add key" > JSON.
 * Us poori JSON file ko env me daalna hai — do me se kisi bhi shakal me:
 *
 *   GOOGLE_PLAY_SA_JSON={"type":"service_account","client_email":…}
 *   GOOGLE_PLAY_SA_JSON=<usi JSON ka base64>
 *
 * Base64 wali shakal Vercel ke liye behtar hai: JSON ke andar newline hote hain
 * (`private_key` me), aur wo dashboard/CLI me aksar toot jaate hain. Dono chalti
 * hain, code khud pehchan leta hai.
 *
 * ⚠️ Ye key SIRF server ke env me. `NEXT_PUBLIC_` ke saath kabhi nahi, aur app
 *    ki .env me to bilkul nahi — iske paas aapke Play Console ka access hai.
 */
import { createSign } from "node:crypto";

const TOKEN_URL = "https://oauth2.googleapis.com/token";

/** Play Developer API ka scope. Read aur write dono isi ek me aate hain. */
export const ANDROID_PUBLISHER_SCOPE =
  "https://www.googleapis.com/auth/androidpublisher";

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

export class GoogleAuthNotConfigured extends Error {
  constructor(why: string) {
    super(`Google service account nahi mila: ${why}`);
    this.name = "GoogleAuthNotConfigured";
  }
}

/**
 * Env se service account nikalo — raw JSON ya base64, dono chalega.
 *
 * `private_key` me newline `\n` ke roop me likhe hote hain jab JSON ek line me
 * env variable ban jaata hai. Bina wapas asli newline banaye `createSign` PEM
 * ko padh hi nahi paata (error bhi bahut bekaar aata hai: "error:1E08010C").
 */
function readServiceAccount(): ServiceAccount | null {
  const raw = process.env.GOOGLE_PLAY_SA_JSON?.trim();
  if (!raw) return null;

  let text = raw;
  if (!text.startsWith("{")) {
    try {
      text = Buffer.from(raw, "base64").toString("utf8");
    } catch {
      return null;
    }
  }

  try {
    const j = JSON.parse(text) as Partial<ServiceAccount>;
    if (!j.client_email || !j.private_key) return null;
    return {
      client_email: j.client_email,
      private_key: j.private_key.replace(/\\n/g, "\n"),
    };
  } catch {
    return null;
  }
}

export function googleAuthConfigured(): boolean {
  return readServiceAccount() !== null;
}

/** Chalu kyun nahi hai — admin panel me saaf dikhane ke liye. */
export function googleAuthStatus(): string {
  if (!process.env.GOOGLE_PLAY_SA_JSON?.trim()) return "GOOGLE_PLAY_SA_JSON set nahi hai";
  if (!readServiceAccount()) {
    return "GOOGLE_PLAY_SA_JSON padha nahi ja saka (JSON galat hai, ya client_email/private_key missing)";
  }
  return "on";
}

function base64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Token module me sambhal ke rakha jaata hai.
 *
 * Google ka token ek ghante chalta hai. Har request par naya maangna teen wajah
 * se bura hai: har call me ek extra round-trip, Google ki apni rate limit, aur
 * (sabse asli) sync job ke andar hum ek se zyada API call karte hain — sabke
 * liye alag token lena bilkul bekaar hai.
 *
 * 60 second pehle hi expire maan lete hain, taaki beech raaste me token na mare.
 */
let cached: { token: string; expiresAt: number } | null = null;

export async function getGoogleAccessToken(
  scope: string = ANDROID_PUBLISHER_SCOPE,
): Promise<string> {
  const now = Date.now();
  if (cached && cached.expiresAt > now + 60_000) return cached.token;

  const sa = readServiceAccount();
  if (!sa) throw new GoogleAuthNotConfigured(googleAuthStatus());

  const iat = Math.floor(now / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(
    JSON.stringify({
      iss: sa.client_email,
      scope,
      aud: TOKEN_URL,
      iat,
      exp: iat + 3600,
    }),
  );

  const signer = createSign("RSA-SHA256");
  signer.update(`${header}.${payload}`);
  let signature: string;
  try {
    signature = base64url(signer.sign(sa.private_key));
  } catch (err) {
    // PEM galat ho to Node ka message bilkul nakaam hota hai — usme ye jodo.
    throw new GoogleAuthNotConfigured(
      `private_key sign nahi ho payi (JSON ki private_key poori copy hui hai? newline sahi hain?) — ${String(err)}`,
    );
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${payload}.${signature}`,
    }),
    cache: "no-store",
  });

  const body = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !body.access_token) {
    // Google ki apni wajah aage bhejo. Yahan aksar `invalid_grant` aata hai,
    // jiska matlab lagbhag hamesha ek hi hota hai: service account delete ho
    // gaya, ya key revoke ho chuki hai.
    throw new Error(
      `Google token nahi mila (${res.status}): ${body.error_description ?? body.error ?? "unknown"}`,
    );
  }

  cached = {
    token: body.access_token,
    expiresAt: now + (body.expires_in ?? 3600) * 1000,
  };
  return cached.token;
}
