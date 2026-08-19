import { fail, handle, ok } from "@/lib/api";
import { getAsset } from "@/lib/assets";
import { probeAndThumbnail } from "@/lib/assetProbe";

/**
 * `POST /api/assets/[id]/probe` — asli ffprobe dobara chalao.
 *
 * Upload ke waqt ye apne aap chalta hai. Ye route un cheezon ke liye hai jo baad
 * me hoti hain: pehli baar ffmpeg install na ho, ya thumbnail delete ho gaya ho,
 * ya probe me koi bug theek hua ho aur purane assets dobara naapne hon.
 *
 * ⚠️ Naye numbers **purane par likhe** jaate hain — DB me hamesha wahi rehta hai
 * jo aakhri baar sach me naapa gaya tha.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

export async function POST(_request: Request, context: RouteContext): Promise<Response> {
  return handle(async () => {
    const asset = await getAsset(context.params.id);
    if (!asset) return fail("not found", 404, "aisa koi asset nahi hai");

    const outcome = await probeAndThumbnail(asset);
    if (outcome.error) {
      // 200 nahi — probe fail hua hai to wo saaf dikhna chahiye. Asset phir bhi
      // wapas jaata hai taaki UI usko waise ka waisa dikha sake.
      return Response.json(
        { error: "probe fail", reason: outcome.error, asset: outcome.asset },
        { status: 502 },
      );
    }
    return ok({ asset: outcome.asset, probed: outcome.probed, thumbnail: outcome.thumbnail });
  });
}
