/**
 * Phase 17 ka asli saboot (17.14) — template se do MP4.
 *
 * ⚠️ Ye `render-sample.ts` se alag script hai, aur wo jaan-boojhkar hai. Sample
 * script ke aath naap Ken Burns ke frame numbers par bandhe hue hain; usme
 * template ka doc daalne ka matlab hota un sab naapon ko todna. Do alag sawaal
 * hain, isliye do alag scripts.
 *
 * Ye teen cheezein naapta hai:
 *  1. Ek hi template 9:16 aur 1:1 dono par bina toote lagta hai (17.4)
 *  2. Dono me wahi scenes, wahi kram
 *  3. Brand preset badalne se **render ke pixels** badalte hain (17.11)
 *
 * Teesra sabse zaroori hai: token system poora likha ho aur render use padhta hi
 * na ho — ye galti sirf pixel naap kar pakdi ja sakti hai.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  applyTemplate,
  findTemplate,
  requireSizePreset,
  safeParseDoc,
  setBrandPreset,
  type Doc,
  type Template,
} from "@reel/core";
import { ffmpegPath, run } from "@reel/media";

import { RemotionRenderEngine } from "../src/engines/remotion";

let passed = 0;
const failures: string[] = [];

function check(label: string, ok: boolean, detail = ""): void {
  if (ok) {
    passed += 1;
    console.log(`  ok   ${label}${detail ? ` — ${detail}` : ""}`);
    return;
  }
  failures.push(label);
  console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
}

function section(title: string): void {
  console.log(`\n${title}`);
}

/**
 * Frame ke ek hisse ka average rang.
 *
 * Rang naapne ke liye — kyunki brand badalne par yahi badalta hai. Sirf luma se
 * kaam nahi chalta: do alag rang ek hi luma ke ho sakte hain.
 */
async function meanColor(
  video: string,
  atSeconds: number,
  width: number,
  height: number,
  scratchDir: string,
): Promise<{ r: number; g: number; b: number; maxChroma: number }> {
  const raw = resolve(scratchDir, `rgb-${Math.round(atSeconds * 1000)}.rgb`);
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", video,
    "-ss", atSeconds.toFixed(3),
    "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "rgb24",
    raw,
  ]);
  const bytes = await readFile(raw);
  await rm(raw, { force: true });

  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  let maxChroma = 0;

  // Har 8va pixel — poora frame padhna is naap ke liye zaroori nahi.
  for (let y = 0; y < height; y += 8) {
    for (let x = 0; x < width; x += 8) {
      const offset = (y * width + x) * 3;
      const pr = bytes[offset] ?? 0;
      const pg = bytes[offset + 1] ?? 0;
      const pb = bytes[offset + 2] ?? 0;
      r += pr;
      g += pg;
      b += pb;
      count += 1;

      /*
       * Sabse rangeen pixel — `max - min` channel ka farak.
       *
       * ⚠️ Ye naap poore frame ke average se **kahin behtar** hai, aur wo galti
       * yahan pakdi gayi: average pehle 9.9 aur phir 11.4 aaya, kyunki frame ka
       * 90% background hai aur dono presets ka background gehra hai. Rangeen
       * hissa (CTA band) chhota hai par uska rang bilkul alag hai —
       * apka-saathi ka #C25A37 ki chroma 139 hai, mono-dark ke #E8E4DD ki 11.
       * Chroma us chhote hisse ko chhupne nahi deti.
       */
      maxChroma = Math.max(maxChroma, Math.max(pr, pg, pb) - Math.min(pr, pg, pb));
    }
  }
  return { r: r / count, g: g / count, b: b / count, maxChroma };
}

function colorDistance(a: { r: number; g: number; b: number }, b: { r: number; g: number; b: number }): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "../..");
  const outDir = resolve(root, "render-out", "templates");
  const scratchDir = resolve(root, "render-out", ".scratch-template");

  await rm(scratchDir, { recursive: true, force: true });
  await mkdir(scratchDir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  // Koi asset nahi hai, par Remotion ko ek publicDir chahiye hi hota hai.
  const publicDir = resolve(scratchDir, "public");
  await mkdir(publicDir, { recursive: true });

  const engine = new RemotionRenderEngine();

  section("1. template se doc");
  const template = findTemplate("rahul-papa") as Template;
  check("template mila", Boolean(template), template?.name);

  /*
   * Sirf text wale slots bhare gaye hain — asset wale nahi.
   *
   * Ye jaan-boojhkar hai: is script ke paas koi asli media file nahi hai, aur
   * banane ka matlab hota `render-sample` ka poora setup dobara likhna. Text
   * wale scenes se ye teeno sawaal poore jawab de dete hain, aur jo scene asset
   * ke bina nahi banta wo `skipped` me saaf dikh jaata hai.
   */
  const slots = {
    rahulLine: "Papa, pension ka kaam hua?",
    papaLine: "Teen baar gaya, har baar naya kagaz.",
    problemLine: "Process kisi ko poora pata hi nahi hota.",
    ctaLine: "Apka Saathi par poora process dekho",
  };

  const variants: { presetId: string; label: string }[] = [
    { presetId: "reel", label: "9x16" },
    { presetId: "square", label: "1x1" },
  ];

  const built: { label: string; doc: Doc; skipped: number }[] = [];
  for (const variant of variants) {
    const result = applyTemplate({ template, slots, presetId: variant.presetId });
    const preset = requireSizePreset(variant.presetId);

    check(
      `${variant.label}: doc bana (${result.doc.scenes.length} scene)`,
      safeParseDoc(result.doc).success && result.doc.scenes.length > 0,
      `${preset.width}x${preset.height}, ${result.skipped.length} scene chhoote (asset nahi tha)`,
    );
    built.push({ label: variant.label, doc: result.doc, skipped: result.skipped.length });
  }

  check(
    "dono size par ek hi scenes, ek hi kram (17.4)",
    JSON.stringify(built[0]?.doc.scenes.map((scene) => scene.type)) ===
      JSON.stringify(built[1]?.doc.scenes.map((scene) => scene.type)),
    built.map((entry) => `${entry.label}: ${entry.doc.scenes.map((s) => s.type).join(">")}`).join(" | "),
  );

  section("2. render — dono size");
  const rendered: { label: string; path: string; doc: Doc }[] = [];

  for (const entry of built) {
    const output = resolve(outDir, `rahul-papa-${entry.label}.mp4`);
    await engine.render({
      doc: entry.doc,
      assets: {},
      publicDir,
      outPath: output,
      preset: "standard",
    });
    check(`${entry.label} render hua`, existsSync(output), output);
    rendered.push({ label: entry.label, path: output, doc: entry.doc });
  }

  section("3. brand badalne se render ke pixels badalte hain (17.11)");
  /*
   * Ek hi doc, do alag brand. Agar render token padhta hi na ho to dono MP4
   * bilkul ek jaise nikalte — aur wahi wo galti thi jo yahan pakdi gayi.
   */
  const base = built[0]?.doc as Doc;
  const dark = setBrandPreset(base, { presetId: "apka-saathi" });
  const mono = setBrandPreset(base, { presetId: "mono-dark" });

  /*
   * Background `brand.primary` par — aur ye ek naap-kar liya faisla hai.
   *
   * Pehle `brand.background` use kiya tha aur fasla sirf 9.9 aaya; phir CTA
   * scene par naapa aur 11.4 aaya. Dono baar naap galat nahi thi — sawaal galat
   * tha. Dono presets ka background gehra hai, aur frame ka 90% wahi hai, isliye
   * ek asli badlav bhi chhota dikhta tha.
   *
   * `brand.primary` do presets me sabse zyada alag hai (#C25A37 vs #E8E4DD:
   * gehra terracotta vs halka grey). Poora frame usi rang ka hone par sawaal
   * bilkul saaf ho jaata hai: **render token padhta hai ya nahi**. Agar nahi
   * padhta, to dono MP4 bilkul ek jaise nikalte.
   */
  const withTokenBackground = (doc: Doc): Doc => ({
    ...doc,
    project: { ...doc.project, background: "brand.primary" },
  });

  const darkPath = resolve(outDir, "brand-apka-saathi.mp4");
  const monoPath = resolve(outDir, "brand-mono-dark.mp4");

  await engine.render({
    doc: withTokenBackground(dark),
    assets: {},
    publicDir,
    outPath: darkPath,
    preset: "standard",
  });
  await engine.render({
    doc: withTokenBackground(mono),
    assets: {},
    publicDir,
    outPath: monoPath,
    preset: "standard",
  });

  const { width, height, fps, durationInFrames } = base.project;

  /*
   * Naap **CTA wale scene par** hoti hai, shuruaat par nahi.
   *
   * CTA ka band `brand.primary` par hai, aur wahi wo token hai jo do presets me
   * sabse zyada alag hota hai (#C25A37 vs #E8E4DD). Pehle 0.5s par naapa tha aur
   * fasla sirf 9.9 aaya — kyunki wahan sirf background aur thoda text dikhta hai,
   * aur dono presets ka background lagbhag ek jaisa gehra hai. Naap galat nahi
   * thi, jagah galat thi.
   */
  const ctaSeconds = Math.max(0.5, durationInFrames / fps - 1.5);
  const darkColor = await meanColor(darkPath, ctaSeconds, width, height, scratchDir);
  const monoColor = await meanColor(monoPath, ctaSeconds, width, height, scratchDir);

  console.log(`  .. naap ${ctaSeconds.toFixed(2)}s par (CTA scene)`);
  console.log(
    `  .. apka-saathi: rgb(${darkColor.r.toFixed(0)}, ${darkColor.g.toFixed(0)}, ${darkColor.b.toFixed(0)})`,
  );
  console.log(
    `  .. mono-dark  : rgb(${monoColor.r.toFixed(0)}, ${monoColor.g.toFixed(0)}, ${monoColor.b.toFixed(0)})`,
  );

  console.log(
    `  .. sabse rangeen pixel: apka-saathi ${darkColor.maxChroma}, mono-dark ${monoColor.maxChroma}`,
  );

  const distance = colorDistance(darkColor, monoColor);
  check(
    "brand preset badalne se MP4 ke rang sach me badle",
    distance > 100,
    `rang ka fasla ${distance.toFixed(1)} (0 ka matlab hota render token padhta hi nahi)`,
  );
  check(
    "apka-saathi ka primary sach me rangeen hai, mono-dark ka nahi",
    darkColor.maxChroma - monoColor.maxChroma > 60,
    `chroma ${darkColor.maxChroma} vs ${monoColor.maxChroma}`,
  );

  /*
   * Aur naapi hui value expected ke paas honi chahiye — sirf "alag hai" kaafi
   * nahi. `#C25A37` = rgb(194, 90, 55). Text upar hai isliye average thoda
   * halka aayega, par 25 ke andar hona chahiye.
   */
  const expected = { r: 194, g: 90, b: 55 };
  check(
    "naapa hua rang #C25A37 ke paas hai",
    colorDistance(darkColor, expected) < 25,
    `fasla ${colorDistance(darkColor, expected).toFixed(1)}`,
  );

  await rm(scratchDir, { recursive: true, force: true });

  console.log(`\n${"-".repeat(60)}`);
  if (failures.length > 0) {
    console.log(`FAILED: ${failures.length} fail, ${passed} pass`);
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`ALL PASS: ${passed} checks, 0 fail  (templates)`);
}

void main();
