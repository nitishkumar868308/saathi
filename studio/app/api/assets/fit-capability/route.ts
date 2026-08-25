import { ffmpegAvailable } from "@reel/media";

import { handle, ok } from "@/lib/api";

/**
 * `GET /api/assets/fit-capability` — **is server par video fit ho sakti hai?**
 *
 * ⚠️ Ye route ek hi galti ke liye bana hai, aur wo galti ye thi ki UI **maan
 * leti thi** ki video fit ho sakti hai. Studio do jagah chalta hai:
 *
 *   • tumhara PC — ffmpeg hai, video sach me fit ho kar library me save hoti hai
 *   • Vercel     — ffmpeg hai hi nahi, aur kabhi hoga bhi nahi
 *
 * Dono jagah UI ek hi koshish karti thi, isliye Vercel par har video wale scene
 * par ek laal chetavni aati thi jisme likha hota tha "FFmpeg install hai? Naya
 * terminal khola tha?" — ek aisi salah jo us jagah par kabhi kaam nahi aa sakti.
 * Aur wo chetavni jhooth bhi bolti thi: reel **theek banti thi**, kyunki video
 * ko render ke waqt renderer khud fit karta hai.
 *
 * ⚠️ Tasveer is jawab me hai hi nahi, aur wo jaan-boojhkar hai. Tasveer ka fit
 * browser me canvas par hota hai (`lib/fitInBrowser.ts`) — usme server ka koi
 * haath nahi, isliye wo har jagah chalta hai. Use bhi is jhande ke peeche daal
 * dena us kaam ko bina wajah server se baandh deta.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return handle(async () => {
    const video = await ffmpegAvailable();
    return ok({
      /** `false` = video ki alag fit-file nahi banegi; renderer render par fit karega. */
      video,
      reason: video
        ? null
        : "Is server par ffmpeg nahi hai (Vercel par ye normal hai) — " +
          "video reel bante waqt apne aap fit ho jaayegi.",
    });
  });
}
