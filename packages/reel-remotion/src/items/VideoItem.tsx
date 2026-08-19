import type React from "react";
import { OffthreadVideo } from "remotion";

import { assetSrc } from "../assets";
import { itemVolume } from "../audio";
import type { ItemComponentProps } from "../components";
import { BLUR_LAYER_STYLE, FitBackground, objectFitFor } from "../FitLayer";
import { MissingAsset } from "../MissingAsset";
import { Transformed } from "../Transformed";

/**
 * Video item.
 *
 * `<OffthreadVideo>` use kiya hai, `<Video>` nahi: render ke waqt ye frames
 * FFmpeg se nikalta hai, browser ke video element se nahi. Browser wala tarika
 * bade video par frame chhod deta hai aur nateeja har baar thoda alag aata hai —
 * ek video editor me isse buri baat koi nahi.
 *
 * `trimBefore` = source ke andar kahan se shuru karna hai. Ye non-destructive
 * trim hai (Phase 1 ka locked rule) — asli file kabhi nahi badalti.
 */
export const VideoItem: React.FC<ItemComponentProps> = ({ item, track, assets, localFrame }) => {
  const src = assetSrc(assets, item.assetId);
  if (!src) return <MissingAsset item={item} />;

  return (
    <Transformed
      item={item}
      localFrame={localFrame}
      background={
        <FitBackground
          item={item}
          // Video ki apni dhundhli copy peeche. Ye ek aur decode hai (thoda mehnga),
          // par 16:9 footage ko 9:16 reel me daalne par yahi cheez sabse zyada kaam
          // aati hai — aur iske bina peeche chupchaap kaali patti aa jaati thi.
          blurLayer={
            <OffthreadVideo
              src={src}
              trimBefore={item.trimStartFrame}
              playbackRate={item.playbackRate}
              // Peeche wali copy chup rehni chahiye, warna awaaz do baar bajegi.
              muted
              style={BLUR_LAYER_STYLE}
            />
          }
        />
      }
    >
      <OffthreadVideo
        src={src}
        trimBefore={item.trimStartFrame}
        playbackRate={item.playbackRate}
        volume={itemVolume(item, track)}
        style={{ width: "100%", height: "100%", objectFit: objectFitFor(item) }}
      />
    </Transformed>
  );
};
