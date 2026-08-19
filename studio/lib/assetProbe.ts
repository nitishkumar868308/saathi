import { readFile, rm } from "node:fs/promises";

import { extensionOf, requireAssetKind } from "@reel/core";
import { makeThumbnail, probeAsset } from "@reel/media";

import { assetThumbKey, updateAsset, type Asset } from "@/lib/assets";
import { scratchDir, scratchPath, storage, withLocalFile } from "@/lib/storage";

/**
 * Upload ke baad ka asli naap: ffprobe + thumbnail.
 *
 * Browser ne upload se pehle jo naapa tha wo sirf pehli jhalak hai. Asli numbers
 * yahan bante hain, aur **yahi DB me rehte hain** — Section 3A ka "asli numbers,
 * andaaza nahi" wala rule iska hi matlab hai. Iske bina quality badge, upscale
 * warning aur export ki validation teeno andaaze par khadi hoti.
 *
 * ⚠️ Probe fail hona asset ko fail nahi karta. File chadh chuki hai aur wo user
 * ki hai — usko sirf isliye reject kar dena ki hum uska codec nahi padh paaye,
 * galat hoga. Wajah `meta.probeError` me likhi jaati hai aur UI usse "?" badge
 * dikhata hai; chupchaap "sab theek" kabhi nahi dikhta.
 */

export interface ProbeOutcome {
  asset: Asset;
  probed: boolean;
  thumbnail: boolean;
  error: string | null;
}

export async function probeAndThumbnail(asset: Asset): Promise<ProbeOutcome> {
  const kind = requireAssetKind(asset.kind);
  const extension = extensionOf(asset.filename) ?? extensionOf(asset.key);

  if (!kind.probeable && kind.thumbnail === "none") {
    return { asset, probed: false, thumbnail: false, error: null };
  }

  try {
    return await withLocalFile(
      storage(),
      asset.key,
      { extension, scratchDir: scratchDir() },
      async (path) => {
        const probe = kind.probeable ? await probeAsset(path) : null;

        let thumbKey: string | null = null;
        if (kind.thumbnail !== "none") {
          thumbKey = await buildThumbnail(asset, kind.thumbnail, path, probe?.durationMs ?? null);
        }

        const updated = await updateAsset(asset.id, {
          ...(probe
            ? {
                width: probe.width,
                height: probe.height,
                durationMs: probe.durationMs,
                fps: probe.fps,
                sampleRate: probe.sampleRate,
                channels: probe.channels,
              }
            : {}),
          meta: {
            ...asset.meta,
            ...(probe ? probe.meta : {}),
            ...(thumbKey ? { thumbKey } : {}),
            probeError: null,
          },
        });

        return {
          asset: updated ?? asset,
          probed: probe !== null,
          thumbnail: thumbKey !== null,
          error: null,
        };
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const updated = await updateAsset(asset.id, {
      meta: { ...asset.meta, probeError: message },
    });
    return { asset: updated ?? asset, probed: false, thumbnail: false, error: message };
  }
}

/**
 * Thumbnail banao aur storage me daal do.
 *
 * Thumbnail ki key asset id se **tay** hoti hai (`permanent/thumbs/<id>.jpg`),
 * isliye uske liye DB me alag column nahi chahiye. `meta.thumbKey` sirf ye
 * batata hai ki wo bana bhi hai ya nahi — UI bina soche wahan tak nahi jaata.
 */
async function buildThumbnail(
  asset: Asset,
  strategy: string,
  sourcePath: string,
  durationMs: number | null,
): Promise<string | null> {
  const outputPath = await scratchPath(scratchDir(), `thumb-${asset.id}.jpg`);

  try {
    const made = await makeThumbnail(strategy, sourcePath, outputPath, { durationMs });
    if (!made) return null;

    const bytes = await readFile(outputPath);
    const key = assetThumbKey(asset.id);
    await storage().put(key, new Uint8Array(bytes), "image/jpeg");
    return key;
  } finally {
    // Beech ka maal kabhi nahi bachna chahiye — warna render-out/tmp bhar jaata hai.
    await rm(outputPath, { force: true });
  }
}
