/**
 * Generated properties panel ka check — bina browser ke.
 *
 * Panel ka poora vaada ek hi line me hai: **naya item type = zero panel code**
 * (Dynamic rule 2). Wo vaada aankh se nahi jaancha ja sakta — isliye yahan ek
 * bilkul naya, banawati item type registry me daal kar dekha jaata hai ki uske
 * controls apne aap panel me aa gaye ya nahi.
 *
 * Baaki teen cheezein jo chup-chaap galat ho sakti hain:
 *  - multi-select me "mixed" ka pata chalna (pehle item ki value dikhana jhooth hai)
 *  - `when` wale controls ka chhupna/dikhna
 *  - reset ki default value (registry se aani chahiye, kahin likhi hui nahi)
 *
 * Chalane ka tarika:  npm run check --workspace @reel/studio
 */

import assert from "node:assert/strict";

import {
  CONTROL_KINDS,
  ITEM_TYPES,
  computeFit,
  createEmptyProject,
  createItem,
  controlVisible,
  registerItemType,
  type ControlDescriptor,
  type Item,
} from "@reel/core";
import { z } from "zod";

import { CONTROL_COMPONENTS, controlComponent } from "../components/controls";
import {
  MIXED,
  commonControls,
  commonValue,
  defaultValue,
  isMixed,
  resolutionReadout,
  visibleGroups,
} from "../lib/properties";

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

const FPS = 30;

function textItem(overrides: Partial<Item> = {}): Item {
  return createItem("text", { fps: FPS, trackId: "tr_1", ...overrides }) as Item;
}

/* ------------------------------------------------------- mixed values (9.5) */

section("multi-select ki 'mixed' pehchaan (9.5)");

test("sab par ek jaisi value ho to wahi milti hai", () => {
  const a = textItem();
  const b = textItem();
  assert.equal(commonValue([a, b], "text.fontSize"), a.text?.fontSize);
});

test("ek bhi alag ho to MIXED", () => {
  const a = textItem();
  const b = textItem();
  b.text = { ...(b.text as NonNullable<Item["text"]>), fontSize: 40 };
  assert.equal(commonValue([a, b], "text.fontSize"), MIXED);
  assert.equal(isMixed(commonValue([a, b], "text.fontSize")), true);
});

test("null aur MIXED alag cheezein hain", () => {
  // Ye galti bahut aasan hai: "stroke nahi hai" (null) ko "alag-alag hai"
  // (MIXED) samajh lena. Dono par panel bilkul alag dikhna chahiye.
  const a = textItem();
  const b = textItem();
  assert.equal(commonValue([a, b], "text.stroke"), null);
  assert.equal(isMixed(commonValue([a, b], "text.stroke")), false);

  b.text = { ...(b.text as NonNullable<Item["text"]>), stroke: { color: "#fff", width: 2 } };
  assert.equal(commonValue([a, b], "text.stroke"), MIXED);
});

test("gehri tulna hoti hai — ek jaisa object MIXED nahi hai", () => {
  const a = textItem();
  const b = textItem();
  a.text = { ...(a.text as NonNullable<Item["text"]>), stroke: { color: "#fff", width: 2 } };
  b.text = { ...(b.text as NonNullable<Item["text"]>), stroke: { color: "#fff", width: 2 } };
  // Do alag object hain par value ek hai — reference se compare karne par ye
  // galti se MIXED nikalta aur panel hamesha `—` dikhata.
  assert.equal(isMixed(commonValue([a, b], "text.stroke")), false);
});

test("anchor jaisi array bhi sahi compare hoti hai", () => {
  const a = textItem();
  const b = textItem();
  assert.equal(isMixed(commonValue([a, b], "transform.anchor")), false);
  b.transform = { ...b.transform, anchor: [0, 0] };
  assert.equal(commonValue([a, b], "transform.anchor"), MIXED);
});

/* ------------------------------------------------- common controls (9.5) */

section("mixed selection me sirf common controls (9.5)");

test("ek hi type ke do items par saare controls rehte hain", () => {
  const controls = commonControls([textItem(), textItem()]);
  assert.equal(controls.length, ITEM_TYPES.require("text").controls.length);
});

test("text + image par sirf dono me maujood controls bachte hain", () => {
  const text = textItem();
  const image = createItem("image", { fps: FPS, trackId: "tr_1" }) as Item;
  const controls = commonControls([text, image]);
  const paths = controls.map((control) => control.path);

  // Transform dono par hai…
  assert.ok(paths.includes("transform.scale"));
  // …par font sirf text par. Image par font lagane ka koi matlab hi nahi.
  assert.ok(!paths.includes("text.fontFamily"), `font aa gaya: ${paths.join(", ")}`);
});

test("khaali selection par kuch nahi", () => {
  assert.deepEqual(commonControls([]), []);
  assert.equal(commonValue([], "transform.scale"), undefined);
});

/* --------------------------------------------------------- when (9.1) */

section("`when` wale controls (declarative, code nahi)");

test("stroke ke andar wale controls tabhi dikhte hain jab stroke on ho", () => {
  const item = textItem();
  const groups = visibleGroups([item], commonControls([item]));
  const strokeGroup = groups.find((group) => group.group === "Stroke");
  assert.ok(strokeGroup, "Stroke section hona chahiye tha");

  // Stroke abhi null hai — sirf uska switch dikhna chahiye.
  assert.deepEqual(
    strokeGroup.controls.map((control) => control.control),
    ["enable"],
  );

  item.text = { ...(item.text as NonNullable<Item["text"]>), stroke: { color: "#000", width: 4 } };
  const onGroups = visibleGroups([item], commonControls([item]));
  const on = onGroups.find((group) => group.group === "Stroke");
  assert.ok(on && on.controls.length === 3, `on hone par 3 control chahiye, mile ${on?.controls.length}`);
});

test("shape ka corner radius sirf rect par dikhta hai", () => {
  const rect = createItem("shape", { fps: FPS, trackId: "tr_1" }) as Item;
  const paths = () =>
    visibleGroups([rect], commonControls([rect]))
      .flatMap((group) => group.controls)
      .map((control) => control.path);

  assert.ok(paths().includes("shape.radius"), "rect par radius dikhna chahiye");

  rect.shape = { ...(rect.shape as NonNullable<Item["shape"]>), kind: "ellipse" };
  assert.ok(!paths().includes("shape.radius"), "ellipse par radius nahi dikhna chahiye");
});

test("controlVisible dono shart samajhta hai", () => {
  const equalsControl = {
    path: "a",
    control: "text",
    label: "A",
    when: { path: "kind", equals: "rect" },
  } as ControlDescriptor;
  assert.equal(controlVisible(equalsControl, () => "rect"), true);
  assert.equal(controlVisible(equalsControl, () => "ellipse"), false);

  const setControl = {
    path: "a",
    control: "text",
    label: "A",
    when: { path: "stroke", isSet: true },
  } as ControlDescriptor;
  assert.equal(controlVisible(setControl, () => ({ width: 1 })), true);
  assert.equal(controlVisible(setControl, () => null), false);
  assert.equal(controlVisible(setControl, () => undefined), false);
});

/* -------------------------------------------------------- default (9.4) */

section("double-click se reset ki default value (9.4)");

test("default registry/factory se aati hai, kahin likhi hui nahi", () => {
  const pristine = textItem();
  assert.equal(defaultValue("text", "transform.scale", FPS), pristine.transform.scale);
  assert.equal(defaultValue("text", "text.fontSize", FPS), pristine.text?.fontSize);
  assert.equal(defaultValue("text", "text.stroke", FPS), null);
  assert.equal(defaultValue("image", "fit.mode", FPS), pristine.fit.mode);
});

test("anjaan path par undefined — chupchaap 0 nahi", () => {
  assert.equal(defaultValue("text", "kuch.bhi.nahi", FPS), undefined);
});

/* ------------------------------------------- effective resolution (9.6c) */

section("effective resolution readout (9.6c)");

const REEL = { width: 1080, height: 1920 };

test("bade source par upscale nahi hota", () => {
  const readout = resolutionReadout({
    source: { width: 2160, height: 3840 },
    frame: REEL,
    fitMode: "cover",
    itemScale: 1,
  });
  assert.equal(readout.upscaled, false);
  assert.equal(readout.message, null);
  assert.deepEqual(readout.effective, { width: 1080, height: 1920 });
});

test("chhote source par saaf warning aati hai", () => {
  const readout = resolutionReadout({
    source: { width: 640, height: 480 },
    frame: REEL,
    fitMode: "cover",
    itemScale: 1,
  });
  assert.equal(readout.upscaled, true);
  assert.ok(readout.message?.includes("dhundhli"), `message: ${readout.message}`);
  // 4:3 ko 9:16 me cover karne ke liye oonchai se bandhna padta hai: 1920/480 = 4x.
  assert.ok(readout.totalScale > 3.9 && readout.totalScale < 4.1, `scale ${readout.totalScale}`);
});

test("user ki scale bhi ginti me aati hai", () => {
  const base = resolutionReadout({
    source: { width: 1080, height: 1920 },
    frame: REEL,
    fitMode: "cover",
    itemScale: 1,
  });
  assert.equal(base.upscaled, false);

  // Bilkul theek naap wali image ko 2x zoom karne par wo bhi upscale hai —
  // yahi wo case hai jo export ke waqt pakda jaata tha, ab panel me dikhta hai.
  const zoomed = resolutionReadout({
    source: { width: 1080, height: 1920 },
    frame: REEL,
    fitMode: "cover",
    itemScale: 2,
  });
  assert.equal(zoomed.upscaled, true);
  assert.deepEqual(zoomed.effective, { width: 2160, height: 3840 });
});

test("readout wahi computeFit chalata hai jo render chalata hai", () => {
  const source = { width: 1920, height: 1080 };
  const fit = computeFit(source, REEL, "contain");
  const readout = resolutionReadout({ source, frame: REEL, fitMode: "contain", itemScale: 1 });
  assert.equal(readout.effective.width, Math.round(source.width * fit.scaleX));
});

/* ----------------------------------- naya type = zero panel code (9.1) */

section("naya item type add karne par panel apne aap ban jaata hai (Done when)");

test("har ControlKind ka ek component registry me hai", () => {
  // Ek bhi kism chhoot jaaye to uska control chup-chaap text ban jaata hai —
  // aur wo galti sirf us type par dikhti hai jise koi kabhi khole.
  for (const kind of CONTROL_KINDS) {
    assert.ok(CONTROL_COMPONENTS[kind], `"${kind}" ka koi component nahi hai`);
  }
});

test("bilkul naya type registry me daalne par uske controls panel me aa jaate hain", () => {
  const controls: ControlDescriptor[] = [
    { path: "sticker.wiggle", control: "slider", label: "Wiggle", group: "Sticker", min: 0, max: 10, step: 0.1 },
    { path: "sticker.emoji", control: "text", label: "Emoji", group: "Sticker" },
    { path: "sticker.glow", control: "enable", label: "Glow", group: "Sticker", enableDefault: { color: "#fff" } },
    {
      path: "sticker.glow.color",
      control: "color",
      label: "Glow colour",
      group: "Sticker",
      when: { path: "sticker.glow", isSet: true },
    },
  ];

  registerItemType({
    id: "sticker_test",
    label: "Sticker (test)",
    icon: "Square",
    kind: "graphic",
    componentKey: "ShapeItem",
    needsAsset: false,
    hasVisual: true,
    hasAudio: false,
    supportsTrim: false,
    defaultTrackType: "overlay",
    defaultDurationSeconds: 2,
    schema: z.object({}),
    defaults: { sticker: { wiggle: 3, emoji: "🔥", glow: null } },
    controls,
    keyframable: ["sticker.wiggle"],
  });

  const item = createItem("sticker_test", { fps: FPS, trackId: "tr_1" }) as Item;

  // Panel ke teeno kaam bina kisi naye code ke chal jaane chahiye:
  const found = commonControls([item]);
  assert.equal(found.length, controls.length, "controls panel tak nahi pahunche");

  const groups = visibleGroups([item], found);
  const sticker = groups.find((group) => group.group === "Sticker");
  assert.ok(sticker, "Sticker section nahi bana");
  // glow abhi null hai, isliye uska rang wala control chhupa rehna chahiye.
  assert.equal(sticker.controls.length, 3, `${sticker.controls.length} control dikhe, 3 chahiye the`);

  // Har control ke liye component milna chahiye.
  for (const control of found) {
    assert.ok(controlComponent(control.control), `${control.control} ka component nahi mila`);
  }

  // Aur values bhi path se padhi ja rahi hain.
  assert.equal(commonValue([item], "sticker.wiggle"), 3);
  assert.equal(defaultValue("sticker_test", "sticker.emoji", FPS), "🔥");
});

/* --------------------------------------------------------- doc sanity */

section("panel doc ko chhuta nahi");

test("commonValue / visibleGroups padhne wale hain, likhne wale nahi", () => {
  const doc = createEmptyProject({ name: "Panel fixture" });
  const item = createItem("text", { fps: doc.project.fps, trackId: doc.tracks[0]!.id }) as Item;
  const before = JSON.stringify(item);

  commonValue([item], "text.fontSize");
  commonControls([item]);
  visibleGroups([item], commonControls([item]));
  defaultValue("text", "text.color", doc.project.fps);

  assert.equal(JSON.stringify(item), before, "kisi helper ne item badal diya");
});

/* ------------------------------------------------------------------ end */

console.log(`\n${"-".repeat(60)}`);
if (failures.length > 0) {
  console.log(`FAILED: ${failures.length} fail, ${passed} pass`);
  for (const failure of failures) console.log(`  - ${failure.name}: ${failure.error}`);
  process.exit(1);
}
console.log(`ALL PASS: ${passed} tests, 0 fail`);
