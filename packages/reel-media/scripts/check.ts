/**
 * @reel/media ka check — asli ffmpeg, asli ffprobe, asli files.
 *
 * Yahan mock nahi hai aur jaan-boojhkar nahi hai: is package ka poora kaam hi
 * baahar ke binary se baat karna hai. Mock karke test karne se sirf mock ki
 * jaanch hoti, aur wahi cheez chhoot jaati jo sach me tootti hai — flag ka naam,
 * output ka shape, rotation ka aana ya na aana.
 *
 * Test files khud banti hain (`testsrc2`, `sine`), isliye repo me koi media
 * commit nahi hoti aur check kisi bhi machine par chal jaata hai.
 *
 * Chalane ka tarika:  npm run check --workspace @reel/media
 */

import assert from "node:assert/strict";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  checkFfmpegAvailable,
  ffmpegPath,
  makeThumbnail,
  parseFrameRate,
  probeAsset,
  run,
} from "../src/index";

let passed = 0;
const failures: { name: string; error: string }[] = [];

async function test(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  ok   ${name}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    failures.push({ name, error: message });
    console.log(`  FAIL ${name}\n       ${message.split("\n").join("\n       ")}`);
  }
}

function section(title: string): void {
  console.log(`\n${title}`);
}

const QUIET = ["-hide_banner", "-loglevel", "error", "-y"];

async function main(): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "reel-media-check-"));

  try {
    section("toolchain");
    const tools = await checkFfmpegAvailable();
    console.log(`  ${tools.ffmpeg.split(" ").slice(0, 3).join(" ")}`);
    console.log(`  ${tools.ffprobe.split(" ").slice(0, 3).join(" ")}`);

    // ---------------------------------------------------------- test media

    const image = join(dir, "image.png");
    const video = join(dir, "video.mp4");
    const rotated = join(dir, "rotated.mp4");
    const audio = join(dir, "audio.wav");

    await run(ffmpegPath(), [
      ...QUIET, "-f", "lavfi", "-i", "testsrc2=size=1280x720:rate=1:duration=1",
      "-frames:v", "1", image,
    ]);
    await run(ffmpegPath(), [
      ...QUIET,
      "-f", "lavfi", "-i", "testsrc2=size=640x480:rate=25:duration=2",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=2",
      "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest", video,
    ]);
    // Asli phone jaisa: pixels landscape, par display matrix 90 par.
    await run(ffmpegPath(), [...QUIET, "-display_rotation", "90", "-i", video, "-c", "copy", rotated]);
    await run(ffmpegPath(), [
      ...QUIET, "-f", "lavfi", "-i", "sine=frequency=220:duration=3",
      "-c:a", "pcm_s16le", "-ar", "44100", "-ac", "1", audio,
    ]);

    // ---------------------------------------------------------------- probe

    section("probe (5.4 — asli numbers, andaaza nahi)");

    await test("video ke asli numbers aate hain", async () => {
      const result = await probeAsset(video);
      assert.equal(result.width, 640);
      assert.equal(result.height, 480);
      assert.equal(result.fps, 25);
      assert.ok(result.durationMs !== null && Math.abs(result.durationMs - 2000) < 150,
        `duration ~2000ms honi chahiye, mili ${result.durationMs}`);
      assert.equal(result.meta.videoCodec, "h264");
      assert.equal(result.meta.pixelFormat, "yuv420p");
      assert.equal(result.meta.audioCodec, "aac");
      assert.equal(result.sampleRate, 48000);
      assert.equal(result.channels, 2);
      assert.equal(result.meta.rotation, 0);
    });

    await test("rotation par chaudai-oonchai palat jaati hai (phone ka portrait video)", async () => {
      const result = await probeAsset(rotated);
      assert.equal(result.meta.rotation, 90);
      // File me pixels 640x480 hain…
      assert.equal(result.meta.storedWidth, 640);
      assert.equal(result.meta.storedHeight, 480);
      // …par dikhta 480x640 hai. Yahi DB me jaana chahiye, warna 9:16 ke frame
      // me phone ka video landscape samajh kar galat crop ho jaata.
      assert.equal(result.width, 480);
      assert.equal(result.height, 640);
    });

    await test("audio-only file me width/height null rehte hain", async () => {
      const result = await probeAsset(audio);
      assert.equal(result.width, null);
      assert.equal(result.height, null);
      assert.equal(result.sampleRate, 44100);
      assert.equal(result.channels, 1);
      assert.ok(result.durationMs !== null && Math.abs(result.durationMs - 3000) < 150);
    });

    await test("image bhi probe hoti hai", async () => {
      const result = await probeAsset(image);
      assert.equal(result.width, 1280);
      assert.equal(result.height, 720);
    });

    await test("parseFrameRate fraction samajhta hai", async () => {
      assert.equal(parseFrameRate("30/1"), 30);
      assert.equal(Math.round((parseFrameRate("30000/1001") as number) * 100) / 100, 29.97);
      assert.equal(parseFrameRate("0/0"), null);
      assert.equal(parseFrameRate(undefined), null);
    });

    // ------------------------------------------------------------ thumbnails

    section("thumbnails (5.5)");

    await test("image thumbnail dabbe me aa jaati hai aur upscale nahi hoti", async () => {
      const out = join(dir, "thumb-image.jpg");
      assert.equal(await makeThumbnail("resize", image, out), true);

      const thumb = await probeAsset(out);
      assert.ok((thumb.width ?? 0) <= 512 && (thumb.height ?? 0) <= 512,
        `512 ke dabbe me hona chahiye, mila ${thumb.width}x${thumb.height}`);
      // 1280x720 -> 512x288 (aspect waisa ka waisa).
      assert.equal(thumb.width, 512);
      assert.equal(thumb.height, 288);
      assert.ok((await stat(out)).size > 0);
    });

    await test("chhoti image badi nahi ki jaati", async () => {
      const small = join(dir, "small.png");
      await run(ffmpegPath(), [
        ...QUIET, "-f", "lavfi", "-i", "testsrc2=size=120x90:rate=1:duration=1",
        "-frames:v", "1", small,
      ]);
      const out = join(dir, "thumb-small.jpg");
      await makeThumbnail("resize", small, out);

      const thumb = await probeAsset(out);
      // Thumbnail ko bada karke dikhana wahi jhooth hai jisse Section 3A bachta hai.
      assert.equal(thumb.width, 120);
      assert.equal(thumb.height, 90);
    });

    await test("video ka poster ek frame se banta hai", async () => {
      const out = join(dir, "thumb-video.jpg");
      assert.equal(await makeThumbnail("frame", video, out, { durationMs: 2000 }), true);

      const thumb = await probeAsset(out);
      assert.equal(thumb.width, 512);
      assert.equal(thumb.height, 384);
    });

    await test("audio ki waveform banti hai", async () => {
      const out = join(dir, "thumb-audio.jpg");
      assert.equal(await makeThumbnail("waveform", audio, out), true);

      const thumb = await probeAsset(out);
      assert.equal(thumb.width, 640);
      assert.equal(thumb.height, 180);
    });

    await test('"none" par kuch nahi banta, aur wo error bhi nahi hai', async () => {
      const out = join(dir, "thumb-none.jpg");
      assert.equal(await makeThumbnail("none", image, out), false);
    });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }

  console.log(`\n${"-".repeat(60)}`);
  if (failures.length > 0) {
    console.log(`FAILED: ${failures.length} fail, ${passed} pass`);
    for (const failure of failures) console.log(`  - ${failure.name}: ${failure.error}`);
    process.exit(1);
  }
  console.log(`ALL PASS: ${passed} tests, 0 fail`);
}

void main();
