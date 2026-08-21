"use client";

/**
 * Library se timeline tak asset le jaane ka **ek hi raasta** (16.3).
 *
 * ⚠️ Yahan sirf do function hain aur dono ek hi cheez ke do sire hain: kaun sa
 * data drag me jaata hai, aur use kaise padha jaata hai. Do jagah `setData` /
 * `getData` likhne par ek din key badal jaati hai aur drop chup-chaap kuch nahi
 * karta — koi error nahi, bas kuch hota hi nahi. Wahi is file ki wajah hai.
 *
 * ⚠️ Payload me **kind bhi** jaata hai, sirf id nahi. `dragover` ke waqt lane ko
 * bataana hota hai ki ye chalega ya nahi, aur us waqt asset ka poora record
 * haath me nahi hota — sirf wahi jo `dataTransfer` me rakha tha. Browser
 * `dragover` par payload **padhne nahi deta** (sirf type dikhta hai), isliye
 * kind ko **type ke andar** hi likha jaata hai.
 */

/** MIME jaisa type — kind isi ke andar hai taaki `dragover` par bhi padha ja sake. */
export const ASSET_DRAG_PREFIX = "application/x-reel-asset+";

export interface AssetDragPayload {
  assetId: string;
  kind: string;
  filename: string;
  durationMs: number | null;
}

export function setAssetDragData(event: React.DragEvent, payload: AssetDragPayload): void {
  const type = `${ASSET_DRAG_PREFIX}${payload.kind}`;
  event.dataTransfer.setData(type, JSON.stringify(payload));
  // Kuch browser sirf `text/plain` dete hain agar aur kuch na ho — ye fallback
  // sirf isliye hai ki drag "kuch bhi nahi" jaisa na lage.
  event.dataTransfer.setData("text/plain", payload.filename);
  event.dataTransfer.effectAllowed = "copy";
}

/**
 * `dragover` ke waqt sirf itna pata chalta hai: is drag me asset hai kya, aur
 * kis kism ka. Poora payload yahan **nahi** milta — wo browser ki rok hai,
 * hamari nahi.
 */
export function assetKindFromDrag(event: React.DragEvent): string | null {
  for (const type of event.dataTransfer.types) {
    if (type.startsWith(ASSET_DRAG_PREFIX)) return type.slice(ASSET_DRAG_PREFIX.length);
  }
  return null;
}

/** `drop` ke waqt poora payload. */
export function readAssetDrag(event: React.DragEvent): AssetDragPayload | null {
  const kind = assetKindFromDrag(event);
  if (!kind) return null;
  try {
    const raw = event.dataTransfer.getData(`${ASSET_DRAG_PREFIX}${kind}`);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<AssetDragPayload>;
    if (typeof data.assetId !== "string" || typeof data.kind !== "string") return null;
    return {
      assetId: data.assetId,
      kind: data.kind,
      filename: typeof data.filename === "string" ? data.filename : "asset",
      durationMs: typeof data.durationMs === "number" ? data.durationMs : null,
    };
  } catch {
    return null;
  }
}
