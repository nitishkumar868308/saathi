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
  ANIMATION_PRESETS,
  BUILTIN_FONTS,
  IDENTITY_ANIMATION,
  addAnimation,
  animationsMaxScale,
  applyAnimationPreset,
  applyAutoFit,
  clampTransitionFrames,
  composeAnimations,
  getAnimation,
  getAnimationPreset,
  getEasingFunction,
  listAnimations,
  listTransitions,
  parseCubicBezier,
  reorderAnimations,
  requireAnimation,
  setAnimationParam,
  setTransition,
  transitionOutputAt,
  copyItems,
  createItem,
  fontFaceCss,
  fontFamilyCss,
  isScaleUnchanged,
  mergeFonts,
  missingFonts,
  parseTimecode,
  setItemsProperty,
  setProjectFps,
  setProjectSize,
  cutRange,
  deleteItems,
  duplicateItems,
  isStructuralOp,
  keepRange,
  moveItems,
  pasteItems,
  rippleDeleteItems,
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
  setTrackProperty,
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

// ------------------------------------------------------- Phase 8 (editing)

/**
 * Yahan se aage sab Phase 8 hai — timeline editing.
 *
 * Ye phase sabse nazuk hai aur uski wajah saaf hai: iski galtiyaan **ek frame**
 * ki hoti hain. Ek frame ka gap ya overlap dekhne me bilkul theek lagta hai,
 * timeline me dikhta hi nahi, aur sirf final MP4 me ek jhatke ki tarah samne
 * aata hai — tab tak yaad bhi nahi rehta ki kaunsi edit ne kiya tha. Isliye
 * yahan har cheez ginti se jaanchi jaati hai, aankh se nahi.
 */

/** Ek doc jisme teen clip ek hi track par lagatar lagi hui hain (0-100-200-300). */
function chainFixture(): { doc: Doc; trackId: string; ids: string[] } {
  const base = createEmptyProject({ name: "Chain fixture" });
  const trackId = base.tracks[0]!.id;

  let doc = base;
  const ids: string[] = [];
  for (let i = 0; i < 3; i += 1) {
    const item = createItem("image", {
      fps: doc.project.fps,
      trackId,
      name: `Clip ${i + 1}`,
      assetId: `as_${i + 1}`,
      startFrame: i * 100,
      durationInFrames: 100,
    });
    doc = addItem(doc, { item });
    ids.push(item.id);
  }
  return { doc, trackId, ids };
}

function spanOf(doc: Doc, id: string): [number, number] {
  const item = itemById(doc, id);
  return [item.startFrame, item.startFrame + item.durationInFrames];
}

/** Ek track ke saare clips, kram me — `[start, end]` ki list. */
function trackSpans(doc: Doc, trackId: string): [number, number][] {
  return doc.items
    .filter((item) => item.trackId === trackId)
    .sort((a, b) => a.startFrame - b.startFrame)
    .map((item) => [item.startFrame, item.startFrame + item.durationInFrames] as [number, number]);
}

section("removeSpan ke chaaron case — cutRange se (8.5)");

test("poora andar wali clip mit jaati hai", () => {
  const { doc, trackId } = chainFixture();
  // 90-210 kaato: beech wali clip (100-200) poori andar hai.
  const next = cutRange(doc, { fromFrame: 90, toFrame: 210 });
  assert.equal(next.items.length, 2, "sirf beech wali jaani chahiye thi");
  assert.deepEqual(trackSpans(next, trackId), [
    [0, 90],
    [210, 300],
  ]);
});

test("beech se kaatne par ek clip do tukdon me bantti hai", () => {
  const { doc, trackId, ids } = chainFixture();
  const next = cutRange(doc, { fromFrame: 120, toFrame: 160 });

  assert.equal(next.items.length, 4, "ek clip ke do tukde hone chahiye the");
  assert.deepEqual(trackSpans(next, trackId), [
    [0, 100],
    [100, 120],
    [160, 200],
    [200, 300],
  ]);

  // Daayan tukda source ke andar bhi utna hi aage se shuru hona chahiye —
  // sirf startFrame badalna wo galti hai jo render me hi pakdi jaati hai.
  const right = next.items.find(
    (item) => item.startFrame === 160 && item.id !== ids[1],
  );
  assert.ok(right, "daayan tukda nahi mila");
  assert.equal(right.trimStartFrame, 60, "trimStartFrame source me 60 frames aage hona chahiye");
});

test("kinare se kaatne par trimStartFrame sahi badalta hai", () => {
  const { doc, ids } = chainFixture();
  // 150-250: beech wali ka daayan kinara, teesri ka baayan kinara.
  const next = cutRange(doc, { fromFrame: 150, toFrame: 250 });

  const middle = itemById(next, ids[1]!);
  assert.deepEqual([middle.startFrame, middle.durationInFrames], [100, 50]);
  // Daayan kinara kata — source ka shuruaat wahi rehti hai.
  assert.equal(middle.trimStartFrame, 0);

  const third = itemById(next, ids[2]!);
  assert.deepEqual([third.startFrame, third.durationInFrames], [250, 50]);
  // Baayan kinara 50 frame kata — source bhi 50 aage.
  assert.equal(third.trimStartFrame, 50);
});

test("2x speed par source ka pointer dugna khiskta hai", () => {
  const base = createEmptyProject({ name: "Speed fixture" });
  const trackId = base.tracks[0]!.id;
  const item = createItem("video", {
    fps: base.project.fps,
    trackId,
    name: "Tez clip",
    assetId: "as_fast",
    startFrame: 0,
    durationInFrames: 100,
  });
  let doc = addItem(base, { item });
  doc = setItemProperty(doc, { itemId: item.id, path: "playbackRate", value: 2 });

  // Timeline par 30 frame kaate — source me 60 frames guzre.
  const next = cutRange(doc, { fromFrame: 0, toFrame: 30 });
  assert.equal(itemById(next, item.id).trimStartFrame, 60);
});

test("locked clip ko cutRange bhi haath nahi lagata", () => {
  const { doc, ids } = chainFixture();
  const locked = setItemProperty(doc, { itemId: ids[1]!, path: "locked", value: true });
  const next = cutRange(locked, { fromFrame: 90, toFrame: 210 });

  assert.deepEqual(spanOf(next, ids[1]!), [100, 200], "locked clip waise ki waisi rehni chahiye");
});

section("cut / keep selection (8.5)");

test("cut ripple me aage ka sab utna baayein aa jaata hai", () => {
  const { doc, trackId } = chainFixture();
  const next = cutRange(doc, { fromFrame: 100, toFrame: 200, ripple: true });
  assert.deepEqual(trackSpans(next, trackId), [
    [0, 100],
    [100, 200],
  ]);
});

test("cut bina ripple ke gaddha chhod deta hai", () => {
  const { doc, trackId } = chainFixture();
  const next = cutRange(doc, { fromFrame: 100, toFrame: 200 });
  assert.deepEqual(trackSpans(next, trackId), [
    [0, 100],
    [200, 300],
  ]);
});

test("keep selection sirf beech ka hissa rakhta hai aur use 0 par le aata hai", () => {
  const { doc, trackId } = chainFixture();
  // 150-250 rakho: beech wali ka aadha + teesri ka aadha.
  const next = keepRange(doc, { fromFrame: 150, toFrame: 250, ripple: true });

  // 150-250 me se: doosri clip ka 150-200 (50 frame) aur teesri ka 200-250
  // (50 frame). Ripple ke baad dono 0 se lagatar — kul theek 100 frame.
  assert.deepEqual(trackSpans(next, trackId), [
    [0, 50],
    [50, 100],
  ]);
  const kept = next.items.reduce((sum, item) => sum + item.durationInFrames, 0);
  assert.equal(kept, 100, "kul lambai theek 100 frame honi chahiye — na 99, na 101");
});

test("keep selection ke baad source ka pointer sahi rehta hai", () => {
  const { doc, ids } = chainFixture();
  const next = keepRange(doc, { fromFrame: 150, toFrame: 250, ripple: false });

  const middle = itemById(next, ids[1]!);
  // 100-200 me se sirf 150-200 bacha: 50 frame source me aage.
  assert.deepEqual([middle.startFrame, middle.durationInFrames, middle.trimStartFrame], [150, 50, 50]);

  const third = itemById(next, ids[2]!);
  // 200-300 me se 200-250 bacha: daayan kinara kata, source wahi se.
  assert.deepEqual([third.startFrame, third.durationInFrames, third.trimStartFrame], [200, 50, 0]);
});

test("ulti range dono ops me saaf error deti hai", () => {
  const { doc } = chainFixture();
  throws(() => cutRange(doc, { fromFrame: 200, toFrame: 100 }), /ulti/, "cutRange ulti range");
  throws(() => keepRange(doc, { fromFrame: 200, toFrame: 200 }), /ulti/, "keepRange khaali range");
});

test("range sirf diye gaye tracks par lagti hai", () => {
  const { doc, videoTrackId, audioTrackId } = buildFixture();
  const next = cutRange(doc, { fromFrame: 0, toFrame: 60, trackIds: [videoTrackId] });

  // Video track ki clip kat gayi…
  assert.deepEqual(trackSpans(next, videoTrackId), [[60, 120]]);
  // …par audio ko haath nahi laga.
  assert.deepEqual(trackSpans(next, audioTrackId), [[0, 300]]);
});

section("ripple delete (8.6)");

test("ripple delete usi track par gaddha bhar deta hai", () => {
  const { doc, trackId, ids } = chainFixture();
  const next = rippleDeleteItems(doc, { itemIds: [ids[1]!] });
  assert.deepEqual(trackSpans(next, trackId), [
    [0, 100],
    [100, 200],
  ]);
});

test("do clips ek saath delete karne par dono gaddhe bharte hain", () => {
  const { doc, trackId, ids } = chainFixture();
  const next = rippleDeleteItems(doc, { itemIds: [ids[0]!, ids[2]!] });
  // Sirf beech wali bachi, aur wo 0 par aa gayi.
  assert.deepEqual(trackSpans(next, trackId), [[0, 100]]);
});

test("bina allTracks ke doosre track ko haath nahi lagta", () => {
  const { doc, videoTrackId, audioTrackId } = buildFixture();
  const videoItem = doc.items.find((item) => item.trackId === videoTrackId)!;

  const next = rippleDeleteItems(doc, { itemIds: [videoItem.id] });
  assert.deepEqual(trackSpans(next, audioTrackId), [[0, 300]], "audio apni jagah rehni chahiye");
});

test("allTracks par doosre track ki aage wali clips bhi khiskti hain", () => {
  const { doc, videoTrackId, audioTrackId } = buildFixture();
  const audioTrack = doc.tracks.find((track) => track.id === audioTrackId)!;

  // Audio track par ek aur clip 200 par.
  const later = createItem("audio", {
    fps: doc.project.fps,
    trackId: audioTrack.id,
    name: "Baad wali",
    assetId: "as_later",
    startFrame: 400,
    durationInFrames: 100,
  });
  const withLater = addItem(doc, { item: later });
  const videoItem = withLater.items.find((item) => item.trackId === videoTrackId)!;

  const next = rippleDeleteItems(withLater, { itemIds: [videoItem.id], allTracks: true });
  // Video clip 0-120 thi; uske baad wali har clip 120 frame baayein aayegi.
  assert.equal(itemById(next, later.id).startFrame, 280);
});

test("gaddhe ke beecho-beech padi clip chhui nahi jaati", () => {
  const { doc, videoTrackId, audioTrackId } = buildFixture();
  const videoItem = doc.items.find((item) => item.trackId === videoTrackId)!;
  const audioItem = doc.items.find((item) => item.trackId === audioTrackId)!;

  // Audio 0-300 hai, video 0-120. allTracks par bhi audio ka start gaddhe se
  // pehle hai, isliye wo apni jagah rehti hai — chupchaap kaat dena data-loss hota.
  const next = rippleDeleteItems(doc, { itemIds: [videoItem.id], allTracks: true });
  assert.deepEqual(spanOf(next, audioItem.id), [0, 300]);
});

test("locked clip ripple delete nahi hoti", () => {
  const { doc, ids } = chainFixture();
  const locked = setItemProperty(doc, { itemId: ids[1]!, path: "locked", value: true });
  throws(
    () => rippleDeleteItems(locked, { itemIds: [ids[1]!] }),
    /locked/,
    "locked clip ripple delete",
  );
});

section("overlap policy (8.9)");

/** Do track wala doc: ek clip 0-100 par, doosri kahin bhi rakhi ja sakti hai. */
function overlapFixture(): { doc: Doc; trackId: string; sitting: string; moving: string } {
  const base = createEmptyProject({ name: "Overlap fixture" });
  const trackId = base.tracks[0]!.id;

  const sitting = createItem("image", {
    fps: base.project.fps,
    trackId,
    name: "Baithi hui",
    assetId: "as_sitting",
    startFrame: 100,
    durationInFrames: 100,
  });
  const moving = createItem("image", {
    fps: base.project.fps,
    trackId,
    name: "Chalne wali",
    assetId: "as_moving",
    startFrame: 400,
    durationInFrames: 60,
  });

  let doc = addItem(base, { item: sitting });
  doc = addItem(doc, { item: moving });
  return { doc, trackId, sitting: sitting.id, moving: moving.id };
}

test("overwrite: upar rakhi clip jeetati hai, neeche wali kat jaati hai", () => {
  const { doc, sitting, moving } = overlapFixture();
  // 400 -> 150: baithi hui (100-200) ke beech me ghus gayi.
  const next = moveItems(doc, { itemIds: [moving], deltaFrames: -250, policy: "overwrite" });

  assert.deepEqual(spanOf(next, moving), [150, 210]);
  // Baithi hui ka daayan hissa kat gaya.
  assert.deepEqual(spanOf(next, sitting), [100, 150]);
});

test("overwrite: beech me girne par neeche wali do tukde ho jaati hai", () => {
  const { doc, trackId, sitting, moving } = overlapFixture();
  // 400 -> 120: 120-180, jo 100-200 ke poore andar hai.
  const next = moveItems(doc, { itemIds: [moving], deltaFrames: -280, policy: "overwrite" });

  assert.deepEqual(trackSpans(next, trackId), [
    [100, 120],
    [120, 180],
    [180, 200],
  ]);
  assert.deepEqual(spanOf(next, sitting), [100, 120]);
});

test("push: neeche wali kat'ti nahi, aage khisak jaati hai", () => {
  const { doc, trackId, moving } = overlapFixture();
  const next = moveItems(doc, { itemIds: [moving], deltaFrames: -250, policy: "push" });

  assert.deepEqual(trackSpans(next, trackId), [
    [150, 210],
    [210, 310],
  ]);
  // Kuch mita nahi — dono clip abhi bhi hain, poori lambai ke saath.
  assert.equal(next.items.length, 2);
});

test("reject: overlap hone hi nahi deta", () => {
  const { doc, moving } = overlapFixture();
  throws(
    () => moveItems(doc, { itemIds: [moving], deltaFrames: -250, policy: "reject" }),
    /overlap policy: reject/,
    "reject policy",
  );
});

test("bina overlap ke teeno policy ek jaisa nateeja deti hain", () => {
  const { doc, trackId, moving } = overlapFixture();
  const expected = [
    [100, 200],
    [250, 310],
  ];
  for (const policy of ["overwrite", "push", "reject"] as const) {
    const next = moveItems(doc, { itemIds: [moving], deltaFrames: -150, policy });
    assert.deepEqual(trackSpans(next, trackId), expected, `policy ${policy}`);
  }
});

section("multi-item move (8.1 / 8.10 / 8.11)");

test("group ki aapas ki doori bani rehti hai", () => {
  const { doc, trackId, ids } = chainFixture();
  const next = moveItems(doc, { itemIds: ids, deltaFrames: 50 });
  assert.deepEqual(trackSpans(next, trackId), [
    [50, 150],
    [150, 250],
    [250, 350],
  ]);
});

test("0 par clamp poore group par lagta hai, ek clip par nahi", () => {
  const { doc, trackId, ids } = chainFixture();
  // -150 maanga, par pehli clip 0 par hai — poora group sirf 0 tak hi jaayega.
  const next = moveItems(doc, { itemIds: ids, deltaFrames: -150 });
  assert.deepEqual(
    trackSpans(next, trackId),
    [
      [0, 100],
      [100, 200],
      [200, 300],
    ],
    "group ki shakl badal gayi — clamp har clip par alag laga hai",
  );
});

test("nudge: 1 frame aur 1 second dono seedhe move hain", () => {
  const { doc, ids } = chainFixture();
  assert.equal(itemById(moveItems(doc, { itemIds: [ids[0]!], deltaFrames: 1 }), ids[0]!).startFrame, 1);
  const oneSecond = secondsToFrames(1, doc.project.fps);
  assert.equal(
    itemById(moveItems(doc, { itemIds: [ids[0]!], deltaFrames: oneSecond }), ids[0]!).startFrame,
    oneSecond,
  );
});

test("track badalna sab-ya-kuch-nahi hai", () => {
  const { doc, videoTrackId, audioTrackId } = buildFixture();
  const image = doc.items.find((item) => item.trackId === videoTrackId)!;
  const audio = doc.items.find((item) => item.trackId === audioTrackId)!;

  // Dono ko ek row neeche le jao: image audio track par nahi ja sakti.
  throws(
    () => moveItems(doc, { itemIds: [image.id, audio.id], deltaFrames: 0, trackShift: 1 }),
    /nahi ja sakta/,
    "galat track par multi-move",
  );

  // Aur doc bilkul waisa ka waisa rehna chahiye — aadha move nahi hona chahiye.
  assert.equal(itemById(doc, image.id).trackId, videoTrackId);
  assert.equal(itemById(doc, audio.id).trackId, audioTrackId);
});

test("locked clip move nahi hoti", () => {
  const { doc, ids } = chainFixture();
  const locked = setItemProperty(doc, { itemId: ids[0]!, path: "locked", value: true });
  throws(() => moveItems(locked, { itemIds: ids, deltaFrames: 10 }), /locked/, "locked multi-move");
});

section("trim ki hadd (8.3)");

test("source ke ant se aage trim nahi hoti", () => {
  const { doc, ids } = chainFixture();
  // Source sirf 120 frame ka hai, par clip 100 frame ki hai aur +500 maanga.
  const next = trimItemEnd(doc, {
    itemId: ids[0]!,
    deltaFrames: 500,
    sourceDurationFrames: 120,
  });
  assert.equal(itemById(next, ids[0]!).durationInFrames, 120);
});

test("trimStartFrame source ki bachi hui lambai ghata deta hai", () => {
  const { doc, ids } = chainFixture();
  // Pehle baayan kinara 40 andar karo, phir daayein khinchne ki koshish.
  let next = trimItemStart(doc, { itemId: ids[0]!, deltaFrames: 40 });
  assert.equal(itemById(next, ids[0]!).trimStartFrame, 40);

  next = trimItemEnd(next, { itemId: ids[0]!, deltaFrames: 500, sourceDurationFrames: 120 });
  // Source me 120-40 = 80 frame bache the.
  assert.equal(itemById(next, ids[0]!).durationInFrames, 80);
});

test("source na diya ho (image) to koi upar ki hadd nahi", () => {
  const { doc, ids } = chainFixture();
  const next = trimItemEnd(doc, { itemId: ids[0]!, deltaFrames: 500 });
  assert.equal(itemById(next, ids[0]!).durationInFrames, 600);
});

test("2x speed par source aadha hi jaldi khatam hota hai", () => {
  const { doc, ids } = chainFixture();
  const fast = setItemProperty(doc, { itemId: ids[0]!, path: "playbackRate", value: 2 });
  const next = trimItemEnd(fast, { itemId: ids[0]!, deltaFrames: 500, sourceDurationFrames: 120 });
  // 120 source frames, 2x par timeline ke 60 frames.
  assert.equal(itemById(next, ids[0]!).durationInFrames, 60);
});

section("split + keyframes (8.4)");

test("split ke baad frames ka jod bilkul barabar rehta hai", () => {
  const { doc, ids } = chainFixture();
  const before = itemById(doc, ids[1]!);
  const next = splitItemAtFrame(doc, { itemId: ids[1]!, frame: 140 });

  const left = itemById(next, ids[1]!);
  const right = next.items.find((item) => item.startFrame === 140 && item.id !== ids[1]!);
  assert.ok(right, "daayan tukda nahi mila");

  assert.equal(left.durationInFrames + right.durationInFrames, before.durationInFrames);
  assert.equal(right.startFrame, left.startFrame + left.durationInFrames, "gap ya overlap");
  assert.equal(right.trimStartFrame, before.trimStartFrame + 40);
});

test("keyframes sahi tukde par jaate hain aur item-local rehte hain", () => {
  const { doc, ids } = chainFixture();
  // Item-local frames: 10 (baayein), 90 (daayein). Clip 100-200 par hai.
  const withKeys = setItemProperty(doc, {
    itemId: ids[1]!,
    path: "keyframes",
    value: {
      "transform.scale": [
        { frame: 10, value: 1, easing: "linear" },
        { frame: 90, value: 2, easing: "linear" },
      ],
    },
  });

  const next = splitItemAtFrame(withKeys, { itemId: ids[1]!, frame: 150 });
  const left = itemById(next, ids[1]!);
  const right = next.items.find((item) => item.startFrame === 150 && item.id !== ids[1]!)!;

  assert.deepEqual(
    left.keyframes["transform.scale"]?.map((kf) => kf.frame),
    [10],
    "baayein wale par sirf pehla keyframe",
  );
  // Daayein wala 90 tha; wo naye item me 90 - 50 = 40 par aana chahiye.
  assert.deepEqual(
    right.keyframes["transform.scale"]?.map((kf) => kf.frame),
    [40],
    "keyframe naye item ke apne start se ginna chahiye",
  );
});

test("split ke baad dono tukde alag-alag edit hote hain", () => {
  const { doc, ids } = chainFixture();
  const split = splitItemAtFrame(doc, { itemId: ids[1]!, frame: 150 });
  const right = split.items.find((item) => item.startFrame === 150 && item.id !== ids[1]!)!;

  const moved = moveItems(split, { itemIds: [right.id], deltaFrames: 200 });
  assert.deepEqual(spanOf(moved, ids[1]!), [100, 150], "baayan tukda apni jagah rehna chahiye");
  assert.deepEqual(spanOf(moved, right.id), [350, 400]);
});

section("copy / paste (8.8)");

test("usi project me paste playhead par girta hai", () => {
  const { doc, trackId, ids } = chainFixture();
  const fragment = copyItems(doc, [ids[0]!]);
  const next = pasteItems(doc, { fragment, atFrame: 500 });

  assert.equal(next.items.length, 4);
  const pasted = next.items.find((item) => item.startFrame === 500)!;
  assert.equal(pasted.durationInFrames, 100);
  assert.notEqual(pasted.id, ids[0], "paste ki hui clip ka id naya hona chahiye");
  assert.equal(pasted.trackId, trackId, "wahi track milna chahiye tha");
});

test("kai clips paste karne par aapas ki doori bani rehti hai", () => {
  const { doc, ids } = chainFixture();
  const fragment = copyItems(doc, [ids[0]!, ids[2]!]);
  const next = pasteItems(doc, { fragment, atFrame: 500 });

  const pasted = next.items
    .filter((item) => item.startFrame >= 500)
    .sort((a, b) => a.startFrame - b.startFrame);
  assert.equal(pasted.length, 2);
  // Original me doori 200 thi (0 aur 200) — paste ke baad bhi 200 honi chahiye.
  assert.equal(pasted[1]!.startFrame - pasted[0]!.startFrame, 200);
});

test("24fps se 30fps me paste karne par lambai seconds me bani rehti hai", () => {
  const source = createEmptyProject({ name: "24fps", fps: 24 });
  const sourceTrack = source.tracks[0]!.id;
  const item = createItem("image", {
    fps: 24,
    trackId: sourceTrack,
    name: "Do second",
    assetId: "as_x",
    startFrame: 0,
    durationInFrames: 48, // 24fps par theek 2 second
  });
  const sourceDoc = addItem(source, { item });
  const fragment = copyItems(sourceDoc, [item.id]);

  const target = createEmptyProject({ name: "30fps", fps: 30 });
  const next = pasteItems(target, { fragment, atFrame: 0 });

  const pasted = next.items[0]!;
  // 30fps par 2 second = 60 frames. Frames waise ke waise chipkane par 48 aata,
  // yaani clip 20% chhoti — aur wo galti dikhti nahi, sirf ajeeb lagti hai.
  assert.equal(pasted.durationInFrames, 60);
});

test("original track na mile to compatible track par girta hai", () => {
  const { doc } = chainFixture();
  const item = doc.items[0]!;
  const fragment = copyItems(doc, [item.id]);
  // Ek naye project me paste jahan wo trackId hai hi nahi.
  const target = createEmptyProject({ name: "Doosra project" });
  const next = pasteItems(target, { fragment, atFrame: 0 });

  assert.equal(next.items.length, 1);
  const track = next.tracks.find((t) => t.id === next.items[0]!.trackId)!;
  assert.equal(trackAccepts(track.type, "image"), true);
});

test("koi compatible track na ho to saaf error", () => {
  const { doc } = chainFixture();
  const audioOnly = createEmptyProject({ name: "Sirf audio" });
  // Video track hata do — ab image ke liye jagah nahi bachi.
  const stripped = removeTrack(audioOnly, { trackId: audioOnly.tracks[0]!.id, withItems: true });

  const fragment = copyItems(doc, [doc.items[0]!.id]);
  throws(
    () => pasteItems(stripped, { fragment, atFrame: 0 }),
    /koi track nahi hai/,
    "bina compatible track ke paste",
  );
});

test("copy doc ko chhuta tak nahi", () => {
  const { doc, ids } = chainFixture();
  const snapshot = JSON.stringify(doc);
  copyItems(doc, ids);
  assert.equal(JSON.stringify(doc), snapshot);
});

section("duration khud adjust hoti hai (8.14)");

test("aakhri clip delete karne par project chhota ho jaata hai", () => {
  const { doc, ids } = chainFixture();
  const grown = recomputeDuration(doc, undefined as never);
  assert.equal(grown.project.durationInFrames, 300);

  const deleted = deleteItems(grown, { itemIds: [ids[2]!] });
  const next = recomputeDuration(deleted, undefined as never);
  assert.equal(next.project.durationInFrames, 200);
});

test("structural ops ki list me har badalne wala op maujood hai", () => {
  // Ye test isliye hai ki naya structural op jodte waqt list me naam daalna
  // bhool jaana bilkul aam hai — aur uska nateeja ye hota hai ki project ki
  // lambai chupchaap purani padi rehti hai.
  for (const name of [
    "addItem",
    "moveItems",
    "trimItemEnd",
    "splitItemAtFrame",
    "deleteItems",
    "rippleDeleteItems",
    "cutRange",
    "keepRange",
    "pasteItems",
  ]) {
    assert.equal(isStructuralOp(name), true, `${name} structural list me nahi hai`);
  }
  assert.equal(isStructuralOp("setItemProperty"), false);
  assert.equal(isStructuralOp("setTrackProperty"), false);
});

section("undo round-trip (8.13)");

test("history no-op edit ko entry nahi banati", () => {
  // Ye vyavhaar 8.13 ke liye zaroori hai: "30 ops = 30 undo" tabhi sach hai jab
  // har op ne sach me kuch badla ho. Isi baat par pehle mera apna test phisla
  // tha — ek cut aisi jagah lagayi thi jahan kuch tha hi nahi, aur history me
  // uski entry bani hi nahi.
  const { doc, ids } = chainFixture();
  const history = createHistory<Doc>({ limit: 10 });

  const moved = history.apply(
    doc,
    ((draft: Doc) =>
      moveItems.recipe(draft as never, { itemIds: [ids[0]!], deltaFrames: 10 })) as never,
    { label: "move" },
  );
  assert.notEqual(moved, doc);
  assert.equal(history.canUndo(), true);

  // 900-920 par kuch hai hi nahi — doc waisa ka waisa lautna chahiye.
  const same = history.apply(
    moved,
    ((draft: Doc) =>
      cutRange.recipe(draft as never, { fromFrame: 900, toFrame: 920 })) as never,
    { label: "khaali cut" },
  );
  assert.equal(same, moved, "kuch nahi badla to wahi doc wapas aana chahiye");

  history.undo(same);
  assert.equal(history.canUndo(), false, "khaali cut ki entry nahi banni chahiye thi");
});

test("30 ops, 30 undo — doc bilkul shuruaati jaisa", () => {
  const { doc, trackId, ids } = chainFixture();
  const history = createHistory<Doc>({ limit: 100 });
  const start = JSON.parse(JSON.stringify(doc)) as Doc;

  let current = doc;
  let count = 0;

  /**
   * Har op ke baad jaancha jaata hai ki doc sach me badla.
   *
   * ⚠️ Bina is jaanch ke ye test jhootha ho jaata hai: koi op kuch na badle to
   * history uski entry banati hi nahi (upar wala test), aur "30 ops" me se ek
   * chupchaap ghat jaata hai. Tab undo ki ginti mel nahi khaati aur wajah
   * dhoondhne me der lagti hai.
   */
  const apply = (label: string, recipe: (draft: Doc) => void) => {
    const before = current;
    current = history.apply(current, recipe as never, { label });
    assert.notEqual(current, before, `op "${label}" ne kuch badla hi nahi`);
    count += 1;
  };

  // Har kism ka op — sirf move-move-move karne se undo ka asli imtihaan nahi hota.
  for (let round = 0; round < 3; round += 1) {
    apply("move", (draft) => moveItems.recipe(draft as never, { itemIds: ids, deltaFrames: 10 }));
    apply("nudge", (draft) =>
      moveItems.recipe(draft as never, { itemIds: [ids[0]!], deltaFrames: -5 }),
    );
    apply("trim start", (draft) =>
      trimItemStart.recipe(draft as never, { itemId: ids[1]!, deltaFrames: 5 }),
    );
    apply("trim end", (draft) =>
      trimItemEnd.recipe(draft as never, { itemId: ids[1]!, deltaFrames: 5 }),
    );
    apply("duplicate", (draft) => duplicateItems.recipe(draft as never, { itemIds: [ids[2]!] }));
    apply("property", (draft) =>
      setItemProperty.recipe(draft as never, {
        itemId: ids[0]!,
        path: "transform.opacity",
        // Har round alag value — wahi value dobara set karna no-op hota.
        value: 0.5 + round * 0.1,
      }),
    );
    apply("track property", (draft) =>
      setTrackProperty.recipe(draft as never, { trackId, path: "muted", value: round % 2 === 0 }),
    );
    apply("cut ripple", (draft) =>
      // Shuruaat ke 5 frame kaato — yahan hamesha kuch hota hai, isliye ye op
      // kabhi khaali nahi jaata.
      cutRange.recipe(draft as never, { fromFrame: 0, toFrame: 5, ripple: true }),
    );
    apply("project property", (draft) =>
      setProjectProperty.recipe(draft as never, { path: "name", value: `Round ${round}` }),
    );
    apply("delete duplicate", (draft) => {
      const extra = draft.items.filter((item) => !ids.includes(item.id));
      assert.ok(extra.length > 0, "duplicate ki hui clip milni chahiye thi");
      deleteItems.recipe(draft as never, { itemIds: [extra[extra.length - 1]!.id] });
    });
  }

  assert.equal(count, 30, "tees ops chalne chahiye the");
  assert.notDeepEqual(current, start, "tees ops ke baad doc badla hua hona chahiye");

  for (let i = 0; i < 30; i += 1) {
    assert.equal(history.canUndo(), true, `undo ${i + 1} par history khaali ho gayi`);
    current = history.undo(current);
  }

  assert.equal(history.canUndo(), false, "tees undo ke baad aur kuch nahi bachna chahiye");
  assert.deepEqual(current, start, "undo round-trip ke baad doc shuruaati jaisa nahi hai");
});

test("redo bhi wapas wahi laata hai", () => {
  const { doc, ids } = chainFixture();
  const history = createHistory<Doc>({ limit: 50 });

  let current = doc;
  for (let i = 0; i < 5; i += 1) {
    current = history.apply(
      current,
      ((draft: Doc) =>
        moveItems.recipe(draft as never, { itemIds: [ids[0]!], deltaFrames: 10 })) as never,
      { label: `move ${i}` },
    );
  }
  const afterOps = JSON.parse(JSON.stringify(current)) as Doc;

  for (let i = 0; i < 5; i += 1) current = history.undo(current);
  for (let i = 0; i < 5; i += 1) current = history.redo(current);

  assert.deepEqual(current, afterOps);
});

section("non-destructive (8.12 ka doc-level hissa)");

test("koi bhi op assetId nahi badalta aur trimStartFrame kabhi negative nahi hota", () => {
  const { doc, ids } = chainFixture();
  const assetsBefore = new Set(doc.items.map((item) => item.assetId));

  let current = doc;
  current = moveItems(current, { itemIds: ids, deltaFrames: 37 });
  current = trimItemStart(current, { itemId: ids[0]!, deltaFrames: 20 });
  current = trimItemEnd(current, { itemId: ids[1]!, deltaFrames: -30 });
  current = splitItemAtFrame(current, { itemId: ids[2]!, frame: 300 });
  current = cutRange(current, { fromFrame: 50, toFrame: 90, ripple: true });
  current = duplicateItems(current, { itemIds: [ids[0]!] });
  current = pasteItems(current, { fragment: copyItems(current, [ids[1]!]), atFrame: 900 });

  for (const item of current.items) {
    assert.ok(
      assetsBefore.has(item.assetId),
      `naya assetId aa gaya: ${String(item.assetId)} — ops ko media banani nahi hai`,
    );
    assert.ok(item.trimStartFrame >= 0, `${item.name} ka trimStartFrame negative hai`);
    assert.ok(item.durationInFrames >= 1, `${item.name} ki lambai 1 frame se kam hai`);
    assert.ok(item.startFrame >= 0, `${item.name} timeline se pehle chala gaya`);
  }
});

test("ops purana doc kabhi nahi badalte (immutability)", () => {
  const { doc, ids } = chainFixture();
  const before = JSON.stringify(doc);

  moveItems(doc, { itemIds: ids, deltaFrames: 100 });
  cutRange(doc, { fromFrame: 0, toFrame: 150, ripple: true });
  keepRange(doc, { fromFrame: 100, toFrame: 200, ripple: true });
  rippleDeleteItems(doc, { itemIds: [ids[0]!] });
  pasteItems(doc, { fragment: copyItems(doc, ids), atFrame: 0 });

  assert.equal(JSON.stringify(doc), before, "kisi op ne purana doc badal diya");
});

// -------------------------------------------------- Phase 9 (panel + text)

section("timecode padhna (9.7)");

test("chaaron roop chalte hain", () => {
  assert.equal(parseTimecode("90", 30), 90, "seedha frame number");
  assert.equal(parseTimecode("12:05", 30), 12 * 30 + 5, "SS:FF");
  assert.equal(parseTimecode("01:12:05", 30), (60 + 12) * 30 + 5, "MM:SS:FF");
  assert.equal(parseTimecode("00:01:12:05", 30), (60 + 12) * 30 + 5, "HH:MM:SS:FF");
});

test("aakhri hissa hamesha frames hai, seconds ka dashamlav nahi", () => {
  // "12:05" ko 12.05 second padhna sabse aam galti hoti — 30fps par wo 361
  // frames deta, jabki sahi jawab 365 hai.
  assert.equal(parseTimecode("12:05", 30), 365);
});

test("har fps par sahi ginti", () => {
  assert.equal(parseTimecode("00:01:00", 24), 24);
  assert.equal(parseTimecode("00:01:00", 25), 25);
  assert.equal(parseTimecode("00:01:00", 60), 60);
});

test("galat input par null milta hai, 0 nahi", () => {
  // Chupchaap 0 laut'na sabse bura jawab hai: ek typo clip ko shuruaat me
  // phenk deta aur user ko lagta hai editor ne khud kuch kar diya.
  assert.equal(parseTimecode("", 30), null);
  assert.equal(parseTimecode("abc", 30), null);
  assert.equal(parseTimecode("1:2:3:4:5", 30), null);
  assert.equal(parseTimecode("00:1x:00", 30), null);
});

test("hadd se bahar wale hisse mana hain", () => {
  assert.equal(parseTimecode("00:35", 30), null, "30fps par frame 35 ho hi nahi sakta");
  assert.equal(parseTimecode("00:75:00", 30), null, "75 second ho hi nahi sakte");
  assert.equal(parseTimecode("500", 30), 500, "par akela number bada ho sakta hai");
});

test("framesToTimecode ke saath aana-jaana barabar rehta hai", () => {
  for (const fps of [24, 25, 30, 60]) {
    for (const frames of [0, 1, 37, 512, 18000]) {
      const text = framesToTimecode(frames, fps);
      assert.equal(parseTimecode(text, fps), frames, `${fps}fps / ${frames}f -> "${text}"`);
    }
  }
});

section("multi-select edit ek undo entry me (9.5)");

test("setItemsProperty saare chune hue items par lagti hai", () => {
  const { doc, ids } = chainFixture();
  const next = setItemsProperty(doc, { itemIds: ids, path: "transform.opacity", value: 0.4 });
  for (const id of ids) assert.equal(itemById(next, id).transform.opacity, 0.4);
});

test("jis item par wo property hai hi nahi, wo chhoot jaata hai", () => {
  const { doc, videoTrackId, audioTrackId } = buildFixture();
  const image = doc.items.find((item) => item.trackId === videoTrackId)!;
  const audio = doc.items.find((item) => item.trackId === audioTrackId)!;

  // `text.color` image ya audio kisi par nahi hai — error nahi aana chahiye,
  // aur doc bhi nahi badalna chahiye.
  const next = setItemsProperty(doc, {
    itemIds: [image.id, audio.id],
    path: "text.color",
    value: "#fff",
  });
  assert.equal(itemById(next, image.id).text, null);
  assert.equal(itemById(next, audio.id).text, null);
});

test("null ke andar likhna mana hai (mixed selection ka asli case)", () => {
  /*
   * Ye test ek asli bug ke baad juda hai. Pehle sirf root (`text`) ki jaanch
   * thi aur wo `undefined` se compare hoti thi; image par `text` `null` hota
   * hai, isliye jaanch paas ho jaati thi aur op image par
   * `text: { color: "..." }` bana deta tha — ek aisa item jo schema ke hisaab
   * se toota hua hai, aur ye save hone ke baad hi pakda jaata.
   *
   * Yahi baat ek level gehre bhi lagti hai: do text items chune hon jinme se
   * ek par stroke hai aur ek par nahi, to panel `—` ke saath stroke ka control
   * dikhata hai. Uspar likhne se **bina stroke wale** item par aadha stroke
   * (sirf width, bina color ke) nahi banna chahiye.
   */
  // Khaali project do track ke saath aata hai (video + audio) — text ka track
  // jodna padta hai.
  const base = addTrack(createEmptyProject({ name: "Null guard" }), { typeId: "text" });
  const trackId = base.tracks[base.tracks.length - 1]!.id;
  const withStroke = createItem("text", { fps: base.project.fps, trackId, name: "A" });
  const withoutStroke = createItem("text", { fps: base.project.fps, trackId, name: "B" });

  let doc = addItem(base, { item: withStroke });
  doc = addItem(doc, { item: withoutStroke });
  doc = setItemsProperty(doc, {
    itemIds: [withStroke.id],
    path: "text.stroke",
    value: { color: "#000000", width: 4 },
  });

  const next = setItemsProperty(doc, {
    itemIds: [withStroke.id, withoutStroke.id],
    path: "text.stroke.width",
    value: 9,
  });

  assert.equal(itemById(next, withStroke.id).text?.stroke?.width, 9, "jispar stroke tha wo badla");
  assert.equal(
    itemById(next, withoutStroke.id).text?.stroke,
    null,
    "jispar stroke nahi tha uspar aadha stroke nahi banna chahiye",
  );
  // Poora doc abhi bhi schema ke hisaab se sahi hona chahiye.
  assert.equal(safeParseDoc(next).success, true, "op ke baad doc schema se bahar chala gaya");
});

test("locked item par kuch nahi lagta", () => {
  const { doc, ids } = chainFixture();
  const locked = setItemProperty(doc, { itemId: ids[0]!, path: "locked", value: true });
  const next = setItemsProperty(locked, { itemIds: ids, path: "transform.opacity", value: 0.2 });

  assert.equal(itemById(next, ids[0]!).transform.opacity, 1, "locked ko chhua nahi jaana chahiye");
  assert.equal(itemById(next, ids[1]!).transform.opacity, 0.2);
});

test("protected paths yahan bhi bandh hain", () => {
  const { doc, ids } = chainFixture();
  for (const path of ["startFrame", "durationInFrames", "trackId"]) {
    throws(
      () => setItemsProperty(doc, { itemIds: ids, path, value: 5 }),
      /seedhe set nahi hota/,
      `${path} multi-set`,
    );
  }
});

section("auto-fit ek undo entry me (9.6b)");

test("applyAutoFit chaaron property ek saath lagata hai", () => {
  const { doc, ids } = chainFixture();
  const next = applyAutoFit(doc, {
    patches: [{ itemId: ids[0]!, mode: "contain", scale: 0.5, x: 10, y: -20 }],
  });
  const item = itemById(next, ids[0]!);
  assert.equal(item.fit.mode, "contain");
  assert.equal(item.transform.scale, 0.5);
  assert.equal(item.transform.x, 10);
  assert.equal(item.transform.y, -20);
});

test("scale null ho to usko haath nahi lagta (Center wala case)", () => {
  const { doc, ids } = chainFixture();
  const zoomed = setItemProperty(doc, { itemId: ids[0]!, path: "transform.scale", value: 2.5 });
  const next = applyAutoFit(zoomed, {
    patches: [{ itemId: ids[0]!, mode: "custom", scale: null, x: 0, y: 0 }],
  });
  assert.equal(itemById(next, ids[0]!).transform.scale, 2.5, "Center ko scale nahi badalni chahiye");
  assert.equal(itemById(next, ids[0]!).transform.x, 0);
});

test("AUTO_FIT_ACTIONS ka nateeja seedha patch banta hai", () => {
  // Panel yahi karta hai: action se patch, phir ek op. Yahan wo poora raasta
  // milaya jaata hai taaki "Center" jaisa NaN wala case chhoot na jaaye.
  const frame = { width: 1080, height: 1920 };
  const source = { width: 1920, height: 1080 };
  const { doc, ids } = chainFixture();

  for (const action of AUTO_FIT_ACTIONS) {
    const patch = action.apply(source, frame);
    const next = applyAutoFit(doc, {
      patches: [
        {
          itemId: ids[0]!,
          mode: patch.mode,
          scale: isScaleUnchanged(patch) ? null : patch.scale,
          x: patch.x,
          y: patch.y,
        },
      ],
    });
    const item = itemById(next, ids[0]!);
    assert.ok(item.transform.scale > 0, `${action.id}: scale ${item.transform.scale}`);
    assert.ok(Number.isFinite(item.transform.x), `${action.id}: x NaN ho gaya`);
  }
});

section("project ka size aur fps (9.13)");

test("size badalne par frame badalta hai, items nahi (bina refit ke)", () => {
  const { doc, ids } = chainFixture();
  const before = itemById(doc, ids[0]!).transform.scale;
  const next = setProjectSize(doc, { width: 1920, height: 1080 });

  assert.deepEqual([next.project.width, next.project.height], [1920, 1080]);
  assert.equal(itemById(next, ids[0]!).transform.scale, before, "bina maange re-fit nahi hona chahiye");
});

test("refit par items anupaat me badalte hain", () => {
  const { doc, ids } = chainFixture();
  const moved = setItemProperty(doc, { itemId: ids[0]!, path: "transform.x", value: 108 });
  // 1080x1920 -> 540x960 : aadha.
  const next = setProjectSize(moved, { width: 540, height: 960, refit: true });

  const item = itemById(next, ids[0]!);
  assert.equal(item.transform.x, 54, "x aadha hona chahiye tha");
  assert.equal(item.transform.scale, 0.5, "scale bhi aadhi");
});

test("bahut chhote naap par saaf error", () => {
  const { doc } = chainFixture();
  throws(() => setProjectSize(doc, { width: 1, height: 1 }), /bahut chhota/, "chhota size");
});

test("fps badalne par bina rescale ke frames waise ke waise rehte hain", () => {
  const { doc, ids } = chainFixture();
  const before = itemById(doc, ids[1]!).startFrame;
  const next = setProjectFps(doc, { fps: 60 });

  assert.equal(next.project.fps, 60);
  assert.equal(itemById(next, ids[1]!).startFrame, before);
});

test("rescale par har clip ka waqt (seconds) waisa hi rehta hai", () => {
  const { doc, ids } = chainFixture();
  const item = itemById(doc, ids[1]!);
  const secondsBefore = framesToSeconds(item.startFrame, doc.project.fps);

  const next = setProjectFps(doc, { fps: 60, rescaleItems: true });
  const after = itemById(next, ids[1]!);

  assert.equal(framesToSeconds(after.startFrame, 60), secondsBefore, "start ka waqt badal gaya");
  assert.equal(after.startFrame, item.startFrame * 2);
  assert.equal(after.durationInFrames, item.durationInFrames * 2);
});

test("rescale keyframes ko bhi le jaata hai", () => {
  const { doc, ids } = chainFixture();
  const withKeys = setItemProperty(doc, {
    itemId: ids[0]!,
    path: "keyframes",
    value: { "transform.scale": [{ frame: 30, value: 2, easing: "linear" }] },
  });
  const next = setProjectFps(withKeys, { fps: 60, rescaleItems: true });
  // 30fps ke frame 30 (1 second) ko 60fps par frame 60 hona chahiye — warna
  // animation aadhe waqt me khatam ho jaati aur wajah samajh nahi aati.
  assert.equal(itemById(next, ids[0]!).keyframes["transform.scale"]?.[0]?.frame, 60);
});

section("font registry (9.10)");

test("built-in sirf system fonts hain — koi file nahi maangte", () => {
  for (const font of BUILTIN_FONTS) {
    assert.equal(font.files.length, 0, `${font.id} kisi file par tika hai`);
    assert.ok(font.fallback.length > 0, `${font.id} ka fallback khaali hai`);
  }
});

test("mergeFonts baahar wale font jodta hai aur wahi id ho to badal deta hai", () => {
  const custom = {
    id: "Poppins",
    label: "Poppins",
    fallback: "sans-serif",
    files: [{ file: "poppins-700.woff2", weight: 700, style: "normal" as const }],
    weights: [700],
  };
  const merged = mergeFonts([custom]);
  assert.ok(merged.some((font) => font.id === "Poppins"));
  assert.equal(merged.length, BUILTIN_FONTS.length + 1);

  // Wahi id dobara — list badhni nahi chahiye.
  assert.equal(mergeFonts([custom, { ...custom, label: "Poppins 2" }]).length, BUILTIN_FONTS.length + 1);
});

test("@font-face sirf un fonts ka banta hai jinki file hai", () => {
  const css = fontFaceCss(BUILTIN_FONTS);
  assert.equal(css, "", "system fonts ke liye koi @font-face nahi hona chahiye");

  const withFile = mergeFonts([
    {
      id: "Poppins",
      label: "Poppins",
      fallback: "sans-serif",
      files: [{ file: "poppins-700.woff2", weight: 700, style: "normal" }],
      weights: [700],
    },
  ]);
  const out = fontFaceCss(withFile);
  assert.ok(out.includes("@font-face"));
  assert.ok(out.includes("/fonts/poppins-700.woff2"), out);
  assert.ok(out.includes('format("woff2")'), out);
  // `font-display: block` isliye ki text pehle kisi aur font me dikh kar phir
  // badal na jaaye — wo "flash" render me ek-do frame par pakda jaata hai.
  assert.ok(out.includes("font-display: block"));
});

test("family stack me hamesha fallback rehta hai", () => {
  const fonts = mergeFonts([
    {
      id: "Poppins",
      label: "Poppins",
      fallback: "sans-serif",
      files: [{ file: "p.woff2", weight: 400, style: "normal" }],
      weights: [400],
    },
  ]);
  assert.equal(fontFamilyCss(fonts, "Poppins"), "Poppins, sans-serif");
  // Anjaan naam bhi aage jaata hai (user ke system par ho sakta hai), par
  // fallback ke saath — taaki text gayab na ho.
  assert.ok(fontFamilyCss(fonts, "Koi Aur Font").includes("Koi Aur Font"));
  assert.ok(fontFamilyCss(fonts, "Koi Aur Font").includes("system-ui"));
});

test("missing fonts pehchane jaate hain, par brand tokens nahi", () => {
  assert.deepEqual(missingFonts(BUILTIN_FONTS, ["system-ui", "Georgia"]), []);
  assert.deepEqual(missingFonts(BUILTIN_FONTS, ["Poppins"]), ["Poppins"]);
  // Brand token render ke waqt asli naam me badalta hai — uski shikayat yahan
  // karna galat chetavni hoti (Phase 17 me uski apni jaanch hogi).
  assert.deepEqual(missingFonts(BUILTIN_FONTS, ["brand.font.display"]), []);
});

// ------------------------------------------ Phase 10 (animations + transitions)

section("easing (10.3 — ek hi implementation dono jagah)");

test("har curve 0 par 0 aur 1 par 1 deti hai", () => {
  for (const id of ["linear", "ease", "ease-in", "ease-out", "ease-in-out", "spring"]) {
    const fn = getEasingFunction(id);
    assert.equal(fn(0), 0, `${id} 0 par`);
    assert.equal(fn(1), 1, `${id} 1 par`);
  }
});

test("curve beech me 0..1 ke andar hi rehti hai (spring ke halke uchhaal ko chhod kar)", () => {
  for (const id of ["linear", "ease", "ease-in", "ease-out", "ease-in-out"]) {
    const fn = getEasingFunction(id);
    for (let t = 0; t <= 1; t += 0.05) {
      const value = fn(t);
      assert.ok(value >= -0.01 && value <= 1.01, `${id} ${t.toFixed(2)} par ${value}`);
    }
  }
});

test("ease-in dheere shuru hota hai, ease-out dheere khatam", () => {
  // Ye do curve aapas me ulte hone chahiye — agar dono ek jaise nikle to kahin
  // ek hi function do naam se register hai.
  assert.ok(getEasingFunction("ease-in")(0.25) < 0.25, "ease-in shuru me peeche hona chahiye");
  assert.ok(getEasingFunction("ease-out")(0.25) > 0.25, "ease-out shuru me aage hona chahiye");
});

test("custom cubic-bezier CSS ki likhawat se chalta hai", () => {
  const fn = getEasingFunction("cubic-bezier(0.42, 0, 0.58, 1)");
  const builtin = getEasingFunction("ease-in-out");
  for (const t of [0.1, 0.3, 0.5, 0.7, 0.9]) {
    assert.ok(Math.abs(fn(t) - builtin(t)) < 1e-6, `t=${t}: custom aur ease-in-out alag`);
  }
});

test("galat easing par default milta hai, crash nahi", () => {
  // Purana doc kisi aise easing ka naam le sakta hai jo ab nahi hai. Uske liye
  // poora render rok dena galat hoga.
  const fn = getEasingFunction("kuch-bhi-nahi");
  assert.equal(fn(0), 0);
  assert.equal(fn(1), 1);
  assert.equal(parseCubicBezier("cubic-bezier(a,b,c,d)"), null);
});

section("animations registry (10.1 / 10.2)");

test("saatoon built-in animation registered hain", () => {
  const ids = listAnimations().map((entry) => entry.id);
  for (const id of ["kenburns", "pan", "fade", "slide", "scalePop", "rotateIn", "blurIn"]) {
    assert.ok(ids.includes(id), `${id} registry me nahi hai`);
  }
});

test("har animation ke defaults uske apne schema se pass hote hain", () => {
  // Ye jaanch isliye hai ki defaults aur schema aksar alag-alag likhe jaate hain
  // aur ek din default hi invalid ho jaata — jo naya item banate hi phat'ta hai.
  for (const entry of listAnimations()) {
    const result = entry.schema.safeParse(entry.defaults);
    assert.equal(result.success, true, `${entry.id} ke defaults schema se bahar hain`);
  }
});

test("har animation ka har control uske defaults me maujood hai", () => {
  for (const entry of listAnimations()) {
    for (const control of entry.controls) {
      assert.ok(
        control.path in entry.defaults,
        `${entry.id}: control "${control.path}" ka koi default nahi`,
      );
    }
  }
});

section("animation compose hoti hai, overwrite nahi (10.1)");

/** Ek item jispar animation lagayi ja sake. */
function animItem(animations: Record<string, unknown>[], scale = 1): Item {
  const base = createItem("image", { fps: 30, trackId: "tr", durationInFrames: 100 });
  return {
    ...base,
    transform: { ...base.transform, scale },
    animations: animations as Item["animations"],
  };
}

const FRAME = { width: 1080, height: 1920 };

test("bina animation ke sab kuch waisa ka waisa", () => {
  const out = composeAnimations(animItem([]), 0, FRAME);
  assert.deepEqual(out, IDENTITY_ANIMATION);
});

test("Ken Burns scale badhati hai aur ant me `to` par pahunchti hai", () => {
  const item = animItem([{ type: "kenburns", enabled: true, from: 1, to: 1.4, easing: "linear" }]);
  assert.ok(Math.abs(composeAnimations(item, 0, FRAME).scale - 1) < 1e-9);
  assert.ok(Math.abs(composeAnimations(item, 50, FRAME).scale - 1.2) < 1e-9, "beech me aadha");
  assert.ok(Math.abs(composeAnimations(item, 100, FRAME).scale - 1.4) < 1e-9);
});

test("do animations ek doosre ko mitati nahi — scale guna, position jud", () => {
  const item = animItem([
    { type: "kenburns", enabled: true, from: 1, to: 2, easing: "linear" },
    { type: "pan", enabled: true, direction: "left", amountPercent: 10, easing: "linear" },
  ]);
  const out = composeAnimations(item, 100, FRAME);
  assert.ok(Math.abs(out.scale - 2) < 1e-9, "zoom bacha hona chahiye");
  assert.ok(out.x < 0, "pan ne bhi apna kaam kiya hona chahiye");
});

test("`enabled: false` wali animation ginti me nahi aati", () => {
  const item = animItem([{ type: "kenburns", enabled: false, from: 1, to: 2, easing: "linear" }]);
  assert.equal(composeAnimations(item, 100, FRAME).scale, 1);
});

test("anjaan animation chup-chaap chhoot jaati hai, crash nahi", () => {
  // Purana doc kisi aise animation ka naam le sakta hai jo ab nahi hai — uske
  // liye poora render rok dena galat hoga. Uski shikayat Phase 20 karega.
  const item = animItem([{ type: "koi-purani-animation", enabled: true }]);
  assert.deepEqual(composeAnimations(item, 50, FRAME), IDENTITY_ANIMATION);
});

test("fade in/out dono kinaron par 0 par pahunchta hai", () => {
  const item = animItem([
    { type: "fade", enabled: true, mode: "both", durationInFrames: 10, easing: "linear" },
  ]);
  assert.equal(composeAnimations(item, 0, FRAME).opacity, 0, "shuruaat me gayab");
  assert.equal(composeAnimations(item, 10, FRAME).opacity, 1, "10 frame baad poora");
  assert.equal(composeAnimations(item, 50, FRAME).opacity, 1, "beech me poora");
  assert.equal(composeAnimations(item, 100, FRAME).opacity, 0, "ant me gayab");
});

test("item ka apna transform animation se mitta nahi (10.1 ka asli niyam)", () => {
  // Ye is poore phase ka sabse zaroori niyam hai: animation `transform.scale`
  // ko overwrite kare to user ka zoom aur uske keyframes chup-chaap gayab ho
  // jaate hain. Yahan item ki apni scale 2 hai aur animation 1.5 maang rahi hai
  // — nateeja 3 hona chahiye, 1.5 nahi.
  const item = animItem(
    [{ type: "kenburns", enabled: true, from: 1.5, to: 1.5, easing: "linear" }],
    2,
  );
  const animation = composeAnimations(item, 0, FRAME);
  assert.equal(animation.scale, 1.5, "animation apna delta deti hai");
  assert.equal(item.transform.scale * animation.scale, 3, "renderer dono ko guna karta hai");
});

test("focal point beech se hatane par position bhi khiskti hai", () => {
  const center = animItem([
    { type: "kenburns", enabled: true, from: 1, to: 2, focalX: 0.5, focalY: 0.5, easing: "linear" },
  ]);
  const corner = animItem([
    { type: "kenburns", enabled: true, from: 1, to: 2, focalX: 0, focalY: 0, easing: "linear" },
  ]);
  assert.equal(composeAnimations(center, 100, FRAME).x, 0, "beech par koi drift nahi");
  assert.ok(composeAnimations(corner, 100, FRAME).x > 0, "kone par drift hona chahiye");
});

section("upscale guard (10.11)");

test("animationsMaxScale sabse bada scale deta hai, chalte hue wala nahi", () => {
  // Ken Burns 1 -> 1.4 me blur clip ke **aakhir** me aata hai. Shuruaati scale
  // dekhne se sab theek lagta hai aur dhundhlapan video me baad me pakda jaata.
  const item = animItem([{ type: "kenburns", enabled: true, from: 1, to: 1.4, easing: "linear" }]);
  assert.equal(animationsMaxScale(item), 1.4);
  assert.equal(composeAnimations(item, 0, FRAME).scale, 1, "chalte hue wala 1 hi hai");
});

test("bina scale wali animations 1 hi dete hain", () => {
  const item = animItem([
    { type: "fade", enabled: true, mode: "in", durationInFrames: 10 },
    { type: "pan", enabled: true, direction: "left", amountPercent: 20 },
  ]);
  assert.equal(animationsMaxScale(item), 1);
});

section("transitions (10.4 / 10.5 / 10.6)");

test("saatoon transition registered hain", () => {
  const ids = listTransitions().map((entry) => entry.id);
  for (const id of ["none", "fade", "crossfade", "slide", "zoom", "blur", "wipe"]) {
    assert.ok(ids.includes(id), `${id} registry me nahi hai`);
  }
});

test("har transition ke defaults uske schema se pass hote hain", () => {
  for (const entry of listTransitions()) {
    assert.equal(entry.schema.safeParse(entry.defaults).success, true, `${entry.id}`);
  }
});

test("transition sirf apne hisse me chalti hai, beech me nahi", () => {
  const args = {
    durationInFrames: 100,
    transitionIn: { type: "fade", durationInFrames: 10 },
    transitionOut: { type: "fade", durationInFrames: 10 },
    frame: FRAME,
  };
  assert.ok(transitionOutputAt({ ...args, localFrame: 0 }) !== null, "shuruaat me chalni chahiye");
  assert.equal(transitionOutputAt({ ...args, localFrame: 50 }), null, "beech me kuch nahi");
  assert.ok(transitionOutputAt({ ...args, localFrame: 95 }) !== null, "ant me chalni chahiye");
});

test("fade in 0 se 1 aur fade out 1 se 0", () => {
  const args = {
    durationInFrames: 100,
    transitionIn: { type: "fade", durationInFrames: 10, easing: "linear" },
    transitionOut: { type: "fade", durationInFrames: 10, easing: "linear" },
    frame: FRAME,
  };
  assert.equal(transitionOutputAt({ ...args, localFrame: 0 })?.opacity, 0);
  assert.ok((transitionOutputAt({ ...args, localFrame: 5 })?.opacity ?? 0) > 0.4);
  // Out ka aakhri frame lagbhag gayab hona chahiye.
  const last = transitionOutputAt({ ...args, localFrame: 99 })?.opacity ?? 1;
  assert.ok(last < 0.2, `ant par opacity ${last}`);
});

test("`none` par kuch nahi lagta", () => {
  assert.equal(
    transitionOutputAt({
      localFrame: 0,
      durationInFrames: 100,
      transitionIn: { type: "none", durationInFrames: 10 },
      transitionOut: { type: "none", durationInFrames: 0 },
      frame: FRAME,
    }),
    null,
  );
});

test("wipe ka clip-path disha ke hisaab se banta hai", () => {
  const out = transitionOutputAt({
    localFrame: 0,
    durationInFrames: 100,
    transitionIn: { type: "wipe", durationInFrames: 10, direction: "left", easing: "linear" },
    transitionOut: { type: "none", durationInFrames: 0 },
    frame: FRAME,
  });
  assert.equal(out?.clipPath, "inset(0 100% 0 0)", "shuruaat me poora chhupa hona chahiye");
});

test("clamp: do transitions milkar clip se lambi nahi ho sakti (10.6)", () => {
  const clamped = clampTransitionFrames({ durationInFrames: 30, inFrames: 20, outFrames: 20 });
  assert.equal(clamped.clamped, true);
  assert.ok(clamped.inFrames + clamped.outFrames <= 29, "kam se kam ek frame poora dikhna chahiye");
  // Anupaat bana rehna chahiye — ek ko poora kaat dena galat lagta hai.
  assert.equal(clamped.inFrames, clamped.outFrames);
});

test("clamp: samaane wali lambai chhui nahi jaati", () => {
  const clamped = clampTransitionFrames({ durationInFrames: 100, inFrames: 10, outFrames: 10 });
  assert.deepEqual(clamped, { inFrames: 10, outFrames: 10, clamped: false });
});

test("clamp ke baad bhi transition apni jagah par hi chalti hai", () => {
  // Clip 30 frame ki, dono transitions 20-20 maang rahi thi. Clamp ke baad
  // beech me kam se kam ek frame aisa hona chahiye jahan kuch na ho.
  const clamped = clampTransitionFrames({ durationInFrames: 30, inFrames: 20, outFrames: 20 });
  const args = {
    durationInFrames: 30,
    transitionIn: { type: "fade", durationInFrames: 20 },
    transitionOut: { type: "fade", durationInFrames: 20 },
    frame: FRAME,
  };
  const middle = clamped.inFrames;
  assert.equal(transitionOutputAt({ ...args, localFrame: middle }), null, `frame ${middle} khaali hona chahiye`);
});

section("animation ops (10.9 / 10.10)");

test("addAnimation stack me jodti hai, badalti nahi", () => {
  const { doc, ids } = chainFixture();
  let next = addAnimation(doc, { itemIds: [ids[0]!], typeId: "kenburns" });
  next = addAnimation(next, { itemIds: [ids[0]!], typeId: "fade" });

  const item = itemById(next, ids[0]!);
  assert.equal(item.animations.length, 2);
  assert.deepEqual(item.animations.map((a) => a.type), ["kenburns", "fade"]);
});

test("naya animation apne registry defaults ke saath aata hai", () => {
  const { doc, ids } = chainFixture();
  const next = addAnimation(doc, { itemIds: [ids[0]!], typeId: "kenburns" });
  const animation = itemById(next, ids[0]!).animations[0] as Record<string, unknown>;
  assert.equal(animation.to, requireAnimation("kenburns").defaults.to);
});

test("reorder kram badalta hai (aur kram sach me matlab rakhta hai)", () => {
  const { doc, ids } = chainFixture();
  let next = addAnimation(doc, { itemIds: [ids[0]!], typeId: "kenburns" });
  next = addAnimation(next, { itemIds: [ids[0]!], typeId: "pan" });
  next = reorderAnimations(next, { itemId: ids[0]!, from: 1, to: 0 });

  assert.deepEqual(itemById(next, ids[0]!).animations.map((a) => a.type), ["pan", "kenburns"]);
});

test("param badalne se sirf wahi animation badalti hai", () => {
  const { doc, ids } = chainFixture();
  let next = addAnimation(doc, { itemIds: [ids[0]!], typeId: "kenburns" });
  next = addAnimation(next, { itemIds: [ids[0]!], typeId: "kenburns" });
  next = setAnimationParam(next, { itemId: ids[0]!, index: 1, path: "to", value: 3 });

  const animations = itemById(next, ids[0]!).animations as Record<string, unknown>[];
  assert.equal(animations[0]?.to, 1.2, "pehli waali chhuti nahi honi chahiye");
  assert.equal(animations[1]?.to, 3);
});

test("type path se nahi badalta", () => {
  const { doc, ids } = chainFixture();
  const next = addAnimation(doc, { itemIds: [ids[0]!], typeId: "kenburns" });
  throws(
    () => setAnimationParam(next, { itemId: ids[0]!, index: 0, path: "type", value: "pan" }),
    /purani hatao/,
    "type badalna",
  );
});

test("preset ek hi baar me poora stack lagata hai", () => {
  const { doc, ids } = chainFixture();
  const preset = getAnimationPreset("cinematic-drift");
  assert.ok(preset && preset.animations.length === 3);

  const next = applyAnimationPreset(doc, { itemIds: [ids[0]!], presetId: "cinematic-drift" });
  assert.equal(itemById(next, ids[0]!).animations.length, 3);
});

test("preset default me purani animations hata deta hai", () => {
  const { doc, ids } = chainFixture();
  let next = addAnimation(doc, { itemIds: [ids[0]!], typeId: "rotateIn" });
  next = applyAnimationPreset(next, { itemIds: [ids[0]!], presetId: "kenburns-slow" });

  const animations = itemById(next, ids[0]!).animations;
  assert.equal(animations.length, 1);
  assert.equal(animations[0]?.type, "kenburns");
});

test("har preset sirf registered animations use karta hai", () => {
  // Preset data hai, isliye usme galat naam likhna bahut aasan hai — aur wo
  // galti chup-chaap "animation lagi hi nahi" bankar aati hai.
  for (const preset of ANIMATION_PRESETS) {
    for (const animation of preset.animations) {
      const type = String((animation as Record<string, unknown>).type);
      assert.ok(getAnimation(type), `preset "${preset.id}" me anjaan animation "${type}"`);
    }
  }
});

test("setTransition lambai clip ke hisaab se clamp karta hai", () => {
  const { doc, ids } = chainFixture();
  // Clip 100 frame ki hai; 80 + 80 nahi sama sakte.
  let next = setTransition(doc, { itemIds: [ids[0]!], side: "in", type: "fade", durationInFrames: 80 });
  next = setTransition(next, { itemIds: [ids[0]!], side: "out", type: "fade", durationInFrames: 80 });

  const item = itemById(next, ids[0]!);
  assert.ok(
    item.transitionIn.durationInFrames + item.transitionOut.durationInFrames <= 99,
    `${item.transitionIn.durationInFrames} + ${item.transitionOut.durationInFrames}`,
  );
});

test("`none` chunte hi lambai bhi 0 ho jaati hai", () => {
  const { doc, ids } = chainFixture();
  let next = setTransition(doc, { itemIds: [ids[0]!], side: "in", type: "fade", durationInFrames: 15 });
  next = setTransition(next, { itemIds: [ids[0]!], side: "in", type: "none" });

  const item = itemById(next, ids[0]!);
  assert.equal(item.transitionIn.durationInFrames, 0, "cut par badge dikhta rehta par kuch hota nahi");
});

test("anjaan transition type par saaf error", () => {
  const { doc, ids } = chainFixture();
  throws(
    () => setTransition(doc, { itemIds: [ids[0]!], side: "in", type: "koi-bhi" }),
    /nahi mila/,
    "anjaan transition",
  );
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
