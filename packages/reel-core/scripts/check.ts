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
  KEYFRAME_BEATS_ANIMATION,
  addKeyframe,
  blendColors,
  clearKeyframes,
  copyKeyframes,
  deleteKeyframe,
  moveKeyframe,
  BUILTIN_DEVICES,
  ZOOM_PRESETS,
  applyZoomPan,
  checkZoomUpscale,
  deviceForAspect,
  frameGeometry,
  requireDevice,
  setMockup,
  zoomPanKeyframes,
  DEFAULT_DEVICE_ID,
  BUILTIN_TEMPLATES,
  DEFAULT_BRAND_TOKENS,
  applyTemplate,
  brandOverrides,
  brandTokensFor,
  findBrandPreset,
  findTemplate,
  listSceneTypes,
  overridesToTokens,
  safeParseTemplate,
  setBrandCta,
  setBrandPreset,
  setBrandToken,
  setEndScreen,
  setWatermark,
  templateFromDoc,
  tokenByColor,
  validateTemplate,
  type Template,
  addMarker,
  deleteMarker,
  duplicateTrack,
  expandSelectionToGroups,
  groupItems,
  nextMarkerFrame,
  removeTrack,
  replaceAsset,
  setMarker,
  setTrackProperty,
  ungroupItems,
  DEFAULT_LOUDNESS_LUFS,
  FADE_SHAPES,
  MIN_VOLUME_DB,
  cropCss,
  dbToGain,
  duckEnvelope,
  estimateMixPeak,
  fadeGain,
  freezeFrame,
  gainToDb,
  itemGainAt,
  setCrop,
  setDucking,
  setItemAudio,
  setMasterAudio,
  setPlaybackRate,
  suggestedMasterVolume,
  EFFECTS,
  EFFECT_PRESETS,
  addEffect,
  applyEffectPreset,
  applyEffects,
  effectParamPath,
  effectsCost,
  findEffectPreset,
  listEffects,
  maskCss,
  removeEffect,
  reorderEffects,
  requireEffect,
  setEffectParam,
  setMask,
  setKeyframeEasing,
  resolveItemValue,
  sampleKeyframes,
  scaleKeyframes,
  type Keyframe,
  addScene,
  deleteScene,
  duplicateScene,
  isSceneCustomEdited,
  itemEndFrame,
  missingRequiredSlots,
  reorderScenes,
  repairScenes,
  requireSceneType,
  setSceneDuration,
  setSceneSlot,
  validateSceneIntegrity,
  EXPORT_PRESETS,
  PREFLIGHT_RULES,
  estimateExportBytes,
  preflight,
  requireExportPreset,
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

  /*
   * Cut ke bindu par dono taraf ek **naya** keyframe banta hai (13.6). Isliye
   * left me 30 aur right me 0 dikhta hai jo pehle nahi tha.
   *
   * Bina uske daayein tukde ki shuruaat 1.3 (agla keyframe) par ja rahi thi
   * jabki cut se theek pehle value ~1.15 thi — yaani cut par ek jhatka. Ye extra
   * keyframe hi wo jhatka rokta hai.
   */
  assert.deepEqual(
    left.keyframes["transform.scale"]!.map((k) => k.frame),
    [0, 20, 30],
    "left ke paas apne hisse ke keyframes + cut par ek",
  );
  assert.deepEqual(
    right.keyframes["transform.scale"]!.map((k) => k.frame),
    [0, 30],
    "right ke keyframes item-local ho jaate hain (60 - 30), aage cut par ek",
  );
  assert.ok(
    Math.abs(
      (right.keyframes["transform.scale"]![0]!.value as number) -
        (left.keyframes["transform.scale"]![2]!.value as number),
    ) < 1e-9,
    "cut ke dono taraf value ek hi hai",
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
    scenes: [
      { id: "sc_1", name: "Intro", order: 0, itemIds: [doc.items[0]!.id], type: "custom", slots: {} },
    ],
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
  // Error ka text Phase 16 me badla (ab do raaste hain: "delete" aur "move"),
  // par shart wahi hai — bina bataye kuch nahi mitata.
  throws(() => removeTrack(doc, { trackId: videoTrackId }), /delete/, "bina permission");

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

  // 50 aur 0 wale cut ke keyframes hain — inhi se value cut par nahi kood'ti (13.6).
  assert.deepEqual(
    left.keyframes["transform.scale"]?.map((kf) => kf.frame),
    [10, 50],
    "baayein wale par pehla keyframe aur cut par ek",
  );
  // Daayein wala 90 tha; wo naye item me 90 - 50 = 40 par aana chahiye.
  assert.deepEqual(
    right.keyframes["transform.scale"]?.map((kf) => kf.frame),
    [0, 40],
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

// ------------------------------------------------- Phase 11 (export pipeline)

section("export preset (11.1)");

test("draft preset juda par uska naam saaf batata hai ki wo kam quality hai", () => {
  const draft = requireExportPreset("draft");
  // Ye Section 3A ka apwaad hai, isliye uska label hi chetavni hona chahiye —
  // warna koi use share karne wali file bana kar bhej dega.
  assert.ok(draft.crf > 18, "draft ki CRF quality bar se upar honi chahiye");
  assert.ok(/draft/i.test(draft.label));
  assert.ok(/share/i.test(draft.label) || /share/i.test(draft.hint));
});

test("baaki teeno preset Section 3A ke andar hain", () => {
  for (const id of ["standard", "high", "uhd"]) {
    const preset = requireExportPreset(id);
    assert.ok(preset.crf <= 18, `${id} ki CRF ${preset.crf} — chhat 18 hai`);
    assert.ok(preset.audioBitrateKbps >= 192, `${id} ka audio ${preset.audioBitrateKbps}k`);
  }
});

test("koi bhi preset upscale nahi karta", () => {
  // "4K" ka label lagakar upscaled 1080p dena mana hai — isliye har preset ka
  // scaleTo null hai aur uhd sirf tab matlab rakhta hai jab project 4K ho.
  for (const preset of EXPORT_PRESETS.list()) {
    assert.equal(preset.scaleTo, null, `${preset.id} resize kar raha hai`);
  }
  assert.equal(requireExportPreset("uhd").requiresMinHeight, 2160);
});

section("preflight — error aur warning ka farak (11.4)");

/** Ek chalne layak doc + uske assets. */
function exportFixture(): {
  doc: Doc;
  assets: Record<string, { width: number | null; height: number | null; durationMs: number | null }>;
} {
  const base = createEmptyProject({ name: "Export fixture" });
  const item = createItem("image", {
    fps: base.project.fps,
    trackId: base.tracks[0]!.id,
    name: "Poster",
    assetId: "as_ok",
    startFrame: 0,
    durationInFrames: 90,
  });
  const audio = createItem("audio", {
    fps: base.project.fps,
    trackId: base.tracks[1]!.id,
    name: "VO",
    assetId: "as_vo",
    startFrame: 0,
    durationInFrames: 90,
  });

  let doc = addItem(base, { item });
  doc = addItem(doc, { item: audio });
  doc = recomputeDuration(doc, undefined as never);

  return {
    doc,
    assets: {
      as_ok: { width: 2160, height: 3840, durationMs: null },
      as_vo: { width: null, height: null, durationMs: 10_000 },
    },
  };
}

test("sahi doc par koi error nahi", () => {
  const { doc, assets } = exportFixture();
  const result = preflight({ doc, presetId: "standard", assets });
  assert.equal(result.canExport, true, result.errors.map((i) => i.message).join(" | "));
});

test("khaali timeline error hai — export shuru hi nahi hona chahiye", () => {
  const doc = createEmptyProject({ name: "Khaali" });
  const result = preflight({ doc, presetId: "standard", assets: {} });
  assert.equal(result.canExport, false);
  assert.ok(result.errors.some((issue) => issue.ruleId === "empty-timeline"));
});

test("gayab asset error hai, warning nahi", () => {
  const { doc } = exportFixture();
  // Asset list se hata do — clip ab gulaabi card banegi.
  const result = preflight({ doc, presetId: "standard", assets: {} });
  assert.equal(result.canExport, false);
  assert.ok(result.errors.some((issue) => issue.ruleId === "missing-asset"));
});

test("blurry image warning hai — rok nahi", () => {
  const { doc, assets } = exportFixture();
  // 480p image ko 1080x1920 frame me daalo.
  const result = preflight({
    doc,
    presetId: "standard",
    assets: { ...assets, as_ok: { width: 640, height: 480, durationMs: null } },
  });
  assert.equal(result.canExport, true, "blurry image export rokne layak nahi hai");
  assert.ok(result.warnings.some((issue) => issue.ruleId === "upscale"));
});

test("upscale ki warning me animation ka scale bhi ginta hai (10.11 + 11.4)", () => {
  const { doc, assets } = exportFixture();
  // Source bilkul theek naap ka hai — bina animation ke koi warning nahi.
  const okAssets = { ...assets, as_ok: { width: 1080, height: 1920, durationMs: null } };
  assert.equal(
    preflight({ doc, presetId: "standard", assets: okAssets }).warnings.some(
      (issue) => issue.ruleId === "upscale",
    ),
    false,
  );

  // Ab Ken Burns 1 -> 1.5 lagao. Blur clip ke *aakhir* me aayega, isliye
  // chalte hue wala scale dekhne se ye galti chhoot jaati.
  const withZoom = addAnimation(doc, { itemIds: [doc.items[0]!.id], typeId: "kenburns" });
  const zoomed = setAnimationParam(withZoom, {
    itemId: doc.items[0]!.id,
    index: 0,
    path: "to",
    value: 1.5,
  });

  assert.ok(
    preflight({ doc: zoomed, presetId: "standard", assets: okAssets }).warnings.some(
      (issue) => issue.ruleId === "upscale",
    ),
    "Ken Burns ka zoom upscale warning me aana chahiye tha",
  );
});

test("chup reel warning hai", () => {
  const { doc, assets } = exportFixture();
  const muted = setItemsProperty(doc, {
    itemIds: doc.items.map((item) => item.id),
    path: "audio.muted",
    value: true,
  });
  assert.ok(
    preflight({ doc: muted, presetId: "standard", assets }).warnings.some(
      (i) => i.ruleId === "silent",
    ),
  );
});

test("volume 1 se upar par clipping ki warning", () => {
  const { doc, assets } = exportFixture();
  const loud = setItemsProperty(doc, {
    itemIds: [doc.items[1]!.id],
    path: "audio.volume",
    value: 2,
  });
  assert.ok(
    preflight({ doc: loud, presetId: "standard", assets }).warnings.some(
      (i) => i.ruleId === "clipping-risk",
    ),
  );
});

test("clip apne source se lambi ho to warning (kaala frame aayega)", () => {
  const { doc, assets } = exportFixture();
  // VO ka source 10s hai; clip ko bahut lamba kar do.
  const longer = trimItemEnd(doc, { itemId: doc.items[1]!.id, deltaFrames: 400 });
  assert.ok(
    preflight({ doc: longer, presetId: "standard", assets }).warnings.some(
      (i) => i.ruleId === "source-shorter",
    ),
  );
});

test("1080p project par 4K preset warning deta hai", () => {
  const { doc, assets } = exportFixture();
  const result = preflight({ doc, presetId: "uhd", assets });
  assert.equal(result.canExport, true, "ye rokne layak nahi hai, sirf batane layak");
  assert.ok(result.warnings.some((issue) => issue.ruleId === "preset-too-big"));
});

test("asset chahiye par lagi nahi — error", () => {
  const base = createEmptyProject({ name: "Bina asset" });
  const item = createItem("image", {
    fps: base.project.fps,
    trackId: base.tracks[0]!.id,
    name: "Khaali image",
    startFrame: 0,
    durationInFrames: 30,
  });
  const doc = addItem(base, { item });
  const result = preflight({ doc, presetId: "standard", assets: {} });
  assert.equal(result.canExport, false);
  assert.ok(result.errors.some((issue) => issue.ruleId === "needs-asset"));
});

test("har rule ka id apna hai (do rule ek naam par nahi)", () => {
  const seen = new Set<string>();
  for (const rule of PREFLIGHT_RULES) {
    assert.equal(seen.has(rule.id), false, `"${rule.id}" do baar hai`);
    seen.add(rule.id);
  }
});

section("file size ka andaaza (11.5)");

test("andaaza lambai ke saath badhta hai", () => {
  const { doc } = exportFixture();
  const short = estimateExportBytes(doc, "standard");
  const longer = estimateExportBytes(
    { ...doc, project: { ...doc.project, durationInFrames: doc.project.durationInFrames * 2 } },
    "standard",
  );
  assert.ok(Math.abs(longer / short - 2) < 0.05, `${short} -> ${longer}`);
});

test("behtar preset ka andaaza bada hota hai", () => {
  const { doc } = exportFixture();
  assert.ok(estimateExportBytes(doc, "high") > estimateExportBytes(doc, "standard"));
  assert.ok(estimateExportBytes(doc, "standard") > estimateExportBytes(doc, "draft"));
});

test("chhote frame ka andaaza chhota hota hai", () => {
  const { doc } = exportFixture();
  const small = { ...doc, project: { ...doc.project, width: 540, height: 960 } };
  assert.ok(estimateExportBytes(small, "standard") < estimateExportBytes(doc, "standard"));
});

test("30 second ki reel ka andaaza dhang ki range me hai", () => {
  // Ye ek "sanity" jaanch hai: andaaza asli renders se aaya hai, isliye
  // 1080x1920@30 ki 30s reel 5-40 MB ke beech honi chahiye. Isse bahar jaana
  // matlab formula me kahin koi factor ulta lag gaya.
  const base = createEmptyProject({ name: "30s" });
  const doc = { ...base, project: { ...base.project, durationInFrames: 30 * 30 } };
  const bytes = estimateExportBytes(doc, "standard");
  assert.ok(bytes > 5_000_000 && bytes < 40_000_000, `${bytes} bytes`);
});

// ------------------------------------------------------- Phase 12 (scenes)

section("scene types registry (12.1 / 12.2)");

test("har scene type ke required slots ke bina build khaali lauta ta hai", () => {
  // Ye jaanch isliye hai ki `addScene` khaali scene par saaf error de sake —
  // aur wo tabhi ho sakta hai jab build() imaandaari se khaali laut aaye.
  for (const entry of listSceneTypes()) {
    if (entry.slots.every((slot) => !slot.required)) continue;
    const items = entry.build({ slots: {}, fps: 30, sceneId: "sc_test" });
    assert.equal(items.length, 0, `${entry.id} ne bina slot ke bhi item bana diya`);
  }
});

test("har build() apne saare items par sceneId lagata hai", () => {
  // Ek bhi item bina sceneId ke reh jaaye to wo card se gayab ho jaata hai aur
  // timeline me anaath padha rehta — aur wo galti dikhti bahut baad me hai.
  for (const entry of listSceneTypes()) {
    const slots: Record<string, unknown> = {};
    for (const slot of entry.slots) {
      slots[slot.id] = slot.kind === "text" ? "Test text" : "as_test";
    }
    const items = entry.build({ slots, fps: 30, sceneId: "sc_x" });
    for (const item of items) {
      assert.equal(item.sceneId, "sc_x", `${entry.id} ka "${item.name}" bina sceneId ke hai`);
    }
  }
});

test("music scene ka volume apne aap kam hota hai", () => {
  const items = requireSceneType("music").build({
    slots: { audio: "as_music" },
    fps: 30,
    sceneId: "sc_m",
  });
  assert.ok(items[0]);
  assert.ok(items[0].audio.volume < 0.5, "poore volume par music voiceover ko dabaa deta hai");
});

test("screen recording default me phone frame ke saath aati hai (18.5)", () => {
  /*
   * Phase 18 me ye badla: pehle default `contain` tha (bina frame ke recording
   * poori dikhni chahiye). Ab default me phone frame lagta hai, aur frame ke
   * **andar** `cover` sahi hai — screen poori bharni chahiye, warna bezel ke
   * andar kaali pattiyan aati hain jo bilkul nakli lagti hain.
   */
  const items = requireSceneType("screen_recording").build({
    slots: { video: "as_rec" },
    fps: 30,
    sceneId: "sc_r",
  });
  const video = items.find((item) => item.type === "video");
  assert.ok(video?.mockup, "default me frame lagna chahiye");
  assert.equal(video?.mockup?.deviceId, DEFAULT_DEVICE_ID);
  assert.equal(video?.fit.mode, "cover", "frame ke andar screen poori bharni chahiye");
});

test('"raw" likhne par frame nahi lagta, aur fit contain par wapas aa jaata hai', () => {
  const items = requireSceneType("screen_recording").build({
    slots: { video: "as_rec", frame: "raw" },
    fps: 30,
    sceneId: "sc_r",
  });
  const video = items.find((item) => item.type === "video");
  assert.equal(video?.mockup, null);
  assert.equal(video?.fit.mode, "contain", "bina frame ke recording poori dikhni chahiye");
  assert.equal(video?.fit.background.kind, "blurred-asset");
});

test("required slot ki ginti sahi milti hai", () => {
  assert.deepEqual(
    missingRequiredSlots("image_audio", {}).map((slot) => slot.id),
    ["image"],
    "sirf image required hai; audio aur caption optional",
  );
  assert.deepEqual(missingRequiredSlots("image_audio", { image: "as_1" }), []);
  // Khaali string bhi "nahi bhara" hai — warna khaali text scene ban jaata.
  assert.equal(missingRequiredSlots("text", { text: "   " }).length, 1);
});

section("addScene (12.3)");

test("scene jodne par items bante hain aur track apne aap milta hai", () => {
  const base = createEmptyProject({ name: "Scenes" });
  const doc = addScene(base, {
    typeId: "image_audio",
    slots: { image: "as_img", audio: "as_vo", caption: "Namaste" },
  });

  assert.equal(doc.scenes.length, 1);
  // image + audio + caption = teen items.
  assert.equal(doc.items.length, 3);
  for (const item of doc.items) {
    assert.ok(item.trackId, `${item.name} ko koi track nahi mila`);
    assert.equal(item.sceneId, doc.scenes[0]!.id);
  }
});

test("track na ho to naya ban jaata hai (beginner ko track ka pata hi nahi hota)", () => {
  const base = createEmptyProject({ name: "Sirf do track" });
  // Khaali project me video + audio track hote hain; text ka nahi.
  assert.equal(base.tracks.some((track) => track.type === "text"), false);

  const doc = addScene(base, { typeId: "text", slots: { text: "Hook line" } });
  assert.ok(doc.tracks.length > base.tracks.length, "text ke liye naya track banna chahiye tha");
  assert.equal(doc.items.length, 1);
});

test("zaroori slot bina bhare scene jodne par saaf error", () => {
  const base = createEmptyProject({ name: "Khaali scene" });
  throws(() => addScene(base, { typeId: "image", slots: {} }), /koi item nahi bana/, "khaali scene");
});

test("naye scene aage jud'te hain, ek doosre ke upar nahi", () => {
  let doc = createEmptyProject({ name: "Teen scene" });
  doc = addScene(doc, { typeId: "text", slots: { text: "Ek" } });
  doc = addScene(doc, { typeId: "text", slots: { text: "Do" } });
  doc = addScene(doc, { typeId: "text", slots: { text: "Teen" } });

  const spans = sceneSpans(doc);
  assert.equal(spans.length, 3);
  // Ek ke baad ek — koi overlap nahi, koi gaddha nahi.
  assert.equal(spans[0]![0], 0);
  assert.equal(spans[1]![0], spans[0]![1]);
  assert.equal(spans[2]![0], spans[1]![1]);
});

/** Har scene ka [start, end], order me. */
function sceneSpans(doc: Doc): [number, number][] {
  return [...doc.scenes]
    .sort((a, b) => a.order - b.order)
    .map((scene) => {
      const items = doc.items.filter((item) => item.sceneId === scene.id);
      return [
        Math.min(...items.map((item) => item.startFrame)),
        Math.max(...items.map(itemEndFrame)),
      ] as [number, number];
    });
}

function sceneNames(doc: Doc): string[] {
  return [...doc.scenes].sort((a, b) => a.order - b.order).map((scene) => scene.name);
}

section("scene reorder ka ripple (12.5 — spec ka apna example)");

/** `[Rahul][Papa][Problem][App][CTA]` — spec me likha hua doc. */
function fiveScenes(): Doc {
  let doc = createEmptyProject({ name: "Paanch scene" });
  for (const name of ["Rahul", "Papa", "Problem", "App", "CTA"]) {
    doc = addScene(doc, { typeId: "text", slots: { text: name }, name });
  }
  return doc;
}

test("shuruaat me paanchon scene bina gaddhe ke lage hain", () => {
  const doc = fiveScenes();
  assert.deepEqual(sceneNames(doc), ["Rahul", "Papa", "Problem", "App", "CTA"]);

  const spans = sceneSpans(doc);
  for (let i = 1; i < spans.length; i += 1) {
    assert.equal(spans[i]![0], spans[i - 1]![1], `scene ${i} aur ${i - 1} ke beech gaddha`);
  }
});

test("Papa aur Problem swap karne par frames dobara ginn jaate hain", () => {
  const doc = fiveScenes();
  const before = sceneSpans(doc);
  const papa = [...doc.scenes].sort((a, b) => a.order - b.order)[1]!;

  // Papa (index 1) ko Problem (index 2) ki jagah bhejo.
  const next = reorderScenes(doc, { sceneId: papa.id, toIndex: 2 });

  assert.deepEqual(sceneNames(next), ["Rahul", "Problem", "Papa", "App", "CTA"]);

  const after = sceneSpans(next);
  // Koi gaddha nahi, koi overlap nahi — yahi is op ka poora kaam hai.
  assert.equal(after[0]![0], 0);
  for (let i = 1; i < after.length; i += 1) {
    assert.equal(after[i]![0], after[i - 1]![1], `swap ke baad scene ${i} par gaddha/overlap`);
  }
  // Kul lambai badalni nahi chahiye — sirf kram badla hai.
  assert.equal(after[after.length - 1]![1], before[before.length - 1]![1]);
});

test("pehle scene ko aakhir me bhejna bhi saaf chalta hai", () => {
  const doc = fiveScenes();
  const first = [...doc.scenes].sort((a, b) => a.order - b.order)[0]!;
  const next = reorderScenes(doc, { sceneId: first.id, toIndex: 4 });

  assert.deepEqual(sceneNames(next), ["Papa", "Problem", "App", "CTA", "Rahul"]);
  const spans = sceneSpans(next);
  assert.equal(spans[0]![0], 0, "naya pehla scene 0 se shuru hona chahiye");
});

test("reorder ke baad project ki lambai wahi rehti hai", () => {
  const doc = fiveScenes();
  const scene = [...doc.scenes].sort((a, b) => a.order - b.order)[3]!;
  const next = reorderScenes(doc, { sceneId: scene.id, toIndex: 0 });
  assert.equal(next.project.durationInFrames, doc.project.durationInFrames);
});

section("baaki scene ops (12.4)");

test("duplicate scene turant baad me lagta hai", () => {
  const doc = fiveScenes();
  const papa = [...doc.scenes].sort((a, b) => a.order - b.order)[1]!;
  const next = duplicateScene(doc, { sceneId: papa.id });

  assert.deepEqual(sceneNames(next), ["Rahul", "Papa", "Papa (copy)", "Problem", "App", "CTA"]);
  // Copy ke items ke naye id hone chahiye.
  const copy = [...next.scenes].sort((a, b) => a.order - b.order)[2]!;
  for (const id of copy.itemIds) assert.equal(papa.itemIds.includes(id), false);
});

test("scene delete uske items ke saath hota hai aur gaddha nahi chhodta", () => {
  const doc = fiveScenes();
  const problem = [...doc.scenes].sort((a, b) => a.order - b.order)[2]!;
  const next = deleteScene(doc, { sceneId: problem.id });

  assert.deepEqual(sceneNames(next), ["Rahul", "Papa", "App", "CTA"]);
  assert.equal(next.items.some((item) => item.sceneId === problem.id), false);

  const spans = sceneSpans(next);
  for (let i = 1; i < spans.length; i += 1) {
    assert.equal(spans[i]![0], spans[i - 1]![1], "delete ke baad gaddha reh gaya");
  }
});

test("setSceneDuration default me sirf sabse lambi item badalta hai", () => {
  const base = createEmptyProject({ name: "Duration" });
  const doc = addScene(base, {
    typeId: "image_audio",
    slots: { image: "as_img", audio: "as_vo" },
  });
  const scene = doc.scenes[0]!;
  const audioBefore = doc.items.find((item) => item.type === "audio")!.durationInFrames;

  const next = setSceneDuration(doc, {
    sceneId: scene.id,
    durationInFrames: audioBefore + 60,
  });

  // Ek item lambi hui, doosri waisi ki waisi — recording ko kheenchna use bigad
  // deta hai, isliye default yahi hai.
  const changed = next.items.filter((item) => item.durationInFrames !== audioBefore);
  assert.equal(changed.length, 1, "sirf ek item badalni chahiye thi");
});

test("proportional par saare items anupaat me badalte hain", () => {
  const base = createEmptyProject({ name: "Proportional" });
  const doc = addScene(base, {
    typeId: "image_audio",
    slots: { image: "as_img", audio: "as_vo", caption: "Hi" },
  });
  const scene = doc.scenes[0]!;
  const before = doc.items.map((item) => item.durationInFrames);

  const next = setSceneDuration(doc, {
    sceneId: scene.id,
    durationInFrames: before[0]! * 2,
    proportional: true,
  });

  const after = next.items.map((item) => item.durationInFrames);
  for (let i = 0; i < before.length; i += 1) {
    assert.equal(after[i], before[i]! * 2, `item ${i} anupaat me nahi badla`);
  }
});

test("slot badalne se sirf uska item badalta hai, scene dobara nahi banta", () => {
  const base = createEmptyProject({ name: "Slot" });
  const doc = addScene(base, {
    typeId: "image_audio",
    slots: { image: "as_old", audio: "as_vo", caption: "Purana" },
  });
  const scene = doc.scenes[0]!;
  const idsBefore = doc.items.map((item) => item.id).sort();

  let next = setSceneSlot(doc, { sceneId: scene.id, slotId: "image", value: "as_new" });
  next = setSceneSlot(next, { sceneId: scene.id, slotId: "caption", value: "Naya" });

  // ⚠️ Sabse zaroori: item ke ids wahi rehne chahiye. Rebuild karne par naye id
  // bante aur user ki har manual edit (jagah, scale, keyframes) mit jaati.
  assert.deepEqual(next.items.map((item) => item.id).sort(), idsBefore, "scene dobara ban gaya");

  assert.equal(next.items.find((item) => item.type === "image")?.assetId, "as_new");
  assert.equal(next.items.find((item) => item.text !== null)?.text?.content, "Naya");
  // Scene ke slots me bhi nayi value dikhni chahiye (card wahi padhta hai).
  assert.equal(next.scenes[0]?.slots.image, "as_new");
});

test("anjaan slot par saaf error", () => {
  const base = createEmptyProject({ name: "Anjaan slot" });
  const doc = addScene(base, { typeId: "text", slots: { text: "Hi" } });
  throws(
    () => setSceneSlot(doc, { sceneId: doc.scenes[0]!.id, slotId: "kuch-bhi", value: "x" }),
    /slot nahi hai/,
    "anjaan slot",
  );
});

section("scene ki sehat (12.8 / 12.12)");

test("saaf doc me koi shikayat nahi", () => {
  assert.deepEqual(validateSceneIntegrity(fiveScenes()), []);
  const doc = fiveScenes();
  for (const scene of doc.scenes) {
    assert.equal(isSceneCustomEdited(doc, scene.id), false);
  }
});

test("timeline se clip delete karne par scene ki list galat ho jaati hai", () => {
  const doc = fiveScenes();
  const scene = doc.scenes[0]!;
  const broken = deleteItems(doc, { itemIds: [scene.itemIds[0]!] });

  // `deleteItems` scene ki list se id nikaal deta hai, par scene khud khaali
  // reh jaata hai — repair usko hata deta hai.
  const repaired = repairScenes(broken, undefined as never);
  assert.equal(repaired.scenes.length, 4, "khaali scene hat jaana chahiye");
  assert.deepEqual(validateSceneIntegrity(repaired), []);
});

test("anaath item ka sceneId saaf hota hai, item delete nahi hota", () => {
  const doc = fiveScenes();
  const orphaned: Doc = {
    ...doc,
    // Scene hata do par item ka sceneId chhod do — bilkul wahi halat jo ek
    // aadhe-adhoore AI patch se banti hai.
    scenes: doc.scenes.slice(1),
  };
  assert.ok(validateSceneIntegrity(orphaned).some((issue) => issue.kind === "orphan-item"));

  const repaired = repairScenes(orphaned, undefined as never);
  // ⚠️ Item bacha rehna chahiye — kisi ki clip mita dena "repair" nahi hota.
  assert.equal(repaired.items.length, doc.items.length);
  assert.deepEqual(validateSceneIntegrity(repaired), []);
});

test("clip sarkane se scene 'custom edited' ho jaata hai", () => {
  const doc = fiveScenes();
  const scene = [...doc.scenes].sort((a, b) => a.order - b.order)[0]!;

  assert.equal(isSceneCustomEdited(doc, scene.id), false);

  /*
   * Pehle scene ki clip ko sabse aage sarka do.
   *
   * ⚠️ Ye bhi "custom edited" hai, aur ye baat maine test likhte waqt seekhi.
   * Pehle mera rule sirf overlap aur gaddha dekhta tha, isliye ye halat chhoot
   * rahi thi: card #1 ab timeline ke aakhir me baitha hai. Video me wo scene
   * sabse baad me aayega par card list me sabse upar dikhega — do alag sach.
   */
  const moved = moveItems(doc, { itemIds: [scene.itemIds[0]!], deltaFrames: 500 });
  assert.equal(
    isSceneCustomEdited(moved, scene.id),
    true,
    "card ka kram aur timeline ka kram alag ho gaye — badge dikhna chahiye",
  );

  /*
   * Doosre scene ki clip beech me ghusa do — ab card ki simple duniya sach nahi
   * rahi.
   *
   * ⚠️ Yahan `push` policy zaroori hai, aur ye baat maine test likhte waqt hi
   * seekhi: default `overwrite` par ghusne wali clip neeche wali ko **kha jaati
   * hai**, isliye scene 0 khaali reh jaata hai aur "custom edited" ka sawaal hi
   * nahi uthta. Wo apni jagah sahi vyavhaar hai (neeche wala test) — par is
   * baat ki jaanch nahi hai.
   */
  const other = [...doc.scenes].sort((a, b) => a.order - b.order)[3]!;
  const intruded = moveItems(doc, {
    itemIds: [other.itemIds[0]!],
    deltaFrames: -1000,
    policy: "push",
  });
  assert.equal(isSceneCustomEdited(intruded, scene.id), true);
});

test("overwrite policy doosre scene ki clip kha sakti hai — aur repair use saaf karta hai", () => {
  /*
   * Ye ek asli, jaayaz halat hai: user timeline me ek clip uthakar doosre scene
   * ke upar rakh deta hai. Overwrite policy neeche wali clip mita deti hai, aur
   * uska scene khaali reh jaata hai — card me ek aisa scene jisme kuch hai hi
   * nahi.
   *
   * Isko rokna galat hoga (user ne jaan kar kiya), par chup rehna bhi galat hai.
   * `repairScenes` khaali scene hata deta hai, aur baaki scenes ka kram seedha
   * kar deta hai.
   */
  const doc = fiveScenes();
  const first = [...doc.scenes].sort((a, b) => a.order - b.order)[0]!;
  const fourth = [...doc.scenes].sort((a, b) => a.order - b.order)[3]!;

  const overwritten = moveItems(doc, {
    itemIds: [fourth.itemIds[0]!],
    deltaFrames: -1000,
    policy: "overwrite",
  });
  assert.equal(
    overwritten.items.some((item) => item.sceneId === first.id),
    false,
    "pehle scene ki clip kat jaani chahiye thi",
  );

  const repaired = repairScenes(overwritten, undefined as never);
  assert.equal(repaired.scenes.length, 4, "khaali scene hat jaana chahiye");
  assert.deepEqual(validateSceneIntegrity(repaired), []);
});

test("anjaan scene type par shikayat aati hai", () => {
  const doc = fiveScenes();
  const broken: Doc = {
    ...doc,
    scenes: doc.scenes.map((scene, index) =>
      index === 0 ? { ...scene, type: "koi-purana-type" } : scene,
    ),
  };
  assert.ok(validateSceneIntegrity(broken).some((issue) => issue.kind === "unknown-type"));
});


// --------------------------------------------------- Phase 13 (keyframes)

section("interpolation ke teeno kism (13.1)");

/** Ek keyframe banane ka chhota helper. */
function kf(frame: number, value: unknown, easing = "linear"): Keyframe {
  return { frame, value, easing, bezier: null };
}

test("number beech me theek aadha milta hai", () => {
  const list = [kf(0, 0), kf(100, 10)];
  assert.equal(sampleKeyframes({ p: list }, "p", 50), 5);
  assert.equal(sampleKeyframes({ p: list }, "p", 25), 2.5);
});

test("vector ka har hissa alag se milta hai", () => {
  const list = [kf(0, [0, 100]), kf(10, [10, 0])];
  assert.deepEqual(sampleKeyframes({ p: list }, "p", 5), [5, 50]);
});

test("rang sRGB me milta hai (browser ke CSS transition jaisa)", () => {
  const list = [kf(0, "#000000"), kf(10, "#ffffff")];
  assert.equal(sampleKeyframes({ p: list }, "p", 5), "#808080");

  /*
   * Chhota roop (`#f00`) bhi chalta hai — par sirf **beech** me. Kinare par
   * value hold hoti hai aur waisi ki waisi lauti hai (`#00f`), normalize hokar
   * nahi. Ye sahi hai: hold ka matlab hi "wahi value" hota hai, aur use badal
   * kar dena ek chhota jhooth hota.
   */
  assert.equal(sampleKeyframes({ p: [kf(0, "#f00"), kf(10, "#00f")] }, "p", 5), "#800080");
  assert.equal(sampleKeyframes({ p: [kf(0, "#f00"), kf(10, "#00f")] }, "p", 10), "#00f");
});

test("alpha wala rang bhi milta hai aur poora hone par alpha likha nahi jaata", () => {
  assert.equal(blendColors("#ff000000", "#ff0000ff", 0.5), "#ff000080");
  assert.equal(blendColors("#000000", "#ffffff", 1), "#ffffff", "alpha 255 par sirf 6 akshar");
});

test("brand token interpolate nahi hota — jhatke se badalta hai", () => {
  // Aadha token jaisi koi cheez hoti hi nahi; kuch bana kar dena jhooth hoga.
  const list = [kf(0, "brand.primary"), kf(10, "brand.accent")];
  assert.equal(sampleKeyframes({ p: list }, "p", 4), "brand.primary");
  assert.equal(sampleKeyframes({ p: list }, "p", 10), "brand.accent");
});

test("boolean bhi jhatke se badalta hai", () => {
  const list = [kf(0, false), kf(10, true)];
  assert.equal(sampleKeyframes({ p: list }, "p", 4), false);
  assert.equal(sampleKeyframes({ p: list }, "p", 10), true);
});

test("range ke bahar value rukti hai, aage nahi badhti", () => {
  // Extrapolate karne se Ken Burns clip ke bahar bhi zoom karta rehta aur
  // transform bekaar bada ho jaata.
  const list = [kf(10, 1), kf(20, 2)];
  assert.equal(sampleKeyframes({ p: list }, "p", 0), 1);
  assert.equal(sampleKeyframes({ p: list }, "p", 999), 2);
});

test("bina kram ke keyframes bhi sahi chalte hain", () => {
  // AI patch, template ya haath ki editing kabhi bhi bina order ke keyframes
  // de sakti hai.
  const list = [kf(100, 10), kf(0, 0), kf(50, 5)];
  assert.equal(sampleKeyframes({ p: list }, "p", 25), 2.5);
  assert.equal(sampleKeyframes({ p: list }, "p", 75), 7.5);
});

test("500 keyframes par bhi sahi value milti hai (binary search)", () => {
  const list = Array.from({ length: 500 }, (_, index) => kf(index * 2, index));
  assert.equal(sampleKeyframes({ p: list }, "p", 0), 0);
  assert.equal(sampleKeyframes({ p: list }, "p", 500), 250);
  assert.equal(sampleKeyframes({ p: list }, "p", 501), 250.5, "do keyframes ke beech");
  assert.equal(sampleKeyframes({ p: list }, "p", 998), 499);
});

test("custom bezier easing ke upar chalta hai (13.2)", () => {
  const linear = [kf(0, 0, "linear"), kf(10, 10)];
  const withCurve: Keyframe[] = [
    { frame: 0, value: 0, easing: "linear", bezier: [0.42, 0, 0.58, 1] },
    kf(10, 10),
  ];
  // ease-in-out beech me linear jaisa hi hota hai, par chauthai par nahi.
  assert.notEqual(
    sampleKeyframes({ p: withCurve }, "p", 2.5),
    sampleKeyframes({ p: linear }, "p", 2.5),
  );
});

section("keyframe ops (13.3)");

test("addKeyframe usi frame par naya nahi banata, purana badalta hai", () => {
  // Do keyframes ek hi frame par hone se interpolation ka matlab nahi bachta
  // aur doosra UI me chhupa reh jaata hai.
  const { doc, ids } = chainFixture();
  let next = addKeyframe(doc, { itemId: ids[0]!, path: "transform.scale", frame: 10, value: 1 });
  next = addKeyframe(next, { itemId: ids[0]!, path: "transform.scale", frame: 10, value: 2 });

  const list = itemById(next, ids[0]!).keyframes["transform.scale"];
  assert.equal(list?.length, 1);
  assert.equal(list?.[0]?.value, 2);
});

test("keyframes hamesha kram me rehte hain", () => {
  const { doc, ids } = chainFixture();
  let next = addKeyframe(doc, { itemId: ids[0]!, path: "transform.scale", frame: 50, value: 2 });
  next = addKeyframe(next, { itemId: ids[0]!, path: "transform.scale", frame: 10, value: 1 });
  next = addKeyframe(next, { itemId: ids[0]!, path: "transform.scale", frame: 30, value: 1.5 });

  assert.deepEqual(
    itemById(next, ids[0]!).keyframes["transform.scale"]?.map((entry) => entry.frame),
    [10, 30, 50],
  );
});

test("keyframe sarkane par doosre ke upar chhodne se wo hat jaata hai", () => {
  // Drag me ungli exact frame par nahi rukti; do keyframes ek frame par baith
  // jaayein to ek hamesha ke liye chhup jaata hai. Hatana dikhta hai.
  const { doc, ids } = chainFixture();
  let next = addKeyframe(doc, { itemId: ids[0]!, path: "transform.scale", frame: 10, value: 1 });
  next = addKeyframe(next, { itemId: ids[0]!, path: "transform.scale", frame: 20, value: 2 });
  next = moveKeyframe(next, { itemId: ids[0]!, path: "transform.scale", fromFrame: 10, toFrame: 20 });

  const list = itemById(next, ids[0]!).keyframes["transform.scale"];
  assert.equal(list?.length, 1);
  assert.equal(list?.[0]?.value, 1, "sarkaya hua keyframe bachna chahiye");
});

test("aakhri keyframe hatate hi path bhi hat jaata hai", () => {
  const { doc, ids } = chainFixture();
  let next = addKeyframe(doc, { itemId: ids[0]!, path: "transform.scale", frame: 10, value: 1 });
  next = deleteKeyframe(next, { itemId: ids[0]!, path: "transform.scale", frame: 10 });
  assert.equal("transform.scale" in itemById(next, ids[0]!).keyframes, false);
});

test("clearKeyframes abhi ki value item par likh deta hai", () => {
  /*
   * Ye is op ka poora matlab hai. Iske bina property ek jhatke me apni purani
   * static value par kood jaati hai — user ne scale 1 se 1.4 animate kiya, phir
   * keyframes hataye, aur clip achanak 1 par wapas chali gayi.
   */
  const { doc, ids } = chainFixture();
  let next = addKeyframe(doc, { itemId: ids[0]!, path: "transform.scale", frame: 0, value: 1.4 });
  next = addKeyframe(next, { itemId: ids[0]!, path: "transform.scale", frame: 50, value: 2 });

  assert.equal(itemById(next, ids[0]!).transform.scale, 1, "abhi tak static value 1 hai");
  next = clearKeyframes(next, { itemId: ids[0]!, path: "transform.scale" });

  assert.equal(itemById(next, ids[0]!).transform.scale, 1.4, "shuruaat wali value bachni chahiye");
  assert.equal("transform.scale" in itemById(next, ids[0]!).keyframes, false);
});

test("copyKeyframes ek property se doosri par (13.10)", () => {
  const { doc, ids } = chainFixture();
  let next = addKeyframe(doc, { itemId: ids[0]!, path: "transform.opacity", frame: 0, value: 0 });
  next = addKeyframe(next, { itemId: ids[0]!, path: "transform.opacity", frame: 30, value: 1 });

  next = copyKeyframes(next, {
    fromItemId: ids[0]!,
    fromPath: "transform.opacity",
    toItemId: ids[1]!,
    toPath: "transform.opacity",
  });

  assert.deepEqual(
    itemById(next, ids[1]!).keyframes["transform.opacity"]?.map((entry) => entry.frame),
    [0, 30],
  );
  // Copy honi chahiye, wahi array nahi — warna ek ko badalne se doosri badalti.
  next = moveKeyframe(next, {
    itemId: ids[1]!,
    path: "transform.opacity",
    fromFrame: 30,
    toFrame: 60,
  });
  assert.deepEqual(
    itemById(next, ids[0]!).keyframes["transform.opacity"]?.map((entry) => entry.frame),
    [0, 30],
    "source ke keyframes chhune nahi chahiye the",
  );
});

test("khaali path se copy karne par saaf error", () => {
  const { doc, ids } = chainFixture();
  throws(
    () =>
      copyKeyframes(doc, {
        fromItemId: ids[0]!,
        fromPath: "transform.scale",
        toItemId: ids[1]!,
        toPath: "transform.scale",
      }),
    /koi keyframe nahi hai/,
    "khaali copy",
  );
});

section("split / trim ke saath keyframes (13.6 — 8.4 ka pakka roop)");

test("split ke baad har keyframe sahi tukde par aur sahi frame par hai", () => {
  const { doc, ids } = chainFixture();
  // Clip 100-200 par hai. Item-local 10, 40, 80 par keyframes.
  let next = addKeyframe(doc, { itemId: ids[1]!, path: "transform.scale", frame: 10, value: 1 });
  next = addKeyframe(next, { itemId: ids[1]!, path: "transform.scale", frame: 40, value: 1.5 });
  next = addKeyframe(next, { itemId: ids[1]!, path: "transform.scale", frame: 80, value: 2 });

  // Frame 150 par todo — item-local 50.
  const split = splitItemAtFrame(next, { itemId: ids[1]!, frame: 150 });
  const left = itemById(split, ids[1]!);
  const right = split.items.find((item) => item.startFrame === 150 && item.id !== ids[1])!;

  assert.deepEqual(
    left.keyframes["transform.scale"]?.map((entry) => entry.frame),
    [10, 40, 50],
    "baayein wale par pehle do, aur cut par ek naya",
  );
  // 80 wala keyframe naye item ke apne start se 30 par aana chahiye,
  // aur uske aage cut wala 0 par (neeche wala test isi ki value naapta hai).
  assert.deepEqual(
    right.keyframes["transform.scale"]?.map((entry) => entry.frame),
    [0, 30],
    "keyframe naye item ke start se ginna chahiye",
  );
});

test("split ke baad poori curve wahi rehti hai, sirf ek point nahi", () => {
  /*
   * Ek point milna itna mushkil nahi — bech ka keyframe apne aap wahan sahi
   * baith jaata hai. Asli sawaal ye hai ki **beech ke saare frames** bhi wahi
   * rahein. Ek eased curve ke do aadhe dobara ease karne par shakl badal jaati
   * hai, aur wo galti sirf poori curve naapne par pakdi jaati hai.
   */
  const { doc, ids } = chainFixture();
  let next = addKeyframe(doc, { itemId: ids[1]!, path: "transform.scale", frame: 0, value: 1 });
  next = addKeyframe(next, { itemId: ids[1]!, path: "transform.scale", frame: 100, value: 2 });
  next = setKeyframeEasing(next, {
    itemId: ids[1]!,
    path: "transform.scale",
    frame: 0,
    easing: "ease-in-out",
  });

  const original = itemById(next, ids[1]!);
  const before: number[] = [];
  for (let frame = 0; frame <= 100; frame += 1) {
    before.push(resolveItemValue<number>(original, "transform.scale", frame));
  }

  // Local 50 par todo (doc frame 150 — clip 100 se shuru hoti hai).
  const split = splitItemAtFrame(next, { itemId: ids[1]!, frame: 150 });
  const left = itemById(split, ids[1]!);
  const right = split.items.find((item) => item.startFrame === 150 && item.id !== ids[1])!;

  let worst = 0;
  let worstFrame = -1;
  for (let frame = 0; frame <= 100; frame += 1) {
    const after =
      frame < 50
        ? resolveItemValue<number>(left, "transform.scale", frame)
        : resolveItemValue<number>(right, "transform.scale", frame - 50);
    const gap = Math.abs(after - (before[frame] as number));
    if (gap > worst) {
      worst = gap;
      worstFrame = frame;
    }
  }

  // 1e-3 isliye ki bezier ke control points 3 dashamlav tak gol kiye jaate hain
  // (taaki doc me lambe-lambe float na bharein).
  assert.ok(worst < 1e-3, `curve badal gayi: frame ${worstFrame} par ${worst} ka farak`);
});

test("split ke baad dono tukdon ki value apni jagah wahi rehti hai", () => {
  /*
   * Ye asli sawaal hai: frame number sahi hona kaafi nahi, **dikhne wali value**
   * bhi wahi honi chahiye. Warna cut ke baad animation ek jhatka khaati hai.
   */
  const { doc, ids } = chainFixture();
  let next = addKeyframe(doc, { itemId: ids[1]!, path: "transform.scale", frame: 0, value: 1 });
  next = addKeyframe(next, { itemId: ids[1]!, path: "transform.scale", frame: 100, value: 2 });

  const beforeAt70 = resolveItemValue<number>(itemById(next, ids[1]!), "transform.scale", 70);

  const split = splitItemAtFrame(next, { itemId: ids[1]!, frame: 150 });
  const right = split.items.find((item) => item.startFrame === 150 && item.id !== ids[1])!;
  // Purana local 70 ab naye item ka local 20 hai.
  const afterAt20 = resolveItemValue<number>(right, "transform.scale", 20);

  assert.ok(
    Math.abs(beforeAt70 - afterAt20) < 1e-9,
    `split ke baad value kood gayi: ${beforeAt70} -> ${afterAt20}`,
  );
});

test("trim start par keyframes peeche khiskte hain aur bahar wale gir jaate hain", () => {
  const { doc, ids } = chainFixture();
  let next = addKeyframe(doc, { itemId: ids[0]!, path: "transform.scale", frame: 5, value: 1 });
  next = addKeyframe(next, { itemId: ids[0]!, path: "transform.scale", frame: 50, value: 2 });

  // Baayan kinara 20 frame andar — 5 wala keyframe ab clip ke bahar hai.
  const before = resolveItemValue<number>(itemById(next, ids[0]!), "transform.scale", 20);
  const trimmed = trimItemStart(next, { itemId: ids[0]!, deltaFrames: 20 });

  assert.deepEqual(
    itemById(trimmed, ids[0]!).keyframes["transform.scale"]?.map((entry) => entry.frame),
    [0, 30],
    "50 - 20 = 30, aur naye kinare (0) par ek keyframe jama hona chahiye",
  );

  /*
   * ⚠️ Yahi is jaanch ka asli matlab hai: 5 wala keyframe hat gaya, par clip ki
   * **shuruaati value** wahi rehni chahiye jo trim se pehle us frame par thi.
   * Sirf keyframes hata dene par value achanak badal jaati aur clip ki shuruaat
   * me ek jhatka aata.
   */
  assert.ok(
    Math.abs(resolveItemValue<number>(itemById(trimmed, ids[0]!), "transform.scale", 0) - before) <
      1e-9,
    "trim ke baad shuruaati value kood gayi",
  );
});

section("speed ke saath keyframes (13.7)");

test("scaleKeyframes waqt me kheenchta hai", () => {
  const { doc, ids } = chainFixture();
  let next = addKeyframe(doc, { itemId: ids[0]!, path: "transform.scale", frame: 10, value: 1 });
  next = addKeyframe(next, { itemId: ids[0]!, path: "transform.scale", frame: 20, value: 2 });

  const stretched = scaleKeyframes(next, { itemId: ids[0]!, factor: 2 });
  assert.deepEqual(
    itemById(stretched, ids[0]!).keyframes["transform.scale"]?.map((entry) => entry.frame),
    [20, 40],
  );
});

test("simatne par ek frame par aa gaye keyframes me se ek hi bachta hai", () => {
  // Do keyframes ek frame par hone se span 0 ka segment banta hai aur ek UI me
  // chhupa reh jaata hai.
  const { doc, ids } = chainFixture();
  let next = addKeyframe(doc, { itemId: ids[0]!, path: "transform.scale", frame: 10, value: 1 });
  next = addKeyframe(next, { itemId: ids[0]!, path: "transform.scale", frame: 11, value: 2 });

  const squished = scaleKeyframes(next, { itemId: ids[0]!, factor: 0.1 });
  const list = itemById(squished, ids[0]!).keyframes["transform.scale"];
  assert.equal(list?.length, 1);
  assert.equal(list?.[0]?.value, 2, "baad wali value bachni chahiye");
});

test("galat factor par saaf error", () => {
  const { doc, ids } = chainFixture();
  throws(() => scaleKeyframes(doc, { itemId: ids[0]!, factor: 0 }), /Galat factor/, "factor 0");
});

section("animation vs keyframe (13.12 — keyframe jeetta hai)");

test("keyframe animation ke upar likhta hai", () => {
  /*
   * Ye niyam ek jagah likha hua hai (`KEYFRAME_BEATS_ANIMATION`) aur do jagah
   * lagu hota hai: `resolveItemValue` pehle keyframe dekhta hai, aur renderer
   * animation ko uske **upar** compose karta hai (guna).
   *
   * Wajah: animation ek preset hai jo ek click me lagta hai; keyframe wo cheez
   * hai jo user ne khud, ek khaas frame par, haath se rakhi hai.
   */
  assert.equal(KEYFRAME_BEATS_ANIMATION, true);

  const { doc, ids } = chainFixture();
  let next = addAnimation(doc, { itemIds: [ids[0]!], typeId: "kenburns" });
  next = addKeyframe(next, { itemId: ids[0]!, path: "transform.scale", frame: 0, value: 3 });

  const item = itemById(next, ids[0]!);
  // Static value 1 hai par keyframe 3 kehta hai — keyframe jeetna chahiye.
  assert.equal(item.transform.scale, 1);
  assert.equal(resolveItemValue<number>(item, "transform.scale", 0), 3);
});

section("registry ka keyframable flag (13.5)");

test("keyframable controls aur keyframable list ek doosre se milte hain", () => {
  /*
   * Do jagah likhi hui list ek din alag ho jaati hai: control par diamond dikhta
   * hai par `keyframable[]` me naam nahi hota (ya ulta), aur tab keyframe lagta
   * to hai par kisi aur jagah se dikhta nahi.
   */
  for (const entry of ITEM_TYPES.list()) {
    const flagged = entry.controls.filter((control) => control.keyframable).map((c) => c.path);
    for (const path of flagged) {
      assert.ok(
        entry.keyframable.includes(path),
        `${entry.id}: control "${path}" keyframable hai par entry.keyframable me nahi`,
      );
    }
  }
});

test("checklist ki zaroori properties keyframable hain", () => {
  const image = ITEM_TYPES.require("image");
  for (const path of [
    "transform.x",
    "transform.y",
    "transform.scale",
    "transform.rotation",
    "transform.opacity",
  ]) {
    assert.ok(image.keyframable.includes(path), `image par ${path} keyframable nahi hai`);
  }

  const video = ITEM_TYPES.require("video");
  assert.ok(video.keyframable.includes("audio.volume"), "volume keyframable hona chahiye");

  const text = ITEM_TYPES.require("text");
  assert.ok(text.keyframable.includes("text.fontSize"), "text size keyframable hona chahiye");
});

section("13.13 ka sequence — teen properties ek saath");

test("scale + opacity + x teeno ek saath sahi values dete hain", () => {
  /*
   * Checklist 13.13 ka doc: ek image par teen keyframed properties.
   * Yahan wahi values naapi jaati hain jo render ke waqt milengi — kyunki
   * renderer bhi isi `resolveItemValue()` se poochhta hai.
   */
  const base = createEmptyProject({ name: "Teen properties" });
  const item = createItem("image", {
    fps: 30,
    trackId: base.tracks[0]!.id,
    name: "Poster",
    assetId: "as_1",
    startFrame: 0,
    durationInFrames: 150,
  });
  let doc = addItem(base, { item });

  // scale 1.0 -> 1.15 (0 se 150), linear taaki ginti seedhi rahe
  doc = addKeyframe(doc, { itemId: item.id, path: "transform.scale", frame: 0, value: 1, easing: "linear" });
  doc = addKeyframe(doc, { itemId: item.id, path: "transform.scale", frame: 150, value: 1.15 });
  // opacity 0 -> 1 pehle 45 frames me
  doc = addKeyframe(doc, { itemId: item.id, path: "transform.opacity", frame: 0, value: 0, easing: "linear" });
  doc = addKeyframe(doc, { itemId: item.id, path: "transform.opacity", frame: 45, value: 1 });
  // x 0 -> -90 poore clip me
  doc = addKeyframe(doc, { itemId: item.id, path: "transform.x", frame: 0, value: 0, easing: "linear" });
  doc = addKeyframe(doc, { itemId: item.id, path: "transform.x", frame: 150, value: -90 });

  const at = (frame: number, path: string): number =>
    resolveItemValue<number>(itemById(doc, item.id), path, frame);

  // frame 0
  assert.equal(at(0, "transform.scale"), 1);
  assert.equal(at(0, "transform.opacity"), 0);
  assert.equal(at(0, "transform.x"), 0);

  // frame 45 — opacity poori ho chuki, scale 45/150 = 30%
  assert.ok(Math.abs(at(45, "transform.scale") - 1.045) < 1e-9);
  assert.equal(at(45, "transform.opacity"), 1);
  assert.ok(Math.abs(at(45, "transform.x") + 27) < 1e-9);

  // frame 90
  assert.ok(Math.abs(at(90, "transform.scale") - 1.09) < 1e-9);
  assert.equal(at(90, "transform.opacity"), 1, "45 ke baad hold");
  assert.ok(Math.abs(at(90, "transform.x") + 54) < 1e-9);

  // frame 149 — lagbhag ant
  assert.ok(Math.abs(at(149, "transform.scale") - 1.1490) < 1e-3);
  assert.ok(Math.abs(at(149, "transform.x") + 89.4) < 0.1);
});


// ------------------------------------------------------------- Phase 14

section("EFFECTS registry (14.1 / 14.2)");

test("har built-in effect ka schema apne defaults ko manzoor karta hai", () => {
  for (const entry of listEffects()) {
    const parsed = entry.schema.safeParse(entry.defaults);
    assert.ok(parsed.success, `${entry.id} ke defaults schema se nahi mile`);
  }
});

test("har effect ka har control uske schema ke kisi field par hai", () => {
  /*
   * Control ka path schema me na ho to panel ek aisi cheez dikhata hai jo kabhi
   * save hi nahi hoti — user slider ghumata hai, kuch nahi hota, aur koi error
   * bhi nahi aata. Ye galti sirf aisi hi list-check se pakdi jaati hai.
   */
  for (const entry of listEffects()) {
    const shape = (entry.schema as unknown as { shape?: Record<string, unknown> }).shape ?? {};
    for (const control of entry.controls) {
      assert.ok(control.path in shape, `${entry.id}: control "${control.path}" schema me nahi hai`);
    }
  }
});

test("keyframable params sach me schema me hain aur number hain", () => {
  for (const entry of listEffects()) {
    for (const param of entry.keyframable) {
      const value = entry.defaults[param];
      assert.equal(typeof value, "number", `${entry.id}.${param} number hona chahiye`);
    }
  }
});

test("neutral value par koi filter nahi likha jaata", () => {
  // 0 par bhi `blur(0px)` likhne se browser layer ko GPU par le jaata hai aur
  // render bina wajah dheema ho jaata hai.
  const entry = requireEffect("brightness");
  assert.deepEqual(entry.apply({ params: { amount: 1 }, frame: { width: 1080, height: 1920 } }), {});
});

test("hue-rotate CSS me `deg` ke saath jaata hai", () => {
  /*
   * ⚠️ Ye ek asli bug ka test hai. Pehle unit sirf `%` ke liye judti thi, to
   * `hue-rotate(30)` bana — jo invalid CSS hai. Browser invalid filter ko
   * **poora chhod deta hai**: effect chup-chaap gayab, koi error nahi.
   */
  const entry = requireEffect("hue-rotate");
  const out = entry.apply({ params: { amount: 30 }, frame: { width: 1080, height: 1920 } });
  assert.deepEqual(out.filters, ["hue-rotate(30deg)"]);
});

test("sharpen ka kernel jod 1 rakhta hai (roshni nahi badalti)", () => {
  const entry = requireEffect("sharpen");
  const out = entry.apply({ params: { amount: 0.8 }, frame: { width: 1080, height: 1920 } });
  const sum = (out.svgFilter?.matrix ?? []).reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sum - 1) < 1e-9, `kernel ka jod ${sum} hai, 1 hona chahiye`);
});

test("vignette filter nahi, overlay deti hai", () => {
  const entry = requireEffect("vignette");
  const out = entry.apply({ params: { amount: 0.5, spread: 0.6, color: "#000000" }, frame: { width: 1080, height: 1920 } });
  assert.equal(out.filters, undefined, "vignette pixels nahi badalti");
  assert.ok(out.overlay?.background.includes("radial-gradient"));
});

section("applyEffects — stack ka kram (14.3 / 14.4)");

function itemWithEffects(effects: readonly Record<string, unknown>[]): Item {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  let next = doc;
  for (const effect of effects) {
    next = addEffect(next, { itemIds: [id], typeId: String(effect.type) });
    const index = itemById(next, id).effects.length - 1;
    for (const [param, value] of Object.entries(effect)) {
      if (param === "type") continue;
      next = setEffectParam(next, { itemId: id, index, param, value });
    }
  }
  return itemById(next, id);
}

const FX_FRAME = { width: 1080, height: 1920 };

test("filters usi kram me jud'te hain jis kram me stack hai", () => {
  /*
   * `grayscale(1) sepia(1)` aur `sepia(1) grayscale(1)` do alag nateeje dete
   * hain — pehla bhoora deta hai, doosra safed-kaala. Isliye kram ko "theek"
   * karna galat hoga: user ne jo kram banaya wahi uska matlab hai.
   */
  const a = applyEffects(
    itemWithEffects([{ type: "grayscale", amount: 1 }, { type: "sepia", amount: 1 }]),
    0,
    FRAME,
  );
  const b = applyEffects(
    itemWithEffects([{ type: "sepia", amount: 1 }, { type: "grayscale", amount: 1 }]),
    0,
    FRAME,
  );
  assert.equal(a.filter, "grayscale(1) sepia(1)");
  assert.equal(b.filter, "sepia(1) grayscale(1)");
  assert.notEqual(a.filter, b.filter, "kram badalne par nateeja badalna chahiye");
});

test("band kiya hua effect chhod diya jaata hai", () => {
  const item = itemWithEffects([{ type: "grayscale", amount: 1, enabled: false }, { type: "sepia", amount: 1 }]);
  assert.equal(applyEffects(item, 0, FX_FRAME).filter, "sepia(1)");
});

test("anjaan effect chup-chaap chhod diya jaata hai", () => {
  /*
   * Purani file naye build me khulni chahiye, chahe usme koi effect ho jo ab hai
   * hi nahi. Throw karna yahan sabse bura hota: poora project khulna band ho
   * jaata ek aise effect ki wajah se jo shayad kabhi dikha bhi na ho.
   */
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  const withUnknown = setItemProperty(doc, {
    itemId: id,
    path: "effects",
    value: [{ type: "koi-purana-effect", enabled: true }, { type: "sepia", enabled: true, amount: 1 }],
  });
  assert.equal(applyEffects(itemById(withUnknown, id), 0, FX_FRAME).filter, "sepia(1)");
});

test("style aur overlay alag-alag nikalte hain", () => {
  const item = itemWithEffects([
    { type: "roundedCorners", radius: 24 },
    { type: "vignette", amount: 0.4 },
  ]);
  const out = applyEffects(item, 0, FX_FRAME);
  assert.equal(out.style.borderRadius, "24px");
  assert.equal(out.style.overflow, "hidden", "radius ke saath overflow zaroori hai");
  assert.equal(out.overlays.length, 1);
});

test("effectsCost band effects ko nahi ginta", () => {
  const item = itemWithEffects([{ type: "blur", radius: 8 }, { type: "sepia", amount: 1, enabled: false }]);
  assert.equal(effectsCost(item), 4);
});

section("effect params keyframable (14.5)");

test("effect ka param keyframe se animate hota hai", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  let next = addEffect(doc, { itemIds: [id], typeId: "blur" });
  next = addKeyframe(next, { itemId: id, path: effectParamPath(0, "radius"), frame: 0, value: 0 });
  next = addKeyframe(next, { itemId: id, path: effectParamPath(0, "radius"), frame: 30, value: 8 });
  next = setKeyframeEasing(next, { itemId: id, path: effectParamPath(0, "radius"), frame: 0, easing: "linear" });

  const item = itemById(next, id);
  assert.equal(applyEffects(item, 0, FX_FRAME).filter, null, "0 par blur likha hi nahi jaata");
  assert.equal(applyEffects(item, 15, FX_FRAME).filter, "blur(4px)");
  assert.equal(applyEffects(item, 30, FX_FRAME).filter, "blur(8px)");
});

test("reorder karne par keyframes SAATH jaate hain", () => {
  /*
   * ⚠️ Yahi is poore tarike ka sabse patla dhaaga hai. Keyframe path me effect
   * ka **index** hota hai (`effects.0.radius`). Stack me effect khiskane par wo
   * path apne aap kisi doosre effect par point karne lagta hai.
   *
   * Bina remap ke: user blur par 0 -> 8 lagata, blur ko neeche khiskata, aur ab
   * wo animation vignette ke amount par chalne lagti. Kuch toota nahi dikhta,
   * error nahi aata — bas galat cheez animate hone lagti hai.
   */
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  let next = addEffect(doc, { itemIds: [id], typeId: "blur" });
  next = addEffect(next, { itemIds: [id], typeId: "vignette" });
  next = addKeyframe(next, { itemId: id, path: "effects.0.radius", frame: 0, value: 0 });
  next = addKeyframe(next, { itemId: id, path: "effects.0.radius", frame: 30, value: 8 });

  next = reorderEffects(next, { itemId: id, from: 0, to: 1 });
  const item = itemById(next, id);

  assert.equal(item.effects[1]!.type, "blur", "blur neeche chala gaya");
  assert.ok(item.keyframes["effects.1.radius"], "keyframes bhi blur ke saath khisakne chahiye");
  assert.equal(item.keyframes["effects.0.radius"], undefined, "purane path par kuch nahi bachna chahiye");
  assert.equal(applyEffects(item, 30, FX_FRAME).filter, "blur(8px)", "animation ab bhi blur par hi hai");
});

test("effect hataane par uske keyframes bhi jaate hain, baaki khisakte hain", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  let next = addEffect(doc, { itemIds: [id], typeId: "blur" });
  next = addEffect(next, { itemIds: [id], typeId: "brightness" });
  next = addKeyframe(next, { itemId: id, path: "effects.0.radius", frame: 0, value: 2 });
  next = addKeyframe(next, { itemId: id, path: "effects.1.amount", frame: 0, value: 1.5 });

  next = removeEffect(next, { itemId: id, index: 0 });
  const item = itemById(next, id);

  assert.equal(item.effects.length, 1);
  assert.equal(item.keyframes["effects.0.radius"], undefined, "hataye gaye effect ke keyframes jaane chahiye");
  assert.ok(item.keyframes["effects.0.amount"], "brightness ke keyframes 1 se 0 par aane chahiye");
});

test("item ke apne transform ke keyframes effect reorder se nahi hilte", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  let next = addEffect(doc, { itemIds: [id], typeId: "blur" });
  next = addEffect(next, { itemIds: [id], typeId: "sepia" });
  next = addKeyframe(next, { itemId: id, path: "transform.scale", frame: 0, value: 1 });

  next = reorderEffects(next, { itemId: id, from: 0, to: 1 });
  assert.ok(itemById(next, id).keyframes["transform.scale"], "transform ke keyframes chhoona nahi chahiye");
});

section("effect presets (14.6)");

test("preset poora stack badal deta hai, jodta nahi", () => {
  /*
   * "B & W" ke upar "Vintage" jodne par do grayscale aur do vignette lag jaate
   * aur tasveer kaali pad jaati. Preset ka matlab "aisa dikhna chahiye" hai,
   * "aur ye bhi jod do" nahi.
   */
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  let next = applyEffectPreset(doc, { itemIds: [id], presetId: "bw" });
  const bwCount = itemById(next, id).effects.length;
  next = applyEffectPreset(next, { itemIds: [id], presetId: "vintage" });

  const item = itemById(next, id);
  assert.equal(item.effects.length, findEffectPreset("vintage")!.effects.length);
  assert.notEqual(item.effects.length, bwCount + findEffectPreset("vintage")!.effects.length);
});

test("har preset ke saare effects registry me maujood hain", () => {
  for (const preset of EFFECT_PRESETS) {
    for (const effect of preset.effects) {
      assert.ok(EFFECTS.get(String(effect.type)), `${preset.id} me anjaan effect "${String(effect.type)}"`);
    }
  }
});

test("har preset ke params uske effect ke schema se milte hain", () => {
  for (const preset of EFFECT_PRESETS) {
    for (const effect of preset.effects) {
      const entry = requireEffect(String(effect.type));
      const { type: _type, enabled: _enabled, ...params } = effect;
      assert.ok(
        entry.schema.safeParse(params).success,
        `${preset.id} -> ${String(effect.type)} ke params galat hain`,
      );
    }
  }
});

section("mask (14.9) aur blend (14.10)");

test("feather 0 par clip-path, feather par mask-image", () => {
  /*
   * `clip-path` narm kinara bana hi nahi sakta — wo har pixel ko poora rakhta
   * hai ya poora hataata hai. Dono ek saath likhna galat hota: clip-path
   * gradient ke narm kinare ko bhi seedha kaat deta aur feather dikhta hi nahi.
   */
  const crisp = maskCss({ shape: "rect", inset: 10, radius: 0, feather: 0, assetId: null });
  assert.ok(crisp.clipPath?.startsWith("inset(10%"));
  assert.equal(crisp.maskImage, undefined);

  const soft = maskCss({ shape: "rect", inset: 10, radius: 0, feather: 8, assetId: null });
  assert.equal(soft.clipPath, undefined);
  assert.ok(soft.maskImage?.includes("linear-gradient"));
  assert.equal(soft.maskComposite, "intersect", "kone sahi aane ke liye intersect chahiye");
});

test("rounded ka radius clip-path me jaata hai, circle ka nahi", () => {
  const rounded = maskCss({ shape: "rounded", inset: 5, radius: 40, feather: 0, assetId: null });
  assert.ok(rounded.clipPath?.includes("round 40px"));

  const circle = maskCss({ shape: "circle", inset: 5, radius: 40, feather: 0, assetId: null });
  assert.equal(circle.clipPath, "circle(45% at 50% 50%)");
});

test("mask null par khaali object", () => {
  assert.deepEqual(maskCss(null), {});
});

test("setMask lagata aur hataata dono hai, aur undo-able hai", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  const on = setMask(doc, { itemIds: [id], mask: { shape: "circle", inset: 4, radius: 0, feather: 0, assetId: null } });
  assert.equal(itemById(on, id).mask?.shape, "circle");

  const off = setMask(on, { itemIds: [id], mask: null });
  assert.equal(itemById(off, id).mask, null);
});

test("naya item bina mask aur normal blend ke banta hai", () => {
  const { doc } = buildFixture();
  const item = doc.items[0]!;
  assert.equal(item.mask, null);
  assert.equal(item.blendMode, "normal");
});

test("blendMode schema sirf apni chaar values maanta hai", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  const ok = setItemProperty(doc, { itemId: id, path: "blendMode", value: "screen" });
  assert.ok(safeParseDoc(ok).success, "screen chalna chahiye");

  const bad = setItemProperty(doc, { itemId: id, path: "blendMode", value: "color-dodge" });
  assert.ok(!safeParseDoc(bad).success, "list se bahar ka mode ruk jaana chahiye");
});


// ------------------------------------------------------------- Phase 15

section("dB <-> linear (15.1)");

test("0 dB par gain 1, aur wapas 0 dB", () => {
  assert.ok(Math.abs(dbToGain(0) - 1) < 1e-12);
  assert.ok(Math.abs(gainToDb(1) - 0) < 1e-12);
});

test("-6 dB lagbhag aadha gain deta hai", () => {
  // -6.02 dB theek aadha hai; -6 par 0.501. Yahi wo number hai jo har mixer par
  // likha hota hai, isliye test bhi wahi maanta hai.
  assert.ok(Math.abs(dbToGain(-6) - 0.5012) < 1e-3, String(dbToGain(-6)));
});

test("-18 dB (ducking ka default) 0.126 ke aas-paas hai", () => {
  assert.ok(Math.abs(dbToGain(-18) - 0.1259) < 1e-3, String(dbToGain(-18)));
});

test("chup (0 gain) par -Infinity nahi, MIN_VOLUME_DB aata hai", () => {
  /*
   * `20*log10(0)` `-Infinity` hai. Wo number UI me pahunchte hi slider, text
   * field aur JSON teeno todta hai — aur galti "NaN" bankar dikhti hai jiska
   * source dhoondhna bahut mushkil hota hai.
   */
  assert.equal(gainToDb(0), MIN_VOLUME_DB);
  assert.equal(dbToGain(MIN_VOLUME_DB), 0, "sabse neeche par sach me chup");
});

test("equal-power fade beech me linear se ooncha hota hai", () => {
  /*
   * Kaan power sunta hai, amplitude nahi. Linear fade ke beech me awaaz dab
   * jaati hai — isi liye default equal-power hai.
   */
  const linear = fadeGain(0.5, "linear");
  const equalPower = fadeGain(0.5, "equal-power");
  assert.equal(linear, 0.5);
  assert.ok(equalPower > 0.7, `equal-power beech me ${equalPower} hona chahiye (~0.707)`);
});

test("dono fade shapes kinaron par theek 0 aur 1 par khatam hote hain", () => {
  for (const shape of FADE_SHAPES) {
    assert.equal(fadeGain(0, shape), 0, `${shape} 0 par 0 nahi`);
    assert.ok(Math.abs(fadeGain(1, shape) - 1) < 1e-12, `${shape} 1 par 1 nahi`);
  }
});

section("duck envelope (15.3)");

/** voice track + music track, dono par ek-ek clip. */
function duckFixture(): { doc: Doc; voiceTrack: string; musicTrack: string; musicItem: string } {
  let doc = createEmptyProject({ name: "duck", initialTrackTypes: ["audio", "audio"] });
  const [voiceTrack, musicTrack] = doc.tracks;

  const music = createItem("audio", {
    trackId: musicTrack!.id,
    assetId: "as_music",
    startFrame: 0,
    durationInFrames: 300,
  });
  doc = addItem(doc, { item: music });

  const voice = createItem("audio", {
    trackId: voiceTrack!.id,
    assetId: "as_voice",
    startFrame: 100,
    durationInFrames: 100,
  });
  doc = addItem(doc, { item: voice });

  return {
    doc,
    voiceTrack: voiceTrack!.id,
    musicTrack: musicTrack!.id,
    musicItem: music.id,
  };
}

test("ducking band ho to envelope hamesha 1 hai", () => {
  const { doc } = duckFixture();
  const envelope = duckEnvelope(doc);
  for (const frame of [0, 100, 150, 200, 299]) {
    assert.equal(envelope(frame), 1, `frame ${frame}`);
  }
});

test("voice ke dauraan music target par chala jaata hai", () => {
  const { doc, voiceTrack, musicTrack } = duckFixture();
  const on = setDucking(doc, {
    enabled: true,
    voiceTrackIds: [voiceTrack],
    duckedTrackIds: [musicTrack],
    targetDb: -18,
    attackFrames: 6,
    releaseFrames: 15,
  });

  const envelope = duckEnvelope(on);
  assert.equal(envelope(50), 1, "voice se pehle poora");
  assert.ok(Math.abs(envelope(150) - dbToGain(-18)) < 1e-9, "voice ke beech me poora duck");
  assert.equal(envelope(280), 1, "release ke baad wapas poora");
});

test("attack voice se PEHLE shuru hota hai", () => {
  /*
   * Ye ek soch-samajh kar liya faisla hai. Attack voice ke saath shuru karne par
   * pehla shabd music ke upar chadh jaata hai — aur wahi ek shabd sabse zaroori
   * hota hai. Isliye dhalaan `startFrame - attackFrames` se shuru hoti hai.
   */
  const { doc, voiceTrack, musicTrack } = duckFixture();
  const on = setDucking(doc, {
    enabled: true,
    voiceTrackIds: [voiceTrack],
    duckedTrackIds: [musicTrack],
    attackFrames: 10,
  });
  const envelope = duckEnvelope(on);

  assert.equal(envelope(89), 1, "attack se pehle poora");
  assert.ok(envelope(95) < 1, "voice se 5 frame pehle hi neeche jaana shuru");
  assert.ok(envelope(95) > envelope(99), "dhalaan neeche ki taraf hai");
});

test("paas-paas ke do voice clips ke beech music upar-neeche nahi kudta", () => {
  /*
   * Do voice clips ke beech ke chhote gap me music ka upar aakar wapas neeche
   * jaana "pump" kehlata hai aur wo saaf sunai deta hai. Isliye milte-julte
   * spans jod diye jaate hain.
   */
  const { doc, voiceTrack, musicTrack } = duckFixture();
  let next = addItem(doc, {
    item: createItem("audio", {
      trackId: voiceTrack,
      assetId: "as_voice2",
      // Pehla voice 100-200 par hai; ye 205 se — beech me sirf 5 frame.
      startFrame: 205,
      durationInFrames: 50,
    }),
  });
  next = setDucking(next, {
    enabled: true,
    voiceTrackIds: [voiceTrack],
    duckedTrackIds: [musicTrack],
    attackFrames: 6,
    releaseFrames: 15,
  });

  const envelope = duckEnvelope(next);
  assert.ok(
    Math.abs(envelope(202) - dbToGain(-18)) < 1e-9,
    `gap me bhi duck rehna chahiye, mila ${envelope(202)}`,
  );
});

test("ek hi track voice aur ducked dono nahi ho sakta", () => {
  const { doc, voiceTrack } = duckFixture();
  assert.throws(
    () =>
      setDucking(doc, {
        enabled: true,
        voiceTrackIds: [voiceTrack],
        duckedTrackIds: [voiceTrack],
      }),
    /khud ko neeche/,
  );
});

test("chupi hui (muted) voice duck nahi karti", () => {
  const { doc, voiceTrack, musicTrack } = duckFixture();
  let next = setDucking(doc, {
    enabled: true,
    voiceTrackIds: [voiceTrack],
    duckedTrackIds: [musicTrack],
  });
  const voice = next.items.find((item) => item.trackId === voiceTrack)!;
  next = setItemAudio(next, { itemIds: [voice.id], field: "muted", value: true });

  assert.equal(duckEnvelope(next)(150), 1, "chup voice par music neeche nahi jaana chahiye");
});

section("itemGainAt — ek hi gain math (15.1 / 15.6)");

test("mute, track mute aur solo teeno chup kar dete hain", () => {
  const { doc, musicTrack, musicItem } = duckFixture();
  const track = doc.tracks.find((entry) => entry.id === musicTrack)!;
  const item = itemById(doc, musicItem);

  assert.equal(itemGainAt({ doc, item, track, localFrame: 0 }), 1);

  const muted = setItemAudio(doc, { itemIds: [musicItem], field: "muted", value: true });
  assert.equal(
    itemGainAt({ doc: muted, item: itemById(muted, musicItem), track, localFrame: 0 }),
    0,
  );

  // Kisi aur item par solo laga do — ye wala chup ho jaana chahiye.
  const voice = doc.items.find((entry) => entry.id !== musicItem)!;
  const solo = setItemAudio(doc, { itemIds: [voice.id], field: "solo", value: true });
  assert.equal(
    itemGainAt({ doc: solo, item: itemById(solo, musicItem), track, localFrame: 0 }),
    0,
    "solo lagne par baaki sab chup",
  );
});

test("master volume gain par gunaa hota hai", () => {
  const { doc, musicTrack, musicItem } = duckFixture();
  const half = setMasterAudio(doc, { volume: 0.5 });
  const track = half.tracks.find((entry) => entry.id === musicTrack)!;
  assert.equal(itemGainAt({ doc: half, item: itemById(half, musicItem), track, localFrame: 0 }), 0.5);
});

test("volume ke keyframes gain me aate hain (Phase 13 ka engine)", () => {
  const { doc, musicTrack, musicItem } = duckFixture();
  let next = addKeyframe(doc, { itemId: musicItem, path: "audio.volume", frame: 0, value: 0 });
  next = addKeyframe(next, { itemId: musicItem, path: "audio.volume", frame: 100, value: 1 });
  next = setKeyframeEasing(next, {
    itemId: musicItem,
    path: "audio.volume",
    frame: 0,
    easing: "linear",
  });

  const track = next.tracks.find((entry) => entry.id === musicTrack)!;
  const item = itemById(next, musicItem);
  assert.ok(Math.abs(itemGainAt({ doc: next, item, track, localFrame: 50 }) - 0.5) < 1e-9);
});

test("fade in/out gain ko kinaron par 0 par le aate hain", () => {
  const { doc, musicTrack, musicItem } = duckFixture();
  let next = setItemAudio(doc, { itemIds: [musicItem], field: "fadeInFrames", value: 30 });
  next = setItemAudio(next, { itemIds: [musicItem], field: "fadeOutFrames", value: 30 });

  const track = next.tracks.find((entry) => entry.id === musicTrack)!;
  const item = itemById(next, musicItem);

  assert.equal(itemGainAt({ doc: next, item, track, localFrame: 0 }), 0);
  assert.equal(itemGainAt({ doc: next, item, track, localFrame: 300 }), 0);
  assert.ok(itemGainAt({ doc: next, item, track, localFrame: 150 }) > 0.99, "beech me poora");
});

test("estimateMixPeak do awaazon ka jod leta hai (aur wo jaan-boojhkar zyada batata hai)", () => {
  const { doc } = duckFixture();
  // Dono clips 100-200 par overlap karti hain, dono volume 1 par.
  const { peak } = estimateMixPeak(doc);
  assert.ok(peak >= 2, `overlap par peak ${peak} hona chahiye tha >= 2`);
});

test("clipping par master ka sujhaav aata hai, warna nahi", () => {
  const { doc } = duckFixture();
  const suggestion = suggestedMasterVolume(doc);
  assert.ok(suggestion !== null && suggestion < 1, `sujhaav ${suggestion}`);

  const quiet = setItemAudio(doc, { itemIds: doc.items.map((item) => item.id), field: "volume", value: 0.4 });
  assert.equal(suggestedMasterVolume(quiet), null, "peak 1 se neeche ho to koi sujhaav nahi");
});

section("clip speed (15.7 — aur 13.7 ka baaki hissa)");

test("speed badalne par lambai ulti disha me badalti hai", () => {
  const { doc, ids } = chainFixture();
  const before = itemById(doc, ids[1]!).durationInFrames;

  const fast = setPlaybackRate(doc, { itemIds: [ids[1]!], rate: 2 });
  assert.equal(itemById(fast, ids[1]!).durationInFrames, Math.round(before / 2));

  const slow = setPlaybackRate(doc, { itemIds: [ids[1]!], rate: 0.5 });
  assert.equal(itemById(slow, ids[1]!).durationInFrames, before * 2);
});

test("speed ke saath keyframes bhi time-scale hote hain (13.7)", () => {
  /*
   * Ye wahi cheez hai jo Phase 13 me adhoori chhoot gayi thi. Bina iske 2x
   * karne par clip aadhi ho jaati par keyframes apni jagah rehte — yaani aadhi
   * animation clip ke bahar chali jaati aur kabhi dikhti hi nahi.
   */
  const { doc, ids } = chainFixture();
  let next = addKeyframe(doc, { itemId: ids[1]!, path: "transform.scale", frame: 0, value: 1 });
  // 80 par, 100 par nahi: 100 clip ka aakhri kinara hai (duration hi 100 hai) aur
  // wahan "clip ke andar hai ya bahar" ka sawaal apne aap kinare par atak jaata.
  next = addKeyframe(next, { itemId: ids[1]!, path: "transform.scale", frame: 80, value: 2 });

  const fast = setPlaybackRate(next, { itemIds: [ids[1]!], rate: 2 });
  const item = itemById(fast, ids[1]!);

  assert.deepEqual(
    item.keyframes["transform.scale"]?.map((kf) => kf.frame),
    [0, 40],
    "keyframes bhi aadhe frame par aane chahiye",
  );
  assert.ok(
    (item.keyframes["transform.scale"]?.[1]?.frame ?? 0) < item.durationInFrames,
    "koi keyframe clip ke bahar nahi bachna chahiye",
  );
});

test("fades bhi speed ke saath simatte hain", () => {
  const { doc, ids } = chainFixture();
  const withFade = setItemAudio(doc, { itemIds: [ids[1]!], field: "fadeInFrames", value: 20 });
  const fast = setPlaybackRate(withFade, { itemIds: [ids[1]!], rate: 2 });
  assert.equal(itemById(fast, ids[1]!).audio.fadeInFrames, 10);
});

test("hadd se bahar ki speed ruk jaati hai", () => {
  const { doc, ids } = chainFixture();
  assert.throws(() => setPlaybackRate(doc, { itemIds: [ids[1]!], rate: 10 }), /nahi chalegi/);
  assert.throws(() => setPlaybackRate(doc, { itemIds: [ids[1]!], rate: 0.1 }), /nahi chalegi/);
});

test("speed do baar badalne par lambai wapas wahi aati hai", () => {
  // Round-trip test — bina iske factor ka ganit ulta likha ho to bhi pata nahi chalta.
  const { doc, ids } = chainFixture();
  const before = itemById(doc, ids[1]!).durationInFrames;
  let next = setPlaybackRate(doc, { itemIds: [ids[1]!], rate: 2 });
  next = setPlaybackRate(next, { itemIds: [ids[1]!], rate: 1 });
  assert.equal(itemById(next, ids[1]!).durationInFrames, before);
});

section("freeze frame (15.8)");

test("freeze clip ko todta hai aur beech me sthir tukda daalta hai", () => {
  const { doc, ids } = chainFixture();
  // Clip 100-200 par hai. Frame 150 par freeze, 60 frames ka.
  const next = freezeFrame(doc, { itemId: ids[1]!, frame: 150, durationInFrames: 60 });

  const onTrack = next.items
    .filter((item) => item.trackId === itemById(doc, ids[1]!).trackId)
    .sort((a, b) => a.startFrame - b.startFrame);

  const frozen = onTrack.find((item) => item.name.includes("freeze"));
  assert.ok(frozen, "freeze wala item banna chahiye");
  assert.equal(frozen!.startFrame, 150);
  assert.equal(frozen!.durationInFrames, 60);
  assert.ok(frozen!.audio.muted, "sthir tasveer se awaaz nahi aani chahiye");
});

test("freeze ke baad wala tukda utna hi aage khisakta hai", () => {
  const { doc, ids } = chainFixture();
  const next = freezeFrame(doc, { itemId: ids[1]!, frame: 150, durationInFrames: 60 });

  const right = next.items.find(
    (item) => item.trackId === itemById(doc, ids[1]!).trackId && item.startFrame === 210,
  );
  assert.ok(right, "daayan tukda 150 + 60 = 210 par hona chahiye");
  assert.equal(right!.durationInFrames, 50, "150-200 wala hissa bacha hai");
});

test("freeze ka source offset freeze wale frame par jama hai", () => {
  const { doc, ids } = chainFixture();
  const next = freezeFrame(doc, { itemId: ids[1]!, frame: 150, durationInFrames: 60 });
  const frozen = next.items.find((item) => item.name.includes("freeze"))!;

  // Clip 100 par shuru hoti hai, yaani local 50; playbackRate 1.
  assert.equal(frozen.trimStartFrame, 50);
  assert.ok(frozen.playbackRate > 0, "schema positive maangta hai");
  assert.ok(frozen.playbackRate < 0.001, "aankh ko bilkul sthir dikhna chahiye");
});

test("kinare par freeze mana hai", () => {
  const { doc, ids } = chainFixture();
  assert.throws(
    () => freezeFrame(doc, { itemId: ids[1]!, frame: 100, durationInFrames: 30 }),
    /clip ke andar/,
  );
});

test("freeze ke baad doc schema pass karta hai", () => {
  const { doc, ids } = chainFixture();
  const next = freezeFrame(doc, { itemId: ids[1]!, frame: 150, durationInFrames: 60 });
  const parsed = safeParseDoc(next);
  assert.ok(parsed.success, parsed.success ? "" : JSON.stringify(parsed.error.issues.slice(0, 3)));
});

section("crop (15.10)");

test("crop ka CSS clip aur scale dono deta hai", () => {
  const css = cropCss({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
  assert.equal(css.clipPath, "inset(25% 25% 25% 25%)");
  assert.ok(css.transform?.startsWith("scale(2, 2)"), css.transform);
});

test("poora frame wala crop kuch nahi likhta", () => {
  // Har extra transform browser se ek naya layer bulwata hai — bekaar ka kharcha.
  assert.deepEqual(cropCss({ x: 0, y: 0, width: 1, height: 1 }), {});
  assert.deepEqual(cropCss(null), {});
});

test("kinare wala crop beech ki taraf khisakta hai", () => {
  // Upar-baayan chauthai: use frame ke beech me laane ke liye daayein-neeche shift.
  const css = cropCss({ x: 0, y: 0, width: 0.5, height: 0.5 });
  assert.ok(css.transform?.includes("translate(50%, 50%)"), css.transform);
});

test("setCrop hadd ke bahar ki value ko andar le aata hai", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  const next = setCrop(doc, { itemIds: [id], crop: { x: 0.8, y: 0, width: 0.9, height: 1 } });
  const crop = itemById(next, id).transform.crop!;

  assert.ok(crop.x + crop.width <= 1 + 1e-9, `crop frame se bahar nikal gaya: ${JSON.stringify(crop)}`);
});

test("setCrop null par crop hat jaata hai", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  let next = setCrop(doc, { itemIds: [id], crop: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 } });
  next = setCrop(next, { itemIds: [id], crop: null });
  assert.equal(itemById(next, id).transform.crop, null);
});

section("master audio (15.6)");

test("loudness target aur limiter doc me save hote hain", () => {
  const { doc } = duckFixture();
  const next = setMasterAudio(doc, { loudnessLufs: -16, limiter: false });
  assert.equal(next.project.audio.loudnessLufs, -16);
  assert.equal(next.project.audio.limiter, false);
  assert.ok(safeParseDoc(next).success);
});

test("hadd se bahar ka loudness target andar le aaya jaata hai", () => {
  const { doc } = duckFixture();
  assert.equal(setMasterAudio(doc, { loudnessLufs: -80 }).project.audio.loudnessLufs, -32);
  assert.equal(setMasterAudio(doc, { loudnessLufs: 5 }).project.audio.loudnessLufs, -5);
});

test("naye project ka default -14 LUFS hai (Section 3A)", () => {
  const { doc } = duckFixture();
  assert.equal(doc.project.audio.loudnessLufs, DEFAULT_LOUDNESS_LUFS);
  assert.equal(doc.project.audio.limiter, true);
});


// ------------------------------------------------------------- Phase 16

section("markers (16.8)");

test("marker doc me jaata hai aur frame ke kram me rehta hai", () => {
  const { doc } = buildFixture();
  let next = addMarker(doc, { frame: 120, name: "beat" });
  next = addMarker(next, { frame: 30 });
  next = addMarker(next, { frame: 75, name: "cut" });

  assert.deepEqual(
    next.markers.map((marker) => marker.frame),
    [30, 75, 120],
    "markers hamesha frame ke kram me rehne chahiye",
  );
  assert.ok(safeParseDoc(next).success);
});

test("ek hi frame par doosra marker nahi banta", () => {
  /*
   * Do markers ek frame par timeline me ek doosre ke upar baith jaate hain aur
   * user ko lagta hai ki uska click kaam hi nahi kiya. Isliye dobara dabane par
   * kuch nahi banta.
   */
  const { doc } = buildFixture();
  const one = addMarker(doc, { frame: 60, name: "pehla" });
  const two = addMarker(one, { frame: 60, name: "doosra" });

  assert.equal(two.markers.length, 1);
  assert.equal(two.markers[0]?.name, "pehla", "purana marker bachna chahiye");
});

test("marker ka naam aur jagah badalti hai, aur kram bana rehta hai", () => {
  const { doc } = buildFixture();
  let next = addMarker(doc, { frame: 30 });
  next = addMarker(next, { frame: 90 });
  const first = next.markers[0]!.id;

  next = setMarker(next, { markerId: first, frame: 150, name: "aage" });
  assert.deepEqual(
    next.markers.map((marker) => marker.frame),
    [90, 150],
    "khiskane ke baad bhi kram sahi rehna chahiye",
  );
  assert.equal(next.markers[1]?.name, "aage");
});

test("marker hataya ja sakta hai, aur anjaan id par saaf error", () => {
  const { doc } = buildFixture();
  const next = addMarker(doc, { frame: 45 });
  const id = next.markers[0]!.id;

  assert.equal(deleteMarker(next, { markerId: id }).markers.length, 0);
  assert.throws(() => deleteMarker(next, { markerId: "mk_nahi" }), /nahi mila/);
});

test("agla/pichhla marker dhoondhna", () => {
  const { doc } = buildFixture();
  let next = addMarker(doc, { frame: 30 });
  next = addMarker(next, { frame: 90 });

  assert.equal(nextMarkerFrame(next, 0, 1), 30);
  assert.equal(nextMarkerFrame(next, 30, 1), 90, "usi frame par khade ho to agla wala");
  assert.equal(nextMarkerFrame(next, 90, 1), null, "aage kuch nahi");
  assert.equal(nextMarkerFrame(next, 90, -1), 30);
  assert.equal(nextMarkerFrame(next, 0, -1), null);
});

section("groups (16.10)");

test("group ek field hai, naya item nahi", () => {
  const { doc, ids } = chainFixture();
  const before = doc.items.length;
  const next = groupItems(doc, { itemIds: [ids[0]!, ids[1]!] });

  assert.equal(next.items.length, before, "group banane se koi naya item nahi banta");
  assert.equal(itemById(next, ids[0]!).groupId, itemById(next, ids[1]!).groupId);
  assert.ok(itemById(next, ids[0]!).groupId, "groupId lagna chahiye");
});

test("ek item ka group nahi banta", () => {
  const { doc, ids } = chainFixture();
  assert.throws(() => groupItems(doc, { itemIds: [ids[0]!] }), /do items/);
});

test("selection group ke saathiyon tak faili jaati hai", () => {
  const { doc, ids } = chainFixture();
  const next = groupItems(doc, { itemIds: [ids[0]!, ids[2]!] });

  const expanded = expandSelectionToGroups(next, [ids[0]!]);
  assert.equal(expanded.length, 2, "ek chunne par doosra bhi aana chahiye");
  assert.ok(expanded.includes(ids[2]!));

  // Bina group wale item par kuch nahi badalta.
  assert.deepEqual(expandSelectionToGroups(next, [ids[1]!]), [ids[1]!]);
});

test("ungroup poora group todta hai, aadha nahi", () => {
  /*
   * Aadha group todna ek aisi haalat banata hai jise UI dikha hi nahi sakti:
   * kuch items saath chalte hain aur kuch nahi, par dono bilkul ek jaise dikhte
   * hain.
   */
  const { doc, ids } = chainFixture();
  let next = groupItems(doc, { itemIds: [ids[0]!, ids[1]!, ids[2]!] });
  next = ungroupItems(next, { itemIds: [ids[1]!] });

  for (const id of ids) {
    assert.equal(itemById(next, id).groupId, null, `${id} ka group toota nahi`);
  }
});

section("track ke toggles (16.2)");

test("track ka solo doosri tracks ki awaaz band kar deta hai", () => {
  const { doc, voiceTrack, musicTrack, musicItem } = duckFixture();
  const soloed = setTrackProperty(doc, { trackId: voiceTrack, path: "solo", value: true });

  const track = soloed.tracks.find((entry) => entry.id === musicTrack)!;
  assert.equal(
    itemGainAt({ doc: soloed, item: itemById(soloed, musicItem), track, localFrame: 0 }),
    0,
    "solo ke bahar ka track chup hona chahiye",
  );
});

test("chhupi hui track ki awaaz bhi nahi aati", () => {
  /*
   * Ye chhoot jaana bahut aasan hai: hide ko sirf dikhne ki cheez maan lena. Par
   * user ke liye "chhupa diya" ka matlab "ab ye video me nahi hai" hota hai —
   * aur agar uski awaaz aati rahe to MP4 dekh kar hairaani hoti hai.
   */
  const { doc, musicTrack, musicItem } = duckFixture();
  const hidden = setTrackProperty(doc, { trackId: musicTrack, path: "hidden", value: true });
  const track = hidden.tracks.find((entry) => entry.id === musicTrack)!;

  assert.equal(
    itemGainAt({ doc: hidden, item: itemById(hidden, musicItem), track, localFrame: 0 }),
    0,
  );
});

test("track ka solo item ke solo ke upar chalta hai", () => {
  const { doc, voiceTrack, musicTrack, musicItem } = duckFixture();
  let next = setTrackProperty(doc, { trackId: voiceTrack, path: "solo", value: true });
  // Music clip par apna solo — phir bhi track ke solo ke bahar hai.
  next = setItemAudio(next, { itemIds: [musicItem], field: "solo", value: true });

  const track = next.tracks.find((entry) => entry.id === musicTrack)!;
  assert.equal(itemGainAt({ doc: next, item: itemById(next, musicItem), track, localFrame: 0 }), 0);
});

test("naye track ki oonchai doc me null hoti hai (registry ka default)", () => {
  const { doc } = buildFixture();
  for (const track of doc.tracks) {
    assert.equal(track.heightPx, null);
    assert.equal(track.solo, false);
    assert.equal(track.opacity, 1);
  }
});

test("track ki oonchai aur opacity op se badalti hai aur schema pass karti hai", () => {
  const { doc } = buildFixture();
  const id = doc.tracks[0]!.id;
  let next = setTrackProperty(doc, { trackId: id, path: "heightPx", value: 120 });
  next = setTrackProperty(next, { trackId: id, path: "opacity", value: 0.4 });

  assert.equal(next.tracks[0]?.heightPx, 120);
  assert.equal(next.tracks[0]?.opacity, 0.4);
  assert.ok(safeParseDoc(next).success);
});

section("track hataana (16.1)");

test("bina bataye track nahi hat'ti jab uspar clips hain", () => {
  const { doc } = buildFixture();
  const trackId = doc.items[0]!.trackId;
  assert.throws(() => removeTrack(doc, { trackId }), /items: "delete" ya "move"/);
});

test('items: "move" par clips maanne wali doosri track par chale jaate hain', () => {
  const { doc } = buildFixture();
  const item = doc.items[0]!;
  // Ek aur track jo isi kism ke item leti ho.
  const withSpare = addTrack(doc, { typeId: doc.tracks.find((t) => t.id === item.trackId)!.type });
  const spareId = withSpare.tracks[withSpare.tracks.length - 1]!.id;

  const next = removeTrack(withSpare, { trackId: item.trackId, items: "move" });
  assert.equal(next.tracks.find((track) => track.id === item.trackId), undefined);
  assert.equal(itemById(next, item.id).trackId, spareId, "clip bachni chahiye thi");
});

test('items: "move" par lene wali track na ho to saaf error', () => {
  // Chup-chaap clip ko kisi bhi track par daal dena schema to pass kar jaata hai
  // par render me wo item kabhi dikhta hi nahi — user ko lagta hai mit gaya.
  const { doc } = buildFixture();
  const trackId = doc.items[0]!.trackId;
  assert.throws(() => removeTrack(doc, { trackId, items: "move" }), /lene wali koi doosri track/);
});

test("track ki copy uske clips bhi le aati hai, par group nahi", () => {
  const { doc } = buildFixture();
  const trackId = doc.items[0]!.trackId;
  const onTrack = doc.items.filter((item) => item.trackId === trackId).length;

  const next = duplicateTrack(doc, { trackId });
  const copy = next.tracks.find((track) => track.name.endsWith("copy"))!;

  assert.equal(next.items.filter((item) => item.trackId === copy.id).length, onTrack);
  assert.ok(
    next.items.filter((item) => item.trackId === copy.id).every((item) => item.groupId === null),
    "copy ke items asli items ke saath nahi hilne chahiye",
  );
  assert.ok(safeParseDoc(next).success);
});

test("track ki copy ke baad do tracks ek hi order par nahi hoti", () => {
  const { doc } = buildFixture();
  const next = duplicateTrack(doc, { trackId: doc.tracks[0]!.id });
  const orders = next.tracks.map((track) => track.order);
  assert.equal(new Set(orders).size, orders.length, `order dohra gaya: ${orders.join(", ")}`);
});

section("replace asset (16.13)");

test("asset badalta hai par timing, keyframes aur effects wahi rehte hain", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  let next = addKeyframe(doc, { itemId: id, path: "transform.scale", frame: 0, value: 1 });
  next = addEffect(next, { itemIds: [id], typeId: "blur" });

  const before = itemById(next, id);
  const after = itemById(replaceAsset(next, { itemIds: [id], assetId: "as_naya" }), id);

  assert.equal(after.assetId, "as_naya");
  assert.equal(after.startFrame, before.startFrame);
  assert.equal(after.durationInFrames, before.durationInFrames);
  assert.deepEqual(after.keyframes, before.keyframes, "keyframes bachne chahiye");
  assert.equal(after.effects.length, before.effects.length, "effects bachne chahiye");
});

test("naya source chhota ho to trim uske andar aa jaata hai", () => {
  /*
   * Warna clip poori kaali dikhti hai, aur wo "asset replace karne ke baad clip
   * khaali ho gayi" jaisi shikayat bankar aati hai jiski wajah kabhi samajh nahi
   * aati.
   */
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  const trimmed = trimItemStart(doc, { itemId: id, deltaFrames: 20 });
  assert.ok(itemById(trimmed, id).trimStartFrame >= 20);

  const next = replaceAsset(trimmed, {
    itemIds: [id],
    assetId: "as_chhota",
    sourceDurationFrames: 10,
  });
  assert.equal(itemById(next, id).trimStartFrame, 0);
});

test('duration: "fit" par clip naye source jitni ho jaati hai', () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  const next = replaceAsset(doc, {
    itemIds: [id],
    assetId: "as_chhota",
    sourceDurationFrames: 25,
    duration: "fit",
  });
  assert.equal(itemById(next, id).durationInFrames, 25);
  assert.equal(itemById(next, id).sourceDurationFrames, 25);
});

test("locked clip par replace nahi chalta", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  const locked = setItemProperty(doc, { itemId: id, path: "locked", value: true });
  assert.throws(() => replaceAsset(locked, { itemIds: [id], assetId: "as_naya" }));
});


// ------------------------------------------------------------- Phase 17

section("templates ka format (17.1 / 17.2)");

test("har built-in template schema se guzarta hai", () => {
  for (const template of BUILTIN_TEMPLATES) {
    const parsed = safeParseTemplate(template);
    assert.ok(parsed.success, `${template.id}: ${parsed.success ? "" : parsed.error.message}`);
  }
});

test("har built-in template me koi galti nahi hai", () => {
  /*
   * `validateTemplate` teen cheezein dekhta hai: anjaan scene type, aisa
   * `@slot` jo hai hi nahi, aur aisa slot jise koi scene use nahi karta. Teeno
   * apply karne par ek aadha-adhoora project banate hain jise user ne banaya hi
   * nahi — isliye ye check har template par chalta hai.
   */
  const known = listSceneTypes().map((entry) => entry.id);
  for (const template of BUILTIN_TEMPLATES) {
    assert.deepEqual(validateTemplate(template, known), [], `${template.id} me galti`);
  }
});

test("galat template pakda jaata hai", () => {
  const known = listSceneTypes().map((entry) => entry.id);

  const badType = validateTemplate(
    {
      ...(BUILTIN_TEMPLATES[0] as Template),
      scenes: [{ type: "koi-nahi", name: "", durationSeconds: null, slots: {} }],
      slots: [],
    },
    known,
  );
  assert.ok(badType.some((problem) => problem.includes("koi-nahi")));

  const danglingSlot = validateTemplate(
    {
      id: "t",
      name: "t",
      description: "",
      thumbnail: null,
      targetPreset: "reel",
      slots: [],
      scenes: [{ type: "text", name: "", durationSeconds: null, slots: { text: "@nahiHai" } }],
    },
    known,
  );
  assert.ok(danglingSlot.some((problem) => problem.includes("@nahiHai")));

  const unusedSlot = validateTemplate(
    {
      id: "t",
      name: "t",
      description: "",
      thumbnail: null,
      targetPreset: "reel",
      slots: [
        { key: "bekaar", label: "Bekaar", kind: "text", required: true, hint: "", multiline: false, defaultValue: null },
      ],
      scenes: [{ type: "text", name: "", durationSeconds: null, slots: { text: "fixed" } }],
    },
    known,
  );
  assert.ok(unusedSlot.some((problem) => problem.includes("bekaar")));
});

section("applyTemplate (17.3)");

/** Rahul+Papa ke saare slots bhare hue. */
function filledRahulPapa(): Record<string, string> {
  return {
    rahulLine: "Papa, pension ka kaam hua?",
    papaLine: "Teen baar gaya, har baar naya kagaz.",
    problemLine: "Process kisi ko poora pata hi nahi hota.",
    appRecording: "as_recording",
    characterImage: "as_face",
    ctaLine: "Apka Saathi par dekho",
    music: "as_music",
  };
}

test("bhare hue template se poora editable doc banta hai", () => {
  const template = findTemplate("rahul-papa") as Template;
  const { doc, missing, skipped } = applyTemplate({ template, slots: filledRahulPapa() });

  assert.deepEqual(missing, [], "sab bhara hua tha");
  assert.deepEqual(skipped, [], "koi scene chhootna nahi chahiye");
  assert.equal(doc.scenes.length, template.scenes.length);
  assert.ok(doc.items.length >= template.scenes.length, "har scene se kam se kam ek item");
  assert.ok(safeParseDoc(doc).success);
  assert.equal(doc.meta.createdBy, "template");
});

test("template se bane items wahi hain jo haath se ban sakte the", () => {
  /*
   * Ye is poore phase ka sabse zaroori test hai. Template ko ek pehle se bani
   * video ya kisi khaas renderer par chhod dena aasan hota — par tab wo reel
   * "template wali reel" ban jaati jise user chhoo bhi nahi sakta.
   *
   * Saboot: template se bane doc par ek aam op (`moveItems`) waise ka waisa
   * chalta hai.
   */
  const template = findTemplate("app-demo") as Template;
  const { doc } = applyTemplate({
    template,
    slots: { hook: "Dekho", recording: "as_rec", caption: "Bas itna", ctaLine: "Try karo" },
  });

  const first = doc.items[0] as Item;
  const moved = moveItems(doc, { itemIds: [first.id], deltaFrames: 15 });
  assert.equal(itemById(moved, first.id).startFrame, first.startFrame + 15);
});

test("khaali text slot par placeholder aata hai, khaali nahi chhodta", () => {
  /*
   * Chupchaap khaali chhod dena sabse bura hota: scene khaali dikhta hai aur
   * user ko lagta hai template hi toota hua hai. Ek saaf likhi line turant
   * batati hai ki kya karna hai.
   */
  const template = findTemplate("app-demo") as Template;
  const { doc, missing } = applyTemplate({
    template,
    slots: { recording: "as_rec", ctaLine: "Try karo" },
  });

  assert.ok(missing.some((slot) => slot.key === "hook"), "hook missing me aana chahiye");
  const texts = doc.items.map((item) => item.text?.content ?? "").join(" | ");
  assert.ok(texts.includes("["), `placeholder dikhna chahiye tha: ${texts}`);
});

test("zaroori asset na ho to scene chhoot jaata hai aur wajah milti hai", () => {
  // Asset id banayi nahi ja sakti — isliye placeholder mumkin hi nahi. Aisa
  // scene chhodna padta hai, par **chupchaap nahi**.
  const template = findTemplate("app-demo") as Template;
  const { doc, skipped } = applyTemplate({ template, slots: { hook: "Dekho", ctaLine: "Try" } });

  assert.equal(skipped.length, 1, JSON.stringify(skipped));
  assert.equal(skipped[0]?.type, "screen_recording");
  assert.ok(skipped[0]?.reason.includes("Screen recording"));
  assert.equal(doc.scenes.length, 2, "baaki do scene phir bhi banne chahiye");
});

test("optional slot khaali ho to scene chup-chaap chhoot jaata hai (aur wo theek hai)", () => {
  const template = findTemplate("rahul-papa") as Template;
  const slots = filledRahulPapa();
  delete slots.characterImage;

  const { doc, skipped } = applyTemplate({ template, slots });
  assert.equal(doc.scenes.length, template.scenes.length - 1);
  assert.ok(skipped.some((entry) => entry.type === "image"));
});

section("aspect adapt (17.4)");

test("ek hi template teeno size par lagta hai aur layout frame ke andar rehta hai", () => {
  /*
   * ⚠️ Iske liye koi "re-fit" wala code nahi likha gaya, aur wahi is test ka
   * point hai. Scene types sab kuch frame ke **percent** me banate hain, isliye
   * 9:16 ka template 1:1 par apne aap sahi baithta hai. Agar kabhi ye test fail
   * ho, uska matlab hoga ki kisi scene type me pixel ghus gaya hai.
   */
  const template = findTemplate("rahul-papa") as Template;

  for (const presetId of ["reel", "square", "landscape"]) {
    const { doc } = applyTemplate({ template, slots: filledRahulPapa(), presetId });
    const { width, height } = doc.project;

    assert.ok(safeParseDoc(doc).success, `${presetId}: schema fail`);
    assert.equal(doc.scenes.length, template.scenes.length, `${presetId}: scene chhoot gaya`);

    for (const item of doc.items) {
      // Position frame ke center se offset hai — item frame ke bahar nahi jaana
      // chahiye. Aadhi chaudai ki chhoot hai (item khud chauda ho sakta hai).
      assert.ok(
        Math.abs(item.transform.x) <= width,
        `${presetId}: "${item.name}" x=${item.transform.x} frame se bahar`,
      );
      assert.ok(
        Math.abs(item.transform.y) <= height,
        `${presetId}: "${item.name}" y=${item.transform.y} frame se bahar`,
      );
    }
  }
});

test("alag size par bhi scene ka kram wahi rehta hai", () => {
  const template = findTemplate("rahul-papa") as Template;
  const reel = applyTemplate({ template, slots: filledRahulPapa(), presetId: "reel" }).doc;
  const square = applyTemplate({ template, slots: filledRahulPapa(), presetId: "square" }).doc;

  assert.deepEqual(
    [...reel.scenes].sort((a, b) => a.order - b.order).map((scene) => scene.type),
    [...square.scenes].sort((a, b) => a.order - b.order).map((scene) => scene.type),
  );
});

section("save as template (17.5)");

test("project se template banta hai aur wo dobara lag jaata hai", () => {
  const template = findTemplate("app-demo") as Template;
  const { doc } = applyTemplate({
    template,
    slots: { hook: "Dekho", recording: "as_rec", caption: "Bas itna", ctaLine: "Try karo" },
  });

  const { template: made, dropped } = templateFromDoc(doc, { id: "mera", name: "Mera template" });
  assert.equal(dropped, 0);
  assert.deepEqual(validateTemplate(made, listSceneTypes().map((entry) => entry.id)), []);

  // Round-trip: naye template ko dobara lagao.
  const back = applyTemplate({
    template: made,
    slots: Object.fromEntries(made.slots.map((slot) => [slot.key, slot.defaultValue ?? "as_x"])),
  });
  assert.equal(back.doc.scenes.length, doc.scenes.length);
});

test("assetSlots false par asset id waisa ka waisa rehta hai", () => {
  const template = findTemplate("app-demo") as Template;
  const { doc } = applyTemplate({
    template,
    slots: { hook: "Dekho", recording: "as_rec", caption: "Bas", ctaLine: "Try" },
  });

  const fixed = templateFromDoc(doc, { id: "m", name: "M", assetSlots: false }).template;
  const values = fixed.scenes.flatMap((scene) => Object.values(scene.slots));
  assert.ok(values.includes("as_rec"), "asset id template me hi rehni chahiye thi");
});

section("brand tokens (17.10 / 17.11)");

test("preset badalne se tokens badalte hain, doc ke items nahi", () => {
  const template = findTemplate("app-demo") as Template;
  const { doc } = applyTemplate({
    template,
    slots: { hook: "Dekho", recording: "as_rec", caption: "Bas", ctaLine: "Try" },
  });

  const before = JSON.stringify(doc.items);
  const next = setBrandPreset(doc, { presetId: "sunrise" });

  assert.equal(JSON.stringify(next.items), before, "items ko haath nahi lagna chahiye");
  assert.notEqual(
    brandTokensFor(next.brand)["brand.primary"],
    brandTokensFor(doc.brand)["brand.primary"],
    "rang to badalna hi chahiye",
  );
});

test("project ka apna token preset ke upar chalta hai", () => {
  const { doc } = buildFixture();
  let next = setBrandPreset(doc, { presetId: "sunrise" });
  next = setBrandToken(next, { token: "brand.primary", value: "#123456" });

  assert.equal(brandTokensFor(next.brand)["brand.primary"], "#123456");

  // Hataane par preset wala rang wapas.
  const cleared = setBrandToken(next, { token: "brand.primary", value: null });
  assert.equal(
    brandTokensFor(cleared.brand)["brand.primary"],
    findBrandPreset("sunrise")?.tokens["brand.primary"],
  );
});

test("brand. se shuru na hone wala token ruk jaata hai", () => {
  const { doc } = buildFixture();
  assert.throws(() => setBrandToken(doc, { token: "primary", value: "#fff" }), /brand token nahi/);
});

test("manual override apne aap pehchana jaata hai — koi flag nahi", () => {
  /*
   * Doc me rang do hi tarah ke ho sakte hain: token (`brand.primary`) ya pakka
   * rang (`#C25A37`). Isliye override apne aap pata chal jaata hai, aur brand
   * badalne par wo apne aap bach bhi jaata hai.
   */
  // Text apni hi kism ki track par hi baithta hai (Dynamic rule: track types
  // batate hain kaun kahan ja sakta hai), isliye ek text track jodni padti hai.
  const { doc: base } = buildFixture();
  const withTrack = addTrack(base, { typeId: "text" });
  const textTrackId = withTrack.tracks[withTrack.tracks.length - 1]!.id;
  const doc = addItem(withTrack, {
    item: createItem("text", {
      fps: base.project.fps,
      trackId: textTrackId,
      name: "Caption",
      startFrame: 0,
      durationInFrames: 90,
    }),
  });
  const textItem = doc.items.find((item) => item.text !== null);
  assert.ok(textItem, "fixture me text item hona chahiye");

  const before = brandOverrides(doc);
  assert.equal(before.overrides.length, 0, "shuru me sab token hone chahiye");
  assert.ok(before.tokenSites.length > 0);

  const overridden = setItemProperty(doc, {
    itemId: (textItem as Item).id,
    path: "text.color",
    value: "#FF0000",
  });
  const after = brandOverrides(overridden);
  assert.equal(after.overrides.length, 1);
  assert.equal(after.overrides[0]?.path, "text.color");
});

test("brand badalne par override waisa ka waisa rehta hai", () => {
  // Text apni hi kism ki track par hi baithta hai (Dynamic rule: track types
  // batate hain kaun kahan ja sakta hai), isliye ek text track jodni padti hai.
  const { doc: base } = buildFixture();
  const withTrack = addTrack(base, { typeId: "text" });
  const textTrackId = withTrack.tracks[withTrack.tracks.length - 1]!.id;
  const doc = addItem(withTrack, {
    item: createItem("text", {
      fps: base.project.fps,
      trackId: textTrackId,
      name: "Caption",
      startFrame: 0,
      durationInFrames: 90,
    }),
  });
  const textItem = doc.items.find((item) => item.text !== null) as Item;
  let next = setItemProperty(doc, { itemId: textItem.id, path: "text.color", value: "#FF0000" });
  next = setBrandPreset(next, { presetId: "mono-dark" });

  assert.equal(itemById(next, textItem.id).text?.color, "#FF0000");
});

test("override ko token banane ke liye patch milte hain", () => {
  // Text apni hi kism ki track par hi baithta hai (Dynamic rule: track types
  // batate hain kaun kahan ja sakta hai), isliye ek text track jodni padti hai.
  const { doc: base } = buildFixture();
  const withTrack = addTrack(base, { typeId: "text" });
  const textTrackId = withTrack.tracks[withTrack.tracks.length - 1]!.id;
  const doc = addItem(withTrack, {
    item: createItem("text", {
      fps: base.project.fps,
      trackId: textTrackId,
      name: "Caption",
      startFrame: 0,
      durationInFrames: 90,
    }),
  });
  const textItem = doc.items.find((item) => item.text !== null) as Item;
  const primary = DEFAULT_BRAND_TOKENS["brand.primary"] as string;

  const next = setItemProperty(doc, { itemId: textItem.id, path: "text.color", value: primary });
  const patches = overridesToTokens(next, tokenByColor(DEFAULT_BRAND_TOKENS));

  assert.equal(patches.length, 1);
  assert.equal(patches[0]?.to, "brand.primary");
  assert.equal(patches[0]?.path, "text.color");
});

section("watermark aur end screen (17.12)");

test("watermark ke sab settings op se badalte hain aur hadd me rehte hain", () => {
  const { doc } = buildFixture();
  let next = setWatermark(doc, { enabled: true, assetId: "as_logo", sizePercent: 200 });
  assert.equal(next.brand.watermark.enabled, true);
  assert.equal(next.brand.watermark.sizePercent, 50, "hadd op me lagti hai, UI me nahi");

  next = setWatermark(next, { opacity: -1 });
  assert.equal(next.brand.watermark.opacity, 0);
  assert.ok(safeParseDoc(next).success);
});

test("end screen aur CTA doc me save hote hain", () => {
  const { doc } = buildFixture();
  let next = setEndScreen(doc, { enabled: true, text: "Aaj try karo", durationSeconds: 99 });
  next = setBrandCta(next, { text: "Download", link: "https://example.com" });

  assert.equal(next.brand.endScreen.enabled, true);
  assert.equal(next.brand.endScreen.durationSeconds, 10, "hadd op me");
  assert.equal(next.brand.cta.link, "https://example.com");
  assert.ok(safeParseDoc(next).success);
});

test("naye project me watermark band hota hai", () => {
  // On rakhna galat hota: har nayi reel par bina maange ek logo aa jaata.
  const { doc } = buildFixture();
  assert.equal(doc.brand.watermark.enabled, false);
  assert.equal(doc.brand.endScreen.enabled, false);
});


// ------------------------------------------------------------- Phase 18

section("devices — sirf data (18.1)");

test("har device ke naap frame ke hisaab se hain, pixels me nahi", () => {
  /*
   * Ye poore mockup system ki neenv hai. Ek bhi pixel wala number aa jaaye to
   * wo device ek hi size par sahi dikhta hai aur baaki sab par toota hua.
   */
  for (const device of BUILTIN_DEVICES) {
    assert.ok(device.screenAspect > 0 && device.screenAspect < 2, `${device.id}: aspect galat`);
    assert.ok(device.bezelRatio > 0 && device.bezelRatio < 0.2, `${device.id}: bezel galat`);
    assert.ok(device.colors.length > 0, `${device.id}: koi rang nahi`);
  }
});

test("geometry screen ki chaudai se poora frame nikaalti hai", () => {
  const device = requireDevice("phone-tall");
  const geometry = frameGeometry(device, 1000);

  assert.equal(geometry.screenWidth, 1000);
  assert.equal(geometry.bezel, 1000 * device.bezelRatio);
  assert.equal(geometry.outerWidth, 1000 + geometry.bezel * 2);
  assert.ok(
    Math.abs(geometry.screenHeight - 1000 / device.screenAspect) < 1e-9,
    "oonchai aspect se aani chahiye",
  );
});

test("geometry har size par ek jaisi (sirf naap badalti hai)", () => {
  // Ek hi device ka frame 500 aur 1000 par bilkul ek jaisa dikhna chahiye —
  // sirf do guna bada. Ratio hone se ye apne aap sach hai; test use jamata hai.
  const device = requireDevice("phone-tall");
  const small = frameGeometry(device, 500);
  const big = frameGeometry(device, 1000);

  assert.ok(Math.abs(big.outerWidth / small.outerWidth - 2) < 1e-9);
  assert.ok(Math.abs(big.outerRadius / small.outerRadius - 2) < 1e-9);
  assert.ok(Math.abs(big.bezel / small.bezel - 2) < 1e-9);
});

test("aspect se sabse paas wala device milta hai (18.9)", () => {
  /*
   * "Bilkul barabar" maangna galat hota: 1080x2400 ka aspect kisi bhi list me
   * theek nahi milta, aur tab har recording par "koi device nahi mila" aata.
   */
  assert.equal(deviceForAspect(1080, 2400).id, "phone-tall");
  assert.equal(deviceForAspect(1080, 1920).id, "phone-classic");
  assert.equal(deviceForAspect(1536, 2048).id, "tablet");

  // Bekaar input par bhi kuch to milna chahiye — crash nahi.
  assert.equal(deviceForAspect(0, 0).id, DEFAULT_DEVICE_ID);
});

section("zoom-pan keyframes banata hai, naya feature nahi (18.6)");

test("poore frame wale chaukor par scale 1 aur position 0", () => {
  const patches = zoomPanKeyframes({
    steps: [{ frame: 0, rect: { x: 0, y: 0, width: 1, height: 1 } }],
    frame: { width: 1080, height: 1920 },
  });

  const byPath = Object.fromEntries(patches.map((patch) => [patch.path, patch.value]));
  assert.ok(Math.abs(byPath["transform.scale"]! - 1) < 1e-9);
  assert.ok(Math.abs(byPath["transform.x"]!) < 1e-9);
  assert.ok(Math.abs(byPath["transform.y"]!) < 1e-9);
});

test("aadhe chaukor par scale 2 hoti hai", () => {
  const patches = zoomPanKeyframes({
    steps: [{ frame: 0, rect: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } }],
    frame: { width: 1080, height: 1920 },
  });
  const scale = patches.find((patch) => patch.path === "transform.scale")?.value;
  assert.ok(Math.abs((scale as number) - 2) < 1e-9, String(scale));
});

test("chaukor ka beech frame ke beech par aata hai", () => {
  /*
   * Upar-baayan chauthai chuno: use beech me laane ke liye item ko daayein aur
   * neeche khiskana padta hai (positive x aur y).
   */
  const patches = zoomPanKeyframes({
    steps: [{ frame: 0, rect: { x: 0, y: 0, width: 0.5, height: 0.5 } }],
    frame: { width: 1080, height: 1920 },
  });
  const x = patches.find((patch) => patch.path === "transform.x")?.value as number;
  const y = patches.find((patch) => patch.path === "transform.y")?.value as number;

  assert.ok(x > 0, `x ${x} positive hona chahiye`);
  assert.ok(y > 0, `y ${y} positive hona chahiye`);
  // Chauthai ka beech (0.25, 0.25) hai; scale 2 par shift = 0.25 * size * 2.
  assert.ok(Math.abs(x - 0.25 * 1080 * 2) < 1e-9);
  assert.ok(Math.abs(y - 0.25 * 1920 * 2) < 1e-9);
});

test("chaudi chaukor par chhoti scale chunti hai (poora hissa dikhe)", () => {
  // 80% chaudi par 20% oonchi: chaudai 1.25x maangti hai, oonchai 5x. Chhoti
  // (1.25x) leni chahiye — badi lene par chuna hua hissa frame se bahar nikal
  // jaata aur user ka chunav poora dikhta hi nahi.
  const patches = zoomPanKeyframes({
    steps: [{ frame: 0, rect: { x: 0.1, y: 0.4, width: 0.8, height: 0.2 } }],
    frame: { width: 1080, height: 1920 },
  });
  const scale = patches.find((patch) => patch.path === "transform.scale")?.value as number;
  assert.ok(Math.abs(scale - 1.25) < 1e-9, String(scale));
});

test("applyZoomPan doc me asli keyframes daalta hai", () => {
  /*
   * Yahi is poore tool ka point hai: zoom apna field nahi banta, wo **wahi
   * keyframes** banata hai jo user haath se laga sakta tha. Isliye uspar undo,
   * curve editor aur copy-paste apne aap chalte hain.
   */
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;

  const next = applyZoomPan(doc, {
    itemId: id,
    steps: [
      { frame: 0, rect: { x: 0, y: 0, width: 1, height: 1 } },
      { frame: 45, rect: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } },
    ],
  });

  const item = itemById(next, id);
  assert.equal(item.keyframes["transform.scale"]?.length, 2);
  assert.equal(item.keyframes["transform.x"]?.length, 2);
  assert.equal(item.keyframes["transform.y"]?.length, 2);
  assert.ok(safeParseDoc(next).success);

  // Aur wo asli keyframes hain — engine unhe padh leta hai.
  assert.ok(Math.abs(resolveItemValue<number>(item, "transform.scale", 45) - 2) < 1e-9);
});

test("dobara zoom lagane par purane keyframes hat jaate hain", () => {
  // Bina iske do zoom milkar ek ajeeb teesri harkat bana dete hain jise
  // samjhana namumkin hota.
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;

  let next = applyZoomPan(doc, {
    itemId: id,
    steps: [
      { frame: 0, rect: { x: 0, y: 0, width: 1, height: 1 } },
      { frame: 45, rect: { x: 0.25, y: 0.25, width: 0.5, height: 0.5 } },
      { frame: 90, rect: { x: 0, y: 0, width: 1, height: 1 } },
    ],
  });
  assert.equal(itemById(next, id).keyframes["transform.scale"]?.length, 3);

  next = applyZoomPan(next, {
    itemId: id,
    steps: [{ frame: 0, rect: { x: 0.1, y: 0.1, width: 0.5, height: 0.5 } }],
  });
  assert.equal(itemById(next, id).keyframes["transform.scale"]?.length, 1);
});

test("khaali steps par saaf error", () => {
  const { doc } = buildFixture();
  assert.throws(
    () => applyZoomPan(doc, { itemId: doc.items[0]!.id, steps: [] }),
    /kam se kam ek step/,
  );
});

test("har zoom preset ke steps sahi hadd me hain", () => {
  for (const preset of ZOOM_PRESETS) {
    assert.ok(preset.steps.length >= 2, `${preset.id}: ek hi step ka koi matlab nahi`);
    for (const step of preset.steps) {
      const { x, y, width, height } = step.rect;
      assert.ok(x >= 0 && y >= 0, `${preset.id}: chaukor frame se bahar`);
      assert.ok(x + width <= 1.0001, `${preset.id}: chaukor daayein se bahar`);
      assert.ok(y + height <= 1.0001, `${preset.id}: chaukor neeche se bahar`);
    }
  }
});

section("upscale ki chetavni (18.8)");

test("bina zoom ke 1080p source 1080p frame par theek hai", () => {
  const check = checkZoomUpscale({
    steps: [{ frame: 0, rect: { x: 0, y: 0, width: 1, height: 1 } }],
    source: { width: 1080, height: 2400 },
    frame: { width: 1080, height: 1920 },
  });
  assert.equal(check.level, "ok");
  assert.equal(check.advice, null);
});

test("2.5x zoom par saaf galti aur exact numbers milte hain", () => {
  /*
   * Sirf "blurry lagega" likhna bekaar hota — usse user kuch nahi kar sakta.
   * Yahan exact number aata hai aur uske saath ek seedha kaam.
   */
  const check = checkZoomUpscale({
    steps: [
      { frame: 0, rect: { x: 0, y: 0, width: 1, height: 1 } },
      { frame: 60, rect: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 } },
    ],
    source: { width: 1080, height: 2400 },
    frame: { width: 1080, height: 1920 },
  });

  assert.ok(Math.abs(check.maxScale - 2.5) < 1e-9, String(check.maxScale));
  assert.equal(check.level, "error");
  assert.ok(check.advice, "salah honi chahiye");
  assert.ok(check.advice?.includes("px"), `salah me exact number hona chahiye: ${check.advice}`);
  assert.ok(check.upscale.requiredSource.width > 1080);
});

test("halka zoom sirf chetavni deta hai, galti nahi", () => {
  // 1.15x tak upscale aankh ko lagbhag nahi dikhta — use "error" batana jhooth
  // hoga, aur do-teen jhoothe error ke baad user har chetavni ko anदेखा kar deta.
  const check = checkZoomUpscale({
    steps: [{ frame: 0, rect: { x: 0.05, y: 0.05, width: 0.92, height: 0.92 } }],
    source: { width: 1080, height: 2400 },
    frame: { width: 1080, height: 1920 },
  });
  assert.notEqual(check.level, "error", `${check.level}: ${check.advice}`);
});

test("bada source zoom par bhi theek rehta hai", () => {
  const check = checkZoomUpscale({
    steps: [{ frame: 0, rect: { x: 0.3, y: 0.3, width: 0.4, height: 0.4 } }],
    source: { width: 3840, height: 8533 },
    frame: { width: 1080, height: 1920 },
  });
  assert.equal(check.level, "ok", check.advice ?? "");
});

section("mockup (18.1 / 18.5)");

test("setMockup lagata aur hataata dono hai", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;

  const on = setMockup(doc, {
    itemIds: [id],
    mockup: {
      deviceId: "phone-tall",
      colorId: "graphite",
      widthPercent: 60,
      shadow: true,
      glare: false,
      tiltX: 0,
      tiltY: 0,
      screenFit: "cover",
    },
  });
  assert.equal(itemById(on, id).mockup?.deviceId, "phone-tall");
  assert.ok(safeParseDoc(on).success);

  const off = setMockup(on, { itemIds: [id], mockup: null });
  assert.equal(itemById(off, id).mockup, null);
});

test("naye item par koi mockup nahi hota", () => {
  // Har video par phone frame chadha dena galat hoga — frame sirf screen
  // recording par kaam ka hai, camera footage par nahi.
  const { doc } = buildFixture();
  for (const item of doc.items) assert.equal(item.mockup, null);
});

test("mockup ka tilt hadd me rehta hai", () => {
  const { doc } = buildFixture();
  const id = doc.items[0]!.id;
  const bad = setMockup(doc, {
    itemIds: [id],
    mockup: {
      deviceId: "phone-tall",
      colorId: "graphite",
      widthPercent: 60,
      shadow: true,
      glare: false,
      tiltX: 90,
      tiltY: 0,
      screenFit: "cover",
    },
  });
  // Schema hadd lagati hai — 90 degree par phone bilkul patla dikhta hai.
  assert.ok(!safeParseDoc(bad).success, "45 se zyada tilt ruk jaana chahiye");
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
