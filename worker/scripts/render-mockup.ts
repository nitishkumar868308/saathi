/**
 * Phase 18 ka asli saboot (18.12) — phone frame + zoom-pan, MP4 se naapa hua.
 *
 * Ye teen sawaal poochhta hai:
 *  1. Phone frame sach me render me aata hai? (bezel dikhta hai?)
 *  2. Zoom-pan ke keyframes sach me chalte hain? (screen ka content bada hua?)
 *  3. Over-zoom par chetavni exact numbers ke saath aati hai?
 *
 * ⚠️ Recording FFmpeg se banti hai (1080x2400), kyunki abhi Apka Saathi ka asli
 * recording nahi hai. Uspar ek **bada safed chaukor** hai jiski chaudai naapi ja
 * sakti hai — zoom ka saboot wahi hai. Asli recording aane par sirf ye ek file
 * badalni hai, baaki poora test waisa ka waisa chalega.
 */

import { existsSync } from "node:fs";
import { mkdir, readFile, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  addItem,
  applyZoomPan,
  checkZoomUpscale,
  TAP_SECONDS,
  createEmptyProject,
  createItem,
  deviceForAspect,
  durationFromSeconds,
  safeParseDoc,
  setMockup,
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

const SOURCE = { width: 1080, height: 2400, squareSide: 500 } as const;

/** Ek row me safed pixels ki ginti — zoom naapne ka seedha tarika. */
/**
 * Poore frame ki aausat roshni.
 *
 * ⚠️ `brightRun` ek **row** par safed pixel ginta hai, jo frame ki chaudai naapne
 * ke liye theek hai — par tap ke nishaan ke liye wo dhokha de sakta hai: agar
 * nishaan pehle se safed hisse par pade to ginti bilkul nahi badalti. Aausat
 * poore frame se aati hai, isliye nishaan kahin bhi ho, wo dikhta hai.
 */
async function meanBrightness(
  video: string,
  atSeconds: number,
  width: number,
  height: number,
  scratchDir: string,
): Promise<number> {
  const raw = resolve(scratchDir, `mean-${Math.round(atSeconds * 1000)}-${Math.random().toString(36).slice(2, 8)}.gray`);
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

  let sum = 0;
  const total = width * height;
  for (let i = 0; i < total; i += 1) sum += bytes[i] ?? 0;
  return sum / total;
}

async function brightRun(
  video: string,
  atSeconds: number,
  width: number,
  height: number,
  scratchDir: string,
  rowFraction = 0.5,
): Promise<number> {
  const raw = resolve(scratchDir, `row-${Math.round(atSeconds * 1000)}.gray`);
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

  const offset = Math.floor(height * rowFraction) * width;
  let count = 0;
  for (let x = 0; x < width; x += 1) {
    if ((bytes[offset + x] ?? 0) > 200) count += 1;
  }
  return count;
}

async function main(): Promise<void> {
  const here = dirname(fileURLToPath(import.meta.url));
  const root = resolve(here, "../..");
  const outDir = resolve(root, "render-out", "mockup");
  const scratchDir = resolve(root, "render-out", ".scratch-mockup");

  await rm(scratchDir, { recursive: true, force: true });
  await mkdir(scratchDir, { recursive: true });
  await mkdir(outDir, { recursive: true });

  const publicDir = resolve(scratchDir, "public");
  await mkdir(publicDir, { recursive: true });

  section("1. dummy screen recording");
  const recording = resolve(publicDir, "recording.mp4");
  const squareX = (SOURCE.width - SOURCE.squareSide) / 2;
  const squareY = (SOURCE.height - SOURCE.squareSide) / 2;

  await run(ffmpegPath(), [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi",
    "-i", `color=c=0x101418:s=${SOURCE.width}x${SOURCE.height}:d=6:r=30`,
    "-vf",
    [
      "drawgrid=w=120:h=120:t=2:c=0x2f7fd0",
      `drawbox=x=${squareX}:y=${squareY}:w=${SOURCE.squareSide}:h=${SOURCE.squareSide}:color=white:t=fill`,
    ].join(","),
    "-c:v", "libx264", "-profile:v", "high", "-pix_fmt", "yuv420p", "-crf", "18",
    "-an",
    recording,
  ]);
  check("recording bani", existsSync(recording), `${SOURCE.width}x${SOURCE.height}`);

  const device = deviceForAspect(SOURCE.width, SOURCE.height);
  check("aspect se device chuna gaya (18.9)", Boolean(device), `${device.label} (${device.id})`);

  section("2. doc — phone frame + do zoom step");
  const fps = 30;
  const durationInFrames = durationFromSeconds(5, fps);

  let doc = createEmptyProject({ name: "Mockup test", presetId: "reel", fps });
  const videoTrack = doc.tracks[0]!;

  const item = createItem("video", {
    fps,
    trackId: videoTrack.id,
    name: "App recording",
    assetId: "as_recording",
    startFrame: 0,
    durationInFrames,
    fit: { mode: "cover", background: { kind: "blurred-asset", value: null } },
  });
  doc = addItem(doc, { item });

  doc = setMockup(doc, {
    itemIds: [item.id],
    mockup: {
      deviceId: device.id,
      colorId: "graphite",
      // Naye mockup par koi tap nahi (18.11) — nishaan user khud jodta hai.
      taps: [],
      widthPercent: 60,
      shadow: true,
      glare: false,
      tiltX: 0,
      tiltY: 0,
      screenFit: "cover",
    },
  });

  /*
   * Do zoom step (18.12): poore se beech ke aadhe hisse tak, aur wapas.
   * Chaukor 50% ka hai, yaani 2x zoom — safed chaukor bhi lagbhag do guna
   * chauda dikhna chahiye.
   */
  const steps = [
    { frame: 0, rect: { x: 0, y: 0, width: 1, height: 1 } },
    { frame: Math.round(fps * 2), rect: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } },
    { frame: durationInFrames - 1, rect: { x: 0, y: 0, width: 1, height: 1 } },
  ];
  doc = applyZoomPan(doc, { itemId: item.id, steps });

  check("doc schema pass karta hai", safeParseDoc(doc).success);
  check(
    "zoom se teen-teen keyframes bane",
    doc.items[0]?.keyframes["transform.scale"]?.length === 3,
    `scale ${doc.items[0]?.keyframes["transform.scale"]?.length}, x ${doc.items[0]?.keyframes["transform.x"]?.length}`,
  );

  section("3. render");
  const engine = new RemotionRenderEngine();
  const output = resolve(outDir, "phone-zoom.mp4");
  await engine.render({
    doc: doc as Doc,
    assets: { as_recording: "recording.mp4" },
    publicDir,
    outPath: output,
    preset: "standard",
  });
  check("render hua", existsSync(output), output);

  section("4. phone frame sach me dikha?");
  const { width, height } = doc.project;

  /*
   * Frame ki chaudai 60% hai, yaani 648px. Frame ke bahar (kinare par) recording
   * ka kuch bhi nahi hona chahiye — wahan sirf background hai.
   *
   * Ye naap "frame laga hai ya nahi" ka seedha jawab hai: bina frame ke `cover`
   * wali video poori chaudai bhar deti aur kinaron par uska content hota.
   */
  const edge = await brightRun(output, 0.2, width, height, scratchDir, 0.5);
  const expectedFrameWidth = Math.round((60 / 100) * width);
  check(
    "safed chaukor frame ke andar hi hai (bahar nahi failta)",
    edge < expectedFrameWidth,
    `${edge}px safed vs frame ki chaudai ${expectedFrameWidth}px`,
  );

  section("5. zoom sach me chala? (18.6)");
  /*
   * Zoom se pehle aur zoom ke beech me safed chaukor ki chaudai naapo. 2x zoom
   * par wo lagbhag do guna honi chahiye — par frame ke bezel se kat bhi sakti
   * hai, isliye "badhni chahiye" naapa jaata hai, "theek do guna" nahi.
   */
  const before = await brightRun(output, 0.1, width, height, scratchDir, 0.5);
  const during = await brightRun(output, 2.0, width, height, scratchDir, 0.5);
  const after = await brightRun(output, 4.9, width, height, scratchDir, 0.5);

  console.log(`  .. safed chaukor: ${before}px -> ${during}px -> ${after}px`);
  check(
    "zoom par chaukor sach me bada hua",
    during > before * 1.3,
    `${before} -> ${during} (${(during / Math.max(1, before)).toFixed(2)}x)`,
  );
  check(
    "zoom ke baad wapas chhota ho gaya",
    Math.abs(after - before) < Math.max(12, before * 0.15),
    `${after} vs shuruaat ${before}`,
  );

  section("6. tap ka nishaan (18.11)");
  /*
   * Tap ka gola screen ke beech me (0.5, 0.5) par lagta hai aur `TAP_SECONDS`
   * tak dikhta hai. Naapne ka tarika wahi hai jo baaki script ka: beech wali
   * row par safed pixel ginn lo.
   *
   * Do frame milaye jaate hain — ek tap ke andar ka aur ek uske baad ka. Sirf
   * "tap wale frame par safed hai" naapna kaafi nahi hota: screen par pehle se
   * safed chaukor hai, isliye jawab hamesha "haan" aata. **Farak** naapna hi
   * asli jaanch hai.
   */
  {
    /*
     * ⚠️ Tap **zoom se pehle** rakha jaata hai (0.2s). Pehli koshish me maine
     * 1.0s chuna tha — aur wahan zoom itna chadh chuka hota hai ki phone frame
     * hi screen se bahar nikal jaata hai, yaani naapne ko kuch bachta hi nahi.
     */
    const tapFrame = Math.round(0.2 * fps);
    const base = doc.items[0]?.mockup;
    if (!base) throw new Error("mockup laga hi nahi — tap test chal hi nahi sakta");
    const tapDoc = setMockup(doc, {
      itemIds: [item.id],
      /*
       * ⚠️ Tap screen ke **gehre hisse** par (y 0.85), beech me nahi. Beech me
       * test wali recording ka safed chaukor hai, aur safed nishaan safed ke
       * upar padkar roshni bilkul nahi badalta — test har baar "koi farak nahi"
       * kehta, jabki nishaan sach me ban raha hota. (Ye galti pehle ho chuki
       * hai: laal gole se check karne par pata chala ki render theek tha, naap
       * galat thi.)
       */
      mockup: { ...base, taps: [{ frame: tapFrame, x: 0.5, y: 0.85 }] },
    });
    console.log(`  .. doc me taps: ${JSON.stringify(tapDoc.items[0]?.mockup?.taps)}  (clip start ${tapDoc.items[0]?.startFrame}, fps ${fps})`);
    const tapOut = resolve(outDir, "mockup-tap.mp4");
    await engine.render({
      doc: tapDoc as Doc,
      assets: { as_recording: "recording.mp4" },
      publicDir,
      outPath: tapOut,
      preset: "standard",
    });

    /*
     * ⚠️ Tulna **ek hi samay par, do render ke beech** hoti hai — ek jisme tap
     * hai aur ek jisme nahi. Pehli koshish me maine ek hi video ke do alag samay
     * milaye the aur test fail ho gaya: is doc me zoom bhi chal rahi hai, isliye
     * do samay par safed chaukor waise hi alag naap ka hota hai. Us naap me tap
     * ka farak dab jaata hai.
     *
     * Ek hi timestamp par dono video milane se zoom, frame, recording — sab
     * barabar ho jaate hain, aur jo farak bachta hai wo sirf tap ka hota hai.
     */
    const at = 0.2 + TAP_SECONDS / 2;
    const withTap = await meanBrightness(tapOut, at, width, height, scratchDir);
    const without = await meanBrightness(output, at, width, height, scratchDir);
    console.log(
      `  .. usi ${at.toFixed(2)}s par poore frame ki aausat roshni: ` +
        `tap ke saath ${withTap.toFixed(3)}, bina tap ${without.toFixed(3)}`,
    );
    check(
      "tap ke nishaan se frame sach me badalta hai",
      withTap > without,
      `${withTap.toFixed(3)} (tap) vs ${without.toFixed(3)} (bina tap)`,
    );
  }

  section("7. over-zoom ki chetavni (18.8)");
  const ok = checkZoomUpscale({
    steps: [{ frame: 0, rect: { x: 0, y: 0, width: 1, height: 1 } }],
    source: SOURCE,
    frame: { width, height },
  });
  check("bina zoom ke koi chetavni nahi", ok.level === "ok", ok.advice ?? "");

  const over = checkZoomUpscale({
    steps: [{ frame: 0, rect: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 } }],
    source: SOURCE,
    frame: { width, height },
  });
  console.log(`  .. ${over.maxScale.toFixed(2)}x zoom par: ${over.advice}`);
  check(
    "2.5x zoom par saaf galti aati hai",
    over.level === "error",
    `${over.upscale.requiredSource.width}x${over.upscale.requiredSource.height} chahiye, source ${SOURCE.width}x${SOURCE.height}`,
  );
  check(
    "chetavni me exact number hai (sirf 'blurry' nahi)",
    Boolean(over.advice?.includes("px")),
    over.advice ?? "",
  );

  await rm(scratchDir, { recursive: true, force: true });

  console.log(`\n${"-".repeat(60)}`);
  if (failures.length > 0) {
    console.log(`FAILED: ${failures.length} fail, ${passed} pass`);
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exit(1);
  }
  console.log(`ALL PASS: ${passed} checks, 0 fail  (mockup)`);
}

void main();
