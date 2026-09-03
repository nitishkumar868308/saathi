/**
 * Awaaz ki takat, waqt ke saath — muh ke track ka aadha aadhaar.
 *
 * ⚠️ Ye hisaab yahan hai, studio me nahi, aur wajah wahi hai jo poore `@reel/core`
 * ki hai: iski galti **dikhti nahi**. Thoda galat envelope par muh bas "thoda
 * ajeeb" chalta hai — koi error nahi, koi khaali frame nahi. Yahan hone se ise ek
 * script se naapa ja sakta hai, bina koi awaaz banaye.
 *
 * ⚠️ Studio ka kaam sirf itna hai: file utaaro, `decodeAudioData` se saade
 * number nikaalo, aur yahan de do.
 */

/**
 * Ek second me kitne naap — 50 yaani har 20 millisecond par ek.
 *
 * ⚠️ Isse kam par shabdon ke beech ki chhoti chuppi (jo aksar 60-100ms ki hoti
 * hai) naap me aati hi nahi, aur muh un par band nahi hota. Isse zyada rakhna
 * bekaar hai: muh 30fps par render hota hai, yaani har 33ms me ek baar — usse
 * baareek jaankari kabhi dikh hi nahi sakti.
 */
export const ENVELOPE_PER_SECOND = 50;

export function rmsEnvelope(args: {
  /** Mono PCM, -1 se 1. */
  samples: ArrayLike<number>;
  sampleRate: number;
  perSecond?: number;
}): number[] {
  const { samples, sampleRate } = args;
  const perSecond = args.perSecond ?? ENVELOPE_PER_SECOND;

  if (samples.length === 0 || sampleRate <= 0 || perSecond <= 0) return [];

  const perBucket = Math.max(1, Math.round(sampleRate / perSecond));
  const buckets = Math.ceil(samples.length / perBucket);

  const raw: number[] = [];
  for (let at = 0; at < buckets; at += 1) {
    const from = at * perBucket;
    const to = Math.min(samples.length, from + perBucket);

    /*
     * RMS, ausat nahi. Awaaz ki lehar upar-neeche jaati hai, isliye seedha ausat
     * lagbhag hamesha 0 ke paas nikalta hai — chahe awaaz kitni bhi tez ho.
     */
    let sum = 0;
    for (let i = from; i < to; i += 1) {
      const value = samples[i] ?? 0;
      sum += value * value;
    }
    raw.push(Math.sqrt(sum / Math.max(1, to - from)));
  }

  /*
   * ⚠️ Normalize zaroori hai, aur ye sabse aasani se chhoot jaane wala kadam hai.
   * TTS ki awaaz aksar dheemi hoti hai (-20 dB ke aas-paas), aur uska kaccha RMS
   * `SILENCE_THRESHOLD` se neeche reh jaata hai — yaani poori reel "chup" ginn'ti
   * hai aur muh kabhi khulta hi nahi. Aur wo galti bilkul chup reel jaisi dikhti
   * hai, jiski wajah dhoondhna sabse mushkil hota hai.
   */
  let loudest = 0;
  for (const value of raw) if (value > loudest) loudest = value;
  if (loudest <= 0) return raw.map(() => 0);

  return raw.map((value) => Math.min(1, value / loudest));
}

/**
 * Do channel ko ek me milao — envelope ke liye stereo ka koi matlab nahi.
 *
 * ⚠️ Sirf baayan channel lena galat hota: kai recording me ek channel dheema ya
 * bilkul khaali hota hai, aur us halat me poori awaaz "chup" ginn'ti hai.
 */
export function toMono(channels: readonly ArrayLike<number>[]): Float32Array {
  if (channels.length === 0) return new Float32Array(0);
  const first = channels[0] as ArrayLike<number>;
  if (channels.length === 1) return Float32Array.from(first as ArrayLike<number>);

  const out = new Float32Array(first.length);
  for (let at = 0; at < out.length; at += 1) {
    let sum = 0;
    for (const channel of channels) sum += channel[at] ?? 0;
    out[at] = sum / channels.length;
  }
  return out;
}
