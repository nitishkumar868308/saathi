/**
 * Local disk par padi saari media R2 par chadha do (25.6).
 *
 * ```
 * npx tsx worker/scripts/migrate-local-to-r2.ts --dry-run
 * npx tsx worker/scripts/migrate-local-to-r2.ts
 * npx tsx worker/scripts/migrate-local-to-r2.ts --env-file=studio/.env.local
 * ```
 *
 * ── Ye script kyun bani ────────────────────────────────────────────────
 *
 * ⚠️ Cloud worker par jaate hi ek baat badal jaati hai jo kahin likhi hui nahi
 * thi: **asset ab GitHub ke runner ko dikhne chahiye.**
 *
 * Ab tak studio `REEL_STORAGE_DRIVER=local` par chal rahi thi, yaani har upload
 * `render-out/media/` me — tumhare apne disk par. Local worker ke liye wo bilkul
 * theek tha, wo usi machine par tha. Runner us disk ko kabhi nahi dekh sakta.
 *
 * Aur ye khaami sabse buri shakl me saamne aati hai: job queue me chali jaati
 * hai, runner uth jaata hai, npm ci chalti hai, Chrome utarta hai — aur uske
 * baad "asset nahi mili" par render marta hai. Do minute aur poora setup, sirf
 * ye pata karne ke liye ki file kabhi wahan thi hi nahi.
 *
 * ⚠️ Sirf `REEL_STORAGE_DRIVER=r2` kar dena kaafi **nahi** hai. Wo sirf aage ke
 * upload ka rasta badalta hai; jo purani files disk par pada hai wo wahin pada
 * rehta hai, aur DB me uska `r2_key` maujood hone ki wajah se sab kuch theek
 * dikhta rehta hai. Purana maal khud chadhana padta hai — yahi wo kaam hai.
 *
 * ── Ye script kya NAHI karti ───────────────────────────────────────────
 *
 * Local se kuch delete nahi karti. Migration ke baad file dono jagah rehti hai,
 * aur ye jaan-boojhkar hai: ek galat migration ke baad local copy hi wo cheez
 * hai jisse sab wapas laaya ja sakta hai. Tasalli ho jaane ke baad `render-out/`
 * haath se hata dena.
 */

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

import { storageKey } from "@reel/core";
import { createStorageDriver, readStorageConfig, requireRepoRoot, r2Configured } from "@reel/storage";

/* ------------------------------------------------------------------ setup */

function loadEnvFile(explicit: string | null): string | null {
  const root = requireRepoRoot();
  // ⚠️ `studio/.env.local` bhi list me hai — R2 ki keys aksar sirf wahin hoti
  // hain, kyunki upload studio karti hai, worker nahi.
  const candidates = explicit ? [explicit] : ["worker/.env", ".env", "studio/.env.local"];
  for (const candidate of candidates) {
    const path = isAbsolute(candidate) ? candidate : resolve(root, candidate);
    if (!existsSync(path)) continue;
    process.loadEnvFile(path);
    return path;
  }
  if (explicit) throw new Error(`--env-file="${explicit}" mila nahi`);
  return null;
}

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const envFileArg = /^--env-file=(.+)$/.exec(argv.find((a) => a.startsWith("--env-file=")) ?? "");

const loaded = loadEnvFile(envFileArg?.[1] ?? null);
console.log(`env: ${loaded ?? "(koi file nahi — shell ki env se chal rahe hain)"}`);

/* ------------------------------------------------------- dono taraf ke driver */

const config = readStorageConfig();

/*
 * ⚠️ Source hamesha local, destination hamesha r2 — `REEL_STORAGE_DRIVER` ki
 * value se koi lena-dena nahi. Us env ko yahan padhna sabse aasan galti hoti:
 * driver pehle se `r2` kar chuke ho (jo is script se pehle karna bilkul sahi
 * hai) to script R2 se R2 par copy karne lagti aur "0 file mili" bol kar khush
 * ho jaati — jabki asli maal disk par pada rehta.
 */
const localRoot = resolve(config.local.outputDir, "media");
const source = createStorageDriver({ ...config, driver: "local" });
const dest = createStorageDriver({ ...config, driver: "r2" });

if (!r2Configured(config.r2)) {
  console.error(
    "\nR2 ki keys nahi mili. Chaaron chahiye: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,\n" +
      "R2_SECRET_ACCESS_KEY, R2_BUCKET.\n\n" +
      "Ye aksar sirf studio ke paas hoti hain — to aise chalao:\n" +
      "  npx tsx worker/scripts/migrate-local-to-r2.ts --env-file=studio/.env.local",
  );
  process.exit(1);
}

/* ------------------------------------------------------------------- walk */

/** `<outputDir>/media` ke neeche har file ka storage key. */
async function localKeys(dir: string): Promise<string[]> {
  if (!existsSync(dir)) return [];
  const found: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      found.push(...(await localKeys(full)));
      continue;
    }
    // Key wahi hai jo DB me likhi hai — path separator hamesha "/".
    found.push(relative(localRoot, full).split(sep).join("/"));
  }
  return found;
}

function mb(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/**
 * R2 sach me likhne-padhne layak hai? — ek chhoti file chadha kar, padh kar, hata kar.
 *
 * ⚠️ Ye jaanch is script ki sabse zaroori line hai, aur wo ek jhoothi tasalli ke
 * baad aayi. `exists()` **har** na-theek jawab par `null` deta hai — 404 par bhi
 * aur 401/403 (galat key) par bhi. Yaani bilkul galat credentials ke saath bhi
 * `--dry-run` "4 chadhegi, 0 pehle se R2 par thi" bol kar hara jhanda dikha deta
 * tha. Aadmi tasalli se asli migration chalata, aur galti pehli `put()` par
 * dikhti — aadha maal chadha kar.
 *
 * Isliye pehle likh kar dekho. Sirf `temp/probe/…` chhoota hai, aur wahi ek
 * jagah hai jise cleanup script bhi mita sakti hai — kisi ki asli file kabhi
 * kharaab nahi hoti.
 */
async function probeR2(dest: ReturnType<typeof createStorageDriver>): Promise<void> {
  const key = storageKey.probe(`migrate-${randomUUID()}`, "txt");
  const payload = new TextEncoder().encode("reel-migrate-probe");

  try {
    await dest.put(key, payload, "text/plain");
    const back = await dest.get(key);
    if (!back || back.length !== payload.length) {
      throw new Error("chadhi hui file wapas padhi nahi ja saki (ya size alag aayi)");
    }
  } finally {
    // Probe apni file hamesha hataata hai — chahe beech me kuch bhi hua ho.
    await dest.delete(key).catch(() => {});
  }
}

/* ------------------------------------------------------------------- main */

async function main(): Promise<void> {
  console.log(`local media: ${localRoot}`);
  console.log(`R2 bucket  : ${config.r2.bucket}`);

  /*
   * ⚠️ Ye jaanch `--dry-run` me bhi chalti hai, aur wahi iska poora maqsad hai.
   * Dry-run ka kaam "ye chalega ya nahi" ka jawab dena hai — bina R2 ko chhue wo
   * jawab andaaza hota, sach nahi.
   */
  try {
    await probeR2(dest);
    console.log("R2 jaanch  : ok (likh kar, padh kar, hata kar dekha)");
  } catch (error) {
    console.error(
      `\nR2 par likha nahi ja saka: ${error instanceof Error ? error.message : String(error)}\n\n` +
        `Aksar wajah: R2 API token ki permission "Object Read & Write" nahi hai,\n` +
        `ya R2_BUCKET ka naam galat hai, ya keys kisi doosre account ki hain.`,
    );
    process.exit(1);
  }

  if (dryRun) console.log("\n⚠️ --dry-run — kuch upload nahi hoga, sirf hisaab dikhega.\n");

  const keys = (await localKeys(localRoot)).sort();
  if (keys.length === 0) {
    console.log("\nLocal par ek bhi file nahi mili — kuch karne ko hai hi nahi.");
    return;
  }

  let uploaded = 0;
  let skipped = 0;
  let bytes = 0;
  const failed: string[] = [];

  for (const key of keys) {
    const path = resolve(localRoot, ...key.split("/"));
    const size = (await stat(path)).size;

    /*
     * Pehle se chadhi hui file dobara nahi chadhti. Ye sirf tezi ke liye nahi
     * hai: script beech me ruk jaaye (net gaya, Ctrl+C) to dobara chalane par
     * wo wahin se uthti hai jahan chhodi thi.
     */
    const already = await dest.exists(key);
    if (already && already.size === size) {
      skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(`  chadhegi  ${key}  (${mb(size)})`);
      uploaded += 1;
      bytes += size;
      continue;
    }

    try {
      const data = await source.get(key);
      if (!data) {
        failed.push(`${key} — local se padhi hi nahi gayi`);
        continue;
      }
      await dest.put(key, data);

      /*
       * ⚠️ Upload ke baad **poochha** jaata hai, maan nahi liya jaata. Storage me
       * aadha-sach sabse mehnga hota hai: "ho gaya" dikhta hai aur render ke waqt
       * file milti hi nahi (yahi baat storage-smoke.ts ke sar par bhi likhi hai).
       */
      const check = await dest.exists(key);
      if (!check || check.size !== size) {
        failed.push(`${key} — chadhne ke baad size mel nahi khaayi`);
        continue;
      }

      uploaded += 1;
      bytes += size;
      console.log(`  ok  ${key}  (${mb(size)})`);
    } catch (error) {
      failed.push(`${key} — ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log(
    `\n${keys.length} file mili — ${uploaded} ${dryRun ? "chadhegi" : "chadhi"} (${mb(bytes)}), ` +
      `${skipped} pehle se R2 par thi, ${failed.length} fail.`,
  );

  if (failed.length > 0) {
    console.log("\nFail:");
    for (const line of failed) console.log(`  ${line}`);
    process.exit(1);
  }

  if (!dryRun && uploaded > 0) {
    console.log(
      "\nAb studio ka REEL_STORAGE_DRIVER=r2 kar do (aur R2 ki chaaron keys bhi wahin).\n" +
        "Local copy jaan-boojhkar chhodi gayi hai — tasalli ke baad render-out/ khud hata dena.",
    );
  }
}

void main().catch((error: unknown) => {
  console.error(`\nmigration ruk gayi: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
