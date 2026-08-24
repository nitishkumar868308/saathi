import { fail, handle } from "@/lib/api";
import { getAsset } from "@/lib/assets";
import { storage } from "@/lib/storage";

/**
 * `GET /api/assets/[id]/raw` — asset ke bytes, **studio ke apne origin se**.
 *
 * ⚠️ Ye `/url` ka duplicate nahi hai aur uski jagah bhi nahi le sakta. `/url` ek
 * signed URL deta hai jo seedha R2 se aata hai — 200 assets ka grid, 200MB ka
 * video, sab usi se chalta hai, aur bytes studio ke server se hokar kabhi nahi
 * guzarte. Wo rehna chahiye.
 *
 * Ye route sirf **ek** kaam ke liye hai: canvas me tasveer padhna (fit banane ke
 * liye). Wahan doosre origin ki tasveer canvas ko "taint" kar deti hai aur uske
 * baad `toBlob()` `SecurityError` deta hai — chahe tasveer screen par bilkul theek
 * dikh rahi ho. Us halat ka ilaaj R2 par CORS set karna hai, par uspar bharosa
 * karne ka matlab hai ki fit kisi din chup-chaap band ho jaayega aur wajah kisi
 * ko samajh nahi aayegi (`<img>` to chalti rahegi). Apne origin se padhne par wo
 * sawaal uthta hi nahi.
 *
 * ⚠️ Sirf tasveerein, aur unpar bhi ek hadd. Video ke 200MB is raaste se
 * guzarna Vercel ke function ke liye bhi bura hai aur bekaar bhi — video canvas
 * me fit hoti hi nahi.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

/**
 * Isse badi file is raaste se nahi jaati.
 *
 * ⚠️ Hadd hone ki wajah serverless ki memory hai: `storage().get()` poori file
 * memory me laata hai. Ek 40MB ki tasveer bhi aam nahi hai; usse aage jaana
 * function ko marne ke sabse aasan tareekon me se ek hai.
 */
const MAX_BYTES = 40 * 1024 * 1024;

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  return handle(async () => {
    const asset = await getAsset(context.params.id);
    if (!asset) return fail("not found", 404, "aisa koi asset nahi hai");

    if (asset.kind !== "image") {
      return fail(
        "ye file is raaste se nahi jaati",
        400,
        `Ye route sirf tasveer ke liye hai — ye "${asset.kind}" hai. Uske liye /url use karo.`,
      );
    }
    if (asset.bytes > MAX_BYTES) {
      return fail(
        "file bahut badi hai",
        413,
        `${Math.round(asset.bytes / 1024 / 1024)}MB — is raaste ki hadd ${MAX_BYTES / 1024 / 1024}MB hai.`,
      );
    }

    const bytes = await storage().get(asset.key);
    if (!bytes) return fail("file nahi mili", 404, `storage me "${asset.key}" nahi hai`);

    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": asset.mime || "application/octet-stream",
        "Content-Length": String(bytes.byteLength),
        // Apna hi origin hai aur asset kabhi badalti nahi — dobara maangne ki zaroorat hi na pade.
        "Cache-Control": "private, max-age=3600",
      },
    });
  });
}
