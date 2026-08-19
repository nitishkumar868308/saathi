import type { StorageDriver, StorageDriverName } from "@reel/core/storage/types";

import { readStorageConfig, type StorageConfig } from "./config";
import { LocalStorageDriver } from "./drivers/local";
import { R2StorageDriver } from "./drivers/r2";

/**
 * @reel/storage — StorageDriver ki asli implementations.
 *
 * Contract aur key layout `@reel/core` me hain (pure TS, browser me bhi chalte
 * hain). Yahan Node ka `crypto` aur `fs` chahiye, isliye ye alag package hai —
 * studio ke server-side routes aur worker dono ise import karte hain.
 */

export * from "./assets";
export * from "./config";
export * from "./drivers/local";
export * from "./drivers/r2";
export * from "./localCopy";
export * from "./sigv4";

/**
 * Env (ya di hui config) se driver banao.
 *
 * Ek hi jagah se driver aana zaroori hai — warna kahin local aur kahin R2 chunn
 * liya jaata hai, aur upload ek jagah jaakar doosri jagah dhoondha jaata hai.
 */
export function createStorageDriver(config: StorageConfig = readStorageConfig()): StorageDriver {
  switch (config.driver) {
    case "local":
      return new LocalStorageDriver(config.local);
    case "r2":
      return new R2StorageDriver(config.r2);
    default: {
      const exhaustive: never = config.driver;
      throw new Error(`Unknown storage driver: ${String(exhaustive)}`);
    }
  }
}

export type { StorageDriver, StorageDriverName };
