import {
  composeAnimations,
  resolveItemValue,
  transitionOutputAt,
  type Item,
} from "@reel/core";
import type React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";

/**
 * Transform lagane ki **ekmatra** jagah.
 *
 * Har item component apna transform khud lagata to paanch jagah paanch thodi si
 * alag math hoti — aur wahi wajah hoti ki "text thoda hatt kar hai" jaisi cheezein
 * kabhi theek nahi hoti. Ek wrapper hone se sab bilkul ek jaise chalte hain.
 *
 * Yahan teen cheezein ek saath milti hain, aur isi kram me:
 *
 *  1. **Item ka apna transform** (`resolveItemValue` se, isliye har property
 *     keyframe se apne aap animate ho jaati hai)
 *  2. **Animations** (Phase 10) — `composeAnimations()` se
 *  3. **Transition** (Phase 10) — `transitionOutputAt()` se
 *
 * ⚠️ Animation transform ke **upar** lagti hai, use badalti nahi (10.1). Scale
 * guna hoti hai, position judti hai. Agar animation `transform.scale` ko
 * overwrite karti, to user ka apna zoom aur uske keyframes chup-chaap gayab ho
 * jaate — aur wo galti "maine to scale set ki thi, lagi hi nahi" jaisi shikayat
 * bankar aati, jiski wajah dhoondhna bahut mushkil hai.
 */
export const Transformed: React.FC<{
  item: Item;
  localFrame: number;
  children: React.ReactNode;
}> = ({ item, localFrame, children }) => {
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

  const [anchorX, anchorY] = item.transform.anchor;

  return (
    <AbsoluteFill
      style={{
        // CSS transform daayen se baayen lagta hai: pehle scale, phir rotate,
        // phir translate. Isliye position rotation se prabhavit nahi hoti —
        // jo wahi behaviour hai jo har editor me hota hai.
        transform: `translate(${totalX}px, ${totalY}px) rotate(${totalRotation}deg) scale(${totalScale})`,
        transformOrigin: `${anchorX * 100}% ${anchorY * 100}%`,
        opacity: totalOpacity,
        // 0 par bhi `blur(0px)` likhne se browser layer ko GPU par le jaata hai
        // aur render dheema ho jaata hai — isliye zaroorat par hi lagta hai.
        ...(totalBlur > 0 ? { filter: `blur(${totalBlur}px)` } : {}),
        ...(transition?.clipPath ? { clipPath: transition.clipPath } : {}),
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
