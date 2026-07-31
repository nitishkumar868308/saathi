import { readToken, recordEvent } from "@/lib/message-track";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Email ka open-pixel — 1x1 GIF.
 *
 * Mail khulte hi client ye tasveer maangta hai, aur hume "khola" pata chal jaata
 * hai. Do baatein jaan-boojh ke aisi hain:
 *
 *  1. **Tasveer HAMESHA jaati hai** — token galat ho, DB down ho, kuch bhi ho.
 *      Warna user ke mail me ek toota hua image ka nishaan aa jaata, jo bhaddaa
 *      bhi hai aur "ye mail spam hai" ka ishaara bhi deta hai.
 *  2. **Event peeche likha jaata hai** (await nahi) — pixel ka jawab DB ke
 *      intezaar me nahi rukna chahiye.
 *
 * ⚠️ Ye ginti poori sach nahi hoti: Gmail/Outlook images block kar dein to open
 * nahi dikhega, aur Gmail apni proxy se pehle hi image kheench le to bina khole
 * bhi dikh sakta hai. Isliye admin screen par click ko zyada bharosemand maana
 * gaya hai.
 */

// 1x1 transparent GIF.
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

function pixelResponse(): Response {
  return new Response(new Uint8Array(PIXEL), {
    status: 200,
    headers: {
      "content-type": "image/gif",
      // Proxy/CDN cache kar le to doosra open kabhi ginta hi nahi.
      "cache-control": "no-store, no-cache, must-revalidate, private",
      pragma: "no-cache",
      "content-length": String(PIXEL.length),
    },
  });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const sendId = readToken(url.searchParams.get("k"));
  if (sendId) {
    void recordEvent({
      sendId,
      type: "open",
      agent: request.headers.get("user-agent"),
    });
  }
  return pixelResponse();
}
