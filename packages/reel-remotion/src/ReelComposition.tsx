import { itemEndFrame, resolveToken, type Doc } from "@reel/core";
import type React from "react";
import { AbsoluteFill, Sequence } from "remotion";

import type { AssetMap } from "./assets";
import { ItemRenderer } from "./ItemRenderer";
import { registerBuiltinItemComponents } from "./register";

registerBuiltinItemComponents();

/**
 * ⚠️ `type` hai, `interface` nahi — aur ye jaan-boojhkar hai.
 *
 * Remotion ke `<Composition>` ko props `Record<string, unknown>` ke saanche me
 * chahiye. TypeScript type-alias ko implicit index signature deta hai par
 * interface ko nahi, isliye interface likhne par Composition compile hi nahi hoti.
 */
export type ReelCompositionProps = {
  /** Poora Project JSON. Width/height/fps/duration sab yahin se aate hain. */
  doc: Doc;
  /** assetId -> URL / public-dir filename. Doc me URL kabhi nahi hote. */
  assets: AssetMap;
};

/**
 * Ekmatra composition.
 *
 * Har project ke liye nayi composition nahi banti — sab kuch props se aata hai.
 * Yahi cheez preview aur final render ko ek jaisa rakhti hai: `@remotion/player`
 * aur `renderMedia` dono ISI component ko chalate hain (Section E ka faisla #4).
 *
 * **Track order = z-index, aur bada order upar aata hai.** Registry ke defaults
 * isi kram me hain: video(0) -> image(1) -> overlay(2) -> text(3) -> subtitle(4).
 * Isliye text apne aap video ke upar aata hai, bina kisi special case ke.
 */
export const ReelComposition: React.FC<ReelCompositionProps> = ({ doc, assets }) => {
  const tracks = [...doc.tracks].filter((track) => !track.hidden).sort((a, b) => a.order - b.order);

  return (
    <AbsoluteFill style={{ backgroundColor: resolveToken(doc.project.background) }}>
      {tracks.map((track) => {
        const items = doc.items
          .filter((item) => item.trackId === track.id && !item.hidden)
          .sort((a, b) => a.startFrame - b.startFrame);

        return (
          <AbsoluteFill key={track.id}>
            {items.map((item) => (
              <Sequence
                key={item.id}
                name={`${track.name} / ${item.name}`}
                from={item.startFrame}
                // Project ke bahar nikla hua item kaat diya jaata hai — warna
                // Remotion aakhri frame ke baad bhi use draw karne ki koshish
                // karta hai aur duration ka hisaab bigad jaata hai.
                durationInFrames={Math.max(
                  1,
                  Math.min(item.durationInFrames, doc.project.durationInFrames - item.startFrame),
                )}
              >
                <ItemRenderer item={item} track={track} doc={doc} assets={assets} />
              </Sequence>
            ))}
          </AbsoluteFill>
        );
      })}
    </AbsoluteFill>
  );
};

/** Doc ke items ke hisaab se sabse aakhri frame — worker ke sanity check ke liye. */
export function docContentEndFrame(doc: Doc): number {
  return doc.items.reduce((end, item) => Math.max(end, itemEndFrame(item)), 0);
}
