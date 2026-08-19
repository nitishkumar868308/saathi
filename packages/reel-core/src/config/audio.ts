/**
 * Audio ke sthir number — ek jagah (15.1 / 15.5 / 15.6).
 *
 * Ye sab kahin aur likhe hote to ek din preview -18 dB duck karta aur render -20,
 * aur wo farak sirf kaan se pakda jaata — jo sabse mehnga tarika hai.
 */

/** Master ka default. 1 = jaisa hai. */
export const DEFAULT_MASTER_VOLUME = 1;

/** Section 3A ka loudness bar — Phase 11 ka `finalizeMp4` yahi target leta hai. */
export const DEFAULT_LOUDNESS_LUFS = -14;

/** True-peak ki hadd. Isse upar jaane par clipping sunai deti hai. */
export const TRUE_PEAK_CEILING_DB = -1;

/** Ducking ke defaults — music ko itna neeche laate hain jab voice chal rahi ho. */
export const DEFAULT_DUCK_TARGET_DB = -18;
export const DEFAULT_DUCK_ATTACK_FRAMES = 6;
export const DEFAULT_DUCK_RELEASE_FRAMES = 15;

/**
 * Volume slider ki hadd, dB me.
 *
 * `-60` ko "bilkul chup" maana jaata hai: usse neeche insaan ka kaan farak nahi
 * kar paata, par slider ka nichla hissa poora usi bekaar range me chala jaata
 * hai. Upar `+12` — usse zyada amplification me shor bhi utna hi upar aata hai.
 */
export const MIN_VOLUME_DB = -60;
export const MAX_VOLUME_DB = 12;

/** Linear gain -> dB. 0 par `-Infinity` nahi, `MIN_VOLUME_DB` — taaki UI toote nahi. */
export function gainToDb(gain: number): number {
  if (!Number.isFinite(gain) || gain <= 0) return MIN_VOLUME_DB;
  return Math.max(MIN_VOLUME_DB, 20 * Math.log10(gain));
}

/** dB -> linear gain. `MIN_VOLUME_DB` par theek 0, taaki "chup" sach me chup ho. */
export function dbToGain(db: number): number {
  if (!Number.isFinite(db) || db <= MIN_VOLUME_DB) return 0;
  return 10 ** (db / 20);
}

/**
 * Fade ka aakaar.
 *
 * `equal-power` default hai aur ye ek naapi hui baat hai: seedhi (linear) fade
 * me beech me awaaz **dab jaati** hai, kyunki kaan power sunta hai, amplitude
 * nahi. Do cheezein cross-fade karo to beech me ek gaddha ban jaata hai. Sine
 * curve us gaddhe ko bharti hai.
 */
export const FADE_SHAPES = ["equal-power", "linear"] as const;
export type FadeShape = (typeof FADE_SHAPES)[number];
export const DEFAULT_FADE_SHAPE: FadeShape = "equal-power";

/** 0..1 me fade ka gain. `t` = fade ke andar kitna aage. */
export function fadeGain(t: number, shape: FadeShape): number {
  const clamped = Math.min(1, Math.max(0, t));
  if (shape === "linear") return clamped;
  return Math.sin((clamped * Math.PI) / 2);
}

/* ------------------------------------------------------------- clip speed */

/**
 * Speed ki hadd (15.7).
 *
 * `0.25` se neeche har frame 4 baar dikhta hai aur video jhatke khaane lagti
 * hai — us se dheema chahiye to freeze frame ya interpolation chahiye, speed
 * nahi. `4` se upar audio `atempo` ke ek pass me nahi aata aur pitch bikharne
 * lagti hai.
 */
export const MIN_PLAYBACK_RATE = 0.25;
export const MAX_PLAYBACK_RATE = 4;

/**
 * Freeze frame ka playbackRate.
 *
 * Theek `0` nahi ho sakta: schema `positive` maangta hai, aur bacha-hua-source
 * wale hisaab me isse bhaag diya jaata hai. Itne chhote number par 300 frames me
 * source sirf 0.03 frame aage badhta hai — aankh ko bilkul sthir.
 */
export const FREEZE_PLAYBACK_RATE = 0.0001;
