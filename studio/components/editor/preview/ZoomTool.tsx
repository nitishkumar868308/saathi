"use client";

import { checkZoomUpscale, type Item } from "@reel/core";
import clsx from "clsx";
import { useRef, useState } from "react";

import { useAssetDurations } from "@/lib/assetMeta";
import { useEditorStore } from "@/lib/store";

/**
 * Preview par chaukor kheench kar zoom (18.6).
 *
 * ⚠️ Ye tool **keyframes banata hai**, koi naya "zoom" field nahi. Chaukor
 * chhodte hi `applyZoomPan` op chalta hai jo `transform.scale` aur
 * `transform.x/y` ke wahi keyframes lagata hai jo user haath se laga sakta tha.
 * Isliye zoom par undo, curve editor aur keyframe lane — sab apne aap chalte
 * hain.
 *
 * Do keyframes bante hain: **abhi ka playhead** (jahan se zoom shuru ho) aur
 * uske aage ek chhota safar. Sirf ek keyframe lagane par zoom poori clip par
 * sthir rehta, jo koi nahi chahta.
 */

/** Zoom kitne second me poora ho. */
const ZOOM_SECONDS = 1.2;

/** Isse chhota chaukor galti se bana hua drag hai, zoom ki niyat nahi. */
const MIN_RECT = 0.06;

interface DrawState {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

export function ZoomTool({ item, active }: { item: Item | null; active: boolean }) {
  const applyOp = useEditorStore((state) => state.applyOp);
  const doc = useEditorStore((state) => state.doc);
  const playheadFrame = useEditorStore((state) => state.playheadFrame);
  const meta = useAssetDurations(doc.project.fps);

  const boxRef = useRef<HTMLDivElement>(null);
  const [draw, setDraw] = useState<DrawState | null>(null);

  if (!active || !item) return null;

  const rectOf = (state: DrawState) => ({
    x: Math.min(state.fromX, state.toX),
    y: Math.min(state.fromY, state.toY),
    width: Math.abs(state.toX - state.fromX),
    height: Math.abs(state.toY - state.fromY),
  });

  function pointIn(event: React.PointerEvent): { x: number; y: number } | null {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return null;
    return {
      x: Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
      y: Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)),
    };
  }

  function finish(state: DrawState): void {
    const rect = rectOf(state);
    setDraw(null);
    if (!item) return;

    // Bahut chhota chaukor = galti se bana hua drag. Uspar 15x zoom lagana
    // bilkul galat hoga, isliye chup-chaap chhod dete hain.
    if (rect.width < MIN_RECT || rect.height < MIN_RECT) return;

    const localFrame = Math.max(0, playheadFrame - item.startFrame);
    const travel = Math.round(ZOOM_SECONDS * doc.project.fps);

    applyOp(
      "applyZoomPan",
      {
        itemId: item.id,
        steps: [
          { frame: localFrame, rect: { x: 0, y: 0, width: 1, height: 1 } },
          {
            frame: Math.min(item.durationInFrames - 1, localFrame + travel),
            rect,
          },
        ],
      },
      { label: "Zoom" },
    );
  }

  const rect = draw ? rectOf(draw) : null;

  /*
   * Chetavni **kheenchte waqt** dikhti hai, chhodne ke baad nahi — aur ye
   * jaan-boojhkar hai. Chhodne ke baad batane par user ko undo karna padta hai;
   * kheenchte waqt dikhne se wo chaukor bada karke wahin theek kar leta hai.
   */
  const source = meta.sourceSize(item.assetId);
  const upscale =
    rect && source
      ? checkZoomUpscale({
          steps: [{ frame: 0, rect }],
          source,
          frame: { width: doc.project.width, height: doc.project.height },
          baseScale: item.transform.scale,
        })
      : null;

  return (
    <div
      ref={boxRef}
      className="absolute inset-0 z-10 cursor-crosshair"
      onPointerDown={(event) => {
        const point = pointIn(event);
        if (!point) return;
        event.preventDefault();
        (event.target as Element).setPointerCapture?.(event.pointerId);
        setDraw({ fromX: point.x, fromY: point.y, toX: point.x, toY: point.y });
      }}
      onPointerMove={(event) => {
        if (!draw) return;
        const point = pointIn(event);
        if (!point) return;
        setDraw({ ...draw, toX: point.x, toY: point.y });
      }}
      onPointerUp={() => draw && finish(draw)}
      onPointerCancel={() => setDraw(null)}
    >
      {rect ? (
        <>
          {/* Chuni hui jagah ke bahar sab dhundhla — nazar chaukor par jaati hai. */}
          <div
            className="pointer-events-none absolute inset-0 bg-black/45"
            style={{
              clipPath: `polygon(0% 0%, 0% 100%, ${rect.x * 100}% 100%, ${rect.x * 100}% ${rect.y * 100}%, ${(rect.x + rect.width) * 100}% ${rect.y * 100}%, ${(rect.x + rect.width) * 100}% ${(rect.y + rect.height) * 100}%, ${rect.x * 100}% ${(rect.y + rect.height) * 100}%, ${rect.x * 100}% 100%, 100% 100%, 100% 0%)`,
            }}
          />
          <div
            className="pointer-events-none absolute border-2 border-amber"
            style={{
              left: `${rect.x * 100}%`,
              top: `${rect.y * 100}%`,
              width: `${rect.width * 100}%`,
              height: `${rect.height * 100}%`,
            }}
          />
          <div
            className={clsx(
              "pointer-events-none absolute left-2 top-2 rounded px-1.5 py-0.5 font-mono text-[11px]",
              upscale?.level === "error"
                ? "bg-red-500/25 text-red-200"
                : upscale?.level === "warning"
                  ? "bg-amber/25 text-amber"
                  : "bg-black/60 text-chalk-200",
            )}
          >
            {(1 / Math.max(0.02, Math.min(rect.width, rect.height))).toFixed(2)}x
            {upscale?.advice ? ` · ${upscale.advice}` : ""}
            {!source ? " · source ki naap pata nahi" : ""}
          </div>
        </>
      ) : (
        <div className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-chalk-300">
          Jahan zoom karna hai wahan chaukor kheencho
        </div>
      )}
    </div>
  );
}
