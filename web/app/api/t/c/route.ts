import {
  readToken,
  recordEvent,
  APP_DEST_URL,
  WEB_DEST_URL,
  type ClickDest,
} from "@/lib/message-track";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Email ke link ka beech ka padav — click likho, phir aage bhej do.
 *
 * `d` batata hai user kahan jaana chahta hai:
 *   app — phone me app kholo (na ho to Play Store)
 *   web — website
 *   url — admin ne message me jo link likha tha
 *
 * ⚠️ `d=url` sabse khatarnaak hissa hai: bina jaanch ke ye ek khula redirector
 * ban jaata, jise koi bhi phishing ke liye use kar sakta tha (`apkasaathi.com`
 * wala link jo kahin aur le jaaye). Isliye sirf http/https chalte hain, aur
 * kharab/gayab URL par chup-chaap apni site par bhej dete hain.
 */

const APP_PACKAGE = "com.apkasaathi.app";
const APP_SCHEME = "saathi";

/** `u` par bharosa mat karo — sirf http/https, baaki sab par apni site. */
function safeUrl(raw: string | null): string {
  if (!raw) return WEB_DEST_URL;
  try {
    const u = new URL(raw);
    if (u.protocol !== "http:" && u.protocol !== "https:") return WEB_DEST_URL;
    return u.toString();
  } catch {
    return WEB_DEST_URL;
  }
}

/**
 * "App kholo" ka asli matlab.
 *
 * Android par `intent://` URL se Chrome pehle app kholne ki koshish karta hai
 * aur app na ho to `browser_fallback_url` par chala jaata hai — yaani ek hi link
 * dono kaam kar leta hai. Seedha Play Store bhejna galat hoga: jinke paas app
 * pehle se hai unhe bhi store ka page dikhega, aur wo click "app par gaya" nahi
 * "store par gaya" ban jaata.
 *
 * iOS/desktop par intent scheme kaam nahi karta — wahan seedha store link.
 */
function appUrl(userAgent: string): string {
  if (!/android/i.test(userAgent)) return APP_DEST_URL;
  const fallback = encodeURIComponent(APP_DEST_URL);
  return (
    `intent://open#Intent;scheme=${APP_SCHEME};package=${APP_PACKAGE};` +
    `S.browser_fallback_url=${fallback};end`
  );
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const agent = request.headers.get("user-agent") ?? "";
  const dRaw = url.searchParams.get("d");
  const dest: ClickDest = dRaw === "app" || dRaw === "url" ? dRaw : "web";

  const to =
    dest === "app" ? appUrl(agent) : dest === "url" ? safeUrl(url.searchParams.get("u")) : WEB_DEST_URL;

  const sendId = readToken(url.searchParams.get("k"));
  if (sendId) {
    // Click likhna user ke redirect ko rok nahi sakta — isliye await hai par
    // fail chup-chaap nigal liya jaata hai (recordEvent khud hi aisa hai).
    // Await isliye ki serverless function response ke baad marr jaata hai;
    // fire-and-forget yahan aksar likha hi nahi jaata.
    await recordEvent({
      sendId,
      type: "click",
      // `url` wale click me admin ka apna link hai — wo app/web me se kuch nahi.
      target: dest === "url" ? null : dest,
      url: dest === "url" ? to : null,
      agent,
    });
  }

  // 302 (permanent nahi) — browser ise cache kar le to agla click kabhi ginta
  // hi nahi, aur wahi sabse chupa hua bug hota.
  //
  // ⚠️ `NextResponse.redirect()` jaan-boojh ke nahi: wo `new URL()` se jaanch
  // karta hai aur `intent://` wale Android link par phenk deta hai. Location
  // header seedha likhna dono soorat me chalta hai.
  return new Response(null, {
    status: 302,
    headers: { location: to, "cache-control": "no-store, private" },
  });
}
