/**
 * Studio ka password gate.
 *
 * Pattern `web/lib/admin.ts` + `web/lib/admin-password.ts` se **copy** kiya gaya hai
 * (Standing rule 4: `web/` ko chhuna nahi, helper chahiye to copy karo). Do jaan-boojhkar
 * badlav hain:
 *
 *  1. **Node ka `crypto` nahi, Web Crypto.** Ye file middleware me bhi chalti hai aur
 *     Next ka middleware edge runtime par hai — wahan `node:crypto` hai hi nahi. Web
 *     Crypto dono jagah ek jaisa chalta hai, isliye gate ek hi jagah likha gaya hai.
 *  2. **scrypt nahi.** `web/` me hash isliye hai ki wo DB me pade admin_users ke liye
 *     hai — table leak hone par uska matlab banta hai. Yahan password sirf env me hai;
 *     jo env padh sakta hai wo hash bhi badal sakta hai. Isliye seedha constant-time
 *     compare — jhooti mazbooti dikhane se behtar hai saaf likh dena.
 *
 * Cookie me kya hai: `<base64url(json)>.<hmac>` — json me sirf expiry. Signing secret
 * password par tika hai, isliye password badalte hi purane saare session mar jaate hain.
 */

export const STUDIO_COOKIE = "reel_studio";

const SESSION_HOURS = 12;
export const COOKIE_MAX_AGE_SECONDS = SESSION_HOURS * 3600;

/** Env set nahi hai to studio khulta hi nahi — "password khaali chalega" sabse buri default hai. */
export function studioPassword(): string {
  return process.env.STUDIO_PASSWORD ?? "";
}

export function studioPasswordConfigured(): boolean {
  return studioPassword().length > 0;
}

function secret(): string {
  return `reel-studio-session::${studioPassword()}`;
}

const encoder = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(value: string): string {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
}

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return b64url(new Uint8Array(signature));
}

/**
 * Do string barabar hain ya nahi — bina ye bataye ki **kahan tak** barabar the.
 *
 * ⚠️ Saada `===` pehle alag byte par ruk jaata hai, aur us rukne ke waqt se hi
 * thoda-thoda pata chalta rehta hai ki kitne shuruaati akshar sahi the.
 */
export function safeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function makeToken(now = Date.now()): Promise<string> {
  const payload = b64url(
    encoder.encode(JSON.stringify({ exp: now + COOKIE_MAX_AGE_SECONDS * 1000 })),
  );
  return `${payload}.${await sign(payload)}`;
}

/** Cookie ka token valid hai? (signature + expiry dono.) */
export async function verifyToken(token: string | undefined | null): Promise<boolean> {
  if (!token || !studioPasswordConfigured()) return false;

  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;

  const payload = token.slice(0, dot);
  if (!safeEquals(token.slice(dot + 1), await sign(payload))) return false;

  try {
    const data = JSON.parse(b64urlDecode(payload)) as { exp?: number };
    return typeof data.exp === "number" && Date.now() < data.exp;
  } catch {
    return false;
  }
}

export function passwordMatches(input: string): boolean {
  const expected = studioPassword();
  return expected.length > 0 && safeEquals(input, expected);
}
