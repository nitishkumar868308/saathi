import type { Mask } from "../schema/project";

/**
 * Mask ko CSS me badlo (14.9).
 *
 * Core me React nahi hai, isliye yahan sirf plain object banta hai — wahi object
 * preview aur render dono lagate hain. Ek hi jagah hone ka poora matlab yahi hai:
 * mask editor me jaisa dikhta hai, MP4 me bhi bilkul waisa hi katta hai.
 *
 * Do bilkul alag raaste hain, aur unka chunav `feather` par hai:
 *
 *  - **feather 0** → `clip-path`. Kinara ekdum saaf, aur browser ise sasta
 *    samajhta hai.
 *  - **feather > 0** → `mask-image` gradients. `clip-path` narm kinara bana hi
 *    nahi sakta — wo har pixel ko poora rakhta hai ya poora hataata hai.
 *
 * Dono ek saath likhna galat hota: `clip-path` gradient ke narm kinare ko bhi
 * seedha kaat deta, aur feather dikhta hi nahi.
 */
export function maskCss(mask: Mask, maskImageUrl: string | null = null): Record<string, string> {
  if (!mask) return {};

  const inset = Math.max(0, Math.min(49, mask.inset));
  const feather = Math.max(0, Math.min(50, mask.feather));

  /*
   * Image mask (24.6) — sabse pehle, kyunki wo baaki sab par bhaari padta hai.
   *
   * ⚠️ `mask-mode: luminance` jaan-boojhkar hai. CSS ka default `alpha` hai,
   * yaani PNG ka transparent hissa chhupta hai. Par log mask ke liye kaali-safed
   * tasveer banate hain (safed = dikhega, kaala = chhupega) — aur wo `alpha` me
   * poori ki poori dikhti hai, yaani mask lagta hi nahi. Wo galti "kuch nahi
   * hua" jaisi dikhti hai aur uski wajah kabhi samajh nahi aati.
   *
   * ⚠️ `inset`/`feather` yahan **nahi** lagte. Tasveer khud hi poora naksha hai;
   * uske upar ek aur mask lagane par do mask ek doosre ko kaatte hain aur
   * nateeja kisi ko samajh nahi aata. Jise narm kinara chahiye, wo tasveer me
   * hi narm kinara banaye.
   */
  if (mask.assetId && maskImageUrl) {
    return {
      maskImage: `url(${maskImageUrl})`,
      WebkitMaskImage: `url(${maskImageUrl})`,
      maskMode: "luminance",
      maskSize: "100% 100%",
      WebkitMaskSize: "100% 100%",
      maskPosition: "center",
      WebkitMaskPosition: "center",
      maskRepeat: "no-repeat",
      WebkitMaskRepeat: "no-repeat",
    };
  }

  if (feather <= 0) {
    if (mask.shape === "circle") {
      return { clipPath: `circle(${50 - inset}% at 50% 50%)` };
    }
    const rounded = mask.shape === "rounded" ? ` round ${mask.radius}px` : "";
    return { clipPath: `inset(${inset}% ${inset}% ${inset}% ${inset}%${rounded})` };
  }

  if (mask.shape === "circle") {
    const outer = 50 - inset;
    const inner = Math.max(0, outer - feather);
    return {
      maskImage: `radial-gradient(closest-side circle at 50% 50%, #000 ${pct(inner / outer)}, transparent 100%)`,
      WebkitMaskImage: `radial-gradient(closest-side circle at 50% 50%, #000 ${pct(inner / outer)}, transparent 100%)`,
      maskSize: `${outer * 2}% ${outer * 2}%`,
      WebkitMaskSize: `${outer * 2}% ${outer * 2}%`,
      maskPosition: "center",
      WebkitMaskPosition: "center",
      maskRepeat: "no-repeat",
      WebkitMaskRepeat: "no-repeat",
    };
  }

  /*
   * Aayat ka narm kinara: do gradients (ek aar-paar, ek upar-neeche) aur unka
   * **intersect**.
   *
   * ⚠️ Sirf jodne (`add`) se kone galat aate hain — wahan dono gradients apni
   * poori taaqat par hote hain aur kona feather ke bawajood tez rehta hai.
   * `intersect` har pixel par dono me se **kam** wali value leta hai, jo bilkul
   * wahi hai jo aankh se sahi lagta hai.
   *
   * `-webkit-` wala jodha gaya hai kyunki Remotion Chrome me chalta hai aur
   * purane Chrome sirf usi ko samajhte hain; naye dono ko.
   */
  const stops = (start: number, end: number): string =>
    `transparent ${start}%, #000 ${end}%, #000 ${100 - end}%, transparent ${100 - start}%`;

  const horizontal = `linear-gradient(to right, ${stops(inset, inset + feather)})`;
  const vertical = `linear-gradient(to bottom, ${stops(inset, inset + feather)})`;
  const image = `${horizontal}, ${vertical}`;

  return {
    maskImage: image,
    WebkitMaskImage: image,
    maskComposite: "intersect",
    WebkitMaskComposite: "source-in",
  };
}

function pct(fraction: number): string {
  return `${Math.round(Math.max(0, Math.min(1, fraction)) * 10000) / 100}%`;
}

/**
 * Crop ko CSS me badlo (15.10).
 *
 * Crop mask nahi hai, aur ye farak maayne rakhta hai: mask item ka kuch hissa
 * **chhupata** hai, crop us hisse ko **bada karke frame me bharta** hai. Isliye
 * yahan clip-path ke saath ek scale + shift bhi jaati hai.
 *
 * ⚠️ Do `transform` ek hi element par nahi lag sakte, isliye crop ka transform
 * item ke apne transform wale element par nahi jaata — wo andar wale (effects
 * wale) element par jaata hai. Dono ek jagah rakhne par item ka apna scale crop
 * ke scale se mit jaata aur user ka zoom chup-chaap gayab ho jaata.
 */
export function cropCss(
  crop: { x: number; y: number; width: number; height: number } | null,
): Record<string, string> {
  if (!crop) return {};
  if (crop.width <= 0 || crop.height <= 0) return {};
  // Poora frame = koi crop nahi. Tab kuch likhna hi nahi — har extra transform
  // browser se ek naya layer bulwata hai.
  if (crop.x <= 0 && crop.y <= 0 && crop.width >= 1 && crop.height >= 1) return {};

  const right = 1 - (crop.x + crop.width);
  const bottom = 1 - (crop.y + crop.height);

  const scaleX = 1 / crop.width;
  const scaleY = 1 / crop.height;
  // Bache hue tukde ka beech kahan hai — usi ko frame ke beech me laana hai.
  const centerX = crop.x + crop.width / 2;
  const centerY = crop.y + crop.height / 2;
  const shiftX = (0.5 - centerX) * 100 * scaleX;
  const shiftY = (0.5 - centerY) * 100 * scaleY;

  return {
    clipPath: `inset(${pct(crop.y)} ${pct(right)} ${pct(bottom)} ${pct(crop.x)})`,
    transform: `scale(${round(scaleX)}, ${round(scaleY)}) translate(${round(shiftX)}%, ${round(shiftY)}%)`,
    transformOrigin: "center center",
  };
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}
