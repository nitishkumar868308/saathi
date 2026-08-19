import { dbToGain, fadeGain, type FadeShape } from "../config/audio";
import { resolveItemValue } from "../keyframes/interpolate";
import { getItemType } from "../registry/index";
import { itemEndFrame, type Doc, type Item, type Track } from "../schema/project";

/**
 * Audio ka gain — **ekmatra** jagah (15.1 / 15.3 / 15.5 / 15.6).
 *
 * ⚠️ Preview aur render dono yahi function chalate hain, aur yahi is poore phase
 * ka sabse zaroori faisla hai. Volume ka ganit do jagah likha hota to ek din
 * editor me music -18 dB par duck hota aur MP4 me -20 par — aur wo farak sirf
 * kaan se pakda jaata, wo bhi tab jab video kisi ko bhej di ho.
 *
 * Kram ye hai, aur har kadam ka apna matlab hai:
 *
 *   1. item ka apna volume (keyframes ke saath — Phase 13 ka engine)
 *   2. fade in/out (equal-power, warna beech me awaaz dab jaati hai)
 *   3. mute / solo (item aur track dono ka)
 *   4. ducking (voice chal rahi ho to music neeche)
 *   5. master volume
 */

/** Ducking ka envelope — frame par gain (1 = poora, 0.126 = -18 dB). */
export interface DuckEnvelope {
  (frame: number): number;
}

/**
 * Voice kis-kis frame par chal rahi hai, uska envelope banao.
 *
 * Tarika timing-based hai: jahan voice track par koi item hai wahan voice maani
 * jaati hai. Silence detection nahi kiya gaya, aur ye soch-samajh kar hai —
 * silence detection ke liye audio ko decode karna padta hai, jo browser me
 * preview ke dauraan har badlav par karna namumkin hai. Tab preview aur render
 * ka envelope alag ho jaata, jo is poori file ke maqsad ke khilaaf hai.
 *
 * Attack/release seedhi dhalaan hain (linear), exponential nahi: dhalaan sirf
 * 6-15 frames ki hoti hai aur utni chhoti dhalaan par dono ek jaisi sunai deti
 * hain, par linear ko naapna aur samjhana bahut aasan hai.
 */
export function duckEnvelope(doc: Doc): DuckEnvelope {
  const ducking = doc.project.audio.ducking;
  if (!ducking.enabled || ducking.voiceTrackIds.length === 0) return () => 1;

  const voiceTracks = new Set(ducking.voiceTrackIds);
  const spans: { from: number; to: number }[] = [];

  for (const item of doc.items) {
    if (!voiceTracks.has(item.trackId)) continue;
    if (item.hidden) continue;
    if (item.audio.muted) continue;
    spans.push({ from: item.startFrame, to: itemEndFrame(item) });
  }
  if (spans.length === 0) return () => 1;

  // Milte-julte spans ko jodo — warna do voice clips ke beech ke 2 frame me music
  // upar aakar wapas neeche jaata hai, aur wo "pump" saaf sunai deta hai.
  spans.sort((a, b) => a.from - b.from);
  const merged: { from: number; to: number }[] = [];
  const gap = ducking.attackFrames + ducking.releaseFrames;
  for (const span of spans) {
    const last = merged[merged.length - 1];
    if (last && span.from - last.to <= gap) {
      last.to = Math.max(last.to, span.to);
    } else {
      merged.push({ ...span });
    }
  }

  const duckGain = dbToGain(ducking.targetDb);
  const attack = Math.max(1, ducking.attackFrames);
  const release = Math.max(1, ducking.releaseFrames);

  return (frame: number): number => {
    let lowest = 1;
    for (const span of merged) {
      // Attack span ke **pehle** shuru hota hai, taaki jab voice ka pehla shabd
      // aaye tab music pehle se neeche ho. Baad me shuru karne par pehla shabd
      // music ke upar chadh jaata hai.
      const start = span.from - attack;
      const end = span.to + release;
      if (frame <= start || frame >= end) continue;

      let gain = duckGain;
      if (frame < span.from) {
        gain = 1 + (duckGain - 1) * ((frame - start) / attack);
      } else if (frame > span.to) {
        gain = duckGain + (1 - duckGain) * ((frame - span.to) / release);
      }
      lowest = Math.min(lowest, gain);
    }
    return lowest;
  };
}

/** Doc me kahin bhi solo laga hai? Tab baaki sab chup. */
export function hasSolo(doc: Doc): boolean {
  return doc.items.some((item) => item.audio.solo && !item.hidden);
}

export interface GainContext {
  doc: Doc;
  item: Item;
  track: Track;
  /** Item ke apne start se gina hua frame. */
  localFrame: number;
  /** Pehle se bana envelope — har frame par dobara banane se bachne ke liye. */
  envelope?: DuckEnvelope;
  soloActive?: boolean;
}

/** Ek item ka gain, ek frame par. 0 = chup. */
export function itemGainAt(context: GainContext): number {
  const { doc, item, track, localFrame } = context;

  if (item.audio.muted || track.muted || item.hidden || track.hidden) return 0;

  /*
   * Do tarah ke solo hain aur dono ka matlab alag hai (16.2):
   *  - **track ka solo** — "abhi sirf is parat par kaam kar raha hoon"
   *  - **item ka solo**  — "abhi sirf ye ek clip sunna hai"
   *
   * Track wala solo pehle lagta hai: uske bahar ka kuch bhi nahi bajta, chahe
   * us clip par apna solo laga ho. Ulta karne par ek item ka solo poore track
   * ke solo ko bekaar kar deta, aur wo "solo laga hai par doosri track bhi baj
   * rahi hai" jaisi haalat banata jise samjhana namumkin hai.
   */
  if (doc.tracks.some((entry) => entry.solo && !entry.hidden) && !track.solo) return 0;

  const soloActive = context.soloActive ?? hasSolo(doc);
  if (soloActive && !item.audio.solo) return 0;

  // Track ki opacity awaaz par nahi lagti — wo sirf dikhne ki cheez hai.

  // 1. Apna volume — keyframe laga ho to wahi (Phase 13 ka engine).
  let gain = resolveItemValue<number>(item, "audio.volume", localFrame);
  if (!Number.isFinite(gain)) gain = item.audio.volume;

  // 2. Fades.
  const shape = item.audio.fadeShape as FadeShape;
  const { fadeInFrames, fadeOutFrames } = item.audio;
  if (fadeInFrames > 0 && localFrame < fadeInFrames) {
    gain *= fadeGain(localFrame / fadeInFrames, shape);
  }
  if (fadeOutFrames > 0 && localFrame > item.durationInFrames - fadeOutFrames) {
    gain *= fadeGain((item.durationInFrames - localFrame) / fadeOutFrames, shape);
  }

  // 3. Ducking — doc ke frame par, item ke local frame par nahi.
  const ducking = doc.project.audio.ducking;
  if (ducking.enabled && ducking.duckedTrackIds.includes(track.id)) {
    const envelope = context.envelope ?? duckEnvelope(doc);
    gain *= envelope(item.startFrame + localFrame);
  }

  // 4. Master.
  gain *= doc.project.audio.volume;

  return Math.max(0, gain);
}

/**
 * Poore mix ka sabse ooncha peak (anumaan) — clipping ki chetavni ke liye (15.5).
 *
 * ⚠️ Ye **anumaan** hai, naap nahi, aur is farak ko chhupana nahi chahiye. Do
 * awaazein ek saath bajne par unka asli peak unke gain ke jod se kam hota hai
 * (dono ek hi pal par apne sabse ooncha nahi hoti). Yahan jod hi liya jaata hai,
 * yaani ye hamesha **asli se zyada** batata hai.
 *
 * Aisa jaan-boojhkar hai: kam batane wali chetavni bekaar hoti hai. Yahan ka
 * kaam sirf itna hai ki export se pehle user ko pata ho ki khatra hai. Asli
 * naap render ke baad `ffmpeg -af astats` se hoti hai (Phase 11 ka finalize
 * loudnorm true-peak par bhi hadd lagata hai).
 */
export function estimateMixPeak(doc: Doc): { peak: number; frame: number } {
  const envelope = duckEnvelope(doc);
  const soloActive = hasSolo(doc);
  const trackById = new Map(doc.tracks.map((track) => [track.id, track]));

  let peak = 0;
  let peakFrame = 0;

  /*
   * Har frame par ganit karna 30fps ke 3 minute par 5400 baar x items hota hai —
   * aur ye function har export se pehle chalta hai. Har clip ke **kinaron** par
   * dekhna kaafi hai: gain fade aur duck ki dhalaanon ke beech monotone hota hai,
   * isliye sabse ooncha bindu hamesha kisi kinare par hi milta hai.
   */
  const marks = new Set<number>([0]);
  for (const item of doc.items) {
    const end = itemEndFrame(item);
    marks.add(item.startFrame);
    marks.add(end - 1);
    marks.add(item.startFrame + item.audio.fadeInFrames);
    marks.add(end - 1 - item.audio.fadeOutFrames);
    for (const keyframe of item.keyframes["audio.volume"] ?? []) {
      marks.add(item.startFrame + keyframe.frame);
    }
  }

  for (const frame of marks) {
    if (frame < 0 || frame >= doc.project.durationInFrames) continue;
    let sum = 0;
    for (const item of doc.items) {
      if (frame < item.startFrame || frame >= itemEndFrame(item)) continue;
      const track = trackById.get(item.trackId);
      if (!track) continue;
      /*
       * Sirf **awaaz wale** items ginti me.
       *
       * ⚠️ Pehle yahan sirf `assetId === null` dekha jaata tha, aur wo ek asli
       * bug tha: image aur video-bina-audio jaise items ke paas bhi `assetId`
       * hota hai aur unka `audio.volume` default 1 hota hai. Nateeja: do image
       * wali reel par bhi "clipping ka khatra 2.00" wali chetavni aati thi,
       * jabki wahan awaaz thi hi nahi. Aisi jhoothi chetavni sabse bura karti
       * hai — do-teen baar ke baad user har chetavni anadekhi kar deta hai.
       */
      if (item.assetId === null) continue;
      if (!getItemType(item.type)?.hasAudio) continue;
      sum += itemGainAt({
        doc,
        item,
        track,
        localFrame: frame - item.startFrame,
        envelope,
        soloActive,
      });
    }
    if (sum > peak) {
      peak = sum;
      peakFrame = frame;
    }
  }

  return { peak, frame: peakFrame };
}

/**
 * Clipping se bachne ke liye master kitna hona chahiye (15.5).
 *
 * `null` matlab zaroorat hi nahi — aur tab UI me kuch nahi dikhna chahiye.
 */
export function suggestedMasterVolume(doc: Doc): number | null {
  const { peak } = estimateMixPeak(doc);
  if (peak <= 1) return null;
  // 0.98 par rukte hain, 1.0 par nahi — theek 1 par bhi encoder ke baad ek-do
  // sample upar nikal jaate hain.
  return Math.round((doc.project.audio.volume * (0.98 / peak)) * 1000) / 1000;
}
