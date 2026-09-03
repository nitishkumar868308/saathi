import { sha256Hex } from "../hash/sha256";
import { ANIMATION_PRESETS } from "../config/animationPresets";

/**
 * Tasveer/video ko frame me fit karne ka **poora faisla** — sirf hisaab (26.25).
 *
 * ⚠️ Yahan koi ffmpeg nahi, koi fetch nahi, koi React nahi. Wajah wahi hai jo
 * poore `@reel/core` ki hai: ye hisaab UI ko bhi chahiye (chetavni dikhane ke
 * liye, tasveer chunte hi) aur server ko bhi (file sach me banane ke liye). Do
 * jagah likhne par wo ek din alag ho jaate hain — screen "saaf rahegi" bolti aur
 * bani hui file dhundhli hoti, aur wo farak sirf reel dekh kar pakda jaata.
 *
 * ⚠️ Ye faisla **AI nahi karta**, aur karna bhi nahi chahiye. Naap ka sawaal ek
 * ginti ka sawaal hai: source kitna bada hai, frame kitna bada hai, harkat usse
 * kitna aur bada karegi. Uska ek hi sahi jawab hota hai, aur wo har baar wahi
 * hona chahiye — warna ek hi tasveer do baar daalne par do alag nateeje aate
 * hain, aur unki wajah kisi ko samajh nahi aati.
 */

export interface FitSize {
  width: number;
  height: number;
}

/**
 * Kis tarah baithegi.
 *
 * - `cover`   — frame poora bharta hai, kinare kat jaate hain
 * - `contain` — poori tasveer dikhti hai, kinare uske dhundhle roop se bharte hain
 *
 * ⚠️ Naam `MediaFitMode` hai, `FitMode` nahi — wo `config/fit.ts` ka hai aur usme
 * chaar roop hain (`fill` aur `custom` bhi). File **banate** waqt un dono ka koi
 * matlab nahi: `fill` chehre kheench deta hai, aur `custom` ka matlab hi ye hai ki
 * naap aadmi khud tay karega. Dono naam ek karne par ye baat kahin likhi hi nahi
 * jaati, aur ek din koi `fill` yahan bhej deta hai.
 */
export type MediaFitMode = "cover" | "contain";

export interface FitWarning {
  /** `warn` = nateeja pakka bura hai. `tip` = jaanne layak hai, par theek hai. */
  level: "warn" | "tip";
  text: string;
}

export interface FitPlan {
  /** Bani hui file ka naap — frame jitna, harkat ke zoom ke saath. */
  target: FitSize;
  mode: MediaFitMode;
  /** `contain` par kinare usi tasveer ke dhundhle roop se bharte hain. */
  blurredEdges: boolean;
  /** Harkat kitna zoom karti hai (1 = bilkul nahi). */
  zoom: number;
  /**
   * Source ko kitna phailana padega (1 = bilkul nahi, 2 = do guna).
   *
   * ⚠️ Yahi wo ek number hai jispar "dhundhli aayegi" ka poora faisla khada hai.
   * File ka naam, uska size, uska "4K" wala label — teeno jhooth bol sakte hain;
   * ye nahi.
   */
  upscale: number;
  /** `cover` par kitna hissa kat jaayega — 0 se 1 (0.2 = 20% kat gaya). */
  cropped: { width: number; height: number };
  warnings: FitWarning[];
}

/**
 * Isse zyada phailna dikhna shuru ho jaata hai.
 *
 * ⚠️ 1.6 par hadd hai, 1.0 par nahi — aur ye wahi number hai jo `fitFor()` bhi
 * lagata hai. Thoda sa phailna (1.2-1.4x) aankh pakadti nahi, aur us par poora
 * frame bharna hamesha behtar dikhta hai. Dono jagah alag hadd rakhne par wizard
 * ek baat kehta aur bani hui file doosri karti.
 */
export const MAX_CLEAN_UPSCALE = 1.6;

/**
 * Isse zyada kat jaana chetavni layak hai.
 *
 * ⚠️ Kinare kat jaana apne aap me galat nahi hai — reel me cover hi aam hai. Par
 * jab tasveer ka teesra hissa frame ke bahar chala jaaye, to aksar wahi hissa
 * jaata hai jiske liye tasveer chuni gayi thi (chehra, product, likha hua). Us
 * halat me aadmi ko batana zaroori hai, chup-chaap kaatna nahi.
 */
const CROP_WARN = 0.3;

/**
 * Kisi bhi harkat ka sabse bada zoom — **poori registry me se**.
 *
 * ⚠️ Ye ek number poore fit ke tarike ko badal deta hai, aur uski wajah ek asli
 * shikayat thi: gallery me wahi tasveer baar-baar jama ho rahi thi.
 *
 * Pehle fit ka target `frame x us preset ka zoom` tha. Registry me chaar alag
 * zoom hain (1, 1.12, 1.15, 1.35), yaani ek hi tasveer ke **chaar** alag target
 * ban sakte the — aur har target ki apni cache key, apni file, apni library
 * entry. Aadmi ne sirf harkat badli thi; use ek nayi copy dikhi.
 *
 * Ab target hamesha sabse bade zoom par banta hai. Ek tasveer + ek frame = **ek
 * hi** fit copy, chahe harkat kuch bhi ho. File thodi badi banti hai (1.35x), par
 * chaar ki jagah ek — aur badalne par nayi nahi banti.
 *
 * ⚠️ Ye registry se nikalta hai, likha hua number nahi. Nayi harkat jodne par ye
 * apne aap badal jaayega.
 */
export const MAX_ANIMATION_ZOOM: number = (() => {
  let most = 1;
  for (const preset of ANIMATION_PRESETS) {
    for (const animation of preset.animations ?? []) {
      for (const key of ["from", "to"] as const) {
        const value = (animation as Record<string, unknown>)[key];
        if (typeof value === "number" && value > most) most = value;
      }
    }
  }
  return most;
})();

/** Harkat ka sabse bada zoom — `from`/`to` dono, kyunki dono me se koi bhi bada ho sakta hai. */
export function animationZoom(presetId: string | null): number {
  const preset = presetId ? ANIMATION_PRESETS.find((entry) => entry.id === presetId) : null;
  let zoom = 1;
  for (const animation of preset?.animations ?? []) {
    for (const key of ["from", "to"] as const) {
      const value = (animation as Record<string, unknown>)[key];
      if (typeof value === "number" && value > zoom) zoom = value;
    }
  }
  return zoom;
}

/**
 * Fit ka plan — **ek hi jagah**.
 *
 * ⚠️ Target frame se **bada** banta hai jab harkat zoom karti hai, aur ye is
 * poore function ka sabse zaroori hissa hai. Ken Burns 1 → 1.15 par render ke
 * waqt tasveer 15% aur badi hoti hai; usse pehle hi frame ke theek naap par kaat
 * dene ka matlab hai ki wo 15% phailegi — yaani wo dhundhlapan jo fit se bachna
 * chahiye tha, fit karne se hi aayega. Ye galti sabse chidhane wali hai kyunki
 * "fit kiya hua" file par kisi ko shak hi nahi hota.
 */
export function planFit(args: {
  /** Asli file ka naap — `null` = pata nahi, tab fit ka koi bharosemand faisla nahi. */
  source: FitSize | null;
  frame: FitSize;
}): FitPlan | null {
  const { source, frame } = args;
  if (!source || source.width <= 0 || source.height <= 0) return null;
  if (frame.width <= 0 || frame.height <= 0) return null;

  /*
   * ⚠️ Yahan **kisi ek harkat ka** zoom nahi, poori registry ka sabse bada zoom
   * lagta hai. Pehle yahan chuni hui harkat ka zoom aata tha, aur uska nateeja
   * gallery me dikhta tha: harkat badalte hi ek nayi fit copy ban jaati thi, aur
   * ek hi tasveer chaar baar jama ho jaati thi.
   *
   * Ek hi target rakhne se ek tasveer + ek frame = ek hi copy. File 1.35x banti
   * hai — thodi badi, par chaar ki jagah ek, aur harkat badalne par nayi nahi
   * banti. `MAX_ANIMATION_ZOOM` par poori wajah likhi hai.
   */
  /*
   * ⚠️ Zoom source ki apni naap se bandha hua hai, aur ye hissa sabse zaroori
   * hai. Seedha `MAX_ANIMATION_ZOOM` lagane par ek **bilkul theek naap wali**
   * tasveer (1080x1920 frame me 1080x1920) bhi 1.35x phail jaati thi — yaani jo
   * tasveer pixel-perfect ho sakti thi, wo bina wajah dhundhli hoti.
   *
   * Isliye target utna hi bada banta hai jitna source bina phaile bhar sakta
   * hai — par frame se chhota kabhi nahi. Badi tasveer par poora 1.35x milta hai
   * (Ken Burns ke liye pixel bache rehte hain), aur theek naap wali tasveer apne
   * hi naap par rehti hai.
   *
   * ⚠️ Ye harkat par nirbhar nahi karta, aur wahi is poore badlav ki jaan hai:
   * harkat badalne par target wahi rehta hai, isliye nayi fit copy nahi banti.
   */
  const roomy = Math.min(source.width / frame.width, source.height / frame.height);
  const zoom = Math.min(MAX_ANIMATION_ZOOM, Math.max(1, roomy));
  const target: FitSize = {
    // Even numbers — H.264 vishm (odd) chaudai/oonchai par encode hi nahi hota.
    width: evenUp(frame.width * zoom),
    height: evenUp(frame.height * zoom),
  };

  const coverScale = Math.max(target.width / source.width, target.height / source.height);
  const containScale = Math.min(target.width / source.width, target.height / source.height);

  const mode: MediaFitMode = coverScale <= MAX_CLEAN_UPSCALE ? "cover" : "contain";
  const upscale = mode === "cover" ? coverScale : containScale;

  /*
   * Kitna kat jaayega — sirf `cover` par. `contain` me kuch kat'ta hi nahi
   * (isiliye to wo chuna jaata hai), aur wahan ye ginti likhna jhooth hoga.
   */
  const cropped =
    mode === "cover"
      ? {
          width: clamp01(1 - target.width / (source.width * coverScale)),
          height: clamp01(1 - target.height / (source.height * coverScale)),
        }
      : { width: 0, height: 0 };

  const warnings: FitWarning[] = [];

  if (upscale > 1.02) {
    /*
     * ⚠️ Chetavni me **dono** number jaate hain — kitna phailega, aur kitne pixel
     * chahiye the. Sirf "dhundhli aayegi" likhna aadmi ko koi raasta nahi deta;
     * "chahiye 1620x2880" par wo doosri file dhoondh sakta hai.
     */
    warnings.push({
      level: upscale > MAX_CLEAN_UPSCALE ? "warn" : "tip",
      text:
        `Ye file ${source.width}x${source.height} ki hai, aur fit hone par ${upscale.toFixed(2)}x ` +
        `phailegi — utni saaf nahi rahegi. Saaf rakhne ke liye kam se kam ` +
        `${Math.ceil(source.width * upscale)}x${Math.ceil(source.height * upscale)} ki file chahiye.`,
    });
  }

  if (mode === "cover" && (cropped.width > CROP_WARN || cropped.height > CROP_WARN)) {
    const side = cropped.width >= cropped.height ? "daayein-baayein" : "upar-neeche";
    const amount = Math.max(cropped.width, cropped.height);
    warnings.push({
      level: "warn",
      text:
        `Frame bharne ke liye ${side} ka ${Math.round(amount * 100)}% hissa kat jaayega. ` +
        `Jo cheez us kinare par hai (chehra, likha hua, product) wo reel me nahi dikhegi.`,
    });
  }

  if (mode === "contain") {
    warnings.push({
      level: "tip",
      text:
        `Ye file frame se bahut alag aakaar ki hai — poori dikhegi aur kinare usi tasveer ke ` +
        `dhundhle roop se bharenge. Frame bharne ke liye ise ${coverScale.toFixed(2)}x phailana ` +
        `padta, jisme wo saaf nahi rehti.`,
    });
  }

  if (warnings.length === 0) {
    warnings.push({
      level: "tip",
      text: `Poori tarah saaf baithegi — ${target.width}x${target.height} me, bina phailaye.`,
    });
  }

  return { target, mode, blurredEdges: mode === "contain", zoom, upscale, cropped, warnings };
}

/**
 * Ek line ka faisla — **file chunte hi, fit hone se pehle** (26.26).
 *
 * ⚠️ Ye `plan.warnings` ka duplicate nahi hai, uska sar hai. Warnings me poora
 * hisaab hota hai (kitne pixel, kitna phailega, kitna kat jaayega) — wo zaroori
 * hai par wo **jawab nahi** hai. Aadmi ka sawaal ek hi hota hai: "ye file theek
 * hai ya nahi?" Wo jawab teen number padh kar khud nikalna padta tha, aur aksar
 * koi nikalta hi nahi tha — file lag jaati thi aur kharabi reel ban jaane ke baad
 * dikhti thi.
 *
 * ⚠️ Teen darje hain, do nahi. "Chalega par sabse achha nahi" aur "ye file is
 * reel ke liye galat hai" ko ek hi laal rang me daal dena dono ko bekaar kar deta
 * hai: pehla har doosri file par lagta hai (isliye log padhna chhod dete hain),
 * aur uske saath doosra bhi anpadha reh jaata hai.
 */
export interface FitVerdict {
  /**
   * `good`  — bina kisi nuksaan ke baithegi
   * `weak`  — baith jaayegi, par kuch keemat hai (halki narmi, thoda crop)
   * `bad`   — is reel ke liye ye file sach me theek nahi hai
   */
  level: "good" | "weak" | "bad";
  /** Ek line, aam bhasha me — yahi sabse pehle dikhta hai. */
  headline: string;
}

export function fitVerdict(
  plan: FitPlan,
  source: FitSize,
  /** Tasveer hai ya video — line usi hisaab se likhi jaati hai. */
  kind: "image" | "video" = "image",
): FitVerdict {
  const what = kind === "video" ? "video" : "tasveer";
  const crop = Math.max(plan.cropped.width, plan.cropped.height);

  /*
   * Sabse pehle wahi jo sabse bura hai: itna phailna ki saaf na rahe. Ye ek hi
   * kharabi hai jise baad me theek nahi kiya ja sakta — kata hua hissa wapas
   * laaya ja sakta hai (fit hatao, ya doosri harkat chuno), gaye hue pixel nahi.
   */
  if (plan.upscale > MAX_CLEAN_UPSCALE) {
    return {
      level: "bad",
      headline:
        `Ye ${what} is reel ke liye chhoti hai — ${source.width}x${source.height} ki hai aur ` +
        `${plan.upscale.toFixed(1)} guna phailegi, isliye dhundhli dikhegi.`,
    };
  }

  if (crop > 0.45) {
    return {
      level: "bad",
      headline:
        `Ye ${what} frame se bahut alag aakaar ki hai — bharne me iska ` +
        `${Math.round(crop * 100)}% hissa kat jaayega.`,
    };
  }

  if (plan.mode === "contain") {
    return {
      level: "weak",
      headline:
        `Ye ${what} frame se bahut chaudi hai — poori to dikhegi, par upar-neeche ` +
        `uski hi dhundhli copy bharegi.`,
    };
  }

  if (plan.upscale > 1.02) {
    return {
      level: "weak",
      headline:
        `Ye ${what} thodi chhoti hai — ${plan.upscale.toFixed(2)} guna phailegi, ` +
        `zara si narm lagegi (aankh se pakadna mushkil).`,
    };
  }

  if (crop > CROP_WARN) {
    return {
      level: "weak",
      headline:
        `Ye ${what} theek baithegi, par kinaron ka ${Math.round(crop * 100)}% kat jaayega — ` +
        `dekh lo ki zaroori cheez kinare par to nahi.`,
    };
  }

  return {
    level: "good",
    headline: `Ye ${what} is reel ke liye theek hai — saaf aur poori baithegi.`,
  };
}

function evenUp(value: number): number {
  const rounded = Math.ceil(value);
  return rounded % 2 === 0 ? rounded : rounded + 1;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value > 1 ? 1 : value;
}

/**
 * Fit ki hui file ki cache key — **wahi soch jo TTS ki hai** (`ttsCacheKey`).
 *
 * ⚠️ Iske bina har chunav par ek nayi file banti. Aadmi harkat badal kar dekhta
 * hai (zoom, bahaav, sthir), do baar wapas aata hai — aur gallery ek hi tasveer
 * ki chhe copy se bhar jaati hai, har copy par ek poora encode kharch hokar.
 * Ab wahi maang dobara aane par bani hui file seedha mil jaati hai.
 *
 * ⚠️ Har wo cheez isme hai jo bani hui file ko badal sakti hai. Ek bhi chhoot
 * jaaye to cache jhootha ho jaata hai: purani file lautti hai aur aadmi ko lagta
 * hai ki uska chunav maana hi nahi gaya.
 */
export const FIT_CACHE_NAMESPACE = "reel-fit:v1";

export function fitCacheKey(request: {
  sourceAssetId: string;
  target: FitSize;
  mode: MediaFitMode;
  blurredEdges: boolean;
  /** Video ka chuna hua hissa — `null` = poori file. */
  trim?: { startSeconds: number; endSeconds: number } | null;
}): string {
  const trim = request.trim
    ? `${round2(request.trim.startSeconds)}-${round2(request.trim.endSeconds)}`
    : "full";
  const payload = [
    FIT_CACHE_NAMESPACE,
    request.sourceAssetId,
    String(request.target.width),
    String(request.target.height),
    request.mode,
    request.blurredEdges ? "blur" : "plain",
    trim,
  ].join("\u0000");

  return sha256Hex(new TextEncoder().encode(payload));
}

function round2(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}
