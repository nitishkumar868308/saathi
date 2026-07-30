#!/usr/bin/env node
/**
 * Seedha download hone wala APK link nikaalo.
 *
 * Kyun chahiye: EAS ka build page (expo.dev/accounts/.../builds/<id>) khol ke
 * doosra banda kuch download nahi kar paata — wo dashboard hai, uske liye login
 * chahiye. Asli install-hone-wala link artifact ka hota hai:
 *
 *     https://expo.dev/artifacts/eas/<hash>.apk
 *
 * Ye link public hai — jise bhejo wo bina account ke seedha download aur install
 * kar lega.
 *
 *   npm run apk            → sabse nayi Android build ka link
 *   npm run apk -- <id>    → kisi ek build ka link
 *
 * ⚠️ Do baatein yaad rakhna:
 *   1. Link ~14 din me expire ho jaata hai (build ka expirationDate). Uske baad
 *      nayi build chahiye.
 *   2. Sirf APK install hota hai. `production` profile AAB banati hai jo Play
 *      Store ke liye hai — usse koi phone par install nahi kar sakta. Bantne ke
 *      liye `--profile preview` (ya koi bhi apk profile) use karo.
 */

import { execFileSync } from "node:child_process";

const arg = process.argv[2];

function eas(args) {
  const out = execFileSync("npx", ["eas-cli", ...args], {
    encoding: "utf8",
    shell: process.platform === "win32",
    maxBuffer: 1024 * 1024 * 32,
  });
  // eas-cli JSON se pehle apne update/spinner notes chhaap deti hai — pehla
  // `[` ya `{` dhoondh ke wahin se parse karte hain.
  const start = out.search(/[[{]/);
  if (start < 0) throw new Error("eas-cli ne JSON nahi diya:\n" + out);
  return JSON.parse(out.slice(start));
}

function show(build) {
  const url =
    build?.artifacts?.applicationArchiveUrl ?? build?.artifacts?.buildUrl ?? null;

  if (!url) {
    console.error(`Build ${build?.id} ka artifact nahi mila (status: ${build?.status}).`);
    process.exit(1);
  }

  const expires = build.expirationDate ? new Date(build.expirationDate) : null;
  const days = expires
    ? Math.ceil((expires.getTime() - Date.now()) / 86_400_000)
    : null;

  console.log("");
  console.log(url);
  console.log("");
  console.log(`  profile : ${build.buildProfile}   version : ${build.appVersion} (${build.appBuildVersion})`);
  console.log(`  status  : ${build.status}`);
  if (expires) {
    console.log(`  expires : ${expires.toDateString()}${days !== null ? `  (${days} din baaki)` : ""}`);
  }
  if (!url.endsWith(".apk")) {
    console.log("");
    console.log("  ⚠️  Ye APK nahi hai (shayad AAB) — phone par install nahi hoga.");
    console.log("     APK ke liye:  eas build -p android --profile preview");
  }
  console.log("");
}

const build = arg
  ? eas(["build:view", arg, "--json"])
  : eas(["build:list", "--platform", "android", "--status", "finished", "--limit", "1", "--json"])[0];

if (!build) {
  console.error("Koi finished Android build nahi mili.");
  process.exit(1);
}

show(build);
