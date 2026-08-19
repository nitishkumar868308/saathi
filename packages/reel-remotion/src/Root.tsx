import { createEmptyProject } from "@reel/core";
import type React from "react";
import { Composition } from "remotion";

import { ReelComposition, type ReelCompositionProps } from "./ReelComposition";
import { registerBuiltinItemComponents } from "./register";

registerBuiltinItemComponents();

/** Worker aur studio dono isi id se composition maangte hain. */
export const REEL_COMPOSITION_ID = "Reel";

/**
 * Ek hi `<Composition>`, sab kuch props se.
 *
 * ⚠️ Yahan `width`/`height`/`fps`/`durationInFrames` jaan-boojhkar **nahi** likhe
 * gaye. Wo `calculateMetadata` se aate hain, aur wo bhi doc se. Isi wajah se
 * 1080x1920@30 aur 1920x1080@24 ke liye do alag composition nahi banti — sirf
 * doc badalta hai (Dynamic rule 4: koi magic number nahi).
 */
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id={REEL_COMPOSITION_ID}
      component={ReelComposition}
      // Studio kholte hi kuch dikhna chahiye — isliye ek khaali project.
      // Ye sirf default hai; asli doc hamesha inputProps se aata hai.
      defaultProps={{ doc: createEmptyProject({ name: "Khaali project" }), assets: {} }}
      calculateMetadata={({ props }: { props: ReelCompositionProps }) => ({
        width: props.doc.project.width,
        height: props.doc.project.height,
        fps: props.doc.project.fps,
        durationInFrames: props.doc.project.durationInFrames,
      })}
    />
  );
};
