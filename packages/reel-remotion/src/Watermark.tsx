import type { Watermark } from "@reel/core";
import type React from "react";
import { AbsoluteFill, Img, useVideoConfig } from "remotion";

import { assetSrc, type AssetMap } from "./assets";

/**
 * Watermark / logo (17.12).
 *
 * ⚠️ Do shart, aur dono zaroori hain: `enabled` **aur** ek asli asset. Sirf
 * `enabled` par bharosa karne se "watermark on hai par logo nahi chuna" wali
 * haalat me ek khaali dabba render me chala jaata, aur user ko lagta ki
 * watermark toota hua hai — jabki wo bas khaali hai.
 *
 * Jagah safe-area ke andar rakhi jaati hai: Instagram aur YouTube dono kinaron
 * par apne button chipkate hain, aur wahan rakha logo dhak jaata hai.
 */
export const WatermarkLayer: React.FC<{
  brand: { watermark: Watermark };
  assets: AssetMap;
}> = ({ brand, assets }) => {
  const { width, height } = useVideoConfig();
  const watermark = brand.watermark;

  if (!watermark.enabled) return null;
  const src = assetSrc(assets, watermark.assetId);
  if (!src) return null;

  // Margin frame ke **chhote** kinare se — warna 9:16 me upar-neeche ka margin
  // itna bada ho jaata hai ki logo beech me aa jaata hai.
  const shorter = Math.min(width, height);
  const margin = (watermark.marginPercent / 100) * shorter;
  const logoWidth = (watermark.sizePercent / 100) * width;

  const vertical = watermark.position.startsWith("top") ? "flex-start" : "flex-end";
  const horizontal = watermark.position.endsWith("left") ? "flex-start" : "flex-end";

  return (
    <AbsoluteFill
      style={{
        display: "flex",
        alignItems: horizontal,
        justifyContent: vertical,
        padding: margin,
        // Watermark par click/hover ka koi matlab nahi, aur preview me wo upar
        // wali parat banakar clips ko chunne se rok deta hai.
        pointerEvents: "none",
      }}
    >
      <Img
        src={src}
        style={{
          width: logoWidth,
          height: "auto",
          opacity: watermark.opacity,
          // `contain` taaki chaudi-lambi dono tarah ke logo bina khinche rahein.
          objectFit: "contain",
        }}
      />
    </AbsoluteFill>
  );
};
