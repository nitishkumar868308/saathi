import { animationsMaxScale } from "../registry/animations";
import type { Item } from "../schema/project";

/**
 * Item ka **sabse bada** effective scale, poore duration me (20.4).
 *
 * ⚠️ Ye "asli math" hai, andaaza nahi — aur teen cheezein ek saath ginni padti
 * hain, kyunki teeno ek doosre ke **upar** lagti hain:
 *
 *  1. `transform.scale` — user ka apna zoom
 *  2. uske keyframes — Ken Burns, zoom-pan tool, sab
 *  3. animations ka apna scale (`animationsMaxScale`)
 *
 * Sirf `transform.scale` dekhna sabse aam galti hai: Ken Burns 1 → 1.4 me
 * `transform.scale` 1 hi rehta hai (badlav keyframes me hota hai), aur blur clip
 * ke **aakhir** me aata hai. Shuruaat dekh kar sab theek lagta hai aur dhundhlapan
 * video me baad me pakda jaata hai — jab dobara render karna mehnga ho chuka hota
 * hai.
 *
 * Zoom-pan tool bhi wahi keyframes banata hai (Phase 18), isliye wo apne aap is
 * ginti me aa jaata hai — uske liye alag code nahi likhna pada.
 */
export function maxEffectiveScale(item: Item): number {
  const keyframes = item.keyframes["transform.scale"] ?? [];

  /*
   * Keyframes hon to base `transform.scale` **nahi** ginte.
   *
   * Wajah: keyframe engine keyframe wali value ko static value ke **upar** nahi
   * lagata, uski **jagah** chalata hai (`resolveItemValue` pehle keyframe
   * dekhta hai). Dono ginne par ek 1.4x Ken Burns wali clip 1.4 ki jagah 1.96
   * batati aur har baar jhoothi chetavni aati.
   */
  let own = item.transform.scale;
  if (keyframes.length > 0) {
    own = 0;
    for (const keyframe of keyframes) {
      if (typeof keyframe.value === "number") own = Math.max(own, keyframe.value);
    }
    // Sab keyframes galat kism ke ho (kabhi nahi hona chahiye) to base par gir jao.
    if (own === 0) own = item.transform.scale;
  }

  return Math.max(0.01, own) * animationsMaxScale(item);
}

/**
 * Is item ko theek dikhne ke liye source me kitne pixel chahiye (20.4).
 *
 * `fitScale` wo scale hai jo `cover`/`contain` khud lagata hai — wo item ke apne
 * scale se pehle lagti hai, isliye dono guna hoti hain.
 */
export function requiredSourcePixels(args: {
  item: Item;
  source: { width: number; height: number };
  fitScale: number;
}): { width: number; height: number; totalScale: number } {
  const totalScale = args.fitScale * maxEffectiveScale(args.item);
  return {
    width: Math.ceil(args.source.width * Math.max(1, totalScale)),
    height: Math.ceil(args.source.height * Math.max(1, totalScale)),
    totalScale,
  };
}
