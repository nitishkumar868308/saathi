/**
 * Voice cleanup / "makeup" chain — **data, hardcoded pipeline nahi** (22.7).
 *
 * ⚠️ Har kadam ek entry hai, aur unka **kram badla ja sakta hai**. Ye zaroori
 * hai kyunki audio me kram sach me farak deta hai:
 *
 *  - `highpass` **normalize se pehle** hona chahiye. Ulta karne par 40 Hz ka wo
 *    rumble bhi loudness ki ginti me aa jaata hai jise hum agle hi kadam me
 *    hata dete hain — aur nateeja ye ki asli awaaz target se neeche reh jaati hai.
 *  - `limiter` **sabse aakhir** me. Uske baad kuch bhi lagane par peak dobara
 *    upar ja sakta hai, aur `-1 dBTP` ka poora vaada toot jaata hai.
 *
 * Ek tay pipeline likh dena aasan hota par tab in dono baaton ko badalna
 * namumkin ho jaata — aur galat kram ka nateeja sirf kaan se pakda jaata hai.
 */

export type CleanupStepId =
  | "trimSilence"
  | "highpass"
  | "deesser"
  | "noiseReduction"
  | "compand"
  | "normalize"
  | "limiter";

export interface CleanupStepEntry {
  id: CleanupStepId;
  label: string;
  hint: string;
  /**
   * FFmpeg filter — `null` matlab is kadam ka apna filter nahi hai (wo alag se
   * lagta hai, jaise `trimSilence` do jagah `silenceremove` maangta hai).
   */
  filter(params: Record<string, number | boolean>): string | null;
  defaults: Record<string, number | boolean>;
}

/** Voice ka apna loudness target — mix se alag (22.7). */
export const VOICE_TARGET_LUFS = -16;

/**
 * Cleanup ke kadam.
 *
 * ⚠️ Ye list **kram me** hai aur wahi default kram hai. `CleanupConfig.order`
 * se use badla ja sakta hai.
 */
export const CLEANUP_STEPS: readonly CleanupStepEntry[] = [
  {
    id: "trimSilence",
    label: "Khaali hissa kaato",
    hint: "Shuru aur ant ki chuppi hata do — TTS aur recording dono me wo hoti hai",
    defaults: { thresholdDb: -50, minSilenceMs: 300 },
    filter: (params) => {
      const threshold = Number(params.thresholdDb ?? -50);
      const seconds = Number(params.minSilenceMs ?? 300) / 1000;
      /*
       * Do baar `silenceremove`: ek shuruaat ke liye, aur ek `areverse` ke saath
       * ant ke liye. FFmpeg ka `silenceremove` seedha ant ka hissa nahi kaat
       * sakta — ye us kami ka standard tarika hai.
       */
      return (
        `silenceremove=start_periods=1:start_duration=${seconds}:start_threshold=${threshold}dB:detection=peak,` +
        `areverse,` +
        `silenceremove=start_periods=1:start_duration=${seconds}:start_threshold=${threshold}dB:detection=peak,` +
        `areverse`
      );
    },
  },

  {
    id: "highpass",
    label: "Gadgadahat hatao",
    hint: "80 Hz ke neeche ka rumble — mez ki thap, AC, traffic",
    defaults: { hz: 80 },
    filter: (params) => `highpass=f=${Number(params.hz ?? 80)}`,
  },

  {
    id: "noiseReduction",
    label: "Shor kam karo",
    hint: "Halka background shor — zyada lagane par awaaz dhaatu jaisi ho jaati hai",
    defaults: { strength: 12 },
    filter: (params) => {
      /*
       * `afftdn` ka `nr` 12 dB par rakha gaya hai. 25+ par awaaz "underwater"
       * lagne lagti hai — aur wo galti sirf sunne par pakdi jaati hai, isliye
       * default halka rakha hai.
       */
      const strength = Math.min(30, Math.max(0, Number(params.strength ?? 12)));
      return `afftdn=nr=${strength}:nf=-25`;
    },
  },

  {
    id: "deesser",
    label: "Sss kam karo",
    hint: "Teekhi 's' ki awaaz — sirf tab jab wo sach me chubhe",
    defaults: { intensity: 0.4 },
    filter: (params) => {
      const intensity = Math.min(1, Math.max(0, Number(params.intensity ?? 0.4)));
      return `deesser=i=${intensity}`;
    },
  },

  {
    id: "compand",
    label: "Awaaz bhari karo",
    hint: "Halki compression — dheemi baatein upar aati hain, awaaz paas lagti hai",
    defaults: { ratio: 2 },
    filter: () =>
      /*
       * Ek halka, tay compressor. Params khole nahi gaye kyunki compand ki
       * likhawat me ek chhoti galti bhi awaaz ko poori tarah bigaad deti hai —
       * aur wo galti render ke baad hi pata chalti hai.
       */
      "compand=attacks=0.02:decays=0.2:points=-60/-60|-30/-18|-12/-9|0/-6",
  },

  {
    id: "normalize",
    label: "Level theek karo",
    hint: `Voice ka apna target ${VOICE_TARGET_LUFS} LUFS — mix se alag`,
    defaults: { lufs: VOICE_TARGET_LUFS },
    filter: (params) => {
      const target = Number(params.lufs ?? VOICE_TARGET_LUFS);
      // `linear=true` — poori file par ek hi gain. Iske bina loudnorm dynamic
      // chalta hai aur ek hi line ke andar awaaz ghatti-badhti rehti hai.
      return `loudnorm=I=${target}:TP=-1.5:LRA=11:linear=true`;
    },
  },

  {
    id: "limiter",
    label: "Chhat lagao",
    hint: "True peak -1 dBTP se upar kabhi nahi",
    defaults: { ceilingDb: -1 },
    filter: (params) => {
      const ceiling = Number(params.ceilingDb ?? -1);
      // `alimiter` ka `limit` linear hota hai, dB nahi.
      const limit = 10 ** (ceiling / 20);
      return `alimiter=limit=${limit.toFixed(4)}:level=false`;
    },
  },
];

export function findCleanupStep(id: string): CleanupStepEntry | undefined {
  return CLEANUP_STEPS.find((step) => step.id === id);
}

export interface CleanupConfig {
  /** Kaun se kadam chalu hain. */
  enabled: Partial<Record<CleanupStepId, boolean>>;
  /** Har kadam ke apne params. */
  params?: Partial<Record<CleanupStepId, Record<string, number | boolean>>>;
  /** Kram — na do to `CLEANUP_STEPS` wala hi kram. */
  order?: readonly CleanupStepId[];
}

/**
 * Har voice ke liye default — **sirf wo kadam jo lagbhag hamesha sahi hote hain**.
 *
 * ⚠️ `noiseReduction` aur `deesser` default me **band** hain, aur ye jaan-boojhkar
 * hai. Dono achhi recording ko kharab kar sakte hain (awaaz "underwater" ya patli
 * ho jaati hai), aur unki zaroorat sirf kuch recordings me hoti hai. Sab kuch on
 * kar dena aasan hota par tab har voice thodi si nakli lagti — aur wajah kabhi
 * pakad me nahi aati.
 */
export const DEFAULT_CLEANUP: CleanupConfig = {
  enabled: {
    trimSilence: true,
    highpass: true,
    noiseReduction: false,
    deesser: false,
    compand: true,
    normalize: true,
    limiter: true,
  },
};

/**
 * Config se FFmpeg ka filter chain banao.
 *
 * ⚠️ Kram ka niyam yahin lagta hai, UI me nahi: `limiter` hamesha aakhir me
 * jaata hai, chahe user ne use kahin bhi rakha ho. Uske baad kuch bhi lagane
 * par peak dobara upar ja sakta hai aur `-1 dBTP` ka vaada toot jaata hai —
 * aur wo vaada Section 3A me likha hua hai.
 */
export function cleanupFilterChain(config: CleanupConfig = DEFAULT_CLEANUP): string[] {
  const order = config.order ?? CLEANUP_STEPS.map((step) => step.id);

  const chosen = order
    .filter((id) => config.enabled[id])
    .filter((id, index, list) => list.indexOf(id) === index);

  // Limiter ko aakhir me le jao — bina bataye, kyunki uske bina vaada jhootha ho jaata.
  const withoutLimiter = chosen.filter((id) => id !== "limiter");
  const finalOrder = chosen.includes("limiter")
    ? [...withoutLimiter, "limiter" as CleanupStepId]
    : withoutLimiter;

  const filters: string[] = [];
  for (const id of finalOrder) {
    const step = findCleanupStep(id);
    if (!step) continue;
    const params = { ...step.defaults, ...(config.params?.[id] ?? {}) };
    const filter = step.filter(params);
    if (filter) filters.push(filter);
  }
  return filters;
}

/** Chain ek hi string me — `-af` ke liye. `null` = kuch karna hi nahi. */
export function cleanupFilterString(config: CleanupConfig = DEFAULT_CLEANUP): string | null {
  const filters = cleanupFilterChain(config);
  return filters.length > 0 ? filters.join(",") : null;
}
