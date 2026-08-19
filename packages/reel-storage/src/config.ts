import { existsSync, readFileSync } from "node:fs";
import { dirname, isAbsolute, join, resolve } from "node:path";

import {
  StorageNotConfigured,
  isStorageDriverName,
  STORAGE_DRIVER_NAMES,
  type StorageDriverName,
} from "@reel/core/storage/types";

/**
 * Env padhne ki ekmatra jagah.
 *
 * Drivers khud `process.env` nahi chhoote — unhe config diya jaata hai. Isi wajah
 * se unhe test se chalana aasan hai (config bana ke de do) aur "kaunsi env kahan
 * padhi ja rahi hai" dhoondhne ki nautanki nahi hoti.
 */

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

export interface LocalConfig {
  /** Files yahan rehti hain: `<outputDir>/media/<key>`. */
  outputDir: string;
  /**
   * Studio ka base URL — local driver signed URL ki jagah
   * `<base>/api/local-media/<key>` deta hai.
   */
  baseUrl: string;
}

export interface StorageConfig {
  driver: StorageDriverName;
  local: LocalConfig;
  r2: R2Config;
}

export const DEFAULT_OUTPUT_DIR = "./render-out";
export const DEFAULT_LOCAL_BASE_URL = "http://localhost:3000";
export const DEFAULT_R2_BUCKET = "apkasaathi-storage";

type Env = Record<string, string | undefined>;

/**
 * Monorepo ka root dhoondho — wo package.json jisme `workspaces` hai.
 *
 * ⚠️ Ye ek asli bug ka ilaaj hai, safai nahi. `REEL_OUTPUT_DIR=./render-out`
 * har process ke apne cwd se resolve hota hai: worker repo root se chalta hai
 * (`d:/my-app/render-out`) par Next dev server `studio/` se (`d:/my-app/studio/
 * render-out`). Nateeja — worker file likhta hai aur studio usi file ko "nahi
 * mili" batata hai, aur wajah bilkul samajh nahi aati.
 *
 * Root se resolve karne par dono ek hi folder dekhte hain, chahe kahin se bhi chale.
 */
export function findRepoRoot(startDir: string = process.cwd()): string | null {
  let dir = resolve(startDir);
  for (let depth = 0; depth < 12; depth += 1) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf8")) as { workspaces?: unknown };
        if (pkg.workspaces) return dir;
      } catch {
        // Toota package.json — ignore karo aur upar chalte raho.
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/**
 * Repo root — na mile to saaf error.
 *
 * Worker ko Remotion ka entry file dhoondhna hota hai; usko cwd par chhodna
 * matlab "kis folder se chalaya" par nirbhar ho jaana, jo hamesha kisi din tootta hai.
 */
export function requireRepoRoot(startDir: string = process.cwd()): string {
  const root = findRepoRoot(startDir);
  if (!root) {
    throw new Error(
      `Repo root nahi mila (${startDir} se upar koi package.json with "workspaces" nahi). ` +
        `Command repo ke andar se chalao.`,
    );
  }
  return root;
}

/** Relative output dir ko hamesha repo root se resolve karo, cwd se nahi. */
export function resolveOutputDir(raw: string, cwd: string = process.cwd()): string {
  if (isAbsolute(raw)) return raw;
  return resolve(findRepoRoot(cwd) ?? cwd, raw);
}

/**
 * Env se config banao.
 *
 * Galat `REEL_STORAGE_DRIVER` par yahin saaf error milta hai. Chupchaap local par
 * gir jaana sabse buri baat hoti — tumhe lagta ki R2 par chadh raha hai aur file
 * asal me tumhare hi disk par padi hoti.
 */
export function readStorageConfig(env: Env = process.env): StorageConfig {
  const raw = (env.REEL_STORAGE_DRIVER ?? "local").trim();
  if (!isStorageDriverName(raw)) {
    throw new Error(
      `REEL_STORAGE_DRIVER="${raw}" theek nahi. Allowed: ${STORAGE_DRIVER_NAMES.join(" | ")}`,
    );
  }

  return {
    driver: raw,
    local: {
      outputDir: resolveOutputDir(env.REEL_OUTPUT_DIR?.trim() || DEFAULT_OUTPUT_DIR),
      baseUrl: (env.REEL_LOCAL_MEDIA_BASE_URL?.trim() || DEFAULT_LOCAL_BASE_URL).replace(
        /\/+$/,
        "",
      ),
    },
    r2: {
      accountId: env.R2_ACCOUNT_ID?.trim() ?? "",
      accessKeyId: env.R2_ACCESS_KEY_ID?.trim() ?? "",
      secretAccessKey: env.R2_SECRET_ACCESS_KEY?.trim() ?? "",
      bucket: env.R2_BUCKET?.trim() || DEFAULT_R2_BUCKET,
    },
  };
}

/** R2 ki chaaron keys maujood hain? */
export function r2Configured(config: R2Config): boolean {
  return Boolean(
    config.accountId && config.accessKeyId && config.secretAccessKey && config.bucket,
  );
}

export function assertR2Configured(config: R2Config): void {
  if (r2Configured(config)) return;
  const missing: string[] = [];
  if (!config.accountId) missing.push("R2_ACCOUNT_ID");
  if (!config.accessKeyId) missing.push("R2_ACCESS_KEY_ID");
  if (!config.secretAccessKey) missing.push("R2_SECRET_ACCESS_KEY");
  if (!config.bucket) missing.push("R2_BUCKET");
  throw new StorageNotConfigured("r2", missing);
}

/**
 * Extension se content-type.
 *
 * Chhoti si list jaan-boojhkar — `mime` package add karne ka koi matlab nahi
 * jab humein sirf wahi types chahiye jo editor sach me sambhalta hai.
 */
const MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  svg: "image/svg+xml",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  m4a: "audio/mp4",
  aac: "audio/aac",
  ogg: "audio/ogg",
  opus: "audio/opus",
  flac: "audio/flac",
  woff2: "font/woff2",
  ttf: "font/ttf",
  otf: "font/otf",
  json: "application/json",
  srt: "application/x-subrip",
  vtt: "text/vtt",
};

export function mimeFromKey(key: string): string {
  const at = key.lastIndexOf(".");
  if (at === -1) return "application/octet-stream";
  return MIME_BY_EXT[key.slice(at + 1).toLowerCase()] ?? "application/octet-stream";
}
