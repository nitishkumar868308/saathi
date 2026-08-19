import type React from "react";
import { Img } from "remotion";

import { assetSrc } from "../assets";
import type { ItemComponentProps } from "../components";
import { BLUR_LAYER_STYLE, FitBackground, objectFitFor } from "../FitLayer";
import { MissingAsset } from "../MissingAsset";
import { Transformed } from "../Transformed";

/**
 * Image item.
 *
 * Ken Burns ke liye yahan kuch **nahi** likha gaya — wo `transform.scale` par do
 * keyframes hain, aur `<Transformed>` unhe khud padh leta hai. Isi wajah se
 * "zoom" ke liye koi alag feature nahi banana padta.
 */
export const ImageItem: React.FC<ItemComponentProps> = ({ item, assets, localFrame }) => {
  const src = assetSrc(assets, item.assetId);
  if (!src) return <MissingAsset item={item} />;

  return (
    <>
      <FitBackground item={item} blurLayer={<Img src={src} style={BLUR_LAYER_STYLE} />} />
      <Transformed item={item} localFrame={localFrame}>
        <Img src={src} style={{ width: "100%", height: "100%", objectFit: objectFitFor(item) }} />
      </Transformed>
    </>
  );
};
