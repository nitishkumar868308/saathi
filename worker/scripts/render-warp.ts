/**
 * Bolti tasveer ka darwaza (spike) — **SVG ka mesh sach me kheenchta hai?**
 *
 * ```
 * npm run render:warp --workspace @reel/worker
 * ```
 *
 * ⚠️ Poore feature ka render isi ek baat par tika hai. Muh asli tasveer ke apne
 * honth se banega: landmarks se ek triangle mesh, jo har frame par hilta hai.
 * Wo tabhi mumkin hai jab `clip-path` + `<image transform>` Chromium ke
 * screenshot me theek se aaye.
 *
 * ⚠️ **Canvas jaan-boojhkar nahi.** Canvas par draw karna async hai aur Remotion
 * ke screenshot se race karta hai — nateeja beech-beech me purana ya khaali
 * frame, jo sirf bane hue MP4 me dikhta hai (preview me nahi). SVG DOM hai: jo
 * likha hai wahi screenshot me aata hai, har baar. Ye spike usi ko naapta hai.
 *
 * ⚠️ Do render hote hain aur unki **tulna** hoti hai — ek hi kaafi nahi hota.
 * Yahi seekh `render-mask.ts` me likhi hai: agar SVG render hi na hua ho to
 * frame khaali hoga, aur "seema apni jagah nahi hai" waise bhi sach nikal
 * aayega. Isliye pehle ye saabit hota hai ki bina warp wali tasveer THEEK aati
 * hai, aur tabhi warp ka matlab banta hai.
 */

import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { ffmpegPath, run } from "@reel/media";

import { CUT_BOTTOM, CUT_TOP, WARP_COMPOSITION_ID, WARP_SIZE } from "./warp-spike/WarpRoot";

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

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "..", "..", "render-out", "warp-spike");

/**
 * Test tasveer: baayan aadha kaala, daayan aadha safed.
 *
 * ⚠️ Ye ffmpeg se banti hai, haath se likhe PNG bytes se nahi. Ek galat PNG
 * header par Chromium tasveer chup-chaap chhod deta hai (koi error nahi), aur
 * phir ye spike "mesh kaam nahi karta" bolta — jabki galti tasveer me hoti.
 */
async function makeTestImage(): Promise<string> {
  const png = resolve(outDir, "source.png");
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", `color=black:size=${WARP_SIZE / 2}x${WARP_SIZE}`,
    "-f", "lavfi", "-i", `color=white:size=${WARP_SIZE / 2}x${WARP_SIZE}`,
    "-filter_complex", "[0:v][1:v]hstack=inputs=2",
    "-frames:v", "1",
    png,
  ]);
  const bytes = await readFile(png);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

/** Poore frame ke gray pixel — ek hi baar padho, phir jitna chaaho naapo. */
async function grayPixels(png: string, tag: string): Promise<Uint8Array> {
  const raw = resolve(outDir, `${tag}.gray`);
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", png,
    "-f", "rawvideo", "-pix_fmt", "gray",
    raw,
  ]);
  const bytes = await readFile(raw);
  await rm(raw, { force: true });
  return new Uint8Array(bytes);
}

/** Ek chhote chaukor ka ausat ujaala (0..255) — 0 = kaala, 255 = safed. */
function patch(pixels: Uint8Array, xFraction: number, yFraction: number): number {
  const cx = Math.round(WARP_SIZE * xFraction);
  const cy = Math.round(WARP_SIZE * yFraction);
  let sum = 0;
  let count = 0;
  for (let y = cy - 3; y <= cy + 3; y += 1) {
    for (let x = cx - 3; x <= cx + 3; x += 1) {
      if (x < 0 || y < 0 || x >= WARP_SIZE || y >= WARP_SIZE) continue;
      sum += pixels[y * WARP_SIZE + x] ?? 0;
      count += 1;
    }
  }
  return count === 0 ? 0 : sum / count;
}

/**
 * Jod ki lakeer ginti — **kitne pixel na kaale hain na safed**.
 *
 * ⚠️ Ye jaanch qatar ke *ausat* se nahi ho sakti, aur wahi is spike ki pehli
 * galti thi: ek patli lakeer poori qatar ke ausat ko mushkil se hilati hai,
 * yaani naap "sab theek hai" bolta hai jabki bani hui tasveer me lakeer saaf
 * dikhti hai.
 *
 * Test tasveer me sirf do rang hain — bilkul kaala aur bilkul safed. Peeche
 * bhoora hai. Isliye beech ka koi bhi pixel matlab wahan peeche ka bhoora jhaank
 * raha hai, yaani do triangle ke beech gap hai.
 */
function seamPixels(pixels: Uint8Array, warp: boolean): number {
  let count = 0;
  for (let y = 0; y < WARP_SIZE; y += 1) {
    /*
     * ⚠️ Kaale-safed ki asli seema chhod di jaati hai — wahan ek-do pixel ka
     * dhundhlapan antialiasing se aata hi hai aur wo bilkul theek hai. Sawaal
     * jod ki lakeer ka hai, seema ki tikhaas ka nahi.
     *
     * Warp par seema tirchi hai, isliye wo har qatar par alag jagah hoti hai —
     * ek hi x chhod dena yahan kaam nahi karta.
     */
    const t = y / WARP_SIZE;
    const boundary = warp
      ? WARP_SIZE * (CUT_TOP + (CUT_BOTTOM - CUT_TOP) * t)
      : WARP_SIZE / 2;

    for (let x = 0; x < WARP_SIZE; x += 1) {
      if (Math.abs(x - boundary) <= 3) continue;
      const value = pixels[y * WARP_SIZE + x] ?? 0;
      if (value > 60 && value < 200) count += 1;
    }
  }
  return count;
}

const DARK = 80;
const BRIGHT = 175;

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });

  console.log("\nbundle ban raha hai…");
  const serveUrl = await bundle({
    entryPoint: resolve(here, "warp-spike", "entry.tsx"),
    onProgress: () => undefined,
  });

  const imageUrl = await makeTestImage();

  async function still(warp: boolean): Promise<Uint8Array> {
    const inputProps = { imageUrl, warp };
    const composition = await selectComposition({ serveUrl, id: WARP_COMPOSITION_ID, inputProps });
    const out = resolve(outDir, warp ? "warped.png" : "plain.png");
    await renderStill({ composition, serveUrl, output: out, inputProps, frame: 0 });
    return grayPixels(out, warp ? "warped" : "plain");
  }

  const plain = await still(false);
  const warped = await still(true);

  /* ---------------------------------------------------------- pehle: saada */

  /*
   * ⚠️ Ye do jaanch pehle aati hain, aur wahi is spike ko imaandaar banata hai.
   * Inke bina "warp ho gaya" wali jaanch khaali frame par bhi paas ho sakti hai.
   */
  console.log("\nbina warp — tasveer theek aati hai?");
  const plainLeft = patch(plain, 0.35, 0.3);
  const plainRight = patch(plain, 0.8, 0.3);
  check("35% par kaala", plainLeft < DARK, `naap ${plainLeft.toFixed(0)}`);
  check("80% par safed", plainRight > BRIGHT, `naap ${plainRight.toFixed(0)}`);

  /* ------------------------------------------------------------ ab: warp */

  /*
   * ⚠️ Asli sawaal yahi hai: seema UPAR aur NEECHE alag-alag khiski ya nahi.
   * Dono jagah barabar khiskna matlab poore mesh par ek hi transform laga — wo
   * ek saada scale hota, mesh nahi. Asli muh me har triangle apni disha me hilta
   * hai, aur yahi wo halat hai jise ye spike naapta hai.
   */
  console.log("\nwarp ke saath — har triangle apni tarah kheencha?");
  const topAt35 = patch(warped, 0.35, 0.12);
  const bottomAt35 = patch(warped, 0.35, 0.88);
  const bottomAt90 = patch(warped, 0.9, 0.88);

  check(
    "upar 35% par SAFED — wahan seema 25% par chali gayi",
    topAt35 > BRIGHT,
    `naap ${topAt35.toFixed(0)} (bina warp ${plainLeft.toFixed(0)} tha)`,
  );
  check(
    "neeche usi 35% par KAALA — wahan seema 75% par gayi",
    bottomAt35 < DARK,
    `naap ${bottomAt35.toFixed(0)} — yahi saabit karta hai ki har triangle ko apni matrix mili`,
  );
  check("neeche 90% par safed", bottomAt90 > BRIGHT, `naap ${bottomAt90.toFixed(0)}`);

  /* ------------------------------------------------------ jod ki lakeer */

  console.log("\njod ki lakeer — do triangle ke beech gap to nahi?");
  const plainSeam = seamPixels(plain, false);
  const warpSeam = seamPixels(warped, true);

  check("bina warp — koi gap nahi", plainSeam === 0, `${plainSeam} pixel na kaale na safed`);
  check(
    "warp ke saath — koi gap nahi",
    warpSeam === 0,
    `${warpSeam} pixel na kaale na safed — chehre par ye muh ke aar-paar dhundhli lakeer bankar dikhta`,
  );

  console.log(`\nPNG dekhne ke liye: ${outDir}`);
  console.log(`\n${passed} ok, ${failures.length} fail`);
  if (failures.length > 0) {
    for (const line of failures) console.log(`  - ${line}`);
    process.exit(1);
  }
}

await main();
