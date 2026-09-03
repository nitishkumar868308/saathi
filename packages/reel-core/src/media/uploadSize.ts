import { MAX_CLEAN_UPSCALE, planFit, type FitSize } from "./fitPlan";

/**
 * Ye file reel me kaam aayegi ya nahi — **upload se pehle** (naap ki rok).
 *
 * ⚠️ Ye jaanch abhi tak **baad me** hoti thi: wizard me tasveer chunte waqt
 * (`requiredVisualSize`), ya export ke validator me. Dono jagah sach to batati
 * thi, par tab tak bytes storage par ja chuke hote the. Ek 480p tasveer jo reel
 * me kabhi kaam aa hi nahi sakti, wo bhi hamesha ke liye jagah ghere baithi
 * rehti hai — aur us jagah ka bojh baaki sab par dikhta hai.
 *
 * ⚠️ **Rok pixel ki kami par hai, aspect par nahi.** 1920x1080 ka landscape
 * video 1080x1920 ki reel me bilkul chalega — wo contain + apne hi dhundhle roop
 * se baithta hai, aur wo ek chuna hua raasta hai (`CONTAIN_BACKGROUNDS` ka
 * `blurred-asset`). Use rok dena aadmi ki sahi footage ko mana karna hota. Rukti
 * sirf wo file hai jo *kisi bhi* tarah bithane par phail kar dhundhli hogi.
 *
 * ⚠️ Zoom ka hisaab **lagta hai**, aur wo `planFit` wala hi zoom hai
 * (`MAX_ANIMATION_ZOOM`). Ye pehle nahi lagta tha, aur uski keemat seedhi thi:
 * ek tasveer upload me nikal jaati thi par scene par uska cover ho hi nahi paata
 * tha, isliye wo chup-chaap `contain` par gir jaati — yaani kinaron par dhundhli
 * pattiyan, theek wo cheez jo nahi chahiye thi.
 *
 * Dono jagah ek hi zoom hone ka matlab ek saaf vaada hai: **jo file upload me
 * nikal gayi, wo scene me poora frame bharegi** — chahe koi bhi harkat lage.
 */

export interface UploadSizeVerdict {
  ok: boolean;
  /** Kam se kam itna naap chahiye — `null` jab rok lagti hi nahi. */
  required: FitSize | null;
  /** Kitna phailna padega (1 = bilkul nahi). */
  upscale: number;
  message: string | null;
}

export function checkUploadSize(args: {
  filename: string;
  /** Is kism ke pixels hote hain? (`AssetKindEntry.hasPixels`) */
  hasPixels: boolean;
  /** File ka apna naap — `null` = pata nahi. */
  source: FitSize | null;
  /** Project ka frame — `null` = pata nahi. */
  frame: FitSize | null;
}): UploadSizeVerdict {
  const pass: UploadSizeVerdict = { ok: true, required: null, upscale: 1, message: null };

  if (!args.hasPixels) return pass;
  if (!args.frame || args.frame.width <= 0 || args.frame.height <= 0) return pass;
  if (!args.source || args.source.width <= 0 || args.source.height <= 0) return pass;

  const plan = planFit({ source: args.source, frame: args.frame });
  if (!plan) return pass;
  if (plan.upscale <= MAX_CLEAN_UPSCALE) return { ...pass, upscale: plan.upscale };

  /*
   * Jis naap par phailna 1x ho jaata hai — yaani "itna chahiye". Ye wahi hisaab
   * hai jo `checkUpscale` ka `requiredSource` deta hai. Do jagah do alag number
   * dikhne par aadmi dono par bharosa kho deta hai.
   */
  const required: FitSize = {
    width: Math.ceil(args.source.width * plan.upscale),
    height: Math.ceil(args.source.height * plan.upscale),
  };

  return {
    ok: false,
    required,
    upscale: plan.upscale,
    message:
      `"${args.filename}" ${args.source.width}x${args.source.height} ka hai. ` +
      `${args.frame.width}x${args.frame.height} ki reel me ye ${plan.upscale.toFixed(1)}x phailegi — ` +
      `kam se kam ${required.width}x${required.height} chahiye. Isse chhoti file dhundhli aayegi.`,
  };
}
