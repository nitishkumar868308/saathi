import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { extensionOf, type Doc, type StorageDriver } from "@reel/core";

/**
 * Asset resolution — `assetId` se asli file tak.
 *
 * ⚠️ **Doc me kabhi URL nahi hota** (Phase 1 ka locked rule). Doc me sirf
 * `assetId` rehti hai; URL/path render ke waqt banta hai. Signed URL 5-15 minute
 * me marte hain — agar wo doc me save ho jaate to kal project kholne par saari
 * media toot jaati aur wajah bilkul samajh na aati.
 *
 * **Yahan files disk par utaari jaati hain, signed URL nahi diya jaata.** Wajah:
 *  1. Render lamba hota hai (minute, kabhi zyada). Beech me presigned URL expire
 *     ho jaaye to aadha render ho chuka hota hai aur output chupchaap toota hota.
 *  2. Headless Chrome ko har frame par network se maal kheenchna padta — dheema,
 *     aur ek bhi timeout poore render ko gira deta.
 *  3. Local driver me network hai hi nahi.
 * Ek baar utaar lene se render poori tarah offline aur dohraane layak ho jaata hai.
 *
 * Files Remotion ke `publicDir` me jaati hain, isliye component me
 * `staticFile(filename)` chalta hai.
 */

export interface StoredAsset {
  /** Doc ke items me yahi id likhi hoti hai. */
  id: string;
  /** Storage key — `permanent/assets/<id>.<ext>` */
  key: string;
  /** Sirf extension tay karne ke liye. Na ho to key se nikal lete hain. */
  filename?: string;
}

/** assetId -> `publicDir` ke andar ka filename. */
export type AssetMap = Record<string, string>;

export class MissingAssetError extends Error {
  constructor(public readonly assetIds: readonly string[]) {
    super(
      `Doc me ye assetId hain par storage me inka koi pata nahi: ${assetIds.join(", ")}. ` +
        `Render shuru hi nahi kiya ja raha — aadhi-adhoori video se behtar saaf error hai.`,
    );
    this.name = "MissingAssetError";
  }
}

/** Doc me jitne bhi assetId use hue hain. */
export function collectAssetIds(doc: Doc): string[] {
  const ids = new Set<string>();
  for (const item of doc.items) {
    if (item.assetId) ids.add(item.assetId);
  }
  return [...ids];
}

export interface ResolveAssetsOptions {
  /** Files yahan utrengi. Remotion ke bundle ka `publicDir` yahi hona chahiye. */
  publicDir: string;
  onProgress?: (done: number, total: number, assetId: string) => void;
}

/**
 * Doc ke saare assets `publicDir` me utaar do aur map lauta do.
 *
 * Ek bhi asset na mile to **shuru me hi** phat jaata hai. Ye jaan-boojhkar hai:
 * missing asset par magenta card wali video ban jaana bhi ek tarah ka jhooth hai —
 * render 3 minute chala aur nateeja kaam ka nahi. Pehle hi rok dena sasta hai.
 */
export async function resolveAssets(
  doc: Doc,
  assets: readonly StoredAsset[],
  storage: StorageDriver,
  options: ResolveAssetsOptions,
): Promise<AssetMap> {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const needed = collectAssetIds(doc);

  const missing = needed.filter((id) => !byId.has(id));
  if (missing.length > 0) throw new MissingAssetError(missing);

  await mkdir(options.publicDir, { recursive: true });

  const map: AssetMap = {};
  let done = 0;

  for (const assetId of needed) {
    const asset = byId.get(assetId) as StoredAsset;
    const bytes = await storage.get(asset.key);
    if (bytes === null) {
      throw new Error(
        `Asset "${assetId}" DB me hai par storage me nahi (key: ${asset.key}). ` +
          `File kahin delete ho gayi hai.`,
      );
    }

    const ext = extensionOf(asset.filename ?? asset.key);
    // Filename assetId se banta hai, user ke diye naam se nahi — user ka naam
    // kuch bhi ho sakta hai (space, hindi, `..`), aur wo seedha disk par jaata hai.
    const filename = ext ? `${assetId}.${ext}` : assetId;
    await writeFile(resolve(options.publicDir, filename), bytes);

    map[assetId] = filename;
    done += 1;
    options.onProgress?.(done, needed.length, assetId);
  }

  return map;
}
