"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Kisi element ka asli naap — `ResizeObserver` se.
 *
 * Preview ka player apne dabbe me fit hona chahiye, aur wo dabba do wajah se
 * badalta hai: window resize, aur panel ka drag (ResizeHandle). `window.resize`
 * par bharosa karne se doosra case chhoot jaata tha — panel kheenchne par frame
 * apne purane naap par hi ruka rehta tha. `ResizeObserver` dono pakadta hai.
 *
 * Naap `null` shuru me hota hai (server par element hota hi nahi), isliye bulane
 * wale ko wo case sambhalna padta hai — aur ye achha hai: `0` maan lene par
 * pehle render me scale 0 nikalti aur frame ek jhatke me phailta dikhta.
 */
export function useElementSize<T extends HTMLElement>(): {
  ref: React.RefObject<T>;
  size: { width: number; height: number } | null;
} {
  const ref = useRef<T>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setSize((previous) =>
        // Har pixel par naya object dena matlab har baar poora re-render. Sub-pixel
        // ke chhote badlaav ko rok dena yahan surakshit hai.
        previous && Math.abs(previous.width - width) < 1 && Math.abs(previous.height - height) < 1
          ? previous
          : { width, height },
      );
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return { ref, size };
}
