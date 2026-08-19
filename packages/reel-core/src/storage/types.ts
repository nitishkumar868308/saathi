/**
 * `StorageDriver` — media kahan rehta hai, iska ekmatra contract.
 *
 * Do implementations hain (`@reel/storage` me):
 *  - **local** — files disk par, `REEL_OUTPUT_DIR/media` me. Internet ke bina
 *    kaam karta hai, upload instant hai, aur galti se kuch delete ho jaaye to
 *    sirf tumhare apne folder me hua. Dev ke liye yahi default hai.
 *  - **r2** — Cloudflare R2. Asli storage, free tier 10GB + free egress.
 *
 * Interface hone ka faayda ye hai ki studio aur worker dono ye nahi jaante ki
 * neeche kya chal raha hai. Env me `REEL_STORAGE_DRIVER` badlo, aur poora
 * codebase waisa ka waisa chalta rehta hai.
 *
 * Ye file pure TypeScript hai — koi Node import nahi (`@reel/core` browser me bhi
 * chalta hai). Asli kaam karne wale drivers alag package me hain.
 */

export interface SignedUploadTarget {
  /** Client seedha isi URL par PUT karega. */
  url: string;
  method: "PUT";
  /** Ye headers bhejne hi padenge — content-type sign me bandha hota hai. */
  headers: Record<string, string>;
  key: string;
  /** ISO timestamp — iske baad URL bekaar. */
  expiresAt: string;
}

export interface StorageObjectInfo {
  key: string;
  /** Bytes. */
  size: number;
  contentType: string | null;
}

export interface SignedUrlOptions {
  /** Seconds. Driver isko apni chhat (R2 me 7 din) par clamp karta hai. */
  expiresIn?: number;
  /** Browser ko file is naam se save karne ko kaho. */
  downloadName?: string;
}

export interface StorageDriver {
  /** `"local"` ya `"r2"` — logs aur error messages ke liye. */
  readonly name: StorageDriverName;

  /**
   * Browser ko seedha upload karne ka URL do.
   *
   * Bytes kabhi studio ke server se hokar nahi jaate — 200MB ka video Next
   * route handler se guzarna matlab memory bhi aur waqt bhi dono bekaar.
   */
  putSigned(key: string, mime: string, options?: SignedUrlOptions): Promise<SignedUploadTarget>;

  /** Padhne ka chhoti umar wala URL (preview, download button, worker ka fetch). */
  getSignedUrl(key: string, options?: SignedUrlOptions): Promise<string>;

  /** Server-side upload — worker ka final MP4 isi se chadhta hai. */
  put(key: string, data: Uint8Array, mime?: string): Promise<void>;

  /** Bytes wapas. Na mile to `null` (throw nahi — "hai hi nahi" koi error nahi hai). */
  get(key: string): Promise<Uint8Array | null>;

  /** Hata do. Pehle se na ho to bhi `true` — delete idempotent hai. */
  delete(key: string): Promise<boolean>;

  /**
   * Hai ya nahi, aur hai to kitna bada.
   *
   * ⚠️ Presigned PUT me upload ki size par koi rok lagayi hi nahi ja sakti,
   * isliye client ki batayi hui size par bharosa bekaar hai. Upload ke **baad**
   * yahan se poochhna hi ekmatra sachcha jawab hai.
   */
  exists(key: string): Promise<StorageObjectInfo | null>;
}

export const STORAGE_DRIVER_NAMES = ["local", "r2"] as const;
export type StorageDriverName = (typeof STORAGE_DRIVER_NAMES)[number];

export function isStorageDriverName(value: string): value is StorageDriverName {
  return (STORAGE_DRIVER_NAMES as readonly string[]).includes(value);
}

export class StorageNotConfigured extends Error {
  constructor(driver: string, missing: readonly string[]) {
    super(
      `Storage driver "${driver}" set nahi hai — ye env vars chahiye: ${missing.join(", ")}`,
    );
    this.name = "StorageNotConfigured";
  }
}
