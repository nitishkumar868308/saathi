import { tmpdir } from "node:os";
import { resolve } from "node:path";

import {
  createStorageDriver,
  readStorageConfig,
  scratchPath,
  withLocalFile,
  type StorageConfig,
} from "@reel/storage";
import type { StorageDriver } from "@reel/core";

/**
 * Studio ke server routes ke liye storage driver — ek hi baar banta hai.
 *
 * Har request par naya driver banane se do dikkat hoti: R2 ka config baar-baar
 * padha jaata, aur "kaunsa driver chal raha hai" ka jawab request-dar-request
 * badal sakta tha (env dev me badal jaaye to). Ek baar banakar rakhne se poora
 * process ek hi baat kehta hai.
 */

let cached: { driver: StorageDriver; config: StorageConfig } | null = null;

export function storage(): StorageDriver {
  if (!cached) {
    const config = readStorageConfig();
    cached = { driver: createStorageDriver(config), config };
  }
  return cached.driver;
}

export function storageConfig(): StorageConfig {
  if (!cached) storage();
  return (cached as { config: StorageConfig }).config;
}

/**
 * ffprobe/ffmpeg ka beech ka maal yahan banta hai — `<REEL_OUTPUT_DIR>/tmp`.
 *
 * `render-out/` gitignored hai, isliye ye kachra repo me kabhi nahi aata.
 */
export function scratchDir(): string {
  /*
   * WARNING: Ye pehle `<REEL_OUTPUT_DIR>/tmp` tha, aur wo Vercel par TTS ko poori
   * tarah tod deta tha:
   *
   *     ENOENT: no such file or directory, mkdir '/var/task/render-out'
   *
   * `REEL_OUTPUT_DIR=./render-out` repo root se resolve hota hai, aur serverless
   * me repo root `/var/task` hai - jo **read-only** hai. Yaani awaaz banane ki
   * har koshish wahin mar jaati thi, aur error aisa dikhta tha jaise TTS ka
   * masla ho, jabki masla sirf ek folder ka tha.
   *
   * Ab hamesha OS ka apna temp folder. Scratch hai hi phenkne ke liye - use
   * project ke folder se baandhne ki koi wajah kabhi thi hi nahi, aur us bandhan
   * ka ek hi nateeja nikla.
   */
  return resolve(tmpdir(), "reel-studio-scratch");
}

export { scratchPath, withLocalFile };
