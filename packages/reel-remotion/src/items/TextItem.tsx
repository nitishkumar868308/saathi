import {
  BUILTIN_FONTS,
  fontFamilyCss,
  isBrandToken,
  mergeFonts,
  resolveItemValue,
  } from "@reel/core";
import type React from "react";
import { AbsoluteFill } from "remotion";

import type { ItemComponentProps } from "../components";
import { useToken } from "../brand";
import { Transformed } from "../Transformed";

/**
 * Text item.
 *
 * Rang aur font **tokens** se aate hain (`brand.text`, `brand.font.display`) —
 * hex/family seedha item me nahi hota. Isliye brand badalte hi poori reel ka
 * text badal jaata hai (Dynamic rule 9). `resolveToken` token na ho to value
 * waisi ki waisi lauta deta hai, isliye ek-off rang bhi likha ja sakta hai.
 *
 * `fontSize` project pixels me hai. Composition apne aap project ke width/height
 * par bani hai, isliye "72px" har size me utna hi bada dikhta hai jitna editor me.
 */
export const TextItem: React.FC<ItemComponentProps> = ({ item, localFrame, fonts }) => {
  const resolveToken = useToken();
  const text = item.text;
  if (!text) return null;

  const fontSize = resolveItemValue<number>(item, "text.fontSize", localFrame);

  const justify =
    text.align === "left" ? "flex-start" : text.align === "right" ? "flex-end" : "center";
  const align =
    text.verticalAlign === "top"
      ? "flex-start"
      : text.verticalAlign === "bottom"
        ? "flex-end"
        : "center";

  const background = text.background;

  return (
    <Transformed item={item} localFrame={localFrame}>
      <AbsoluteFill
        style={{
          display: "flex",
          flexDirection: "row",
          justifyContent: justify,
          alignItems: align,
        }}
      >
        <div
          style={{
            // Percent me isliye ki 9:16 aur 16:9 dono me line-break ek jaisa lage.
            maxWidth: text.maxWidthPercent === null ? "100%" : `${text.maxWidthPercent}%`,
            /*
             * Do raaste, aur dono zaroori hain:
             *  - brand token (`brand.font.display`) -> brand se poori family
             *  - warna font registry se, jo `@font-face` bhi lagata hai (9.10)
             * Dono me fallback stack saath jaata hai, taaki font na mile to text
             * gayab na ho — sirf alag dikhe, aur uski chetavni panel me aaye.
             */
            fontFamily: isBrandToken(text.fontFamily)
              ? resolveToken(text.fontFamily)
              : fontFamilyCss(mergeFonts(fonts ?? BUILTIN_FONTS), text.fontFamily),
            fontSize,
            fontWeight: text.fontWeight,
            color: resolveToken(text.color),
            textAlign: text.align,
            lineHeight: text.lineHeight,
            letterSpacing: text.letterSpacing,
            textTransform: text.uppercase ? "uppercase" : "none",
            whiteSpace: "pre-wrap",
            // Bina iske lamba shabd frame ke bahar nikal jaata hai aur video me
            // aadha akshar kata hua dikhta hai.
            overflowWrap: "break-word",
            ...(text.stroke
              ? {
                  WebkitTextStrokeWidth: text.stroke.width,
                  WebkitTextStrokeColor: resolveToken(text.stroke.color),
                }
              : {}),
            ...(text.shadow
              ? {
                  textShadow: `${text.shadow.x}px ${text.shadow.y}px ${text.shadow.blur}px ${resolveToken(
                    text.shadow.color,
                  )}`,
                }
              : {}),
            ...(background
              ? {
                  backgroundColor: resolveToken(background.color),
                  padding: `${background.paddingY}px ${background.paddingX}px`,
                  borderRadius: background.radius,
                }
              : {}),
          }}
        >
          {text.content}
        </div>
      </AbsoluteFill>
    </Transformed>
  );
};
