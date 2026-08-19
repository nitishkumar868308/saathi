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
  return resolve(storageConfig().local.outputDir, "tmp");
}

export { scratchPath, withLocalFile };
