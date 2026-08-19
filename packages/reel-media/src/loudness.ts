import { ffmpegPath, run } from "./ffmpeg";

/**
 * Loudness — README Section 3A ka audio wala aadha hissa (11.3).
 *
 * ⚠️ **Ye do-pass hai, aur ek-pass wala tarika jaan-boojhkar nahi liya.**
 * `loudnorm` bina naap ke (single-pass) bhi chal jaata hai, par wo "dynamic"
 * mode me chalta hai — poori file ko dekhe bina hi gain badalta rehta hai, aur
 * nateeja file-dar-file alag aata hai. Ek reel ke liye wo aur bura hai: shuru me
 * awaaz theek lagti hai aur beech me dab jaati hai. Do-pass me pehle poori file
 * naapi jaati hai, phir ek hi (linear) gain lagti hai — jaisa ek video me hona
 * chahiye.
 *
 * ⚠️ **Video ko haath nahi lagta.** Section 3A ka "single encode" rule yahi
 * hai: `-c:v copy`. Sirf audio dobara encode hoti hai. Video re-encode karne se
 * quality ka nuksaan hota hai jo `ffprobe` me dikhta bhi nahi — sirf aankh se
 * pata chalta hai, aur tab tak bahut der ho chuki hoti hai.
 */

/** Social ka standard: -14 LUFS. YouTube/Instagram isi ke aas-paas normalize karte hain. */
export const TARGET_LUFS = -14;

/** True peak ki chhat. -1 dBTP rakhne se lossy encode ke baad bhi clipping nahi hoti. */
export const TARGET_TRUE_PEAK = -1;

/** Loudness range — kitna utaar-chadhaav chalne dena hai. */
export const TARGET_LRA = 11;

/** Voice track ka apna sample rate: 48kHz (Section 3A). */
export const TARGET_SAMPLE_RATE = 48_000;

export interface LoudnessMeasurement {
  /** Integrated loudness (LUFS). */
  inputI: number;
  /** True peak (dBTP). */
  inputTP: number;
  /** Loudness range. */
  inputLRA: number;
  inputThresh: number;
  targetOffset: number;
}

/**
 * `loudnorm` ka pehla pass — sirf naapta hai, kuch badalta nahi.
 *
 * ⚠️ Output `stderr` par aata hai, `stdout` par nahi (ffmpeg apni saari
 * report stderr par likhta hai), aur usme JSON ke aage-peeche aur bhi lines
 * hoti hain. Isliye pehla `{` se aakhri `}` tak kaata jaata hai.
 */
export async function measureLoudness(input: string): Promise<LoudnessMeasurement | null> {
  const result = await run(ffmpegPath(), [
    "-hide_banner",
    "-nostats",
    "-i",
    input,
    "-af",
    `loudnorm=I=${TARGET_LUFS}:TP=${TARGET_TRUE_PEAK}:LRA=${TARGET_LRA}:print_format=json`,
    "-f",
    "null",
    "-",
  ]);

  const text = result.stderr;
  const start = text.lastIndexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;

  try {
    const data = JSON.parse(text.slice(start, end + 1)) as Record<string, string>;
    const numbers = {
      inputI: Number(data.input_i),
      inputTP: Number(data.input_tp),
      inputLRA: Number(data.input_lra),
      inputThresh: Number(data.input_thresh),
      targetOffset: Number(data.target_offset),
    };
    // `-inf` tab aata hai jab track bilkul chup ho. Us par normalize karne ki
    // koshish karna bekaar hai (aur ffmpeg wahan ajeeb gain lagata hai).
    if (Object.values(numbers).some((value) => !Number.isFinite(value))) return null;
    return numbers;
  } catch {
    return null;
  }
}

/**
 * Sirf naapne wala EBU R128 — verify karne ke liye (11.14 ka loudness proof).
 *
 * `loudnorm` ke pehle pass se ye alag hai: wo normalize ke liye naapta hai, ye
 * seedha "is file ki loudness kya hai" batata hai. Dono ke number thode alag ho
 * sakte hain, isliye jo cheez **saabit** karni ho uske liye yahi sahi hai.
 */
export interface Ebur128Result {
  integratedLufs: number | null;
  truePeakDb: number | null;
  lra: number | null;
}

export async function measureEbur128(input: string): Promise<Ebur128Result> {
  const result = await run(ffmpegPath(), [
    "-hide_banner",
    "-nostats",
    "-i",
    input,
    "-af",
    "ebur128=peak=true",
    "-f",
    "null",
    "-",
  ]);

  const text = result.stderr;
  // Summary ffmpeg ke ant me aati hai; usi aakhri block ko padhna hai.
  const summary = text.slice(text.lastIndexOf("Summary:"));
  const pick = (label: string): number | null => {
    const match = new RegExp(`${label}:\\s*(-?[\\d.]+|-inf)`).exec(summary);
    if (!match) return null;
    const value = Number(match[1]);
    return Number.isFinite(value) ? value : null;
  };

  return {
    integratedLufs: pick("I"),
    truePeakDb: pick("Peak"),
    lra: pick("LRA"),
  };
}

export interface FinalizeOptions {
  /** Loudness normalize karni hai? Bina audio wali file par apne aap skip. */
  normalizeLoudness: boolean;
  audioBitrateKbps: number;
  /** Pehle se naapi hui loudness — na ho to yahin naap li jaati hai. */
  measurement?: LoudnessMeasurement | null;
  /**
   * Project ka apna loudness target (15.6). Na do to Section 3A ka -14 LUFS.
   *
   * ⚠️ Ye argument isliye hai ki volume ka ganit **do jagah na ho**. Master
   * section me user jo number chunta hai wahi seedha yahan aata hai; agar UI
   * apna alag hisaab lagakar item volumes badal deti, to project file kholne par
   * user ke apne set kiye hue volume badle hue milte.
   */
  targetLufs?: number;
  /**
   * True-peak limiter (15.6). Band karne par `TP` ki hadd nahi lagti.
   *
   * Band karne ka option isliye hai ki kuch platform khud normalize karte hain
   * aur do baar limit karna awaaz ko chapta kar deta hai.
   */
  limiter?: boolean;
}

export interface FinalizeResult {
  /** Loudness sach me lagayi gayi? */
  normalized: boolean;
  measurement: LoudnessMeasurement | null;
  /** Kyun nahi lagayi (agar nahi lagayi). */
  skippedReason: string | null;
}

/**
 * Aakhri FFmpeg pass — faststart, aur zaroorat ho to loudness (11.2 / 11.3).
 *
 * Section 3A ne is pass ka daayra tay kar diya hai: **remux, faststart, aur
 * audio loudness — bas.** Isliye yahan `-c:v copy` pakka hai. Do jagah ye
 * likhna aasan tha (worker me aur yahan), par tab ek din koi `-c:v libx264`
 * daal deta aur double-encode chup-chaap chalu ho jaata.
 */
export async function finalizeMp4(
  input: string,
  output: string,
  options: FinalizeOptions,
): Promise<FinalizeResult> {
  const base = ["-hide_banner", "-loglevel", "error", "-y", "-i", input];

  if (!options.normalizeLoudness) {
    await run(ffmpegPath(), [
      ...base,
      "-c",
      "copy",
      "-map",
      "0",
      "-movflags",
      "+faststart",
      output,
    ]);
    return { normalized: false, measurement: null, skippedReason: "normalize band tha" };
  }

  const measurement = options.measurement ?? (await measureLoudness(input));
  if (!measurement) {
    /*
     * Naap na ho paayi — aksar iska matlab hai ki file me audio hai hi nahi, ya
     * poori tarah chup hai. Aise me chupchaap koi gain laga dena galat hoga:
     * chup track par loudnorm bahut bada gain lagakar shor bhar deta hai.
     * Isliye sirf faststart, aur wajah bulane wale ko lauta di jaati hai.
     */
    await run(ffmpegPath(), [...base, "-c", "copy", "-map", "0", "-movflags", "+faststart", output]);
    return {
      normalized: false,
      measurement: null,
      skippedReason: "audio nahi mili ya bilkul chup hai — loudness nahi lagayi",
    };
  }

  const targetI = options.targetLufs ?? TARGET_LUFS;
  /*
   * Limiter band ho to bhi `TP` dena padta hai — `loudnorm` bina TP ke chalta hi
   * nahi. Tab use 0 dBTP par rakh dete hain: yaani hadd sirf wahan lagti hai
   * jahan digital clipping shuru hoti hai, uske pehle nahi.
   */
  const targetTP = options.limiter === false ? 0 : TARGET_TRUE_PEAK;

  const filter = [
    `loudnorm=I=${targetI}`,
    `TP=${targetTP}`,
    `LRA=${TARGET_LRA}`,
    `measured_I=${measurement.inputI}`,
    `measured_TP=${measurement.inputTP}`,
    `measured_LRA=${measurement.inputLRA}`,
    `measured_thresh=${measurement.inputThresh}`,
    `offset=${measurement.targetOffset}`,
    // `linear=true` = poori file par ek hi gain. Iske bina loudnorm dynamic
    // chalta hai aur ek hi reel ke andar awaaz ghatti-badhti rehti hai.
    "linear=true",
    "print_format=summary",
  ].join(":");

  await run(ffmpegPath(), [
    ...base,
    "-map",
    "0",
    // ⚠️ Video ko haath nahi — Section 3A ka single-encode rule.
    "-c:v",
    "copy",
    "-af",
    filter,
    "-c:a",
    "aac",
    "-b:a",
    `${options.audioBitrateKbps}k`,
    "-ar",
    String(TARGET_SAMPLE_RATE),
    "-ac",
    "2",
    "-movflags",
    "+faststart",
    output,
  ]);

  return { normalized: true, measurement, skippedReason: null };
}
