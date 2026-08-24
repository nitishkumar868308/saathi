import type React from "react";
import { Audio, Loop } from "remotion";

import { assetSrc } from "../assets";
import { itemVolume } from "../audio";
import type { ItemComponentProps } from "../components";

/**
 * Audio item — kuch dikhta nahi, sirf sunai deta hai.
 *
 * Missing asset par yahan koi placeholder nahi dikhaya jaata (dikhega kahan?).
 * Asli pakad worker me hai: `resolveAssets()` render shuru hone se **pehle** hi
 * phat jaata hai agar doc me koi aisa assetId ho jiska storage me pata na ho.
 */
export const AudioItem: React.FC<ItemComponentProps> = ({ item, track, doc, assets }) => {
  const src = assetSrc(assets, item.assetId);
  if (!src) return null;

  const audio = (
    <Audio
      src={src}
      trimBefore={item.trimStartFrame}
      playbackRate={item.playbackRate}
      // Speed badalne par awaaz ki pitch na badle (15.7). Remotion ye seedha
      // deta hai; iske bina 2x par awaaz chipmunk jaisi ho jaati hai.
      preservePitch
      /*
       * ⚠️ Awaaz load na ho paayi ho to player ruk kar intezaar kare (26.24).
       * Iske bina scene chalta rehta hai aur uski pehli line **kat kar** shuru
       * hoti hai — awaaz beech se sunai deti hai. Wo galti sirf preview me hoti
       * hai (render me file poori padhi jaati hai), aur wahi use sabse dhokhe
       * wali banati hai: aadmi samajhta hai ki reel hi aisi bani hai.
       */
      pauseWhenBuffering
      volume={itemVolume(doc, item, track)}
    />
  );

  /*
   * Loop (15.1) — sirf tab jab user ne maanga ho.
   *
   * ⚠️ `<Loop>` hamesha lagana galat hai: jis clip ka source uski lambai se bada
   * hai, uspar loop ka koi matlab nahi, par `<Loop>` phir bhi ek aur layer aur
   * ek aur audio tag banata hai. Music ke 8 loop me wo 8 tags ho jaate hain aur
   * browser ka audio tag budget khatam ho jaata hai.
   */
  if (!item.audio.loop) return audio;

  /*
   * Loop ka period **source** ki lambai hai, clip ki nahi.
   *
   * Ye pehle galat likha gaya tha (`item.durationInFrames`), aur wo galti
   * chup-chaap kuch nahi karti: har "loop" theek utna lamba hota jitni clip hai,
   * yaani wo ek hi baar bajta aur loop ka koi asar hi nahi dikhta.
   *
   * Source ki lambai pata na ho to loop lagana bhi galat hai — tab seedha audio.
   */
  const source = item.sourceDurationFrames;
  if (source === null) return audio;

  const period = Math.max(1, Math.round((source - item.trimStartFrame) / item.playbackRate));
  if (period >= item.durationInFrames) return audio;
  return <Loop durationInFrames={period}>{audio}</Loop>;
};
