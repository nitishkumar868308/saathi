import { cookies } from "next/headers";
import { z } from "zod";

import { fail, handle, ok, readBody } from "@/lib/api";
import {
  COOKIE_MAX_AGE_SECONDS,
  makeToken,
  passwordMatches,
  STUDIO_COOKIE,
  studioPasswordConfigured,
} from "@/lib/auth";

/**
 * `POST /api/auth/login` — ekmatra route jo bina login ke khulta hai.
 *
 * Chhota sa brute-force gate bhi hai. Ye localhost app hai, par gate ki keemat
 * 15 line hai aur uske bina "password kya hai" aazmana muft ho jaata hai.
 * Ginti process ki memory me hai — restart par saaf. Wahi kaafi hai; iske liye
 * DB me table banana is phase me bekaar ka bojh hota.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 60_000;

let failedAttempts = 0;
let lockedUntil = 0;

const LoginSchema = z.object({ password: z.string().min(1, "password chahiye") });

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    if (!studioPasswordConfigured()) {
      return fail(
        "studio band hai",
        503,
        "STUDIO_PASSWORD env set nahi hai (studio/.env.local dekho)",
      );
    }

    const now = Date.now();
    if (now < lockedUntil) {
      return fail(
        "too many attempts",
        429,
        `${Math.ceil((lockedUntil - now) / 1000)} second baad dobara koshish karo`,
      );
    }

    const body = await readBody(request, LoginSchema);
    if (!body.ok) return body.response;

    if (!passwordMatches(body.data.password)) {
      failedAttempts += 1;
      if (failedAttempts >= MAX_ATTEMPTS) {
        lockedUntil = now + LOCKOUT_MS;
        failedAttempts = 0;
      }
      return fail("galat password", 401);
    }

    failedAttempts = 0;
    cookies().set(STUDIO_COOKIE, await makeToken(), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
      // Studio http://localhost par chalta hai — `secure` lagate hi cookie set
      // hi nahi hoti aur login hamesha "fail" dikhta.
      secure: process.env.NODE_ENV === "production",
    });
    return ok({ ok: true });
  });
}
