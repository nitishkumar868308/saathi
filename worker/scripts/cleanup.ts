/**
 * Asset lifecycle cleanup (20.10 / 20.11 / 20.13).
 *
 * ⚠️ **Dry-run default hai.** `--apply` diye bina ye kuch nahi mitata, sirf
 * batata hai ki kya mitega. Ye ek soch-samajh kar liya faisla hai: ye script
 * user ki media delete karti hai, aur ek galat filter ka nateeja "mera saara
 * kaam chala gaya" hota hai. Delete karne se pehle list dekh lena bahut sasta
 * hai.
 *
 * ⚠️ **Referenced temp asset kabhi delete nahi hoti**, chahe uski expiry beet
 * chuki ho. Expiry ka matlab "ab shayad kisi ko chahiye nahi" hai, "ab ye kisi
 * project me nahi hai" nahi. Isliye har temp asset ke liye pehle saare projects
 * ke doc me dekha jaata hai.
 *
 * Chalao:
 *   npx tsx worker/scripts/cleanup.ts            # sirf dikhao
 *   npx tsx worker/scripts/cleanup.ts --apply    # sach me mitao
 *   npx tsx worker/scripts/cleanup.ts --orphans  # R2 <-> DB ka mel bhi dekho
 */

import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import { planCleanup, safeParseDoc, findOrphans, type Doc } from "@reel/core";
import { createStorageDriver, readStorageConfig, requireRepoRoot } from "@reel/storage";

import { readDbConn, rows, select, type DbConn } from "../src/db";

interface Args {
  apply: boolean;
  orphans: boolean;
  envFile?: string;
}

function parseArgs(argv: readonly string[]): Args {
  const args: Args = { apply: false, orphans: false };
  for (const entry of argv) {
    if (entry === "--apply") args.apply = true;
    else if (entry === "--orphans") args.orphans = true;
    else if (entry.startsWith("--env=")) args.envFile = entry.slice("--env=".length);
  }
  return args;
}

/** Repo root se `.env` uthao — script kahin se bhi chalayi ja sakti hai. */
function loadEnv(explicit: string | null): void {
  const root = requireRepoRoot();
  for (const candidate of explicit ? [explicit] : ["worker/.env", ".env"]) {
    const path = isAbsolute(candidate) ? candidate : resolve(root, candidate);
    if (existsSync(path)) {
      process.loadEnvFile(path);
      return;
    }
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/** R2 ka free tier — iske paas pahunchte hi batana chahiye (20.13). */
const FREE_TIER_BYTES = 10 * 1024 * 1024 * 1024;

interface AssetRow {
  id: string;
  key: string;
  lifecycle: string;
  expires_at: string | null;
  bytes: number | null;
  filename: string | null;
}

/**
 * Har project ke doc me kaun se asset use ho rahe hain.
 *
 * ⚠️ Ye **saare** projects se aata hai, sirf ek se nahi. Ek temp asset do
 * project me ho sakti hai (duplicate karne par), aur ek me se hatane par wo
 * doosre me abhi bhi chahiye hoti hai.
 */
/**
 * Saare projects ke doc.
 *
 * ⚠️ **Saare**, sirf ek nahi. Ek temp asset do project me ho sakti hai
 * (duplicate karne par), aur ek me se hatane par wo doosre me abhi bhi chahiye
 * hoti hai.
 *
 * Jo doc schema se na guzre use **chhodte nahi** — uski asset ko "use me nahi"
 * maan lena sabse khatarnaak hota. Aisa doc ho to poora cleanup ruk jaata hai.
 */
async function allDocs(conn: DbConn): Promise<Doc[]> {
  const projects = rows(await select(conn, "/reel_projects?select=id,doc"));
  const docs: Doc[] = [];

  for (const project of projects) {
    const parsed = safeParseDoc(project.doc);
    if (!parsed.success) {
      throw new Error(
        `Project ${String(project.id)} ka doc padha nahi ja saka — cleanup rok raha hoon. ` +
          `Uski assets ko "use me nahi" maan lena sabse khatarnaak hoga.`,
      );
    }
    docs.push(parsed.data);
  }
  return docs;
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  loadEnv(args.envFile ?? null);

  const storage = createStorageDriver(readStorageConfig());
  const conn = readDbConn();

  console.log(`mode    : ${args.apply ? "APPLY (sach me mitega)" : "dry-run (kuch nahi mitega)"}`);
  console.log(`storage : ${storage.name}`);

  /*
   * DB me column ka naam `r2_key` hai, `key` nahi — aur wo naam driver se nahi
   * bandha hai (local driver bhi wahi key use karta hai, reel-studio.sql:118).
   * Baaki poora code app ki taraf use `key` kehta hai (studio/lib/assets.ts),
   * isliye yahan PostgREST ka alias laga kar wahi naam rakha hai; warna is
   * script ke neeche ke saare `asset.key` badalne padte.
   */
  const assets = rows(
    await select(conn, "/reel_assets?select=id,key:r2_key,lifecycle,expires_at,bytes,filename"),
  ) as unknown as AssetRow[];
  const docs = await allDocs(conn);

  section("1. storage ka hisaab (20.13)");
  const permanent = assets.filter((asset) => asset.lifecycle !== "temporary");
  const temporary = assets.filter((asset) => asset.lifecycle === "temporary");
  const bytesOf = (list: AssetRow[]) => list.reduce((sum, asset) => sum + (asset.bytes ?? 0), 0);

  const permanentBytes = bytesOf(permanent);
  const temporaryBytes = bytesOf(temporary);
  const totalBytes = permanentBytes + temporaryBytes;

  console.log(`  permanent : ${permanent.length} file, ${formatBytes(permanentBytes)}`);
  console.log(`  temporary : ${temporary.length} file, ${formatBytes(temporaryBytes)}`);
  console.log(`  total     : ${assets.length} file, ${formatBytes(totalBytes)}`);

  const usedPercent = (totalBytes / FREE_TIER_BYTES) * 100;
  console.log(`  R2 free tier ka ${usedPercent.toFixed(1)}% (10 GB me se)`);
  if (usedPercent > 80) {
    console.log("  ⚠️  80% se upar — purane renders aur temp assets dekho.");
  }

  const biggest = [...assets].sort((a, b) => (b.bytes ?? 0) - (a.bytes ?? 0)).slice(0, 10);
  if (biggest.length > 0) {
    console.log("\n  sabse badi 10 files:");
    for (const asset of biggest) {
      console.log(
        `    ${formatBytes(asset.bytes ?? 0).padStart(9)}  ${asset.lifecycle.padEnd(9)}  ${asset.filename ?? asset.key}`,
      );
    }
  }

  section("2. expire ho chuki temporary assets (20.10)");
  /*
   * ⚠️ Faisla **`planCleanup()`** karta hai, ye script nahi. Wo `@reel/core` me
   * hai aur bina DB/R2 ke test se guzarta hai — kyunki uski galti sabse mehngi
   * padti hai ("mera saara kaam chala gaya"). Yahan sirf DB ki rows use uske
   * shape me badalti hain aur uska jawab chapta hai.
   */
  const plan = planCleanup({
    assets: assets.map((asset) => ({
      id: asset.id,
      key: asset.key,
      lifecycle: asset.lifecycle,
      expiresAt: asset.expires_at,
      bytes: asset.bytes,
    })),
    docs,
  });

  const deletable = plan.deletable.map(
    (entry) => assets.find((asset) => asset.id === entry.id) as AssetRow,
  );
  const keptBecauseUsed = plan.keptBecauseUsed.map(
    (entry) => assets.find((asset) => asset.id === entry.id) as AssetRow,
  );

  console.log(`  expire ho chuki : ${plan.deletable.length + plan.keptBecauseUsed.length}`);
  console.log(`  mitane layak    : ${plan.deletable.length}`);
  console.log(`  bachi (kisi project me hain) : ${plan.keptBecauseUsed.length}`);

  for (const asset of keptBecauseUsed) {
    // Ye line zaroori hai: user ko dikhna chahiye ki kaun si file expiry ke
    // bawajood bach rahi hai, warna wo sochta hai ki cleanup kaam nahi kar raha.
    console.log(`    bachi  ${asset.filename ?? asset.key} (kisi project me lagi hai)`);
  }

  let freed = 0;
  for (const asset of deletable) {
    if (!args.apply) {
      console.log(`    mitegi ${asset.filename ?? asset.key} (${formatBytes(asset.bytes ?? 0)})`);
      freed += asset.bytes ?? 0;
      continue;
    }

    /*
     * Kram maayne rakhta hai: **pehle storage, phir DB**.
     *
     * Ulta karne par (pehle DB) agar storage delete fail ho jaaye to file R2 me
     * pad jaati hai aur uska koi DB row nahi bachta — yaani wo hamesha ke liye
     * anaath ho jaati aur uska pata bhi nahi chalta. Is kram me sabse bura ye
     * ho sakta hai ki DB row bach jaaye aur file na ho, jo agle orphan scan me
     * saaf dikh jaata hai.
     */
    try {
      await storage.delete(asset.key);
      await fetch(`${process.env.SUPABASE_URL}/rest/v1/reel_assets?id=eq.${asset.id}`, {
        method: "DELETE",
        headers: {
          apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
          Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""}`,
        },
      });
      freed += asset.bytes ?? 0;
      console.log(`    mitayi ${asset.filename ?? asset.key}`);
    } catch (error) {
      console.log(
        `    FAIL   ${asset.filename ?? asset.key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
  console.log(`  ${args.apply ? "khaali hui" : "khaali hogi"}: ${formatBytes(freed)} (plan: ${formatBytes(plan.freedBytes)})`);

  if (args.orphans) {
    section("3. orphan scan (20.11)");
    /*
     * ⚠️ Orphan scan **kabhi kuch nahi mitata**, chahe `--apply` diya ho. Dono
     * taraf ke orphan alag-alag wajah se bante hain (adhoori upload, haath se
     * delete, do machine par ek saath kaam) aur unme se kuch bilkul theek hote
     * hain. Yahan sirf list banti hai; mitana user ka faisla hai.
     */
    const listed = await storage.list("assets/");
    const { inStorageOnly, inDbOnly } = findOrphans({
      assets: assets.map((asset) => ({ id: asset.id, key: asset.key })),
      keys: listed.map((entry) => entry.key),
    });

    console.log(`  storage me hai par DB me nahi : ${inStorageOnly.length}`);
    for (const key of inStorageOnly.slice(0, 20)) console.log(`    ${key}`);

    console.log(`  DB me hai par storage me nahi : ${inDbOnly.length}`);
    for (const asset of inDbOnly.slice(0, 20)) {
      console.log(`    ${asset.key} (${asset.id})`);
    }

    console.log("\n  (orphan scan kuch nahi mitata — dono taraf ke orphan alag wajah se bante");
    console.log("   hain aur unme se kuch bilkul theek hote hain.)");
  }

  console.log(
    `\n${"-".repeat(60)}\n${args.apply ? "Ho gaya." : "Ye sirf dikhawa tha. Sach me mitane ke liye --apply do."}`,
  );
}

void main();
