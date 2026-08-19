/**
 * Storage driver ka round-trip smoke test.
 *
 * ```
 * npx tsx worker/scripts/storage-smoke.ts --driver=local
 * npx tsx worker/scripts/storage-smoke.ts --driver=r2
 * npx tsx worker/scripts/storage-smoke.ts --driver=r2 --env-file=web/.env.local
 * ```
 *
 * Ye "driver ban gaya" check karke khush nahi hota — sach me bytes likhta hai,
 * wapas padhta hai, byte-by-byte milaata hai, signed URL se HTTP par utaarta
 * hai, phir delete karke confirm karta hai ki sach me gaya. Storage me aadha-sach
 * sabse mehnga hota hai: upload "ho gaya" dikhta hai aur render ke waqt file
 * milti hi nahi.
 *
 * Ye file `temp/probe/...` ke alawa kuch nahi chhooti, aur aakhir me apni file
 * hata deti hai.
 */

import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import {
  assertValidKey,
  InvalidStorageKey,
  storageKey,
  type StorageDriver,
} from "@reel/core";
import {
  createStorageDriver,
  LocalStorageDriver,
  r2Configured,
  readStorageConfig,
  requireRepoRoot,
  type StorageConfig,
} from "@reel/storage";

// ------------------------------------------------------------------- setup

/**
 * `worker/.env` khud load kar lo (Node 20.12+ ka built-in — dotenv ki zaroorat
 * nahi). File na ho to koi baat nahi: shell ki env se bhi chal jaata hai.
 */
function loadEnvFile(explicit: string | null): string | null {
  // ⚠️ Repo root se dhoondho, cwd se nahi. `npm run db-verify` cwd `worker/` deta
  // hai par `npx tsx worker/scripts/...` repo root — cwd par bharosa karne se
  // ek tarika chalta hai aur doosra chupchaap galat file utha leta hai.
  const root = requireRepoRoot();
  const candidates = explicit ? [explicit] : ["worker/.env", ".env"];
  for (const candidate of candidates) {
    const path = isAbsolute(candidate) ? candidate : resolve(root, candidate);
    if (!existsSync(path)) continue;
    process.loadEnvFile(path);
    return path;
  }
  if (explicit) throw new Error(`--env-file="${explicit}" mila nahi`);
  return null;
}

function parseArgs(argv: readonly string[]): { driver: string | null; envFile: string | null } {
  let driver: string | null = null;
  let envFile: string | null = null;
  for (const arg of argv) {
    const driverMatch = /^--driver=(.+)$/.exec(arg);
    if (driverMatch) driver = driverMatch[1] as string;
    // R2 keys kahin aur padi ho (jaise web/.env.local) to usi ek run ke liye
    // wahan se utha lo — kahin copy karke rakhne ki zaroorat nahi.
    const envMatch = /^--env-file=(.+)$/.exec(arg);
    if (envMatch) envFile = envMatch[1] as string;
  }
  return { driver, envFile };
}

// -------------------------------------------------------------- mini runner

let passed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail = ""): void {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

/**
 * URL ka query hissa kabhi print nahi karna.
 *
 * ⚠️ R2 ke presigned URL me `X-Amz-Credential` (access key id) aur
 * `X-Amz-Signature` dono hote hain. Logs screenshot me jaate hain, docs me
 * paste hote hain — signed URL waise ka waisa chhaapna asli credential leak hai.
 */
function redactUrl(raw: string): string {
  try {
    const url = new URL(raw);
    return `${url.origin}${url.pathname}${url.search ? "?…(signature chhupaya)" : ""}`;
  } catch {
    return "(URL padhi nahi ja saki)";
  }
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) if (a[i] !== b[i]) return false;
  return true;
}

// ------------------------------------------------------------------ the run

async function roundTrip(driver: StorageDriver, config: StorageConfig): Promise<void> {
  // 256 KB — itna bada ki chunking/stream ki galti pakdi jaaye, itna chhota ki
  // R2 par chalane me der na lage.
  const payload = new Uint8Array(256 * 1024);
  for (let i = 0; i < payload.length; i += 1) payload[i] = (i * 7 + 13) % 256;

  const key = storageKey.probe(`smoke-${randomUUID()}`, "bin");
  console.log(`\ndriver = ${driver.name}`);
  if (driver instanceof LocalStorageDriver) {
    console.log(`root   = ${driver.rootDir()}`);
  } else {
    console.log(`bucket = ${config.r2.bucket} @ ${config.r2.accountId.slice(0, 6)}…`);
  }
  console.log(`key    = ${key}\n`);

  try {
    check("shuruat me file maujood nahi", (await driver.exists(key)) === null);

    await driver.put(key, payload, "application/octet-stream");
    const info = await driver.exists(key);
    check("put ke baad file mil rahi hai", info !== null);
    check(
      "size bilkul sahi hai",
      info?.size === payload.length,
      `${info?.size ?? "?"} bytes (chahiye ${payload.length})`,
    );

    const fetched = await driver.get(key);
    check("get ne bytes wapas diye", fetched !== null);
    check(
      "bytes byte-by-byte same hain",
      fetched !== null && bytesEqual(fetched, payload),
    );

    // --- signed URL (dono driver ka apna matlab hai) ---
    const url = await driver.getSignedUrl(key, { expiresIn: 120 });
    check("signed URL bana", url.startsWith("http"), redactUrl(url));

    const viaHttp = await tryFetch(url);
    if (viaHttp.ok) {
      check(
        "signed URL se HTTP par wahi bytes utre",
        bytesEqual(viaHttp.bytes as Uint8Array, payload),
        `${(viaHttp.bytes as Uint8Array).length} bytes`,
      );
    } else if (driver.name === "local") {
      // Local driver ka "signed URL" studio ka route hai — studio band ho to
      // ye check nahi ho sakta. Jhootha pass dene se behtar hai saaf bolna.
      console.log(`  SKIP signed URL se HTTP fetch — studio band lag raha hai (${viaHttp.reason})`);
      console.log(`       studio chalao (npm run dev:studio) phir dobara chalao`);
    } else {
      check("signed URL se HTTP par wahi bytes utre", false, viaHttp.reason);
    }

    // --- upload URL: yahi browser ka asli rasta hai ---
    await driver.delete(key);
    const upload = await driver.putSigned(key, "application/octet-stream", { expiresIn: 300 });
    check("putSigned ne PUT target diya", upload.method === "PUT" && upload.url.startsWith("http"));
    check(
      "putSigned content-type bandh raha hai",
      upload.headers["content-type"] === "application/octet-stream",
    );

    // Sirf URL ban gaya ye kaafi nahi — uspar sach me chadhta hai kya?
    const uploaded = await tryUpload(upload.url, upload.headers, payload);
    if (uploaded.ok) {
      check("putSigned URL par sach me upload hua", true, `HTTP ${uploaded.status}`);
      const after = await driver.get(key);
      check(
        "upload ke baad wahi bytes wapas mile",
        after !== null && bytesEqual(after, payload),
      );
    } else if (driver.name === "local") {
      console.log(`  SKIP putSigned URL par upload — studio band lag raha hai (${uploaded.reason})`);
    } else {
      check("putSigned URL par sach me upload hua", false, uploaded.reason);
    }

    // --- delete ---
    check("delete ne true diya", await driver.delete(key));
    check("delete ke baad file sach me gayab hai", (await driver.exists(key)) === null);
    check("dobara delete karna bhi theek hai (idempotent)", await driver.delete(key));
  } finally {
    // Kahin beech me fail ho gaya to bhi kachra peeche nahi chhodna.
    await driver.delete(key).catch(() => undefined);
  }
}

async function tryUpload(
  url: string,
  headers: Record<string, string>,
  body: Uint8Array,
): Promise<{ ok: true; status: number } | { ok: false; reason: string }> {
  try {
    const response = await fetch(url, {
      method: "PUT",
      headers,
      body: body as unknown as NonNullable<RequestInit["body"]>,
    });
    if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };
    return { ok: true, status: response.status };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

async function tryFetch(
  url: string,
): Promise<{ ok: true; bytes: Uint8Array } | { ok: false; reason: string }> {
  try {
    const response = await fetch(url);
    if (!response.ok) return { ok: false, reason: `HTTP ${response.status}` };
    return { ok: true, bytes: new Uint8Array(await response.arrayBuffer()) };
  } catch (error) {
    return { ok: false, reason: error instanceof Error ? error.message : String(error) };
  }
}

function keyGuardChecks(): void {
  console.log("\nkey validation (ye security ki deewar hai)");
  const bad = [
    "../../etc/passwd",
    "temp/../../secret.txt",
    "/absolute/path",
    "temp\\windows\\path",
    "temp//double",
    "temp/probe/file with space.bin",
  ];
  for (const key of bad) {
    let rejected = false;
    try {
      assertValidKey(key);
    } catch (error) {
      rejected = error instanceof InvalidStorageKey;
    }
    check(`reject: ${key}`, rejected);
  }
}

// ---------------------------------------------------------------------- main

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const envFile = loadEnvFile(args.envFile);
  console.log(`env file: ${envFile ?? "(koi nahi mila — shell ki env chal rahi hai)"}`);

  const driverArg = args.driver;
  if (driverArg) process.env.REEL_STORAGE_DRIVER = driverArg;

  const config = readStorageConfig();

  if (config.driver === "r2" && !r2Configured(config.r2)) {
    console.log("\nR2 keys env me nahi hain — ye test chhoda ja raha hai.");
    console.log("worker/.env me R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET daalo.");
    console.log("\nSKIPPED (koi jhootha pass nahi diya gaya)");
    process.exit(0);
  }

  keyGuardChecks();
  await roundTrip(createStorageDriver(config), config);

  console.log(`\n${"-".repeat(60)}`);
  if (failures.length > 0) {
    console.log(`FAILED: ${failures.length} fail, ${passed} pass`);
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`ALL PASS: ${passed} checks, 0 fail  (driver: ${config.driver})`);
}

main().catch((error) => {
  console.error("\nsmoke test phat gaya:", error);
  process.exit(1);
});
