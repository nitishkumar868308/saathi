/**
 * Bundle cache ka test.
 *
 * ⚠️ Yahan sawaal "cache kaam karta hai kya" nahi hai — sawaal ye hai ki **cache
 * jhooth to nahi bolta**. Purana bundle chup-chaap chalte rehna sabse chidhane
 * wali cheez hai: "maine to theek kar diya tha, video me kyun nahi aaya". Isliye
 * asli test yahi hai ki ek line badalne par chaabi badal jaaye.
 */

import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import {
  cachedBundle,
  forgetBundle,
  rememberBundle,
  sourceFingerprint,
} from "../src/engines/bundleCache";

let passed = 0;
const failures: { name: string; error: string }[] = [];

async function test(name: string, run: () => Promise<void> | void): Promise<void> {
  try {
    await run();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures.push({ name, error: error instanceof Error ? error.message : String(error) });
    console.log(`  FAIL ${name}\n       ${String(error).split("\n")[0]}`);
  }
}

async function fakeRepo(): Promise<{ root: string; entry: string; file: string }> {
  const root = await mkdtemp(join(tmpdir(), "reel-bundle-"));
  await mkdir(resolve(root, "packages/reel-remotion/src"), { recursive: true });
  await mkdir(resolve(root, "packages/reel-core/src"), { recursive: true });
  const entry = resolve(root, "packages/reel-remotion/src/entry.ts");
  const file = resolve(root, "packages/reel-core/src/thing.ts");
  await writeFile(entry, "export const a = 1;");
  await writeFile(file, "export const b = 1;");
  return { root, entry, file };
}

async function main(): Promise<void> {
  console.log("\nbundle cache — tezi, par jhooth nahi");

  await test("kuch na badle to chaabi wahi rehti hai", async () => {
    const { root, entry } = await fakeRepo();
    const a = sourceFingerprint(root, entry);
    const b = sourceFingerprint(root, entry);
    assert.equal(a, b);
    await rm(root, { recursive: true, force: true });
  });

  await test("source ki ek line badalte hi chaabi badal jaati hai", async () => {
    const { root, entry, file } = await fakeRepo();
    const before = sourceFingerprint(root, entry);
    await writeFile(file, "export const b = 2;   // ek line badli");
    const after = sourceFingerprint(root, entry);
    assert.notEqual(before, after, "purana bundle chup-chaap chalte rehna sabse bura hai");
    await rm(root, { recursive: true, force: true });
  });

  await test("sirf mtime badalne par bhi chaabi badalti hai", async () => {
    /*
     * File wahi, size wahi, par usko chhua gaya — jaise `git checkout` ke baad
     * hota hai. Aisi halat me naya bundle banana thoda mehnga hai, par ulta
     * (purana chalate rehna) bahut zyada mehnga hota hai.
     */
    const { root, entry, file } = await fakeRepo();
    const before = sourceFingerprint(root, entry);
    const future = new Date(Date.now() + 60_000);
    await utimes(file, future, future);
    assert.notEqual(before, sourceFingerprint(root, entry));
    await rm(root, { recursive: true, force: true });
  });

  await test("entry file badalne par bhi chaabi badalti hai", async () => {
    const { root, entry } = await fakeRepo();
    const before = sourceFingerprint(root, entry);
    await writeFile(entry, "export const a = 2;");
    assert.notEqual(before, sourceFingerprint(root, entry));
    await rm(root, { recursive: true, force: true });
  });

  await test("naya file jodne par chaabi badalti hai", async () => {
    const { root, entry } = await fakeRepo();
    const before = sourceFingerprint(root, entry);
    await writeFile(resolve(root, "packages/reel-core/src/naya.ts"), "export const c = 3;");
    assert.notEqual(before, sourceFingerprint(root, entry));
    await rm(root, { recursive: true, force: true });
  });

  await test("cache sirf usi chaabi par milta hai", () => {
    forgetBundle();
    assert.equal(cachedBundle("abc"), null, "khaali cache me kuch nahi");
    rememberBundle("abc", "file:///bundle-1");
    assert.equal(cachedBundle("abc"), "file:///bundle-1");
    assert.equal(cachedBundle("xyz"), null, "doosri chaabi par purana bundle NAHI milna chahiye");
    forgetBundle();
    assert.equal(cachedBundle("abc"), null);
  });

  console.log(`\n${"-".repeat(60)}`);
  if (failures.length > 0) {
    console.log(`FAILED: ${failures.length} fail, ${passed} pass`);
    for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
    process.exit(1);
  }
  console.log(`ALL PASS: ${passed} tests, 0 fail`);
}

void main();
