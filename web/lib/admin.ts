import { createHash } from "crypto";
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

export function passwordMatches(input: string): boolean {
  return Boolean(ADMIN_PASSWORD) && input === ADMIN_PASSWORD;
}

/** Server-side: kya current request authenticated hai? */
export function isAuthed(): boolean {
  if (!ADMIN_PASSWORD) return false;
  const token = cookies().get(ADMIN_COOKIE)?.value;
  return Boolean(token) && token === expectedToken();
}
