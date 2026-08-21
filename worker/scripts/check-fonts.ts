/**
 * Font staging ka test (17.13 / render).
 *
 * ⚠️ Ye us bug ka pehra hai jo sabse chup-chaap chalta tha: preview me font
 * dikhta tha aur MP4 me system font nikalta tha, kyunki worker `fonts` bhejta hi
 * nahi tha aur file bhi `publicDir` me nahi jaati thi.
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { requestedFamilies, stageFontAssets, stageFonts } from "../src/fonts";

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

async function fakeRepo(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "reel-fonts-"));
  await mkdir(resolve(root, "studio/public/fonts"), { recursive: true });
  return root;
}

async function main(): Promise<void> {
  console.log("\nfont staging (render me wahi font jo preview me)");

  await test("fonts.json ki entry aur uski file dono publicDir me jaati hain", async () => {
    const root = await fakeRepo();
    const fontsDir = resolve(root, "studio/public/fonts");
    // Asli woff2 ki zaroorat nahi — staging sirf file copy karti hai.
    await writeFile(resolve(fontsDir, "test-700.woff2"), "not-a-real-font");
    await writeFile(
      resolve(fontsDir, "fonts.json"),
      JSON.stringify([
        {
          id: "TestFont",
          label: "Test",
          fallback: "sans-serif",
          files: [{ file: "test-700.woff2", weight: 700, style: "normal" }],
          weights: [700],
        },
      ]),
    );

    const publicDir = resolve(root, "job/public");
    const staged = await stageFonts(publicDir, root);

    assert.equal(staged.fonts.length, 1, "entry render tak jaani chahiye");
    assert.equal(staged.fonts[0]?.id, "TestFont");
    assert.ok(
      existsSync(resolve(publicDir, "fonts/test-700.woff2")),
      "file bhi jaani chahiye — sirf list bhejne par browser ko file milti hi nahi",
    );
    await rm(root, { recursive: true, force: true });
  });

  await test("file na ho to entry list se hat'ti hai (jhoothi list nahi banti)", async () => {
    /*
     * Sirf list bhej dena sabse bura jawab hai: CSS ban jaata hai, browser file
     * dhoondhta hai, nahi milti, aur chup-chaap fallback lag jaata hai. Entry
     * hata dene par `missingFonts()` ki chetavni chalti hai.
     */
    const root = await fakeRepo();
    await writeFile(
      resolve(root, "studio/public/fonts/fonts.json"),
      JSON.stringify([
        { id: "Gayab", label: "Gayab", files: [{ file: "nahi-hai.woff2", weight: 400, style: "normal" }] },
      ]),
    );
    const staged = await stageFonts(resolve(root, "job/public"), root);
    assert.equal(staged.fonts.length, 0, "bina file wali entry nahi jaani chahiye");
    assert.equal(staged.skipped.length > 0, true, "wajah bhi likhi honi chahiye");
    await rm(root, { recursive: true, force: true });
  });

  await test("system font (bina file wala) waise ka waisa jaata hai", async () => {
    const root = await fakeRepo();
    await writeFile(
      resolve(root, "studio/public/fonts/fonts.json"),
      JSON.stringify([{ id: "Georgia", label: "Serif", files: [] }]),
    );
    const staged = await stageFonts(resolve(root, "job/public"), root);
    assert.equal(staged.fonts.length, 1);
    await rm(root, { recursive: true, force: true });
  });

  await test("`../` wali file repo ke bahar nahi ja sakti", async () => {
    // Path traversal — file user ki apni hai, par ye code worker me chalta hai.
    const root = await fakeRepo();
    await writeFile(
      resolve(root, "studio/public/fonts/fonts.json"),
      JSON.stringify([
        { id: "Bahar", label: "Bahar", files: [{ file: "../../../secret.woff2", weight: 400, style: "normal" }] },
      ]),
    );
    const staged = await stageFonts(resolve(root, "job/public"), root);
    assert.equal(staged.fonts.length, 0, "bahar ki file na copy ho, na list me aaye");
    await rm(root, { recursive: true, force: true });
  });

  await test("fonts.json na ho to kuch nahi — ye aam haalat hai, error nahi", async () => {
    const root = await fakeRepo();
    const staged = await stageFonts(resolve(root, "job/public"), root);
    assert.deepEqual(staged, { fonts: [], copied: [], skipped: [] });
    await rm(root, { recursive: true, force: true });
  });

  console.log(`\n${"-".repeat(60)}`);
  if (failures.length > 0) {
    console.log(`FAILED: ${failures.length} fail, ${passed} pass`);
    for (const f of failures) console.log(`  - ${f.name}: ${f.error}`);
    process.exit(1);
  }
  console.log("\nupload kiye hue font (brand fonts)");

  const docWith = (family: string | null) =>
    ({
      items: [
        { id: "it_1", type: "text", text: family === null ? {} : { fontFamily: family } },
        { id: "it_2", type: "image" },
      ],
    }) as never;

  await test("doc se sirf asli font ke naam nikalte hain — brand token nahi", () => {
    assert.deepEqual(requestedFamilies(docWith("Poppins-Bold")), ["Poppins-Bold"]);
    // Brand token render ke waqt asli naam banta hai; usko font ka naam samajhna
    // ek aisi file dhoondhna hoga jo hai hi nahi.
    assert.deepEqual(requestedFamilies(docWith("brand.font.display")), []);
    assert.deepEqual(requestedFamilies(docWith(null)), []);
  });

  await test("maanga gaya font utarta hai, aur uski entry naam par banti hai", async () => {
    const root = await fakeRepo();
    const publicDir = resolve(root, "job/public");
    const staged = await stageFontAssets(
      publicDir,
      docWith("Poppins-Bold"),
      [{ id: "as_9", filename: "Poppins-Bold.woff2", key: "permanent/assets/as_9.woff2" }],
      async () => new Uint8Array([1, 2, 3]),
    );
    assert.equal(staged.fonts.length, 1);
    assert.equal(staged.fonts[0]?.id, "Poppins-Bold", "family file ke naam se");
    assert.equal(staged.fonts[0]?.files[0]?.file, "as_9.woff2", "render me sirf naam, URL nahi");
    assert.ok(existsSync(resolve(publicDir, "fonts/as_9.woff2")), "file bhi utarni chahiye");
    await rm(root, { recursive: true, force: true });
  });

  await test("jo font doc me maanga hi nahi, wo nahi utarta", async () => {
    /*
     * Poori library har render me utaarna bekaar ka MB hai — aur wo bojh har job
     * par lagta hai, ek baar nahi.
     */
    const root = await fakeRepo();
    const staged = await stageFontAssets(
      resolve(root, "job/public"),
      docWith("Poppins-Bold"),
      [{ id: "as_x", filename: "Kuch-Aur.woff2", key: "k" }],
      async () => new Uint8Array([1]),
    );
    assert.equal(staged.fonts.length, 0);
    assert.equal(staged.copied.length, 0);
    await rm(root, { recursive: true, force: true });
  });

  await test("storage se file na mile to entry nahi banti, par wajah likhi jaati hai", async () => {
    const root = await fakeRepo();
    const staged = await stageFontAssets(
      resolve(root, "job/public"),
      docWith("Poppins-Bold"),
      [{ id: "as_9", filename: "Poppins-Bold.woff2", key: "gayab" }],
      async () => null,
    );
    assert.equal(staged.fonts.length, 0, "jhoothi entry se fallback chup-chaap lagta hai");
    assert.equal(staged.skipped.length, 1);
    await rm(root, { recursive: true, force: true });
  });

  console.log(`ALL PASS: ${passed} tests, 0 fail`);
}

void main();
