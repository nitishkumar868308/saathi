import type { VisemeStep } from "./fromText";
import { REST_VISEME, getVisemeShape, type VisemeShape } from "./shapes";

/**
 * Muh ka poora track — kis waqt kaunsa shape, aur kitna khula.
 *
 * ⚠️ Yahan **do alag jaankariyan** jud'ti hain, aur dono ki zaroorat asli hai:
 *
 *   - **Envelope** (awaaz ki takat, waqt ke saath) batata hai ki bolna KAHAN ho
 *     raha hai. Sirf text se, poori lambai par barabar baant dena sabse aasan
 *     tarika hai aur galat hai: TTS beech me saans leti hai aur viraam leti hai,
 *     aur wahan muh chalta rehta hai — dekhne wale ko turant nakli lagta hai.
 *   - **Text** batata hai ki us dauraan KAUNSA shape aana chahiye. Sirf envelope
 *     se karne par har awaaz par muh ek jaisa khulta-band hota hai — jise
 *     "chabaana" kehte hain, aur wahi sabse aam nakli lip sync hai.
 *
 * Ek akela kaafi hota to doosra yahan hota hi nahi.
 */

export interface VisemeFrame {
  /** Kis waqt (second) se ye shape shuru hota hai. */
  atSeconds: number;
  viseme: string;
  /**
   * Kitna zor — 0 se 1, envelope se.
   *
   * ⚠️ Iske bina dheeme bole gaye hisse par bhi muh poora khulta hai, aur wo
   * cheekh jaisa lagta hai. Zor ka badalna hi awaaz ke "utaar-chadhav" ko chehre
   * par le aata hai.
   */
  intensity: number;
}

/**
 * Isse kam takat par maan liya jaata hai ki koi bol hi nahi raha.
 *
 * ⚠️ Ye 0 nahi hai, aur wo zaroori hai. Kisi bhi asli recording me — TTS me bhi
 * — bilkul chuppi kabhi nahi hoti; ek halki si sarsarahat hamesha rehti hai. 0
 * par shart lagane se poori reel "bolti hui" ginn'ti hai aur sannata pakda hi
 * nahi jaata.
 */
export const SILENCE_THRESHOLD = 0.08;

/**
 * Itni chhoti chuppi ko chuppi nahi maana jaata.
 *
 * ⚠️ Shabdon ke beech ka jhol (aur `प`/`ट` jaise akshar se pehle ka lamha)
 * bilkul khaali hota hai, par wo bolne ka hi hissa hai. Har aisi jagah par muh
 * band kar dene se chehra bolte-bolte hakla'ne lagta hai.
 */
export const MIN_SILENCE_SECONDS = 0.12;

/**
 * Itni chhoti "bol" ko bol nahi maana jaata.
 *
 * ⚠️ Ek khatka ya saans lene ki awaaz threshold paar kar leti hai. Use bolna maan
 * lene par uspar poora akshar baith jaata hai, aur muh ek aisi jagah chalta hai
 * jahan koi shabd hai hi nahi.
 */
export const MIN_SPEECH_SECONDS = 0.05;

interface Segment {
  start: number;
  end: number;
}

/**
 * Envelope se bolne wale hisse nikaalo.
 *
 * Khaali envelope par poori lambai ko ek hi bolne wala hissa maana jaata hai —
 * yaani jo hi sabse achha kiya ja sakta hai jab awaaz ki koi jaankari hi na ho.
 * Aisi halat me sannate ka pata lagana mumkin hi nahi.
 */
export function speechSegments(
  envelope: readonly number[],
  durationSeconds: number,
): Segment[] {
  if (durationSeconds <= 0) return [];
  if (envelope.length === 0) return [{ start: 0, end: durationSeconds }];

  const perSample = durationSeconds / envelope.length;

  /* Pehle kaccha: jahan takat threshold ke upar hai. */
  const raw: Segment[] = [];
  let from = -1;
  for (let at = 0; at <= envelope.length; at += 1) {
    const loud = at < envelope.length && (envelope[at] ?? 0) > SILENCE_THRESHOLD;
    if (loud && from < 0) from = at;
    if (!loud && from >= 0) {
      raw.push({ start: from * perSample, end: at * perSample });
      from = -1;
    }
  }

  /* Chhoti chuppi ko jodo — wo bolne ka hi hissa hai. */
  const merged: Segment[] = [];
  for (const segment of raw) {
    const last = merged[merged.length - 1];
    if (last && segment.start - last.end < MIN_SILENCE_SECONDS) {
      last.end = segment.end;
      continue;
    }
    merged.push({ ...segment });
  }

  return merged.filter((segment) => segment.end - segment.start >= MIN_SPEECH_SECONDS);
}

/** Us waqt awaaz kitni tez thi (0-1). */
function intensityAt(
  envelope: readonly number[],
  durationSeconds: number,
  atSeconds: number,
): number {
  if (envelope.length === 0 || durationSeconds <= 0) return 1;
  const at = Math.floor((atSeconds / durationSeconds) * envelope.length);
  const clamped = Math.min(envelope.length - 1, Math.max(0, at));
  return Math.min(1, Math.max(0, envelope[clamped] ?? 0));
}

/**
 * Text ki qatar ko awaaz ke bolne wale hisson par bithao.
 *
 * ⚠️ Kadam **sirf bolne wale hisson me** baithte hain, poori lambai par nahi.
 * Yahi is poore function ki wajah hai.
 */
export function buildVisemeTrack(args: {
  steps: readonly VisemeStep[];
  /** Barabar doori par li gayi awaaz ki takat (0-1). */
  envelope: readonly number[];
  /** Awaaz kitni lambi hai. */
  durationSeconds: number;
}): VisemeFrame[] {
  const { envelope, durationSeconds } = args;
  if (durationSeconds <= 0) return [];

  const segments = speechSegments(envelope, durationSeconds);
  const steps = args.steps.filter((step) => step.weight > 0);

  /*
   * Na koi shabd, na koi awaaz — muh poori der band. Ye halat asli hai (khaali
   * text, ya poori tarah chup awaaz) aur ise chup-chaap khaali track lauta kar
   * chhod dena galat hoga: tab render ke paas koi shape hota hi nahi aur muh
   * apni pichhli jagah par jama reh jaata hai.
   */
  if (segments.length === 0 || steps.length === 0) {
    return [{ atSeconds: 0, viseme: REST_VISEME, intensity: 0 }];
  }

  const speechTime = segments.reduce((sum, s) => sum + (s.end - s.start), 0);
  const totalWeight = steps.reduce((sum, step) => sum + step.weight, 0);

  const frames: VisemeFrame[] = [];

  /* Shuruaat me agar chuppi hai to muh band se shuru hota hai. */
  if (segments[0]!.start > 0) {
    frames.push({ atSeconds: 0, viseme: REST_VISEME, intensity: 0 });
  }

  let stepAt = 0;
  /* Maujooda kadam ka kitna hissa abhi baithna baaki hai (0-1). */
  let leftOver = 1;

  segments.forEach((segment, segmentAt) => {
    let cursor = segment.start;
    const segmentEnd = segment.end;

    while (stepAt < steps.length && cursor < segmentEnd - 1e-9) {
      const step = steps[stepAt] as VisemeStep;
      const fullSpan = (step.weight / totalWeight) * speechTime;
      const span = fullSpan * leftOver;

      frames.push({
        atSeconds: cursor,
        viseme: step.viseme,
        intensity: intensityAt(envelope, durationSeconds, cursor),
      });

      if (cursor + span <= segmentEnd + 1e-9) {
        cursor += span;
        stepAt += 1;
        leftOver = 1;
        continue;
      }

      /*
       * ⚠️ Kadam is hisse me poora nahi samaya — wo agle hisse me jaari rahega,
       * poora dobara nahi chalega. Har hisse par naya kadam shuru karne se lambe
       * swar do baar bolte hue dikhte hain, aur chhote hisse par shabd chhoot
       * jaate hain.
       */
      const used = segmentEnd - cursor;
      leftOver -= used / fullSpan;
      cursor = segmentEnd;
    }

    /* Is hisse ke baad chuppi hai to wahan muh band. */
    const next = segments[segmentAt + 1];
    const gapStart = segmentEnd;
    const gapEnd = next ? next.start : durationSeconds;
    if (gapEnd - gapStart > 1e-9) {
      frames.push({ atSeconds: gapStart, viseme: REST_VISEME, intensity: 0 });
    }
  });

  /*
   * ⚠️ Aakhir me hamesha ek `rest`. Iske bina aakhri shape reel ke ant tak jama
   * rehta hai — yaani awaaz khatam hone ke baad bhi muh khula reh jaata hai, aur
   * wo poori reel ka aakhri frame hota hai (jise sabse zyada dekha jaata hai).
   */
  if (frames[frames.length - 1]?.viseme !== REST_VISEME) {
    frames.push({ atSeconds: durationSeconds, viseme: REST_VISEME, intensity: 0 });
  }

  return frames;
}

/** Us lamhe par kaunsa shape chal raha hai — render har frame par yahi poochhta hai. */
export function visemeAt(track: readonly VisemeFrame[], atSeconds: number): VisemeFrame {
  const rest: VisemeFrame = { atSeconds: 0, viseme: REST_VISEME, intensity: 0 };
  if (track.length === 0) return rest;

  /*
   * ⚠️ Peeche se aage dhoondha jaata hai, aur wo jaan-boojhkar hai: sabse aam
   * sawaal "abhi ka lamha" hota hai, jo aksar ant ke paas hota hai. Aage se
   * dhoondhne par har frame par poora track chhana jaata — 30fps par 60 second ki
   * reel me wo 1800 baar hota hai.
   */
  for (let at = track.length - 1; at >= 0; at -= 1) {
    const frame = track[at] as VisemeFrame;
    if (frame.atSeconds <= atSeconds + 1e-9) return frame;
  }
  return track[0] as VisemeFrame;
}

/* ------------------------------------------------------- shape ka safar */

/**
 * Ek shape se doosre par pahunchne me itna waqt lagta hai.
 *
 * ⚠️ Bina iske muh ek shape se doosre par **jhatke se** koodta hai, aur wo
 * bolne jaisa nahi — flipbook jaisa lagta hai. Asli honth kabhi turant apni
 * jagah nahi badalte; unhe pahunchne me kuch lamha lagta hai, aur wahi lamha
 * "bolna" dikhata hai.
 *
 * ⚠️ 70ms jaan-boojhkar hai. Isse chhota rakhne par jhatka wapas aa jaata hai;
 * isse bada rakhne par honth kabhi apne poore shape tak pahunchte hi nahi aur
 * har awaaz ek jaisi dikhne lagti hai — yaani wahi "chabaana" jisse hum bach
 * rahe the.
 */
export const VISEME_BLEND_SECONDS = 0.07;

/** Do shape ke beech ka shape. */
function mix(from: VisemeShape, to: VisemeShape, t: number): VisemeShape {
  const at = t < 0 ? 0 : t > 1 ? 1 : t;
  /* Narm dhalaan — seedhi lakeer par shuruaat aur ant dono par jhatka lagta hai. */
  const eased = at * at * (3 - 2 * at);
  const blend = (a: number, b: number): number => a + (b - a) * eased;
  return {
    id: to.id,
    label: to.label,
    open: blend(from.open, to.open),
    wide: blend(from.wide, to.wide),
    round: blend(from.round, to.round),
  };
}

export interface VisemeState {
  shape: VisemeShape;
  intensity: number;
}

/**
 * Us lamhe par muh sach me kaisa hai — **do shape ke beech ka**.
 *
 * ⚠️ `visemeAt` sirf ye batata hai ki kaunsa shape "chal raha hai". Render ko
 * usse zyada chahiye: do shape ke beech ka safar. Sirf `visemeAt` par render
 * karne par har frame ek poora shape hota hai aur beech ka kuch nahi — muh
 * chalta hua nahi, badalta hua dikhta hai.
 */
export function visemeStateAt(
  track: readonly VisemeFrame[],
  atSeconds: number,
  blendSeconds: number = VISEME_BLEND_SECONDS,
): VisemeState {
  const rest = getVisemeShape(REST_VISEME) as VisemeShape;
  if (track.length === 0) return { shape: rest, intensity: 0 };

  let index = 0;
  for (let at = track.length - 1; at >= 0; at -= 1) {
    if ((track[at] as VisemeFrame).atSeconds <= atSeconds + 1e-9) {
      index = at;
      break;
    }
  }

  const current = track[index] as VisemeFrame;
  const shape = getVisemeShape(current.viseme) ?? rest;
  const previous = index > 0 ? track[index - 1] : undefined;
  if (!previous || blendSeconds <= 0) return { shape, intensity: current.intensity };

  const since = atSeconds - current.atSeconds;
  if (since >= blendSeconds) return { shape, intensity: current.intensity };

  const from = getVisemeShape(previous.viseme) ?? rest;
  const t = since / blendSeconds;
  return {
    shape: mix(from, shape, t),
    intensity: previous.intensity + (current.intensity - previous.intensity) * t,
  };
}
