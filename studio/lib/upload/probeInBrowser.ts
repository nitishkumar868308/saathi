"use client";

/**
 * Upload se **pehle** browser me metadata nikalo (checklist 5.3).
 *
 * Ye ffprobe ki jagah nahi hai — ffprobe upload ke baad chalta hai aur wahi
 * aakhri sach hai. Ye do cheezon ke liye hai:
 *  1. Grid me file turant sahi shakal (aspect) me dikhe, server ka intezaar kiye bina.
 *  2. Upload se pehle hi bataya ja sake ki "ye 480p hai, reel me blurry aayega".
 *
 * ⚠️ Yahan ke numbers par akela bharosa nahi kiya jaata. Browser `duration`
 * kabhi `Infinity` deta hai (kuch webm/mkv), rotation apne aap laga deta hai,
 * aur fps to yahan sirf **ginn kar** nikalta hai. Isliye ye sab DB me "abhi ke
 * liye" jaate hain aur probe aate hi upar likhe jaate hain.
 */

export interface BrowserProbe {
  width?: number;
  height?: number;
  durationMs?: number;
  fps?: number;
}

/** Media element ke liye object URL — kaam ke baad hamesha chhoot jaata hai. */
async function withObjectUrl<T>(file: File, use: (url: string) => Promise<T>): Promise<T> {
  const url = URL.createObjectURL(file);
  try {
    return await use(url);
  } finally {
    // Revoke na karne par har upload ki poori file memory me pakdi rehti hai.
    URL.revokeObjectURL(url);
  }
}

function finiteOrUndefined(value: number): number | undefined {
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Element load hone ka intezaar — hamesha ek chhat ke saath. */
function waitFor(
  element: HTMLMediaElement,
  event: string,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    const timer = setTimeout(() => {
      cleanup();
      // Timeout par saaf error — chupchaap "metadata nahi mila" dena matlab
      // baad me "ye video 0x0 kaise ho gaya" wala sawaal.
      rejectPromise(new Error(`"${event}" ${timeoutMs}ms me nahi aaya`));
    }, timeoutMs);

    function onDone() {
      cleanup();
      resolvePromise();
    }
    function onError() {
      cleanup();
      rejectPromise(new Error("browser ye file khol nahi paaya"));
    }
    function cleanup() {
      clearTimeout(timer);
      element.removeEventListener(event, onDone);
      element.removeEventListener("error", onError);
    }

    element.addEventListener(event, onDone, { once: true });
    element.addEventListener("error", onError, { once: true });
  });
}

const METADATA_TIMEOUT_MS = 15_000;
/** fps ginne ke liye itni der chalaya jaata hai. */
const FPS_SAMPLE_MS = 600;

export async function probeImage(file: File): Promise<BrowserProbe> {
  // `createImageBitmap` decode ko main thread se hata deta hai — 4K PNG par
  // `new Image()` se saaf farak dikhta hai.
  const bitmap = await createImageBitmap(file);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

export async function probeVideo(file: File): Promise<BrowserProbe> {
  return withObjectUrl(file, async (url) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    video.src = url;

    await waitFor(video, "loadedmetadata", METADATA_TIMEOUT_MS);

    const probe: BrowserProbe = {
      width: finiteOrUndefined(video.videoWidth),
      height: finiteOrUndefined(video.videoHeight),
      durationMs: finiteOrUndefined(video.duration)
        ? Math.round(video.duration * 1000)
        : undefined,
    };

    const fps = await estimateFps(video);
    if (fps) probe.fps = fps;

    video.src = "";
    video.load();
    return probe;
  });
}

/**
 * fps ka andaaza — `requestVideoFrameCallback` se.
 *
 * Browser fps batata hi nahi, isliye ginna padta hai: thodi der chalao aur
 * dekho kitne frame nikle. Ye asli fps ke aas-paas hota hai (variable frame
 * rate par to hota hi anumaan hai), isliye seedha `Math.round` nahi karte —
 * standard rates se milaakar sabse nazdeek uthate hain, aur koi bhi paas na ho
 * to `undefined` de dete hain. Galat fps dene se behtar hai kuch na dena;
 * asli value ffprobe se aa hi jaayegi.
 */
async function estimateFps(video: HTMLVideoElement): Promise<number | undefined> {
  const withCallback = video as HTMLVideoElement & {
    requestVideoFrameCallback?: (
      callback: (now: number, metadata: { mediaTime: number; presentedFrames: number }) => void,
    ) => number;
  };
  if (typeof withCallback.requestVideoFrameCallback !== "function") return undefined;

  try {
    await video.play();
  } catch {
    // Autoplay policy — bina play ke frame nahi aate, isliye chhod do.
    return undefined;
  }

  const samples: { mediaTime: number; presentedFrames: number }[] = [];
  const done = new Promise<void>((resolvePromise) => {
    const stopAt = performance.now() + FPS_SAMPLE_MS;
    const tick = (_now: number, metadata: { mediaTime: number; presentedFrames: number }) => {
      samples.push({ mediaTime: metadata.mediaTime, presentedFrames: metadata.presentedFrames });
      if (performance.now() >= stopAt || samples.length > 240) {
        resolvePromise();
        return;
      }
      withCallback.requestVideoFrameCallback?.(tick);
    };
    withCallback.requestVideoFrameCallback?.(tick);
    // Video chhota ho aur khatam ho jaaye to bhi ruk jao.
    setTimeout(() => resolvePromise(), FPS_SAMPLE_MS + 500);
  });

  await done;
  video.pause();

  const first = samples[0];
  const last = samples[samples.length - 1];
  if (!first || !last || samples.length < 4) return undefined;

  const seconds = last.mediaTime - first.mediaTime;
  const frames = last.presentedFrames - first.presentedFrames;
  if (seconds <= 0 || frames <= 0) return undefined;

  return snapToKnownFps(frames / seconds);
}

/** Jaane-pehchane frame rates — inme se koi paas ho to wahi, warna kuch nahi. */
const KNOWN_FPS = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60, 120] as const;

export function snapToKnownFps(measured: number): number | undefined {
  let best: number | undefined;
  let bestGap = Number.POSITIVE_INFINITY;
  for (const candidate of KNOWN_FPS) {
    const gap = Math.abs(candidate - measured);
    // 8% ki chhoot — ginti me thodi hichki hamesha hoti hai.
    if (gap < bestGap && gap <= candidate * 0.08) {
      best = candidate;
      bestGap = gap;
    }
  }
  return best;
}

export async function probeAudio(file: File): Promise<BrowserProbe> {
  return withObjectUrl(file, async (url) => {
    const audio = document.createElement("audio");
    audio.preload = "metadata";
    audio.src = url;

    await waitFor(audio, "loadedmetadata", METADATA_TIMEOUT_MS);
    const durationMs = finiteOrUndefined(audio.duration)
      ? Math.round(audio.duration * 1000)
      : undefined;

    audio.src = "";
    return durationMs === undefined ? {} : { durationMs };
  });
}

/**
 * Kind ke hisaab se sahi probe chalao.
 *
 * Fail hone par khaali object — upload rokna galat hoga. File user ki hai, aur
 * asli naap to server par ffprobe se aane hi wala hai.
 */
export async function probeFileInBrowser(file: File, kindId: string): Promise<BrowserProbe> {
  try {
    if (kindId === "image") return await probeImage(file);
    if (kindId === "video") return await probeVideo(file);
    if (kindId === "audio") return await probeAudio(file);
    return {};
  } catch {
    return {};
  }
}
