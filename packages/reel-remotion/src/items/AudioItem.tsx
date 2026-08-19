import type React from "react";
import { Audio } from "remotion";

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
export const AudioItem: React.FC<ItemComponentProps> = ({ item, track, assets }) => {
  const src = assetSrc(assets, item.assetId);
  if (!src) return null;

  return (
    <Audio
      src={src}
      trimBefore={item.trimStartFrame}
      playbackRate={item.playbackRate}
      volume={itemVolume(item, track)}
    />
  );
};
