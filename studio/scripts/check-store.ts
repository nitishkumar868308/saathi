/**
 * Editor store ka check — applyOp, undo/redo, aur op ke error ka rasta.
 *
 * Store jaan-boojhkar vanilla zustand hai (React sirf context se judta hai),
 * isliye ise bina browser ke sach me chalaya ja sakta hai. Yahi wo teen cheezein
 * hain jinke tootne par editor "kaam to kar raha hai" dikhta rehta hai:
 *
 *   - applyOp doc badalta hai **aur** history bharta hai
 *   - undo/redo asli doc wapas laate hain, aur unke flags sahi hote hain
 *   - op ka error crash nahi, `opError` banta hai — doc chhuta tak nahi
 *
 * ⚠️ Har test ke aakhir me `dispose()` — warna autosave ka timer chalta rehta
 * hai aur `fetch("/api/…")` Node me relative URL par phatta hai.
 *
 * Chalane ka tarika:  npm run check --workspace @reel/studio
 */

import assert from "node:assert/strict";

import { createEmptyProject, createItem, type Doc } from "@reel/core";

import { createEditorStore, type LoadedProjectInput } from "../lib/store";

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

function fixture(): LoadedProjectInput {
  const doc: Doc = createEmptyProject({ name: "Store fixture" });
  return {
    id: "00000000-0000-0000-0000-000000000001",
    name: doc.project.name,
    docVersion: 1,
    updatedAt: "2026-08-19T00:00:00.000Z",
    doc,
  };
}

console.log("editor store (4.7 / 4.8 / 4.12)");

test("store shuru se hi bhara hua aata hai (SSR ke liye zaroori)", () => {
  const store = createEditorStore(fixture());
  const state = store.getState();
  assert.equal(state.doc.project.name, "Store fixture");
  assert.equal(state.docVersion, 1);
  assert.equal(state.saveStatus, "saved");
  assert.equal(state.canUndo, false);
  state.dispose();
});

test("applyOp doc badalta hai aur history bhi", () => {
  const store = createEditorStore(fixture());
  const before = store.getState().doc;

  store.getState().applyOp("setProjectProperty", { path: "name", value: "Rahul + Papa" });

  const after = store.getState().doc;
  assert.equal(after.project.name, "Rahul + Papa");
  // Purana doc chhua nahi gaya — immer ka pura faayda yahin dikhta hai.
  assert.equal(before.project.name, "Store fixture");
  assert.equal(store.getState().canUndo, true);
  assert.equal(store.getState().saveStatus, "dirty");
  store.getState().dispose();
});

test("undo/redo sach me doc wapas laate hain", () => {
  const store = createEditorStore(fixture());
  store.getState().applyOp("setProjectProperty", { path: "name", value: "Naya naam" });

  store.getState().undo();
  assert.equal(store.getState().doc.project.name, "Store fixture");
  assert.equal(store.getState().canUndo, false);
  assert.equal(store.getState().canRedo, true);

  store.getState().redo();
  assert.equal(store.getState().doc.project.name, "Naya naam");
  assert.equal(store.getState().canRedo, false);
  store.getState().dispose();
});

test("coalesceKey se lagataar edits ek hi undo entry banti hain", () => {
  const store = createEditorStore(fixture());
  for (const value of ["R", "Ra", "Rah", "Rahul"]) {
    store
      .getState()
      .applyOp("setProjectProperty", { path: "name", value }, { coalesceKey: "project-name" });
  }
  assert.equal(store.getState().doc.project.name, "Rahul");

  // Ek Ctrl+Z me poora naam wapas — 4 baar nahi dabana padta.
  store.getState().undo();
  assert.equal(store.getState().doc.project.name, "Store fixture");
  store.getState().dispose();
});

test("item add karne par project ki lambai apne aap badhti hai", () => {
  const store = createEditorStore(fixture());
  const doc = store.getState().doc;
  const trackId = doc.tracks[0]!.id;
  const item = createItem("image", {
    fps: doc.project.fps,
    trackId,
    startFrame: doc.project.durationInFrames,
    durationInFrames: 60,
  });

  store.getState().applyOp("addItem", { item });
  assert.equal(store.getState().doc.items.length, 1);
  assert.equal(
    store.getState().doc.project.durationInFrames,
    doc.project.durationInFrames + 60,
  );
  store.getState().dispose();
});

test("op ka error crash nahi karta — doc waisa ka waisa, opError bharta hai", () => {
  const store = createEditorStore(fixture());
  const before = store.getState().doc;

  store.getState().applyOp("moveItem", { itemId: "it_gayab", startFrame: 10 });

  assert.equal(store.getState().doc, before, "doc bilkul nahi badalna chahiye");
  assert.match(store.getState().opError ?? "", /nahi mila/);
  assert.equal(store.getState().canUndo, false, "fail hui op history me nahi jaani chahiye");

  store.getState().clearOpError();
  assert.equal(store.getState().opError, null);
  store.getState().dispose();
});

test("protected project field op se bhi band hai", () => {
  const store = createEditorStore(fixture());
  store.getState().applyOp("setProjectProperty", { path: "width", value: 720 });
  assert.match(store.getState().opError ?? "", /apna op/);
  assert.equal(store.getState().doc.project.width, 1080);
  store.getState().dispose();
});

test("dispose ke baad bhi agli edit save maangti hai (StrictMode wala bug)", () => {
  const store = createEditorStore(fixture());

  /*
   * Ye test ek asli bug se aaya hai. React StrictMode dev me har effect ko
   * mount → cleanup → mount chalata hai, isliye unmount ka cleanup mount ke
   * turant baad chal jaata tha aur scheduler mar jaata tha. Uske baad har edit
   * par screen "Saved" dikhati thi aur DB me kuch nahi jaata tha — sabse
   * khatarnak kism ki khamoshi.
   */
  store.getState().dispose();
  store.getState().applyOp("setProjectProperty", { path: "name", value: "Dispose ke baad" });

  assert.equal(store.getState().doc.project.name, "Dispose ke baad");
  assert.equal(
    store.getState().saveStatus,
    "dirty",
    "dispose ke baad bhi edit save ke liye queue honi chahiye — chupchaap 'saved' rehna sabse bura hai",
  );
  store.getState().dispose();
});

test("ui state doc ke andar nahi jaata (Section E)", () => {
  const store = createEditorStore(fixture());
  const before = store.getState().doc;

  store.getState().setPlayhead(42);
  store.getState().setSelection({ itemIds: ["it_1"], trackIds: [] });
  store.getState().setLeftPanel("versions");

  assert.equal(store.getState().playheadFrame, 42);
  assert.equal(store.getState().doc, before, "UI badalne se doc chhuna nahi chahiye");
  assert.equal(store.getState().canUndo, false, "UI badlav undo me nahi jaate");
  store.getState().dispose();
});

console.log(`\n${"-".repeat(60)}`);
if (failures.length > 0) {
  console.log(`FAILED: ${failures.length} fail, ${passed} pass`);
  for (const failure of failures) console.log(`  - ${failure.name}: ${failure.error}`);
  process.exit(1);
}
console.log(`ALL PASS: ${passed} tests, 0 fail`);
