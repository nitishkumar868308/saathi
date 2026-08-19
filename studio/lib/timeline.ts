/**
 * Timeline ka poora ganit — **React ke bina**.
 *
 * Checklist 7.1 ki maang yahi hai: "saara position math ek helper se, component
 * me manual multiply mana hai". Wajah sirf safai nahi — timeline me ek hi number
 * (frame -> x) chaar jagah chahiye hota hai: ruler, clip, playhead, marquee. Un
 * chaaron me alag-alag `frame * zoom` likhne par teen to mil jaate hain aur
 * chautha hamesha aadha pixel khisak kar chalta hai. Wo farak dikhta bhi tab hai
 * jab bahut zoom karo — yaani hamesha der se.
 *
 * Yahan sab pure hai, isliye `scripts/check-timeline.ts` ise sach me naapta hai.
 *
 * ⚠️ Ek bhi jagah `/ 30` ya `* fps` nahi likha — jahan waqt ka hisaab hai wahan
 * `@reel/core` ke time helpers hi chalte hain (Dynamic rule 6).
 */

import { clampFrame, framesToTimecode, requireTrackType, type Item, type Track } from "@reel/core";

/* ---------------------------------------------------------------- chrome */

/** Ruler ki oonchai (px). */
export const RULER_HEIGHT = 26;
/** Baayein track headers ka column (px). */
export const TRACK_HEADER_WIDTH = 148;

/* -------------------------------------------------------------------- zoom */

/**
 * Zoom ki naap **px-per-frame** hai, koi "level 1..10" nahi.
 *
 * Level rakhne se Ctrl+wheel jhatke se chalta (har notch ek poora level) aur
 * "Fit project" kisi bhi level par theek nahi baithta — usko beech ki koi bhi
 * value chahiye hoti hai. Px-per-frame lagataar hai, isliye dono aaram se
 * chalte hain.
 */
export const MIN_PX_PER_FRAME = 0.02;
export const MAX_PX_PER_FRAME = 40;
export const DEFAULT_PX_PER_FRAME = 4;

/** Ek wheel notch / `+` dabane par zoom kitna badle. */
export const ZOOM_STEP = 1.25;

export function clampPxPerFrame(value: number): number {
  if (!Number.isFinite(value)) return DEFAULT_PX_PER_FRAME;
  return Math.min(MAX_PX_PER_FRAME, Math.max(MIN_PX_PER_FRAME, value));
}

/** "Fit project" — poora project ek baar me dikhe. */
export function fitPxPerFrame(viewportWidth: number, durationInFrames: number): number {
  if (viewportWidth <= 0 || durationInFrames <= 0) return DEFAULT_PX_PER_FRAME;
  return clampPxPerFrame(viewportWidth / durationInFrames);
}

/* ---------------------------------------------------------------- position */

export function frameToX(frame: number, pxPerFrame: number): number {
  return frame * pxPerFrame;
}

/**
 * x -> frame.
 *
 * Round hota hai, floor nahi — bilkul `secondsToFrames` ki tarah. Floor karne se
 * har click aadha frame peeche girta hai, aur zoom-in par wo saaf dikhta hai:
 * playhead hamesha ungli ke baayein rukta hai.
 */
export function xToFrame(x: number, pxPerFrame: number): number {
  if (pxPerFrame <= 0) return 0;
  return Math.round(x / pxPerFrame);
}

/** Timeline ki poori chaudai (px) is zoom par. */
export function contentWidth(durationInFrames: number, pxPerFrame: number): number {
  return frameToX(durationInFrames, pxPerFrame);
}

/**
 * Cursor ke neeche wala frame apni jagah par rehte hue zoom badlo (7.3).
 *
 * Bina iske Ctrl+wheel se zoom karna bhatakna ban jaata hai: jis clip par tum
 * zoom kar rahe ho wahi screen se bahar chala jaata hai aur use dhoondhna padta
 * hai. Yahan cursor ke neeche ka frame pakda jaata hai aur naye zoom par usko
 * wahi pixel wapas diya jaata hai.
 *
 * @param cursorX viewport ke andar ka x (element ke left se), scroll ke bina.
 * @returns naya `scrollLeft`.
 */
export function scrollLeftAfterZoom(args: {
  scrollLeft: number;
  cursorX: number;
  pxPerFrame: number;
  nextPxPerFrame: number;
}): number {
  const frameUnderCursor = (args.scrollLeft + args.cursorX) / (args.pxPerFrame || 1);
  return Math.max(0, frameUnderCursor * args.nextPxPerFrame - args.cursorX);
}

/* ------------------------------------------------------------------ ruler */

/** Label ke liye kam se kam itni jagah — isse chhota hone par ginti ghata do. */
export const MIN_LABEL_PX = 68;
/** Bina label wali chhoti lakeer ke liye kam se kam itni jagah. */
export const MIN_TICK_PX = 8;

/** Ek second se chhoti seedhiyan (frames me). */
const FRAME_STEPS: readonly number[] = [1, 2, 5, 10, 15];
/** Ek second se badi seedhiyan (seconds me). */
const SECOND_STEPS: readonly number[] = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1800, 3600];

export interface RulerScale {
  /** Label wali lakeeron ka antaraal (frames). */
  majorFrames: number;
  /** Chhoti lakeeron ka antaraal (frames). Major ka poora bhaag hota hai. */
  minorFrames: number;
}

/**
 * Zoom ke hisaab se ruler ki seedhi chuno (7.2).
 *
 * Seedhiyan frames se shuru hoti hain aur seconds tak jaati hain, aur **sab
 * fps se banti hain** — isliye 24, 25, 30 aur 60 fps chaaron par "1 second"
 * ki lakeer theek ek second par padti hai. Fixed pixel-step rakhne par 25fps
 * wale project me labels 00:00 / 00:01 ke beech kahin bhi gir jaate the.
 */
export function rulerScale(pxPerFrame: number, fps: number): RulerScale {
  let majorFrames = 0;

  for (const step of FRAME_STEPS) {
    // Ek second se lambi "frame seedhi" ka koi matlab nahi — wahan se seconds
    // wali ladder zyada padhne layak hai.
    if (step >= fps) break;
    if (step * pxPerFrame >= MIN_LABEL_PX) {
      majorFrames = step;
      break;
    }
  }

  if (majorFrames === 0) {
    for (const seconds of SECOND_STEPS) {
      const step = Math.round(seconds * fps);
      if (step * pxPerFrame >= MIN_LABEL_PX) {
        majorFrames = step;
        break;
      }
    }
  }

  // Itna zoom-out ki 1 ghanta bhi chhota pade — tab sabse badi seedhi hi sahi.
  if (majorFrames === 0) {
    majorFrames = Math.round((SECOND_STEPS[SECOND_STEPS.length - 1] as number) * fps);
  }

  // Chhoti lakeer: major ka aisa bhaag jo aankh se alag dikhe.
  let minorFrames = majorFrames;
  for (const divisor of [10, 5, 4, 2]) {
    if (majorFrames % divisor !== 0) continue;
    const candidate = majorFrames / divisor;
    if (candidate * pxPerFrame >= MIN_TICK_PX) {
      minorFrames = candidate;
      break;
    }
  }

  return { majorFrames, minorFrames };
}

export interface RulerTick {
  frame: number;
  x: number;
  major: boolean;
  /** Sirf major par. */
  label: string | null;
}

/**
 * Sirf **dikh rahe** hisse ki lakeerein banao.
 *
 * Poore project ki ticks banana (10 minute @ 30fps = 18000 frames) har scroll
 * par hazaaron object banata hai aur timeline chipchipa ho jaata hai. Yahan wahi
 * bante hain jo screen par hain.
 */
export function rulerTicks(args: {
  fromFrame: number;
  toFrame: number;
  pxPerFrame: number;
  fps: number;
  scale?: RulerScale;
}): RulerTick[] {
  const scale = args.scale ?? rulerScale(args.pxPerFrame, args.fps);
  const step = Math.max(1, scale.minorFrames);
  const from = Math.max(0, Math.floor(args.fromFrame / step) * step);

  const ticks: RulerTick[] = [];
  for (let frame = from; frame <= args.toFrame; frame += step) {
    const major = frame % scale.majorFrames === 0;
    ticks.push({
      frame,
      x: frameToX(frame, args.pxPerFrame),
      major,
      // Label hamesha timecode helper se — yahan apna `mm:ss` banane par 25fps
      // aur 60fps par ginti alag ho jaati hai.
      label: major ? framesToTimecode(frame, args.fps, { compact: true }) : null,
    });
  }
  return ticks;
}

/* -------------------------------------------------------- virtualization */

/** Screen se bahar bhi itna extra render karo, taaki scroll par khaali na dikhe. */
export const OVERSCAN_PX = 240;

export interface FrameRange {
  fromFrame: number;
  toFrame: number;
}

export function visibleFrames(args: {
  scrollLeft: number;
  viewportWidth: number;
  pxPerFrame: number;
  overscanPx?: number;
}): FrameRange {
  const overscan = args.overscanPx ?? OVERSCAN_PX;
  const fromX = args.scrollLeft - overscan;
  const toX = args.scrollLeft + args.viewportWidth + overscan;
  return {
    fromFrame: Math.max(0, xToFrame(fromX, args.pxPerFrame)),
    toFrame: Math.max(0, xToFrame(toX, args.pxPerFrame)),
  };
}

/**
 * Ye clip dikh raha hai? (7.7)
 *
 * ⚠️ Dono taraf **overlap** dekha jaata hai, sirf start nahi. Sirf start dekhne
 * par ek lambi clip jiska start screen se peeche hai wo gayab ho jaati hai —
 * aur wahi sabse badi clip hoti hai, isliye galti turant dikh jaati hai.
 */
export function itemIntersects(
  item: { startFrame: number; durationInFrames: number },
  range: FrameRange,
): boolean {
  return item.startFrame < range.toFrame && item.startFrame + item.durationInFrames > range.fromFrame;
}

export function visibleItems<T extends { startFrame: number; durationInFrames: number }>(
  items: readonly T[],
  range: FrameRange,
): T[] {
  return items.filter((item) => itemIntersects(item, range));
}

/* --------------------------------------------------------- track layout */

export interface TrackRow {
  track: Track;
  height: number;
  /** Timeline ke andar upar se doori (px). */
  top: number;
}

/**
 * Track rows — **doc ke `tracks[]` se** (7.5), kisi fixed list se nahi.
 *
 * Oonchai teen jagah se aa sakti hai, isi kram me: user ne kheench kar badli hui
 * (`heights`), warna registry ka `defaultHeight`, warna ek suraksha value. Isi
 * wajah se naya track type jodne par uski oonchai bhi usi entry se aa jaati hai.
 */
export const FALLBACK_TRACK_HEIGHT = 48;
export const MIN_TRACK_HEIGHT = 28;
export const MAX_TRACK_HEIGHT = 200;

export function clampTrackHeight(value: number): number {
  if (!Number.isFinite(value)) return FALLBACK_TRACK_HEIGHT;
  return Math.min(MAX_TRACK_HEIGHT, Math.max(MIN_TRACK_HEIGHT, Math.round(value)));
}

export function trackHeight(track: Track, heights: Readonly<Record<string, number>>): number {
  const custom = heights[track.id];
  if (custom !== undefined) return clampTrackHeight(custom);
  const entry = requireTrackType(track.type);
  return clampTrackHeight(entry.defaultHeight ?? FALLBACK_TRACK_HEIGHT);
}

export function trackRows(
  tracks: readonly Track[],
  heights: Readonly<Record<string, number>> = {},
): TrackRow[] {
  const ordered = [...tracks].sort((a, b) => a.order - b.order);
  const rows: TrackRow[] = [];
  let top = 0;
  for (const track of ordered) {
    const height = trackHeight(track, heights);
    rows.push({ track, height, top });
    top += height;
  }
  return rows;
}

export function totalTracksHeight(rows: readonly TrackRow[]): number {
  const last = rows[rows.length - 1];
  return last ? last.top + last.height : 0;
}

export function rowForTrack(rows: readonly TrackRow[], trackId: string): TrackRow | null {
  return rows.find((row) => row.track.id === trackId) ?? null;
}

export function rowAtY(rows: readonly TrackRow[], y: number): TrackRow | null {
  return rows.find((row) => y >= row.top && y < row.top + row.height) ?? null;
}

/* -------------------------------------------------------------- marquee */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Do kono se rectangle — kisi bhi disha me kheencha gaya ho. */
export function rectFromPoints(
  a: { x: number; y: number },
  b: { x: number; y: number },
): Rect {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(a.x - b.x),
    height: Math.abs(a.y - b.y),
  };
}

/** Clip ka rectangle timeline ke andar (scroll ke bina, content coordinates). */
export function itemRect(
  item: { startFrame: number; durationInFrames: number; trackId: string },
  rows: readonly TrackRow[],
  pxPerFrame: number,
): Rect | null {
  const row = rowForTrack(rows, item.trackId);
  if (!row) return null;
  return {
    x: frameToX(item.startFrame, pxPerFrame),
    y: row.top,
    width: frameToX(item.durationInFrames, pxPerFrame),
    height: row.height,
  };
}

export function rectsOverlap(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
  );
}

/**
 * Rubber band ke andar aane wale clips (7.8).
 *
 * **Chhoona kaafi hai, poora dhakna zaroori nahi** — har editor aisa hi karta
 * hai. Poora dhakne wali shart rakhne par lambi clip ko chunna namumkin ho jaata
 * hai: uske dono sire aksar screen se bahar hote hain.
 */
export function itemsInMarquee(
  items: readonly Item[],
  rows: readonly TrackRow[],
  marquee: Rect,
  pxPerFrame: number,
): string[] {
  const hits: string[] = [];
  for (const item of items) {
    const rect = itemRect(item, rows, pxPerFrame);
    if (rect && rectsOverlap(rect, marquee)) hits.push(item.id);
  }
  return hits;
}

/* -------------------------------------------------------- auto scroll */

/** Playback ke dauraan playhead kinare se itna andar rehna chahiye. */
export const FOLLOW_MARGIN_PX = 80;

/**
 * Playhead ko dikhate rehne ke liye naya `scrollLeft` (7.4).
 *
 * `null` matlab scroll karne ki zaroorat hi nahi — aur ye zaroori hai: har frame
 * par `scrollLeft` set karne se browser smooth scrolling se ladta hai aur poora
 * timeline kaanpne lagta hai.
 */
export function followScrollLeft(args: {
  playheadFrame: number;
  scrollLeft: number;
  viewportWidth: number;
  pxPerFrame: number;
  marginPx?: number;
}): number | null {
  const margin = Math.min(args.marginPx ?? FOLLOW_MARGIN_PX, args.viewportWidth / 2);
  const x = frameToX(args.playheadFrame, args.pxPerFrame);

  if (x < args.scrollLeft + margin) {
    return Math.max(0, x - margin);
  }
  if (x > args.scrollLeft + args.viewportWidth - margin) {
    return Math.max(0, x - args.viewportWidth + margin);
  }
  return null;
}

/* ------------------------------------------------------------ clip label */

/**
 * Clip par kya likha jaaye (7.6).
 *
 * Text item ka apna content sabse kaam ka label hai — "Text 3" se koi pehchaan
 * nahi hota. Baaki sab par item ka naam, jo factory asset ke filename se bharti hai.
 */
export function clipLabel(item: Item): string {
  const content = item.text?.content?.trim();
  if (content) return content.length > 60 ? `${content.slice(0, 60)}…` : content;
  return item.name;
}

/** Hover tooltip (7.13) — start, duration, dono timecode me. */
export function clipTooltip(item: Item, fps: number): string {
  const start = framesToTimecode(item.startFrame, fps, { compact: true });
  const end = framesToTimecode(item.startFrame + item.durationInFrames, fps, { compact: true });
  const duration = framesToTimecode(item.durationInFrames, fps, { compact: true });
  return `${clipLabel(item)}\n${start} → ${end}  (${duration}, ${item.durationInFrames} frames)`;
}

/* ------------------------------------------------------- in / out points */

export interface InOut {
  inFrame: number | null;
  outFrame: number | null;
}

/**
 * In/Out point lagao (7.11).
 *
 * ⚠️ In aur Out kabhi ulte nahi ho sakte. Out ko In se peeche rakh dene par
 * "range" ka koi matlab nahi bachta, aur Phase 8 me usi range par kaam hoga.
 * Isliye ulta lagane par doosra wala apne aap hat jaata hai — chupchaap swap
 * karna aur bura hota, kyunki user ne wahan point lagaya hi nahi tha.
 */
export function setInPoint(current: InOut, frame: number, lastFrame: number): InOut {
  const inFrame = clampFrame(frame, 0, lastFrame);
  const outFrame = current.outFrame !== null && current.outFrame <= inFrame ? null : current.outFrame;
  return { inFrame, outFrame };
}

export function setOutPoint(current: InOut, frame: number, lastFrame: number): InOut {
  const outFrame = clampFrame(frame, 0, lastFrame);
  const inFrame = current.inFrame !== null && current.inFrame >= outFrame ? null : current.inFrame;
  return { inFrame, outFrame };
}
