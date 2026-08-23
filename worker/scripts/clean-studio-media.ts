/**
 * Studio ka poora media saaf karo — R2 se aur DB se (26.20).
 *
 * ```
 * npm run clean:studio --workspace @reel/worker             # sirf dikhata hai
 * npm run clean:studio --workspace @reel/worker -- --yes    # sach me mitata hai
 * ```
 *
 * ⚠️ **Ye bucket app ke saath saanjha hai, aur wahi is script ka sabse zaroori
 * hissa hai.** Usi bucket me user ke documents aur avatars pade hain — asli
 * cheezein, jo dobara nahi aayengi. Isliye yahan prefix ki list **haath se likhi
 * hai**, kisi loop ya "sab kuch" se nahi aayi, aur mitane se pehle har key par
 * ek aur jaanch lagti hai ki wo `documents/` ya `avatars/` ki to nahi.
 *
 * Do jaanchein isliye ki ek din koi is list me `""` ya `"/"` daal de — aur us
 * galti ka pata mitne ke baad chalta hai.
 *
 * ⚠️ Default me ye **kuch nahi mitata**. `--yes` likhna padta hai. Bulk delete
 * ka default kabhi "kar do" nahi hona chahiye.
 *
 * ── Kab chalti hai ──────────────────────────────────────────────────────
 *
 * Jab library me aisi rows bhar jaayein jinki file kabhi chadhi hi nahi (wo daur
 * jab R2 par CORS set nahi tha: row banti thi, PUT block hota tha). Naya sirey se
 * shuru karna aksar unhe ek-ek theek karne se saaf hota hai.
 */

import { resolve } from "node:path";

import { createStorageDriver, readStorageConfig, requireRepoRoot } from "@reel/storage";

process.loadEnvFile(resolve(requireRepoRoot(), "studio/.env.local"));

/** Sirf ye — aur ye list haath se likhi hai. */
const STUDIO_PREFIXES = [
  "permanent/assets",
  "permanent/reels",
  "permanent/thumbs",
  "temp",
] as const;

/** Ye kabhi nahi — chahe list me galti se aa bhi jaayein. */
const NEVER = ["documents/", "avatars/"] as const;

const STUDIO_TABLES = ["reel_assets", "reel_render_jobs"] as const;

const live = process.argv.includes("--yes");
const driver = createStorageDriver({ ...readStorageConfig(), driver: "r2" });

function isProtected(key: string): boolean {
  return NEVER.some((prefix) => key.startsWith(prefix));
}

async function main(): Promise<void> {
  console.log(live ? "MITAYA JAAYEGA\n" : "Sirf dikhaya ja raha hai (--yes se sach me mitega)\n");

  let count = 0;
  let bytes = 0;
  let skipped = 0;

  for (const prefix of STUDIO_PREFIXES) {
    const objects = await driver.list(prefix);
    for (const object of objects) {
      if (isProtected(object.key)) {
        skipped += 1;
        continue;
      }
      count += 1;
      bytes += object.size;
      if (live) await driver.delete(object.key);
    }
    console.log(`  ${prefix.padEnd(20)} ${String(objects.length).padStart(4)} object`);
  }

  console.log(
    `\nR2: ${count} object · ${(bytes / 1_000_000).toFixed(1)} MB${live ? " hataye" : " hatenge"}` +
      (skipped > 0 ? ` (${skipped} app ke the — chhode gaye)` : ""),
  );

  /* ------------------------------------------------------------------ DB */

  const url = (process.env.SUPABASE_URL ?? "").replace(/\/+$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY nahi mile.");

  const headers = { apikey: key, authorization: `Bearer ${key}`, prefer: "return=representation" };

  for (const table of STUDIO_TABLES) {
    if (!live) {
      const rows = await (
        await fetch(`${url}/rest/v1/${table}?select=id`, { headers })
      ).json();
      console.log(`  ${table.padEnd(20)} ${Array.isArray(rows) ? rows.length : 0} row hatenge`);
      continue;
    }
    /*
     * ⚠️ `id=not.is.null` jaan-boojhkar hai. PostgREST bina kisi filter ke DELETE
     * mana kar deta hai — aur wo rok theek hai. Filter likhna padna hi wo ek
     * lamha hai jisme aadmi ruk kar sochta hai ki wo kaunsi table hai.
     */
    const response = await fetch(`${url}/rest/v1/${table}?id=not.is.null&select=id`, {
      method: "DELETE",
      headers,
    });
    const rows = await response.json();
    console.log(`  ${table.padEnd(20)} ${Array.isArray(rows) ? rows.length : 0} row hataye`);
  }

  /*
   * Aakhir me app ka maal gin kar dikhana — taaki saaf dikhe ki wo bacha hua hai.
   * "Nahi chhua" likh dena aasan hai; gin kar dikhana saboot hai.
   */
  console.log("");
  for (const prefix of ["documents", "avatars"]) {
    const list = await driver.list(prefix);
    console.log(`  (app) ${prefix.padEnd(14)} ${String(list.length).padStart(4)} object — bache hue hain`);
  }

  if (!live) console.log("\nSach me mitane ke liye dobara chalao, `-- --yes` ke saath.");
}

void main().catch((error: unknown) => {
  console.error(`safai ruk gayi: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
