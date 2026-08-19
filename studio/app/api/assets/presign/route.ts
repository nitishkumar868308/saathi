import { checkUploadable, extensionOf, storageKey } from "@reel/core";
import { z } from "zod";

import { fail, handle, ok, readBody } from "@/lib/api";
import { findAssetByChecksum } from "@/lib/assets";
import { storage } from "@/lib/storage";

/**
 * `POST /api/assets/presign` — upload ka URL do.
 *
 * Yahan **row nahi banti**. Client is URL par seedha PUT karta hai aur uske baad
 * `/api/assets/[id]/complete` bulata hai; row wahan banti hai. Ulta karne par
 * (pehle row, phir upload) client ke beech me marne se library me aisi entry
 * reh jaati jo khulti hi nahi.
 *
 * Bytes kabhi studio ke server se hokar nahi jaate — 200MB ka video Next ke
 * route handler se guzarna matlab memory aur waqt dono bekaar.
 *
 * ⚠️ Allowed kism aur size ki hadd `ASSET_KINDS` registry se aati hai, yahan
 * likhi nahi hai. Client bhi wahi `checkUploadable` chalata hai — par uspar
 * bharosa nahi kiya jaata, wo sirf turant jawab dene ke liye hai.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PresignSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mime: z.string().trim().max(255),
  bytes: z.number().int().min(1),
  /** Duplicate pehchanne ke liye — client ne file ko stream karke naapa hai. */
  checksum: z
    .string()
    .regex(/^[0-9a-f]{64}$/, "checksum sha256 hex hona chahiye")
    .optional(),
});

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const body = await readBody(request, PresignSchema);
    if (!body.ok) return body.response;

    const { filename, mime, bytes, checksum } = body.data;

    const allowed = checkUploadable({ name: filename, type: mime, size: bytes });
    if (!allowed.ok) return fail("upload mana hai", 400, allowed.error.message);

    /*
     * Duplicate: wahi bytes dobara chadhane ka koi matlab nahi (5.7). Ye "shayad
     * same file" wala andaaza nahi hai — sha256 milna matlab file bilkul wahi hai.
     */
    if (checksum) {
      const existing = await findAssetByChecksum(checksum);
      if (existing) {
        return ok({ duplicate: true as const, asset: existing });
      }
    }

    const id = crypto.randomUUID();
    const key = storageKey.asset(id, extensionOf(filename));
    const target = await storage().putSigned(key, mime || "application/octet-stream");

    return ok({
      duplicate: false as const,
      assetId: id,
      key,
      kind: allowed.kind.id,
      upload: target,
    });
  });
}
