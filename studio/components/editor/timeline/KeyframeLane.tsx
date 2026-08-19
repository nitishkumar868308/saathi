"use client";

import { EASINGS, keyframedPaths, type Item, type Keyframe } from "@reel/core";
import clsx from "clsx";
import { Trash2, X } from "lucide-react";
import { useState } from "react";

import { NumberField } from "@/components/controls/NumberField";
import { CurveEditor } from "@/components/editor/timeline/CurveEditor";
import { IconButton } from "@/components/ui/Button";
import { useEditorStore } from "@/lib/store";
import { frameToX, xToFrame } from "@/lib/timeline";

/**
 * Keyframe lanes — chuni hui clip ke neeche, har property ki apni row (13.8).
 *
 * ⚠️ Diamond ki jagah **item-local frame** se banti hai, absolute se nahi.
 * Keyframes clip ke apne start se gine jaate hain (Phase 1 ka locked faisla),
 * isliye clip sarkane par uski poori animation saath sarakti hai — aur lane me
 * bhi wo apni jagah par hi dikhti hai.
 *
 * ⚠️ Lane sirf **ek** clip par dikhta hai. Multi-select me har clip ka apna
 * local frame hota hai; unhe ek hi lane me dikhana matlab alag-alag paimane ki
 * cheezein ek hi lakeer par rakhna, jo padhne me jhooth hota hai.
 */
export function KeyframeLanes({
  item,
  pxPerFrame,
  contentX,
}: {
  item: Item;
  pxPerFrame: number;
  /** Client x -> timeline ke andar ka x. */
  contentX(clientX: number): number;
}) {
  const paths = keyframedPaths(item);
  const [curveFor, setCurveFor] = useState<{ path: string; frame: number } | null>(null);

  if (paths.length === 0) return null;

  return (
    <div className="border-t border-ink-600 bg-ink-950/60">
      {paths.map((path) => (
        <Lane
          key={path}
          item={item}
          path={path}
          pxPerFrame={pxPerFrame}
          contentX={contentX}
          onEditCurve={(frame) => setCurveFor({ path, frame })}
        />
      ))}

      {curveFor ? (
        <CurveEditor
          item={item}
          path={curveFor.path}
          frame={curveFor.frame}
          onClose={() => setCurveFor(null)}
        />
      ) : null}
    </div>
  );
}

function Lane({
  item,
  path,
  pxPerFrame,
  contentX,
  onEditCurve,
}: {
  item: Item;
  path: string;
  pxPerFrame: number;
  contentX(clientX: number): number;
  onEditCurve(frame: number): void;
}) {
  const applyOp = useEditorStore((state) => state.applyOp);
  const list = item.keyframes[path] ?? [];
  const [selected, setSelected] = useState<number | null>(null);

  const left = frameToX(item.startFrame, pxPerFrame);

  return (
    <div className="relative flex h-6 items-center border-b border-ink-800/60">
      <span
        className="sticky left-0 z-10 w-32 shrink-0 truncate bg-ink-950 px-2 text-[10px] text-chalk-500"
        title={path}
      >
        {path}
      </span>

      <IconButton
        className="h-4 w-4 shrink-0"
        variant="danger"
        title={`${path} ke saare keyframes hatao (abhi ki value item par likh di jaayegi)`}
        aria-label="Keyframes hatao"
        onClick={() =>
          applyOp("clearKeyframes", { itemId: item.id, path }, { label: `${path} keyframes hataye` })
        }
      >
        <Trash2 size={9} />
      </IconButton>

      {/* Diamonds clip ke apne hisse me — isliye left offset clip ka start hai. */}
      <div className="relative h-full flex-1">
        {list.map((keyframe) => (
          <Diamond
            key={keyframe.frame}
            keyframe={keyframe}
            item={item}
            path={path}
            x={left + frameToX(keyframe.frame, pxPerFrame)}
            selected={selected === keyframe.frame}
            onSelect={() => setSelected(keyframe.frame)}
            onEditCurve={() => onEditCurve(keyframe.frame)}
            pxPerFrame={pxPerFrame}
            contentX={contentX}
          />
        ))}
      </div>
    </div>
  );
}

function Diamond({
  keyframe,
  item,
  path,
  x,
  selected,
  onSelect,
  onEditCurve,
  pxPerFrame,
  contentX,
}: {
  keyframe: Keyframe;
  item: Item;
  path: string;
  x: number;
  selected: boolean;
  onSelect(): void;
  onEditCurve(): void;
  pxPerFrame: number;
  contentX(clientX: number): number;
}) {
  const applyOp = useEditorStore((state) => state.applyOp);
  const [editing, setEditing] = useState(false);

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        title={`Frame ${keyframe.frame} · ${keyframe.easing}${keyframe.bezier ? " (custom curve)" : ""}\nghaseeto = sarkao · double-click = value · right-click = curve`}
        onPointerDown={(event) => {
          event.stopPropagation();
          event.preventDefault();
          onSelect();

          const element = event.currentTarget;
          element.setPointerCapture(event.pointerId);
          const from = keyframe.frame;
          let moved = false;

          function onMove(move: PointerEvent) {
            // Absolute x se item-local frame — clip ka start ghata kar.
            const next = xToFrame(contentX(move.clientX), pxPerFrame) - item.startFrame;
            const clamped = Math.max(0, Math.min(item.durationInFrames - 1, next));
            if (clamped === from && !moved) return;
            moved = true;
            applyOp(
              "moveKeyframe",
              { itemId: item.id, path, fromFrame: from, toFrame: clamped },
              { label: "Keyframe sarkaya", coalesceKey: `kfmove:${item.id}:${path}:${from}` },
            );
          }
          function onUp() {
            element.removeEventListener("pointermove", onMove);
            element.removeEventListener("pointerup", onUp);
          }
          element.addEventListener("pointermove", onMove);
          element.addEventListener("pointerup", onUp);
        }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          setEditing(true);
        }}
        onContextMenu={(event) => {
          event.preventDefault();
          onEditCurve();
        }}
        onKeyDown={(event) => {
          if (event.key !== "Delete" && event.key !== "Backspace") return;
          event.preventDefault();
          event.stopPropagation();
          applyOp(
            "deleteKeyframe",
            { itemId: item.id, path, frame: keyframe.frame },
            { label: "Keyframe hataya" },
          );
        }}
        className={clsx(
          "absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 cursor-ew-resize border",
          selected ? "border-chalk-100 bg-amber" : "border-black/40 bg-terracotta",
        )}
        style={{ left: x }}
      />

      {editing ? (
        <ValuePopover
          keyframe={keyframe}
          x={x}
          onClose={() => setEditing(false)}
          onCommit={(value) => {
            applyOp(
              "addKeyframe",
              { itemId: item.id, path, frame: keyframe.frame, value },
              { label: "Keyframe ki value" },
            );
            setEditing(false);
          }}
        />
      ) : null}
    </>
  );
}

/**
 * Double-click par value ka chhota dabba.
 *
 * ⚠️ Sirf **number** wali value yahan badalti hai. Rang aur vector ke liye
 * properties panel hai — unka apna control wahan pehle se hai, aur usko yahan
 * dobara likhna do jagah do vyavhaar bana deta.
 */
function ValuePopover({
  keyframe,
  x,
  onClose,
  onCommit,
}: {
  keyframe: Keyframe;
  x: number;
  onClose(): void;
  onCommit(value: number): void;
}) {
  const [value, setValue] = useState(typeof keyframe.value === "number" ? keyframe.value : 0);

  if (typeof keyframe.value !== "number") {
    return (
      <span
        className="absolute top-6 z-30 -translate-x-1/2 rounded border border-ink-600 bg-ink-800 px-2 py-1 text-[10px] text-chalk-500"
        style={{ left: x }}
      >
        Is kism ki value properties panel se badalti hai
        <button type="button" onClick={onClose} className="ml-1 underline">
          theek hai
        </button>
      </span>
    );
  }

  return (
    <span
      className="absolute top-6 z-30 flex -translate-x-1/2 items-center gap-1 rounded border border-ink-600 bg-ink-800 p-1"
      style={{ left: x }}
    >
      <span className="w-20">
        <NumberField value={value} step={0.01} onChange={setValue} />
      </span>
      <IconButton className="h-5 w-5" title="Lagao" aria-label="Lagao" onClick={() => onCommit(value)}>
        <span className="text-[10px]">OK</span>
      </IconButton>
      <IconButton className="h-5 w-5" title="Band karo" aria-label="Band karo" onClick={onClose}>
        <X size={10} />
      </IconButton>
    </span>
  );
}

/** Easing ke naam — right-click menu aur curve editor dono isi list se. */
export const EASING_CHOICES = EASINGS;
