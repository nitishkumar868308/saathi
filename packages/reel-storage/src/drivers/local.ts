import type { Dirent } from "node:fs";
import { mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";

import { assertValidKey } from "@reel/core/storage/keys";
import type {
  SignedUploadTarget,
  SignedUrlOptions,
  StorageDriver,
  StorageObjectInfo,
} from "@reel/core/storage/types";

import { mimeFromKey, type LocalConfig } from "../config";

/**
 * Local disk driver — dev ka default.
 *
 * Files `<REEL_OUTPUT_DIR>/media/<key>` par baithti hain. Faayde jo asli hain:
 * internet ke bina chalta hai, upload me network ka intezaar nahi, aur galti se
 * kuch mit jaaye to sirf tumhare apne folder me — kisi bucket me nahi.
 *
 * "Signed URL" yahan sach me signed nahi hota (kis se sign karein?) — uski jagah
 * studio ka `/api/local-media/<key>` route milta hai. Wo route jaan-boojhkar
 * sirf tabhi chalta hai jab driver local ho, aur wo bhi localhost par.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = "local" as const;

  /** `<outputDir>/media` — poora absolute path, ek hi baar hisaab hota hai. */
  private readonly root: string;
  private readonly baseUrl: string;

  constructor(config: LocalConfig) {
    this.root = resolve(config.outputDir, "media");
    this.baseUrl = config.baseUrl;
  }

  /** Debug/logs ke liye — files kahan padi hain. */
  rootDir(): string {
    return this.root;
  }

  private pathFor(key: string): string {
    return resolveLocalMediaPath(this.root, key);
  }

  private urlFor(key: string): string {
    assertValidKey(key);
    return `${this.baseUrl}/api/local-media/${key}`;
  }

  async putSigned(
    key: string,
    mime: string,
    options: SignedUrlOptions = {},
  ): Promise<SignedUploadTarget> {
    const expiresIn = options.expiresIn ?? 300;
    return {
      url: this.urlFor(key),
      method: "PUT",
      headers: { "content-type": mime },
      key,
      // Local URL ki koi asli umar nahi hoti; ye field sirf isliye bhara jaata
      // hai ki caller ko dono driver ek jaise dikhein.
      expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
    };
  }

  async getSignedUrl(key: string, options: SignedUrlOptions = {}): Promise<string> {
    const url = this.urlFor(key);
    if (!options.downloadName) return url;
    return `${url}?download=${encodeURIComponent(options.downloadName)}`;
  }

  async put(key: string, data: Uint8Array): Promise<void> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data);
  }

  async get(key: string): Promise<Uint8Array | null> {
    try {
      const buffer = await readFile(this.pathFor(key));
      return new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async delete(key: string): Promise<boolean> {
    // `force: true` na hone par missing file throw karti hai — par delete ko
    // idempotent rakhna hi theek hai, warna har caller try/catch likhta.
    await rm(this.pathFor(key), { force: true });
    return true;
  }

  async exists(key: string): Promise<StorageObjectInfo | null> {
    try {
      const info = await stat(this.pathFor(key));
      if (!info.isFile()) return null;
      return { key, size: info.size, contentType: mimeFromKey(key) };
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  async list(prefix: string): Promise<StorageObjectInfo[]> {
    const root = this.pathFor("");
    const out: StorageObjectInfo[] = [];

    // Prefix ke andar poori gehrai tak — assets nested folders me hote hain.
    const walk = async (dir: string): Promise<void> => {
      let entries: Dirent[];
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        // Folder hai hi nahi — "kuch nahi mila" koi error nahi hai.
        return;
      }
      for (const entry of entries) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
          continue;
        }
        const key = relative(root, full).split(sep).join("/");
        if (!key.startsWith(prefix)) continue;
        const info = await stat(full);
        out.push({ key, size: info.size, contentType: null });
      }
    };

    await walk(root);
    return out;
  }
}

function isNotFound(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

/** Studio ke route ko bhi wahi root chahiye — hisaab dobara na likhna pade. */
export function localMediaRoot(config: LocalConfig): string {
  return resolve(config.outputDir, "media");
}

/**
 * Key -> disk path, root ke andar hi.
 *
 * ⚠️ Do deewaarein hain aur dono zaroori hain. `assertValidKey` `..` aur
 * backslash pehle hi rok deta hai; uske baad bhi resolve karke jaancha jaata
 * hai ki nateeja root ke andar hi hai. Ek hi deewar par bharosa karna wahi
 * galti hai jisse "koi bhi file padh lo" wala bug banta hai.
 *
 * Driver aur studio ka `/api/local-media` route — dono yahi function use karte
 * hain, taaki dono jagah ki safety kabhi alag na ho jaaye.
 */
export function resolveLocalMediaPath(root: string, key: string): string {
  assertValidKey(key);
  const full = resolve(root, ...key.split("/"));
  if (full !== root && !full.startsWith(root + sep)) {
    throw new Error(`Storage key "${key}" root ke bahar ja rahi hai — mana hai`);
  }
  return full;
}
