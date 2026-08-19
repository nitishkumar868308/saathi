import { produce, type Draft } from "immer";

import {
  FREEZE_PLAYBACK_RATE,
  MAX_PLAYBACK_RATE,
  MIN_PLAYBACK_RATE,
} from "../config/audio";
import { getAnimationPreset } from "../config/animationPresets";
import { findEffectPreset } from "../config/effectPresets";
import { mergeCues, splitCue, type CaptionCue } from "../captions/cues";
import { zoomPanKeyframes, type ZoomStep } from "../mockup/zoomPan";
import { DEFAULT_EASING } from "../config/easing";
import { splitEasing } from "../keyframes/easing";
import { sampleKeyframes } from "../keyframes/interpolate";
import { DEFAULT_OVERLAP_POLICY, type OverlapPolicy } from "../config/overlap";
import { createId } from "../id";
import { getByPath, setByPath } from "../path";
import {
  assetKindForSlot,
  clampTransitionFrames,
  createAnimation,
  createEffect,
  getCaptionStyle,
  getItemType,
  getSceneType,
  requireItemType,
  requireSceneType,
  requireTransition,
  trackAccepts,
} from "../registry/index";
import { createTrack } from "../schema/factory";
import {
  itemEndFrame,
  type Doc,
  type Item,
  type Keyframe,
  type Marker,
  type Mask,
  type Mockup,
  type Track,
} from "../schema/project";
import { assertFps, clampFrame } from "../time";

/**
 * Timeline ke saare named ops.
 *
 * **Locked decision (Section E #3):** doc ki har mutation yahin se hoti hai. UI
 * seedha doc nahi badalta. Iske bina teen cheezein ek saath toot jaati hain —
 * undo/redo, AI ke patches, aur templates. Ek jagah likhne se teeno ek jaise chalte hain.
 *
 * Har op do roop me milta hai:
 *  - `moveItem(doc, args)` -> naya doc (pure, purana doc chhua nahi jaata)
 *  - `moveItem.recipe(draft, args)` -> seedha draft par
 * Doosre roop ki wajah se `history.ts` `produceWithPatches` se patches nikal
 * paata hai. Ek hi jagah likha hua code, do tarah se chalta hai — isliye undo
 * aur normal edit kabhi alag behave nahi karte.
 *
 * **Keyframe ka frame item-local hai** (0 = item ka apna start), absolute timeline
 * frame nahi. Isliye clip sarkane se uski animation nahi sarakti — aur split /
 * trim ko keyframes shift karne padte hain, jo neeche kiya gaya hai.
 */

export class TimelineOpError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimelineOpError";
  }
}

export type DocDraft = Draft<Doc>;

export interface Op<A> {
  (doc: Doc, args: A): Doc;
  /** History / store ke liye — draft par seedha chalta hai. */
  recipe(draft: DocDraft, args: A): void;
  opName: string;
}

function defineOp<A>(opName: string, recipe: (draft: DocDraft, args: A) => void): Op<A> {
  const fn = ((doc: Doc, args: A): Doc =>
    produce(doc, (draft) => {
      recipe(draft, args);
    })) as Op<A>;
  fn.recipe = recipe;
  fn.opName = opName;
  return fn;
}

// ------------------------------------------------------------------ helpers

function findItemIndex(draft: DocDraft, itemId: string): number {
  const index = draft.items.findIndex((item) => item.id === itemId);
  if (index === -1) throw new TimelineOpError(`Item "${itemId}" nahi mila`);
  return index;
}

function findItem(draft: DocDraft, itemId: string): Draft<Item> {
  return draft.items[findItemIndex(draft, itemId)] as Draft<Item>;
}

function findTrack(draft: DocDraft, trackId: string): Draft<Track> {
  const track = draft.tracks.find((t) => t.id === trackId);
  if (!track) throw new TimelineOpError(`Track "${trackId}" nahi mila`);
  return track;
}

function assertUnlocked(item: Draft<Item>): void {
  if (item.locked) throw new TimelineOpError(`Item "${item.name}" locked hai`);
}

/** Item ko uske scene ki itemIds list me daalo (agar scene set hai). */
function attachToScene(draft: DocDraft, item: Draft<Item>, afterItemId?: string): void {
  if (item.sceneId === null) return;
  const scene = draft.scenes.find((s) => s.id === item.sceneId);
  if (!scene) throw new TimelineOpError(`Scene "${item.sceneId}" nahi mila`);
  if (scene.itemIds.includes(item.id)) return;

  const at = afterItemId ? scene.itemIds.indexOf(afterItemId) : -1;
  if (at === -1) scene.itemIds.push(item.id);
  else scene.itemIds.splice(at + 1, 0, item.id);
}

function detachFromScenes(draft: DocDraft, itemId: string): void {
  for (const scene of draft.scenes) {
    const at = scene.itemIds.indexOf(itemId);
    if (at !== -1) scene.itemIds.splice(at, 1);
  }
}

/**
 * Project ki lambai **badhao** agar koi item bahar nikal gaya ho.
 *
 * Chhota jaan-boojhkar nahi karte — user ne aage khaali jagah chhodi ho to har
 * chhoti edit us jagah ko kha jaati. Exact recompute ke liye `recomputeDuration` hai.
 */
function growDuration(draft: DocDraft): void {
  let end = draft.project.durationInFrames;
  for (const item of draft.items) end = Math.max(end, itemEndFrame(item));
  draft.project.durationInFrames = Math.max(1, end);
}

function shiftKeyframes(
  keyframes: Record<string, Keyframe[]>,
  shift: number,
  keep: (frame: number) => boolean,
): Record<string, Keyframe[]> {
  const out: Record<string, Keyframe[]> = {};
  for (const [path, list] of Object.entries(keyframes)) {
    const moved = list
      .filter((kf) => keep(kf.frame))
      .map((kf) => ({ ...kf, frame: Math.max(0, kf.frame + shift) }));
    if (moved.length > 0) out[path] = moved;
  }
  return out;
}

/**
 * Keyframes ko ek cut par kaato — **aur kinare par value ko jamaa do** (13.6).
 *
 * ⚠️ Ye function ek asli bug ke baad likha gaya, aur wo bug test se pakda gaya.
 * Pehle split/trim sirf keyframes **chhaante aur khiskate** the. Uska nateeja ye
 * hota tha:
 *
 *   keyframes: local 0 par 1.0, local 100 par 2.0
 *   frame 50 par split
 *   -> daayan tukda: sirf ek keyframe (local 50 par 2.0)
 *   -> uske pehle wala poora hissa "hold-first" par chala jaata, yaani 2.0
 *
 * Yaani cut se theek pehle value 1.81 thi aur cut ke turant baad 2.0 —
 * animation ek **jhatka** khaati thi. Ye aankh se dikhta hai par sirf tab jab
 * dhyan se dekho, aur render ke baad theek karna bahut mehnga hota hai.
 *
 * Isliye ab cut ke bindu par ek keyframe **banaya** jaata hai jiski value wahi
 * hoti hai jo us frame par thi. Dono taraf ki value jud'ti hai, jhatka khatam.
 */
/**
 * Cut se theek pehle wale keyframe ka easing.
 *
 * `findLast` yahan nahi use kiya — wo naye TS lib target maangta hai, aur is
 * package ka target jaan-boojhkar purana rakha gaya hai (wahi code worker aur
 * browser dono me chalta hai).
 */
function easingBefore(list: readonly Keyframe[], at: number): string {
  const sorted = [...list].sort((a, b) => a.frame - b.frame);
  let easing = (sorted[0] as Keyframe).easing;
  for (const keyframe of sorted) {
    if (keyframe.frame >= at) break;
    easing = keyframe.easing;
  }
  return easing;
}

function cutKeyframes(
  keyframes: Record<string, Keyframe[]>,
  args: {
    /** Item-local frame jahan kaatna hai. */
    at: number;
    /** `"before"` = is frame se pehle wala hissa rakho; `"after"` = baad wala. */
    side: "before" | "after";
  },
): Record<string, Keyframe[]> {
  const out: Record<string, Keyframe[]> = {};

  for (const [path, list] of Object.entries(keyframes)) {
    if (list.length === 0) continue;

    const sorted = [...list].sort((a, b) => a.frame - b.frame);

    // Cut ke theek us frame par value kya thi — yahi jamaani hai.
    const boundary = sampleKeyframes({ [path]: sorted }, path, args.at);
    const exact = sorted.find((kf) => kf.frame === args.at);

    /*
     * Cut jis segment ke beech me pada, uska curve **do me tod** kar dono
     * tarafon ko dena padta hai.
     *
     * ⚠️ Ye doosri asli galti thi (pehli upar likhi hai). Boundary keyframe bana
     * dene ke baad bhi value alag aa rahi thi — kyunki dono aadhon par wahi
     * purana easing dobara lag raha tha. Ek ease-in-out ke do aadhe ease-in-out
     * nahi hote; dobara lagane se cut ke aas-paas raftaar badal jaati hai.
     * `splitEasing` curve ko sach me todta hai, isliye split ke pehle aur baad
     * ki animation frame-dar-frame ek jaisi rehti hai.
     */
    let prev: Keyframe | null = null;
    let next: Keyframe | null = null;
    for (const kf of sorted) {
      if (kf.frame < args.at) prev = kf;
      else if (kf.frame > args.at && next === null) next = kf;
    }
    const halves =
      prev && next && next.frame > prev.frame
        ? splitEasing(prev.easing, prev.bezier, (args.at - prev.frame) / (next.frame - prev.frame))
        : null;

    if (args.side === "before") {
      const kept = sorted.filter((kf) => kf.frame < args.at).map((kf) => ({ ...kf }));
      // Aakhri bacha keyframe ab poora curve nahi, uska baayan aadha chalata hai.
      const last = kept[kept.length - 1];
      if (last && halves) applyBezier(last, halves.left);

      if (kept.length > 0 || exact) {
        kept.push(
          exact
            ? { ...exact }
            : {
                frame: args.at,
                value: boundary,
                // Aakhri keyframe ka easing aage kisi kaam ka nahi (uske baad
                // kuch hai hi nahi), par kuch to hona chahiye.
                easing: (sorted[sorted.length - 1] as Keyframe).easing,
                bezier: null,
              },
        );
      }
      if (kept.length > 0) out[path] = kept;
      continue;
    }

    const kept = sorted
      .filter((kf) => kf.frame > args.at)
      .map((kf) => ({ ...kf, frame: kf.frame - args.at }));

    if (kept.length > 0 || exact) {
      const head: Keyframe = exact
        ? { ...exact, frame: 0 }
        : {
            frame: 0,
            value: boundary,
            // Curve ka daayan aadha yahan se aage chalta hai.
            easing: easingBefore(sorted, args.at),
            bezier: null,
          };
      if (!exact && halves) applyBezier(head, halves.right);
      kept.unshift(head);
    }
    if (kept.length > 0) out[path] = kept;
  }
  return out;
}

/**
 * Keyframe par toda hua curve chipka do.
 *
 * `bezier` chalta hai aur `easing` ka naam bhi wahi likh dete hain — taaki
 * properties panel me jo dikhe wahi sach ho, aur dono kabhi alag na padein.
 */
function applyBezier(keyframe: Keyframe, bezier: [number, number, number, number]): void {
  const round = (n: number) => Math.round(n * 1000) / 1000;
  keyframe.bezier = [round(bezier[0]), round(bezier[1]), round(bezier[2]), round(bezier[3])];
  keyframe.easing = `cubic-bezier(${keyframe.bezier.join(", ")})`;
}

/** Deep copy — draft ke andar se plain object nikaalne ka seedha tarika. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

// -------------------------------------------------------------------- items

export interface AddItemArgs {
  item: Item;
  /** Item par set nahi hai to yahan do. */
  trackId?: string;
  startFrame?: number;
}

export const addItem = defineOp<AddItemArgs>("addItem", (draft, args) => {
  const trackId = args.trackId ?? args.item.trackId;
  if (!trackId) throw new TimelineOpError("addItem: trackId chahiye");
  const track = findTrack(draft, trackId);

  if (!trackAccepts(track.type, args.item.type)) {
    throw new TimelineOpError(
      `Track "${track.name}" (${track.type}) par "${args.item.type}" item nahi rakha ja sakta`,
    );
  }
  if (draft.items.some((existing) => existing.id === args.item.id)) {
    throw new TimelineOpError(`Item id "${args.item.id}" pehle se maujood hai`);
  }

  const item = clone(args.item);
  item.trackId = trackId;
  item.startFrame = Math.max(0, Math.round(args.startFrame ?? args.item.startFrame));

  draft.items.push(item as Draft<Item>);
  attachToScene(draft, draft.items[draft.items.length - 1] as Draft<Item>);
  growDuration(draft);
});

export interface MoveItemArgs {
  itemId: string;
  startFrame: number;
  trackId?: string;
}

export const moveItem = defineOp<MoveItemArgs>("moveItem", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);

  if (args.trackId !== undefined && args.trackId !== item.trackId) {
    const track = findTrack(draft, args.trackId);
    if (!trackAccepts(track.type, item.type)) {
      throw new TimelineOpError(
        `Track "${track.name}" (${track.type}) par "${item.type}" item nahi rakha ja sakta`,
      );
    }
    item.trackId = args.trackId;
  }

  item.startFrame = Math.max(0, Math.round(args.startFrame));
  growDuration(draft);
});

export interface TrimArgs {
  itemId: string;
  /**
   * Kinara kitne frames **daayen** khiske — dono trims me matlab ek hi hai.
   *  - trimItemStart: positive = clip chhota (baayan kinara andar)
   *  - trimItemEnd:   positive = clip bada  (daayan kinara bahar)
   */
  deltaFrames: number;
  /**
   * Source ki apni lambai (frames me, project ke fps par) — video/audio ke liye.
   *
   * Image ka koi ant nahi hota, isliye wahan ye chhod dena hi sahi hai. Iske
   * bina clip source ke aage tak khinch jaati hai aur render me wahan **kaala
   * frame** aata hai — jo timeline me bilkul theek dikhta hai aur sirf final
   * MP4 me pakda jaata hai. Ye number `reel_assets.duration_ms` se banta hai.
   */
  sourceDurationFrames?: number | null;
}

/**
 * Baayan kinara khiskao — **non-destructive**: source ke andar `trimStartFrame`
 * badalta hai, file ko kabhi haath nahi lagta.
 */
export const trimItemStart = defineOp<TrimArgs>("trimItemStart", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);

  const rate = item.playbackRate;
  // Teen deewaarein: clip me kam se kam 1 frame bache, source se pehle na jaayein,
  // aur timeline par 0 se peeche na jaayein.
  const maxDelta = item.durationInFrames - 1;
  const minDelta = Math.max(-item.startFrame, -Math.floor(item.trimStartFrame / rate));

  const delta = clampFrame(args.deltaFrames, Math.min(minDelta, maxDelta), maxDelta);
  if (delta === 0) return;

  item.startFrame += delta;
  item.durationInFrames -= delta;
  item.trimStartFrame = Math.max(0, item.trimStartFrame + Math.round(delta * rate));

  /*
   * Keyframes item-local hain, isliye unhe bhi utna hi khiskana padta hai — par
   * `cutKeyframes` se, sirf shift se nahi. Sirf shift karne par kinare se bahar
   * gaye keyframes 0 par jam jaate the aur clip ki shuruaati value achanak
   * badal jaati thi (upar `cutKeyframes` ka ⚠️ dekho).
   *
   * Clip ko lamba karne par (delta negative) kaatne ko kuch hai hi nahi — wahan
   * seedha shift sahi hai, aur pehle keyframe se pehle value waise bhi rukti hai.
   */
  item.keyframes =
    delta > 0
      ? cutKeyframes(clone(item.keyframes), { at: delta, side: "after" })
      : shiftKeyframes(clone(item.keyframes), -delta, () => true);
});

/**
 * Daayan kinara khiskao — sirf timeline par lambai badalti hai.
 *
 * Do hadd: kam se kam 1 frame, aur **source ke ant se aage nahi** (8.3). Doosri
 * hadd tabhi lagti hai jab caller `sourceDurationFrames` deta hai — image ke
 * liye wo hota hi nahi, aur wahan clip jitni marzi lambi ho sakti hai.
 *
 * Source me bacha hua maal `playbackRate` se bata hai: 2x speed par source ke
 * 60 frames timeline par sirf 30 frames bhar te hain.
 */
export const trimItemEnd = defineOp<TrimArgs>("trimItemEnd", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);

  let next = Math.max(1, item.durationInFrames + Math.round(args.deltaFrames));

  const source = args.sourceDurationFrames;
  if (source !== undefined && source !== null && source > 0) {
    const left = Math.floor((source - item.trimStartFrame) / item.playbackRate);
    next = Math.max(1, Math.min(next, left));
  }

  /*
   * Chhota karne par clip ke bahar chale gaye keyframes bhi sambhalne padte
   * hain — warna wo doc me pade rehte hain aur clip dobara lambi karne par
   * achanak wapas aa jaate hain. `cutKeyframes` unhe hata deta hai aur naye
   * kinare par wahi value jamaa deta hai jo wahan thi.
   */
  if (next < item.durationInFrames) {
    item.keyframes = cutKeyframes(clone(item.keyframes), { at: next, side: "before" });
  }

  item.durationInFrames = next;
  growDuration(draft);
});

export interface SplitArgs {
  itemId: string;
  /** Absolute timeline frame. Item ke andar hona chahiye (dono kinare chhodkar). */
  frame: number;
}

/**
 * Ek item ko do me todo.
 *
 * Frame math ka vaada (check script isse sach me naapta hai):
 *  - `left.duration + right.duration === original.duration` — na ek frame kam na zyada
 *  - `right.startFrame === left.startFrame + left.duration` — koi gap ya overlap nahi
 *  - `right.trimStartFrame === original.trimStartFrame + round(left.duration * playbackRate)`
 *    yaani dono aadhe source ka sahi hissa dikhate hain
 */
export const splitItemAtFrame = defineOp<SplitArgs>("splitItemAtFrame", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);

  const frame = Math.round(args.frame);
  if (frame <= item.startFrame || frame >= itemEndFrame(item)) {
    throw new TimelineOpError(
      `Split frame ${frame} item ke andar nahi hai (${item.startFrame}-${itemEndFrame(item)}, kinare shaamil nahi)`,
    );
  }
  splitOne(draft, item, frame);
});

/** Ek item ko diye gaye frame par todo. Dono split ops isi ko bulate hain. */
function splitOne(draft: DocDraft, item: Draft<Item>, frame: number): void {
  const start = item.startFrame;
  const end = itemEndFrame(item);

  const leftDuration = frame - start;
  const rightDuration = end - frame;
  const sourceOffset = Math.round(leftDuration * item.playbackRate);
  const originalKeyframes = clone(item.keyframes);

  const right = clone(item) as Item;
  right.id = createId("it");
  right.startFrame = frame;
  right.durationInFrames = rightDuration;
  right.trimStartFrame = item.trimStartFrame + sourceOffset;
  // Beech me transition nahi aani chahiye — wo cut ab andar wala cut hai.
  right.transitionIn = { type: "none", durationInFrames: 0 };
  right.keyframes = cutKeyframes(originalKeyframes, { at: leftDuration, side: "after" });

  item.durationInFrames = leftDuration;
  item.transitionOut = { type: "none", durationInFrames: 0 };
  item.keyframes = cutKeyframes(originalKeyframes, { at: leftDuration, side: "before" });

  const at = findItemIndex(draft, item.id);
  draft.items.splice(at + 1, 0, right as Draft<Item>);
  attachToScene(draft, draft.items[at + 1] as Draft<Item>, item.id);
}

export interface SplitAtFrameArgs {
  /** Absolute timeline frame — aam taur par playhead. */
  frame: number;
  /**
   * Sirf inhi items par chalo. Khaali/undefined = frame ke neeche padi **har**
   * clip par (locked ko chhod kar).
   */
  itemIds?: readonly string[];
}

/**
 * Playhead par sab kuch ek saath todo (8.4).
 *
 * Ye alag op isliye hai ki **undo ek hi baar me** ho. Har clip par
 * `splitItemAtFrame` chalane se 5 clips ke liye 5 undo entries banti hain, aur
 * user ko 5 baar Ctrl+Z dabana padta — jabki uske liye wo ek hi kaam tha.
 *
 * ⚠️ Locked clips chhod di jaati hain, error nahi aata. Playhead par S dabana ek
 * moti chhuri hai; usme se ek locked clip ki wajah se poora kaam rok dena galat
 * hoga — lock ka matlab "isko mat chhedo" hai, "kuch mat karo" nahi.
 */
export const splitAtFrame = defineOp<SplitAtFrameArgs>("splitAtFrame", (draft, args) => {
  const frame = Math.round(args.frame);
  const only = args.itemIds && args.itemIds.length > 0 ? new Set(args.itemIds) : null;

  // Pehle list bana lo — split ke dauraan `draft.items` me naye items judte hain.
  const targets = draft.items.filter(
    (item) =>
      !item.locked &&
      (!only || only.has(item.id)) &&
      frame > item.startFrame &&
      frame < itemEndFrame(item),
  );

  if (targets.length === 0) {
    throw new TimelineOpError(`Frame ${frame} par todne layak koi clip nahi hai`);
  }
  for (const item of targets) splitOne(draft, item, frame);
});

export interface DeleteItemsArgs {
  itemIds: readonly string[];
}

export const deleteItems = defineOp<DeleteItemsArgs>("deleteItems", (draft, args) => {
  const ids = new Set(args.itemIds);
  const locked = draft.items.filter((item) => ids.has(item.id) && item.locked);
  if (locked.length > 0) {
    throw new TimelineOpError(
      `Ye items locked hain: ${locked.map((item) => item.name).join(", ")}`,
    );
  }
  draft.items = draft.items.filter((item) => !ids.has(item.id));
  for (const id of ids) detachFromScenes(draft, id);
});

export interface DuplicateItemsArgs {
  itemIds: readonly string[];
  /** Copy kitne frames aage rakhi jaaye. Default: apni hi lambai jitna (bilkul peeche). */
  offsetFrames?: number;
}

export const duplicateItems = defineOp<DuplicateItemsArgs>("duplicateItems", (draft, args) => {
  for (const id of args.itemIds) {
    const source = findItem(draft, id);
    const copy = clone(source) as Item;
    copy.id = createId("it");
    copy.startFrame = source.startFrame + (args.offsetFrames ?? source.durationInFrames);
    copy.locked = false;

    const at = findItemIndex(draft, source.id);
    draft.items.splice(at + 1, 0, copy as Draft<Item>);
    attachToScene(draft, draft.items[at + 1] as Draft<Item>, source.id);
  }
  growDuration(draft);
});

/** Ye fields sirf apne dedicated op se badalte hain — warna invariants toot jaate hain. */
const PROTECTED_PATHS = new Set([
  "id",
  "type",
  "trackId",
  "startFrame",
  "durationInFrames",
  "trimStartFrame",
]);

export interface SetItemPropertyArgs {
  itemId: string;
  /** `"transform.scale"`, `"audio.volume"`, `"text.content"` … */
  path: string;
  value: unknown;
}

/**
 * Koi bhi property path se set karo.
 *
 * Yahi ek op poore properties panel ko chalata hai — har property ke liye alag op
 * likhne ki zaroorat nahi, isliye nayi property apne aap editable ban jaati hai.
 */
export const setItemProperty = defineOp<SetItemPropertyArgs>("setItemProperty", (draft, args) => {
  const item = findItem(draft, args.itemId);
  const root = args.path.split(".")[0] as string;
  if (PROTECTED_PATHS.has(args.path) || PROTECTED_PATHS.has(root)) {
    throw new TimelineOpError(
      `"${args.path}" seedhe set nahi hota — iske liye apna op hai (move/trim/split)`,
    );
  }
  setByPath(item, args.path, args.value);
});

export interface SetItemsPropertyArgs {
  itemIds: readonly string[];
  path: string;
  value: unknown;
}

/**
 * Ek hi property kai items par — **ek undo entry** (9.5).
 *
 * Multi-select me har item par alag `setItemProperty` chalane se paanch clips ka
 * rang badalne par paanch baar Ctrl+Z dabana padta hai, aur user ke liye wo ek
 * hi kaam tha. Isliye loop op ke **andar** hai, UI me nahi.
 *
 * ⚠️ Jis item par ye property hai hi nahi (jaise `text.color` kisi image par) wo
 * chhod diya jaata hai, error nahi aata. Mixed selection me ek hi common control
 * dikhta hai; uspar likhne par baaki items ko chhedna hi nahi chahiye.
 */
export const setItemsProperty = defineOp<SetItemsPropertyArgs>(
  "setItemsProperty",
  (draft, args) => {
    const root = args.path.split(".")[0] as string;
    if (PROTECTED_PATHS.has(args.path) || PROTECTED_PATHS.has(root)) {
      throw new TimelineOpError(
        `"${args.path}" seedhe set nahi hota — iske liye apna op hai (move/trim/split)`,
      );
    }

    const ids = new Set(args.itemIds);
    const parentPath = args.path.slice(0, args.path.lastIndexOf("."));

    for (const item of draft.items) {
      if (!ids.has(item.id)) continue;
      if (item.locked) continue;

      /*
       * ⚠️ Yahan **parent** dekha jaata hai, root nahi — aur ye ek asli bug
       * theek karne ke baad likha gaya hai.
       *
       * Pehle sirf root (`text`) ki jaanch thi, aur `undefined` se compare hota
       * tha. Image par `text` `null` hota hai, `undefined` nahi — isliye jaanch
       * paas ho jaati thi aur `setByPath` image par `text: { color: "..." }`
       * bana deta tha. Wo item schema ke hisaab se toota hua hota hai (baaki
       * saari text fields gayab), aur ye galti save hone ke baad hi pakdi jaati.
       *
       * Parent dekhne se teeno case sahi baithte hain:
       *   `text.color`        image par  -> parent `text` null    -> chhod do
       *   `text.stroke`       text par   -> parent `text` object  -> lagao
       *   `text.stroke.width` bina stroke -> parent null          -> chhod do
       */
      if (parentPath) {
        const parent = getByPath(item, parentPath);
        if (parent === null || parent === undefined) continue;
      }
      setByPath(item, args.path, args.value);
    }
  },
);

export interface AutoFitPatchArgs {
  /** UI har item ka source naap jaanta hai, isliye patch wahin banta hai. */
  patches: readonly {
    itemId: string;
    mode: string;
    /** `null` = scale ko haath mat lagao ("Center" aisa hi karta hai). */
    scale: number | null;
    x: number;
    y: number;
  }[];
}

/**
 * Auto-fit buttons ka nateeja lagao (9.6b) — **ek undo entry me**.
 *
 * "Fill frame" ek button hai par chaar property badalta hai (fit mode, scale, x,
 * y). Chaar alag `setItemProperty` chalane se chaar undo entries banti hain aur
 * Ctrl+Z aadha fit chhod deta hai — jo poore fit se bhi bura dikhta hai.
 *
 * ⚠️ Patch **UI banata hai, op nahi**. Wajah: patch ke liye source ka pixel naap
 * chahiye (`AUTO_FIT_ACTIONS[].apply(source, frame)`), aur wo `reel_assets` me
 * hai — doc me nahi. Op ko DB ka pata nahi hona chahiye.
 */
export const applyAutoFit = defineOp<AutoFitPatchArgs>("applyAutoFit", (draft, args) => {
  for (const patch of args.patches) {
    const item = findItem(draft, patch.itemId);
    if (item.locked) continue;

    item.fit.mode = patch.mode as typeof item.fit.mode;
    item.transform.x = patch.x;
    item.transform.y = patch.y;
    if (patch.scale !== null && Number.isFinite(patch.scale) && patch.scale > 0) {
      item.transform.scale = patch.scale;
    }
  }
});

export interface SetProjectSizeArgs {
  width: number;
  height: number;
  sizePresetId?: string;
  /**
   * `true` = items ko naye frame ke hisaab se dobara set karo (scale + position
   * proportionally). `false` = sirf frame badlo, items waise ke waise.
   */
  refit?: boolean;
}

/**
 * Project ka naap badlo (9.13).
 *
 * ⚠️ `refit` ek **maang** hai, default nahi. Chupchaap sab kuch re-fit kar dena
 * sabse bura hota: user ne shayad ghanton lagakar har clip ki jagah tay ki ho.
 * UI pehle poochhta hai, phir yahan flag aata hai.
 *
 * Re-fit ka ganit seedha hai aur jaan-boojhkar seedha rakha gaya hai: position
 * frame ke naap ke anupaat me khisakti hai, aur scale chhote wale anupaat se
 * badalti hai (taaki clip frame se bahar na nikal jaaye). Poora safe-area aware
 * re-layout Phase 20 ka kaam hai.
 */
export const setProjectSize = defineOp<SetProjectSizeArgs>("setProjectSize", (draft, args) => {
  const width = Math.round(args.width);
  const height = Math.round(args.height);
  if (width < 2 || height < 2) throw new TimelineOpError(`Naap bahut chhota hai (${width}x${height})`);

  const oldWidth = draft.project.width;
  const oldHeight = draft.project.height;

  draft.project.width = width;
  draft.project.height = height;
  if (args.sizePresetId !== undefined) draft.project.sizePresetId = args.sizePresetId;

  if (!args.refit) return;
  if (oldWidth === width && oldHeight === height) return;

  const ratioX = width / oldWidth;
  const ratioY = height / oldHeight;
  const scaleRatio = Math.min(ratioX, ratioY);

  for (const item of draft.items) {
    if (item.locked) continue;
    item.transform.x *= ratioX;
    item.transform.y *= ratioY;
    item.transform.scale *= scaleRatio;
  }
});

export interface SetProjectFpsArgs {
  fps: number;
  /**
   * `true` = saare frames ko naye fps par convert karo, taaki har clip ka waqt
   * (seconds me) waisa hi rahe.
   */
  rescaleItems?: boolean;
}

/**
 * fps badlo (9.13).
 *
 * ⚠️ `rescaleItems` ke bina fps badalna poori reel ki **timing badal deta hai**:
 * 30fps ke 90 frames 3 second hain, 60fps par wahi 90 frames 1.5 second ho jaate
 * hain. Isliye UI ye baat saaf poochhta hai — chupchaap dono me se koi bhi
 * chunna galat hai, kyunki dono kabhi-kabhi sahi hote hain.
 */
export const setProjectFps = defineOp<SetProjectFpsArgs>("setProjectFps", (draft, args) => {
  const fps = args.fps;
  assertFps(fps);

  const oldFps = draft.project.fps;
  draft.project.fps = fps;
  if (!args.rescaleItems || oldFps === fps) return;

  const scale = fps / oldFps;
  const convert = (frames: number): number => Math.round(frames * scale);

  draft.project.durationInFrames = Math.max(1, convert(draft.project.durationInFrames));
  for (const item of draft.items) {
    item.startFrame = Math.max(0, convert(item.startFrame));
    item.durationInFrames = Math.max(1, convert(item.durationInFrames));
    item.trimStartFrame = Math.max(0, convert(item.trimStartFrame));
    item.audio.fadeInFrames = Math.max(0, convert(item.audio.fadeInFrames));
    item.audio.fadeOutFrames = Math.max(0, convert(item.audio.fadeOutFrames));
    item.keyframes = shiftKeyframes(
      Object.fromEntries(
        Object.entries(clone(item.keyframes)).map(([path, list]) => [
          path,
          list.map((kf) => ({ ...kf, frame: convert(kf.frame) })),
        ]),
      ),
      0,
      () => true,
    );
  }
});

// ------------------------------------------------------------------- tracks

export interface AddTrackArgs {
  /** Ya to poora track do… */
  track?: Track;
  /** …ya sirf type, aur factory bana degi. */
  typeId?: string;
  name?: string;
  /** Kis position par — default sabse neeche. */
  order?: number;
}

export const addTrack = defineOp<AddTrackArgs>("addTrack", (draft, args) => {
  if (!args.track && !args.typeId) {
    throw new TimelineOpError("addTrack: track ya typeId me se ek chahiye");
  }
  const maxOrder = draft.tracks.reduce((max, track) => Math.max(max, track.order), -1);
  const track =
    args.track ??
    createTrack(args.typeId as string, {
      ...(args.name === undefined ? {} : { name: args.name }),
      order: args.order ?? maxOrder + 1,
    });

  if (draft.tracks.some((existing) => existing.id === track.id)) {
    throw new TimelineOpError(`Track id "${track.id}" pehle se maujood hai`);
  }
  draft.tracks.push(clone(track) as Draft<Track>);
});

export interface RemoveTrackArgs {
  trackId: string;
  /**
   * Track par items hain to kya karein. Kuch na do to saaf error milta hai —
   * chupchaap kisi ka kaam mita dena sabse buri baat hai.
   *
   *  - `"delete"` — items bhi jaayenge
   *  - `"move"`   — items kisi doosri **maanne wali** track par chale jaayenge
   *
   * `withItems: true` purane callers ke liye hai aur `"delete"` jaisa hi hai.
   */
  items?: "delete" | "move";
  withItems?: boolean;
}

export const removeTrack = defineOp<RemoveTrackArgs>("removeTrack", (draft, args) => {
  const track = findTrack(draft, args.trackId);
  const onTrack = draft.items.filter((item) => item.trackId === args.trackId);

  const mode = args.items ?? (args.withItems ? "delete" : undefined);

  if (onTrack.length > 0 && !mode) {
    throw new TimelineOpError(
      `Track par ${onTrack.length} item hain. Hataana hi hai to items: "delete" ya "move" do.`,
    );
  }

  if (mode === "move" && onTrack.length > 0) {
    /*
     * Items ko kis track par bhejein — **koi bhi** nahi, sirf wo jo unhe leti ho.
     * Text ko audio track par daal dena schema to pass kar jaata hai par render
     * me wo item kabhi dikhta hi nahi, aur user ko lagta hai ki wo mit gaya.
     *
     * Sabse paas wali maanne wali track chunte hain (upar-neeche dono taraf
     * dekh kar), taaki layer ka kram kam se kam hile.
     */
    const others = draft.tracks
      .filter((entry) => entry.id !== track.id)
      .sort((a, b) => Math.abs(a.order - track.order) - Math.abs(b.order - track.order));

    for (const item of onTrack) {
      const target = others.find((entry) => trackAccepts(entry.type, item.type));
      if (!target) {
        throw new TimelineOpError(
          `"${item.name}" ko lene wali koi doosri track nahi hai. Pehle ek ${item.type} track banao.`,
        );
      }
      item.trackId = target.id;
    }
    draft.tracks = draft.tracks.filter((entry) => entry.id !== args.trackId);
    return;
  }

  for (const item of onTrack) detachFromScenes(draft, item.id);
  draft.items = draft.items.filter((item) => item.trackId !== args.trackId);
  draft.tracks = draft.tracks.filter((entry) => entry.id !== args.trackId);
});

export interface ReorderTracksArgs {
  /** Naya order, upar se neeche. Saare maujooda track ids hone chahiye. */
  trackIds: readonly string[];
}

export const reorderTracks = defineOp<ReorderTracksArgs>("reorderTracks", (draft, args) => {
  if (args.trackIds.length !== draft.tracks.length) {
    throw new TimelineOpError(
      `reorderTracks: ${draft.tracks.length} tracks hain par ${args.trackIds.length} ids mile`,
    );
  }
  const known = new Set(draft.tracks.map((track) => track.id));
  for (const id of args.trackIds) {
    if (!known.has(id)) throw new TimelineOpError(`Track "${id}" nahi mila`);
  }
  args.trackIds.forEach((id, index) => {
    const track = draft.tracks.find((t) => t.id === id) as Draft<Track>;
    track.order = index;
  });
  draft.tracks.sort((a, b) => a.order - b.order);
});

// ------------------------------------------------------------------ project

/**
 * Project ki lambai ko items ke hisaab se **exact** kar do (chhoti bhi ho sakti hai).
 * Ye jaan-boojhkar alag op hai — apne aap chalne se aage ki khaali jagah gayab ho jaati.
 */
export const recomputeDuration = defineOp<void>("recomputeDuration", (draft) => {
  let end = 0;
  for (const item of draft.items) end = Math.max(end, itemEndFrame(item));
  draft.project.durationInFrames = Math.max(1, end);
});

/**
 * Project settings ki koi bhi property path se set karo (`name`, `background`…).
 *
 * Rename bhi yahi op hai — na list page ke liye alag code, na editor ke liye.
 * Isi wajah se rename undo ho jaata hai aur autosave ko kuch alag nahi sikhana padta.
 */
const PROTECTED_PROJECT_PATHS = new Set([
  "id",
  // Size/fps badalna items ko re-fit karta hai (README 3B) — wo apna op maangta
  // hai, warna 16:9 se 9:16 karte hi poori reel chupchaap toot jaati.
  "sizePresetId",
  "width",
  "height",
  "fps",
  // Lambai ke apne op hain: growDuration (apne aap) aur recomputeDuration.
  "durationInFrames",
]);

export interface SetProjectPropertyArgs {
  /** `"name"`, `"background"` … */
  path: string;
  value: unknown;
}

export const setProjectProperty = defineOp<SetProjectPropertyArgs>(
  "setProjectProperty",
  (draft, args) => {
    const root = args.path.split(".")[0] as string;
    if (PROTECTED_PROJECT_PATHS.has(args.path) || PROTECTED_PROJECT_PATHS.has(root)) {
      throw new TimelineOpError(
        `project.${args.path} seedhe set nahi hota — iske liye apna op chahiye`,
      );
    }
    setByPath(draft.project, args.path, args.value);
  },
);

/** Track ki wo properties jo path se set nahi hoti — inke apne op hain. */
const PROTECTED_TRACK_PATHS = new Set(["id", "type", "order"]);

export interface SetTrackPropertyArgs {
  trackId: string;
  /** `"muted"`, `"hidden"`, `"locked"`, `"name"`. */
  path: string;
  value: unknown;
}

/**
 * Track ki koi property path se set karo — mute / hide / lock / rename.
 *
 * Ye op isliye chahiye ki UI seedha `track.muted = true` na likhe (Dynamic rule
 * 12). Mute ek chhoti si cheez lagti hai, par uska undo bhi utna hi chahiye
 * jitna kisi clip ko sarkane ka — aur bina op ke wo Ctrl+Z se wapas nahi aata.
 *
 * `order` yahan se nahi badalta: tracks ka kram ek dusre par nirbhar hai, isliye
 * uska apna `reorderTracks` hai jo poori list ek saath theek karta hai.
 */
export const setTrackProperty = defineOp<SetTrackPropertyArgs>(
  "setTrackProperty",
  (draft, args) => {
    const root = args.path.split(".")[0] as string;
    if (PROTECTED_TRACK_PATHS.has(args.path) || PROTECTED_TRACK_PATHS.has(root)) {
      throw new TimelineOpError(
        `track.${args.path} seedhe set nahi hota — iske liye apna op hai`,
      );
    }
    const track = findTrack(draft, args.trackId);
    setByPath(track, args.path, args.value);
  },
);

/* ==========================================================================
 * Phase 8 — range, multi-item aur overlap
 * ========================================================================== */

/**
 * **Ye is poore phase ka dil hai.** Timeline ke ek hisse ko khaali kar do.
 *
 * Cut selection, keep selection, aur "overwrite" wali overlap policy — teeno
 * asal me yahi ek cheez maangte hain: "in do frames ke beech ka maal hatao".
 * Teen jagah teen baar likhne par teeno alag tarah se galat hoti hain, aur sabse
 * buri baat ye ki galti ek frame ki hoti hai — jo dekh kar kabhi nahi dikhti,
 * sirf ginti se pakdi jaati hai.
 *
 * Ek clip is span se chaar tarah mil sakti hai, aur chaaron ka apna jawab hai:
 *
 *              from|=========|to
 *    (1)        |-----|                poora andar     -> mit gayi
 *    (2)   |------------------------|  poora dhak rahi -> do tukde
 *    (3)  |-------|                    daayan kinara   -> chhoti ho gayi
 *    (4)              |-----------|    baayan kinara   -> aage se shuru
 *
 * ⚠️ (4) me sirf `startFrame` badalna **galat** hota hai: clip aage se shuru
 * hogi par dikhayegi wahi purana hissa. Source ke andar ka pointer
 * (`trimStartFrame`) bhi utna hi aage jaana chahiye — aur wo `playbackRate` se
 * guna hota hai, warna 2x speed wali clip aadha hi khiskti hai.
 *
 * ⚠️ Locked clips ko haath nahi lagta. Lock ka matlab hi yahi hai ki koi doosra
 * op galti se use na chhede.
 */
function removeSpan(
  draft: DocDraft,
  args: {
    fromFrame: number;
    toFrame: number;
    /** Khaali/undefined = saare tracks. */
    trackIds?: ReadonlySet<string> | null;
    /** Ye items chhoo bhi nahi jaate (overwrite me "jeetne wale"). */
    exceptIds?: ReadonlySet<string>;
  },
): void {
  const from = Math.round(args.fromFrame);
  const to = Math.round(args.toFrame);
  if (to <= from) return;

  const except = args.exceptIds ?? new Set<string>();
  const tracks = args.trackIds ?? null;

  const removed: string[] = [];
  const added: Item[] = [];

  for (const item of draft.items) {
    if (except.has(item.id)) continue;
    if (tracks && !tracks.has(item.trackId)) continue;
    if (item.locked) continue;

    const start = item.startFrame;
    const end = itemEndFrame(item);
    if (end <= from || start >= to) continue;

    // (1) poora andar
    if (start >= from && end <= to) {
      removed.push(item.id);
      continue;
    }

    // (2) poora dhak rahi — beech ka hissa nikaal kar do tukde
    if (start < from && end > to) {
      const leftDuration = from - start;
      const cutFromItemStart = to - start;
      const keyframes = clone(item.keyframes);

      const right = clone(item) as Item;
      right.id = createId("it");
      right.startFrame = to;
      right.durationInFrames = end - to;
      right.trimStartFrame = item.trimStartFrame + Math.round(cutFromItemStart * item.playbackRate);
      // Beech ka cut ab ek asli cut hai — uspar purani transition nahi chipkni chahiye.
      right.transitionIn = { type: "none", durationInFrames: 0 };
      right.keyframes = shiftKeyframes(keyframes, -cutFromItemStart, (f) => f >= cutFromItemStart);
      added.push(right);

      item.durationInFrames = leftDuration;
      item.transitionOut = { type: "none", durationInFrames: 0 };
      item.keyframes = shiftKeyframes(keyframes, 0, (f) => f <= leftDuration);
      continue;
    }

    // (3) daayan kinara kat gaya
    if (start < from) {
      item.durationInFrames = from - start;
      item.transitionOut = { type: "none", durationInFrames: 0 };
      item.keyframes = shiftKeyframes(clone(item.keyframes), 0, (f) => f <= item.durationInFrames);
      continue;
    }

    // (4) baayan kinara kat gaya
    const delta = to - start;
    item.startFrame = to;
    item.durationInFrames = end - to;
    item.trimStartFrame += Math.round(delta * item.playbackRate);
    item.transitionIn = { type: "none", durationInFrames: 0 };
    item.keyframes = shiftKeyframes(clone(item.keyframes), -delta, (f) => f >= delta);
  }

  if (removed.length > 0) {
    const ids = new Set(removed);
    draft.items = draft.items.filter((item) => !ids.has(item.id));
    for (const id of removed) detachFromScenes(draft, id);
  }

  for (const item of added) {
    draft.items.push(item as Draft<Item>);
    attachToScene(draft, draft.items[draft.items.length - 1] as Draft<Item>);
  }
}

/** `fromFrame` ya uske baad shuru hone wali har clip ko utna baayein le aao. */
function shiftItemsLeft(
  draft: DocDraft,
  args: { fromFrame: number; amount: number; trackIds?: ReadonlySet<string> | null },
): void {
  if (args.amount <= 0) return;
  const tracks = args.trackIds ?? null;

  for (const item of draft.items) {
    if (tracks && !tracks.has(item.trackId)) continue;
    if (item.locked) continue;
    if (item.startFrame < args.fromFrame) continue;
    item.startFrame = Math.max(0, item.startFrame - args.amount);
  }
}

/** Doc me sabse aakhri frame — "aage ka sab kuch" wale ops ke liye. */
function contentEnd(draft: DocDraft): number {
  let end = draft.project.durationInFrames;
  for (const item of draft.items) end = Math.max(end, itemEndFrame(item));
  return end;
}

/* -------------------------------------------------------- overlap policy */

/**
 * Ek track par overlap suljhao (8.9).
 *
 * `keepIds` wo clips hain jo abhi rakhi/khiskayi gayi hain — policy inke haq me
 * chalti hai:
 *  - **overwrite**: neeche wali clips me se utna hissa `removeSpan` se nikal
 *    jaata hai. Yahi wajah hai ki `removeSpan` ek alag helper hai.
 *  - **push**: neeche wali clips daayein khisak jaati hain, baayein-se-daayein
 *    ek-ek karke — isliye khiskne ke baad wo aapas me bhi nahi takraati.
 *  - **reject**: kuch nahi hota, seedha error — drop mana.
 */
function resolveOverlaps(
  draft: DocDraft,
  args: { trackId: string; keepIds: ReadonlySet<string>; policy: OverlapPolicy },
): void {
  const onTrack = draft.items.filter((item) => item.trackId === args.trackId);
  const keep = onTrack.filter((item) => args.keepIds.has(item.id));
  if (keep.length === 0) return;

  const others = onTrack
    .filter((item) => !args.keepIds.has(item.id))
    .sort((a, b) => a.startFrame - b.startFrame);

  const hits = (a: Draft<Item>, start: number, duration: number): boolean =>
    start < itemEndFrame(a) && start + duration > a.startFrame;

  if (args.policy === "reject") {
    for (const other of others) {
      for (const k of keep) {
        if (hits(k, other.startFrame, other.durationInFrames)) {
          throw new TimelineOpError(
            `"${k.name}" yahan nahi rakhi ja sakti — "${other.name}" pehle se hai (overlap policy: reject)`,
          );
        }
      }
    }
    return;
  }

  if (args.policy === "push") {
    let cursor = Number.NEGATIVE_INFINITY;
    for (const other of others) {
      let start = other.startFrame;
      for (const k of keep) {
        if (hits(k, start, other.durationInFrames)) start = itemEndFrame(k);
      }
      if (start < cursor) start = cursor;
      other.startFrame = Math.max(0, start);
      cursor = itemEndFrame(other);
    }
    return;
  }

  // overwrite
  const trackIds = new Set([args.trackId]);
  for (const k of keep) {
    removeSpan(draft, {
      fromFrame: k.startFrame,
      toFrame: itemEndFrame(k),
      trackIds,
      exceptIds: args.keepIds,
    });
  }
}

/* ---------------------------------------------------------- move (multi) */

export interface MoveItemsArgs {
  itemIds: readonly string[];
  /** Sab par ek hi delta — isi se aapas ki doori bani rehti hai (8.11). */
  deltaFrames: number;
  /** Track list (order se) me kitne row upar (-) ya neeche (+). */
  trackShift?: number;
  policy?: OverlapPolicy;
}

/**
 * Ek ya kai clips ko ek saath khiskao (8.1 / 8.10 / 8.11).
 *
 * ⚠️ Clamp **poore group par** lagta hai, har clip par alag nahi. Alag-alag
 * clamp karne se ye hota hai: baayein wali clip 0 par ruk jaati hai aur baaki
 * chalti rehti hain — yaani selection ki shakl hi badal jaati hai, aur user ne
 * aisa kabhi nahi kaha tha.
 *
 * ⚠️ Track badalna **sab ya kuch nahi** hai. Ek clip ka naya track use na le
 * paaye to poori move ruk jaati hai; aadha selection ek track par aur aadha
 * doosre par chhod dena sabse bura nateeja hota.
 */
export const moveItems = defineOp<MoveItemsArgs>("moveItems", (draft, args) => {
  if (args.itemIds.length === 0) return;

  const items = args.itemIds.map((id) => findItem(draft, id));
  for (const item of items) assertUnlocked(item);

  // Poore group par ek hi clamp — shakl waisi ki waisi.
  const minStart = Math.min(...items.map((item) => item.startFrame));
  const delta = Math.max(Math.round(args.deltaFrames), -minStart);

  const shift = Math.round(args.trackShift ?? 0);
  const ordered = [...draft.tracks].sort((a, b) => a.order - b.order);
  const indexOf = new Map(ordered.map((track, index) => [track.id, index]));

  // Pehle sab kuch jaanch lo, phir badlo. Beech me error phenkne par immer
  // wapas to kar deta hai, par uspar bharosa karke aadhi jaanch likhna aadat
  // kharaab karta hai — aur `recipe` seedha draft par bhi chalta hai (history).
  const targets = items.map((item) => {
    if (shift === 0) return item.trackId;
    const at = indexOf.get(item.trackId);
    if (at === undefined) throw new TimelineOpError(`Item "${item.name}" ka track nahi mila`);
    const next = ordered[Math.min(ordered.length - 1, Math.max(0, at + shift))];
    if (!next) throw new TimelineOpError("Track list khaali hai");
    if (!trackAccepts(next.type, item.type)) {
      throw new TimelineOpError(
        `"${item.name}" (${item.type}) track "${next.name}" (${next.type}) par nahi ja sakta`,
      );
    }
    return next.id;
  });

  const touched = new Set<string>();
  items.forEach((item, index) => {
    item.startFrame += delta;
    item.trackId = targets[index] as string;
    touched.add(item.trackId);
  });

  const keepIds = new Set(args.itemIds);
  const policy = args.policy ?? DEFAULT_OVERLAP_POLICY;
  for (const trackId of touched) resolveOverlaps(draft, { trackId, keepIds, policy });

  growDuration(draft);
});

/* ------------------------------------------------------- ripple delete */

export interface RippleDeleteArgs {
  itemIds: readonly string[];
  /**
   * `false` (default) = sirf usi track par aage wali clips khisken.
   * `true` = saare tracks par.
   */
  allTracks?: boolean;
}

/**
 * Delete karo **aur** peeche bacha hua gaddha bhar do (8.6).
 *
 * ⚠️ Jo clip gaddhe ke beecho-beech padi ho (start gaddhe se pehle, ant uske
 * baad) use **chhua nahi jaata**. Ye sirf `allTracks: true` me ho sakta hai, aur
 * wahan usko kaat dena ek chupchaap hone wala data-loss hota: user ne to sirf
 * doosre track ki ek clip delete ki thi. Poora hissa hataana ho to `cutRange`
 * hai, jo ye kaam saaf-saaf, maang kar karta hai.
 */
export const rippleDeleteItems = defineOp<RippleDeleteArgs>("rippleDeleteItems", (draft, args) => {
  const ids = new Set(args.itemIds);
  const doomed = draft.items.filter((item) => ids.has(item.id));
  if (doomed.length === 0) return;

  const locked = doomed.filter((item) => item.locked);
  if (locked.length > 0) {
    throw new TimelineOpError(
      `Ye items locked hain: ${locked.map((item) => item.name).join(", ")}`,
    );
  }

  // Gaddhe track ke hisaab se — ya sab ek saath, agar allTracks ho.
  const spansByTrack = new Map<string, { from: number; to: number }[]>();
  for (const item of doomed) {
    const key = args.allTracks ? "*" : item.trackId;
    const list = spansByTrack.get(key) ?? [];
    list.push({ from: item.startFrame, to: itemEndFrame(item) });
    spansByTrack.set(key, list);
  }

  draft.items = draft.items.filter((item) => !ids.has(item.id));
  for (const id of ids) detachFromScenes(draft, id);

  for (const [key, spans] of spansByTrack) {
    const merged = mergeSpans(spans);
    const tracks = key === "*" ? null : new Set([key]);
    // Peeche se aage — warna pehla shift baaki gaddhon ki jagah hi badal deta hai.
    for (let i = merged.length - 1; i >= 0; i -= 1) {
      const span = merged[i] as { from: number; to: number };
      shiftItemsLeft(draft, {
        fromFrame: span.to,
        amount: span.to - span.from,
        trackIds: tracks,
      });
    }
  }
});

/** Aapas me lage/mile hue span ek kar do. */
function mergeSpans(spans: { from: number; to: number }[]): { from: number; to: number }[] {
  const sorted = [...spans].sort((a, b) => a.from - b.from);
  const out: { from: number; to: number }[] = [];
  for (const span of sorted) {
    const last = out[out.length - 1];
    if (last && span.from <= last.to) last.to = Math.max(last.to, span.to);
    else out.push({ ...span });
  }
  return out;
}

/* ------------------------------------------------------- in/out ka use */

export interface RangeArgs {
  fromFrame: number;
  toFrame: number;
  /** `true` = gaddha band karo / kata hua hissa 0 par le aao. */
  ripple?: boolean;
  /** Khaali = saare tracks. */
  trackIds?: readonly string[];
}

/**
 * In-Out ke beech ka hissa **hatao** (8.5).
 *
 * `ripple: false` par wahan gaddha reh jaata hai (baaki sab apni jagah), aur
 * `true` par aage ka sab utna baayein aa jaata hai.
 */
export const cutRange = defineOp<RangeArgs>("cutRange", (draft, args) => {
  const from = Math.max(0, Math.round(args.fromFrame));
  const to = Math.round(args.toFrame);
  if (to <= from) throw new TimelineOpError(`Range ulti hai (${from} se ${to})`);

  const tracks = args.trackIds && args.trackIds.length > 0 ? new Set(args.trackIds) : null;
  removeSpan(draft, { fromFrame: from, toFrame: to, trackIds: tracks });

  if (args.ripple) {
    shiftItemsLeft(draft, { fromFrame: to, amount: to - from, trackIds: tracks });
  }
});

/**
 * Sirf In-Out ke beech ka hissa **rakho** (8.5).
 *
 * `ripple: true` par bacha hua hissa 0 par aa jaata hai — yahi wo cheez hai jo
 * "20 second me se 5-12 second nikalo" ko ek click ka kaam banati hai.
 */
export const keepRange = defineOp<RangeArgs>("keepRange", (draft, args) => {
  const from = Math.max(0, Math.round(args.fromFrame));
  const to = Math.round(args.toFrame);
  if (to <= from) throw new TimelineOpError(`Range ulti hai (${from} se ${to})`);

  const tracks = args.trackIds && args.trackIds.length > 0 ? new Set(args.trackIds) : null;
  const end = contentEnd(draft);

  // Pehle daayan hissa, phir baayan — ulta karne par baayan hatane se sab
  // khisak jaata aur daayein wale ka naap galat pad jaata.
  removeSpan(draft, { fromFrame: to, toFrame: end + 1, trackIds: tracks });
  removeSpan(draft, { fromFrame: 0, toFrame: from, trackIds: tracks });

  if (args.ripple) {
    shiftItemsLeft(draft, { fromFrame: from, amount: from, trackIds: tracks });
  }
});

/* --------------------------------------------------------------- paste */

/** Clipboard me jaane wala tukda — cross-project paste isi se chalta hai (8.8). */
export const CLIPBOARD_KIND = "reel-studio/items@1";

export interface ClipboardFragment {
  kind: typeof CLIPBOARD_KIND;
  /** Kis fps par ye frames naape gaye the. */
  fps: number;
  items: Item[];
}

export interface PasteItemsArgs {
  fragment: ClipboardFragment;
  /** Yahan se paste — aam taur par playhead. */
  atFrame: number;
  /** Original track na mile to yahan girao. */
  fallbackTrackId?: string;
  policy?: OverlapPolicy;
}

/**
 * Paste (8.8).
 *
 * ⚠️ **fps ka farak yahin sambhalta hai.** 24fps ke project se copy karke 30fps
 * me paste karne par frames waise ke waise chipka dena clip ko 20% chhota kar
 * deta hai — aur wo galti dikhti nahi, sirf "kuch ajeeb lag raha hai" mehsoos
 * hoti hai. Isliye frames seconds se hokar guzarte hain.
 *
 * ⚠️ Track pehle apne asli id par jaane ki koshish karta hai (usi project me
 * paste karna sabse aam hai), phir `fallbackTrackId`, phir koi bhi track jo is
 * kism ko leta ho. Ek bhi na mile to saaf error — chupchaap galat track par
 * daal dena baad me dhoondhna namumkin bana deta hai.
 */
export const pasteItems = defineOp<PasteItemsArgs>("pasteItems", (draft, args) => {
  const { fragment } = args;
  if (fragment.kind !== CLIPBOARD_KIND) {
    throw new TimelineOpError(`Ye clipboard data samajh nahi aaya (${String(fragment.kind)})`);
  }
  if (fragment.items.length === 0) return;

  const scale = draft.project.fps / fragment.fps;
  const convert = (frames: number): number => Math.round(frames * scale);

  const ordered = [...draft.tracks].sort((a, b) => a.order - b.order);
  const minStart = Math.min(...fragment.items.map((item) => item.startFrame));
  const at = Math.max(0, Math.round(args.atFrame));

  const pasted: string[] = [];
  const touched = new Set<string>();

  for (const source of fragment.items) {
    const copy = clone(source);
    copy.id = createId("it");
    copy.locked = false;
    // Scene ka rishta paste me nahi jaata — target project me wo scene hai hi nahi.
    copy.sceneId = null;

    copy.startFrame = at + convert(source.startFrame - minStart);
    copy.durationInFrames = Math.max(1, convert(source.durationInFrames));
    copy.trimStartFrame = Math.max(0, convert(source.trimStartFrame));

    const track =
      ordered.find((t) => t.id === source.trackId && trackAccepts(t.type, copy.type)) ??
      ordered.find((t) => t.id === args.fallbackTrackId && trackAccepts(t.type, copy.type)) ??
      ordered.find((t) => trackAccepts(t.type, copy.type));

    if (!track) {
      throw new TimelineOpError(
        `"${copy.name}" (${copy.type}) ke liye is project me koi track nahi hai`,
      );
    }
    copy.trackId = track.id;

    draft.items.push(copy as Draft<Item>);
    pasted.push(copy.id);
    touched.add(track.id);
  }

  const keepIds = new Set(pasted);
  const policy = args.policy ?? DEFAULT_OVERLAP_POLICY;
  for (const trackId of touched) resolveOverlaps(draft, { trackId, keepIds, policy });

  growDuration(draft);
});

/** Chune hue items ka clipboard tukda banao. Op nahi — doc badalta hi nahi. */
export function copyItems(doc: Doc, itemIds: readonly string[]): ClipboardFragment {
  const ids = new Set(itemIds);
  return {
    kind: CLIPBOARD_KIND,
    fps: doc.project.fps,
    items: doc.items.filter((item) => ids.has(item.id)).map((item) => clone(item)),
  };
}

/* ==========================================================================
 * Phase 10 — animations aur transitions
 * ========================================================================== */

export interface AddAnimationArgs {
  itemIds: readonly string[];
  /** ANIMATIONS registry ka id. */
  typeId: string;
}

/**
 * Item par ek animation chadhao (10.9).
 *
 * ⚠️ Animations ek **stack** hain, ek value nahi. Ken Burns + fade-in saath
 * chalna aam hai, aur `composeAnimations()` unhe milata hai. Isliye ye op purani
 * animation hatata nahi — aakhir me jodta hai.
 */
export const addAnimation = defineOp<AddAnimationArgs>("addAnimation", (draft, args) => {
  const ids = new Set(args.itemIds);
  const fresh = createAnimation(args.typeId);

  for (const item of draft.items) {
    if (!ids.has(item.id)) continue;
    if (item.locked) continue;
    item.animations.push(clone(fresh) as Draft<Item>["animations"][number]);
  }
});

export interface RemoveAnimationArgs {
  itemId: string;
  index: number;
}

export const removeAnimation = defineOp<RemoveAnimationArgs>("removeAnimation", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);
  if (args.index < 0 || args.index >= item.animations.length) {
    throw new TimelineOpError(`Animation ${args.index} is item par hai hi nahi`);
  }
  item.animations.splice(args.index, 1);
});

export interface ReorderAnimationsArgs {
  itemId: string;
  from: number;
  to: number;
}

/**
 * Stack me kram badlo (10.9).
 *
 * Kram sach me matlab rakhta hai: `composeAnimations()` scale ko **guna** karta
 * hai aur position ko **jodta** hai, isliye pehle zoom phir pan aur pehle pan
 * phir zoom do alag nateeje dete hain (zoom ke baad pan ki doori bhi zoom ho
 * jaati hai). Isi wajah se reorder ek asli feature hai, saja nahi.
 */
export const reorderAnimations = defineOp<ReorderAnimationsArgs>(
  "reorderAnimations",
  (draft, args) => {
    const item = findItem(draft, args.itemId);
    assertUnlocked(item);

    const count = item.animations.length;
    if (args.from < 0 || args.from >= count) {
      throw new TimelineOpError(`Animation ${args.from} is item par hai hi nahi`);
    }
    const to = Math.min(count - 1, Math.max(0, Math.round(args.to)));
    if (to === args.from) return;

    const [moved] = item.animations.splice(args.from, 1);
    if (moved) item.animations.splice(to, 0, moved);
  },
);

export interface SetAnimationParamArgs {
  itemId: string;
  index: number;
  /** Animation ke andar ka path — `"from"`, `"focalX"`, `"easing"`… */
  path: string;
  value: unknown;
}

export const setAnimationParam = defineOp<SetAnimationParamArgs>(
  "setAnimationParam",
  (draft, args) => {
    const item = findItem(draft, args.itemId);
    assertUnlocked(item);

    const animation = item.animations[args.index];
    if (!animation) throw new TimelineOpError(`Animation ${args.index} is item par hai hi nahi`);
    if (args.path === "type") {
      throw new TimelineOpError("Animation ka type badalna hai to purani hatao aur nayi jodo");
    }
    setByPath(animation, args.path, args.value);
  },
);

export interface ApplyAnimationPresetArgs {
  itemIds: readonly string[];
  /** ANIMATION_PRESETS ka id. */
  presetId: string;
  /** `true` (default) = purani animations hatao. `false` = upar jodo. */
  replace?: boolean;
}

/**
 * Preset lagao (10.10).
 *
 * Preset kai animations ka stack ho sakta hai ("Cinematic drift" me teen hain),
 * aur wo sab **ek hi undo entry** me lagte hain — warna ek preset lagane ke baad
 * Ctrl+Z teen baar dabana padta.
 */
export const applyAnimationPreset = defineOp<ApplyAnimationPresetArgs>(
  "applyAnimationPreset",
  (draft, args) => {
    const preset = getAnimationPreset(args.presetId);
    if (!preset) throw new TimelineOpError(`"${args.presetId}" naam ka koi preset nahi hai`);

    const ids = new Set(args.itemIds);
    for (const item of draft.items) {
      if (!ids.has(item.id)) continue;
      if (item.locked) continue;

      if (args.replace !== false) item.animations = [];
      for (const animation of preset.animations) {
        item.animations.push(clone(animation) as Draft<Item>["animations"][number]);
      }
    }
  },
);

// ------------------------------------------------------------------ effects

/**
 * Effect stack badalne par keyframe paths bhi saath khiskao (14.4 + 14.5).
 *
 * ⚠️ Ye function is poore tarike ki jaan hai. Effect params ke keyframes
 * `effects.2.radius` jaise path par rehte hain — yaani **index** par. Stack me
 * ek effect upar-neeche hote hi wahi path ab kisi doosre effect ko point karne
 * lagta hai.
 *
 * Bina iske kya hota: user blur par 0 -> 8 ka keyframe lagata, phir stack me
 * blur ko neeche khiskata, aur ab wo animation vignette ke `amount` par chalne
 * lagti. Kuch toota nahi dikhta, error nahi aata — bas galat cheez animate hone
 * lagti hai. Aisi galti dhoondhna bahut mushkil hota hai, isliye path badalna
 * ops ke andar hi hota hai, UI par nahi chhoda gaya.
 *
 * `mapping` purane index se naye index par le jaata hai; `null` matlab wo effect
 * hata diya gaya aur uske keyframes bhi jaane chahiye.
 */
function remapEffectKeyframes(
  item: Draft<Item>,
  mapping: ReadonlyMap<number, number | null>,
): void {
  const next: Record<string, Keyframe[]> = {};

  for (const [path, list] of Object.entries(item.keyframes)) {
    const match = /^effects\.(\d+)\.(.+)$/.exec(path);
    if (!match) {
      next[path] = list as Keyframe[];
      continue;
    }
    const oldIndex = Number(match[1]);
    const param = match[2] as string;
    // Mapping me na ho to path waise ka waisa — wo effect hila hi nahi.
    const target = mapping.has(oldIndex) ? mapping.get(oldIndex) : oldIndex;
    if (target === null || target === undefined) continue;
    next[`effects.${target}.${param}`] = list as Keyframe[];
  }

  item.keyframes = next as Draft<Item>["keyframes"];
}

export interface AddEffectArgs {
  itemIds: readonly string[];
  /** EFFECTS registry ka id. */
  typeId: string;
}

/** Stack ke **ant me** naya effect. Kram maayne rakhta hai (14.4). */
export const addEffect = defineOp<AddEffectArgs>("addEffect", (draft, args) => {
  const ids = new Set(args.itemIds);
  const fresh = createEffect(args.typeId);

  for (const item of draft.items) {
    if (!ids.has(item.id)) continue;
    if (item.locked) continue;
    item.effects.push(clone(fresh) as Draft<Item>["effects"][number]);
  }
});

export interface RemoveEffectArgs {
  itemId: string;
  index: number;
}

export const removeEffect = defineOp<RemoveEffectArgs>("removeEffect", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);
  if (args.index < 0 || args.index >= item.effects.length) {
    throw new TimelineOpError(`Effect ${args.index} is item par hai hi nahi`);
  }

  item.effects.splice(args.index, 1);

  // Hataye gaye ke baad wale sab ek kadam peeche — unke keyframes bhi.
  const mapping = new Map<number, number | null>();
  mapping.set(args.index, null);
  for (let i = args.index + 1; i <= item.effects.length; i += 1) mapping.set(i, i - 1);
  remapEffectKeyframes(item, mapping);
});

export interface ReorderEffectsArgs {
  itemId: string;
  from: number;
  to: number;
}

export const reorderEffects = defineOp<ReorderEffectsArgs>("reorderEffects", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);

  const count = item.effects.length;
  if (args.from < 0 || args.from >= count) {
    throw new TimelineOpError(`Effect ${args.from} is item par hai hi nahi`);
  }
  const to = Math.max(0, Math.min(count - 1, args.to));
  if (to === args.from) return;

  const [moved] = item.effects.splice(args.from, 1);
  item.effects.splice(to, 0, moved as Draft<Item>["effects"][number]);

  /*
   * Mapping wahi hai jo splice ne kiya: hilne wala `from` se `to` par, aur beech
   * wale sab ek kadam khisak jaate hain. Ise haath se ginana padta hai kyunki
   * splice ke baad purane index kahin likhe nahi hote.
   */
  const mapping = new Map<number, number | null>();
  mapping.set(args.from, to);
  if (args.from < to) {
    for (let i = args.from + 1; i <= to; i += 1) mapping.set(i, i - 1);
  } else {
    for (let i = to; i < args.from; i += 1) mapping.set(i, i + 1);
  }
  remapEffectKeyframes(item, mapping);
});

export interface SetEffectParamArgs {
  itemId: string;
  index: number;
  /** `"enabled"` bhi chalta hai — aankh wala toggle isi se hota hai. */
  param: string;
  value: unknown;
}

export const setEffectParam = defineOp<SetEffectParamArgs>("setEffectParam", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);

  const effect = item.effects[args.index];
  if (!effect) throw new TimelineOpError(`Effect ${args.index} is item par hai hi nahi`);
  (effect as Record<string, unknown>)[args.param] = args.value;
});

export interface ApplyEffectPresetArgs {
  itemIds: readonly string[];
  presetId: string;
}

/**
 * Preset lagao — **stack poora badal jaata hai** (14.6).
 *
 * Preset ko purane stack ke upar jodna aasan lagta hai par nateeja bura hota
 * hai: "B & W" ke upar "Vintage" lagane par do grayscale aur do vignette lag
 * jaate aur tasveer kaali pad jaati. Preset ka matlab "aisa dikhna chahiye" hai,
 * "aur ye bhi jod do" nahi.
 */
export const applyEffectPreset = defineOp<ApplyEffectPresetArgs>(
  "applyEffectPreset",
  (draft, args) => {
    const preset = findEffectPreset(args.presetId);
    if (!preset) throw new TimelineOpError(`Effect preset "${args.presetId}" nahi mila`);
    const ids = new Set(args.itemIds);

    for (const item of draft.items) {
      if (!ids.has(item.id)) continue;
      if (item.locked) continue;
      item.effects = clone(preset.effects) as Draft<Item>["effects"];
      // Purane stack ke keyframes ab kisi bhi cheez ko point nahi karte.
      remapEffectKeyframes(item, new Map([...Array(64).keys()].map((i) => [i, null])));
    }
  },
);

export interface SetMaskArgs {
  itemIds: readonly string[];
  /** `null` = mask hata do. */
  mask: Mask;
}

export const setMask = defineOp<SetMaskArgs>("setMask", (draft, args) => {
  const ids = new Set(args.itemIds);
  for (const item of draft.items) {
    if (!ids.has(item.id)) continue;
    if (item.locked) continue;
    item.mask = args.mask === null ? null : (clone(args.mask) as Draft<Item>["mask"]);
  }
});

// ---------------------------------------------------------------- captions

function subtitleOf(item: Draft<Item>): NonNullable<Draft<Item>["subtitle"]> {
  if (!item.subtitle) {
    throw new TimelineOpError(`"${item.name}" caption item nahi hai`);
  }
  return item.subtitle;
}

export interface SetCuesArgs {
  itemId: string;
  cues: readonly CaptionCue[];
}

/** Poori cue list badlo — import ka raasta (19.4). */
export const setCues = defineOp<SetCuesArgs>("setCues", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);
  const subtitle = subtitleOf(item);

  // Kram hamesha frame se — UI list ko waise ka waisa dikhati hai, aur bina
  // sort ke import ki hui file ka kram timeline se alag ho jaata hai.
  subtitle.cues = clone([...args.cues].sort((a, b) => a.startFrame - b.startFrame)) as never;
});

export interface AddCueArgs {
  itemId: string;
  startFrame: number;
  endFrame: number;
  text?: string;
}

export const addCue = defineOp<AddCueArgs>("addCue", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);
  const subtitle = subtitleOf(item);

  const startFrame = Math.max(0, Math.round(args.startFrame));
  const endFrame = Math.max(startFrame + 1, Math.round(args.endFrame));

  subtitle.cues.push({
    id: createId("cue"),
    startFrame,
    endFrame,
    text: args.text ?? "",
    words: [],
  } as never);
  subtitle.cues.sort((a, b) => a.startFrame - b.startFrame);
});

export interface CueRefArgs {
  itemId: string;
  cueId: string;
}

export const deleteCue = defineOp<CueRefArgs>("deleteCue", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);
  const subtitle = subtitleOf(item);

  const at = subtitle.cues.findIndex((cue) => cue.id === args.cueId);
  if (at < 0) throw new TimelineOpError(`Cue ${args.cueId} nahi mila`);
  subtitle.cues.splice(at, 1);
});

export interface SetCueArgs extends CueRefArgs {
  startFrame?: number;
  endFrame?: number;
  text?: string;
}

export const setCue = defineOp<SetCueArgs>("setCue", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);
  const subtitle = subtitleOf(item);

  const cue = subtitle.cues.find((entry) => entry.id === args.cueId);
  if (!cue) throw new TimelineOpError(`Cue ${args.cueId} nahi mila`);

  if (args.startFrame !== undefined) cue.startFrame = Math.max(0, Math.round(args.startFrame));
  if (args.endFrame !== undefined) cue.endFrame = Math.round(args.endFrame);
  if (args.text !== undefined) {
    cue.text = args.text;
    /*
     * Text badalne par purana word timing bekaar ho jaata hai — usme wo shabd
     * hain jo ab hain hi nahi. Use rakhne par karaoke ka highlight aise shabdon
     * par chalta hai jo screen par dikh bhi nahi rahe.
     */
    cue.words = [] as never;
  }

  // Ulta cue nahi ban sakta — wo timeline par pakda hi nahi ja sakta.
  if (cue.endFrame <= cue.startFrame) cue.endFrame = cue.startFrame + 1;
  subtitle.cues.sort((a, b) => a.startFrame - b.startFrame);
});

export interface SplitCueArgs extends CueRefArgs {
  /** Item-local frame. */
  atFrame: number;
}

export const splitCueAt = defineOp<SplitCueArgs>("splitCueAt", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);
  const subtitle = subtitleOf(item);

  const at = subtitle.cues.findIndex((cue) => cue.id === args.cueId);
  if (at < 0) throw new TimelineOpError(`Cue ${args.cueId} nahi mila`);

  const split = splitCue(subtitle.cues[at] as CaptionCue, Math.round(args.atFrame), () =>
    createId("cue"),
  );
  if (!split) throw new TimelineOpError("Cue ke kinare par split nahi hota");

  subtitle.cues.splice(at, 1, ...(clone(split) as unknown as never[]));
});

export interface MergeCuesArgs {
  itemId: string;
  cueIds: readonly string[];
}

export const mergeCuesOp = defineOp<MergeCuesArgs>("mergeCues", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);
  const subtitle = subtitleOf(item);

  if (args.cueIds.length < 2) throw new TimelineOpError("Jodne ke liye do cue chahiye");

  const chosen = subtitle.cues.filter((cue) => args.cueIds.includes(cue.id));
  if (chosen.length !== args.cueIds.length) throw new TimelineOpError("Koi cue nahi mila");

  const merged = chosen
    .slice(1)
    .reduce((acc, cue) => mergeCues(acc, cue as CaptionCue), chosen[0] as CaptionCue);

  subtitle.cues = clone([
    ...subtitle.cues.filter((cue) => !args.cueIds.includes(cue.id)),
    merged,
  ]).sort((a, b) => a.startFrame - b.startFrame) as never;
});

export interface SetCaptionStyleArgs {
  itemId: string;
  styleId?: string;
  /** Sirf ye keys badalti hain; baaki waise ke waise. */
  params?: Record<string, unknown>;
}

export const setCaptionStyle = defineOp<SetCaptionStyleArgs>("setCaptionStyle", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);
  const subtitle = subtitleOf(item);

  if (args.styleId !== undefined) {
    const entry = getCaptionStyle(args.styleId);
    if (!entry) throw new TimelineOpError(`Caption style "${args.styleId}" nahi mila`);
    subtitle.styleId = args.styleId;
    /*
     * Style badalne par purane params **jaate hain**. Rakhne par ek style ka
     * `amount` doosre me chala jaata hai jahan uska matlab hi alag hai — aur
     * nateeja ek ajeeb sa look hota jise user ne kabhi chuna hi nahi.
     */
    subtitle.params = clone(entry.defaults) as never;
  }

  if (args.params) {
    subtitle.params = { ...(subtitle.params as Record<string, unknown>), ...clone(args.params) } as never;
  }
});

// ------------------------------------------------------------------ mockup

export interface SetMockupArgs {
  itemIds: readonly string[];
  /** `null` = frame hata do (raw recording). */
  mockup: Mockup;
}

export const setMockup = defineOp<SetMockupArgs>("setMockup", (draft, args) => {
  const ids = new Set(args.itemIds);
  for (const item of draft.items) {
    if (!ids.has(item.id)) continue;
    if (item.locked) continue;
    item.mockup = args.mockup === null ? null : (clone(args.mockup) as Draft<Item>["mockup"]);
  }
});

export interface ApplyZoomPanArgs {
  itemId: string;
  steps: readonly ZoomStep[];
  /** Purane zoom keyframes hata kar naye lagao? Default `true`. */
  replace?: boolean;
}

/**
 * Zoom-pan ko **keyframes me** badal do (18.6).
 *
 * ⚠️ Yahan koi naya "zoom" field nahi banta. Chaukor se `transform.scale` aur
 * `transform.x/y` ke wahi keyframes bante hain jo user haath se laga sakta tha.
 *
 * Iska seedha faayda ye hai ki zoom par **sab kuch apne aap chalta hai**: undo,
 * curve editor, keyframe lane, copy-paste, aur AI ka patch. Zoom ko apna field
 * banane par har ek ke liye alag code likhna padta, aur har naya feature ek din
 * zoom wala case bhool jaata.
 *
 * `replace` default `true` hai: dobara zoom lagane par purane keyframes hat
 * jaate hain. Bina iske do zoom milkar ek ajeeb teesri harkat bana dete hain
 * jise samjhana namumkin hota.
 */
export const applyZoomPan = defineOp<ApplyZoomPanArgs>("applyZoomPan", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);

  if (args.steps.length === 0) throw new TimelineOpError("Zoom ke liye kam se kam ek step chahiye");

  const patches = zoomPanKeyframes({
    steps: args.steps,
    frame: { width: draft.project.width, height: draft.project.height },
    // Item ka apna scale base hai — uske upar zoom lagti hai, use mitakar nahi.
    baseScale: item.transform.scale,
  });

  if (args.replace !== false) {
    for (const path of ["transform.scale", "transform.x", "transform.y"]) {
      delete (item.keyframes as Record<string, unknown>)[path];
    }
  }

  for (const patch of patches) {
    const list = ((item.keyframes as Record<string, Keyframe[]>)[patch.path] ??= []);
    // Ek hi frame par do keyframes nahi — naya purane ko badal deta hai.
    const at = list.findIndex((keyframe) => keyframe.frame === patch.frame);
    const keyframe: Keyframe = {
      frame: patch.frame,
      value: patch.value,
      easing: patch.easing,
      bezier: null,
    };
    if (at >= 0) list[at] = keyframe;
    else list.push(keyframe);
    list.sort((a, b) => a.frame - b.frame);
  }
});

// ------------------------------------------------------------------- brand

export interface SetBrandPresetArgs {
  presetId: string | null;
}

/**
 * Brand preset badlo (17.11).
 *
 * ⚠️ Yahan **items ko haath nahi lagta**, aur yahi is poore system ka point hai.
 * Rang doc me `"brand.primary"` jaise token ke roop me pade hain; preset badalte
 * hi wo apne aap naye rang par resolve hone lagte hain. Jahan user ne pakka rang
 * likha hai (`"#C25A37"`) wo waisa ka waisa rehta hai — bachane ke liye kuch
 * karna hi nahi padta.
 *
 * Items ghumakar rang badalne wala tarika bahut aasan lagta hai par wo ek hi baar
 * chalta hai: uske baad pata hi nahi chalta ki kaun sa rang brand se aaya tha aur
 * kaun sa user ne chuna tha.
 */
export const setBrandPreset = defineOp<SetBrandPresetArgs>("setBrandPreset", (draft, args) => {
  draft.brand.presetId = args.presetId;
});

export interface SetBrandTokenArgs {
  token: string;
  /** `null` = is project ka apna badlav hata do (preset wala rang wapas). */
  value: string | null;
}

export const setBrandToken = defineOp<SetBrandTokenArgs>("setBrandToken", (draft, args) => {
  if (!args.token.startsWith("brand.")) {
    throw new TimelineOpError(`"${args.token}" brand token nahi hai (brand. se shuru hona chahiye)`);
  }
  if (args.value === null) {
    delete (draft.brand.tokens as Record<string, string>)[args.token];
    return;
  }
  (draft.brand.tokens as Record<string, string>)[args.token] = args.value;
});

export interface SetWatermarkArgs {
  enabled?: boolean;
  assetId?: string | null;
  position?: "top-left" | "top-right" | "bottom-left" | "bottom-right";
  sizePercent?: number;
  opacity?: number;
  marginPercent?: number;
}

export const setWatermark = defineOp<SetWatermarkArgs>("setWatermark", (draft, args) => {
  const watermark = draft.brand.watermark;
  if (args.enabled !== undefined) watermark.enabled = args.enabled;
  if (args.assetId !== undefined) watermark.assetId = args.assetId;
  if (args.position !== undefined) watermark.position = args.position;
  if (args.sizePercent !== undefined) {
    watermark.sizePercent = Math.max(1, Math.min(50, args.sizePercent));
  }
  if (args.opacity !== undefined) watermark.opacity = Math.max(0, Math.min(1, args.opacity));
  if (args.marginPercent !== undefined) {
    watermark.marginPercent = Math.max(0, Math.min(20, args.marginPercent));
  }
});

export interface SetEndScreenArgs {
  enabled?: boolean;
  text?: string;
  durationSeconds?: number;
}

export const setEndScreen = defineOp<SetEndScreenArgs>("setEndScreen", (draft, args) => {
  const endScreen = draft.brand.endScreen;
  if (args.enabled !== undefined) endScreen.enabled = args.enabled;
  if (args.text !== undefined) endScreen.text = args.text;
  if (args.durationSeconds !== undefined) {
    endScreen.durationSeconds = Math.max(0.5, Math.min(10, args.durationSeconds));
  }
});

export interface SetBrandCtaArgs {
  text?: string;
  link?: string;
}

export const setBrandCta = defineOp<SetBrandCtaArgs>("setBrandCta", (draft, args) => {
  if (args.text !== undefined) draft.brand.cta.text = args.text;
  if (args.link !== undefined) draft.brand.cta.link = args.link;
});

// ----------------------------------------------------------------- markers

export interface AddMarkerArgs {
  frame: number;
  name?: string;
  color?: string;
}

/**
 * Marker daalo (16.8).
 *
 * ⚠️ Ek hi frame par do markers nahi bante. Wo timeline par ek doosre ke upar
 * baith jaate hain aur user ko lagta hai ki uska click kaam hi nahi kiya —
 * isliye usi frame ka purana marker lauta diya jaata hai (naya nahi banta).
 */
export const addMarker = defineOp<AddMarkerArgs>("addMarker", (draft, args) => {
  const frame = Math.max(0, Math.round(args.frame));
  if (draft.markers.some((marker) => marker.frame === frame)) return;

  draft.markers.push({
    id: createId("mk"),
    frame,
    name: args.name ?? "",
    color: args.color ?? "#e8a33d",
  });
  draft.markers.sort((a, b) => a.frame - b.frame);
});

export interface MarkerRefArgs {
  markerId: string;
}

export const deleteMarker = defineOp<MarkerRefArgs>("deleteMarker", (draft, args) => {
  const index = draft.markers.findIndex((marker) => marker.id === args.markerId);
  if (index < 0) throw new TimelineOpError(`Marker ${args.markerId} nahi mila`);
  draft.markers.splice(index, 1);
});

export interface SetMarkerArgs extends MarkerRefArgs {
  frame?: number;
  name?: string;
  color?: string;
}

export const setMarker = defineOp<SetMarkerArgs>("setMarker", (draft, args) => {
  const marker = draft.markers.find((entry) => entry.id === args.markerId);
  if (!marker) throw new TimelineOpError(`Marker ${args.markerId} nahi mila`);

  if (args.frame !== undefined) marker.frame = Math.max(0, Math.round(args.frame));
  if (args.name !== undefined) marker.name = args.name;
  if (args.color !== undefined) marker.color = args.color;
  draft.markers.sort((a, b) => a.frame - b.frame);
});

/** Playhead se agla/pichla marker — `null` matlab us taraf koi marker nahi. */
export function nextMarkerFrame(doc: Doc, frame: number, direction: 1 | -1): number | null {
  const sorted = [...doc.markers].sort((a, b) => a.frame - b.frame);
  if (direction === 1) {
    return sorted.find((marker) => marker.frame > frame)?.frame ?? null;
  }
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const marker = sorted[index] as Marker;
    if (marker.frame < frame) return marker.frame;
  }
  return null;
}

// ------------------------------------------------------------------ groups

export interface GroupItemsArgs {
  itemIds: readonly string[];
}

/**
 * Items ko ek group me baandho (16.10).
 *
 * ⚠️ Group ek **field** hai, ek naya "group item" nahi. Group ko apna item
 * banane par har op ko do tarah ke item sambhalne padte, aur har naya op ek din
 * group wala case bhool jaata. Field hone se group sirf selection ko badalta hai
 * aur baaki poora system waisa ka waisa rehta hai.
 */
export const groupItems = defineOp<GroupItemsArgs>("groupItems", (draft, args) => {
  const ids = new Set(args.itemIds);
  if (ids.size < 2) throw new TimelineOpError("Group ke liye kam se kam do items chahiye");

  const groupId = createId("gr");
  for (const item of draft.items) {
    if (!ids.has(item.id)) continue;
    if (item.locked) continue;
    item.groupId = groupId;
  }
});

export const ungroupItems = defineOp<GroupItemsArgs>("ungroupItems", (draft, args) => {
  const ids = new Set(args.itemIds);
  /*
   * Selection me se ek item chuna ho to bhi **poora** group toota hai. Aadha
   * group todna ek aisi haalat banata hai jise UI dikha hi nahi sakti: kuch
   * items saath chalte hain aur kuch nahi, par dono ek jaise dikhte hain.
   */
  const groups = new Set(
    draft.items.filter((item) => ids.has(item.id) && item.groupId).map((item) => item.groupId),
  );
  for (const item of draft.items) {
    if (item.groupId && groups.has(item.groupId)) item.groupId = null;
  }
});

/** Selection ko group ke saathi items tak faila do — har edit isse guzarta hai. */
export function expandSelectionToGroups(doc: Doc, itemIds: readonly string[]): string[] {
  const groups = new Set(
    doc.items.filter((item) => itemIds.includes(item.id) && item.groupId).map((item) => item.groupId),
  );
  if (groups.size === 0) return [...itemIds];

  const expanded = new Set(itemIds);
  for (const item of doc.items) {
    if (item.groupId && groups.has(item.groupId)) expanded.add(item.id);
  }
  return [...expanded];
}

// ------------------------------------------------------------- track extras

export interface DuplicateTrackArgs {
  trackId: string;
  /** Items bhi copy hon? Sirf khaali track chahiye to `false`. */
  withItems?: boolean;
}

export const duplicateTrack = defineOp<DuplicateTrackArgs>("duplicateTrack", (draft, args) => {
  const track = draft.tracks.find((entry) => entry.id === args.trackId);
  if (!track) throw new TimelineOpError(`Track ${args.trackId} nahi mila`);

  const copy = clone(track) as Draft<Track>;
  copy.id = createId("tr");
  copy.name = `${track.name} copy`;
  copy.order = track.order + 1;

  // Neeche wali saari tracks ek kadam aage — warna do tracks ek hi order par
  // baith jaati hain aur unka aapsi kram har render me badalta rehta hai.
  for (const other of draft.tracks) {
    if (other.order > track.order) other.order += 1;
  }
  draft.tracks.push(copy);

  if (args.withItems === false) return;

  const originals = draft.items.filter((item) => item.trackId === track.id);
  for (const item of originals) {
    const itemCopy = clone(item) as Draft<Item>;
    itemCopy.id = createId("it");
    itemCopy.trackId = copy.id;
    // Group ki copy nahi — warna copy ke items asli items ke saath hilte rehte.
    itemCopy.groupId = null;
    draft.items.push(itemCopy);
  }
});

export interface ReplaceAssetArgs {
  itemIds: readonly string[];
  assetId: string;
  /** Naye source ki lambai, project fps me. Pata na ho to `null`. */
  sourceDurationFrames?: number | null;
  /**
   * Lambai ka kya karein jab naya source chhota ho:
   *  - `"keep"`  — clip ki lambai waisi hi (default)
   *  - `"fit"`   — clip ko source jitna chhota kar do
   */
  duration?: "keep" | "fit";
}

/**
 * Clip ka asset badlo, baaki sab waisa ka waisa (16.13).
 *
 * ⚠️ Yahi is op ka poora point hai: timing, keyframes, effects, transitions,
 * transform — kuch nahi badalta, sirf `assetId`. Item delete karke naya banane
 * se ye sab chala jaata hai, aur user ko dobara poora kaam karna padta hai.
 *
 * `trimStartFrame` ko naye source ke andar rakhna padta hai. Naya source chhota
 * ho aur trim uske bahar reh jaaye to clip poori kaali dikhti hai — aur wo galti
 * "asset replace karne ke baad clip khaali ho gayi" jaisi shikayat bankar aati
 * hai, jiski wajah kabhi samajh nahi aati.
 */
export const replaceAsset = defineOp<ReplaceAssetArgs>("replaceAsset", (draft, args) => {
  const ids = new Set(args.itemIds);
  const source = args.sourceDurationFrames ?? null;

  for (const item of draft.items) {
    if (!ids.has(item.id)) continue;
    assertUnlocked(item);

    item.assetId = args.assetId;
    item.sourceDurationFrames = source;

    if (source === null) continue;

    if (item.trimStartFrame >= source) item.trimStartFrame = 0;

    if (args.duration === "fit") {
      const usable = Math.max(1, Math.floor((source - item.trimStartFrame) / item.playbackRate));
      item.durationInFrames = usable;
    }
  }
  growDuration(draft);
});

// ------------------------------------------------------- speed / freeze / crop

export interface SetPlaybackRateArgs {
  itemIds: readonly string[];
  /** 0.25x se 4x. */
  rate: number;
  /**
   * Timeline par clip ki lambai bhi badle?
   *
   * Lagbhag hamesha `true` — 2x speed par clip ko utna hi lamba chhod dena matlab
   * source ka aadha hissa dikhega hi nahi. `false` sirf tab kaam aata hai jab
   * user ne pehle se trim kiya ho aur wahi hissa tez chalana ho.
   */
  recomputeDuration?: boolean;
}

/**
 * Clip ki raftaar (15.7) — **aur yahin 13.7 poora hota hai**.
 *
 * ⚠️ Teen cheezein ek saath badalti hain, aur teeno ka ek saath badalna zaroori
 * hai:
 *
 *  1. `playbackRate`
 *  2. clip ki lambai — 2x par source ke 60 frames timeline par 30 me aate hain
 *  3. **keyframes** — warna 2x karne par animation apni jagah rehti aur clip
 *     aadhi ho jaati, yaani aadhi animation clip ke bahar chali jaati
 *
 * Teesri cheez sabse aasani se chhoot jaati hai, aur uska nateeja "speed badalte
 * hi meri animation toot gayi" jaisi shikayat hoti hai jiski wajah kabhi pakad
 * me nahi aati. Isliye wo yahin, isi op me hai — UI par nahi chhoda gaya.
 */
export const setPlaybackRate = defineOp<SetPlaybackRateArgs>("setPlaybackRate", (draft, args) => {
  const rate = args.rate;
  if (!Number.isFinite(rate) || rate < MIN_PLAYBACK_RATE || rate > MAX_PLAYBACK_RATE) {
    throw new TimelineOpError(
      `Speed ${rate}x nahi chalegi — ${MIN_PLAYBACK_RATE}x se ${MAX_PLAYBACK_RATE}x tak hi.`,
    );
  }

  const ids = new Set(args.itemIds);
  for (const item of draft.items) {
    if (!ids.has(item.id)) continue;
    if (item.locked) continue;
    if (item.playbackRate === rate) continue;

    const factor = item.playbackRate / rate;
    item.playbackRate = rate;

    if (args.recomputeDuration !== false) {
      const next = Math.max(1, Math.round(item.durationInFrames * factor));
      item.durationInFrames = next;
      // Fades bhi clip ke saath simatne/failne chahiye — warna 4x par 15-frame
      // ka fade clip se lamba ho jaata hai.
      item.audio.fadeInFrames = Math.min(next, Math.round(item.audio.fadeInFrames * factor));
      item.audio.fadeOutFrames = Math.min(next, Math.round(item.audio.fadeOutFrames * factor));
    }

    for (const path of Object.keys(item.keyframes)) {
      const list = item.keyframes[path];
      if (!list) continue;
      const moved = new Map<number, Draft<Keyframe>>();
      for (const keyframe of list) {
        keyframe.frame = Math.max(0, Math.round(keyframe.frame * factor));
        moved.set(keyframe.frame, keyframe);
      }
      item.keyframes[path] = [...moved.values()].sort((a, b) => a.frame - b.frame) as never;
    }
  }
  growDuration(draft);
});

export interface FreezeFrameArgs {
  itemId: string;
  /** Doc ka frame jahan freeze karna hai. */
  frame: number;
  /** Freeze kitna lamba ho. */
  durationInFrames: number;
}

/**
 * Freeze frame (15.8) — playhead par clip ko rok do.
 *
 * Clip do tukdon me tootti hai aur beech me ek naya item aata hai jo wahi source
 * dikhata hai par **hilta nahi**: uska `trimStartFrame` freeze wale frame par
 * jama diya jaata hai aur `playbackRate` 0 ke bahut kareeb.
 *
 * ⚠️ `playbackRate` theek 0 nahi rakha ja sakta — schema use positive maangta
 * hai aur 0 se bhaag dene wale hisaab (bacha hua source) toot jaate hain. Ek
 * bahut chhota number wahi kaam karta hai: 300 frames me source sirf 0.03 frame
 * aage badhta hai, yaani aankh ko bilkul sthir dikhta hai.
 */
export const freezeFrame = defineOp<FreezeFrameArgs>("freezeFrame", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);

  const localFrame = Math.round(args.frame) - item.startFrame;
  if (localFrame <= 0 || localFrame >= item.durationInFrames) {
    throw new TimelineOpError("Freeze clip ke andar hi ho sakta hai, kinare par nahi");
  }

  const holdFrames = Math.max(1, Math.round(args.durationInFrames));
  const sourceOffset = item.trimStartFrame + Math.round(localFrame * item.playbackRate);

  // Pehle clip ko todo — split ka poora hisaab (keyframes, transitions, trim)
  // wahin ek jagah likha hai aur use dobara likhna hi sabse badi galti hoti.
  splitAtFrame.recipe(draft, { frame: args.frame, itemIds: [item.id] });

  const right = draft.items.find(
    (candidate) => candidate.startFrame === args.frame && candidate.id !== item.id,
  );
  if (!right) throw new TimelineOpError("Split ke baad daayan tukda nahi mila");

  const frozen = clone(right) as Draft<Item>;
  frozen.id = createId("it");
  frozen.name = `${item.name} (freeze)`;
  frozen.durationInFrames = holdFrames;
  frozen.trimStartFrame = sourceOffset;
  frozen.playbackRate = FREEZE_PLAYBACK_RATE;
  frozen.keyframes = {} as Draft<Item>["keyframes"];
  frozen.transitionIn = { type: "none", durationInFrames: 0 } as Draft<Item>["transitionIn"];
  frozen.transitionOut = { type: "none", durationInFrames: 0 } as Draft<Item>["transitionOut"];
  // Sthir tasveer se awaaz aana ajeeb lagta hai — aur asal me wo ek hi frame ki
  // awaaz baar-baar bajti, jo shor hoti hai.
  frozen.audio.muted = true;

  // Aage ki har cheez utni hi khisak jaati hai — warna freeze agli clip ke upar
  // chadh jaata hai. Ye `right` se pehle karna zaroori hai, warna `right` do
  // baar khisak jaata hai.
  for (const other of draft.items) {
    if (other.trackId !== right.trackId) continue;
    if (other.startFrame >= args.frame) other.startFrame += holdFrames;
  }

  frozen.startFrame = args.frame;
  const index = draft.items.indexOf(right);
  draft.items.splice(index, 0, frozen);
  growDuration(draft);
});

export interface SetCropArgs {
  itemIds: readonly string[];
  /** `null` = crop hata do. Sab values 0..1 me, item ke apne dabbe ke hisaab se. */
  crop: { x: number; y: number; width: number; height: number } | null;
}

export const setCrop = defineOp<SetCropArgs>("setCrop", (draft, args) => {
  const ids = new Set(args.itemIds);

  const clamp = (value: number): number => Math.max(0, Math.min(1, value));
  const crop =
    args.crop === null
      ? null
      : {
          // Hadd yahin lagti hai, UI me nahi — AI ka patch aur template bhi isi
          // raaste se aate hain aur unke paas UI ki hadd nahi hoti.
          x: clamp(args.crop.x),
          y: clamp(args.crop.y),
          width: Math.max(0.01, Math.min(1 - clamp(args.crop.x), args.crop.width)),
          height: Math.max(0.01, Math.min(1 - clamp(args.crop.y), args.crop.height)),
        };

  for (const item of draft.items) {
    if (!ids.has(item.id)) continue;
    if (item.locked) continue;
    item.transform.crop = crop as Draft<Item>["transform"]["crop"];
  }
});

// ------------------------------------------------------------------- audio

export interface SetMasterAudioArgs {
  volume?: number;
  loudnessLufs?: number;
  limiter?: boolean;
}

export const setMasterAudio = defineOp<SetMasterAudioArgs>("setMasterAudio", (draft, args) => {
  const audio = draft.project.audio;
  if (args.volume !== undefined) audio.volume = Math.max(0, Math.min(4, args.volume));
  if (args.loudnessLufs !== undefined) {
    audio.loudnessLufs = Math.max(-32, Math.min(-5, args.loudnessLufs));
  }
  if (args.limiter !== undefined) audio.limiter = args.limiter;
});

export interface SetDuckingArgs {
  enabled?: boolean;
  voiceTrackIds?: readonly string[];
  duckedTrackIds?: readonly string[];
  targetDb?: number;
  attackFrames?: number;
  releaseFrames?: number;
}

/**
 * Ducking ka rule badlo (15.3 / 15.4).
 *
 * ⚠️ Ek track dono list me nahi ho sakta. Wo apne aap ko duck karta — voice
 * chalti aur usi waqt voice hi neeche chali jaati. Ye galti UI se rokna kaafi
 * nahi hai, kyunki AI ka patch aur template UI se nahi guzarte.
 */
export const setDucking = defineOp<SetDuckingArgs>("setDucking", (draft, args) => {
  const ducking = draft.project.audio.ducking;

  if (args.enabled !== undefined) ducking.enabled = args.enabled;
  if (args.voiceTrackIds) ducking.voiceTrackIds = [...args.voiceTrackIds];
  if (args.duckedTrackIds) ducking.duckedTrackIds = [...args.duckedTrackIds];
  if (args.targetDb !== undefined) ducking.targetDb = Math.max(-60, Math.min(0, args.targetDb));
  if (args.attackFrames !== undefined) {
    ducking.attackFrames = Math.max(0, Math.round(args.attackFrames));
  }
  if (args.releaseFrames !== undefined) {
    ducking.releaseFrames = Math.max(0, Math.round(args.releaseFrames));
  }

  const voice = new Set(ducking.voiceTrackIds);
  const overlap = ducking.duckedTrackIds.filter((id) => voice.has(id));
  if (overlap.length > 0) {
    throw new TimelineOpError(
      `Ek hi track voice aur ducked dono nahi ho sakta — wo khud ko neeche karega (${overlap.join(", ")})`,
    );
  }
});

export interface SetItemAudioArgs {
  itemIds: readonly string[];
  /** `audio` ke andar ka field — `volume`, `muted`, `solo`, `loop`, `fadeInFrames`… */
  field: string;
  value: unknown;
}

export const setItemAudio = defineOp<SetItemAudioArgs>("setItemAudio", (draft, args) => {
  const ids = new Set(args.itemIds);
  for (const item of draft.items) {
    if (!ids.has(item.id)) continue;
    if (item.locked) continue;
    (item.audio as unknown as Record<string, unknown>)[args.field] = args.value;
  }
});

export interface SetTransitionArgs {
  itemIds: readonly string[];
  side: "in" | "out";
  /** TRANSITIONS registry ka id. `"none"` = hata do. */
  type?: string;
  durationInFrames?: number;
  /**
   * Transition ke apne params (`direction`, `easing`, `from`…).
   *
   * Ye ek khula record hai kyunki har transition ke apne params hote hain aur wo
   * uski registry entry ke schema me likhe hain — yahan unhe ginana matlab poori
   * list dobara likhna.
   */
  params?: Record<string, unknown>;
}

/**
 * Clip ki transition lagao / badlo (10.5 / 10.6).
 *
 * ⚠️ Lambai yahin **clamp** hoti hai (`clampTransitionFrames`), UI me nahi. UI
 * me clamp karne par ek hi hadd do jagah rehti aur AI ka patch ya template usko
 * bypass kar jaata — aur tab clip ka beech ka hissa kabhi poora dikhta hi nahi.
 * Do transitions (in + out) milkar clip se lambi nahi ho sakti, aur kam se kam
 * ek frame poora dikhna chahiye.
 */
export const setTransition = defineOp<SetTransitionArgs>("setTransition", (draft, args) => {
  const ids = new Set(args.itemIds);

  for (const item of draft.items) {
    if (!ids.has(item.id)) continue;
    if (item.locked) continue;

    const target = args.side === "in" ? item.transitionIn : item.transitionOut;
    if (args.type !== undefined) {
      const entry = requireTransition(args.type);
      /*
       * Type badalne par purane params **hata** kar naye ke defaults bharte
       * hain. Purane rakhne par `slide` ka `direction` `zoom` par baitha reh
       * jaata — schema use maan leta (passthrough) aur wo chup-chaap bekaar
       * pada rehta, jo baad me "ye param kahan se aaya" wala sawaal banta hai.
       */
      for (const key of Object.keys(target)) {
        if (key !== "type" && key !== "durationInFrames") {
          delete (target as Record<string, unknown>)[key];
        }
      }
      Object.assign(target, clone(entry.defaults));
      target.type = args.type;
      // "Cut" ka matlab hai koi transition nahi — uski lambai rakhna sirf
      // uljhan hai, kyunki timeline par badge dikhta rehta par kuch hota nahi.
      if (args.type === "none") target.durationInFrames = 0;
    }
    if (args.params) {
      for (const [key, value] of Object.entries(args.params)) {
        if (key === "type" || key === "durationInFrames") continue;
        (target as Record<string, unknown>)[key] = value;
      }
    }
    if (args.durationInFrames !== undefined) {
      target.durationInFrames = Math.max(0, Math.round(args.durationInFrames));
    }

    const clamped = clampTransitionFrames({
      durationInFrames: item.durationInFrames,
      inFrames: item.transitionIn.durationInFrames,
      outFrames: item.transitionOut.durationInFrames,
    });
    item.transitionIn.durationInFrames = clamped.inFrames;
    item.transitionOut.durationInFrames = clamped.outFrames;
  }
});

/* ==========================================================================
 * Phase 12 — scenes
 * ========================================================================== */

/**
 * Scene ke items ke liye track dhoondo, na mile to naya banao (12.3).
 *
 * ⚠️ Naya track **banane** ki ijaazat isliye hai ki beginner mode me user ne
 * track ka naam bhi nahi suna hota. Wo "Image + awaaz" wala scene jodta hai aur
 * usse yahi umeed hoti hai ki dono cheezein apni jagah baith jaayein. Agar track
 * na hone par error aata, to Scene Cards mode adhoora reh jaata — aur beginner
 * ko timeline kholna padta, jo iska poora matlab hi khatam kar deta.
 */
function trackForItem(draft: DocDraft, itemType: string): string {
  const ordered = [...draft.tracks].sort((a, b) => a.order - b.order);
  const existing = ordered.find((track) => trackAccepts(track.type, itemType));
  if (existing) return existing.id;

  const entry = requireItemType(itemType);
  const maxOrder = draft.tracks.reduce((max, track) => Math.max(max, track.order), -1);
  const track = createTrack(entry.defaultTrackType, { order: maxOrder + 1 });

  draft.tracks.push(clone(track) as Draft<Track>);
  return track.id;
}

/** Scene ke items kis frame range me hain. */
function sceneSpan(draft: DocDraft, sceneId: string): { start: number; end: number } | null {
  const items = draft.items.filter((item) => item.sceneId === sceneId);
  if (items.length === 0) return null;
  return {
    start: Math.min(...items.map((item) => item.startFrame)),
    end: Math.max(...items.map(itemEndFrame)),
  };
}

/**
 * Saare scenes ko unke `order` ke hisaab se ek ke baad ek laga do (12.5).
 *
 * ⚠️ **Ye is poore phase ka sabse nazuk hissa hai.** Scene 2 aur 3 swap karne
 * par unke items ke `startFrame` dobara ginne padte hain — warna do cheezon me
 * se ek hoti hai: ya to scenes ek doosre ke upar chadh jaate hain, ya beech me
 * gaddha reh jaata hai aur video me kaali khaamoshi aati hai. Dono ek baar
 * dekhne par pakde nahi jaate; sirf export ke baad dikhte hain.
 *
 * Har scene ke andar ki aapas ki doori bani rehti hai (items apne scene ke start
 * se jitne door the, utne hi rehte hain) — sirf poora scene khiskta hai.
 */
function relayoutScenes(draft: DocDraft): void {
  const ordered = [...draft.scenes].sort((a, b) => a.order - b.order);
  let cursor = 0;

  for (const scene of ordered) {
    const items = draft.items.filter((item) => item.sceneId === scene.id);
    if (items.length === 0) continue;

    const start = Math.min(...items.map((item) => item.startFrame));
    const end = Math.max(...items.map(itemEndFrame));
    const shift = cursor - start;

    if (shift !== 0) {
      for (const item of items) item.startFrame = Math.max(0, item.startFrame + shift);
    }
    cursor += end - start;
  }

  // Order ki ginti bhi seedhi kar do — 0, 1, 2… taaki agla reorder saaf rahe.
  ordered.forEach((scene, index) => {
    scene.order = index;
  });
}

export interface AddSceneArgs {
  /** SCENE_TYPES registry ka id. */
  typeId: string;
  slots?: Record<string, unknown>;
  name?: string;
  durationInFrames?: number;
  /** Kahan lagana hai. Default: sabse aakhir me. */
  atIndex?: number;
}

/**
 * Naya scene jodo (12.3).
 *
 * Items `SceneTypeEntry.build()` se bante hain — **wahi function jo Phase 21 ka
 * AI bhi bulayega**. Do raaste rakhne par do editor ban jaate hain aur unme se
 * ek hamesha thoda peeche reh jaata hai.
 */
export const addScene = defineOp<AddSceneArgs>("addScene", (draft, args) => {
  const entry = requireSceneType(args.typeId);
  const sceneId = createId("sc");

  const built = entry.build({
    slots: args.slots ?? {},
    fps: draft.project.fps,
    sceneId,
    ...(args.durationInFrames === undefined ? {} : { durationInFrames: args.durationInFrames }),
  });

  if (built.length === 0) {
    throw new TimelineOpError(
      `"${entry.label}" scene se koi item nahi bana — zaroori slot bhare hain?`,
    );
  }

  // Naya scene sabse aakhir me lagta hai; `relayoutScenes` uski asli jagah tay
  // karta hai, isliye yahan sirf order chahiye.
  const maxOrder = draft.scenes.reduce((max, scene) => Math.max(max, scene.order), -1);
  const order = args.atIndex ?? maxOrder + 1;

  // Beech me daalna ho to baaki ko aage khiskao.
  for (const scene of draft.scenes) {
    if (scene.order >= order) scene.order += 1;
  }

  draft.scenes.push({
    id: sceneId,
    name: args.name ?? entry.label,
    order,
    itemIds: built.map((item) => item.id),
    type: entry.id,
    slots: clone(args.slots ?? {}),
  } as Draft<Doc>["scenes"][number]);

  for (const item of built) {
    const copy = clone(item);
    copy.trackId = trackForItem(draft, copy.type);
    draft.items.push(copy as Draft<Item>);
  }

  relayoutScenes(draft);
  growDuration(draft);
});

export interface ReorderScenesArgs {
  sceneId: string;
  /** Nayi jagah (0 = sabse upar). */
  toIndex: number;
}

export const reorderScenes = defineOp<ReorderScenesArgs>("reorderScenes", (draft, args) => {
  const ordered = [...draft.scenes].sort((a, b) => a.order - b.order);
  const from = ordered.findIndex((scene) => scene.id === args.sceneId);
  if (from === -1) throw new TimelineOpError(`Scene "${args.sceneId}" nahi mila`);

  const to = Math.min(ordered.length - 1, Math.max(0, Math.round(args.toIndex)));
  if (to === from) return;

  const [moved] = ordered.splice(from, 1);
  if (moved) ordered.splice(to, 0, moved);
  ordered.forEach((scene, index) => {
    scene.order = index;
  });

  relayoutScenes(draft);
  recomputeDuration.recipe(draft, undefined as never);
});

export interface SceneIdArgs {
  sceneId: string;
}

export const duplicateScene = defineOp<SceneIdArgs>("duplicateScene", (draft, args) => {
  const source = draft.scenes.find((scene) => scene.id === args.sceneId);
  if (!source) throw new TimelineOpError(`Scene "${args.sceneId}" nahi mila`);

  const newId = createId("sc");
  const items = draft.items.filter((item) => item.sceneId === args.sceneId);

  const copies = items.map((item) => {
    const copy = clone(item) as Item;
    copy.id = createId("it");
    copy.sceneId = newId;
    copy.locked = false;
    return copy;
  });

  for (const scene of draft.scenes) {
    if (scene.order > source.order) scene.order += 1;
  }

  draft.scenes.push({
    id: newId,
    name: `${source.name} (copy)`,
    order: source.order + 1,
    itemIds: copies.map((item) => item.id),
    type: source.type,
    slots: clone(source.slots),
  } as Draft<Doc>["scenes"][number]);

  for (const copy of copies) draft.items.push(copy as Draft<Item>);

  relayoutScenes(draft);
  growDuration(draft);
});

export const deleteScene = defineOp<SceneIdArgs>("deleteScene", (draft, args) => {
  const scene = draft.scenes.find((entry) => entry.id === args.sceneId);
  if (!scene) throw new TimelineOpError(`Scene "${args.sceneId}" nahi mila`);

  const locked = draft.items.filter((item) => item.sceneId === args.sceneId && item.locked);
  if (locked.length > 0) {
    throw new TimelineOpError(
      `Is scene me locked clips hain: ${locked.map((item) => item.name).join(", ")}`,
    );
  }

  draft.items = draft.items.filter((item) => item.sceneId !== args.sceneId);
  draft.scenes = draft.scenes.filter((entry) => entry.id !== args.sceneId);

  relayoutScenes(draft);
  recomputeDuration.recipe(draft, undefined as never);
});

export interface SetSceneDurationArgs {
  sceneId: string;
  durationInFrames: number;
  /**
   * `true` = scene ke saare items anupaat me badlein.
   * `false` (default) = sirf sabse lambi (primary) item badle.
   *
   * ⚠️ Dono ka apna matlab hai aur isi liye ye ek chunaav hai, default nahi.
   * "Image + awaaz" wale scene me aksar sirf tasveer lambi karni hoti hai aur
   * awaaz waisi hi rehni chahiye (wo ek recording hai, use kheenchna use bigad
   * dega). Par ek pure-visual scene me sab kuch saath badalna hi theek lagta hai.
   */
  proportional?: boolean;
}

export const setSceneDuration = defineOp<SetSceneDurationArgs>(
  "setSceneDuration",
  (draft, args) => {
    const span = sceneSpan(draft, args.sceneId);
    if (!span) throw new TimelineOpError(`Scene "${args.sceneId}" me koi item nahi hai`);

    const next = Math.max(1, Math.round(args.durationInFrames));
    const current = span.end - span.start;
    if (next === current) return;

    const items = draft.items.filter((item) => item.sceneId === args.sceneId && !item.locked);
    if (items.length === 0) return;

    if (args.proportional) {
      const ratio = next / current;
      for (const item of items) {
        const offset = item.startFrame - span.start;
        item.startFrame = span.start + Math.round(offset * ratio);
        item.durationInFrames = Math.max(1, Math.round(item.durationInFrames * ratio));
      }
    } else {
      // Sirf sabse lambi item — wahi scene ki lambai tay karti hai.
      let primary = items[0] as Draft<Item>;
      for (const item of items) {
        if (item.durationInFrames > primary.durationInFrames) primary = item;
      }
      primary.durationInFrames = Math.max(1, primary.durationInFrames + (next - current));
    }

    relayoutScenes(draft);
    recomputeDuration.recipe(draft, undefined as never);
  },
);

export interface SetSceneSlotArgs {
  sceneId: string;
  slotId: string;
  value: unknown;
}

/**
 * Scene ka koi slot badlo — asset replace ya text edit (12.4).
 *
 * ⚠️ Ye scene ko **dobara nahi banata**. Rebuild karna aasan lagta hai (build()
 * to hai hi), par wo user ki har manual edit mita deta — jo tasveer usne timeline
 * me sarka kar theek ki thi wo wapas apni jagah chali jaati. Isliye yahan sirf
 * usi item ka wo field badalta hai jo is slot se juda hai.
 */
export const setSceneSlot = defineOp<SetSceneSlotArgs>("setSceneSlot", (draft, args) => {
  const scene = draft.scenes.find((entry) => entry.id === args.sceneId);
  if (!scene) throw new TimelineOpError(`Scene "${args.sceneId}" nahi mila`);

  const type = requireSceneType(scene.type);
  const slot = type.slots.find((entry) => entry.id === args.slotId);
  if (!slot) throw new TimelineOpError(`"${scene.type}" scene me "${args.slotId}" slot nahi hai`);

  scene.slots[args.slotId] = args.value as never;

  const items = draft.items.filter((item) => item.sceneId === args.sceneId && !item.locked);

  if (slot.kind === "text") {
    /*
     * Text slot us item par lagta hai jispar pehle se text hai. Naya text item
     * banana yahan galat hoga: scene me pehle se ek text item hai, aur doosra
     * bana dene par dono ek doosre ke upar dikhte hain.
     */
    const target = items.find((item) => item.text !== null);
    if (target?.text) {
      const value = typeof args.value === "string" ? args.value : "";
      target.text.content = value;
      if (value.trim()) target.name = value.slice(0, 40);
    }
    return;
  }

  const wanted = assetKindForSlot(slot);
  const target = items.find((item) => {
    const entry = getItemType(item.type);
    if (!entry?.needsAsset) return false;
    if (!wanted) return true;
    // Slot `asset:image` maangta hai to item bhi image hi hona chahiye.
    return item.type === wanted;
  });

  if (target) target.assetId = typeof args.value === "string" ? args.value : null;
});

/* --------------------------------------------------- scene ki sehat (12.12) */

export interface SceneIntegrityIssue {
  kind: "orphan-item" | "missing-item" | "duplicate-order" | "unknown-type";
  message: string;
  sceneId?: string;
  itemId?: string;
}

/**
 * Scenes aur items ka rishta theek hai? (12.12)
 *
 * Ye toot'ta kaise hai: user timeline me ek clip delete kar deta hai, ya use
 * doosre scene ke beech me sarka deta hai. Dono bilkul jaayaz kaam hain — par
 * uske baad scene ki list aur items ki sachai alag ho jaati hain, aur Scene
 * Cards chup-chaap galat dikhane lagte hain.
 *
 * ⚠️ Ye **sirf batata hai**, theek nahi karta. Repair ek alag op hai
 * (`repairScenes`) taaki wo undo ho sake — aur taaki UI pehle dikha sake ki kya
 * badlega.
 */
export function validateSceneIntegrity(doc: Doc): SceneIntegrityIssue[] {
  const issues: SceneIntegrityIssue[] = [];
  const sceneIds = new Set(doc.scenes.map((scene) => scene.id));
  const itemIds = new Set(doc.items.map((item) => item.id));

  for (const item of doc.items) {
    if (item.sceneId && !sceneIds.has(item.sceneId)) {
      issues.push({
        kind: "orphan-item",
        itemId: item.id,
        message: `"${item.name}" ek aise scene se juda hai jo hai hi nahi (${item.sceneId}).`,
      });
    }
  }

  for (const scene of doc.scenes) {
    if (!getSceneType(scene.type)) {
      issues.push({
        kind: "unknown-type",
        sceneId: scene.id,
        message: `Scene "${scene.name}" ka type "${scene.type}" ab registry me nahi hai.`,
      });
    }
    for (const id of scene.itemIds) {
      if (itemIds.has(id)) continue;
      issues.push({
        kind: "missing-item",
        sceneId: scene.id,
        itemId: id,
        message: `Scene "${scene.name}" ek aisi clip gin raha hai jo delete ho chuki hai.`,
      });
    }
  }

  const seenOrder = new Set<number>();
  for (const scene of doc.scenes) {
    if (seenOrder.has(scene.order)) {
      issues.push({
        kind: "duplicate-order",
        sceneId: scene.id,
        message: `Do scenes ek hi jagah (order ${scene.order}) par hain.`,
      });
    }
    seenOrder.add(scene.order);
  }

  return issues;
}

/**
 * Upar wali sab gadbadiyan theek karo (12.12 ka "Fix" button).
 *
 * ⚠️ Ye **kuch delete nahi karta**. Orphan item ka `sceneId` khaali kar diya
 * jaata hai (wo timeline par apni jagah rehta hai), aur gayab id list se hat
 * jaati hai. Kisi ki clip mita dena "repair" nahi hota — wo ek aur nuksaan hota.
 */
export const repairScenes = defineOp<void>("repairScenes", (draft) => {
  const sceneIds = new Set(draft.scenes.map((scene) => scene.id));
  const itemIds = new Set(draft.items.map((item) => item.id));

  for (const item of draft.items) {
    if (item.sceneId && !sceneIds.has(item.sceneId)) item.sceneId = null;
  }

  for (const scene of draft.scenes) {
    scene.itemIds = scene.itemIds.filter((id) => itemIds.has(id));
    // Jo items khud ko is scene ka kehte hain par list me nahi hain, unhe jodo.
    for (const item of draft.items) {
      if (item.sceneId === scene.id && !scene.itemIds.includes(item.id)) {
        scene.itemIds.push(item.id);
      }
    }
  }

  // Khaali scenes — inka koi matlab nahi bachta, aur card bhi khaali dikhta hai.
  draft.scenes = draft.scenes.filter((scene) => scene.itemIds.length > 0);

  const ordered = [...draft.scenes].sort((a, b) => a.order - b.order);
  ordered.forEach((scene, index) => {
    scene.order = index;
  });
});

/**
 * Scene ki shape "custom edited" ho chuki hai? (12.8)
 *
 * Scene Cards par ye badge dikhta hai. Wajah: user timeline me kuch bhi kar
 * sakta hai — clip sarka sakta hai, trim kar sakta hai, ek aur clip jod sakta
 * hai. Uske baad card ki simple duniya (ek scene = ek lagataar block) sach nahi
 * rehti. Chupchaap sync tootne dena sabse bura hota; badge dikhana imaandaar hai.
 */
export function isSceneCustomEdited(doc: Doc, sceneId: string): boolean {
  const items = doc.items.filter((item) => item.sceneId === sceneId);
  if (items.length === 0) return false;

  const start = Math.min(...items.map((item) => item.startFrame));
  const end = Math.max(...items.map(itemEndFrame));

  // Scene ke beech me koi aisi clip ghusi hai jo is scene ki nahi hai?
  const intruder = doc.items.some(
    (item) => item.sceneId !== sceneId && item.startFrame < end && itemEndFrame(item) > start,
  );
  if (intruder) return true;

  // Scene ke andar gaddha — items lagatar nahi hain.
  const sorted = [...items].sort((a, b) => a.startFrame - b.startFrame);
  let reach = start;
  for (const item of sorted) {
    if (item.startFrame > reach) return true;
    reach = Math.max(reach, itemEndFrame(item));
  }

  /*
   * Scene ka kram timeline par badal chuka hai?
   *
   * ⚠️ Ye jaanch test likhte waqt judi. Pehle sirf overlap aur gaddha dekha
   * jaata tha, aur ek asli halat chhoot rahi thi: `push` policy ke saath ek clip
   * ko peeche sarkane par koi overlap banta hi nahi (baaki sab aage khisak jaate
   * hain) — par card #1 ab timeline ke #4 par baitha hota hai. Card ki list aur
   * video ka kram alag ho jaate hain, aur user ko kuch dikhta hi nahi.
   */
  const starts = doc.scenes
    .map((entry) => {
      const own = doc.items.filter((item) => item.sceneId === entry.id);
      return own.length === 0
        ? null
        : { order: entry.order, start: Math.min(...own.map((item) => item.startFrame)) };
    })
    .filter((entry): entry is { order: number; start: number } => entry !== null);

  const byOrder = [...starts].sort((a, b) => a.order - b.order);
  for (let i = 1; i < byOrder.length; i += 1) {
    if ((byOrder[i] as { start: number }).start < (byOrder[i - 1] as { start: number }).start) {
      return true;
    }
  }
  return false;
}

/* ==========================================================================
 * Phase 13 — keyframes
 * ========================================================================== */

/**
 * ⚠️ **Animation aur keyframe ka takraav — ek jagah likha hua niyam (13.12).**
 *
 * **Keyframe jeetta hai.** Animation base deti hai, keyframe uske upar likhta
 * hai. Ye niyam `resolveItemValue()` me pehle se lagu hai (wo pehle keyframe
 * dekhta hai, phir static value) aur `Transformed` me animation uske **upar**
 * compose hoti hai.
 *
 * Wajah: animation ek preset hai jo aap ek click me lagate ho; keyframe wo cheez
 * hai jo aapne khud, ek khaas frame par, haath se rakhi hai. Preset ka haath se
 * rakhi cheez ko mitana hamesha galat lagta hai — aur us galti ki shikayat
 * "maine keyframe lagaya tha, lagta hi nahi" bankar aati hai, jiski wajah
 * dhoondhna sabse mushkil hota hai.
 */
export const KEYFRAME_BEATS_ANIMATION = true;

function keyframeList(item: Draft<Item>, path: string): Draft<Keyframe>[] {
  const existing = item.keyframes[path];
  if (existing) return existing;
  item.keyframes[path] = [];
  return item.keyframes[path] as Draft<Keyframe>[];
}

/** Keyframes ko kram me rakho — sort ek hi jagah, har op ke ant me. */
function tidyKeyframes(item: Draft<Item>, path: string): void {
  const list = item.keyframes[path];
  if (!list) return;
  if (list.length === 0) {
    delete item.keyframes[path];
    return;
  }
  list.sort((a, b) => a.frame - b.frame);
}

export interface AddKeyframeArgs {
  itemId: string;
  /** `"transform.scale"` jaisa property path. */
  path: string;
  /** Item-local frame (0 = clip ka apna start). */
  frame: number;
  value: unknown;
  easing?: string;
}

/**
 * Keyframe lagao ya badlo (13.3).
 *
 * ⚠️ Usi frame par pehle se keyframe ho to **naya nahi banta, purana badalta
 * hai**. Do keyframes ek hi frame par hone se interpolation ka koi matlab nahi
 * bachta (span 0), aur wo doosra keyframe UI me chhupa reh jaata hai — user use
 * dekh bhi nahi paata aur hata bhi nahi paata.
 */
export const addKeyframe = defineOp<AddKeyframeArgs>("addKeyframe", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);

  const frame = Math.max(0, Math.round(args.frame));
  const list = keyframeList(item, args.path);
  const existing = list.find((keyframe) => keyframe.frame === frame);

  if (existing) {
    existing.value = args.value as never;
    if (args.easing !== undefined) existing.easing = args.easing;
  } else {
    list.push({
      frame,
      value: args.value,
      easing: args.easing ?? DEFAULT_EASING,
      bezier: null,
    } as Draft<Keyframe>);
  }
  tidyKeyframes(item, args.path);
});

export interface MoveKeyframeArgs {
  itemId: string;
  path: string;
  fromFrame: number;
  toFrame: number;
}

export const moveKeyframe = defineOp<MoveKeyframeArgs>("moveKeyframe", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);

  const list = item.keyframes[args.path];
  if (!list) throw new TimelineOpError(`"${args.path}" par koi keyframe nahi hai`);

  const keyframe = list.find((entry) => entry.frame === args.fromFrame);
  if (!keyframe) throw new TimelineOpError(`Frame ${args.fromFrame} par koi keyframe nahi hai`);

  const to = Math.max(0, Math.round(args.toFrame));
  if (to === args.fromFrame) return;

  /*
   * Doosre keyframe ke upar chhodne par wo **hat jaata hai**, aur ye soch kar
   * hai: drag me ungli exact frame par nahi rukti, aur do keyframes ek frame par
   * baith jaayein to unme se ek hamesha ke liye chhup jaata hai. Hatana dikhta
   * hai, chhupna nahi — aur Ctrl+Z dono ko wapas laata hai.
   */
  const at = list.findIndex((entry) => entry.frame === to);
  if (at !== -1) list.splice(at, 1);

  keyframe.frame = to;
  tidyKeyframes(item, args.path);
});

export interface DeleteKeyframeArgs {
  itemId: string;
  path: string;
  frame: number;
}

export const deleteKeyframe = defineOp<DeleteKeyframeArgs>("deleteKeyframe", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);

  const list = item.keyframes[args.path];
  if (!list) return;

  const at = list.findIndex((entry) => entry.frame === args.frame);
  if (at === -1) return;
  list.splice(at, 1);
  tidyKeyframes(item, args.path);
});

export interface SetKeyframeEasingArgs {
  itemId: string;
  path: string;
  frame: number;
  easing?: string;
  /** `[x1,y1,x2,y2]` — curve editor se. `null` = custom curve hata do. */
  bezier?: [number, number, number, number] | null;
}

export const setKeyframeEasing = defineOp<SetKeyframeEasingArgs>(
  "setKeyframeEasing",
  (draft, args) => {
    const item = findItem(draft, args.itemId);
    assertUnlocked(item);

    const keyframe = item.keyframes[args.path]?.find((entry) => entry.frame === args.frame);
    if (!keyframe) throw new TimelineOpError(`Frame ${args.frame} par koi keyframe nahi hai`);

    if (args.easing !== undefined) keyframe.easing = args.easing;
    if (args.bezier !== undefined) keyframe.bezier = args.bezier as never;
  },
);

export interface ClearKeyframesArgs {
  itemId: string;
  /** Khaali = is item ke **saare** keyframes. */
  path?: string;
}

/**
 * Keyframes hatao.
 *
 * ⚠️ Hatane se pehle **abhi ki value item par likh di jaati hai**. Iske bina
 * property ek jhatke me apni purani static value par kood jaati hai — user ne
 * scale 1 se 1.4 tak animate kiya hota hai, keyframes hataata hai, aur clip
 * achanak 1 par wapas chali jaati hai. Wo "maine to sirf keyframes hataye the"
 * wali hairaani sabse bekaar hai.
 */
export const clearKeyframes = defineOp<ClearKeyframesArgs>("clearKeyframes", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);

  const paths = args.path ? [args.path] : Object.keys(item.keyframes);
  for (const path of paths) {
    const list = item.keyframes[path];
    if (!list || list.length === 0) continue;

    // Clip ke shuruaat wali value hi sabse kam chaunkane wali hai.
    const value = sampleKeyframes(item.keyframes as Record<string, Keyframe[]>, path, 0);
    if (value !== null && value !== undefined && !PROTECTED_PATHS.has(path.split(".")[0] ?? "")) {
      setByPath(item, path, value);
    }
    delete item.keyframes[path];
  }
});

export interface CopyKeyframesArgs {
  fromItemId: string;
  fromPath: string;
  toItemId: string;
  toPath: string;
  /** `true` = pehle se maujood keyframes hata do. */
  replace?: boolean;
}

/**
 * Ek property ke keyframes doosri par chipka do (13.10).
 *
 * ⚠️ Value **waisi ki waisi** jaati hai, badalti nahi. `transform.x` ke pixels
 * ko `transform.scale` par chipkane ka nateeja bekaar hoga — par usko rokna bhi
 * galat hai, kyunki "opacity se volume" jaisi jodi bilkul kaam ki hoti hai. UI
 * me dono paths dikhte hain; faisla user ka hai, aur Ctrl+Z saath me hai.
 */
export const copyKeyframes = defineOp<CopyKeyframesArgs>("copyKeyframes", (draft, args) => {
  const from = findItem(draft, args.fromItemId);
  const source = from.keyframes[args.fromPath];
  if (!source || source.length === 0) {
    throw new TimelineOpError(`"${args.fromPath}" par koi keyframe nahi hai`);
  }

  const to = findItem(draft, args.toItemId);
  assertUnlocked(to);

  const copied = clone(source) as Keyframe[];
  if (args.replace !== false) {
    to.keyframes[args.toPath] = copied as never;
  } else {
    const list = keyframeList(to, args.toPath);
    for (const keyframe of copied) {
      const at = list.findIndex((entry) => entry.frame === keyframe.frame);
      if (at !== -1) list.splice(at, 1);
      list.push(keyframe as Draft<Keyframe>);
    }
  }
  tidyKeyframes(to, args.toPath);
});

export interface ScaleKeyframesArgs {
  itemId: string;
  /** Frames is gunak se badalte hain. 2 = animation dugni lambi. */
  factor: number;
}

/**
 * Keyframes ko waqt me kheencho/simeto (13.7).
 *
 * Speed badalne par ye zaroori hai: clip 2x tez chalegi to uski lambai aadhi ho
 * jaayegi, aur keyframes wahin ke wahin rehne par aadhi animation clip ke bahar
 * chali jaayegi — dikhegi hi nahi, aur wajah bilkul samajh nahi aayegi.
 */
export const scaleKeyframes = defineOp<ScaleKeyframesArgs>("scaleKeyframes", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);
  if (!Number.isFinite(args.factor) || args.factor <= 0) {
    throw new TimelineOpError(`Galat factor: ${args.factor}`);
  }
  if (args.factor === 1) return;

  for (const path of Object.keys(item.keyframes)) {
    const list = item.keyframes[path];
    if (!list) continue;
    for (const keyframe of list) {
      keyframe.frame = Math.max(0, Math.round(keyframe.frame * args.factor));
    }
    /*
     * Simatne par do keyframes ek hi frame par aa sakte hain. Dono rakhne se
     * span 0 ka segment banta hai aur ek keyframe UI me chhupa reh jaata hai —
     * isliye ek hi bachta hai (aakhri wala, jo baad ki value dikhata hai).
     */
    const seen = new Map<number, Draft<Keyframe>>();
    for (const keyframe of list) seen.set(keyframe.frame, keyframe);
    item.keyframes[path] = [...seen.values()].sort((a, b) => a.frame - b.frame) as never;
  }
});

/** Item par kaun si properties keyframed hain — lane UI isse rows banata hai. */
export function keyframedPaths(item: Item): string[] {
  return Object.entries(item.keyframes)
    .filter(([, list]) => list.length > 0)
    .map(([path]) => path)
    .sort();
}

export interface ReplaceDocArgs {




  /** Poora naya doc — caller ise `parseDoc`/`migrateDoc` se guzaar kar de. */
  doc: Doc;
}

/**
 * Poore doc ko badal do — version restore ka op.
 *
 * Ye op isliye hai (aur "bas naya doc set kar do" nahi) taaki **restore bhi
 * Ctrl+Z se wapas ho jaaye**. Bina iske "galat version restore kar diya" ka koi
 * ilaaj nahi bachta.
 *
 * Top-level keys ek-ek karke likhi jaati hain, `draft = next` nahi — immer draft
 * ko replace karne se patches nahi banti aur undo chupchaap mar jaata hai.
 */
export const replaceDoc = defineOp<ReplaceDocArgs>("replaceDoc", (draft, args) => {
  const next = clone(args.doc);
  draft.version = next.version;
  draft.project = next.project as Draft<Doc>["project"];
  draft.tracks = next.tracks as Draft<Doc>["tracks"];
  draft.items = next.items as Draft<Doc>["items"];
  draft.scenes = next.scenes as Draft<Doc>["scenes"];
  draft.brand = next.brand as Draft<Doc>["brand"];
  draft.meta = next.meta as Draft<Doc>["meta"];
});

/** Naya item is track par rakha ja sakta hai? UI drag ke dauraan yahi poochhta hai. */
export function canPlaceItem(doc: Doc, itemTypeId: string, trackId: string): boolean {
  const track = doc.tracks.find((t) => t.id === trackId);
  if (!track) return false;
  requireItemType(itemTypeId);
  return trackAccepts(track.type, itemTypeId);
}

/** Saare ops ek jagah — AI patches aur keyboard shortcuts isi map se resolve honge. */
export const OPS = {
  addItem,
  moveItem,
  moveItems,
  trimItemStart,
  trimItemEnd,
  splitItemAtFrame,
  splitAtFrame,
  deleteItems,
  rippleDeleteItems,
  duplicateItems,
  cutRange,
  keepRange,
  pasteItems,
  setItemProperty,
  setItemsProperty,
  addAnimation,
  removeAnimation,
  reorderAnimations,
  setAnimationParam,
  applyAnimationPreset,
  addKeyframe,
  moveKeyframe,
  deleteKeyframe,
  setKeyframeEasing,
  clearKeyframes,
  copyKeyframes,
  scaleKeyframes,
  setTransition,
  setCues,
  addCue,
  deleteCue,
  setCue,
  splitCueAt,
  mergeCues: mergeCuesOp,
  setCaptionStyle,
  setMockup,
  applyZoomPan,
  setBrandPreset,
  setBrandToken,
  setWatermark,
  setEndScreen,
  setBrandCta,
  addMarker,
  deleteMarker,
  setMarker,
  groupItems,
  ungroupItems,
  duplicateTrack,
  replaceAsset,
  setPlaybackRate,
  freezeFrame,
  setCrop,
  setMasterAudio,
  setDucking,
  setItemAudio,
  addEffect,
  removeEffect,
  reorderEffects,
  setEffectParam,
  applyEffectPreset,
  setMask,
  applyAutoFit,
  setProjectSize,
  setProjectFps,
  addScene,
  reorderScenes,
  duplicateScene,
  deleteScene,
  setSceneDuration,
  setSceneSlot,
  repairScenes,
  addTrack,
  removeTrack,
  reorderTracks,
  setTrackProperty,
  recomputeDuration,
  setProjectProperty,
  replaceDoc,
} as const;

export type OpName = keyof typeof OPS;

/**
 * Wo ops jo timeline ki **shakl** badalte hain (8.14).
 *
 * Inke baad project ki lambai dobara ginni chahiye — warna aakhri clip delete
 * karne par project usi purani lambai ka reh jaata hai aur export ke ant me
 * seconds bhar ka kaala hissa aata hai. Ye ek **list** hai, if-else nahi, taaki
 * naya structural op jodne par sirf yahan ek naam judna kaafi ho.
 *
 * `growDuration` (jo kai ops ke andar chalta hai) sirf **badha** sakta hai —
 * jaan-boojhkar, kyunki user ki chhodi hui khaali jagah har chhoti edit par
 * khaa jaana bhi utna hi bura hai. Ghatane ka faisla yahan se, ek baar me hota hai.
 */
export const STRUCTURAL_OPS: readonly OpName[] = [
  "addItem",
  "moveItem",
  "moveItems",
  "trimItemStart",
  "trimItemEnd",
  "splitItemAtFrame",
  "splitAtFrame",
  "deleteItems",
  "rippleDeleteItems",
  "duplicateItems",
  "cutRange",
  "keepRange",
  "pasteItems",
  "addScene",
  "reorderScenes",
  "duplicateScene",
  "deleteScene",
  "setSceneDuration",
  "setProjectFps",
  "removeTrack",
];

export function isStructuralOp(name: string): name is OpName {
  return (STRUCTURAL_OPS as readonly string[]).includes(name);
}
