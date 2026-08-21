"use client";

import type { Item } from "@reel/core";
import clsx from "clsx";
import { useState } from "react";

import { useEditorStore } from "@/lib/store";
import { frameToX, xToFrame } from "@/lib/timeline";

/**
 * Caption lane — chuni hui subtitle clip ke neeche, har cue ka apna block (19.3).
 *
 * ⚠️ Cue ke frame **item-local** hain, absolute nahi — bilkul keyframes ki tarah
 * (Phase 1 ka locked faisla). Isliye block ki jagah `clip ka start + cue ka
 * frame` se banti hai, aur clip sarkane par saare cue apne aap saath sarakte
 * hain. Agar yahan absolute frame maan liye jaate to clip khiskate hi captions
 * apni jagah chhod deti — aur wo galti sirf export dekhne par pakdi jaati.
 *
 * ⚠️ Lane sirf **ek** clip par dikhta hai (multi-select me nahi). Har clip ka
 * apna local paimana hota hai; do clips ke cue ek hi lakeer par rakhna padhne
 * me jhooth hota hai.
 *
 * ⚠️ Op **chhodne par** chalta hai, har pointermove par nahi — warna ek drag se
 * sau history entry ban jaati aur Ctrl+Z bekaar ho jaata. Drag ke dauraan sirf
 * ye component apne andar ghost rakhta hai.
 */

type DragMode = "move" | "start" | "end";

export function CaptionLane({
  item,
  pxPerFrame,
  contentX,
}: {
  item: Item;
  pxPerFrame: number;
  /** Client x -> timeline ke andar ka x. */
  contentX(clientX: number): number;
}) {
  const applyOp = useEditorStore((state) => state.applyOp);
  const cues = item.subtitle?.cues ?? [];
  const [ghost, setGhost] = useState<{ id: string; start: number; end: number } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  if (!item.subtitle || cues.length === 0) return null;

  const clipLeft = frameToX(item.startFrame, pxPerFrame);

  function beginDrag(
    event: React.PointerEvent,
    cue: { id: string; startFrame: number; endFrame: number },
    mode: DragMode,
  ): void {
    event.preventDefault();
    event.stopPropagation();
    setSelected(cue.id);

    const startX = contentX(event.clientX);
    const from = { start: cue.startFrame, end: cue.endFrame };

    function frameDelta(clientX: number): number {
      return Math.round(xToFrame(contentX(clientX) - startX, pxPerFrame));
    }

    function next(clientX: number): { start: number; end: number } {
      const delta = frameDelta(clientX);
      if (mode === "move") return { start: Math.max(0, from.start + delta), end: from.end + delta };
      if (mode === "start") {
        // Cue ko ulta nahi hone dete — 1 frame ki hadd yahin, taaki drag ke
        // dauraan bhi block dikhta rahe (op me bhi ek pehra hai).
        return { start: Math.max(0, Math.min(from.start + delta, from.end - 1)), end: from.end };
      }
      return { start: from.start, end: Math.max(from.start + 1, from.end + delta) };
    }

    function onMove(move: PointerEvent): void {
      setGhost({ id: cue.id, ...next(move.clientX) });
    }

    function onUp(up: PointerEvent): void {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setGhost(null);

      const target = next(up.clientX);
      if (target.start === from.start && target.end === from.end) return;
      applyOp(
        "setCue",
        { itemId: item.id, cueId: cue.id, startFrame: target.start, endFrame: target.end },
        { label: "Caption timing" },
      );
    }

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <div className="relative flex h-6 items-center border-b border-ink-800/60 bg-ink-950/60">
      <span
        className="sticky left-0 z-10 w-32 shrink-0 truncate bg-ink-950 px-2 text-[10px] text-chalk-500"
        title={`${cues.length} caption — block ghaseeto se timing badlegi`}
      >
        captions ({cues.length})
      </span>

      <div className="relative h-full flex-1">
        {cues.map((cue) => {
          const live = ghost && ghost.id === cue.id ? ghost : { start: cue.startFrame, end: cue.endFrame };
          const x = clipLeft + frameToX(live.start, pxPerFrame);
          const width = Math.max(3, frameToX(live.end - live.start, pxPerFrame));
          const isSelected = selected === cue.id;

          return (
            <div
              key={cue.id}
              className={clsx(
                "absolute top-1/2 flex h-4 -translate-y-1/2 items-center rounded-sm border text-[9px]",
                isSelected
                  ? "border-chalk-100 bg-sage/50 text-chalk-100"
                  : "border-sage/60 bg-sage/25 text-chalk-300",
                ghost && ghost.id === cue.id && "opacity-70",
                // ⚠️ Phone par drag ke liye zaroori — warna browser scroll le uddta hai.
                "touch-none",
              )}
              style={{ left: x, width }}
              /*
               * Poora block hi tooltip hai — cue ka text yahin dikh jaata hai,
               * kyunki block me wo aksar sirf do-teen akshar hi samaata hai.
               */
              title={`${cue.text}\n${live.start} → ${live.end} (${live.end - live.start} frames)`}
              onPointerDown={(event) => beginDrag(event, cue, "move")}
            >
              <span
                className="absolute inset-y-0 left-0 w-1 cursor-ew-resize touch-none rounded-l-sm bg-chalk-100/0 hover:bg-chalk-100/50"
                onPointerDown={(event) => beginDrag(event, cue, "start")}
              />
              <span className="pointer-events-none min-w-0 flex-1 truncate px-1.5">{cue.text}</span>
              <span
                className="absolute inset-y-0 right-0 w-1 cursor-ew-resize touch-none rounded-r-sm bg-chalk-100/0 hover:bg-chalk-100/50"
                onPointerDown={(event) => beginDrag(event, cue, "end")}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
