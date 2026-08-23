import {
  applyEffects,
  composeAnimations,
  cropCss,
  maskCss,
  resolveItemValue,
  transitionOutputAt,
  type Item,
} from "@reel/core";
import type React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";

import { useAssetSrc } from "./assetsContext";
import { PhoneFrame } from "./mockups/PhoneFrame";

/**
 * Transform aur effects lagane ki **ekmatra** jagah.
 *
 * Har item component apna transform khud lagata to paanch jagah paanch thodi si
 * alag math hoti — aur wahi wajah hoti ki "text thoda hatt kar hai" jaisi cheezein
 * kabhi theek nahi hoti. Ek wrapper hone se sab bilkul ek jaise chalte hain.
 *
 * Yahan paanch cheezein ek saath milti hain, aur isi kram me:
 *
 *  1. **Item ka apna transform** (`resolveItemValue` se, isliye har property
 *     keyframe se apne aap animate ho jaati hai)
 *  2. **Animations** (Phase 10) — `composeAnimations()` se
 *  3. **Transition** (Phase 10) — `transitionOutputAt()` se
 *  4. **Effects** (Phase 14) — `applyEffects()` se
 *  5. **Mask + blend mode** (Phase 14)
 *
 * ⚠️ Animation transform ke **upar** lagti hai, use badalti nahi (10.1). Scale
 * guna hoti hai, position judti hai. Agar animation `transform.scale` ko
 * overwrite karti, to user ka apna zoom aur uske keyframes chup-chaap gayab ho
 * jaate — aur wo galti "maine to scale set ki thi, lagi hi nahi" jaisi shikayat
 * bankar aati, jiski wajah dhoondhna bahut mushkil hai.
 *
 * ⚠️ Effects yahan hain, `ItemRenderer` me nahi — aur ye ek naap kar liya faisla
 * hai. `ItemRenderer` ke paas item ka DOM nahi hota, wo sirf component chunta
 * hai. Effects ko DOM chahiye (filter, mask, overlay), aur wo DOM yahi banata
 * hai. Item components ko phir bhi effects ke bare me kuch nahi pata — 14.3 ki
 * shart yahi hai, aur wo poori hai.
 */
export const Transformed: React.FC<{
  item: Item;
  localFrame: number;
  /**
   * Item ki apni peeche wali parat (contain wala blurred background).
   *
   * ⚠️ Ye prop ek asli bug ke baad aaya, jo render ke pixels se pakda gaya.
   * Pehle `<FitBackground>` `<Transformed>` ke **bahar** tha. Nateeja: rounded
   * corners lagane par kone se blurred copy jhaank rahi thi — kona kata to tha,
   * par uske peeche item ki hi doosri parat baithi thi. Isi tarah mask, blur aur
   * vignette bhi sirf aadhe item par lagte the.
   *
   * Background item ka **hissa** hai, uske peeche ki koi alag cheez nahi. Isliye
   * ab wo bhi wahi transform, wahi effects aur wahi mask khata hai.
   */
  background?: React.ReactNode;
  children: React.ReactNode;
}> = ({ item, localFrame, background, children }) => {
  const { width, height } = useVideoConfig();
  const frame = { width, height };

  const x = resolveItemValue<number>(item, "transform.x", localFrame);
  const y = resolveItemValue<number>(item, "transform.y", localFrame);
  const scale = resolveItemValue<number>(item, "transform.scale", localFrame);
  const rotation = resolveItemValue<number>(item, "transform.rotation", localFrame);
  const opacity = resolveItemValue<number>(item, "transform.opacity", localFrame);

  const animation = composeAnimations(item, localFrame, frame);
  const transition = transitionOutputAt({
    localFrame,
    durationInFrames: item.durationInFrames,
    transitionIn: item.transitionIn,
    transitionOut: item.transitionOut,
    frame,
  });

  const totalScale = scale * animation.scale * (transition?.scale ?? 1);
  const totalX = x + animation.x + (transition?.x ?? 0);
  const totalY = y + animation.y + (transition?.y ?? 0);
  const totalRotation = rotation + animation.rotation + (transition?.rotation ?? 0);
  const totalOpacity = opacity * animation.opacity * (transition?.opacity ?? 1);
  const totalBlur = animation.blur + (transition?.blur ?? 0);

  const effects = applyEffects(item, localFrame, frame);
  /*
   * Image mask (24.6) — URL context se aata hai, prop se nahi. Wajah
   * `assetsContext.tsx` me likhi hai: mask kisi bhi item par lag sakta hai aur
   * `<Transformed>` un sab ke beech baitha hai, par usse `assets` kabhi nahi
   * milta tha.
   */
  const maskImageUrl = useAssetSrc(item.mask?.assetId ?? null);
  const mask = maskCss(item.mask, maskImageUrl);
  const crop = cropCss(item.transform.crop);

  /*
   * Filter ki ek hi lambi string banti hai, aur kram maayne rakhta hai:
   * pehle animation/transition ka blur, phir user ka stack usi kram me jaisa
   * usne banaya. SVG filter (sharpen) sabse aakhir me, kyunki wo pixels par
   * kaam karta hai aur usse pehle rang tay ho jaana chahiye.
   */
  const filterParts: string[] = [];
  if (totalBlur > 0) filterParts.push(`blur(${totalBlur}px)`);
  if (effects.filter) filterParts.push(effects.filter);
  effects.svgFilters.forEach((_, index) => {
    filterParts.push(`url(#${svgFilterId(item.id, index)})`);
  });

  return (
    <AbsoluteFill
      style={{
        // CSS transform daayen se baayen lagta hai: pehle scale, phir rotate,
        // phir translate. Isliye position rotation se prabhavit nahi hoti —
        // jo wahi behaviour hai jo har editor me hota hai.
        transform: `translate(${totalX}px, ${totalY}px) rotate(${totalRotation}deg) scale(${totalScale})`,
        transformOrigin: `${item.transform.anchor[0] * 100}% ${item.transform.anchor[1] * 100}%`,
        opacity: totalOpacity,
        // "normal" likhna bhi browser ko naya stacking context banwa deta hai,
        // isliye zaroorat par hi likhte hain.
        ...(item.blendMode !== "normal" ? { mixBlendMode: item.blendMode } : {}),
        ...(transition?.clipPath ? { clipPath: transition.clipPath } : {}),
      }}
    >
      {effects.svgFilters.length > 0 ? (
        <svg width={0} height={0} style={{ position: "absolute" }} aria-hidden>
          <defs>
            {effects.svgFilters.map((filter, index) => (
              <filter
                key={svgFilterId(item.id, index)}
                id={svgFilterId(item.id, index)}
                // `sRGB` zaroori hai: default `linearRGB` par sharpen ke kinare
                // par safed halo aa jaata hai aur wo turant nakli lagta hai.
                colorInterpolationFilters="sRGB"
              >
                <feConvolveMatrix
                  order="3"
                  preserveAlpha="true"
                  divisor={filter.divisor ?? 1}
                  kernelMatrix={filter.matrix.join(" ")}
                />
              </filter>
            ))}
          </defs>
        </svg>
      ) : null}

      <AbsoluteFill
        style={{
          ...effects.style,
          ...(filterParts.length > 0 ? { filter: filterParts.join(" ") } : {}),
          ...mask,
        }}
      >
        {/*
         * Crop ki apni parat (15.10).
         *
         * ⚠️ Ise mask ke saath ek hi element par nahi rakha ja sakta: bina
         * feather ke mask bhi `clipPath` likhta hai aur crop bhi. Ek hi object
         * me dono daalne par baad wala pehle wale ko chup-chaap mita deta —
         * yaani mask lagane par crop gayab, ya ulta. Do parat hone se dono
         * apna-apna kaam karte hain.
         *
         * Crop ka `transform` bhi yahin hai, bahar wale element par nahi —
         * wahan item ka apna scale/rotate baitha hai aur ek element par do
         * transform nahi lag sakte.
         */}
        <AbsoluteFill style={crop}>
          {/*
           * Phone mockup (18.1) — media frame ke **andar** jaata hai.
           *
           * ⚠️ Mockup yahan hai, item components me nahi: wahan hota to har
           * component ko alag se ye pata hona padta ki mockup kya hai, aur ek
           * din koi component wo bhool jaata. Yahan hone se har item type par
           * apne aap chalta hai — video, image, kuch bhi.
           *
           * `background` (contain wala blur) mockup se **bahar** rehta hai:
           * blur phone ke peeche hona chahiye, uski screen ke andar nahi.
           */}
          {background}
          {/*
           * ⚠️ Media ko `<AbsoluteFill>` me lapetna **zaroori** hai, sajawat nahi.
           *
           * `background` ek `<AbsoluteFill>` hai, yaani `position: absolute`. Item
           * components apna media ek saade `<Img>` / `<OffthreadVideo>` ke roop me
           * dete hain, jo normal flow me baithta hai. CSS ki painting ka niyam ye
           * hai ki positioned element (chahe `z-index` na ho) normal flow wale
           * content ke UPAR chhapta hai — yaani blurred copy asli tasveer ko
           * poori tarah dhak leti thi.
           *
           * Screen par uska nateeja ye tha: `contain` wala scene bilkul dhundhla
           * dikhta tha, jaise tasveer hi kharab ho. Kuch toota hua nahi dikhta,
           * koi error nahi — bas ek saaf tasveer kabhi dikhti hi nahi thi. Ye
           * mockup wale scene par nahi hota tha (PhoneFrame khud positioned hai),
           * isliye ye galti aur bhi der tak chhupi rahi.
           */}
          <AbsoluteFill>
            {item.mockup ? (
              <PhoneFrame mockup={item.mockup}>{children}</PhoneFrame>
            ) : (
              children
            )}
          </AbsoluteFill>
        </AbsoluteFill>
      </AbsoluteFill>

      {/*
       * Overlays (vignette) item ke **upar** aati hain par mask ke andar nahi —
       * warna vignette ka gehra kinara mask se kat jaata aur uska poora matlab
       * hi khatam ho jaata.
       */}
      {effects.overlays.map((overlay, index) => (
        <AbsoluteFill
          key={`overlay-${index}`}
          style={{
            background: overlay.background,
            ...(overlay.opacity !== undefined ? { opacity: overlay.opacity } : {}),
            ...(overlay.blendMode ? { mixBlendMode: overlay.blendMode as "normal" } : {}),
            ...mask,
            pointerEvents: "none",
          }}
        />
      ))}
    </AbsoluteFill>
  );
};

/** Har item ke apne filter ids — do items ke filter aapas me na takrayein. */
function svgFilterId(itemId: string, index: number): string {
  return `reel-fx-${itemId}-${index}`;
}
