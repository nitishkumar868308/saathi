import { fail, handle, ok } from "@/lib/api";
import { assetThumbKey, getAsset } from "@/lib/assets";
import { storage } from "@/lib/storage";

/**
 * `GET /api/assets/[id]/url` — padhne ka chhoti umar wala URL.
 *
 * ⚠️ **Ye URL doc me kabhi save nahi hota** (Phase 1 ka locked rule). Signed URL
 * minaton me marte hain; doc me chala jaaye to kal project kholne par saari
 * media toot jaati aur wajah bilkul samajh na aati. Doc me sirf `assetId` rehti
 * hai, URL har baar yahan se banta hai.
 *
 * `?thumb=1` par thumbnail ka URL milta hai — bana hi na ho to 404, taaki UI
 * jaanta rahe ki dikhane ko kuch hai bhi ya nahi.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

/** Local driver ke URL nahi marte, par UI ko dono driver ek jaise dikhne chahiye. */
const URL_TTL_SECONDS = 15 * 60;

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  return handle(async () => {
    const asset = await getAsset(context.params.id);
    if (!asset) return fail("not found", 404, "aisa koi asset nahi hai");

    const params = new URL(request.url).searchParams;
    const wantThumb = params.get("thumb") === "1";

    if (wantThumb && !asset.thumbKey) {
      return fail("not found", 404, "is asset ka thumbnail nahi bana");
    }
    const key = wantThumb ? assetThumbKey(asset.id) : asset.key;

    const url = await storage().getSignedUrl(key, {
      expiresIn: URL_TTL_SECONDS,
      ...(params.get("download") === "1" ? { downloadName: asset.filename } : {}),
    });

    return ok({
      url,
      // Client isi par cache rakhta hai aur marne se pehle naya maang leta hai.
      expiresAt: new Date(Date.now() + URL_TTL_SECONDS * 1000).toISOString(),
    });
  });
}
