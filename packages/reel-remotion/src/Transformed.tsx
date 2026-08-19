import { resolveItemValue, type Item } from "@reel/core";
import type React from "react";
import { AbsoluteFill } from "remotion";

/**
 * Transform lagane ki **ekmatra** jagah.
 *
 * Har item component apna transform khud lagata to paanch jagah paanch thodi si
 * alag math hoti — aur wahi wajah hoti ki "text thoda hatt kar hai" jaisi cheezein
 * kabhi theek nahi hoti. Ek wrapper hone se sab bilkul ek jaise chalte hain.
 *
 * Values `resolveItemValue()` se aati hain, seedha `item.transform` se nahi —
 * isliye har property keyframe se apne aap animate ho jaati hai. Ken Burns iske
 * alawa kuch nahi hai: `transform.scale` par do keyframes.
 */
export const Transformed: React.FC<{
  item: Item;
  localFrame: number;
  children: React.ReactNode;
}> = ({ item, localFrame, children }) => {
  const x = resolveItemValue<number>(item, "transform.x", localFrame);
  const y = resolveItemValue<number>(item, "transform.y", localFrame);
  const scale = resolveItemValue<number>(item, "transform.scale", localFrame);
  const rotation = resolveItemValue<number>(item, "transform.rotation", localFrame);
  const opacity = resolveItemValue<number>(item, "transform.opacity", localFrame);

  const [anchorX, anchorY] = item.transform.anchor;

  return (
    <AbsoluteFill
      style={{
        // CSS transform daayen se baayen lagta hai: pehle scale, phir rotate,
        // phir translate. Isliye position rotation se prabhavit nahi hoti —
        // jo wahi behaviour hai jo har editor me hota hai.
        transform: `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`,
        transformOrigin: `${anchorX * 100}% ${anchorY * 100}%`,
        opacity,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
