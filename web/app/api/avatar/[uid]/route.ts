import { getObject, r2Configured, r2Key } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Profile photo — `/api/avatar/<uid>`.
 *
 * R2 ka bucket poora PRIVATE hai (usme documents bhi padi hain), isliye avatar
 * ko public URL nahi mil sakta. Server yahan bytes khud utha kar aage de deta
 * hai — bucket band rehta hai, aur URL phir bhi ek saada, kabhi na expire hone
 * wala link rehta hai jise `<Image>` ya `avatar_url` me seedha rakha ja sakta
 * hai.
 *
 * (Signed URL is jagah kaam nahi karta: wo expire ho jaata hai, aur `avatar_url`
 * DB me mahino padi rehti hai.)
 *
 * Photo badalne par app URL ke aage `?t=<time>` laga deti hai — isi wajah se
 * yahan lamba cache rakhna surakshit hai.
 */
export async function GET(
  request: Request,
  { params }: { params: { uid: string } },
) {
  if (!r2Configured()) return new Response("storage off", { status: 503 });

  const uid = params.uid;
  if (!UUID.test(uid)) return new Response("bad id", { status: 400 });

  const res = await getObject(r2Key.avatar(uid));
  if (!res || !res.body) return new Response("not found", { status: 404 });

  const etag = res.headers.get("etag");

  // Browser ke paas wahi photo pehle se ho to dobara bhejne ka koi matlab nahi.
  if (etag && request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const headers = new Headers({
    "Content-Type": res.headers.get("content-type") ?? "image/jpeg",
    // `?t=` badalte hi URL naya ho jaata hai, isliye lamba cache safe hai.
    "Cache-Control": "public, max-age=3600, s-maxage=31536000, immutable",
  });
  const len = res.headers.get("content-length");
  if (len) headers.set("Content-Length", len);
  if (etag) headers.set("ETag", etag);

  return new Response(res.body, { status: 200, headers });
}
