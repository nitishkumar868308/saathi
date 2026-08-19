"use client";

import { clampFrame } from "@reel/core";
import clsx from "clsx";
import { useCallback, useRef } from "react";

/**
 * Scrub — pakdo aur ghaseeto (checklist 6.7).
 *
 * Ye component jaan-boojhkar "gonga" hai: ise sirf lambai aur abhi ka frame
 * pata hai, playhead ka koi apna state nahi rakhta. Preview ka bar aur timeline
 * ka ruler dono isi ko use karte hain, isliye dono **ek hi** `playheadFrame`
 * likhte hain — do jagah ka scrub kabhi alag frame par nahi ja sakta (6.6).
 *
 * ⚠️ `setPointerCapture` sabse zaroori hissa hai: iske bina maus bar se bahar
 * nikalte hi drag chhoot jaata hai, aur tez ghaseetne par wo **hamesha** hota
 * hai. Capture ke saath pointer chahe kahin bhi chala jaaye, events yahin aate
 * rehte hain.
 */
export function ScrubBar({
  frame,
  durationInFrames,
  onScrub,
  className,
  height = 6,
}: {
  frame: number;
  durationInFrames: number;
  onScrub(frame: number): void;
  className?: string;
  height?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const last = Math.max(0, durationInFrames - 1);

  const frameAt = useCallback(
    (clientX: number): number => {
      const box = ref.current?.getBoundingClientRect();
      if (!box || box.width <= 0) return 0;
      const fraction = (clientX - box.left) / box.width;
      return clampFrame(fraction * last, 0, last);
    },
    [last],
  );

  const percent = last > 0 ? (clampFrame(frame, 0, last) / last) * 100 : 0;

  return (
    <div
      ref={ref}
      role="slider"
      tabIndex={-1}
      aria-label="Playhead"
      aria-valuemin={0}
      aria-valuemax={last}
      aria-valuenow={clampFrame(frame, 0, last)}
      className={clsx("relative w-full cursor-pointer rounded bg-ink-700", className)}
      style={{ height }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onScrub(frameAt(event.clientX));
      }}
      onPointerMove={(event) => {
        // Sirf tab jab button dabaa hua ho — hover par playhead hilana bahut
        // chidhata hai aur galti se hota rehta hai.
        if (event.buttons !== 1) return;
        onScrub(frameAt(event.clientX));
      }}
    >
      <div
        className="absolute inset-y-0 left-0 rounded-l bg-terracotta/60"
        style={{ width: `${percent}%` }}
      />
      <div
        className="absolute top-1/2 h-3 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded bg-chalk-100"
        style={{ left: `${percent}%` }}
      />
    </div>
  );
}
