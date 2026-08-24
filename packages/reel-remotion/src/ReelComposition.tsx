import {
  BUILTIN_FONTS,
  fontFaceCss,
  itemEndFrame,
  mergeFonts,
  brandTokensFor,
  resolveToken,
  type Doc,
  type FontEntry,
} from "@reel/core";
import type React from "react";
import { AbsoluteFill, Sequence } from "remotion";

import type { AssetMap } from "./assets";
import { AssetProvider } from "./assetsContext";
import { BrandProvider } from "./brand";
import { WatermarkLayer } from "./Watermark";
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
  /**
   * Font registry — **wahi list jo studio ke panel me dikhti hai** (9.10).
   *
   * ⚠️ Ye props se aati hai, module-level constant se nahi, aur ye jaan-boojhkar
   * hai: preview studio ke process me chalta hai aur render Remotion ke apne
   * bundle me. Do jagah do alag list rakhne par ek din preview me ek font dikhta
   * hai aur MP4 me doosra — aur wo galti tab pata chalti hai jab reel ban chuki
   * hoti hai. Ek hi list dono taraf jaati hai, aur `@font-face` ka CSS bhi ek hi
   * function (`fontFaceCss`) banata hai.
   *
   * Na di jaaye to sirf system fonts — jo har machine par hain.
   */
  fonts?: readonly FontEntry[];
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
export const ReelComposition: React.FC<ReelCompositionProps> = ({ doc, assets, fonts }) => {
  const fontList = mergeFonts(fonts ?? BUILTIN_FONTS);
  /*
   * Track ke toggles **render me bhi** lagte hain (16.2) — sirf editor me nahi.
   *
   * ⚠️ Yahi is checklist ka asli imtihan hai. Hide/solo ko sirf preview me lagana
   * bahut aasan hai aur ek din user hidden track ke saath export karta hai, video
   * dekhta hai, aur wo layer wahan hoti hai. Us galti ka pata hamesha bahut der se
   * chalta hai, isliye chhaanti yahin hoti hai — poore renderer me ek hi jagah.
   *
   * Solo lagne par baaki sab jaate hain. Hidden track solo hone par bhi nahi
   * aata: user ne use jaan-boojhkar chhupaya hai, aur solo uska ulta nahi kar
   * sakta.
   */
  const soloActive = doc.tracks.some((track) => track.solo && !track.hidden);
  const tokens = brandTokensFor(doc.brand);
  const tracks = [...doc.tracks]
    .filter((track) => !track.hidden && (!soloActive || track.solo))
    .sort((a, b) => a.order - b.order);

  return (
    /*
     * Brand tokens poore renderer ke upar (17.10). Iske bina har item apne aap
     * **default** brand par atak jaata tha — yaani preset badalna preview aur
     * MP4 dono me bekaar tha.
     */
    <AssetProvider assets={assets}>
      <BrandProvider brand={doc.brand}>
      <AbsoluteFill style={{ backgroundColor: resolveToken(doc.project.background, tokens) }}>
      {/*
       * Font ka CSS composition ke **andar** hai, bahar nahi. Render ke waqt
       * Remotion is component ko apne page me chadhata hai; bahar rakha hua CSS
       * wahan pahunchta hi nahi aur text chup-chaap fallback font me nikal jaata.
       */}
      <style>{fontFaceCss(fontList)}</style>

      {tracks.map((track) => {
        const items = doc.items
          .filter((item) => item.trackId === track.id && !item.hidden)
          .sort((a, b) => a.startFrame - b.startFrame);

        return (
          <AbsoluteFill
            key={track.id}
            // Track ki opacity poori parat par (16.2). 1 par kuch likhte hi nahi —
            // har opacity browser se ek naya layer bulwati hai.
            style={track.opacity < 1 ? { opacity: track.opacity } : undefined}
          >
            {items.map((item) => (
              <Sequence
                key={item.id}
                name={`${track.name} / ${item.name}`}
                from={item.startFrame}
                /*
                 * ⚠️ **Media ko waqt se pehle mount karo** (26.24).
                 *
                 * Bina iske preview me har video/awaaz wala scene "atak kar" shuru
                 * hota hai: Sequence theek us frame par mount hoti hai jab scene
                 * shuru hota hai, aur usi pal browser file maangna shuru karta hai.
                 * Jitni der wo maangta hai, utni der scene ruka hua dikhta hai —
                 * aur wo har baar hota hai, har scene par.
                 *
                 * `premountFor` us item ko ek second pehle chupke se mount kar deta
                 * hai (`display: none`), taaki wo apna maal utaar le. Frame ka
                 * hisaab isse nahi badalta — scene apne hi waqt par shuru hota hai.
                 *
                 * ⚠️ Ye **sirf preview** ka mamla hai: Remotion premount ko render
                 * ke waqt khud band kar deta hai (`environment.isRendering`),
                 * isliye MP4 ke waqt na ek extra frame banta hai na ek extra second
                 * lagta hai.
                 *
                 * ⚠️ Sirf un items par jinki koi file hai. Text aur shape ko kuch
                 * utaarna hi nahi hota; unhe pehle mount karna sirf ek aur chhupi
                 * hui parat banata hai — kaam kuch nahi karta. (Yahan `item.type`
                 * nahi dekha ja raha, isliye Dynamic rule 3 bhi nahi tootta: sawaal
                 * "iski koi file hai?" hai, "ye video hai?" nahi.)
                 */
                premountFor={item.assetId ? doc.project.fps : 0}
                // Project ke bahar nikla hua item kaat diya jaata hai — warna
                // Remotion aakhri frame ke baad bhi use draw karne ki koshish
                // karta hai aur duration ka hisaab bigad jaata hai.
                durationInFrames={Math.max(
                  1,
                  Math.min(item.durationInFrames, doc.project.durationInFrames - item.startFrame),
                )}
              >
                <ItemRenderer item={item} track={track} doc={doc} assets={assets} fonts={fontList} />
              </Sequence>
            ))}
          </AbsoluteFill>
        );
        })}

        {/* Watermark sabse upar (17.12) — har parat ke upar. */}
        <WatermarkLayer brand={doc.brand} assets={assets} />
      </AbsoluteFill>
      </BrandProvider>
    </AssetProvider>
  );
};

/** Doc ke items ke hisaab se sabse aakhri frame — worker ke sanity check ke liye. */
export function docContentEndFrame(doc: Doc): number {
  return doc.items.reduce((end, item) => Math.max(end, itemEndFrame(item)), 0);
}
