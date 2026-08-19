import { secondsToFrames } from "../time";

/**
 * Beat detection — energy ke ubhaar se (24.7).
 *
 * ⚠️ Ye **onset detection** hai, poora beat-tracking nahi. Farak asli hai:
 * onset = "yahan koi cheez shuru hui" (drum, guitar, taali). Beat = wo dhadkan
 * jispar aadmi paanv thapthapata hai — usme wo beat bhi hote hain jinpar koi
 * awaaz nahi hoti. Reels me cut lagane ke liye onset hi chahiye: hum cut wahan
 * lagate hain jahan **sunai deta hai** kuch hua.
 *
 * ⚠️ Koi model, koi Python library nahi (librosa/aubio behtar hain par unka
 * matlab hai ek aur install jo user ko karna padega). Energy flux se kaam
 * chalta hai aur uski hadd yahin likhi hai: dheemi, bina drum wali dhun par ye
 * kamzor hai. Uska nateeja aankh se dikhta hai — cut galat jagah lagta hai —
 * isliye beat hamesha **dikhaye** jaate hain, chup-chaap lagaye nahi jaate.
 */

export interface EnergyWindow {
  timeSeconds: number;
  db: number;
}

export interface DetectBeatsOptions {
  /**
   * Do beat kam se kam kitni door hon.
   *
   * 0.2s = 300 BPM ki hadd. Isse kam rakhne par ek hi drum hit ke do-teen "beat"
   * ban jaate hain (awaaz ubharti hai, thodi girti hai, phir ubharti hai).
   */
  minIntervalSeconds?: number;
  /**
   * Kitna ubhaar "beat" maana jaaye (dB me).
   *
   * 6 dB matlab awaaz apne aas-paas ke औसत se dugni tez hui. Kam rakhne par
   * shor bhi beat ban jaata hai.
   */
  minRiseDb?: number;
}

export interface BeatResult {
  /** Kab-kab kuch shuru hua. */
  times: number[];
  /**
   * Andaazan BPM — beat ke beech ke **median** fasle se.
   *
   * ⚠️ Median, average nahi. Ek chhooti hui beat do fasle jod deti hai aur
   * average ko poora kharab kar deti hai; median ek-do galtiyon se hilta nahi.
   * `null` = do se kam beat mile, BPM nikalne ka koi matlab nahi.
   */
  bpm: number | null;
}

export const DEFAULT_BEAT_OPTIONS = {
  minIntervalSeconds: 0.2,
  minRiseDb: 6,
} as const;

/**
 * Energy se beat.
 *
 * Tarika: har window par dekho ki energy apne pichhle thode waqt ke औsat se
 * kitni upar uthi. Sirf "tez awaaz" dekhna galat hota — lagataar tez baja hua
 * gaana poora ka poora beat ban jaata. **Badhotri** hi beat hai.
 */
export function detectBeats(
  energy: readonly EnergyWindow[],
  options: DetectBeatsOptions = {},
): BeatResult {
  const minInterval = options.minIntervalSeconds ?? DEFAULT_BEAT_OPTIONS.minIntervalSeconds;
  const minRise = options.minRiseDb ?? DEFAULT_BEAT_OPTIONS.minRiseDb;

  if (energy.length < 3) return { times: [], bpm: null };

  // Pichhle ~0.15s ka औsat — isse tulna hoti hai.
  const step = Math.max(
    0.001,
    (energy[energy.length - 1] as EnergyWindow).timeSeconds / Math.max(1, energy.length - 1),
  );
  const lookBack = Math.max(2, Math.round(0.15 / step));

  /*
   * File se **pehle** kya tha, ye hum nahi jaante — aur ye sawaal asli hai.
   *
   * ⚠️ Pehle ye loop `lookBack` se shuru hota tha, taaki tulna ke liye pichhle
   * window maujood hon. Uska nateeja naap me pakda gaya: theek file ke shuru me
   * pada hua beat **chhoot jaata tha** (8 click me se 7 mile), aur uske baad
   * saare beat ek khaane aage khisak kar dikhte the — 500ms ki galti, jo sirf
   * ginti se pakdi gayi.
   *
   * Ab file se pehle uska apna sabse dheema hissa maan liya jaata hai. Click
   * track par wo chuppi hai, isliye pehla click turant beat ban jaata hai. Aur
   * jo gaana shuru se hi tez baj raha ho, uska floor bhi ooncha hota hai —
   * isliye wahan jhoothi beat nahi banti.
   */
  let floor = (energy[0] as EnergyWindow).db;
  for (const window of energy) if (window.db < floor) floor = window.db;

  const dbAt = (index: number): number =>
    index < 0 ? floor : (energy[index] as EnergyWindow).db;

  const times: number[] = [];
  let lastBeat = -Infinity;

  for (let index = 0; index < energy.length; index += 1) {
    const here = energy[index] as EnergyWindow;

    let sum = 0;
    for (let back = index - lookBack; back < index; back += 1) sum += dbAt(back);
    const before = sum / lookBack;
    const rise = here.db - before;
    if (rise < minRise) continue;

    /*
     * ⚠️ Sirf sabse pehla window lo, poori chadhai nahi. Ek drum hit paanch-chhe
     * window tak tez rehti hai; har window ko beat maan lene par ek hit ke paanch
     * beat ban jaate hain aur cut kaanpne lagte hain.
     */
    if (dbAt(index - 1) - dbAt(index - 2) >= minRise) continue;

    if (here.timeSeconds - lastBeat < minInterval) continue;
    times.push(here.timeSeconds);
    lastBeat = here.timeSeconds;
  }

  return { times, bpm: bpmFromTimes(times) };
}

/** Beat ke beech ke median fasle se BPM. */
export function bpmFromTimes(times: readonly number[]): number | null {
  if (times.length < 2) return null;

  const gaps: number[] = [];
  for (let index = 1; index < times.length; index += 1) {
    gaps.push((times[index] as number) - (times[index - 1] as number));
  }
  gaps.sort((a, b) => a - b);

  const middle = Math.floor(gaps.length / 2);
  const median =
    gaps.length % 2 === 0
      ? (((gaps[middle - 1] as number) + (gaps[middle] as number)) / 2)
      : (gaps[middle] as number);

  if (median <= 0) return null;
  return Math.round(60 / median);
}

/**
 * Sabse paas wala beat — frame me (24.7).
 *
 * ⚠️ `maxDistanceFrames` ke bina ye function har cut ko kisi na kisi beat par
 * kheench leta hai, chahe wo beat teen second door ho. Tab user ka lagaya hua
 * cut chup-chaap kahin aur chala jaata hai aur wajah samajh nahi aati. Door ka
 * beat mile to `null` — yaani "isse chhedna mat".
 */
export function nearestBeatFrame(
  frame: number,
  beatTimes: readonly number[],
  args: { fps: number; maxDistanceFrames?: number },
): number | null {
  if (beatTimes.length === 0) return null;
  const limit = args.maxDistanceFrames ?? Math.round(args.fps * 0.25);

  let best: number | null = null;
  let bestDistance = Infinity;

  for (const time of beatTimes) {
    const beatFrame = Math.round(secondsToFrames(time, args.fps));
    const distance = Math.abs(beatFrame - frame);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = beatFrame;
    }
  }

  return best !== null && bestDistance <= limit ? best : null;
}

/**
 * Chuppi kaat kar bacha hua hissa (24.7).
 *
 * ⚠️ Sirf **shuru aur ant** ki chuppi katti hai, beech ki nahi. Beech se chuppi
 * kaatne ka matlab hai clip ko kai tukdon me todna — aur wo tab tak nahi karna
 * chahiye jab tak user ne saaf na kaha ho, kyunki uske baad har cut haath se
 * theek karna padta hai.
 *
 * `padSeconds` jaan-boojhkar hai: theek awaaz par kaatne se pehla akshar kat
 * jaata hai ("Namaste" me se "N"), aur wo sunne me saaf galat lagta hai.
 */
export function speechTrimRange(
  segments: readonly { startSeconds: number; endSeconds: number }[],
  args: { durationSeconds: number; padSeconds?: number },
): { startSeconds: number; endSeconds: number } | null {
  if (segments.length === 0) return null;
  const pad = args.padSeconds ?? 0.08;

  const first = segments[0] as { startSeconds: number };
  const last = segments[segments.length - 1] as { endSeconds: number };

  const start = Math.max(0, first.startSeconds - pad);
  const end = Math.min(args.durationSeconds, last.endSeconds + pad);

  // Kuch katna hi na ho to `null` — taaki UI "kuch nahi hua" saaf keh sake aur
  // ek bekaar ka undo step na bane.
  if (start <= 0.01 && end >= args.durationSeconds - 0.01) return null;
  if (end - start < 0.1) return null;

  return { startSeconds: start, endSeconds: end };
}
