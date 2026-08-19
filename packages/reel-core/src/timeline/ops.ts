import { produce, type Draft } from "immer";

import { createId } from "../id";
import { setByPath } from "../path";
import { requireItemType, trackAccepts } from "../registry/index";
import { createTrack } from "../schema/factory";
import { itemEndFrame, type Doc, type Item, type Keyframe, type Track } from "../schema/project";
import { clampFrame } from "../time";

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
  // Keyframes item-local hain, isliye unhe bhi utna hi peeche khiskana padta hai.
  item.keyframes = shiftKeyframes(clone(item.keyframes), -delta, () => true);
});

/** Daayan kinara khiskao — sirf timeline par lambai badalti hai. */
export const trimItemEnd = defineOp<TrimArgs>("trimItemEnd", (draft, args) => {
  const item = findItem(draft, args.itemId);
  assertUnlocked(item);

  // Source ki asli lambai Phase 5 (assets) me pata chalegi — tab upar ka clamp
  // yahin judega. Abhi sirf "kam se kam 1 frame" wala rule hai.
  item.durationInFrames = Math.max(1, item.durationInFrames + Math.round(args.deltaFrames));
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
  const start = item.startFrame;
  const end = itemEndFrame(item);

  if (frame <= start || frame >= end) {
    throw new TimelineOpError(
      `Split frame ${frame} item ke andar nahi hai (${start}-${end}, kinare shaamil nahi)`,
    );
  }

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
  right.keyframes = shiftKeyframes(originalKeyframes, -leftDuration, (f) => f >= leftDuration);

  item.durationInFrames = leftDuration;
  item.transitionOut = { type: "none", durationInFrames: 0 };
  item.keyframes = shiftKeyframes(originalKeyframes, 0, (f) => f <= leftDuration);

  const at = findItemIndex(draft, item.id);
  draft.items.splice(at + 1, 0, right as Draft<Item>);
  attachToScene(draft, draft.items[at + 1] as Draft<Item>, item.id);
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
   * Track par items hain to kya karein. `false` (default) par saaf error milta hai —
   * chupchaap kisi ka kaam mita dena sabse buri baat hai.
   */
  withItems?: boolean;
}

export const removeTrack = defineOp<RemoveTrackArgs>("removeTrack", (draft, args) => {
  findTrack(draft, args.trackId);
  const onTrack = draft.items.filter((item) => item.trackId === args.trackId);

  if (onTrack.length > 0 && !args.withItems) {
    throw new TimelineOpError(
      `Track par ${onTrack.length} item hain. Hataana hi hai to withItems: true do.`,
    );
  }
  for (const item of onTrack) detachFromScenes(draft, item.id);
  draft.items = draft.items.filter((item) => item.trackId !== args.trackId);
  draft.tracks = draft.tracks.filter((track) => track.id !== args.trackId);
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
  trimItemStart,
  trimItemEnd,
  splitItemAtFrame,
  deleteItems,
  duplicateItems,
  setItemProperty,
  addTrack,
  removeTrack,
  reorderTracks,
  recomputeDuration,
} as const;

export type OpName = keyof typeof OPS;
