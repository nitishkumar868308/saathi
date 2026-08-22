import { NextResponse, type NextRequest } from "next/server";

import { STUDIO_COOKIE, studioPasswordConfigured, verifyToken } from "@/lib/auth";

/**
 * Studio ka pehra — har page aur har API route par.
 *
 * ⚠️ Gate **yahan** hai, kisi page ke andar nahi. Page ke andar check karne se
 * naya route banate hi wo khula reh jaata hai, aur sabse buri baat ye ki dikhta
 * bilkul band hua jaisa hai. Middleware default-deny hai: jo neeche `PUBLIC` me
 * nahi likha, wo band.
 *
 * Ye local editor hai (localhost), par gate phir bhi zaroori hai — ek din ye
 * machine kisi network par hogi, aur tab yaad nahi aayega ki gate tha hi nahi.
 */

/**
 * Sirf ye raaste bina login ke khulte hain.
 *
 * ⚠️ `/api/cron/*` yahan hai kyunki use bulane wala Supabase ka pg_cron hai —
 * uske paas na browser hai na cookie, isliye studio ka password gate wahan lag
 * hi nahi sakta. Wo raasta khula **nahi** hai: uska apna pehra `CRON_SECRET` ka
 * Bearer token hai (dekho `app/api/cron/reel-dispatch/route.ts`). Ek pehre ki
 * jagah doosra — bina pehre ke kuch bhi nahi.
 */
const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/cron"];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const ok = await verifyToken(request.cookies.get(STUDIO_COOKIE)?.value);
  if (ok) return NextResponse.next();

  // API ko redirect bhejna sabse chidhane wali cheez hoti hai — fetch ko HTML
  // login page milta hai aur error "JSON parse failed" jaisa kuch dikhta hai.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "unauthorized",
        reason: studioPasswordConfigured()
          ? "login karo (/login)"
          : "STUDIO_PASSWORD env set nahi hai",
      },
      { status: 401 },
    );
  }

  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  // Login ke baad wahin wapas — warna har baar home se dobara raasta dhoondhna padta.
  if (pathname !== "/") url.searchParams.set("next", `${pathname}${search}`);
  return NextResponse.redirect(url);
}

export const config = {
  // Next ke apne assets aur favicon chhod do — baaki sab pehre me hai.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
