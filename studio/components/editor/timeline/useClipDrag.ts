"use client";

import { itemEndFrame, type Item } from "@reel/core";
import { useCallback, useRef, useState } from "react";

import { useAssetDurations } from "@/lib/assetMeta";
import {
  DRAG_THRESHOLD_PX,
  clampTrimEnd,
  clampTrimStart,
  ghostRects,
  snapCandidates,
  snapEdge,
  snapMove,
  snapThresholdFrames,
  type DragMode,
  type DragState,
  type GhostRect,
} from "@/lib/clipEdit";
import { useEditorStore, useEditorStoreApi } from "@/lib/store";
import { xToFrame, type TrackRow } from "@/lib/timeline";

/**
 * Clip ko ghaseetna aur uske kinare kheenchna (8.1 / 8.2 / 8.3).
 *
 * ⚠️ **Op sirf drop par chalta hai.** Drag ke dauraan sirf yahan ka local state
 * badalta hai aur ghost hilta hai — doc, history aur autosave teeno sote rehte
 * hain. Har pointermove par op chalane se undo me sau entry ban jaati hain
 * (8.1 ka "poora drag ek undo entry" ulta ho jaata) aur 200 clips par UI ruk
 * jaata hai (8.15).
 *
 * ⚠️ Pointer listener `window` par lagte hain, element par nahi. Tez ghaseetne
 * par pointer clip se bahar nikal hi jaata hai, aur element par lage listener
 * wahin chhoot jaate — clip beech raaste me atki reh jaati.
 */
export function useClipDrag(args: {
  rows: readonly TrackRow[];
  pxPerFrame: number;
  /** Client x -> timeline ke andar ka x (scroll ke saath). */
  contentX(clientX: number): number;
}): {
  drag: DragState | null;
  ghosts: GhostRect[];
  beginDrag(event: React.PointerEvent, item: Item, mode: DragMode): void;
} {
  const store = useEditorStoreApi();
  const doc = useEditorStore((state) => state.doc);
  const fps = doc.project.fps;
  const durations = useAssetDurations(fps);

  const [drag, setDrag] = useState<DragState | null>(null);
  const active = useRef(false);

  const beginDrag = useCallback(
    (event: React.PointerEvent, item: Item, mode: DragMode) => {
      if (item.locked) return;
      if (event.button !== 0) return;
      if (active.current) return;

      event.stopPropagation();
      event.preventDefault();
      active.current = true;

      const state = store.getState();
      const rows = args.rows;
      const orderedTrackIds = rows.map((row) => row.track.id);

      // Move me poori selection chalti hai (8.11), par trim hamesha ek hi clip ka.
      const selected = state.selection.itemIds.includes(item.id)
        ? state.selection.itemIds
        : [item.id];
      const itemIds = mode === "move" ? [...selected] : [item.id];

      const moving = state.doc.items.filter((entry) => itemIds.includes(entry.id));
      const groupStart = Math.min(...moving.map((entry) => entry.startFrame));
      const groupEnd = Math.max(...moving.map(itemEndFrame));

      const candidates = snapCandidates({
        doc: state.doc,
        excludeIds: new Set(itemIds),
        playheadFrame: state.playheadFrame,
        inFrame: state.inFrame,
        outFrame: state.outFrame,
      });
      const threshold = snapThresholdFrames(args.pxPerFrame);

      const originX = event.clientX;
      const originY = event.clientY;
      const startRow = rows.findIndex((row) => row.track.id === item.trackId);
      const sourceFrames = durations.sourceFrames(item.assetId);

      let moved = false;
      let current: DragState = {
        mode,
        itemIds,
        deltaFrames: 0,
        trackShift: 0,
        snappedTo: null,
      };

      function onMove(move: PointerEvent) {
        const dx = move.clientX - originX;
        const dy = move.clientY - originY;
        if (!moved && Math.abs(dx) < DRAG_THRESHOLD_PX && Math.abs(dy) < DRAG_THRESHOLD_PX) {
          return;
        }
        moved = true;

        // Alt dabaye rakho to snapping band (8.2).
        const noSnap = move.altKey;
        const rawDelta = dx / args.pxPerFrame;

        if (mode === "move") {
          const snap = snapMove({
            startFrame: groupStart,
            endFrame: groupEnd,
            rawDelta,
            candidates,
            thresholdFrames: threshold,
            disabled: noSnap,
          });

          // Vertical: kis row par ungli hai, wahi track shift. Pixel ki ginti
          // se nahi — rows ki oonchai alag-alag hoti hai (7.5).
          let trackShift = 0;
          if (startRow !== -1 && rows.length > 1) {
            const startTop = (rows[startRow] as TrackRow).top;
            const targetY = startTop + dy;
            let at = rows.findIndex((row) => targetY >= row.top && targetY < row.top + row.height);
            if (at === -1) at = targetY < 0 ? 0 : rows.length - 1;
            trackShift = at - startRow;
          }

          current = { ...current, deltaFrames: snap.deltaFrames, trackShift, snappedTo: snap.snappedTo };
          setDrag(current);
          return;
        }

        if (mode === "trim-start") {
          const wanted = item.startFrame + rawDelta;
          const snap = snapEdge({
            frame: wanted,
            candidates,
            thresholdFrames: threshold,
            disabled: noSnap,
          });
          const delta = clampTrimStart(item, snap.deltaFrames - item.startFrame);
          current = { ...current, deltaFrames: delta, snappedTo: snap.snappedTo };
          setDrag(current);
          return;
        }

        const wantedEnd = itemEndFrame(item) + rawDelta;
        const snap = snapEdge({
          frame: wantedEnd,
          candidates,
          thresholdFrames: threshold,
          disabled: noSnap,
        });
        const delta = clampTrimEnd(item, snap.deltaFrames - itemEndFrame(item), sourceFrames);
        current = { ...current, deltaFrames: delta, snappedTo: snap.snappedTo };
        setDrag(current);
      }

      function onUp() {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onUp);
        active.current = false;
        setDrag(null);

        // Bina hile chhod diya — wo click thi, drag nahi. Selection pehle hi
        // ho chuki hai, isliye yahan koi op nahi.
        if (!moved) return;

        const editor = store.getState();
        if (current.mode === "move") {
          if (current.deltaFrames === 0 && current.trackShift === 0) return;
          editor.applyOp(
            "moveItems",
            {
              itemIds: current.itemIds,
              deltaFrames: current.deltaFrames,
              trackShift: current.trackShift,
              policy: editor.overlapPolicy,
            },
            { label: current.itemIds.length > 1 ? `${current.itemIds.length} clips sarkaye` : "Clip sarkayi" },
          );
          return;
        }

        if (current.deltaFrames === 0) return;
        if (current.mode === "trim-start") {
          editor.applyOp(
            "trimItemStart",
            { itemId: item.id, deltaFrames: current.deltaFrames },
            { label: "Shuruaat trim" },
          );
          return;
        }
        editor.applyOp(
          "trimItemEnd",
          {
            itemId: item.id,
            deltaFrames: current.deltaFrames,
            sourceDurationFrames: sourceFrames,
          },
          { label: "Ant trim" },
        );
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onUp);
    },
    [store, args.rows, args.pxPerFrame, durations],
  );

  const ghosts = drag
    ? ghostRects({ doc, drag, orderedTrackIds: args.rows.map((row) => row.track.id) })
    : [];

  return { drag, ghosts, beginDrag };
}

/** Timeline par x se frame — drag ke bahar bhi kaam aata hai. */
export function frameAtClientX(
  contentX: (clientX: number) => number,
  clientX: number,
  pxPerFrame: number,
): number {
  return xToFrame(contentX(clientX), pxPerFrame);
}
