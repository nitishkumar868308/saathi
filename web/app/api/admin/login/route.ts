import { NextResponse } from "next/server";
import { ADMIN_COOKIE, expectedToken, passwordMatches } from "@/lib/admin";
import {
  clientKey,
  loginAllowed,
  recordFailure,
  recordSuccess,
} from "@/lib/admin-rate-limit";
import { logServerError } from "@/lib/errors-server";

export const runtime = "nodejs";
// Rate-limit ki ginti memory me rehti hai — is route ko cache/prerender nahi
// hona chahiye, warna wo ginti kabhi chalti hi nahi.
export const dynamic = "force-dynamic";

/**
 * Admin login.
 *
 * ⚠️ Yahan pehle brute-force ki koi rok nahi thi — ek password, aur jitni marzi
 * koshish. Ab 15 minute me 5 galat koshish ke baad wo jagah 15 minute ke liye
 * band. Poori baat aur uski seemayein `lib/admin-rate-limit.ts` me likhi hain.
 */
export async function POST(request: Request) {
  const key = clientKey(request);

  const gate = loginAllowed(key);
  if (!gate.allowed) {
    // Password sahi ho tab bhi yahin ruk jaana chahiye — warna rok ka koi
    // matlab hi nahi bachta.
    return NextResponse.json(
      { error: "bahut zyada koshish — thodi der baad try karo" },
      { status: 429, headers: { "Retry-After": String(gate.retryAfter) } },
    );
  }

  let password = "";
  try {
    const body = await request.json();
    password = String(body?.password ?? "");
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  if (!passwordMatches(password)) {
    recordFailure(key);
    // Galat koshish admin > Logs me dikhni chahiye — koi sach me try kar raha
    // ho to uska pehla nishaan yahi hota hai.
    void logServerError(new Error("admin login failed"), { where: "admin/login", key });
    return NextResponse.json({ error: "galat password" }, { status: 401 });
  }

  recordSuccess(key);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, expectedToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 ghante
  });
  return res;
}
