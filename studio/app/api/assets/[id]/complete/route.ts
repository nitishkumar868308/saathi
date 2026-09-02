import { assetKindForFile, checkUploadSize } from "@reel/core";
import { z } from "zod";

import { fail, handle, ok, readBody } from "@/lib/api";
import { assetKey, createAsset, deleteAssetRow, findAssetByChecksum } from "@/lib/assets";
import { probeAndThumbnail } from "@/lib/assetProbe";
import { storage } from "@/lib/storage";

/**
 * `POST /api/assets/[id]/complete` — upload ho gaya, ab row banao.
 *
 * Chaar cheezein yahan hoti hain, isi kram me:
 *
 *  1. **Storage se poochho ki file sach me hai** — aur uska asli naap lo.
 *     Client ka bataya hua size sirf ek daawa hai: presigned PUT me size par
 *     koi rok lag hi nahi sakti, isliye jo bheja gaya wo kuch bhi ho sakta hai.
 *  2. Row banao (browser ke naape hue numbers ke saath — turant kuch to dikhe).
 *  3. Asli probe + thumbnail. Ye fail ho jaaye to bhi asset bacha rehta hai;
 *     wajah `meta.probeError` me likhi jaati hai.
 *  4. **Naap ki rok** — probe ke naape hue naap par. Jo file is frame me kabhi
 *     saaf nahi dikhegi, uski row aur file dono yahin hat jaati hain.
 *
 * ⚠️ Kram maayne rakhta hai: naap ki rok probe ke **baad** hai, pehle nahi. Rok
 * ka poora bharosa asli naap par hai, aur asli naap probe ke bina pata nahi
 * chalta — browser ka bataya naap rotation par ghum jaata hai.
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
  /**
   * Project ka frame — naap ki rok ke liye.
   *
   * ⚠️ Ye client se aata hai, aur wo theek hai: ye deewar nahi, dohri jaanch
   * hai. Iska asli faayda ye hai ki yahan **probe ka naapa hua** naap lagta hai,
   * browser ka andaaza nahi.
   */
  frame: z
    .object({
      width: z.number().int().positive(),
      height: z.number().int().positive(),
    })
    .optional(),
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

    /*
     * Naap ki rok — ab **probe ke naape hue** naap par.
     *
     * ⚠️ Yahan tak aane ka matlab hai ki client ki rok chook gayi: purana tab
     * khula tha, ya browser ne galat naap bataya tha (rotation par aisa hota
     * hai). Us halat me file ko rehne dena wahi nuksaan hai jisse ye poora kaam
     * bachne ke liye bana hai — ek aisi file jo reel me kabhi kaam nahi aayegi,
     * hamesha ke liye jagah ghere baithi rehti hai.
     *
     * ⚠️ Row aur file **dono** hatti hain. Sirf ek hataane par doosri anaath reh
     * jaati hai — aur is route par dono taraf ki safai ka raasta upar pehle se
     * maujood hai.
     */
    const size = checkUploadSize({
      filename,
      hasPixels: kind.hasPixels,
      source: asset.width && asset.height ? { width: asset.width, height: asset.height } : null,
      frame: body.data.frame ?? null,
    });
    if (!size.ok) {
      await deleteAssetRow(asset.id);
      await storage().delete(key);
      return fail("naap kaafi nahi", 422, size.message ?? "ye file is reel ke liye chhoti hai");
    }

    return ok({ duplicate: false as const, asset, probeError }, 201);
  });
}
