/**
 * @reel/core ka check script.
 *
 * Ye "sab theek hai" chhaapne wala script nahi hai — har assert sach me kuch
 * naapta hai, aur ek bhi fail hone par process non-zero se marta hai. Phase 1 ka
 * poora matlab yahi hai: split ka frame math, trim ka clamp, undo/redo, aur
 * schema ki sakhti — agar inme se kuch bhi galat hua to aage ke 23 phase usi
 * galti par khade honge.
 *
 * Chalane ka tarika:  npx tsx packages/reel-core/scripts/check.ts
 */

import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";

import {
  AUTO_FIT_ACTIONS,
  DEFAULT_FPS,
  DEFAULT_SIZE_PRESET_ID,
  EASING_IDS,
  ITEM_TYPES,
  SIZE_PRESETS,
  TRACK_TYPES,
  addItem,
  addTrack,
  aspectRatioLabel,
  assetKindForFile,
  assetQuality,
  checkUpscale,
  checkUploadable,
  clampFrame,
  computeFit,
  createCountingIdFactory,
  createEmptyProject,
  createHistory,
  createItem,
  deleteItems,
  duplicateItems,
  formatBytes,
  framesToSeconds,
  framesToTimecode,
  getByPath,
  libraryTags,
  listAssetKinds,
  isValidDimension,
  LIBRARY_TABS,
  migrateDoc,
  moveItem,
  normalizeDimension,
  pruneSelection,
  recomputeDuration,
  removeTrack,
  replaceDoc,
  reorderTracks,
  resolutionName,
  resolveSize,
  safeParseDoc,
  Sha256,
  sha256Hex,
  sha256HexFromStream,
  secondsToFrames,
  selectByTrack,
  selectRange,
  setByPath,
  setIdFactory,
  setItemProperty,
  setProjectProperty,
  snapFrame,
  splitItemAtFrame,
  suggestFit,
  trackAccepts,
  trimItemEnd,
  trimItemStart,
  type Doc,
  type Item,
} from "../src/index";

// ------------------------------------------------------------- mini runner

let passed = 0;
const failures: { name: string; error: string }[] = [];

function test(name: string, fn: () => void): void {
  try {
    fn();
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

function throws(fn: () => unknown, matcher: RegExp, what: string): void {
  let threw = false;
  try {
    fn();
  } catch (error) {
    threw = true;
    const message = error instanceof Error ? error.message : String(error);
    assert.ok(
      matcher.test(message),
      `${what}: error aaya par galat — "${message}" me ${matcher} nahi mila`,
    );
  }
  assert.ok(threw, `${what}: error aana chahiye tha, aaya nahi`);
}

// Ids deterministic — warna har run ka sample JSON alag dikhta aur diff bekaar.
setIdFactory(createCountingIdFactory());

// --------------------------------------------------------------- fixtures

/** Ek doc + do items (image on video track, audio on audio track). */
function buildFixture(): { doc: Doc; videoTrackId: string; audioTrackId: string } {
  const base = createEmptyProject({ name: "Check fixture" });
  const videoTrackId = base.tracks[0]!.id;
  const audioTrackId = base.tracks[1]!.id;

  const image = createItem("image", {
    fps: base.project.fps,
    trackId: videoTrackId,
    name: "Rahul intro",
    assetId: "as_rahul",
    startFrame: 0,
    durationInFrames: 120,
  });
  const audio = createItem("audio", {
    fps: base.project.fps,
    trackId: audioTrackId,
    name: "Voiceover",
    assetId: "as_vo",
    startFrame: 0,
    durationInFrames: 300,
  });

  let doc = addItem(base, { item: image });
  doc = addItem(doc, { item: audio });
  return { doc, videoTrackId, audioTrackId };
}

function itemById(doc: Doc, id: string): Item {
  const item = doc.items.find((i) => i.id === id);
  assert.ok(item, `item ${id} doc me nahi mila`);
  return item;
}

// ------------------------------------------------------------------ tests

section("time helpers (1.6)");

test("framesToSeconds / secondsToFrames round-trip har fps par", () => {
  for (const fps of [24, 25, 30, 50, 60]) {
    for (const frames of [0, 1, 7, 150, 1801]) {
      assert.equal(secondsToFrames(framesToSeconds(frames, fps), fps), frames);
    }
  }
});

test("secondsToFrames round karta hai, floor nahi", () => {
  // 1.99s @30 = 59.7 frames. Floor 59 dega — har clip par ek frame ka nuksaan.
  assert.equal(secondsToFrames(1.99, 30), 60);
  assert.equal(secondsToFrames(0.4, 30), 12);
});

test("galat fps par saaf error", () => {
  throws(() => framesToSeconds(30, 0), /Invalid fps/, "fps 0");
  throws(() => framesToSeconds(30, 1000), /Invalid fps/, "fps 1000");
});

test("framesToTimecode sahi HH:MM:SS:FF deta hai", () => {
  assert.equal(framesToTimecode(0, 30), "00:00:00:00");
  assert.equal(framesToTimecode(29, 30), "00:00:00:29");
  assert.equal(framesToTimecode(30, 30), "00:00:01:00");
  assert.equal(framesToTimecode(30 * 61 + 5, 30), "00:01:01:05");
  assert.equal(framesToTimecode(30 * 61 + 5, 30, { compact: true }), "01:01:05");
});

test("snapFrame threshold ke andar hi snap karta hai", () => {
  assert.equal(snapFrame(48, [0, 50, 100], 5), 50);
  assert.equal(snapFrame(44, [0, 50, 100], 5), 44, "threshold ke bahar snap nahi hona chahiye");
  assert.equal(snapFrame(50, [], 5), 50);
  // Barabar doori par chhota candidate jeete — warna drag ke dauraan clip kaapta hai.
  assert.equal(snapFrame(50, [45, 55], 5), 45);
});

test("clampFrame clamp bhi karta hai aur round bhi", () => {
  assert.equal(clampFrame(10.6, 0, 100), 11);
  assert.equal(clampFrame(-5, 0, 100), 0);
  assert.equal(clampFrame(500, 0, 100), 100);
});

section("size presets (1.5)");

test("default preset reel 1080x1920 hai", () => {
  assert.equal(DEFAULT_SIZE_PRESET_ID, "reel");
  assert.deepEqual(resolveSize(), { width: 1080, height: 1920 });
  assert.equal(DEFAULT_FPS, 30);
});

test("README 3B ki saari sizes maujood hain", () => {
  const ids = SIZE_PRESETS.map((p) => p.id);
  for (const id of [
    "reel",
    "square",
    "portrait",
    "landscape",
    "landscape-1440",
    "landscape-2160",
    "classic",
    "custom",
  ]) {
    assert.ok(ids.includes(id), `preset "${id}" list me nahi hai`);
  }
});

test("har preset ki dimensions even hain (yuv420p ki zaroorat)", () => {
  for (const preset of SIZE_PRESETS) {
    if (preset.width === null || preset.height === null) continue;
    assert.ok(
      isValidDimension(preset.width) && isValidDimension(preset.height),
      `${preset.id} ${preset.width}x${preset.height} valid nahi`,
    );
  }
});

test("custom size normalize hoti hai aur bina size ke error deti hai", () => {
  assert.deepEqual(resolveSize({ presetId: "custom", width: 1081, height: 1921 }), {
    width: 1082,
    height: 1922,
  });
  throws(() => resolveSize({ presetId: "custom" }), /width aur height/, "custom bina size");
  assert.equal(normalizeDimension(3), 16, "MIN_DIMENSION se neeche clamp");
});

test("aspect labels sahi hain", () => {
  assert.equal(aspectRatioLabel(1080, 1920), "9:16");
  assert.equal(aspectRatioLabel(1920, 1080), "16:9");
  assert.equal(aspectRatioLabel(1080, 1350), "4:5");
});

section("fit + upscale (1.5b, Section 3A/3B)");

const REEL = { width: 1080, height: 1920 };

test("cover frame bharta hai aur crop karta hai", () => {
  const fit = computeFit({ width: 1920, height: 1080 }, REEL, "cover");
  // 16:9 ko 9:16 me bharne ke liye height match karni padti hai: 1920/1080 = 1.777…
  assert.ok(Math.abs(fit.scale - 1920 / 1080) < 1e-9);
  assert.ok(fit.drawHeight >= REEL.height - 1e-6);
  assert.equal(fit.cropped, true);
  assert.equal(fit.hasEmptySpace, false);
  assert.equal(fit.aspectBroken, false);
});

test("contain poora dikhata hai aur khaali jagah chhodta hai", () => {
  const fit = computeFit({ width: 1920, height: 1080 }, REEL, "contain");
  assert.ok(Math.abs(fit.scale - 1080 / 1920) < 1e-9);
  assert.equal(fit.cropped, false);
  assert.equal(fit.hasEmptySpace, true);
});

test("fill aspect todta hai", () => {
  const fit = computeFit({ width: 1920, height: 1080 }, REEL, "fill");
  assert.equal(fit.aspectBroken, true);
  assert.ok(Math.abs(fit.drawWidth - REEL.width) < 1e-6);
  assert.ok(Math.abs(fit.drawHeight - REEL.height) < 1e-6);
});

test("same aspect par cover na crop kare na khaali jagah chhode", () => {
  const fit = computeFit({ width: 540, height: 960 }, REEL, "cover");
  assert.equal(fit.cropped, false);
  assert.equal(fit.hasEmptySpace, false);
  assert.equal(fit.scale, 2);
});

test("upscale pakda jaata hai aur required pixels batata hai", () => {
  const small = { width: 540, height: 960 };
  const fit = computeFit(small, REEL, "cover");
  const check = checkUpscale(small, REEL, fit);
  assert.equal(check.upscaled, true);
  assert.equal(check.factor, 2);
  assert.deepEqual(check.requiredSource, { width: 1080, height: 1920 });
  assert.ok(check.message && check.message.includes("1080x1920"));
});

test("zoom keyframe milakar upscale check hota hai (Section 3A)", () => {
  const source = { width: 1080, height: 1920 };
  const fit = computeFit(source, REEL, "cover");
  assert.equal(checkUpscale(source, REEL, fit, 1).upscaled, false, "1x par sab theek");
  // Ken Burns 1 -> 1.3 : end par 1.3x upscale, aur yahi asli blur ki wajah hoti hai.
  const zoomed = checkUpscale(source, REEL, fit, 1.3);
  assert.equal(zoomed.upscaled, true);
  assert.deepEqual(zoomed.requiredSource, { width: 1404, height: 2496 });
});

test("16:9 ko 9:16 me daalne par contain + blurred suggest hota hai", () => {
  const suggestion = suggestFit({ width: 1920, height: 1080 }, REEL);
  assert.equal(suggestion.mismatch, true);
  assert.equal(suggestion.recommendedMode, "contain");
  assert.equal(suggestion.recommendedBackground, "blurred-asset");
});

test("aspect milta ho to koi mismatch nahi", () => {
  const suggestion = suggestFit({ width: 720, height: 1280 }, REEL);
  assert.equal(suggestion.mismatch, false);
  assert.equal(suggestion.recommendedMode, "cover");
});

test("README 3B ke saare auto-fit buttons maujood hain", () => {
  const ids = AUTO_FIT_ACTIONS.map((a) => a.id);
  assert.deepEqual(ids, ["fit-frame", "fill-frame", "fit-width", "fit-height", "center", "reset"]);
  const fitWidth = AUTO_FIT_ACTIONS.find((a) => a.id === "fit-width")!;
  assert.equal(fitWidth.apply({ width: 540, height: 960 }, REEL).scale, 2);
});

section("property paths (keyframes ki neenv)");

test("getByPath / setByPath nested par chalte hain", () => {
  const target = { transform: { scale: 1 }, audio: { volume: 1 } };
  assert.equal(getByPath(target, "transform.scale"), 1);
  setByPath(target, "transform.scale", 1.5);
  assert.equal(target.transform.scale, 1.5);
  assert.equal(getByPath(target, "transform.nope"), undefined);
});

test("setByPath missing objects banata hai par non-object par rota hai", () => {
  const target: Record<string, unknown> = {};
  setByPath(target, "a.b.c", 7);
  assert.deepEqual(target, { a: { b: { c: 7 } } });
  throws(() => setByPath({ a: 5 }, "a.b", 1), /object nahi hai/, "number ke andar set");
});

section("registries (1.7-1.10)");

test("paanchon item types registered hain", () => {
  assert.deepEqual([...ITEM_TYPES.ids()].sort(), ["audio", "image", "shape", "text", "video"]);
});

test("saat track types registered hain (ginti nahi, kism)", () => {
  assert.equal(TRACK_TYPES.list().length, 7);
  assert.ok(TRACK_TYPES.has("subtitle"));
});

test("har control descriptor me path, label aur control kind hai", () => {
  for (const entry of ITEM_TYPES.list()) {
    for (const control of entry.controls) {
      assert.ok(control.path.length > 0, `${entry.id}: control ka path khaali`);
      assert.ok(control.label.length > 0, `${entry.id}: ${control.path} ka label khaali`);
      assert.ok(control.control.length > 0, `${entry.id}: ${control.path} ka control kind khaali`);
    }
  }
});

test("keyframable paths controls me bhi maujood hain (panel = keyframe lane)", () => {
  for (const entry of ITEM_TYPES.list()) {
    const paths = new Set(entry.controls.map((c) => c.path));
    for (const path of entry.keyframable) {
      assert.ok(paths.has(path), `${entry.id}: "${path}" keyframable hai par control nahi hai`);
    }
  }
});

test("trackAccepts sahi rok-tok karta hai", () => {
  assert.equal(trackAccepts("video", "image"), true);
  assert.equal(trackAccepts("text", "video"), false);
  assert.equal(trackAccepts("music", "audio"), true);
  assert.equal(trackAccepts("nope", "image"), false);
});

test("registry require() par saaf error deta hai", () => {
  throws(() => ITEM_TYPES.require("hologram"), /nahi mila/, "unknown item type");
  throws(() => ITEM_TYPES.register(ITEM_TYPES.require("image")), /pehle se/, "duplicate register");
});

section("factory + schema (1.1-1.4)");

test("createEmptyProject default reel 1080x1920 @30 deta hai", () => {
  const doc = createEmptyProject({ name: "Test" });
  assert.equal(doc.project.width, 1080);
  assert.equal(doc.project.height, 1920);
  assert.equal(doc.project.fps, 30);
  assert.equal(doc.project.sizePresetId, "reel");
  assert.equal(doc.tracks.length, 2, "shuruat me 2 tracks — 7 hardcoded nahi");
  assert.equal(doc.items.length, 0);
});

test("createEmptyProject dusre preset aur fps par bhi chalta hai", () => {
  const doc = createEmptyProject({ name: "Wide", presetId: "landscape", fps: 60 });
  assert.equal(doc.project.width, 1920);
  assert.equal(doc.project.height, 1080);
  assert.equal(doc.project.fps, 60);
  assert.equal(doc.project.durationInFrames, 15 * 60);
});

test("createItem defaults registry se aate hain, hardcode se nahi", () => {
  const text = createItem("text", { fps: 30 });
  assert.equal(text.type, "text");
  assert.ok(text.text, "text item ka text spec registry defaults se aana chahiye");
  assert.equal(text.text!.fontFamily, "brand.font.display", "brand token hona chahiye, hex nahi");
  assert.equal(text.durationInFrames, 90, "3s @30fps");
  assert.equal(createItem("text", { fps: 60 }).durationInFrames, 180, "fps se duration badle");

  const image = createItem("image", { fps: 30 });
  assert.equal(image.text, null);
  assert.equal(image.durationInFrames, 120, "4s @30fps");
});

test("createItem ka partial registry defaults ke upar lagta hai", () => {
  const text = createItem("text", { fps: 30, text: { content: "Namaste" } });
  assert.equal(text.text!.content, "Namaste");
  assert.equal(text.text!.fontSize, 72, "baaki defaults bache rehne chahiye");
});

test("registry ka per-type schema asset ki kami pakadta hai", () => {
  const image = createItem("image", { fps: 30 });
  const entry = ITEM_TYPES.require("image");
  assert.equal(entry.schema.safeParse(image).success, false, "assetId null par fail hona chahiye");
  assert.equal(entry.schema.safeParse({ ...image, assetId: "as_1" }).success, true);
});

test("schema float frames reject karta hai", () => {
  const { doc } = buildFixture();
  const broken = { ...doc, items: [{ ...doc.items[0]!, startFrame: 10.5 }, ...doc.items.slice(1)] };
  const result = safeParseDoc(broken);
  assert.equal(result.success, false, "10.5 frame par parse fail hona chahiye");
});

test("schema odd width reject karta hai (yuv420p)", () => {
  const { doc } = buildFixture();
  const broken = { ...doc, project: { ...doc.project, width: 1081 } };
  assert.equal(safeParseDoc(broken).success, false);
});

test("schema toota hua track reference pakadta hai", () => {
  const { doc } = buildFixture();
  const broken = { ...doc, items: [{ ...doc.items[0]!, trackId: "tr_gayab" }, ...doc.items.slice(1)] };
  const result = safeParseDoc(broken);
  assert.equal(result.success, false);
  assert.ok(
    JSON.stringify(result.success ? {} : result.error.issues).includes("tr_gayab"),
    "error me gayab track ka naam hona chahiye",
  );
});

test("schema duplicate item id pakadta hai", () => {
  const { doc } = buildFixture();
  const broken = { ...doc, items: [doc.items[0]!, { ...doc.items[1]!, id: doc.items[0]!.id }] };
  assert.equal(safeParseDoc(broken).success, false);
});

test("saare easing ids schema ko manzoor hain", () => {
  const { doc } = buildFixture();
  for (const easing of EASING_IDS) {
    const withKeyframe = {
      ...doc,
      items: [
        { ...doc.items[0]!, keyframes: { "transform.scale": [{ frame: 0, value: 1, easing }] } },
        ...doc.items.slice(1),
      ],
    };
    assert.equal(safeParseDoc(withKeyframe).success, true, `easing "${easing}" reject hua`);
  }
  const bad = {
    ...doc,
    items: [
      { ...doc.items[0]!, keyframes: { "transform.scale": [{ frame: 0, value: 1, easing: "boing" }] } },
      ...doc.items.slice(1),
    ],
  };
  assert.equal(safeParseDoc(bad).success, false, "anjaan easing pass nahi hona chahiye");
});

section("migrate (1.3)");

test("v1 doc waisa ka waisa nikalta hai", () => {
  const { doc } = buildFixture();
  const migrated = migrateDoc(JSON.parse(JSON.stringify(doc)));
  assert.deepEqual(migrated, doc);
});

test("aage ka version reject hota hai (chupchaap fields nahi girte)", () => {
  const { doc } = buildFixture();
  throws(
    () => migrateDoc({ ...doc, version: 99 }),
    /sirf 1 tak samajhta hai/,
    "version 99",
  );
});

test("bina version ke doc reject hota hai", () => {
  const { doc } = buildFixture();
  const { version: _drop, ...noVersion } = doc as unknown as Record<string, unknown>;
  throws(() => migrateDoc(noVersion), /valid "version" nahi/, "missing version");
  throws(() => migrateDoc("kuch bhi"), /object hona chahiye/, "non-object");
});

section("timeline ops (1.11)");

test("addItem track se jodta hai aur duration badhata hai", () => {
  const { doc } = buildFixture();
  assert.equal(doc.items.length, 2);
  // Audio 300 frames ka hai, default project 450 (15s @30) — duration ghatni nahi chahiye.
  assert.equal(doc.project.durationInFrames, 450);

  const long = createItem("audio", {
    fps: 30,
    trackId: doc.tracks[1]!.id,
    assetId: "as_long",
    durationInFrames: 900,
  });
  const grown = addItem(doc, { item: long });
  assert.equal(grown.project.durationInFrames, 900, "bahar nikalne par duration badhni chahiye");
});

test("addItem galat track par mana kar deta hai", () => {
  const { doc, audioTrackId } = buildFixture();
  const image = createItem("image", { fps: 30, trackId: audioTrackId, assetId: "as_x" });
  throws(() => addItem(doc, { item: image }), /nahi rakha ja sakta/, "image on audio track");
});

test("ops purana doc kabhi nahi badalte (pure)", () => {
  const { doc } = buildFixture();
  const before = JSON.stringify(doc);
  moveItem(doc, { itemId: doc.items[0]!.id, startFrame: 99 });
  assert.equal(JSON.stringify(doc), before, "original doc mutate ho gaya");
});

test("moveItem track badal sakta hai", () => {
  const { doc, videoTrackId } = buildFixture();
  const id = doc.items[0]!.id;
  const moved = moveItem(doc, { itemId: id, startFrame: 45 });
  assert.equal(itemById(moved, id).startFrame, 45);
  assert.equal(itemById(moved, id).trackId, videoTrackId);
  throws(
    () => moveItem(doc, { itemId: id, startFrame: 0, trackId: doc.tracks[1]!.id }),
    /nahi rakha ja sakta/,
    "image ko audio track par",
  );
});

test("SPLIT ka frame math bilkul exact hai (rate 1)", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  const original = itemById(doc, id);
  const moved = moveItem(doc, { itemId: id, startFrame: 10 });
  const split = splitItemAtFrame(moved, { itemId: id, frame: 40 });

  const left = itemById(split, id);
  const right = split.items[split.items.indexOf(left) + 1]!;

  assert.equal(left.durationInFrames, 30, "left = 40 - 10");
  assert.equal(right.durationInFrames, 90, "right = baaki sab");
  assert.equal(
    left.durationInFrames + right.durationInFrames,
    original.durationInFrames,
    "dono ka jod original ke barabar hona chahiye — na ek frame kam na zyada",
  );
  assert.equal(
    right.startFrame,
    left.startFrame + left.durationInFrames,
    "koi gap ya overlap nahi",
  );
  assert.equal(right.trimStartFrame, 30, "right source ke 30ve frame se shuru ho");
  assert.notEqual(right.id, left.id, "right ko naya id milna chahiye");
  assert.equal(right.assetId, left.assetId, "split non-destructive — asset wahi rehta hai");
});

test("SPLIT playbackRate ke saath bhi sahi source offset deta hai", () => {
  const { doc, videoTrackId } = buildFixture();
  const fast = createItem("video", {
    fps: 30,
    trackId: videoTrackId,
    assetId: "as_screen",
    startFrame: 10,
    durationInFrames: 100,
    trimStartFrame: 30,
    playbackRate: 2,
  });
  const withFast = addItem(doc, { item: fast });
  const split = splitItemAtFrame(withFast, { itemId: fast.id, frame: 40 });

  const left = itemById(split, fast.id);
  const right = split.items[split.items.indexOf(left) + 1]!;

  assert.equal(left.durationInFrames, 30);
  assert.equal(right.durationInFrames, 70);
  // 30 timeline frames x 2 speed = source ke 60 frames khatam hue.
  assert.equal(right.trimStartFrame, 30 + 60);
  assert.equal(right.playbackRate, 2);
});

test("SPLIT kinaron par mana karta hai", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  throws(() => splitItemAtFrame(doc, { itemId: id, frame: 0 }), /andar nahi/, "start par split");
  throws(() => splitItemAtFrame(doc, { itemId: id, frame: 120 }), /andar nahi/, "end par split");
  throws(() => splitItemAtFrame(doc, { itemId: id, frame: 500 }), /andar nahi/, "bahar split");
});

test("SPLIT keyframes dono hisson me baant deta hai", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  const withKeys = setItemProperty(doc, {
    itemId: id,
    path: "keyframes",
    value: {
      "transform.scale": [
        { frame: 0, value: 1, easing: "ease-out" },
        { frame: 20, value: 1.1, easing: "linear" },
        { frame: 60, value: 1.3, easing: "linear" },
      ],
    },
  });
  const split = splitItemAtFrame(withKeys, { itemId: id, frame: 30 });
  const left = itemById(split, id);
  const right = split.items[split.items.indexOf(left) + 1]!;

  assert.deepEqual(
    left.keyframes["transform.scale"]!.map((k) => k.frame),
    [0, 20],
    "left ke paas apne hisse ke keyframes",
  );
  assert.deepEqual(
    right.keyframes["transform.scale"]!.map((k) => k.frame),
    [30],
    "right ke keyframes item-local ho jaate hain (60 - 30)",
  );
});

test("SPLIT beech me transition nahi chhodta", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  const withFade = setItemProperty(doc, {
    itemId: id,
    path: "transitionOut",
    value: { type: "fade", durationInFrames: 15 },
  });
  const split = splitItemAtFrame(withFade, { itemId: id, frame: 60 });
  const left = itemById(split, id);
  const right = split.items[split.items.indexOf(left) + 1]!;
  assert.equal(left.transitionOut.type, "none", "cut ke andar transition nahi aani chahiye");
  assert.equal(right.transitionIn.type, "none");
  assert.equal(right.transitionOut.type, "fade", "bahar wali transition right par bachni chahiye");
});

test("trimItemStart non-destructive hai — trimStartFrame badalta hai", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  const trimmed = trimItemStart(doc, { itemId: id, deltaFrames: 20 });
  const item = itemById(trimmed, id);
  assert.equal(item.startFrame, 20);
  assert.equal(item.durationInFrames, 100);
  assert.equal(item.trimStartFrame, 20, "source ke andar 20 frame aage khiska");
  assert.equal(item.assetId, "as_rahul", "asli file kabhi nahi badalti");
});

test("trimItemStart clamp karta hai (1 frame se chhota nahi, source se pehle nahi)", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;

  const tooMuch = trimItemStart(doc, { itemId: id, deltaFrames: 10_000 });
  assert.equal(itemById(tooMuch, id).durationInFrames, 1, "kam se kam 1 frame bachna chahiye");

  const back = trimItemStart(doc, { itemId: id, deltaFrames: -10_000 });
  assert.equal(itemById(back, id).trimStartFrame, 0, "source se pehle nahi ja sakte");
  assert.equal(itemById(back, id).startFrame, 0, "timeline par 0 se peeche nahi");
});

test("trimItemEnd sirf lambai badalta hai, kam se kam 1 frame", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  assert.equal(itemById(trimItemEnd(doc, { itemId: id, deltaFrames: 30 }), id).durationInFrames, 150);
  assert.equal(itemById(trimItemEnd(doc, { itemId: id, deltaFrames: -999 }), id).durationInFrames, 1);
  assert.equal(
    itemById(trimItemEnd(doc, { itemId: id, deltaFrames: 30 }), id).trimStartFrame,
    0,
    "end trim source offset ko haath na lagaye",
  );
});

test("duplicateItems naya id deta hai aur peeche rakhta hai", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  const duped = duplicateItems(doc, { itemIds: [id] });
  assert.equal(duped.items.length, 3);

  const original = itemById(duped, id);
  const copy = duped.items[duped.items.indexOf(original) + 1]!;
  assert.notEqual(copy.id, original.id, "copy ko naya id milna chahiye");
  assert.equal(copy.startFrame, original.startFrame + original.durationInFrames);
  assert.equal(copy.assetId, original.assetId);
  assert.equal(safeParseDoc(duped).success, true, "duplicate ke baad doc valid rehna chahiye");
});

test("deleteItems hata deta hai aur scene se bhi nikaal deta hai", () => {
  const { doc } = buildFixture();
  const withScene: Doc = {
    ...doc,
    scenes: [{ id: "sc_1", name: "Intro", order: 0, itemIds: [doc.items[0]!.id] }],
    items: [{ ...doc.items[0]!, sceneId: "sc_1" }, ...doc.items.slice(1)],
  };
  assert.equal(safeParseDoc(withScene).success, true);

  const deleted = deleteItems(withScene, { itemIds: [doc.items[0]!.id] });
  assert.equal(deleted.items.length, 1);
  assert.deepEqual(deleted.scenes[0]!.itemIds, [], "scene me gayab id nahi bachni chahiye");
  assert.equal(safeParseDoc(deleted).success, true);
});

test("locked item par ops mana kar dete hain", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  const locked = setItemProperty(doc, { itemId: id, path: "locked", value: true });
  throws(() => moveItem(locked, { itemId: id, startFrame: 5 }), /locked/, "locked move");
  throws(() => deleteItems(locked, { itemIds: [id] }), /locked/, "locked delete");
});

test("setItemProperty kisi bhi path par chalta hai", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  let next = setItemProperty(doc, { itemId: id, path: "transform.scale", value: 1.4 });
  next = setItemProperty(next, { itemId: id, path: "fit.mode", value: "contain" });
  next = setItemProperty(next, { itemId: id, path: "audio.volume", value: 0.5 });

  assert.equal(itemById(next, id).transform.scale, 1.4);
  assert.equal(itemById(next, id).fit.mode, "contain");
  assert.equal(itemById(next, id).audio.volume, 0.5);
  assert.equal(safeParseDoc(next).success, true);
});

test("setItemProperty protected fields ko chhoone nahi deta", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  for (const path of ["startFrame", "durationInFrames", "trimStartFrame", "trackId", "id"]) {
    throws(
      () => setItemProperty(doc, { itemId: id, path, value: 5 }),
      /apna op hai/,
      `${path} seedha set`,
    );
  }
});

test("addTrack / removeTrack / reorderTracks", () => {
  const { doc } = buildFixture();
  const withMusic = addTrack(doc, { typeId: "music", name: "Background music" });
  assert.equal(withMusic.tracks.length, 3);
  assert.equal(withMusic.tracks[2]!.name, "Background music");
  assert.equal(withMusic.tracks[2]!.order, 2);

  const ids = withMusic.tracks.map((t) => t.id);
  const reordered = reorderTracks(withMusic, { trackIds: [ids[2]!, ids[0]!, ids[1]!] });
  assert.deepEqual(reordered.tracks.map((t) => t.id), [ids[2], ids[0], ids[1]]);
  assert.deepEqual(reordered.tracks.map((t) => t.order), [0, 1, 2]);

  throws(
    () => reorderTracks(withMusic, { trackIds: [ids[0]!] }),
    /3 tracks hain par 1/,
    "adhoora reorder",
  );
});

test("removeTrack items wale track par chupchaap kuch nahi mitata", () => {
  const { doc, videoTrackId } = buildFixture();
  throws(() => removeTrack(doc, { trackId: videoTrackId }), /withItems: true/, "bina permission");

  const removed = removeTrack(doc, { trackId: videoTrackId, withItems: true });
  assert.equal(removed.tracks.length, 1);
  assert.equal(removed.items.length, 1, "us track ke items bhi jaane chahiye");
  assert.equal(safeParseDoc(removed).success, true);
});

test("recomputeDuration exact karta hai (chhota bhi)", () => {
  const { doc } = buildFixture();
  assert.equal(doc.project.durationInFrames, 450);
  assert.equal(recomputeDuration(doc, undefined).project.durationInFrames, 300);
});

section("history (1.12)");

test("undo / redo poora round-trip karte hain", () => {
  const { doc } = buildFixture();
  const history = createHistory<Doc>();
  const id = doc.items[0]!.id;

  const moved = history.apply(doc, (draft) => moveItem.recipe(draft, {
    itemId: id,
    startFrame: 90,
  }), { label: "move" });

  assert.equal(itemById(moved, id).startFrame, 90);
  assert.equal(history.canUndo(), true);
  assert.equal(history.peekUndoLabel(), "move");

  const undone = history.undo(moved);
  assert.equal(itemById(undone, id).startFrame, 0, "undo ke baad wahi purani jagah");
  assert.deepEqual(undone, doc, "undo ke baad doc bilkul pehle jaisa hona chahiye");

  const redone = history.redo(undone);
  assert.equal(itemById(redone, id).startFrame, 90);
  assert.deepEqual(redone, moved);
});

test("coalesce se poora drag ek hi undo entry banta hai", () => {
  const { doc } = buildFixture();
  const history = createHistory<Doc>();
  const id = doc.items[0]!.id;

  let state = doc;
  for (const frame of [10, 20, 30, 40, 55]) {
    state = history.apply(state, (draft) => moveItem.recipe(draft, {
      itemId: id,
      startFrame: frame,
    }), { label: "drag", coalesceKey: `drag:${id}` });
  }

  assert.equal(itemById(state, id).startFrame, 55);
  assert.equal(history.size().past, 1, "5 mousemove = 1 undo entry");
  assert.deepEqual(history.undo(state), doc, "ek Ctrl+Z poora drag wapas le");
});

test("bina coalesce ke har edit apni entry banti hai", () => {
  const { doc } = buildFixture();
  const history = createHistory<Doc>();
  const id = doc.items[0]!.id;

  let state = doc;
  for (const frame of [10, 20, 30]) {
    state = history.apply(state, (draft) => moveItem.recipe(draft, {
      itemId: id,
      startFrame: frame,
    }), { label: "move" });
  }
  assert.equal(history.size().past, 3);
});

test("nayi edit redo ka rasta band kar deti hai", () => {
  const { doc } = buildFixture();
  const history = createHistory<Doc>();
  const id = doc.items[0]!.id;

  const a = history.apply(doc, (draft) => moveItem.recipe(draft, { itemId: id, startFrame: 10 }));
  const back = history.undo(a);
  assert.equal(history.canRedo(), true);

  history.apply(back, (draft) => moveItem.recipe(draft, { itemId: id, startFrame: 77 }));
  assert.equal(history.canRedo(), false, "nayi edit ke baad redo nahi bachna chahiye");
});

test("history bounded hai (purani entries girti hain)", () => {
  const { doc } = buildFixture();
  const history = createHistory<Doc>({ limit: 3 });
  const id = doc.items[0]!.id;

  let state = doc;
  for (let frame = 1; frame <= 10; frame += 1) {
    state = history.apply(state, (draft) => moveItem.recipe(draft, { itemId: id, startFrame: frame }));
  }
  assert.equal(history.size().past, 3, "limit 3 se zyada entries nahi bachni chahiye");
});

test("kuch na badle to history gandi nahi hoti", () => {
  const { doc } = buildFixture();
  const history = createHistory<Doc>();
  const id = doc.items[0]!.id;
  const same = history.apply(doc, (draft) => moveItem.recipe(draft, { itemId: id, startFrame: 0 }));
  assert.equal(history.size().past, 0, "no-op edit history me nahi jaani chahiye");
  assert.equal(same, doc);
});

section("sha256 (5.7 — duplicate pehchanne ke liye)");

/** Node ka apna sha256 — sach ka paimana yahi hai. */
function nodeHash(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

test("khaali aur maalum vector sahi hain", () => {
  assert.equal(
    sha256Hex(new Uint8Array(0)),
    "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  );
  assert.equal(
    sha256Hex(new TextEncoder().encode("abc")),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("padding ke kinare (55/56/63/64/65 byte) node se milte hain", () => {
  // Yahi wo lambaiyan hain jahan galat implementation tootti hai: 56 byte par
  // length ke liye jagah nahi bachti aur ek block aur lagta hai.
  for (const length of [0, 1, 55, 56, 57, 63, 64, 65, 127, 128, 129]) {
    const bytes = randomBytes(length);
    assert.equal(sha256Hex(bytes), nodeHash(bytes), `${length} byte par galat hash`);
  }
});

test("chunk kaise bhi toota ho, hash wahi rehta hai", () => {
  const bytes = randomBytes(5000);
  const expected = nodeHash(bytes);

  for (const chunkSize of [1, 7, 64, 100, 512, 4096]) {
    const hasher = new Sha256();
    for (let at = 0; at < bytes.length; at += chunkSize) {
      hasher.update(bytes.subarray(at, Math.min(at + chunkSize, bytes.length)));
    }
    assert.equal(hasher.digestHex(), expected, `chunk ${chunkSize} par galat hash`);
  }
});

test("digest() do baar ya uske baad update() saaf mana hai", () => {
  const hasher = new Sha256();
  hasher.update(new Uint8Array([1, 2, 3]));
  hasher.digest();
  throws(() => hasher.digest(), /do baar/, "dobara digest");
  throws(() => hasher.update(new Uint8Array([4])), /digest\(\) ke baad/, "digest ke baad update");
});

section("asset kinds registry (5.1 / 5.8)");

test("mime se kind milti hai, aur mime na ho to extension se", () => {
  assert.equal(assetKindForFile("image/png", "a.png")?.id, "image");
  assert.equal(assetKindForFile("video/mp4", "a.mp4")?.id, "video");
  assert.equal(assetKindForFile("audio/mpeg", "a.mp3")?.id, "audio");
  // Windows par .mkv ka mime aksar khaali aata hai — extension se bachna zaroori hai.
  assert.equal(assetKindForFile("", "recording.mkv")?.id, "video");
  assert.equal(assetKindForFile("application/octet-stream", "song.flac")?.id, "audio");
  assert.equal(assetKindForFile("application/pdf", "bill.pdf"), null);
});

test("upload ki rok: anjaan kism, khaali file, aur hadd se badi file", () => {
  const image = listAssetKinds().find((kind) => kind.id === "image");
  assert.ok(image);

  assert.equal(checkUploadable({ name: "a.png", type: "image/png", size: 1000 }).ok, true);

  const unknown = checkUploadable({ name: "a.pdf", type: "application/pdf", size: 10 });
  assert.equal(unknown.ok, false);
  assert.equal(unknown.ok === false && unknown.error.reason, "unknown-kind");

  const empty = checkUploadable({ name: "a.png", type: "image/png", size: 0 });
  assert.equal(empty.ok === false && empty.error.reason, "empty");

  const big = checkUploadable({ name: "a.png", type: "image/png", size: image.maxBytes + 1 });
  assert.equal(big.ok === false && big.error.reason, "too-big");
});

test("library tabs data hain, aur unke tag ek jagah se aate hain", () => {
  assert.equal(LIBRARY_TABS[0]?.id, "all");
  assert.deepEqual([...libraryTags()], ["music", "screen-recording"]);
  // Har tab ki kinds asli registry me honi chahiye — warna tab khaali dikhta
  // hai aur wajah kahin nahi milti.
  const kindIds = new Set(listAssetKinds().map((kind) => kind.id));
  for (const tab of LIBRARY_TABS) {
    for (const kind of tab.kinds) assert.ok(kindIds.has(kind), `tab ${tab.id}: kind ${kind} nahi hai`);
  }
});

test("formatBytes padhne layak hai", () => {
  assert.equal(formatBytes(512), "512 B");
  assert.equal(formatBytes(1536), "1.5 KB");
  assert.equal(formatBytes(64 * 1024 * 1024), "64 MB");
});

section("asset quality badge (5.9 — Phase 20 isi ko reuse karega)");

test("resolution ka naam chhoti taraf se banta hai", () => {
  // Reel 1080x1920 bhi "1080p" hai — use "1920p" kehna galat hoga.
  assert.equal(resolutionName(1080, 1920), "1080p");
  assert.equal(resolutionName(1920, 1080), "1080p");
  assert.equal(resolutionName(3840, 2160), "4K");
  assert.equal(resolutionName(640, 480), "480p");
});

test("target ke hisaab se good / ok / low", () => {
  const reel = { width: 1080, height: 1920 };

  const good = assetQuality({ kind: "image", width: 1080, height: 1920 }, reel);
  assert.equal(good.level, "good");
  assert.equal(good.badge, "1080p");

  const low = assetQuality({ kind: "image", width: 640, height: 480 }, reel);
  assert.equal(low.level, "low");
  assert.match(low.detail, /blurry/);

  const ok = assetQuality({ kind: "video", width: 864, height: 1536 }, reel);
  assert.equal(ok.level, "ok");
});

test("audio ka quality badge nahi hota, aur bina naape resolution ka bhi nahi", () => {
  assert.equal(assetQuality({ kind: "audio" }, { width: 1080, height: 1920 }).level, "unknown");
  const notProbed = assetQuality({ kind: "video", width: null, height: null }, null);
  assert.equal(notProbed.level, "unknown");
  assert.match(notProbed.detail, /probe nahi chala/);
});

test("chaudai wali kami bhi pakdi jaati hai (sirf area dekhna dhoka hai)", () => {
  // 3840x480: pixels bahut hain, par 1080x1920 me oonchai bilkul kam padti hai.
  const verdict = assetQuality({ kind: "video", width: 3840, height: 480 }, { width: 1080, height: 1920 });
  assert.equal(verdict.level, "low");
});

section("project ops (4.4 / 4.10 — rename aur version restore)");

test("setProjectProperty naam badalta hai, purana doc chhuta nahi", () => {
  const { doc } = buildFixture();
  const next = setProjectProperty(doc, { path: "name", value: "Rahul + Papa" });
  assert.equal(next.project.name, "Rahul + Papa");
  assert.equal(doc.project.name, "Check fixture");
});

test("size / fps setProjectProperty se nahi badalte (apna op maangte hain)", () => {
  const { doc } = buildFixture();
  for (const path of ["width", "height", "fps", "sizePresetId", "durationInFrames", "id"]) {
    throws(
      () => setProjectProperty(doc, { path, value: 1 }),
      /apna op/,
      `project.${path} khula nahi hona chahiye`,
    );
  }
});

test("replaceDoc poora doc badal deta hai aur undo se wapas aata hai", () => {
  const { doc } = buildFixture();
  const old = setProjectProperty(doc, { path: "name", value: "Purana version" });

  const history = createHistory<Doc>();
  let live = doc;
  live = history.apply(live, (draft) => replaceDoc.recipe(draft, { doc: old }), {
    label: "version restore",
  });
  assert.equal(live.project.name, "Purana version");
  assert.equal(live.items.length, old.items.length);

  // Restore bhi undo hona chahiye — warna "galat version restore kar diya" ka
  // koi ilaaj nahi bachta.
  live = history.undo(live);
  assert.equal(live.project.name, "Check fixture");
});

section("selection (1.13)");

test("selectByTrack aur selectRange", () => {
  const { doc, videoTrackId } = buildFixture();
  const onVideo = selectByTrack(doc, videoTrackId);
  assert.deepEqual(onVideo.itemIds, [doc.items[0]!.id]);

  const range = selectRange(doc, doc.items[0]!.id, doc.items[1]!.id);
  assert.equal(range.itemIds.length, 2);
});

test("pruneSelection gayab items ko nikaal deta hai", () => {
  const { doc } = buildFixture();
  const selection = { itemIds: [doc.items[0]!.id, "it_gayab"], trackIds: [] };
  assert.deepEqual(pruneSelection(doc, selection).itemIds, [doc.items[0]!.id]);
});

// ------------------------------------------------------------------ sample

section("sample doc (createEmptyProject + 2 items)");

const { doc: sample } = buildFixture();
const sampleParsed = safeParseDoc(sample);
test("sample doc schema pass karta hai", () => {
  assert.equal(sampleParsed.success, true);
});

console.log(JSON.stringify(sample, null, 2));

// ------------------------------------------------------------------ result

console.log(`\n${"-".repeat(60)}`);
if (failures.length > 0) {
  console.log(`FAILED: ${failures.length} fail, ${passed} pass`);
  for (const failure of failures) console.log(`  - ${failure.name}: ${failure.error}`);
  process.exit(1);
}
console.log(`ALL PASS: ${passed} assertions groups, 0 fail`);
