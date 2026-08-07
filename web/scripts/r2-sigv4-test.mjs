/**
 * `lib/r2.ts` ke SigV4 presigning ko AWS ke apne documented example se jaanchta
 * hai.
 *
 *     node scripts/r2-sigv4-test.mjs
 *
 * Ye asli R2 se baat nahi karta — koi credential ya net nahi chahiye. Ye sirf
 * ye dekhta hai ki hamara signature bilkul wahi banta hai jo AWS ke docs me
 * chhapa hua hai ("Authenticating Requests: Using Query Parameters", GET
 * presigned URL wala example).
 *
 * ⚠️ Ye jaanch isliye hai kyunki signature galat hone par R2 sirf `403` deta
 * hai — kya galat tha, ye kabhi nahi batata. Bina is test ke ek chhote se
 * encoding ke farq ka pata sirf tab chalta jab upload live me tootta.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const out = mkdtempSync(join(tmpdir(), "r2-sigv4-"));

try {
  // r2.ts ko chalne layak JS me badlo (test hi asli source ko chala raha hai —
  // koi doosri copy nahi, warna test paas hota rehta aur asli code toota rehta).
  //
  // tsc ko `npx` ke bajaye seedha node se chalate hain: Windows par Node 20
  // `.cmd` ko bina shell ke spawn karne se mana kar deta hai (EINVAL), aur
  // shell laga dena quoting ka apna alag jhamela hai.
  execFileSync(
    process.execPath,
    [
      "./node_modules/typescript/bin/tsc",
      "lib/r2.ts",
      "--outDir",
      out,
      "--module",
      "es2022",
      "--target",
      "es2022",
      "--moduleResolution",
      "bundler",
      "--skipLibCheck",
    ],
    { stdio: "inherit" },
  );

  const { presignUrl } = await import(pathToFileURL(join(out, "r2.js")).href);

  // --- AWS ka documented example ------------------------------------------
  const url = presignUrl({
    method: "GET",
    host: "examplebucket.s3.amazonaws.com",
    path: "/test.txt",
    region: "us-east-1",
    service: "s3",
    accessKeyId: "AKIAIOSFODNN7EXAMPLE",
    secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    expiresIn: 86400,
    now: new Date("2013-05-24T00:00:00Z"),
  });

  const EXPECTED_SIGNATURE =
    "aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404";

  const got = new URL(url).searchParams.get("X-Amz-Signature");

  console.log("\nURL:", url, "\n");

  if (got !== EXPECTED_SIGNATURE) {
    console.error("❌ Signature match NAHI hua.");
    console.error("   mila  :", got);
    console.error("   chahiye:", EXPECTED_SIGNATURE);
    process.exit(1);
  }

  console.log("✅ SigV4 signature AWS ke documented example se bilkul milta hai.");
} finally {
  rmSync(out, { recursive: true, force: true });
}
