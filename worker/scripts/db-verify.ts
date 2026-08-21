/**
 * Supabase par `supabase/reel-studio.sql` sach me lagi ya nahi — ye jaanchta hai.
 *
 * ```
 * npx tsx worker/scripts/db-verify.ts
 * npx tsx worker/scripts/db-verify.ts --env-file=web/.env.local
 * ```
 *
 * "Tables dikh rahe hain" kaafi nahi hota. Ye script queue ko **sach me chalata
 * hai**: ek test project + job banata hai, claim karta hai, dobara claim karke
 * dekhta hai ki khaali haath lautta hai (yahi `skip locked` ka matlab hai), phir
 * stale-requeue chalata hai — aur aakhir me apna sara kachra saaf kar deta hai.
 *
 * Anon key se bhi ek baar padhne ki koshish hoti hai: RLS sach me band hai ya
 * sirf naam ka, ye wahin pata chalta hai.
 *
 * Koi npm dependency nahi — seedhe PostgREST par fetch.
 */

import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";

import { requireRepoRoot } from "@reel/storage";

// ------------------------------------------------------------------- setup

function parseArgs(argv: readonly string[]): { envFile: string | null } {
  let envFile: string | null = null;
  for (const arg of argv) {
    const match = /^--env-file=(.+)$/.exec(arg);
    if (match) envFile = match[1] as string;
  }
  return { envFile };
}

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

interface Conn {
  url: string;
  serviceKey: string;
  anonKey: string | null;
}

function readConn(): Conn {
  const url = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(
    /\/+$/,
    "",
  );
  // Repo me naam `SUPABASE_SERVICE_ROLE_KEY` hai; `SUPABASE_SERVICE_ROLE` bhi
  // maan lete hain taaki dono me se jo bhi set ho, chal jaaye.
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || "";
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || null;

  if (!url || !serviceKey) {
    throw new Error(
      "SUPABASE_URL aur SUPABASE_SERVICE_ROLE_KEY dono chahiye " +
        "(--env-file=web/.env.local se bhi de sakte ho)",
    );
  }
  return { url, serviceKey, anonKey };
}

// -------------------------------------------------------------- mini runner

let passed = 0;
const failures: string[] = [];

/**
 * `detail` sirf tab chhapta hai jab kaam ka ho. Success par poori row ka JSON
 * ugalne se output padhne layak nahi rehta — aur usme project ka doc bhi aa
 * jaata hai, jo logs me daalne ki cheez nahi.
 */
function check(label: string, ok: boolean, detail = ""): boolean {
  if (ok) {
    passed += 1;
    const clean = detail.startsWith("HTTP ") ? "" : detail;
    console.log(`  ok   ${label}${clean ? ` — ${clean}` : ""}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
  }
  return ok;
}

function section(title: string): void {
  console.log(`\n${title}`);
}

// -------------------------------------------------------------- postgrest

interface RestResult {
  status: number;
  body: unknown;
  text: string;
}

async function rest(
  conn: Conn,
  path: string,
  init: { method?: string; body?: unknown; key?: string; prefer?: string } = {},
): Promise<RestResult> {
  const key = init.key ?? conn.serviceKey;
  const headers: Record<string, string> = {
    apikey: key,
    authorization: `Bearer ${key}`,
    "content-type": "application/json",
  };
  if (init.prefer) headers.prefer = init.prefer;

  const response = await fetch(`${conn.url}/rest/v1${path}`, {
    method: init.method ?? "GET",
    headers,
    ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
  });

  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body, text };
}

function asRows(body: unknown): Record<string, unknown>[] {
  return Array.isArray(body) ? (body as Record<string, unknown>[]) : [];
}

function shortError(result: RestResult): string {
  const message =
    typeof result.body === "object" && result.body !== null && "message" in result.body
      ? String((result.body as { message: unknown }).message)
      : result.text;
  return `HTTP ${result.status} ${message.slice(0, 160)}`;
}

// ------------------------------------------------------------------- checks

const TABLES = [
  "reel_projects",
  "reel_project_versions",
  "reel_assets",
  "reel_render_jobs",
  /*
   * Worker ka heartbeat isi table me likhta hai (11.13).
   *
   * ⚠️ Ye list me nahi tha, aur uski keemat theek wahi thi jiske liye ye script
   * banayi hai: `db-verify` "sab theek hai" kehta raha, jabki `reel_workers`
   * DB me tha hi nahi. Worker chalu to hota tha par har heartbeat 404 par girta
   * tha — aur UI ke liye uska matlab hota "worker offline", hamesha. Jis table
   * par koi code likhta hai, wo is list me hona chahiye.
   */
  "reel_workers",
  "reel_templates",
  "reel_brand_presets",
  "reel_characters",
  "reel_voices",
] as const;

const TEST_PROJECT_NAME = "__db-verify (mit jaayega)";

async function checkTables(conn: Conn): Promise<void> {
  section(`1. saari ${TABLES.length} tables maujood hain?`);
  for (const table of TABLES) {
    const result = await rest(conn, `/${table}?select=*&limit=0`);
    check(table, result.status === 200, result.status === 200 ? "" : shortError(result));
  }
}

async function checkRls(conn: Conn): Promise<void> {
  section("2. RLS sach me band hai? (anon key se padhne ki koshish)");
  if (!conn.anonKey) {
    console.log("  SKIP anon key env me nahi mili — ye check nahi ho paaya");
    return;
  }
  const result = await rest(conn, "/reel_projects?select=id&limit=5", { key: conn.anonKey });
  // Do hi imaandaar nateeje hain: ya to permission denied, ya khaali list.
  // Kisi bhi haalat me ek bhi row nahi aani chahiye.
  const rows = asRows(result.body);
  check(
    "anon ko reel_projects se koi row nahi mili",
    result.status >= 400 || rows.length === 0,
    result.status >= 400 ? `blocked (HTTP ${result.status})` : `HTTP 200 par ${rows.length} rows`,
  );
}

async function checkQueue(conn: Conn): Promise<void> {
  section("3. queue sach me chalti hai? (yahi asli test hai)");

  // --- test project ---
  const project = await rest(conn, "/reel_projects", {
    method: "POST",
    body: { name: TEST_PROJECT_NAME, doc: { version: 1 } },
    prefer: "return=representation",
  });
  const projectRow = asRows(project.body)[0];
  if (!check("test project ban gaya", Boolean(projectRow?.id), shortError(project))) return;
  const projectId = String(projectRow?.id);

  check(
    "doc_version default 1 hai",
    projectRow?.doc_version === 1,
    `mila: ${String(projectRow?.doc_version)}`,
  );

  try {
    // --- test job ---
    const job = await rest(conn, "/reel_render_jobs", {
      method: "POST",
      body: { project_id: projectId, doc: { version: 1 } },
      prefer: "return=representation",
    });
    const jobRow = asRows(job.body)[0];
    if (!check("test render job ban gaya", Boolean(jobRow?.id), shortError(job))) return;

    check("naya job 'queued' me hai", jobRow?.status === "queued", String(jobRow?.status));
    check("attempts 0 se shuru", jobRow?.attempts === 0, String(jobRow?.attempts));

    // --- claim #1 ---
    const claim1 = await rest(conn, "/rpc/reel_claim_render_job", {
      method: "POST",
      body: { p_worker: "db-verify-worker" },
    });
    const claimed = asRows(claim1.body)[0];
    if (!check("reel_claim_render_job ne job uthaya", Boolean(claimed?.id), shortError(claim1))) {
      return;
    }
    check("claim ke baad status 'processing'", claimed?.status === "processing", String(claimed?.status));
    check("worker_id likha gaya", claimed?.worker_id === "db-verify-worker", String(claimed?.worker_id));
    check("attempts 1 ho gaya", claimed?.attempts === 1, String(claimed?.attempts));
    check("claimed_at set hua", Boolean(claimed?.claimed_at));

    // --- claim #2: yahi skip-locked ka asli matlab hai ---
    const claim2 = await rest(conn, "/rpc/reel_claim_render_job", {
      method: "POST",
      body: { p_worker: "doosra-worker" },
    });
    check(
      "doosra worker khaali haath lauta (atka nahi)",
      claim2.status === 200 && asRows(claim2.body).length === 0,
      `${asRows(claim2.body).length} rows`,
    );

    // --- stale requeue ---
    // p_minutes = 0 matlab "jo abhi claim hui hai wo bhi purani maano" — isse
    // ghante bhar rukne ki zaroorat nahi padti.
    const requeue = await rest(conn, "/rpc/reel_requeue_stale_jobs", {
      method: "POST",
      body: { p_minutes: 0 },
    });
    const requeued = asRows(requeue.body)[0];
    if (check("reel_requeue_stale_jobs ne atki job pakdi", Boolean(requeued?.id), shortError(requeue))) {
      check("wapas 'queued' me daali gayi", requeued?.status === "queued", String(requeued?.status));
      check("worker_id saaf kiya gaya", requeued?.worker_id === null, String(requeued?.worker_id));
      check(
        "error me wajah likhi hai",
        typeof requeued?.error === "string" && String(requeued.error).length > 0,
        String(requeued?.error).slice(0, 70),
      );
    }

    // --- max_attempts ke baad chhod dena chahiye ---
    // attempts abhi 1 hai, max 3. Do baar aur claim+requeue karo -> 'failed'.
    let lastStatus = "";
    for (let round = 0; round < 2; round += 1) {
      await rest(conn, "/rpc/reel_claim_render_job", {
        method: "POST",
        body: { p_worker: `db-verify-worker-${round}` },
      });
      const again = await rest(conn, "/rpc/reel_requeue_stale_jobs", {
        method: "POST",
        body: { p_minutes: 0 },
      });
      lastStatus = String(asRows(again.body)[0]?.status ?? "");
    }
    check(
      "koshishein poori hone par job 'failed' hui (loop nahi banta)",
      lastStatus === "failed",
      lastStatus,
    );
  } finally {
    // --- safai ---
    const cleanup = await rest(
      conn,
      `/reel_projects?name=eq.${encodeURIComponent(TEST_PROJECT_NAME)}`,
      { method: "DELETE", prefer: "return=representation" },
    );
    check("test data saaf ho gaya (jobs cascade se)", cleanup.status < 300, shortError(cleanup));

    const left = await rest(
      conn,
      `/reel_projects?select=id&name=eq.${encodeURIComponent(TEST_PROJECT_NAME)}`,
    );
    check("DB me kuch peeche nahi bacha", asRows(left.body).length === 0);
  }
}

// ---------------------------------------------------------------------- main

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const envFile = loadEnvFile(args.envFile);
  console.log(`env file: ${envFile ?? "(koi nahi mila — shell ki env chal rahi hai)"}`);

  const conn = readConn();
  console.log(`supabase: ${conn.url}`);

  await checkTables(conn);
  await checkRls(conn);
  await checkQueue(conn);

  console.log(`\n${"-".repeat(60)}`);
  if (failures.length > 0) {
    console.log(`FAILED: ${failures.length} fail, ${passed} pass`);
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`ALL PASS: ${passed} checks, 0 fail`);
}

main().catch((error) => {
  console.error("\ndb-verify phat gaya:", error instanceof Error ? error.message : error);
  process.exit(1);
});
