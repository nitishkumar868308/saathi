import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCb) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

/**
 * Admin ke password ka hash.
 *
 * scrypt jaan-boojh ke DHEEMA hai. Password hash ka poora kaam yahi hai: agar
 * kabhi `admin_users` ki table haath lag jaye, to har ek password ko aazmane me
 * itna waqt lage ki list aazmana bekaar ho jaye. Isliye yahan SHA-256 nahi
 * chalega — wo lakhon guesses per second de deta hai.
 *
 * Format (sab kuch ek hi string me, taaki parameter baad me badle ja saken):
 *
 *     scrypt$16384$8$1$<salt-base64>$<hash-base64>
 *
 * ⚠️ Purane hash tab bhi verify hote rahenge jab N/r/p badlenge — kyunki wo
 * hash ke andar hi likhe hain, code me nahi.
 */

const N = 16384; // 2^14 — ~50-100ms per hash, login ke liye theek
const R = 8;
const P = 1;
const KEYLEN = 32;
const SALT_BYTES = 16;
// scrypt ko N*r*128 se zyada memory chahiye; default 32MB kam pad jaata hai.
const MAXMEM = 64 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES);
  const hash = await scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: MAXMEM });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

/**
 * Password sahi hai ya nahi.
 *
 * Tulna `timingSafeEqual` se hoti hai — `===` pehla alag byte milte hi ruk
 * jaata hai, aur us rukne ke waqt se hi thoda-thoda pata chalta rehta hai.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split("$");
    if (parts.length !== 6 || parts[0] !== "scrypt") return false;

    const n = Number(parts[1]);
    const r = Number(parts[2]);
    const p = Number(parts[3]);
    if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) return false;
    // Kisi ne DB me N badal diya to wo ek request ko hamesha ke liye latka
    // sakta hai — chhat laga do.
    if (n > 1 << 20 || r > 32 || p > 16) return false;

    const salt = Buffer.from(parts[4], "base64");
    const expected = Buffer.from(parts[5], "base64");
    if (!salt.length || !expected.length) return false;

    const got = await scrypt(password, salt, expected.length, {
      N: n,
      r,
      p,
      maxmem: Math.max(MAXMEM, n * r * 256),
    });
    return got.length === expected.length && timingSafeEqual(got, expected);
  } catch {
    return false;
  }
}

/**
 * Naye member ko bheja jaane wala password.
 *
 * Padhne-likhne me aasaan rakha hai (koi `l`/`1`/`O`/`0` nahi) — ye email me
 * jaata hai aur log ise haath se type karte hain. Lambai (14) usi ki bharpayi
 * karti hai: ~72 bits, jo kisi ke aazmane ke liye kaafi se zyada hai.
 */
export function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = randomBytes(14);
  let out = "";
  // ⚠️ `% chars.length` thoda jhukav paida karta hai (256 chars ka gunak nahi
  // hai). Yahan wo maayne nahi rakhta — password ek baar ka hai aur user use
  // badal sakta hai — par ginti ke liye: jhukav ~0.4% se kam hai.
  for (let i = 0; i < bytes.length; i++) out += chars[bytes[i] % chars.length];
  return out;
}
