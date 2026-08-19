import {
  assetKindForFile,
  extensionOf,
  storageKey,
  temporaryExpiryIso,
  type AssetLifecycle,
} from "@reel/core";

import { restJson, restOne, SupabaseError } from "@/lib/supabase";

/**
 * `reel_assets` ka data layer — server side.
 *
 * **Ek vaada is file me sabse zaroori hai: DB me sirf wo asset hai jo storage me
 * sach me maujood hai.** Isliye row upload ke *baad* banti hai (`presign` sirf
 * id aur key deta hai, row nahi). Client beech me mar jaaye to sirf ek anaath
 * file rehti hai — DB saaf rehta hai. Ulta karne par library me aisi entry aa
 * jaati jo khulti hi nahi, aur wo galti sabse zyada chidhati hai.
 *
 * ⚠️ `bytes` client ke bataye hue naap se nahi, **storage se poochh kar** likhi
 * jaati hai (`StorageDriver.exists`). Presigned PUT me size par koi rok lag hi
 * nahi sakti, isliye client ka number sirf ek daawa hai.
 */

export interface AssetRow {
  id: string;
  kind: string;
  r2_key: string;
  filename: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  fps: number | null;
  sample_rate: number | null;
  channels: number | null;
  lifecycle: AssetLifecycle;
  expires_at: string | null;
  checksum: string | null;
  meta: Record<string, unknown>;
  tags: string[];
  created_at: string;
}

/** UI ko jo shape chahiye — camelCase, aur bina DB ke naam ke. */
export interface Asset {
  id: string;
  kind: string;
  key: string;
  filename: string;
  mime: string;
  bytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  fps: number | null;
  sampleRate: number | null;
  channels: number | null;
  lifecycle: AssetLifecycle;
  expiresAt: string | null;
  checksum: string | null;
  meta: Record<string, unknown>;
  tags: string[];
  createdAt: string;
  /** `meta.thumbKey` — thumbnail bana ho to. */
  thumbKey: string | null;
}

const TABLE = "reel_assets";

export function toAsset(row: AssetRow): Asset {
  const meta = row.meta ?? {};
  const thumbKey = typeof meta.thumbKey === "string" ? meta.thumbKey : null;
  return {
    id: row.id,
    kind: row.kind,
    key: row.r2_key,
    filename: row.filename,
    mime: row.mime,
    bytes: Number(row.bytes ?? 0),
    width: row.width,
    height: row.height,
    durationMs: row.duration_ms,
    fps: row.fps === null ? null : Number(row.fps),
    sampleRate: row.sample_rate,
    channels: row.channels,
    lifecycle: row.lifecycle,
    expiresAt: row.expires_at,
    checksum: row.checksum,
    meta,
    tags: row.tags ?? [],
    createdAt: row.created_at,
    thumbKey,
  };
}

export interface ListAssetsQuery {
  /** ASSET_KINDS ke id. Khaali = sab. */
  kinds?: readonly string[];
  /** Asset ke `tags` me ye hona chahiye. */
  tag?: string | null;
  /** filename me ye shabd. */
  search?: string | null;
  sort?: "recent" | "name" | "size";
  limit?: number;
}

export const ASSET_LIST_LIMIT = 500;

export async function listAssets(query: ListAssetsQuery = {}): Promise<Asset[]> {
  const params = new URLSearchParams();
  params.set("select", "*");

  if (query.kinds && query.kinds.length > 0) {
    params.set("kind", `in.(${query.kinds.join(",")})`);
  }
  if (query.tag) {
    // PostgREST ka array-contains: `tags=cs.{music}`.
    params.set("tags", `cs.{${query.tag}}`);
  }
  if (query.search?.trim()) {
    // `*` PostgREST me wildcard hai; user ke `%` ko wahin rok dete hain warna
    // wo query ka matlab badal deta hai.
    const needle = query.search.trim().replace(/[%*,()]/g, " ");
    params.set("filename", `ilike.*${needle}*`);
  }

  const order =
    query.sort === "name"
      ? "filename.asc"
      : query.sort === "size"
        ? "bytes.desc"
        : "created_at.desc";
  params.set("order", order);
  params.set("limit", String(Math.min(query.limit ?? ASSET_LIST_LIMIT, ASSET_LIST_LIMIT)));

  const rows = await restJson<AssetRow>(`${TABLE}?${params.toString()}`);
  return rows.map(toAsset);
}

export async function getAsset(id: string): Promise<Asset | null> {
  const row = await restOne<AssetRow>(`${TABLE}?id=eq.${encodeURIComponent(id)}&select=*`);
  return row ? toAsset(row) : null;
}

export async function findAssetByChecksum(checksum: string): Promise<Asset | null> {
  const row = await restOne<AssetRow>(
    `${TABLE}?checksum=eq.${encodeURIComponent(checksum)}&select=*&order=created_at.asc&limit=1`,
  );
  return row ? toAsset(row) : null;
}

export interface CreateAssetInput {
  id: string;
  filename: string;
  mime: string;
  bytes: number;
  checksum?: string | null;
  /** Browser ne upload se pehle jo naapa — probe aane tak yahi dikhta hai. */
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  fps?: number | null;
  lifecycle?: AssetLifecycle;
  tags?: readonly string[];
  meta?: Record<string, unknown>;
}

/**
 * Row banao (upload confirm hone ke baad).
 *
 * `lifecycle` ka faisla yahin hota hai: user ka upload hamesha `permanent`,
 * aur humara banaya hua maal (TTS, render ka beech ka hissa — Phase 22+)
 * `temporary` + `expires_at`. Do lifecycle rakhne ki poori wajah yahi hai ki
 * cleanup script kabhi kisi ki asli file ke paas na jaaye.
 */
export async function createAsset(input: CreateAssetInput): Promise<Asset> {
  const kind = assetKindForFile(input.mime, input.filename);
  if (!kind) {
    throw new Error(`"${input.filename}" (${input.mime}) kis kism ki file hai, pata nahi chala`);
  }

  const lifecycle: AssetLifecycle = input.lifecycle ?? "permanent";
  const row = await restOne<AssetRow>(TABLE, {
    method: "POST",
    prefer: "return=representation",
    body: {
      id: input.id,
      kind: kind.id,
      r2_key: assetKey(input.id, input.filename),
      filename: input.filename,
      mime: input.mime,
      bytes: input.bytes,
      width: input.width ?? null,
      height: input.height ?? null,
      duration_ms: input.durationMs ?? null,
      fps: input.fps ?? null,
      lifecycle,
      expires_at: lifecycle === "temporary" ? temporaryExpiryIso(Date.now()) : null,
      checksum: input.checksum ?? null,
      tags: [...(input.tags ?? [])],
      meta: input.meta ?? {},
    },
  });
  if (!row) throw new SupabaseError("Asset insert se koi row wapas nahi aayi", 500, "");
  return toAsset(row);
}

export interface UpdateAssetInput {
  filename?: string;
  tags?: readonly string[];
  width?: number | null;
  height?: number | null;
  durationMs?: number | null;
  fps?: number | null;
  sampleRate?: number | null;
  channels?: number | null;
  bytes?: number;
  meta?: Record<string, unknown>;
}

export async function updateAsset(id: string, patch: UpdateAssetInput): Promise<Asset | null> {
  const body: Record<string, unknown> = {};
  if (patch.filename !== undefined) body.filename = patch.filename;
  if (patch.tags !== undefined) body.tags = [...patch.tags];
  if (patch.width !== undefined) body.width = patch.width;
  if (patch.height !== undefined) body.height = patch.height;
  if (patch.durationMs !== undefined) body.duration_ms = patch.durationMs;
  if (patch.fps !== undefined) body.fps = patch.fps;
  if (patch.sampleRate !== undefined) body.sample_rate = patch.sampleRate;
  if (patch.channels !== undefined) body.channels = patch.channels;
  if (patch.bytes !== undefined) body.bytes = patch.bytes;
  if (patch.meta !== undefined) body.meta = patch.meta;

  if (Object.keys(body).length === 0) return getAsset(id);

  const rows = await restJson<AssetRow>(`${TABLE}?id=eq.${encodeURIComponent(id)}&select=*`, {
    method: "PATCH",
    prefer: "return=representation",
    body,
  });
  return rows[0] ? toAsset(rows[0]) : null;
}

export async function deleteAssetRow(id: string): Promise<boolean> {
  const rows = await restJson<{ id: string }>(
    `${TABLE}?id=eq.${encodeURIComponent(id)}&select=id`,
    { method: "DELETE", prefer: "return=representation" },
  );
  return rows.length > 0;
}

/** Storage key hamesha `@reel/core` se banti hai, haath se kabhi nahi. */
export function assetKey(id: string, filename: string): string {
  return storageKey.asset(id, extensionOf(filename));
}

/** Thumbnail ki key asset id se **tay** hai — iske liye DB me column ki zaroorat nahi. */
export function assetThumbKey(id: string): string {
  return storageKey.thumbnail(id);
}

/* ------------------------------------------------------------- usage check */

export interface AssetUsage {
  projectId: string;
  projectName: string;
  itemCount: number;
}

/**
 * Ye asset kis-kis project me laga hua hai?
 *
 * Delete se pehle yahi poochha jaata hai. Sirf "use ho raha hai" bata dena kaafi
 * nahi — **kahan** use ho raha hai, wo bhi chahiye, warna user ko har project
 * khol kar dhoondhna padta hai.
 *
 * Query jsonb containment se chalti hai (`doc->items @> [{"assetId": "..."}]`),
 * jiske liye `supabase/reel-studio-assets.sql` me GIN index bana hua hai.
 */
export async function findAssetUsage(assetId: string): Promise<AssetUsage[]> {
  const filter = encodeURIComponent(JSON.stringify([{ assetId }]));
  const rows = await restJson<{ id: string; name: string; items: { assetId: string | null }[] }>(
    `reel_projects?select=id,name,items:doc->items&doc->items=cs.${filter}&limit=50`,
  );

  return rows.map((row) => ({
    projectId: row.id,
    projectName: row.name,
    itemCount: (row.items ?? []).filter((item) => item.assetId === assetId).length,
  }));
}
