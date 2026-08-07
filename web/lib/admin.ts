import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

import { ADMIN_MENUS, type AdminMenu } from "@/lib/admin-menus";
import { findMemberById, findMemberForLogin, teamDbConfigured, touchLogin } from "@/lib/admin-team";
import { verifyPassword } from "@/lib/admin-password";

/**
 * /admin ka auth.
 *
 * Do tarah ke log andar aa sakte hain:
 *
 *   1. MASTER — `.env` ka `ADMIN_PASSWORD`. Email khaali chhod do (ya
 *      `ADMIN_EMAIL` daalo). Isko hamesha SAARE menu milte hain aur ise koi
 *      band nahi kar sakta.
 *
 *      ⚠️ Ye jaan-boojh ke bacha ke rakha gaya hai. Sab kuch DB par daal dena
 *      seedha lagta hai, par phir ek galti — aakhri active admin disable ho
 *      jaye, ya admin_users me kuch tooth jaye — matlab apne hi panel se bahar,
 *      hamesha ke liye. Master wo pichhla darwaza hai.
 *
 *   2. TEAM member — `admin_users` me apna email + apna password. Menu uske
 *      role se aate hain (aur uske apne extra/denied se). `pending` ya
 *      `disabled` ho to login chalta hi nahi.
 *
 * Cookie me kya hai: `<base64url(json)>.<hmac>` — json me sirf id aur expiry.
 * Menu cookie me NAHI hain; wo har request par DB se aate hain, warna kisi ka
 * menu chheenne ke baad bhi uski purani cookie 12 ghante tak chalti rehti.
 */

export const ADMIN_COOKIE = "saathi_admin";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "";
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();

const SESSION_HOURS = 12;

export type AdminSession = {
  /** "master" ya `admin_users.id`. */
  id: string;
  email: string;
  name: string;
  isMaster: boolean;
  menus: AdminMenu[];
};

/* --------------------------------- token ---------------------------------- */

/**
 * Token sign karne ka secret.
 *
 * ADMIN_PASSWORD par tika hai — matlab password badalte hi purane saare
 * session apne aap mar jaate hain. Ye ek fayda hai, kami nahi: password isliye
 * badla jaata hai ki kisi ko bahar karna ho.
 */
function secret(): string {
  return `saathi-admin-session::${ADMIN_PASSWORD}`;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/**
 * Do secret barabar hain ya nahi — bina ye bataye ki KAHAN tak barabar the.
 *
 * ⚠️ Saada `===` pehla alag akshar milte hi ruk jaata hai, isliye uske lagne
 * wale waqt se hi thoda-thoda pata chal jaata hai ki kitne shuruaati akshar
 * sahi the.
 */
function safeEquals(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

export function makeToken(id: string): string {
  const payload = b64url(
    JSON.stringify({ id, exp: Date.now() + SESSION_HOURS * 3600 * 1000 }),
  );
  return `${payload}.${sign(payload)}`;
}

function readToken(token: string): { id: string } | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const payload = token.slice(0, dot);
  if (!safeEquals(token.slice(dot + 1), sign(payload))) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      id?: string;
      exp?: number;
    };
    if (!data.id || typeof data.exp !== "number" || Date.now() > data.exp) return null;
    return { id: data.id };
  } catch {
    return null;
  }
}

export const COOKIE_MAX_AGE = SESSION_HOURS * 3600;

/* -------------------------------- session --------------------------------- */

function masterSession(): AdminSession {
  return {
    id: "master",
    email: ADMIN_EMAIL || "master",
    name: "Master",
    isMaster: true,
    menus: [...ADMIN_MENUS],
  };
}

/**
 * Abhi kaun logged in hai. Koi nahi to `null`.
 *
 * Team member ka data HAR baar DB se aata hai — isliye role badalne ya use
 * disable karne ka asar agli hi request par lag jaata hai, agle login par
 * nahi.
 */
export async function adminSession(): Promise<AdminSession | null> {
  if (!ADMIN_PASSWORD) return null; // secret hi nahi to koi token bharosemand nahi

  const token = cookies().get(ADMIN_COOKIE)?.value;
  if (!token) return null;

  const data = readToken(token);
  if (!data) return null;

  if (data.id === "master") return masterSession();

  if (!teamDbConfigured()) return null;
  try {
    const member = await findMemberById(data.id);
    // Beech me disable/pending kar diya gaya ho to cookie bekaar ho jaye.
    if (!member || member.status !== "active") return null;
    return {
      id: member.id,
      email: member.email,
      name: member.name || member.email,
      isMaster: false,
      menus: member.menus,
    };
  } catch {
    return null;
  }
}

/** Kya ye session ye menu khol sakta hai? Master ke liye hamesha haan. */
export function canSee(session: AdminSession, menu: AdminMenu): boolean {
  return session.isMaster || session.menus.includes(menu);
}

/* --------------------------------- login ---------------------------------- */

export type LoginResult =
  | { ok: true; token: string; session: AdminSession }
  | { ok: false; reason: "wrong" | "pending" | "disabled" | "off" };

/**
 * Email + password se login.
 *
 * Email khaali (ya ADMIN_EMAIL) + ADMIN_PASSWORD = master.
 * Baaki sab `admin_users` se.
 */
export async function adminLogin(email: string, password: string): Promise<LoginResult> {
  if (!ADMIN_PASSWORD) return { ok: false, reason: "off" };

  const clean = email.trim().toLowerCase();

  // --- master ---
  if (!clean || (ADMIN_EMAIL && clean === ADMIN_EMAIL)) {
    if (safeEquals(password, ADMIN_PASSWORD)) {
      const session = masterSession();
      return { ok: true, token: makeToken("master"), session };
    }
    // Email khaali tha aur password galat — aage dekhne ko kuch nahi.
    if (!clean) return { ok: false, reason: "wrong" };
  }

  // --- team member ---
  if (!teamDbConfigured()) return { ok: false, reason: "wrong" };

  let member: Awaited<ReturnType<typeof findMemberForLogin>> = null;
  try {
    member = await findMemberForLogin(clean);
  } catch {
    return { ok: false, reason: "wrong" };
  }
  if (!member) return { ok: false, reason: "wrong" };

  // ⚠️ Password PEHLE jaancho, status baad me. Ulta karne par ye page kisi bhi
  // anjaan aadmi ko bata deta hai ki "ye email admin hai, bas abhi pending
  // hai" — bina password ke.
  if (!(await verifyPassword(password, member.passwordHash))) {
    return { ok: false, reason: "wrong" };
  }
  if (member.status === "pending") return { ok: false, reason: "pending" };
  if (member.status !== "active") return { ok: false, reason: "disabled" };

  void touchLogin(member.id);

  return {
    ok: true,
    token: makeToken(member.id),
    session: {
      id: member.id,
      email: member.email,
      name: member.name || member.email,
      isMaster: false,
      menus: member.menus,
    },
  };
}

/** Kya admin panel chalu bhi hai (ADMIN_PASSWORD set hai)? */
export function adminConfigured(): boolean {
  return Boolean(ADMIN_PASSWORD);
}
