import { libraryTags } from "@reel/core";
import { z } from "zod";

import { fail, handle, ok, readBody } from "@/lib/api";
import {
  assetThumbKey,
  deleteAssetRow,
  findAssetUsage,
  getAsset,
  updateAsset,
} from "@/lib/assets";
import { storage } from "@/lib/storage";

/**
 * `GET    /api/assets/[id]` — ek asset + wo kahan use ho raha hai
 * `PATCH  /api/assets/[id]` — rename ya tags
 * `DELETE /api/assets/[id]` — file + thumbnail + row
 *
 * ⚠️ Delete par pehle dekha jaata hai ki asset kisi project me laga to nahi hai.
 * Laga ho to bina `?force=true` ke **rok diya jaata hai**, aur jawab me ye bhi
 * jaata hai ki kis project me kitne items par laga hai. Chupchaap mita dena
 * matlab kisi purani reel ka render agli baar "asset nahi mila" par phatna —
 * aur tab tak yaad bhi nahi rehta ki kya delete kiya tha.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

const PatchSchema = z
  .object({
    filename: z.string().trim().min(1).max(255).optional(),
    tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
  })
  .refine((body) => body.filename !== undefined || body.tags !== undefined, {
    message: "filename ya tags me se kuch to do",
  });

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  return handle(async () => {
    const asset = await getAsset(context.params.id);
    if (!asset) return fail("not found", 404, "aisa koi asset nahi hai");
    return ok({ asset, usage: await findAssetUsage(asset.id) });
  });
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return handle(async () => {
    const body = await readBody(request, PatchSchema);
    if (!body.ok) return body.response;

    if (body.data.tags) {
      // Sirf wahi tag chalte hain jinke liye library me tab bana hua hai —
      // warna user aisa tag laga deta jo kahin dikhta hi nahi.
      const allowed = new Set(libraryTags());
      const unknown = body.data.tags.filter((tag) => !allowed.has(tag));
      if (unknown.length > 0) {
        return fail("bad request", 400, `anjaan tag: ${unknown.join(", ")}`);
      }
    }

    const asset = await updateAsset(context.params.id, body.data);
    if (!asset) return fail("not found", 404, "aisa koi asset nahi hai");
    return ok({ asset });
  });
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  return handle(async () => {
    const asset = await getAsset(context.params.id);
    if (!asset) return fail("not found", 404, "aisa koi asset nahi hai");

    const force = new URL(request.url).searchParams.get("force") === "true";
    const usage = await findAssetUsage(asset.id);
    if (usage.length > 0 && !force) {
      return Response.json(
        {
          error: "in use",
          reason: `ye asset ${usage.length} project me laga hua hai`,
          usage,
        },
        { status: 409 },
      );
    }

    /*
     * Pehle file, phir row. Ulta karne par row chali jaati aur file baithi reh
     * jaati — aur uska koi naam-o-nishan na hone se wo hamesha ke liye anaath
     * ho jaati. Is kram me sabse bura ye hai ki file mit jaaye aur row rah
     * jaaye, jo agli list me saaf dikh jaata hai.
     */
    await storage().delete(asset.key);
    if (asset.thumbKey) await storage().delete(assetThumbKey(asset.id));
    await deleteAssetRow(asset.id);

    return ok({ deleted: true, usage });
  });
}
