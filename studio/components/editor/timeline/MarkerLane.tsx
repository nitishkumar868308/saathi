"use client";

import type { Marker } from "@reel/core";
import { useState } from "react";

import { useEditorStore } from "@/lib/store";
import { MARKER_LANE_HEIGHT, frameToX, xToFrame } from "@/lib/timeline";

/**
 * Markers ki patti (16.8) — ruler ke neeche.
 *
 * ⚠️ Markers doc me hain, kisi UI state me nahi. "Yahan beat girti hai" ya
 * "yahan cut karna hai" project ka hissa hai. localStorage me rakhne par wo
 * doosri machine par gayab ho jaate aur user ko lagta ki project hi kharab ho
 * gaya.
 *
 * Patti ki oonchai chhoti hai (10px) aur ye jaan-boojhkar hai: markers timeline
 * ki jagah nahi khaane chahiye, sirf dikhne chahiye.
 */

// Naap `lib/timeline.ts` se — headers ka spacer bhi wahi jod padhta hai,
// warna header aur lane dobara khisak jaate hain (wo bug ho chuka hai).
const LANE_HEIGHT = MARKER_LANE_HEIGHT;

export function MarkerLane({ pxPerFrame, width }: { pxPerFrame: number; width: number }) {
  const markers = useEditorStore((state) => state.doc.markers);
  const applyOp = useEditorStore((state) => state.applyOp);
  const setPlayhead = useEditorStore((state) => state.setPlayhead);
  const [editing, setEditing] = useState<string | null>(null);

  return (
    <div
      className="relative border-b border-ink-800 bg-ink-900/60"
      style={{ height: LANE_HEIGHT, width: Math.max(width, 0) }}
      onDoubleClick={(event) => {
        // Khaali jagah par double-click = wahan marker. Ye sabse seedha raasta
        // hai; `M` shortcut playhead par lagata hai, ye maus wale par.
        const rect = event.currentTarget.getBoundingClientRect();
        applyOp(
          "addMarker",
          { frame: xToFrame(event.clientX - rect.left, pxPerFrame) },
          { label: "Marker" },
        );
      }}
    >
      {markers.map((marker) => (
        <MarkerPin
          key={marker.id}
          marker={marker}
          pxPerFrame={pxPerFrame}
          editing={editing === marker.id}
          onEdit={() => setEditing(marker.id)}
          onEditDone={() => setEditing(null)}
          onJump={() => setPlayhead(marker.frame)}
        />
      ))}
    </div>
  );
}

function MarkerPin({
  marker,
  pxPerFrame,
  editing,
  onEdit,
  onEditDone,
  onJump,
}: {
  marker: Marker;
  pxPerFrame: number;
  editing: boolean;
  onEdit(): void;
  onEditDone(): void;
  onJump(): void;
}) {
  const applyOp = useEditorStore((state) => state.applyOp);
  const x = frameToX(marker.frame, pxPerFrame);

  if (editing) {
    return (
      <input
        autoFocus
        defaultValue={marker.name}
        placeholder="marker ka naam"
        style={{ left: x }}
        onBlur={(event) => {
          applyOp(
            "setMarker",
            { markerId: marker.id, name: event.target.value.trim() },
            { label: "Marker ka naam" },
          );
          onEditDone();
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") onEditDone();
          // Warna `m`, `s`, `[` jaise shortcut typing ke beech chal padte hain.
          event.stopPropagation();
        }}
        className="absolute top-0 z-10 h-3 w-32 rounded border border-terracotta bg-ink-800 px-1 text-[10px] text-chalk-100 outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      title={`${marker.name || "marker"} — click: jump, double-click: naam, right-click: hatao`}
      aria-label={marker.name || `Marker frame ${marker.frame}`}
      style={{ left: x - 4, backgroundColor: marker.color }}
      onClick={onJump}
      onDoubleClick={(event) => {
        event.stopPropagation();
        onEdit();
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        applyOp("deleteMarker", { markerId: marker.id }, { label: "Marker hataya" });
      }}
      className="absolute top-0.5 h-2.5 w-2 rounded-sm ring-offset-0 hover:ring-1 hover:ring-chalk-100"
    >
      {/*
       * Naam pin ke bagal me, pin ke andar nahi — pin 8px ka hai aur usme kuch
       * padha nahi ja sakta. `pointer-events-none` isliye ki naam par click bhi
       * pin par hi jaana chahiye.
       */}
      {marker.name ? (
        <span className="pointer-events-none absolute left-3 top-[-1px] whitespace-nowrap text-[9px] leading-3 text-chalk-400">
          {marker.name}
        </span>
      ) : null}
    </button>
  );
}
