"use client";

import { RULER_HEIGHT, rulerScale, rulerTicks, type FrameRange } from "@/lib/timeline";

/**
 * Ruler — zoom ke hisaab se badalti hui lakeerein (7.2).
 *
 * Do baatein yahan zaroori hain:
 *
 * 1. **Ticks sirf dikh rahe hisse ki banti hain.** 10 minute @ 30fps = 18000
 *    frames; har scroll par utne DOM node banana timeline ko chipchipa kar deta
 *    hai. `rulerTicks()` ko wahi range di jaati hai jo screen par hai.
 * 2. **Seedhi (step) fps se banti hai**, pixel se nahi. Isliye 24/25/30/60
 *    chaaron par "1 second" ki lakeer theek ek second par padti hai. Fixed
 *    pixel-step par 25fps ke project me labels do second ke beech kahin bhi
 *    gir jaate the.
 */
export function Ruler({
  range,
  pxPerFrame,
  fps,
  onScrub,
}: {
  range: FrameRange;
  pxPerFrame: number;
  fps: number;
  onScrub(clientX: number): void;
}) {
  const scale = rulerScale(pxPerFrame, fps);
  const ticks = rulerTicks({ ...range, pxPerFrame, fps, scale });

  return (
    <div
      // ⚠️ `touch-none` — ruler par ungli se scrub karne ke liye zaroori.
      // Bina iske browser ise page scroll samajh leta hai aur playhead hilta hi nahi.
      className="relative touch-none select-none border-b border-ink-600 bg-ink-900"
      style={{ height: RULER_HEIGHT }}
      // Ruler par kahin bhi dabao ya ghaseeto — playhead wahin aata hai (7.10).
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onScrub(event.clientX);
      }}
      onPointerMove={(event) => {
        if (event.buttons !== 1) return;
        onScrub(event.clientX);
      }}
    >
      {ticks.map((tick) => (
        <div
          key={tick.frame}
          className="absolute bottom-0"
          style={{ left: tick.x }}
        >
          <div
            className={tick.major ? "w-px bg-chalk-500" : "w-px bg-ink-500"}
            style={{ height: tick.major ? 10 : 5 }}
          />
          {tick.label ? (
            // Label lakeer ke daayein — beech me rakhne par pehla label timeline
            // ke bahar nikal jaata hai aur `00:00` kabhi dikhta hi nahi.
            <span className="absolute left-1 top-0 whitespace-nowrap font-mono text-[10px] leading-none text-chalk-500">
              {tick.label}
            </span>
          ) : null}
        </div>
      ))}
    </div>
  );
}
