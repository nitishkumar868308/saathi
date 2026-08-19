/**
 * Image mask ka asli saboot (24.6) — MP4 se naapa hua.
 *
 * ⚠️ Ek hi sawaal, aur wo poore feature ka hai: **tasveer se bana mask sach me
 * lagta hai?** `mask.assetId` schema me Phase 14 se pada tha par usse koi CSS
 * banti hi nahi thi — yaani wo field kuch nahi karti thi. Aisi cheez ka
 * "implement ho gaya" kehna sabse aasan jhooth hota hai, kyunki code padhne par
 * sab theek dikhta hai.
 *
 * Isliye yahan do render hote hain aur unki **tulna** hoti hai:
 *   (a) bina mask ke — poora aayat dikhna chahiye
 *   (b) tasveer wale mask ke saath — sirf baayan aadha dikhna chahiye
 *
 * Sirf (b) naapna kaafi nahi hota: agar shape hi na bani ho to daayan aadha bhi
 * khaali hoga aur test paas ho jaayega.
 *
 * Chalao:
 *   npm run render:mask --workspace @reel/worker
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  addItem,
  addTrack,
  createEmptyProject,
  createItem,
  safeParseDoc,
  setItemsProperty,
  setMask,
  type Doc,
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

/** Frame ke baayen aur daayen aadhe ka औsat ujaala (0..255). */
async function halves(
  video: string,
  width: number,
  height: number,
  scratchDir: string,
  tag: string,
): Promise<{ left: number; right: number }> {
  const raw = resolve(scratchDir, `${tag}.gray`);
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", video,
    "-ss", "0.500",
    "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "gray",
    raw,
  ]);
  const bytes = await readFile(raw);
  await rm(raw, { force: true });

  let leftSum = 0;
  let leftCount = 0;
  let rightSum = 0;
  let rightCount = 0;

  /*
   * ⚠️ Beech ki patti (±5%) chhod di jaati hai. Mask ki seema theek beech me
   * hai, aur wahan ek-do pixel ka antar h.264 ke apne blur se bhi aa jaata hai
   * — us patti ko ginne par naap seema ki tikhaas naapne lagti hai, jabki
   * sawaal ye hai ki mask laga ya nahi.
   */
  const skipFrom = Math.round(width * 0.45);
  const skipTo = Math.round(width * 0.55);

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (x >= skipFrom && x < skipTo) continue;
      const value = bytes[y * width + x] ?? 0;
      if (x < skipFrom) {
        leftSum += value;
        leftCount += 1;
      } else {
        rightSum += value;
        rightCount += 1;
      }
    }
  }

  return {
    left: leftCount > 0 ? leftSum / leftCount : 0,
    right: rightCount > 0 ? rightSum / rightCount : 0,
  };
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "../..");
  const outDir = resolve(root, "render-out", "mask");
  const scratchDir = resolve(root, "render-out", ".scratch-mask");
  const publicDir = resolve(scratchDir, "public");

  await rm(scratchDir, { recursive: true, force: true });
  await mkdir(publicDir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  /* ------------------------------------------------------- 1. mask ki tasveer */

  section("1. mask ki tasveer (baayan safed, daayan kaala)");

  const maskName = "half-mask.png";
  const maskPath = resolve(publicDir, maskName);
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=c=white:s=540x960",
    "-f", "lavfi", "-i", "color=c=black:s=270x960",
    "-filter_complex", "[0:v][1:v]overlay=x=270:y=0",
    "-frames:v", "1",
    maskPath,
  ]);
  check("mask PNG bani", existsSync(maskPath), maskPath);

  /* ------------------------------------------------------------- 2. doc */

  section("2. doc — poora frame bharta hua aayat");

  const fps = 30;
  let doc = createEmptyProject({ name: "Mask test", presetId: "reel", fps });
  doc = addTrack(doc, { typeId: "overlay" });
  const track = doc.tracks[doc.tracks.length - 1]!;

  const item = createItem("shape", {
    fps,
    trackId: track.id,
    name: "Solid",
    startFrame: 0,
    durationInFrames: fps,
  });
  doc = addItem(doc, { item });

  /*
   * Poora frame bharne wala safed aayat. Safed isliye ki naap gray par hoti hai
   * aur background lagbhag kaala hai — farak jitna bada hoga, naap utni hi kam
   * bahas-talab hogi.
   */
  doc = setItemsProperty(doc, { itemIds: [item.id], path: "shape.widthPercent", value: 100 });
  doc = setItemsProperty(doc, { itemIds: [item.id], path: "shape.heightPercent", value: 100 });
  doc = setItemsProperty(doc, { itemIds: [item.id], path: "shape.radius", value: 0 });
  doc = setItemsProperty(doc, { itemIds: [item.id], path: "shape.fill", value: "#FFFFFF" });

  check("doc schema pass karta hai", safeParseDoc(doc).success);

  const { width, height } = doc.project;
  const engine = new RemotionRenderEngine();

  /* ----------------------------------------------------- 3. bina mask ke */

  section("3. bina mask ke — dono taraf ujaala hona chahiye");

  const plainPath = resolve(outDir, "no-mask.mp4");
  await engine.render({
    doc: doc as Doc,
    assets: { maskAsset: maskName },
    publicDir,
    outPath: plainPath,
    preset: "standard",
  });
  const plain = await halves(plainPath, width, height, scratchDir, "plain");
  console.log(`  .. baayan ${plain.left.toFixed(1)}, daayan ${plain.right.toFixed(1)}`);
  check("dono taraf aayat dikh raha hai", plain.left > 200 && plain.right > 200);

  /* -------------------------------------------------- 4. tasveer wale mask ke saath */

  section("4. tasveer wale mask ke saath — sirf baayan aadha (24.6)");

  const masked = setMask(doc as Doc, {
    itemIds: [item.id],
    mask: { shape: "rect", inset: 0, radius: 0, feather: 0, assetId: "maskAsset" },
  });
  check("mask wala doc schema pass karta hai", safeParseDoc(masked).success);

  const maskedPath = resolve(outDir, "image-mask.mp4");
  await engine.render({
    doc: masked as Doc,
    assets: { maskAsset: maskName },
    publicDir,
    outPath: maskedPath,
    preset: "standard",
  });
  const cut = await halves(maskedPath, width, height, scratchDir, "masked");
  console.log(`  .. baayan ${cut.left.toFixed(1)}, daayan ${cut.right.toFixed(1)}`);

  check("baayan aadha waisa ka waisa hai", cut.left > 200, `${cut.left.toFixed(1)}`);
  check("daayan aadha mask ne chhupa diya", cut.right < 40, `${cut.right.toFixed(1)}`);
  check(
    "mask ne sach me farak dala",
    plain.right - cut.right > 150,
    `${plain.right.toFixed(1)} -> ${cut.right.toFixed(1)}`,
  );

  console.log(`\n  output: ${outDir}`);
  await rm(scratchDir, { recursive: true, force: true }).catch(() => {});

  console.log("");
  if (failures.length > 0) {
    console.log(`FAIL: ${failures.length} — ${failures.join(" | ")}`);
    process.exitCode = 1;
    return;
  }
  console.log(`ALL PASS: ${passed} checks, 0 fail  (image mask)`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
