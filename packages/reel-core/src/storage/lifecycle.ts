import type { Doc } from "../schema/project";

/**
 * Asset lifecycle ka **faisla** (20.10).
 *
 * ⚠️ Ye yahan hai, cleanup script me nahi, aur wo jaan-boojhkar hai. Script ko
 * DB aur R2 chahiye; ye faisla sirf do liston par tika hai. Alag hone se ise
 * **abhi** test kiya ja sakta hai — bina Supabase ke, bina R2 ke. Aur yahi wo
 * hissa hai jiski galti sabse mehngi padti hai: ek galat filter ka nateeja
 * "mera saara kaam chala gaya" hota hai.
 */

export interface LifecycleAsset {
  id: string;
  key: string;
  lifecycle: "permanent" | "temporary" | string;
  /** ISO string ya `null`. */
  expiresAt: string | null;
  bytes?: number | null;
}

export interface CleanupPlan {
  /** Mitane layak — expire ho chuki **aur** kisi project me nahi. */
  deletable: LifecycleAsset[];
  /** Expire ho chuki par kisi project me lagi hui — inhe kabhi nahi mitana. */
  keptBecauseUsed: LifecycleAsset[];
  /** Abhi expire nahi hui. */
  notExpired: LifecycleAsset[];
  /** Kitni jagah khaali hogi. */
  freedBytes: number;
}

/**
 * Kaun se asset kis doc me use ho rahe hain (20.10).
 *
 * ⚠️ Items ke `assetId` ke saath **brand ka logo aur watermark bhi** ginte
 * hain. Wo item nahi hote par asset hote hain — chhodne par ek din watermark ka
 * logo cleanup me chala jaata aur poori brand ki reels me wo gayab ho jaata,
 * bina kisi error ke.
 */
export function referencedAssetIds(doc: Doc): Set<string> {
  const used = new Set<string>();

  for (const item of doc.items) {
    if (item.assetId) used.add(item.assetId);
    if (item.mockup) {
      // Mockup ka apna asset abhi nahi hai, par mask ka ho sakta hai.
    }
    if (item.mask?.assetId) used.add(item.mask.assetId);
  }

  if (doc.brand.logoAssetId) used.add(doc.brand.logoAssetId);
  if (doc.brand.watermark.assetId) used.add(doc.brand.watermark.assetId);

  return used;
}

/**
 * Cleanup ka plan banao — **kuch mitata nahi**, sirf batata hai.
 *
 * ⚠️ Do shart, aur dono zaroori hain:
 *  1. `lifecycle === "temporary"` — permanent assets kabhi apne aap nahi jaati
 *  2. expiry beet chuki ho **aur** kisi project me na ho
 *
 * Doosri shart ka doosra hissa sabse zaroori hai. Expiry ka matlab "ab shayad
 * kisi ko chahiye nahi" hai, "ab ye kisi project me nahi hai" nahi. Ek user ne
 * temp asset ko apni reel me daal diya ho to wo asset uski reel ka hissa hai —
 * expiry beetne se wo reel toot nahi sakti.
 */
export function planCleanup(args: {
  assets: readonly LifecycleAsset[];
  /** Saare projects ke doc — **saare**, sirf ek nahi. */
  docs: readonly Doc[];
  now?: number;
}): CleanupPlan {
  const now = args.now ?? Date.now();

  /*
   * Har project se referenced ids. Ek temp asset do project me ho sakti hai
   * (duplicate karne par), aur ek me se hatane par wo doosre me abhi bhi
   * chahiye hoti hai — isliye union liya jaata hai, intersection nahi.
   */
  const used = new Set<string>();
  for (const doc of args.docs) {
    for (const id of referencedAssetIds(doc)) used.add(id);
  }

  const deletable: LifecycleAsset[] = [];
  const keptBecauseUsed: LifecycleAsset[] = [];
  const notExpired: LifecycleAsset[] = [];

  for (const asset of args.assets) {
    if (asset.lifecycle !== "temporary") continue;

    const expiresAt = asset.expiresAt ? Date.parse(asset.expiresAt) : Number.NaN;
    /*
     * Bina expiry wali temp asset ko **kabhi nahi** mitate. Wo aksar abhi bani
     * hui hoti hai (expiry set hone se pehle) — use mitana ek chalti hui upload
     * ke beech me use mita dene jaisa hai.
     */
    if (!Number.isFinite(expiresAt) || expiresAt >= now) {
      notExpired.push(asset);
      continue;
    }

    if (used.has(asset.id)) keptBecauseUsed.push(asset);
    else deletable.push(asset);
  }

  return {
    deletable,
    keptBecauseUsed,
    notExpired,
    freedBytes: deletable.reduce((sum, asset) => sum + (asset.bytes ?? 0), 0),
  };
}

/**
 * Orphan scan (20.11) — dono taraf ka mel.
 *
 * ⚠️ Ye **kuch nahi mitata**, aur mitana chahiye bhi nahi. Dono taraf ke orphan
 * alag-alag wajah se bante hain: adhoori upload, haath se delete, do machine par
 * ek saath kaam. Unme se kuch bilkul theek hote hain (jaise abhi chal rahi
 * upload). Isliye yahan sirf list banti hai; faisla insaan ka hai.
 */
export function findOrphans(args: {
  /** DB me jo rows hain. */
  assets: readonly { id: string; key: string }[];
  /** Storage me jo files hain. */
  keys: readonly string[];
}): { inStorageOnly: string[]; inDbOnly: { id: string; key: string }[] } {
  const dbKeys = new Set(args.assets.map((asset) => asset.key));
  const storageKeys = new Set(args.keys);

  return {
    inStorageOnly: args.keys.filter((key) => !dbKeys.has(key)),
    inDbOnly: args.assets.filter((asset) => !storageKeys.has(asset.key)),
  };
}
