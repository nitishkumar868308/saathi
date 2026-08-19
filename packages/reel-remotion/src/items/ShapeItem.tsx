import { resolveItemValue, } from "@reel/core";
import type React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";

import type { ItemComponentProps } from "../components";
import { useToken } from "../brand";
import { Transformed } from "../Transformed";

/**
 * Shape item — rect / ellipse / line.
 *
 * Size **percent** me hai, pixels me nahi (Dynamic rule 4). 1080x1920 me banaya
 * gaya band 1920x1080 me bhi utna hi chauda dikhta hai. Pixels likhne par har
 * size badalne pe shapes ya to gayab ho jaate ya frame se bahar nikal jaate.
 */
export const ShapeItem: React.FC<ItemComponentProps> = ({ item, localFrame }) => {
  const resolveToken = useToken();
  const shape = item.shape;
  const { width, height } = useVideoConfig();
  if (!shape) return null;

  const widthPercent = resolveItemValue<number>(item, "shape.widthPercent", localFrame);
  const heightPercent = resolveItemValue<number>(item, "shape.heightPercent", localFrame);

  const boxWidth = (width * widthPercent) / 100;
  // Line ke liye heightPercent motai hai — 100% oonchi line ka koi matlab nahi hota.
  const boxHeight =
    shape.kind === "line"
      ? Math.max(1, (height * heightPercent) / 100)
      : (height * heightPercent) / 100;

  return (
    <Transformed item={item} localFrame={localFrame}>
      <AbsoluteFill style={{ display: "flex", justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            width: boxWidth,
            height: boxHeight,
            backgroundColor: shape.fill ? resolveToken(shape.fill) : "transparent",
            borderRadius: shape.kind === "ellipse" ? "50%" : shape.radius,
            ...(shape.stroke
              ? {
                  border: `${shape.stroke.width}px solid ${resolveToken(shape.stroke.color)}`,
                }
              : {}),
          }}
        />
      </AbsoluteFill>
    </Transformed>
  );
};
