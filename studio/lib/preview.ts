/**
 * Preview player ka ganit aur uske numbers — ek jagah, aur **React ke bina**.
 *
 * Yahan sab kuch pure function hai, isliye `scripts/check-preview.ts` inhe asli
 * mein chala kar naapta hai. Component ke andar likhne par ye sirf aankh se
 * "theek lag raha hai" wali cheez ban jaate — aur zoom/scale ka ek off-by-one
 * aankh se kabhi nahi dikhta.
 */

import { guidesForSize } from "@reel/core";

/* ----------------------------------------------------------------- guides */

/**
 * Chuni hui guide is naap ke frame par matlab rakhti hai ya nahi.
 *
 * Project ka size badalna allowed hai (Section 3B), aur "Instagram Reels" chuni
 * hui ho tabhi koi usko 16:9 kar sakta hai. Us haalat me purani guide dikhate
 * rehna galat salah dena hoga — isliye pehli lagu hone waali par gir jaate hain.
 * Ek bhi na ho (kabhi nahi hona chahiye, `any` waali hamesha hain) to null.
 */
export function effectiveGuideId(
  width: number,
  height: number,
  chosen: string,
): string | null {
  const usable = guidesForSize(width, height);
  if (usable.some((guide) => guide.id === chosen)) return chosen;
  return usable[0]?.id ?? null;
}

/* ------------------------------------------------------------------- zoom */

export interface ZoomLevel {
  id: string;
  label: string;
  /** null = frame ko dabbe me fit karo. Warna composition pixels ka gunak. */
  scale: number | null;
  hint: string;
}

export const ZOOM_LEVELS: readonly ZoomLevel[] = [
  { id: "fit", label: "Fit", scale: null, hint: "Jitni jagah hai usme poora frame" },
  { id: "50", label: "50%", scale: 0.5, hint: "Aadhe naap par" },
  { id: "100", label: "100%", scale: 1, hint: "Asli pixel naap — scroll karna pad sakta hai" },
];

export const DEFAULT_ZOOM_ID = "fit";

export function getZoomLevel(id: string): ZoomLevel {
  return ZOOM_LEVELS.find((level) => level.id === id) ?? (ZOOM_LEVELS[0] as ZoomLevel);
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Draft mode me preview ki scale ki chhat.
 *
 * ⚠️ Iska imaandar matlab: **ye composition ka resolution nahi ghatata.** Remotion
 * ka Player composition ko uske apne pixel naap par banata hai aur CSS se scale
 * karta hai; image ka decode aur video ka decode dono utne hi rehte hain. Jo
 * sach me bachta hai wo raster/composite ka kaam — blur aur bade layer par ye
 * farak sach me dikhta hai, par ye jaadu nahi hai. Isiliye UI me iska naam
 * "Draft" hai, "Fast" nahi.
 */
export const DRAFT_MAX_SCALE = 0.5;

/** Frame ko dabbe me fit karne ki scale. Dabba khaali ho to 0. */
export function fitScale(box: Size, composition: Size): number {
  if (box.width <= 0 || box.height <= 0) return 0;
  if (composition.width <= 0 || composition.height <= 0) return 0;
  return Math.min(box.width / composition.width, box.height / composition.height);
}

export interface PreviewLayout {
  /** Player ko dene layak CSS naap (px). */
  width: number;
  height: number;
  /** Composition pixels par lagi hui asli scale. */
  scale: number;
}

/**
 * Player ka naap — **hamesha project ke aspect se**.
 *
 * `Math.round` sirf CSS ke liye hai; `scale` bina round ke lauta jaata hai taaki
 * overlay (safe-area guides) bilkul usi lakeer par baithe jispar frame hai.
 * Dono ko round karne par 9:16 me 1px ka farak aa jaata tha jo guide ko frame
 * se bahar dikhata.
 */
export function previewLayout(
  box: Size,
  composition: Size,
  options: { zoomId?: string; draft?: boolean } = {},
): PreviewLayout {
  const level = getZoomLevel(options.zoomId ?? DEFAULT_ZOOM_ID);
  const wanted = level.scale ?? fitScale(box, composition);
  const scale = options.draft ? Math.min(wanted, DRAFT_MAX_SCALE) : wanted;

  return {
    width: Math.round(composition.width * scale),
    height: Math.round(composition.height * scale),
    scale,
  };
}

/* ------------------------------------------------------------- seek throttle */

/** Scrub ke dauraan seek kitni tez ja sakti hai (6.7 — 60fps se zyada nahi). */
export const SEEK_MIN_INTERVAL_MS = 1000 / 60;

export interface SeekThrottleDeps {
  now(): number;
  /** rAF ya setTimeout — test me fake. */
  schedule(callback: () => void, delayMs: number): void;
}

export interface SeekThrottle {
  request(frame: number): void;
  /** Bina intezaar ke abhi bhejo (Home/End jaise ek-baar wale jump). */
  flush(): void;
}

/**
 * Seek ko 60fps par baandho.
 *
 * Drag karte waqt browser 200+ pointermove deta hai. Har ek par `seekTo()`
 * bulane se player har baar poora frame dobara banata hai aur drag chipchipa
 * ho jaata hai. Yahan **aakhri** frame yaad rehta hai aur window khulte hi wahi
 * jaata hai — beech wale frame chhod dena bilkul theek hai, kyunki unhe koi
 * dekhta hi nahi.
 */
export function createSeekThrottle(
  seek: (frame: number) => void,
  deps: SeekThrottleDeps,
  minIntervalMs = SEEK_MIN_INTERVAL_MS,
): SeekThrottle {
  let lastSentAt = Number.NEGATIVE_INFINITY;
  let pending: number | null = null;
  let scheduled = false;

  function send(frame: number): void {
    lastSentAt = deps.now();
    pending = null;
    seek(frame);
  }

  function drain(): void {
    scheduled = false;
    if (pending === null) return;
    send(pending);
  }

  return {
    request(frame) {
      const waited = deps.now() - lastSentAt;
      if (waited >= minIntervalMs && !scheduled) {
        send(frame);
        return;
      }
      // Purani pending value par likh do — aakhri wali hi sach hai.
      pending = frame;
      if (scheduled) return;
      scheduled = true;
      deps.schedule(drain, Math.max(0, minIntervalMs - waited));
    },
    flush() {
      if (pending === null) return;
      send(pending);
    },
  };
}

/* ------------------------------------------------------------ stutter watch */

/** Itne frameupdate naap kar faisla hota hai (6.12). */
export const STUTTER_SAMPLE_SIZE = 30;

/** Asli fps project ke fps ke itne hisse se neeche gire to hakla raha hai. */
export const STUTTER_RATIO = 0.7;

export interface StutterWatch {
  /** Har frameupdate par timestamp do. Lautata hai: abhi hakla raha hai? */
  push(timestampMs: number): boolean;
  /** Aakhri naapi hui asli fps (samples poore na hon to null). */
  measuredFps(): number | null;
  reset(): void;
}

/**
 * Playback sach me hakla raha hai ya nahi — **naap kar**, andaaze se nahi.
 *
 * Console me "3 video layers hain, dhyan rakhna" likh dena aasan hota, par wo
 * jhooth ke barabar hai: kai baar 3 layer bilkul theek chalti hain aur kabhi ek
 * hi 4K clip sab kuch rok deti hai. Isliye yahan asli `frameupdate` ke beech ka
 * waqt naapa jaata hai aur ussi se fps nikalti hai.
 */
export function createStutterWatch(
  targetFps: number,
  options: { sampleSize?: number; ratio?: number } = {},
): StutterWatch {
  const sampleSize = options.sampleSize ?? STUTTER_SAMPLE_SIZE;
  const ratio = options.ratio ?? STUTTER_RATIO;
  const stamps: number[] = [];
  let fps: number | null = null;

  return {
    push(timestampMs) {
      stamps.push(timestampMs);
      if (stamps.length > sampleSize) stamps.shift();
      if (stamps.length < sampleSize) return false;

      const span = (stamps[stamps.length - 1] as number) - (stamps[0] as number);
      if (span <= 0) return false;

      fps = ((stamps.length - 1) * 1000) / span;
      return fps < targetFps * ratio;
    },
    measuredFps() {
      return fps;
    },
    reset() {
      stamps.length = 0;
      fps = null;
    },
  };
}

/* ------------------------------------------------------------------- audio */

/**
 * `<Player numberOfSharedAudioTags>` — kitne `<audio>` element pehle se bana kar
 * rakhe jaayein.
 *
 * Browser naya `<audio>` sirf user ke click ke turant baad bajne deta hai.
 * Playback ke beech me naya tag banane par wo chup reh jaata hai ya kharakhata
 * hai, isliye Remotion pehle se kuch tag bana kar rakhta hai aur unhe baant-baant
 * kar use karta hai. Isliye ye number project ke audio items se aata hai, kisi
 * tay ankh-daaze se nahi — 0 dena matlab audio bilkul na bajna.
 */
export const MIN_SHARED_AUDIO_TAGS = 2;
export const MAX_SHARED_AUDIO_TAGS = 10;

/** Ek hi waqt par sabse zyada kitne audio/video item baj sakte hain. */
export function maxOverlappingAudio(
  items: readonly { startFrame: number; durationInFrames: number; hasAudio: boolean }[],
): number {
  const edges: { frame: number; delta: number }[] = [];
  for (const item of items) {
    if (!item.hasAudio || item.durationInFrames <= 0) continue;
    edges.push({ frame: item.startFrame, delta: 1 });
    edges.push({ frame: item.startFrame + item.durationInFrames, delta: -1 });
  }
  // Ek hi frame par ek clip khatam aur doosri shuru ho to wo overlap nahi hai —
  // isliye barabar frame par pehle -1 chalti hai.
  edges.sort((a, b) => a.frame - b.frame || a.delta - b.delta);

  let live = 0;
  let peak = 0;
  for (const edge of edges) {
    live += edge.delta;
    if (live > peak) peak = live;
  }
  return peak;
}

export function sharedAudioTagCount(
  items: readonly { startFrame: number; durationInFrames: number; hasAudio: boolean }[],
): number {
  const peak = maxOverlappingAudio(items);
  return Math.min(MAX_SHARED_AUDIO_TAGS, Math.max(MIN_SHARED_AUDIO_TAGS, peak));
}
