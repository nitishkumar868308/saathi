import { assetKindForFile } from "@reel/core";
import { z } from "zod";

import { fail, handle, ok, readBody } from "@/lib/api";
import { assetKey, createAsset, deleteAssetRow, findAssetByChecksum } from "@/lib/assets";
import { probeAndThumbnail } from "@/lib/assetProbe";
import { storage } from "@/lib/storage";

/**
 * `POST /api/assets/[id]/complete` — upload ho gaya, ab row banao.
 *
 * Teen cheezein yahan hoti hain, isi kram me:
 *
 *  1. **Storage se poochho ki file sach me hai** — aur uska asli naap lo.
 *     Client ka bataya hua size sirf ek daawa hai: presigned PUT me size par
 *     koi rok lag hi nahi sakti, isliye jo bheja gaya wo kuch bhi ho sakta hai.
 *  2. Row banao (browser ke naape hue numbers ke saath — turant kuch to dikhe).
 *  3. Asli probe + thumbnail. Ye fail ho jaaye to bhi asset bacha rehta hai;
 *     wajah `meta.probeError` me likhi jaati hai.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

const CompleteSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mime: z.string().trim().max(255),
  checksum: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .optional(),
  /** Browser ne upload se pehle jo naapa. Probe aane tak yahi dikhta hai. */
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  durationMs: z.number().int().nonnegative().optional(),
  fps: z.number().positive().max(1000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(10).optional(),
});

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  return handle(async () => {
    const body = await readBody(request, CompleteSchema);
    if (!body.ok) return body.response;

    const { id } = context.params;
    const { filename, mime, checksum, tags } = body.data;

    // Yahan sirf kism chahiye — size ki jaanch neeche asli naap par hoti hai,
    // client ke bataye hue number par nahi.
    const kind = assetKindForFile(mime, filename);
    if (!kind) {
      return fail("upload mana hai", 400, `"${filename}" (${mime || "koi mime nahi"}) ki kism samajh nahi aayi`);
    }

    const key = assetKey(id, filename);
    const info = await storage().exists(key);
    if (!info) {
      return fail("upload nahi mila", 404, `storage me "${key}" nahi hai — PUT poora hua tha?`);
    }
    if (info.size <= 0) {
      await storage().delete(key);
      return fail("khaali file", 400, "upload ki hui file me 0 bytes hain");
    }
    if (info.size > kind.maxBytes) {
      // Presigned PUT me size rok nahi sakte, isliye asli rok yahi jagah hai.
      await storage().delete(key);
      return fail(
        "file hadd se badi hai",
        413,
        `${info.size} bytes chadhe; ${kind.label} ki hadd ${kind.maxBytes} hai`,
      );
    }

    // Do upload ek saath chale ho sakte hain — presign ka duplicate check tab
    // dono ke liye khaali nikalta hai. Isliye yahan dobara.
    if (checksum) {
      const existing = await findAssetByChecksum(checksum);
      /*
       * ⚠️ Yahan bhi row ke saath **file** dekhi jaati hai, presign ki tarah.
       * Bina iske ye branch abhi-abhi chadhi hui sahi file **delete** kar deta
       * hai aur badle me ek anaath row lauta deta hai — yaani upload "duplicate"
       * kehlata hai aur dono jagah kuch nahi bachta. Ye us halat me hota hai jab
       * DB me purani row ho jiski file kabhi chadhi hi na ho.
       */
      if (existing && (await storage().exists(existing.key))) {
        await storage().delete(key);
        return ok({ duplicate: true as const, asset: existing });
      }
      if (existing) {
        console.warn(
          `[assets/complete] ${existing.id} ki row thi par file nahi — row hata rahe hain`,
        );
        await deleteAssetRow(existing.id);
      }
    }

    let asset = await createAsset({
      id,
      filename,
      mime,
      bytes: info.size,
      checksum: checksum ?? null,
      width: body.data.width ?? null,
      height: body.data.height ?? null,
      durationMs: body.data.durationMs ?? null,
      fps: body.data.fps ?? null,
      lifecycle: "permanent",
      tags: tags ?? [],
      meta: { uploadedAt: new Date().toISOString() },
    });

    let probeError: string | null = null;
    try {
      const outcome = await probeAndThumbnail(asset);
      asset = outcome.asset;
      probeError = outcome.error;
    } catch (error) {
      // Yahan tak aana matlab probe ki apni safai bhi fail hui — asset phir bhi
      // theek hai, isliye upload ko fail nahi karte.
      probeError = error instanceof Error ? error.message : String(error);
    }

    return ok({ duplicate: false as const, asset, probeError }, 201);
  });
}
