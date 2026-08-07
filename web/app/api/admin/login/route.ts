import { NextResponse } from "next/server";
import { ADMIN_COOKIE, adminLogin, COOKIE_MAX_AGE } from "@/lib/admin";
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
 * Admin login (email + password).
 *
 * Email khaali chhodo to master (`.env` ka ADMIN_PASSWORD). Baaki sab team ke
 * member hain — dekho lib/admin.ts.
 *
 * ⚠️ Yahan pehle brute-force ki koi rok nahi thi. Ab 15 minute me 5 galat
 * koshish ke baad wo jagah 15 minute ke liye band. Poori baat aur uski seemayein
 * `lib/admin-rate-limit.ts` me likhi hain.
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

  let email = "";
  let password = "";
  try {
    const body = await request.json();
    email = String(body?.email ?? "");
    password = String(body?.password ?? "");
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const result = await adminLogin(email, password);

  if (!result.ok) {
    recordFailure(key);
    // Galat koshish admin > Logs me dikhni chahiye — koi sach me try kar raha
    // ho to uska pehla nishaan yahi hota hai.
    void logServerError(new Error(`admin login failed (${result.reason})`), {
      where: "admin/login",
      key,
      email: email.trim().toLowerCase() || "(master)",
    });

    // "pending" aur "disabled" jaan-boojh ke saaf batate hain — ye tabhi milte
    // hain jab password SAHI ho (dekho adminLogin), isliye isse kisi anjaan ko
    // kuch pata nahi chalta, aur naye member ko "galat password" ki jagah asli
    // wajah dikhti hai.
    const message =
      result.reason === "pending"
        ? "aapka account abhi approve nahi hua — master admin se kahiye"
        : result.reason === "disabled"
          ? "ye account band kar diya gaya hai"
          : result.reason === "off"
            ? "admin panel abhi set nahi hai (ADMIN_PASSWORD)"
            : "galat email ya password";

    return NextResponse.json(
      { error: message, reason: result.reason },
      { status: result.reason === "off" ? 503 : 401 },
    );
  }

  recordSuccess(key);

  const res = NextResponse.json({ ok: true, session: result.session });
  res.cookies.set(ADMIN_COOKIE, result.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return res;
}
