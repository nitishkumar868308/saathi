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
export function maskCss(mask: Mask): Record<string, string> {
  if (!mask) return {};

  const inset = Math.max(0, Math.min(49, mask.inset));
  const feather = Math.max(0, Math.min(50, mask.feather));

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
  return `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
}
