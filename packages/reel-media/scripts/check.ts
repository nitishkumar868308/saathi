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
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { TTS_PROVIDERS } from "@reel/core";

import {
  MAX_REVERSE_SECONDS,
  TARGET_LUFS,
  WHISPER_SCRIPT,
  audioStream,
  checkFfmpegAvailable,
  ffmpegPath,
  finalizeMp4,
  getTtsAdapter,
  makeThumbnail,
  measureEbur128,
  measureLoudness,
  parseFrameRate,
  parsePcmMime,
  probe,
  probeAsset,
  requirePcmMime,
  reverseMedia,
  run,
  synthesize,
  videoStream,
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

/** Sync error ki jaanch — sirf phatna kaafi nahi, sahi wajah se phatna chahiye. */
function throws(fn: () => unknown, pattern: RegExp, what: string): void {
  try {
    fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, pattern, `${what}: galat wajah se phata`);
    return;
  }
  assert.fail(`${what}: error aana chahiye tha, aaya nahi`);
}

async function throwsAsync(fn: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    assert.match(message, pattern);
    return;
  }
  assert.fail("error aana chahiye tha, aaya nahi");
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

    /*
     * Still image par fps ek gadha hua number hai.
     *
     * ffprobe ek PNG ko `png_pipe` demuxer se padhta hai aur us stream ka
     * `r_frame_rate` `25/1` bata deta hai — jabki tasveer me frame rate jaisi
     * koi cheez hai hi nahi. Wahi 25 seedha `reel_assets.fps` me chala jaata tha,
     * aur DB me baith kar wo asli naap jaisa dikhta tha.
     *
     * Yahi wo ek jhooth hai jiske khilaaf is file ka apna doc-comment chetavni
     * deta hai: "ye numbers asli hone chahiye, andaaza nahi". `null` ka matlab
     * "pata nahi" hota hai, aur tasveer ke fps ke liye wahi sach hai.
     */
    await test("still image ka fps null hai — 25 gadha hua nahi", async () => {
      const result = await probeAsset(image);
      assert.equal(result.fps, null, "image par fps null hona chahiye");
      assert.equal(result.durationMs, null, "image ki koi lambai nahi hoti");
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
    // ------------------------------------------------------------ loudness

    section("loudness (11.3 — Section 3A ka audio bar)");

    /*
     * Test audio jaan-boojhkar **bahut dheemi** banayi gayi hai (0.05 gain).
     * Chup track par loudnorm kuch nahi kar sakta, aur poori awaaz wali track
     * par "normalize hua ya nahi" ka farak dikhta nahi. Dheemi track dono
     * sawaalon ka saaf jawab deti hai.
     */
    const quiet = join(dir, "quiet.mp4");
    await run(ffmpegPath(), [
      ...QUIET,
      "-f", "lavfi", "-i", "testsrc2=size=320x240:rate=25:duration=3",
      "-f", "lavfi", "-i", "sine=frequency=440:duration=3",
      "-filter:a", "volume=0.05",
      "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-ar", "48000", "-ac", "2", "-shortest", quiet,
    ]);

    await test("dheemi track ki loudness naapi jaati hai", async () => {
      const measured = await measureLoudness(quiet);
      assert.ok(measured, "naap nahi aayi");
      assert.ok(
        measured.inputI < TARGET_LUFS,
        `dheemi track ${measured.inputI} LUFS honi chahiye thi (target ${TARGET_LUFS} se neeche)`,
      );
    });

    await test("normalize ke baad loudness target ke paas aa jaati hai", async () => {
      const out = join(dir, "loud.mp4");
      const result = await finalizeMp4(quiet, out, {
        normalizeLoudness: true,
        audioBitrateKbps: 192,
      });
      assert.equal(result.normalized, true, result.skippedReason ?? "normalize nahi hua");

      const after = await measureEbur128(out);
      assert.ok(after.integratedLufs !== null, "naya loudness naapa nahi ja saka");
      // 1.5 LU ki chhoot — lossy encode aur filter ke baad thoda farak aata hi hai.
      assert.ok(
        Math.abs((after.integratedLufs as number) - TARGET_LUFS) < 1.5,
        `${after.integratedLufs} LUFS aaya, ${TARGET_LUFS} ke paas hona chahiye tha`,
      );
    });

    await test("true peak chhat ke neeche rehta hai (clipping nahi)", async () => {
      const out = join(dir, "loud-peak.mp4");
      await finalizeMp4(quiet, out, { normalizeLoudness: true, audioBitrateKbps: 192 });

      const after = await measureEbur128(out);
      assert.ok(after.truePeakDb !== null, "peak naapa nahi ja saka");
      // Section 3A: -1 dBTP. Encoder ke baad thoda upar ja sakta hai, par 0 se
      // upar kabhi nahi — wo asli clipping hai.
      assert.ok(
        (after.truePeakDb as number) < 0,
        `true peak ${after.truePeakDb} dBTP — 0 se upar matlab clipping`,
      );
    });

    await test("normalize ke baad bhi video dobara encode NAHI hoti", async () => {
      // Ye Section 3A ka sabse zaroori rule hai (single encode). Saabit karne
      // ka seedha tarika: video stream ke bytes ginn lo — copy hui ho to wo
      // bilkul utne hi rehte hain.
      const out = join(dir, "loud-copy.mp4");
      await finalizeMp4(quiet, out, { normalizeLoudness: true, audioBitrateKbps: 192 });

      const before = videoStream(await probe(quiet));
      const after = videoStream(await probe(out));
      assert.equal(after?.codec_name, before?.codec_name);
      assert.equal(after?.width, before?.width);
      assert.equal(after?.height, before?.height);
      assert.equal(after?.pix_fmt, before?.pix_fmt);
      assert.equal(after?.nb_frames, before?.nb_frames, "frame ginti badal gayi — re-encode hua hai");
    });

    await test("bina audio wali file par loudness chup-chaap skip hoti hai", async () => {
      const silentVideo = join(dir, "no-audio.mp4");
      await run(ffmpegPath(), [
        ...QUIET,
        "-f", "lavfi", "-i", "testsrc2=size=160x120:rate=25:duration=1",
        "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", silentVideo,
      ]);

      const out = join(dir, "no-audio-out.mp4");
      const result = await finalizeMp4(silentVideo, out, {
        normalizeLoudness: true,
        audioBitrateKbps: 192,
      });
      // Chup track par bada gain lagane se shor bhar jaata hai — isliye skip
      // hona hi sahi hai, par wajah bulane wale tak pahunchni chahiye.
      assert.equal(result.normalized, false);
      assert.ok(result.skippedReason, "wajah batani chahiye thi");
      assert.ok((await stat(out)).size > 0, "file phir bhi banni chahiye");
    });

    await test("normalize band ho to sirf faststart lagta hai", async () => {
      const out = join(dir, "remux-only.mp4");
      const result = await finalizeMp4(quiet, out, {
        normalizeLoudness: false,
        audioBitrateKbps: 192,
      });
      assert.equal(result.normalized, false);

      const before = audioStream(await probe(quiet));
      const after = audioStream(await probe(out));
      // Audio bhi copy honi chahiye — bitrate/codec waise ke waise.
      assert.equal(after?.codec_name, before?.codec_name);
      assert.equal(after?.sample_rate, before?.sample_rate);
    });
    section("reverse (15.9)");

    /**
     * Ek frame ki beech ki roshni — reverse sach me hua ya nahi, yahi batata hai.
     */
    async function frameBrightness(file: string, atSeconds: number): Promise<number> {
      const raw = join(dir, `rev-${atSeconds}-${Math.round(atSeconds * 1000)}.gray`);
      await run(ffmpegPath(), [
        ...QUIET,
        "-i", file,
        "-ss", atSeconds.toFixed(3),
        "-frames:v", "1",
        "-f", "rawvideo", "-pix_fmt", "gray",
        raw,
      ]);
      const bytes = await readFile(raw);
      let total = 0;
      for (let index = 0; index < bytes.length; index += 97) total += bytes[index] ?? 0;
      return total / Math.ceil(bytes.length / 97);
    }

    /*
     * Aisi clip jiski roshni waqt ke saath badhti hai. Reverse ke baad wahi clip
     * ghatti hui honi chahiye — aur ye naap content par nahi, sirf kram par tiki
     * hai, isliye ise dhoka dena mushkil hai.
     */
    const ramp = join(dir, "ramp.mp4");
    await run(ffmpegPath(), [
      ...QUIET,
      "-f", "lavfi",
      "-i", "color=c=black:s=320x240:d=4:r=30",
      "-vf", "geq=lum='T/4*255':cb=128:cr=128",
      "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "18",
      ramp,
    ]);

    await test("reverse video ko sach me ulta karta hai", async () => {
      const out = join(dir, "ramp-reversed.mp4");
      const result = await reverseMedia(ramp, out);

      assert.ok(Math.abs(result.durationSeconds - 4) < 0.2, `lambai ${result.durationSeconds}`);

      const originalStart = await frameBrightness(ramp, 0.3);
      const originalEnd = await frameBrightness(ramp, 3.6);
      const reversedStart = await frameBrightness(out, 0.3);
      const reversedEnd = await frameBrightness(out, 3.6);

      assert.ok(originalEnd > originalStart + 50, "source me roshni badhni chahiye thi");
      assert.ok(
        reversedStart > reversedEnd + 50,
        `reverse me roshni ghatni chahiye: shuru ${reversedStart.toFixed(1)}, ant ${reversedEnd.toFixed(1)}`,
      );
      // Ulti clip ka pehla frame seedhi clip ke aakhri jaisa hona chahiye.
      assert.ok(
        Math.abs(reversedStart - originalEnd) < 25,
        `${reversedStart.toFixed(1)} vs ${originalEnd.toFixed(1)}`,
      );
    });

    await test("asli file reverse ke baad bilkul nahi badalti", async () => {
      // Phase 1 ka locked rule, aur reverse uska sabse bada imtihan hai.
      const before = await stat(ramp);
      const out = join(dir, "ramp-reversed-2.mp4");
      await reverseMedia(ramp, out);
      const after = await stat(ramp);
      assert.equal(after.size, before.size);
      assert.equal(after.mtimeMs, before.mtimeMs);
    });

    await test("bahut lambi clip par reverse saaf mana karta hai", async () => {
      /*
       * `reverse` filter poori clip ko memory me rakhta hai (aakhri frame pehle
       * dena hota hai). Chup-chaap machine ki RAM khatam karne se behtar hai
       * batana — isliye ek hadd hai aur wo error me dikhti hai.
       */
      const long = join(dir, "long.mp4");
      await run(ffmpegPath(), [
        ...QUIET,
        "-f", "lavfi",
        "-i", `color=c=black:s=160x120:d=${MAX_REVERSE_SECONDS + 5}:r=10`,
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        long,
      ]);
      await assert.rejects(
        () => reverseMedia(long, join(dir, "long-rev.mp4")),
        /Reverse .* tak hi hota hai/,
      );
    });

    // ------------------------------------------------------------------ TTS

    section("whisper ka output (23.4 — Devanagari)");

    await test("whisper script stdout ko utf-8 par set karti hai", async () => {
      /*
       * Windows par Python ka `sys.stdout` default cp1252 hota hai, aur usme
       * Devanagari likha hi nahi ja sakta. Bina is line ke Hindi transcription
       * **hamesha** phatti thi:
       *
       *   UnicodeEncodeError: 'charmap' codec can't encode characters …
       *
       * Aur galti ka roop sabse gumrah karne wala tha: whisper poora chal chuka
       * hota tha, shabd nikal chuke hote the, aur wo sirf unhe **likhte waqt**
       * marta tha. English par ye kabhi nahi hota — yaani jis bhasha ke liye ye
       * poora phase bana hai, thik wahi kaam nahi karti thi.
       */
      assert.match(
        WHISPER_SCRIPT,
        /sys\.stdout\.reconfigure\(\s*encoding\s*=\s*["']utf-8["']/,
        "script me stdout utf-8 par set nahi hai — Devanagari likhte hi phategi",
      );
    });

    section("TTS provider seam (22.4 / 22.x)");

    /*
     * Yahan network par kuch nahi jaata. Jo naapa ja raha hai wo wo hissa hai
     * jo asli call se **pehle** galat ho sakta hai — aur aksar hota hai:
     * kaun sa provider chuna gaya, key hai ya nahi, aur Gemini se aaya raw PCM
     * kis naap ka hai. In teeno me se koi bhi galat ho to awaaz ya to banti hi
     * nahi, ya bilkul ulti raftaar me bajti hai.
     */

    await test("har registry provider ka ek adapter maujood hai", async () => {
      for (const entry of TTS_PROVIDERS) {
        if (entry.kind === "manual") continue;
        const provider = getTtsAdapter(entry.id);
        assert.ok(provider, `provider "${entry.id}" ka adapter nahi mila`);
        assert.equal(provider.id, entry.id);
      }
    });

    await test("anjaan provider par saaf error", async () => {
      await throwsAsync(
        async () => { await synthesize({ providerId: "koi-aur", voiceId: "x", text: "hi", outPath: "x.wav", scratchDir: dir }); },
        /nahi mila/i,
      );
    });

    await test("Gemini bina key ke saaf mana karta hai (chup-chaap fail nahi hota)", async () => {
      const before = process.env.GEMINI_API_KEY;
      delete process.env.GEMINI_API_KEY;
      try {
        const check = await getTtsAdapter("gemini").available();
        assert.equal(check.ok, false, "bina key ke ok:true dena jhooth hai");
        assert.match(check.detail, /GEMINI_API_KEY/, "detail me env var ka naam hona chahiye");
      } finally {
        if (before !== undefined) process.env.GEMINI_API_KEY = before;
      }
    });

    await test("Gemini ka PCM mime sach me padha jaata hai", async () => {
      /*
       * Gemini raw PCM lautata hai aur uska sample rate **sirf mime string me**
       * hota hai: `audio/L16;codec=pcm;rate=24000`. Wo number ffmpeg ko batana
       * padta hai. Galat number dene par awaaz bajti to hai — par galat raftaar
       * par, aur suna jaaye tabhi pata chalta hai.
       */
      assert.deepEqual(parsePcmMime("audio/L16;codec=pcm;rate=24000"), { sampleRate: 24000, channels: 1 });
      assert.deepEqual(parsePcmMime("audio/L16; codec=pcm; rate=16000"), { sampleRate: 16000, channels: 1 });
      assert.equal(parsePcmMime("audio/mpeg"), null, "mp3 raw PCM nahi hai");
      assert.equal(parsePcmMime(""), null);
    });

    await test("rate na milne par andaaza nahi lagta — saaf error", async () => {
      throws(
        () => requirePcmMime("audio/L16;codec=pcm"),
        /rate/i,
        "bina rate ke mime",
      );
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
