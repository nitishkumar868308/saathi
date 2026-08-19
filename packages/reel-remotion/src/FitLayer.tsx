import { getFitMode, type Item } from "@reel/core";
import type React from "react";

import { useToken } from "./brand";
import { AbsoluteFill } from "remotion";

/**
 * Size & Fit ka render side — README Section 3B.
 *
 * **Fit CSS `object-fit` se hota hai, haath ki math se nahi.** Ye jaan-boojhkar
 * hai: `object-fit` ko source ka natural size khud pata hota hai, jabki humein
 * render ke waqt nahi (asset probe DB me hai, aur wo Phase 5 me aayega). Haath se
 * karne ke liye har image ka size async me poochhna padta, jo har frame par
 * `delayRender` lagata aur render ko dheema + kaanpta bana deta.
 *
 * `@reel/core` ka `computeFit()` bekaar nahi hai — wo UI ke liye hai (auto-fit
 * buttons, upscale warning), jahan asset ka size DB se pata hota hai. Dono ek hi
 * ganit karte hain, bas alag jagah se.
 *
 * User ka zoom (`transform.scale`) iske **upar** lagta hai — `<Transformed>` me.
 * Isliye "Fill frame" dabane ke baad bhi Ken Burns waise ka waisa chalta hai.
 */

export function objectFitFor(item: Item): "cover" | "contain" | "fill" | "none" {
  switch (item.fit.mode) {
    case "cover":
      return "cover";
    case "contain":
      return "contain";
    case "fill":
      return "fill";
    case "custom":
      // Custom me hum kuch decide nahi karte — natural size, baaki user ka transform.
      return "none";
    default:
      return "cover";
  }
}

/**
 * Blurred-copy background ke liye media element kaisa dikhna chahiye.
 *
 * Item component apna `<Img>` ya `<OffthreadVideo>` khud banata hai aur ye style
 * uspar chipka deta hai — isliye ek hi blur look image aur video dono par milta hai.
 */
export const BLUR_LAYER_STYLE: React.CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  // Blur kinaron par pheeka pad jaata hai, isliye thoda bada karke dikhate hain —
  // warna frame ke chaaron taraf halki saaf dhaari dikhti hai.
  transform: "scale(1.15)",
  filter: "blur(48px) brightness(0.65)",
};

/**
 * Jo khaali jagah bachti hai use bharne wali parat.
 *
 * ⚠️ Ye `<Transformed>` ke **bahar** rehti hai. Andar hoti to user ke scale 0.8
 * karte hi background bhi sikud jaata aur kinaron par kaali patti aa jaati —
 * yaani theek wahi cheez jisse bachne ke liye background hai.
 *
 * ⚠️ `blurLayer` **node** hai, src string nahi — aur ye ek asli bug ka nateeja
 * hai. Pehle yahan `src` aata tha aur andar `<Img>` banta tha; isse image par to
 * blurred background chalta tha par **video par chupchaap kaala** aa jaata tha,
 * kyunki `<Img>` video nahi dikha sakta. Ab har item apna media element khud
 * banakar deta hai, isliye aisa dobara ho hi nahi sakta.
 */
export const FitBackground: React.FC<{
  item: Item;
  /** Jise blur karke peeche rakhna hai (already styled with BLUR_LAYER_STYLE). */
  blurLayer?: React.ReactNode;
}> = ({ item, blurLayer }) => {
  const resolveToken = useToken();
  const mode = getFitMode(item.fit.mode);
  if (!mode?.needsBackground) return null;

  const { kind, value } = item.fit.background;

  if (kind === "blurred-asset") {
    // Blur layer na mile to chupchaap kaala dena galat hai — brand ka background
    // dikhana kam se kam imaandaar hai, aur dikhne me bhi behtar.
    if (!blurLayer) {
      return <AbsoluteFill style={{ backgroundColor: resolveToken("brand.background") }} />;
    }
    return <AbsoluteFill>{blurLayer}</AbsoluteFill>;
  }

  if (kind === "gradient") {
    // Gradient tokens Phase 17 (brand presets) me aayenge. Tab tak brand ke
    // apne do rangon ka seedha gradient — koi random rang nahi.
    const from = resolveToken("brand.surface");
    const to = resolveToken("brand.background");
    return (
      <AbsoluteFill
        style={{ background: value ?? `linear-gradient(160deg, ${from} 0%, ${to} 100%)` }}
      />
    );
  }

  // kind === "color" ya "brand" — dono ka raasta ek hi hai, kyunki `resolveToken`
  // token ho to resolve karta hai aur hex ho to waisa hi lauta deta hai.
  const color = resolveToken(value ?? "brand.background");
  return <AbsoluteFill style={{ backgroundColor: color }} />;
};
