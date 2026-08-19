import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import type { StorageDriver } from "@reel/core/storage/types";

import { LocalStorageDriver, resolveLocalMediaPath } from "./drivers/local";

/**
 * "Is key ki file ka disk par path do" — ffprobe/ffmpeg ke liye.
 *
 * FFmpeg URL se bhi padh leta hai, par uspar bharosa nahi kiya ja sakta:
 * presigned URL beech me expire ho jaata hai, aur ek network hichki poore probe
 * ko gira deti hai. File saamne ho to jawab hamesha ek jaisa aata hai.
 *
 * Do raaste, aur pehla hi asli faayda hai:
 *  - **local driver**: file pehle se disk par hai — koi copy nahi, koi kharcha nahi.
 *  - **r2**: ek baar utaari jaati hai `temp/` me, kaam ke baad mit jaati hai.
 *
 * `finally` me safai isliye hai ki probe fail hone par bhi kachra na bache —
 * warna ek din `render-out/tmp` gigabytes ka mila milta hai aur wajah koi nahi
 * jaanta.
 */

export interface LocalCopyOptions {
  /** Utaari hui file ka extension (ffmpeg container isi se pehchanta hai). */
  extension?: string | null;
  /** R2 se utaarne par file yahan banegi. Default `<outputDir>/tmp`. */
  scratchDir: string;
}

export async function withLocalFile<T>(
  storage: StorageDriver,
  key: string,
  options: LocalCopyOptions,
  use: (path: string) => Promise<T>,
): Promise<T> {
  if (storage instanceof LocalStorageDriver) {
    // Wahi function jo driver khud use karta hai — isliye path ki safety dono
    // jagah ek hi jagah se aati hai.
    return use(resolveLocalMediaPath(storage.rootDir(), key));
  }

  const bytes = await storage.get(key);
  if (bytes === null) throw new Error(`Storage me "${key}" nahi mili`);

  await mkdir(options.scratchDir, { recursive: true });
  const name = `${Date.now().toString(36)}-${Math.round(Math.random() * 1e6).toString(36)}${
    options.extension ? `.${options.extension}` : ""
  }`;
  const path = resolve(options.scratchDir, name);

  await writeFile(path, bytes);
  try {
    return await use(path);
  } finally {
    await rm(path, { force: true });
  }
}

/** Kaam ke beech me banne wali file ka path (thumbnail waghera). */
export async function scratchPath(scratchDir: string, name: string): Promise<string> {
  await mkdir(scratchDir, { recursive: true });
  return resolve(scratchDir, name);
}
