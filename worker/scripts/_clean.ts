import { resolve } from "node:path";
import { createStorageDriver, readStorageConfig, requireRepoRoot } from "@reel/storage";
process.loadEnvFile(resolve(requireRepoRoot(), "studio/.env.local"));

/*
 * SIRF studio ke prefix. `documents/` aur `avatars/` app ke hain — unhe chhuna
 * nahi hai, aur isi liye list yahan haath se likhi hai, kisi loop se nahi aayi.
 */
const STUDIO = ["permanent/assets", "permanent/reels", "permanent/thumbs", "temp"];
const d = createStorageDriver({ ...readStorageConfig(), driver: "r2" });

let total = 0, bytes = 0;
for (const prefix of STUDIO) {
  const list = await d.list(prefix);
  total += list.length;
  bytes += list.reduce((sum, o) => sum + o.size, 0);
  console.log(`${prefix.padEnd(20)} ${String(list.length).padStart(4)} object`);
}
console.log(`\nkul ${total} object · ${(bytes / 1_000_000).toFixed(1)} MB`);

// App ka maal — sirf ginti, taaki saaf dikhe ki wo chhua nahi ja raha
for (const prefix of ["documents", "avatars"]) {
  console.log(`(app) ${prefix.padEnd(14)} ${String((await d.list(prefix)).length).padStart(4)} object — CHHUA NAHI JAAYEGA`);
}
