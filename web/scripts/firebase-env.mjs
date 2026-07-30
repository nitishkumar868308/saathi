#!/usr/bin/env node
/**
 * Firebase service-account JSON se Vercel wale teen env var nikaalo.
 *
 * Kyun ek script: `FIREBASE_PRIVATE_KEY` haath se copy karne me har koi fansta
 * hai. JSON me wo `-----BEGIN PRIVATE KEY-----\nMIIE...` shakal me hota hai —
 * agar aap usse editor me paste karke enter dabate hain, ya JSON wale double
 * quotes bhi साथ le aate hain, to server par yahi error aata hai:
 *
 *     error:0909006C:PEM routines:get_name:no start line
 *
 * Ye script wahi value nikaalti hai jo `web/lib/fcm.ts` expect karta hai — ek
 * hi line, `\n` waise ke waise, bina quotes ke.
 *
 * Chalao:
 *   node scripts/firebase-env.mjs ~/Downloads/saathi-c42f0-firebase-adminsdk-xxxxx.json
 *
 * Seedha .env.local me likhna ho to:
 *   node scripts/firebase-env.mjs <file.json> --write
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import { homedir } from "node:os";

const args = process.argv.slice(2);
const write = args.includes("--write");
const given = args.find((a) => !a.startsWith("--"));

/**
 * `~/Downloads/...` ko asli path banao.
 *
 * Windows ke cmd/PowerShell me `~` expand nahi hota — wo seedha shell se
 * `D:\my-app\web\~\Downloads\...` bana ke bhej deta hai aur "file nahi mili"
 * aata hai. Isliye khud handle karte hain.
 */
function expand(p) {
  if (p === "~") return homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) return join(homedir(), p.slice(2));
  return p;
}

/**
 * Path na diya ho to Downloads me khud dhoondo.
 *
 * Ye file ka naam har baar alag hota hai (`...-fbsvc-8c9ca90b0e.json`), isliye
 * usse haath se type karana galtiyon ki jagah hai. Sabse naya match uthate hain.
 */
function findInDownloads() {
  const dir = join(homedir(), "Downloads");
  if (!existsSync(dir)) return [];
  try {
    return readdirSync(dir)
      .filter((f) => /firebase-adminsdk.*\.json$/i.test(f))
      .map((f) => join(dir, f))
      .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  } catch {
    return [];
  }
}

let path;

if (given) {
  path = resolve(expand(given));
  if (!existsSync(path)) {
    console.error(`File nahi mili: ${path}`);
    const found = findInDownloads();
    if (found.length) {
      console.error(`\nDownloads me ye mili hain — inme se koi use karo:\n`);
      found.forEach((f) => console.error(`  node scripts/firebase-env.mjs "${f}"`));
    }
    process.exit(1);
  }
} else {
  const found = findInDownloads();
  if (found.length === 0) {
    console.error(`
Service account JSON ka path do.

  node scripts/firebase-env.mjs <downloaded.json> [--write]

File kahan se milegi:
  Firebase Console -> project saathi-c42f0
  -> Project settings -> Service accounts
  -> "Generate new private key" -> JSON download
`);
    process.exit(1);
  }
  // Ek se zyada projects ki keys pad sakti hain — kaun si uthai, ye batana
  // zaroori hai, warna galat project ki key chup-chaap chali jaayegi.
  path = found[0];
  console.log(`Downloads se sabse nayi file li:\n  ${path}\n`);
  if (found.length > 1) {
    console.log(`(${found.length - 1} aur bhi mili — doosri chahiye to path do.)\n`);
  }
}

let sa;
try {
  sa = JSON.parse(readFileSync(path, "utf8"));
} catch (e) {
  console.error(`Ye sahi JSON nahi hai: ${e.message}`);
  process.exit(1);
}

// Galat file pakad lo — log aksar google-services.json hi de dete hain, jisme
// service account ki koi cheez hoti hi nahi.
if (!sa.private_key || !sa.client_email) {
  console.error(`
Ye service account file nahi lag rahi.

Isme "client_email" aur "private_key" dono hone chahiye.
Agar aapne google-services.json diya hai — wo galat file hai. Wo app ki client
config hai; service account key alag se Console se generate karni padti hai:

  Project settings -> Service accounts -> Generate new private key
`);
  process.exit(1);
}

if (sa.type !== "service_account") {
  console.warn(`⚠️  type "${sa.type}" hai, "service_account" hona chahiye tha. Aage badh raha hoon.\n`);
}

/**
 * Jo keys leak ho chuki hain — unhe yahi rok do.
 *
 * Chat/screenshot me bheji hui key revoke karna zaroori hai, par Downloads me
 * wo file padi rehti hai aur agli baar wahi utha li jaati hai. Naam se pata
 * nahi chalta (`...-fbsvc-8c9ca90b0e.json` dekh ke kaun bataye ki ye purani
 * hai), isliye key ID se pakadte hain.
 */
const REVOKED_KEY_IDS = new Set([
  // 30 Jul 2026 — chat me bhej di gayi thi.
  "8c9ca90b0e009d0857ad56d919ebe90d618ab222",
]);

if (REVOKED_KEY_IDS.has(sa.private_key_id)) {
  console.error(`
🚫 Ye wahi key hai jo leak ho chuki thi (id ${sa.private_key_id.slice(0, 12)}…).

Isse use mat karo. Pehle:

  1. https://console.cloud.google.com/iam-admin/serviceaccounts?project=${sa.project_id}
     -> ${sa.client_email}
     -> KEYS tab -> is key ko DELETE karo
  2. usi tab me ADD KEY -> Create new key -> JSON
  3. phir ye script dobara chalao (path do ya khali chhod do)

Nayi file download hone ke baad ye purani wali Downloads se hata dena behtar hai.
`);
  process.exit(1);
}

// JSON.parse ne "\n" ko asli newline bana diya hai. Env var me wapas literal
// "\n" chahiye — fcm.ts usse khud newline me badalta hai.
const privateKey = sa.private_key.replace(/\r?\n/g, "\\n");

const vars = {
  FIREBASE_PROJECT_ID: sa.project_id,
  FIREBASE_CLIENT_EMAIL: sa.client_email,
  FIREBASE_PRIVATE_KEY: privateKey,
};

if (write) {
  const envPath = resolve(process.cwd(), ".env.local");
  let text = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

  for (const [k, v] of Object.entries(vars)) {
    const line = `${k}=${v}`;
    const re = new RegExp(`^${k}=.*$`, "m");
    // Pehle se ho to replace — warna har baar chalane par duplicate lines jamti
    // hain aur kaun si chal rahi hai ye pata nahi chalta.
    text = re.test(text) ? text.replace(re, line) : `${text.replace(/\s*$/, "")}\n${line}\n`;
  }

  writeFileSync(envPath, text.replace(/^\n/, ""), "utf8");
  console.log(`✅ .env.local update ho gaya (${envPath})\n`);
  console.log("Ab bhi Vercel me alag se daalna padega — neeche wali value use karo:\n");
} else {
  console.log("\nVercel -> Settings -> Environment Variables me ye teen daalo.");
  console.log("Har ek me Production + Preview + Development — teenon tick karo.\n");
}

for (const [k, v] of Object.entries(vars)) {
  console.log(`${k}`);
  console.log(v);
  console.log("");
}

console.log("⚠️  FIREBASE_PRIVATE_KEY paste karte waqt:");
console.log("   - ek hi line rehne do, enter mat dabao");
console.log("   - shuru/aakhir me double quotes mat lagao");
console.log("   - \\n ko waise ka waisa rehne do\n");
console.log("Teenon daalne ke baad Vercel par REDEPLOY karna zaroori hai.\n");
console.log("⚠️  Ye file secret hai — git me commit mat karna, chat me mat bhejna.");
