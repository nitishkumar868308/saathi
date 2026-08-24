import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { resolve } from "node:path";

import { fitCacheKey, planFit, storageKey, type FitPlan } from "@reel/core";
import { fitImage, fitVideo } from "@reel/media";
import { z } from "zod";

import { fail, handle, ok, readBody } from "@/lib/api";
import { createAsset, findAssetByCacheKey, getAsset } from "@/lib/assets";
import { probeAndThumbnail } from "@/lib/assetProbe";
import { scratchDir, storage, withLocalFile } from "@/lib/storage";

/**
 * `POST /api/assets/[id]/fit` — is file ki **frame me fit ki hui copy** banao.
 *
 * ⚠️ Ye AI nahi hai aur na hona chahiye. Naap ka sawaal ek ginti ka sawaal hai
 * (`planFit` — poora hisaab `@reel/core` me), aur uska ek hi sahi jawab hota hai.
 * AI se karwane par wahi tasveer do baar daalne par do alag nateeje aate, aur
 * unki wajah kisi ko samajh nahi aati.
 *
 * ⚠️ **Asli file kabhi nahi badalti.** Fit ki hui file uske bagal me banti hai,
 * apni id ke saath. Upar likh dene par aadmi ki apni tasveer hamesha ke liye kat
 * kar reh jaati — aur harkat badalne par usi kati hui file se dobara fit hoti,
 * yaani nuksaan har baar jud'ta jaata.
 *
 * ⚠️ Bani hui file `permanent` hai aur library me dikhti hai (`tags: ["fit"]`),
 * kyunki uska poora maqsad yahi hai: agli reel me wahi pehle se fit ki hui file
 * seedha chun li jaaye, dobara banaye bina. Isliye wo `temporary` nahi ho sakti —
 * cleanup use utha leta aur aadmi ki library me ek aisi entry reh jaati jo khulti
 * hi nahi.
 *
 * ⚠️ **Cache pehle, ffmpeg baad me** — bilkul TTS wali soch (`ttsCacheKey`).
 * Aadmi harkat badal kar dekhta hai (zoom, bahaav, sthir) aur do baar wapas aata
 * hai; bina cache ke har baar ek poora encode lagta aur library ek hi tasveer ki
 * chhe copy se bhar jaati.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FitSchema = z.object({
  /** Project ka frame — jis naap ki reel ban rahi hai. */
  width: z.number().int().min(16).max(8192),
  height: z.number().int().min(16).max(8192),
  /** `ANIMATION_PRESETS` ka id — iska zoom target naap me judta hai. */
  animationPresetId: z.string().min(1).nullable().optional(),
  /** Video ka chuna hua hissa — na do to poori file. */
  trim: z
    .object({ startSeconds: z.number().min(0), endSeconds: z.number().min(0) })
    .nullable()
    .optional(),
});

interface RouteContext {
  params: { id: string };
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  return handle(async () => {
    const body = await readBody(request, FitSchema);
    if (!body.ok) return body.response;

    const source = await getAsset(context.params.id);
    if (!source) return fail("not found", 404, "aisa koi asset nahi hai");

    const isVideo = source.kind === "video";
    if (!isVideo && source.kind !== "image") {
      return fail(
        "ye file fit nahi ho sakti",
        400,
        `Fit sirf tasveer aur video par hota hai — ye "${source.kind}" hai.`,
      );
    }

    /*
     * ⚠️ Naap ke bina fit ka koi bharosemand faisla ho hi nahi sakta, aur andaaza
     * laga lena sabse bura raasta hai: 480p ki tasveer ko 1080x1920 par kaat kar
     * "fit ho gayi" keh dena wahi upscale wala jhooth hai jisse poora project
     * bachta aaya hai (Section 3A). Isliye saaf mana, probe ke raaste ke saath.
     */
    if (!source.width || !source.height) {
      return fail(
        "is file ka naap pata nahi",
        409,
        "Pehle ise naapna padega (probe) — uske bina fit ka faisla sirf andaaza hoga.",
      );
    }

    const plan = planFit({
      source: { width: source.width, height: source.height },
      frame: { width: body.data.width, height: body.data.height },
      animationPresetId: body.data.animationPresetId ?? null,
    });
    if (!plan) return fail("fit ka hisaab nahi ban paaya", 409, "naap galat hai");

    const trim = isVideo ? (body.data.trim ?? null) : null;
    const cacheKey = fitCacheKey({
      sourceAssetId: source.id,
      target: plan.target,
      mode: plan.mode,
      blurredEdges: plan.blurredEdges,
      trim,
    });

    /* ------------------------------------------------------- cache pehle */

    const cached = await findAssetByCacheKey(cacheKey);
    /*
     * ⚠️ Cache hit ka matlab "DB me row hai", "file maujood hai" nahi — wahi baat
     * jo TTS wale route par likhi hai, aur wahi wajah: storage driver badal jaana
     * (local se r2) ya file ka manually mit jaana row ko peeche chhod deta hai.
     * Us row par bharosa karne ka nateeja render ke waqt dikhta hai, yaani sabse
     * mehngi jagah par. Ek HEAD call uske aage kuch bhi nahi.
     */
    if (cached && (await storage().exists(cached.key))) {
      return ok({ asset: cached, plan, cached: true, sourceAssetId: source.id });
    }

    /* --------------------------------------------------------- ab banao */

    const fitId = randomUUID();
    const extension = isVideo ? "mp4" : "jpg";
    const mime = isVideo ? "video/mp4" : "image/jpeg";
    const scratch = resolve(scratchDir(), `fit-${fitId}`);
    const outPath = resolve(scratch, `fit.${extension}`);
    await mkdir(scratch, { recursive: true });

    try {
      await withLocalFile(
        storage(),
        source.key,
        { extension: extensionOfKey(source.key, source.filename), scratchDir: scratchDir() },
        async (localPath) => {
          if (isVideo) await fitVideo({ input: localPath, output: outPath, plan, trim });
          else await fitImage({ input: localPath, output: outPath, plan });
        },
      );

      const bytes = await readFile(outPath);
      const key = storageKey.asset(fitId, extension);
      await storage().put(key, new Uint8Array(bytes), mime);

      const asset = await createAsset({
        id: fitId,
        key,
        filename: fittedName(source.filename, plan, extension),
        mime,
        bytes: bytes.byteLength,
        /*
         * Naap yahin likha jaata hai kyunki hum use **pehle se jaante hain** — plan
         * ne hi tay kiya tha. Probe neeche ise dobara naap kar confirm karega; do
         * me se koi bhi alag nikle to wo galti DB me dikhegi, chhupegi nahi.
         */
        width: plan.target.width,
        height: plan.target.height,
        lifecycle: "permanent",
        cacheKey,
        /*
         * ⚠️ `fit` ka tag hi wo cheez hai jisse ye file library me pehchani jaati
         * hai. `wizard` ka tag saath me isliye ki gallery me wo wahin dikhe jahan
         * baaki wizard wali file dikhti hai — aadmi ne ise wizard me hi banwaya
         * hai, kahin aur se nahi.
         */
        tags: ["fit", "wizard", ...source.tags.filter((tag) => tag !== "fit")],
        meta: {
          fit: {
            sourceAssetId: source.id,
            sourceSize: { width: source.width, height: source.height },
            target: plan.target,
            mode: plan.mode,
            blurredEdges: plan.blurredEdges,
            zoom: plan.zoom,
            upscale: Number(plan.upscale.toFixed(3)),
            trim,
          },
          storageKey: key,
        },
      });

      /*
       * Probe + thumbnail turant — warna ye file gallery me bina jhalak aur bina
       * quality badge ke baithi rehti hai, aur wahi ek cheez hai jiske liye ise
       * gallery me daala gaya tha (agli baar seedha isse chunna).
       */
      const probed = await probeAndThumbnail(asset);

      return ok({
        asset: probed.asset,
        plan,
        cached: false,
        sourceAssetId: source.id,
        probeError: probed.error,
      });
    } finally {
      // Beech ka maal har haal me jaata hai — fail hone par bhi.
      await rm(scratch, { recursive: true, force: true });
    }
  });
}

/** Ext key se, na mile to filename se — `withLocalFile` ko sahi ext chahiye. */
function extensionOfKey(key: string, filename: string): string | null {
  const from = (value: string): string | null => {
    const dot = value.lastIndexOf(".");
    return dot > 0 && dot < value.length - 1 ? value.slice(dot + 1).toLowerCase() : null;
  };
  return from(key) ?? from(filename);
}

/**
 * Library me dikhne wala naam.
 *
 * ⚠️ Naam me naap likha hai, aur wo sajawat nahi hai: gallery me ek hi tasveer ki
 * asli aur fit ki hui copy bagal-bagal dikhti hain, aur bina naap ke unme farak
 * karne ka koi tarika nahi hota.
 */
function fittedName(filename: string, plan: FitPlan, extension: string): string {
  const dot = filename.lastIndexOf(".");
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  return `${base} (fit ${plan.target.width}x${plan.target.height}).${extension}`;
}
