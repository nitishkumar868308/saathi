/**
 * Bolti tasveer ka asli saboot — **MP4 se naapa hua**.
 *
 * ```
 * npm run render:talking --workspace @reel/worker
 * ```
 *
 * ⚠️ Ek hi sawaal, aur wo poore feature ka hai: **muh sach me chalta hai?**
 * `buildMouthMesh` ka hisaab `@reel/core` me jaancha ja chuka hai, aur SVG ka
 * warp `render-warp.ts` me. Par un dono ke sahi hone ka matlab ye nahi ki
 * **jud kar** wo bani hui video me dikhta bhi hai. Beech ka har jod — item type,
 * component registry, viewBox, aur clip-path — abhi tak kisi ne chala kar nahi
 * dekha.
 *
 * "Implement ho gaya" kehna yahan sabse aasan jhooth hota, kyunki code padhne
 * par sab theek dikhta hai.
 *
 * ⚠️ Tarika `render-mask.ts` wala hi hai, aur uski wajah bhi wahi: **do lamhon
 * ki tulna**, ek ki naap nahi. Sirf khule muh wale frame ko naapna kaafi nahi —
 * agar mesh laga hi na ho to bhi wahan tasveer ka apna kaala muh dikhta hai aur
 * test hara nikal jaata hai. Isliye pehle ye saabit hota hai ki chup lamhe par
 * muh apni asli oonchai par hai, aur uske baad hi khulne ka matlab banta hai.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  addItem,
  addTrack,
  buildVisemeTrack,
  createEmptyProject,
  createItem,
  DEFAULT_EMOTION,
  safeParseDoc,
  sampleFace,
  visemesFromText,
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

/** Tasveer ka naap — `sampleFace()` ke anupaat isi par baithte hain. */
const IMAGE = 400;

/**
 * Us qatar me kitne pixel kaale hain, jahan muh hai.
 *
 * ⚠️ Naap **oonchai** ki hai, ujaale ki nahi. Muh khulne par wo neeche ki taraf
 * badhta hai; ausat ujaala uske saath badalta to hai par bahut halka — aur us
 * halke farak par shart lagana wahi galti hai jo `render-warp.ts` me pehle ho
 * chuki hai (patli lakeer ausat ko hilati hi nahi).
 */
async function darkRows(
  video: string,
  atSeconds: number,
  scratchDir: string,
  tag: string,
): Promise<number> {
  const raw = resolve(scratchDir, `${tag}.gray`);
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", video,
    "-ss", atSeconds.toFixed(3),
    "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "gray",
    raw,
  ]);
  const bytes = await readFile(raw);
  await rm(raw, { force: true });

  const x = Math.round(IMAGE / 2);
  let count = 0;
  for (let y = 0; y < IMAGE; y += 1) {
    if ((bytes[y * IMAGE + x] ?? 255) < 128) count += 1;
  }
  return count;
}

/**
 * Kitne column me kaale hisse ke **beech chhed** hai — jod ki lakeer ki ginti.
 *
 * ⚠️ Ye jaanch ek asli galti ke baad aayi. Pehle sirf "muh bada hua" naapa jaata
 * tha, aur wo naap 43 qatar bata raha tha jabki hisaab 64 ka tha. Farak ki wajah
 * dikhi nahi — dikhi tab jab bana hua frame kholkar dekha gaya: kaale muh ke
 * andar baariक **safed dhaariyan** thi, jahan do triangle ke beech se peeche wali
 * tasveer jhaank rahi thi. Wo dhaariyan "dark" ki ginti tod rahi thi.
 *
 * Yaani wo galti naap me maujood thi par naap use bol nahi raha tha. Ab bolta
 * hai: ek saaf muh me har column me kaale ka **ek hi** tukda hona chahiye.
 */
async function holeColumns(
  video: string,
  atSeconds: number,
  scratchDir: string,
  tag: string,
): Promise<number> {
  const raw = resolve(scratchDir, `${tag}.gray`);
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", video,
    "-ss", atSeconds.toFixed(3),
    "-frames:v", "1",
    "-f", "rawvideo", "-pix_fmt", "gray",
    raw,
  ]);
  const bytes = await readFile(raw);
  await rm(raw, { force: true });

  /* Sirf muh ke beech wale hisse me — kinaron par kaala hai hi nahi. */
  const from = Math.round(IMAGE * 0.42);
  const to = Math.round(IMAGE * 0.58);

  let bad = 0;
  for (let x = from; x <= to; x += 1) {
    let runs = 0;
    let inRun = 0;
    for (let y = 0; y < IMAGE; y += 1) {
      const dark = (bytes[y * IMAGE + x] ?? 255) < 128;
      if (dark) {
        inRun += 1;
        continue;
      }
      /*
       * Sirf teen se lambe tukde gine jaate hain — ek-do pixel ka dhabba h.264
       * ke apne blur se bhi aa jaata hai, aur uspar shart lagana naap ko encoder
       * ki tikhaas naapne me badal deta.
       */
      if (inRun >= 3) runs += 1;
      inRun = 0;
    }
    if (inRun >= 3) runs += 1;
    if (runs > 1) bad += 1;
  }
  return bad;
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "..", "..");
  const outDir = resolve(root, "render-out", "talking");
  const scratchDir = resolve(root, "render-out", ".scratch-talking");
  const publicDir = resolve(scratchDir, "public");

  await rm(scratchDir, { recursive: true, force: true });
  await mkdir(publicDir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  /* --------------------------------------------------- 1. banaya hua chehra */

  section("1. test tasveer — safed, aur wahin ek kaala muh jahan sampleFace() ke honth hain");

  /*
   * `sampleFace()` ke honth (0.5, 0.7) par hain, 0.12 x 0.045 ke. Wahi jagah
   * yahan kaali ki jaati hai, taaki naap us kaale hisse ki oonchai par ho sake.
   */
  const lipX = Math.round((0.5 - 0.12) * IMAGE);
  const lipY = Math.round((0.7 - 0.045) * IMAGE);
  const lipW = Math.round(0.24 * IMAGE);
  const lipH = Math.round(0.09 * IMAGE);

  const faceName = "test-face.png";
  const facePath = resolve(publicDir, faceName);
  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", `color=c=white:s=${IMAGE}x${IMAGE}`,
    "-vf", `drawbox=x=${lipX}:y=${lipY}:w=${lipW}:h=${lipH}:color=black:t=fill`,
    "-frames:v", "1",
    facePath,
  ]);
  check("test tasveer bani", existsSync(facePath), facePath);

  /* --------------------------------------------------------------- 2. doc */

  section("2. doc — ek bolti tasveer, chup se khule muh tak");

  const fps = 30;
  const seconds = 1;
  let doc: Doc = createEmptyProject({ name: "Bolti tasveer test", fps });
  doc = {
    ...doc,
    project: { ...doc.project, width: IMAGE, height: IMAGE, durationInFrames: fps * seconds },
  };
  doc = addTrack(doc, { typeId: "image" });
  const track = doc.tracks[doc.tracks.length - 1]!;

  const item = createItem("talking_photo", {
    fps,
    trackId: track.id,
    name: "Bolti tasveer",
    startFrame: 0,
    durationInFrames: fps * seconds,
  });

  /*
   * Pehla aadha chup, doosra aadha poore zor par. Envelope se track banta hai —
   * yaani wahi raasta jo studio me chalega, koi alag test-only raasta nahi.
   */
  const envelope = [...new Array(25).fill(0), ...new Array(25).fill(1)] as number[];
  const talkingTrack = buildVisemeTrack({
    steps: visemesFromText("aaaa"),
    envelope,
    durationSeconds: seconds,
  });

  doc = addItem(doc, {
    item: {
      ...item,
      assetId: "face-asset",
      talkingPhoto: {
        voiceAssetId: null,
        emotionId: DEFAULT_EMOTION,
        face: sampleFace(),
        sourceSize: { width: IMAGE, height: IMAGE },
        track: talkingTrack,
      },
    },
  });

  const parsed = safeParseDoc(doc);
  check("doc schema pass karta hai", parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues[0]));
  check(
    "track me chup aur bolna dono hain",
    talkingTrack.some((f) => f.viseme === "rest") && talkingTrack.some((f) => f.viseme !== "rest"),
    `${talkingTrack.length} frame`,
  );

  /* ------------------------------------------------------------ 3. render */

  section("3. render");

  const engine = new RemotionRenderEngine();
  const outPath = resolve(outDir, "talking.mp4");
  await engine.render({
    doc,
    assets: { "face-asset": faceName },
    publicDir,
    outPath,
    preset: "standard",
  });
  check("MP4 bani", existsSync(outPath), outPath);

  /* -------------------------------------------------------------- 4. naap */

  section("4. naap — chup lamhe se khule lamhe tak muh badhta hai?");

  /* Chup wala hissa 0-0.5s, bolne wala 0.5-1s. */
  const quiet = await darkRows(outPath, 0.25, scratchDir, "quiet");
  const speaking = await darkRows(outPath, 0.75, scratchDir, "speaking");

  /*
   * ⚠️ Ye pehli jaanch is poore test ko imaandaar banati hai. Iske bina "muh
   * bada hua" wali jaanch us halat me bhi paas ho sakti hai jahan render hi
   * khaali aaya ho.
   */
  check(
    "chup lamhe par muh apni asli oonchai par hai",
    quiet >= lipH * 0.7 && quiet <= lipH * 1.4,
    `${quiet} qatar (tasveer me ${lipH})`,
  );
  check(
    "bolte lamhe par muh saaf bada hai",
    speaking > quiet * 1.5,
    `chup ${quiet} → bolte ${speaking} qatar`,
  );

  section("5. jod ki lakeer — muh ke andar chhed to nahi?");

  const holes = await holeColumns(outPath, 0.75, scratchDir, "holes");
  check(
    "kheenche hue muh ke andar koi chhed nahi",
    holes === 0,
    `${holes} column me kaale ka ek se zyada tukda — yahi wo safed dhaariyan hain jo mesh ke jod par aati hain`,
  );

  console.log(`\nMP4 dekhne ke liye: ${outPath}`);
  console.log(`\n${passed} ok, ${failures.length} fail`);
  if (failures.length > 0) {
    for (const line of failures) console.log(`  - ${line}`);
    process.exit(1);
  }
}

await main();
