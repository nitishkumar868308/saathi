import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

/**
 * Simple admin auth for /admin dashboard.
 *
 * .env.local:  ADMIN_PASSWORD=your-secret
 *
 * Login pe ek httpOnly cookie set hoti hai jiska value = sha256(password).
 * Protected routes cookie ko expected token se compare karte hain.
 */

export const ADMIN_COOKIE = "saathi_admin";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";

export function expectedToken(): string {
  // Password + fixed salt ka hash. Password galat/khaali ho to bhi
  // token deterministic rahe.
  return createHash("sha256")
    .update(`saathi::${ADMIN_PASSWORD}`)
    .digest("hex");
}

/**
 * Do secret barabar hain ya nahi — bina ye bataye ki KAHAN tak barabar the.
 *
 * ⚠️ Saada `===` pehla alag akshar milte hi ruk jaata hai, isliye uske lagne
 * wale waqt se hi thoda-thoda pata chal jaata hai ki kitne shuruaati akshar
 * sahi the. Dono ko pehle hash kar ke (hamesha 32 bytes) `timingSafeEqual` se
 * milate hain — ab har tulna barabar waqt leti hai, chahe input kuch bhi ho.
 *
 * Ye apne aap me sabse badi rok nahi hai (wo rate-limit hai), par jab paasword
 * ek hi ho aur wo sab kuch kholta ho, tab ye muft ki suraksha chhodne wali baat
 * nahi hai.
 */
function secretEquals(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function passwordMatches(input: string): boolean {
  return Boolean(ADMIN_PASSWORD) && secretEquals(input, ADMIN_PASSWORD);
}

/** Server-side: kya current request authenticated hai? */
export function isAuthed(): boolean {
  if (!ADMIN_PASSWORD) return false;
  const token = cookies().get(ADMIN_COOKIE)?.value;
  return Boolean(token) && secretEquals(token as string, expectedToken());
}
