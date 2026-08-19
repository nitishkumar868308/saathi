/**
 * Clip drag / trim / snapping ka ganit — **React ke bina**.
 *
 * Editing me galti ek frame ki hoti hai, aur ek frame aankh se kabhi nahi
 * dikhta. Isliye jo bhi cheez ginti se tay ho sakti hai wo yahan pure function
 * ki tarah hai aur `scripts/check-timeline.ts` use asli numbers se naapta hai.
 * Component ke paas sirf pointer aur DOM ka kaam bachta hai.
 *
 * ⚠️ Ek baat jo poore phase par lagu hai: **op sirf drop par chalta hai.** Drag
 * ke dauraan sirf ek local "ghost" hilta hai. Har pointermove par `moveItem`
 * chalane se do cheezein tootti hain — undo me sau entry ban jaati hain (8.1
 * "poora drag ek undo entry" ka ulta), aur autosave har frame par chalne lagti hai.
 */

import {
  itemEndFrame,
  snapFrame,
  type Doc,
  type Item,
} from "@reel/core";

/* ------------------------------------------------------------- snapping */

/** Snap kitne pixel ke andar lage (8.2 — hadd px me hai, frames me nahi). */
export const SNAP_THRESHOLD_PX = 8;

/**
 * Hadd px me kyun, frames me kyun nahi?
 *
 * Frames me rakhne par zoom-out karte hi snapping bekaar ho jaati hai (10 frame
 * ka fasla ek pixel se bhi kam dikhta hai, par snap nahi lagta) aur zoom-in par
 * chipku ho jaati hai (clip chhodti hi nahi). Ungli pixel dekhti hai, frame
 * nahi — isliye hadd bhi pixel me hai aur zoom ke saath frames me badalti hai.
 */
export function snapThresholdFrames(pxPerFrame: number): number {
  if (pxPerFrame <= 0) return 0;
  return SNAP_THRESHOLD_PX / pxPerFrame;
}

export interface SnapContext {
  doc: Doc;
  /** Ye items khud hil rahe hain — inke apne kinare candidate nahi ban sakte. */
  excludeIds: ReadonlySet<string>;
  playheadFrame: number;
  inFrame: number | null;
  outFrame: number | null;
}

/**
 * Kahan-kahan snap lag sakta hai (8.2).
 *
 * Playhead, baaki clips ke dono kinare, track ka shuru (0), project ka ant, aur
 * scene ki seemaayein. Sab ek hi list me — isliye nayi kism ka snap jodna is
 * function me ek line hai, drag wale code me nahi.
 */
export function snapCandidates(context: SnapContext): number[] {
  const points = new Set<number>();

  points.add(0);
  points.add(context.playheadFrame);
  points.add(context.doc.project.durationInFrames);
  if (context.inFrame !== null) points.add(context.inFrame);
  if (context.outFrame !== null) points.add(context.outFrame);

  for (const item of context.doc.items) {
    if (context.excludeIds.has(item.id)) continue;
    points.add(item.startFrame);
    points.add(itemEndFrame(item));
  }

  for (const scene of context.doc.scenes) {
    const items = context.doc.items.filter((item) => scene.itemIds.includes(item.id));
    if (items.length === 0) continue;
    points.add(Math.min(...items.map((item) => item.startFrame)));
    points.add(Math.max(...items.map(itemEndFrame)));
  }

  return [...points].sort((a, b) => a - b);
}

export interface SnapResult {
  /** Snap lagne ke baad ka delta. */
  deltaFrames: number;
  /** Jis lakeer par snap laga — indicator wahi dikhata hai. `null` = snap nahi laga. */
  snappedTo: number | null;
}

/**
 * Group ke **dono kinare** snap ke liye dekho, aur jo zyada paas ho wahi lo.
 *
 * Sirf baayan kinara dekhna sabse aam galti hai: clip ko doosri clip ke *baad*
 * lagana chahte ho to tumhara daayan kinara us clip ke baayein kinare se milta
 * hai, aur baayein-kinare wala snap wahan kabhi lagta hi nahi.
 */
export function snapMove(args: {
  startFrame: number;
  endFrame: number;
  rawDelta: number;
  candidates: readonly number[];
  thresholdFrames: number;
  /** Alt dabaye rakhne par snapping band (8.2). */
  disabled?: boolean;
}): SnapResult {
  const raw = Math.round(args.rawDelta);
  if (args.disabled || args.thresholdFrames <= 0 || args.candidates.length === 0) {
    return { deltaFrames: raw, snappedTo: null };
  }

  const wantStart = args.startFrame + raw;
  const wantEnd = args.endFrame + raw;

  const snappedStart = snapFrame(wantStart, args.candidates, args.thresholdFrames);
  const snappedEnd = snapFrame(wantEnd, args.candidates, args.thresholdFrames);

  const startPull = Math.abs(snappedStart - wantStart);
  const endPull = Math.abs(snappedEnd - wantEnd);

  if (snappedStart === wantStart && snappedEnd === wantEnd) {
    return { deltaFrames: raw, snappedTo: null };
  }
  // Barabar khinchav par baayan kinara jeetta hai — wahi wo kinara hai jise
  // user pakad kar chal raha hota hai.
  if (snappedStart !== wantStart && startPull <= endPull) {
    return { deltaFrames: snappedStart - args.startFrame, snappedTo: snappedStart };
  }
  return { deltaFrames: snappedEnd - args.endFrame, snappedTo: snappedEnd };
}

/** Ek kinare ke liye snap (trim ke dauraan). */
export function snapEdge(args: {
  frame: number;
  candidates: readonly number[];
  thresholdFrames: number;
  disabled?: boolean;
}): SnapResult {
  const raw = Math.round(args.frame);
  if (args.disabled || args.thresholdFrames <= 0) {
    return { deltaFrames: raw, snappedTo: null };
  }
  const snapped = snapFrame(raw, args.candidates, args.thresholdFrames);
  return { deltaFrames: snapped, snappedTo: snapped === raw ? null : snapped };
}

/* ------------------------------------------------------------------ drag */

export type DragMode = "move" | "trim-start" | "trim-end";

/** Trim ke handle kitne px chaude hain (clip ke dono kinaron par). */
export const TRIM_HANDLE_PX = 7;

/** Itna hilne ke baad hi drag maana jaata hai — warna har click ek drag ban jaati. */
export const DRAG_THRESHOLD_PX = 3;

export interface DragState {
  mode: DragMode;
  /** Jo items hil rahe hain (move me poori selection, trim me sirf ek). */
  itemIds: string[];
  /** Snap ke baad ka delta — ghost isi se banta hai. */
  deltaFrames: number;
  /** Sirf move me: kitne row upar/neeche. */
  trackShift: number;
  /** Indicator ki lakeer. */
  snappedTo: number | null;
}

export interface GhostRect {
  itemId: string;
  startFrame: number;
  durationInFrames: number;
  trackId: string;
}

/**
 * Drag ke dauraan clips kahan dikhein (8.1 ka ghost preview).
 *
 * Ye asli doc ko chhuta nahi — sirf batata hai ki drop karne par kya hoga.
 * Isi wajah se 200 clips par bhi drag halka rehta hai (8.15): doc, autosave aur
 * history teeno drag ke dauraan sote rehte hain.
 */
export function ghostRects(args: {
  doc: Doc;
  drag: DragState;
  /** Track ids order me — trackShift isi list me chalta hai. */
  orderedTrackIds: readonly string[];
}): GhostRect[] {
  const ids = new Set(args.drag.itemIds);
  const items = args.doc.items.filter((item) => ids.has(item.id));
  if (items.length === 0) return [];

  if (args.drag.mode === "move") {
    const minStart = Math.min(...items.map((item) => item.startFrame));
    const delta = Math.max(args.drag.deltaFrames, -minStart);

    return items.map((item) => {
      const at = args.orderedTrackIds.indexOf(item.trackId);
      const next =
        at === -1
          ? item.trackId
          : (args.orderedTrackIds[
              Math.min(args.orderedTrackIds.length - 1, Math.max(0, at + args.drag.trackShift))
            ] as string);
      return {
        itemId: item.id,
        startFrame: item.startFrame + delta,
        durationInFrames: item.durationInFrames,
        trackId: next,
      };
    });
  }

  // Trim — sirf ek item, aur uska ek kinara.
  const item = items[0] as Item;
  if (args.drag.mode === "trim-start") {
    const delta = clampTrimStart(item, args.drag.deltaFrames);
    return [
      {
        itemId: item.id,
        startFrame: item.startFrame + delta,
        durationInFrames: item.durationInFrames - delta,
        trackId: item.trackId,
      },
    ];
  }

  return [
    {
      itemId: item.id,
      startFrame: item.startFrame,
      durationInFrames: Math.max(1, item.durationInFrames + args.drag.deltaFrames),
      trackId: item.trackId,
    },
  ];
}

/**
 * Baayein kinare ke trim ki hadd — **ganit wahi jo op me hai**.
 *
 * Ghost aur op me alag hadd rakhne se sabse chidhane wala bug banta hai: drag
 * karte waqt clip ek jagah dikhti hai aur chhodte hi doosri jagah chali jaati
 * hai. Isliye dono ek hi ginti par chalte hain.
 */
export function clampTrimStart(item: Item, delta: number): number {
  const maxDelta = item.durationInFrames - 1;
  const minDelta = Math.max(-item.startFrame, -Math.floor(item.trimStartFrame / item.playbackRate));
  const low = Math.min(minDelta, maxDelta);
  return Math.min(maxDelta, Math.max(low, Math.round(delta)));
}

/** Daayein kinare ke trim ki hadd — source ke ant tak (8.3). */
export function clampTrimEnd(
  item: Item,
  delta: number,
  sourceDurationFrames: number | null,
): number {
  let next = Math.max(1, item.durationInFrames + Math.round(delta));
  if (sourceDurationFrames !== null && sourceDurationFrames > 0) {
    const left = Math.floor((sourceDurationFrames - item.trimStartFrame) / item.playbackRate);
    next = Math.max(1, Math.min(next, left));
  }
  return next - item.durationInFrames;
}

/* ------------------------------------------------------------- clipboard */

/**
 * Clipboard fallback — jab browser ka clipboard mana kar de.
 *
 * `navigator.clipboard` sirf secure context (https ya localhost) me chalti hai
 * aur permission maang sakti hai. Cross-project paste uske bina nahi hoga, par
 * usi project me copy-paste toota nahi hona chahiye — isliye ek chhoti si
 * andar wali copy bhi rakhi jaati hai.
 */
let localClipboard: string | null = null;

export function setLocalClipboard(text: string): void {
  localClipboard = text;
}

export function getLocalClipboard(): string | null {
  return localClipboard;
}
