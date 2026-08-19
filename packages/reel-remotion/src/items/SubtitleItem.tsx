import {
  activeWordIndex,
  cueAt,
  estimateWords,
  getCaptionStyle,
  type CaptionCue,
  type CaptionWord,
  type WordStyle,
} from "@reel/core";
import type React from "react";

import { useToken } from "../brand";
import type { ItemComponentProps } from "../components";
import { Transformed } from "../Transformed";

/**
 * Captions (19.1 / 19.6 / 19.11).
 *
 * ⚠️ Shabd **hamesha** alag-alag `<span>` me jaate hain, chahe style ko per-word
 * kuch karna ho ya na ho. Ek hi `<span>` me poora text rakh kar sirf karaoke ke
 * liye todna aasan lagta hai, par tab do alag layout code ban jaate hain — aur
 * unka line-break alag padta hai. Nateeja: style badalte hi caption ek line se
 * do line par kood jaati hai, jo turant toota hua lagta hai.
 *
 * Ek hi raasta hone se line-break har style me bilkul ek jaisa rehta hai.
 */
export const SubtitleItem: React.FC<ItemComponentProps> = ({ item, localFrame }) => {
  const resolveToken = useToken();
  const subtitle = item.subtitle;
  const text = item.text;

  if (!subtitle || !text) return null;

  const cue = cueAt(subtitle.cues as CaptionCue[], localFrame);
  if (!cue) return null;

  /*
   * Word timing na ho to andaaza (19.8). Ye har frame par banta hai — cue ke
   * shabd 10-15 hote hain, isliye ye sasta hai, aur doc me andaaza jama kar
   * dena galat hota: tab wo asli timing jaisa dikhta aur user use theek karne ki
   * koshish hi nahi karta.
   */
  const words: CaptionWord[] = cue.words.length > 0 ? (cue.words as CaptionWord[]) : estimateWords(cue);
  const active = activeWordIndex(words, localFrame);

  const style = getCaptionStyle(subtitle.styleId);

  return (
    <Transformed item={item} localFrame={localFrame}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems:
            text.verticalAlign === "top"
              ? "flex-start"
              : text.verticalAlign === "middle"
                ? "center"
                : "flex-end",
          justifyContent: "center",
          // Safe-area: neeche ka 12% Instagram ka apna UI dhak leta hai.
          padding: "6% 8% 12%",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: `0 ${text.fontSize * 0.28}px`,
            justifyContent: text.align === "left" ? "flex-start" : text.align === "right" ? "flex-end" : "center",
            maxWidth: text.maxWidthPercent === null ? "100%" : `${text.maxWidthPercent}%`,
            fontFamily: resolveToken(text.fontFamily),
            fontSize: text.fontSize,
            fontWeight: text.fontWeight,
            lineHeight: text.lineHeight,
            letterSpacing: text.letterSpacing,
            textTransform: text.uppercase ? "uppercase" : "none",
            color: resolveToken(text.color),
            textAlign: text.align,
            ...(text.stroke
              ? {
                  WebkitTextStrokeWidth: text.stroke.width,
                  WebkitTextStrokeColor: resolveToken(text.stroke.color),
                }
              : {}),
            ...(text.shadow
              ? {
                  textShadow: `${text.shadow.x}px ${text.shadow.y}px ${text.shadow.blur}px ${resolveToken(text.shadow.color)}`,
                }
              : {}),
          }}
        >
          {words.map((word, index) => {
            const applied: WordStyle = style
              ? style.apply({
                  word: {
                    index,
                    total: words.length,
                    active: index === active,
                    past: index < active || (active === -1 && localFrame >= word.endFrame),
                    progress:
                      word.endFrame > word.startFrame
                        ? Math.min(
                            1,
                            Math.max(0, (localFrame - word.startFrame) / (word.endFrame - word.startFrame)),
                          )
                        : 0,
                  },
                  params: subtitle.params as Record<string, unknown>,
                })
              : {};

            return (
              <span
                key={`${cue.id}-${index}`}
                style={{
                  display: "inline-block",
                  // `hidden` par jagah bachi rehti hai (`visibility`), element
                  // hataya nahi jaata — hatane par baaki shabd har frame par apni
                  // jagah badalte hain aur poori line kaanpti dikhti hai.
                  visibility: applied.hidden ? "hidden" : "visible",
                  ...(applied.color ? { color: resolveToken(applied.color) } : {}),
                  ...(applied.opacity !== undefined ? { opacity: applied.opacity } : {}),
                  ...(applied.fontWeight ? { fontWeight: applied.fontWeight } : {}),
                  ...(applied.background
                    ? {
                        backgroundColor: resolveToken(applied.background),
                        padding: `0 ${text.fontSize * 0.18}px`,
                        borderRadius: text.fontSize * 0.16,
                      }
                    : {}),
                  ...(applied.scale !== undefined && applied.scale !== 1
                    ? { transform: `scale(${applied.scale})` }
                    : {}),
                }}
              >
                {word.text}
              </span>
            );
          })}
        </div>
      </div>
    </Transformed>
  );
};
