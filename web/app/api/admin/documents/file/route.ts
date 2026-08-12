import { guard } from "@/lib/admin-guard";
import { getObject, r2Configured, r2Key } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin ke liye document ki file — `/api/admin/documents/file?path=<uid>/<id>.jpg`
 *
 * ── Signed URL ki jagah proxy kyun ──────────────────────────────────────────
 *
 * ⚠️ Pehle admin panel R2 ka ek short-lived **presigned URL** le kar use seedha
 * `<img src>` / `<iframe src>` me daal deta tha, aur "Naye tab me" bhi wahi URL
 * kholta tha. Wo teen alag tareeke se chup-chaap fail hota tha — aur teenon me
 * screen par bas KHAALI jagah aati thi:
 *
 *   1. **Expiry.** URL 2 minute ka tha. Admin ne modal khola, do row aur padhe,
 *      phir "Naye tab me" dabaya — tab tak URL mar chuka hota tha aur R2 ka
 *      XML error khulta tha (ya kuch bhi nahi).
 *   2. **Server ki ghadi.** SigV4 ka signature waqt par bandha hota hai. Host ki
 *      ghadi thodi si aage/peeche ho to R2 seedha 403 deta hai. `<img>` 403 par
 *      koi error nahi dikhata — bas kuch render nahi karta.
 *   3. **Do alag raaste.** Preview aur "naya tab" dono apna URL alag waqt par
 *      lete the, isliye ek chalta tha aur doosra nahi — jo debug karne me sabse
 *      uljhan wali soorat hai.
 *
 * Ab bytes server se ho kar jaate hain (bilkul `/api/avatar/[uid]` ki tarah).
 * URL saada hai, expire nahi hota, aur har baar wahi guard chalta hai jo baaki
 * admin API par — yaani surakhsha kam nahi hui, sirf ek nazuk hissa hat gaya.
 *
 * ⚠️ Cache `private, no-store` — ye kisi user ka document hai. Shared cache
 * (CDN/proxy) me ise rakhna sabse bura hoga.
 */
export async function GET(request: Request) {
  const g = await guard("documents");
  if (!g.ok) return g.res;

  if (!r2Configured()) return new Response("storage off", { status: 503 });

  const url = new URL(request.url);
  const path = url.searchParams.get("path") ?? "";
  const download = url.searchParams.get("download") === "1";
  // Traversal / absolute path block — wahi jaanch jo signed-url route par hai.
  if (!path || path.includes("..") || path.includes("\\") || path.startsWith("/")) {
    return new Response("bad path", { status: 400 });
  }

  const res = await getObject(r2Key.documentPath(path));
  if (!res?.body) return new Response("not found", { status: 404 });

  // Sirf file ka naam — poora path (jisme user id hai) filename me daalna
  // bekaar bhi hai aur leak bhi.
  const fileName = path.split("/").pop() || "document";

  const headers = new Headers({
    "Content-Type": res.headers.get("content-type") ?? "application/octet-stream",
    "Cache-Control": "private, no-store",
    // Naye tab me file DIKHNI chahiye, download nahi honi chahiye. Bina iske
    // browser PDF/JPEG ko attachment maan ke seedha download kar deta hai, aur
    // admin ko lagta hai "khula hi nahi".
    "Content-Disposition": download
      ? `attachment; filename="${fileName.replace(/["\\\r\n]/g, "")}"`
      : "inline",
    // Ye kisi aur site me embed hone laayak nahi hai.
    "X-Content-Type-Options": "nosniff",
  });
  const len = res.headers.get("content-length");
  if (len) headers.set("Content-Length", len);

  return new Response(res.body, { status: 200, headers });
}
