"use client";

import {
  EMPTY_SELECTION,
  OVERLAP_POLICIES,
  clampFrame,
  createSelection,
  framesToTimecode,
  selectRange,
  selectSingle,
  toggleSelection,
  type Item,
  type OverlapPolicy,
} from "@reel/core";
import clsx from "clsx";
import { Crosshair, Maximize2, Scissors, SquareDashedBottom, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Clip } from "@/components/editor/timeline/Clip";
import { Ruler } from "@/components/editor/timeline/Ruler";
import { KeyframeLanes } from "@/components/editor/timeline/KeyframeLane";
import { TrackHeader } from "@/components/editor/timeline/TrackHeader";
import { useClipDrag } from "@/components/editor/timeline/useClipDrag";
import { Button, IconButton } from "@/components/ui/Button";
import { type DragMode } from "@/lib/clipEdit";
import { usePlayback } from "@/lib/playback";
import { useEditorStore, useEditorStoreApi } from "@/lib/store";
import {
  RULER_HEIGHT,
  TRACK_HEADER_WIDTH,
  ZOOM_STEP,
  clampPxPerFrame,
  contentWidth,
  fitPxPerFrame,
  followScrollLeft,
  frameToX,
  itemsInMarquee,
  rectFromPoints,
  totalTracksHeight,
  trackRows,
  visibleFrames,
  visibleItems,
  xToFrame,
  type Rect,
} from "@/lib/timeline";
import { useElementSize } from "@/lib/useElementSize";

/**
 * Timeline — dikhna, chunna, playhead (Phase 7) aur ab editing (Phase 8).
 *
 * Poora naksha `lib/timeline.ts` ke pure functions se banta hai aur drag/trim ka
 * ganit `lib/clipEdit.ts` se; yahan sirf DOM, pointer aur scroll ka kaam hai.
 * Yahi wajah hai ki ruler, clip, playhead, ghost aur marquee — paanchon ek hi
 * `frameToX` par baithte hain.
 *
 * ⚠️ **Playhead ka sach store me hai** (`playheadFrame`) — wahi jo Phase 6 ka
 * player padhta hai (7.10 / 6.6).
 *
 * ⚠️ **Selection `uiSlice` me hai, doc me nahi** (7.9).
 *
 * ⚠️ **Drag ke dauraan doc ko haath nahi lagta** — sirf ghost hilta hai, aur op
 * drop par ek baar chalta hai (8.1 / 8.15).
 */
export function TimelineView() {
  const store = useEditorStoreApi();
  const doc = useEditorStore((state) => state.doc);
  const selection = useEditorStore((state) => state.selection);
  const setSelection = useEditorStore((state) => state.setSelection);
  const playheadFrame = useEditorStore((state) => state.playheadFrame);
  const setPlayhead = useEditorStore((state) => state.setPlayhead);
  const pxPerFrame = useEditorStore((state) => state.zoom);
  const setZoom = useEditorStore((state) => state.setZoom);
  const followPlayhead = useEditorStore((state) => state.followPlayhead);
  const setFollowPlayhead = useEditorStore((state) => state.setFollowPlayhead);
  const trackHeights = useEditorStore((state) => state.trackHeights);
  const inFrame = useEditorStore((state) => state.inFrame);
  const outFrame = useEditorStore((state) => state.outFrame);
  const overlapPolicy = useEditorStore((state) => state.overlapPolicy);
  const autoKeyframe = useEditorStore((state) => state.autoKeyframe);
  const setAutoKeyframe = useEditorStore((state) => state.setAutoKeyframe);
  const setOverlapPolicy = useEditorStore((state) => state.setOverlapPolicy);
  const applyOp = useEditorStore((state) => state.applyOp);
  const playback = usePlayback();

  const { fps, durationInFrames } = doc.project;
  const rows = trackRows(doc.tracks, trackHeights);
  const lanesHeight = totalTracksHeight(rows);
  const width = contentWidth(durationInFrames, pxPerFrame);

  const { ref: scroller, size } = useElementSize<HTMLDivElement>();
  const headersRef = useRef<HTMLDivElement>(null);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [marquee, setMarquee] = useState<Rect | null>(null);

  /** Shift+click ka "kahan se" — aakhri saaf click. */
  const anchorRef = useRef<string | null>(null);

  const viewportWidth = size?.width ?? 0;

  /* ------------------------------------------------------------- scroll */

  const scrollRaf = useRef(0);
  const onScroll = useCallback(() => {
    const element = scroller.current;
    if (!element) return;

    /*
     * Vertical scroll seedha DOM par lagta hai, React state se nahi: headers ka
     * column har scroll par re-render karna sirf jhatke deta hai. Horizontal
     * wala state me jaata hai kyunki virtualization ko wahi chahiye — par rAF se
     * baandha hua, warna ek scroll me 60+ render ho jaate hain.
     */
    if (headersRef.current) {
      headersRef.current.style.transform = `translateY(${-element.scrollTop}px)`;
    }

    if (scrollRaf.current) return;
    scrollRaf.current = requestAnimationFrame(() => {
      scrollRaf.current = 0;
      setScrollLeft(scroller.current?.scrollLeft ?? 0);
    });
  }, [scroller]);

  useEffect(() => () => cancelAnimationFrame(scrollRaf.current), []);

  /* --------------------------------------------------------------- zoom */

  /**
   * Zoom ke baad kis scrollLeft par jaana hai.
   *
   * Ise seedha handler me set nahi kar sakte: us waqt content ki chaudai abhi
   * purane zoom ki hai, aur browser bade scrollLeft ko chup-chaap kaat deta hai.
   * Isliye value yahan rakhi jaati hai aur naye naap ke saath layout hone ke
   * baad lagti hai.
   */
  const pendingScroll = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (pendingScroll.current === null) return;
    const element = scroller.current;
    if (element) element.scrollLeft = pendingScroll.current;
    pendingScroll.current = null;
  }, [pxPerFrame, scroller]);

  const zoomBy = useCallback(
    (factor: number, cursorX?: number) => {
      const next = clampPxPerFrame(pxPerFrame * factor);
      if (next === pxPerFrame) return;

      const element = scroller.current;
      if (element) {
        // Cursor na ho (keyboard se zoom) to beech ko pakad kar rakho — wahi
        // wo jagah hai jise user dekh raha hota hai.
        const anchorX = cursorX ?? element.clientWidth / 2;
        pendingScroll.current = Math.max(
          0,
          ((element.scrollLeft + anchorX) / pxPerFrame) * next - anchorX,
        );
      }
      setZoom(next);
    },
    [pxPerFrame, setZoom, scroller],
  );

  const fitProject = useCallback(() => {
    if (viewportWidth <= 0) return;
    pendingScroll.current = 0;
    setZoom(fitPxPerFrame(viewportWidth, durationInFrames));
  }, [viewportWidth, durationInFrames, setZoom]);

  /*
   * `wheel` DOM par khud lagana padta hai, JSX ke `onWheel` se nahi.
   *
   * React ka wheel listener passive hota hai, aur passive listener me
   * `preventDefault()` chalti hi nahi — matlab Ctrl+wheel par browser poore page
   * ko zoom kar deta aur timeline ka zoom kabhi chalta hi nahi.
   */
  useEffect(() => {
    const element = scroller.current;
    if (!element) return;

    function onWheel(event: WheelEvent) {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const box = element?.getBoundingClientRect();
      zoomBy(event.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP, event.clientX - (box?.left ?? 0));
    }

    element.addEventListener("wheel", onWheel, { passive: false });
    return () => element.removeEventListener("wheel", onWheel);
  }, [zoomBy, scroller]);

  /* ------------------------------------------------- playhead ko follow */

  useEffect(() => {
    if (!followPlayhead || !playback.isPlaying) return;
    const element = scroller.current;
    if (!element) return;

    const next = followScrollLeft({
      playheadFrame,
      scrollLeft: element.scrollLeft,
      viewportWidth: element.clientWidth,
      pxPerFrame,
    });
    // `null` matlab playhead pehle se dikh raha hai. Har frame par scrollLeft
    // likhne se browser apni smooth scrolling se ladta hai aur timeline kaanpta hai.
    if (next !== null) element.scrollLeft = next;
  }, [playheadFrame, followPlayhead, playback.isPlaying, pxPerFrame, scroller]);

  /* ------------------------------------------------------------ pointer */

  /** Client x -> content x (scroll ke saath). */
  const contentX = useCallback(
    (clientX: number): number => {
      const box = scroller.current?.getBoundingClientRect();
      if (!box) return 0;
      return clientX - box.left + (scroller.current?.scrollLeft ?? 0);
    },
    [scroller],
  );

  const scrubTo = useCallback(
    (clientX: number) => {
      const frame = xToFrame(contentX(clientX), pxPerFrame);
      setPlayhead(clampFrame(frame, 0, Math.max(0, durationInFrames - 1)));
    },
    [contentX, pxPerFrame, setPlayhead, durationInFrames],
  );

  const { drag, ghosts, beginDrag } = useClipDrag({ rows, pxPerFrame, contentX });
  const draggingIds = new Set(drag?.itemIds ?? []);

  /**
   * Clip par pointer neeche — pehle selection, phir drag.
   *
   * Kram zaroori hai: drag hamesha **us selection par** chalti hai jo abhi tay
   * hui hai. Ulta karne par Ctrl+click se chuni gayi doosri clip pehle drag me
   * shaamil nahi hoti, aur pehla drag hamesha ek clip peeche chalta hai.
   */
  const onClipPointerDown = useCallback(
    (event: React.PointerEvent, item: Item, mode: DragMode) => {
      event.stopPropagation();
      const state = store.getState();

      if (event.ctrlKey || event.metaKey) {
        setSelection(toggleSelection(state.selection, item.id));
        anchorRef.current = item.id;
      } else if (event.shiftKey && anchorRef.current) {
        setSelection(selectRange(state.doc, anchorRef.current, item.id));
      } else if (!state.selection.itemIds.includes(item.id)) {
        // Pehle se chuni hui clip par dabane se selection nahi tootni chahiye —
        // warna kai clips ko ek saath ghaseetna namumkin ho jaata hai (8.11).
        setSelection(selectSingle(item.id));
        anchorRef.current = item.id;
      }

      // Ctrl/Shift se chunte waqt drag shuru nahi karte — wo chunne ka ishaara
      // hai, sarkane ka nahi.
      if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
        beginDrag(event, item, mode);
      }
    },
    [store, setSelection, beginDrag],
  );

  /** Tab se clip par pahunch kar Enter dabana (7.13). */
  const onKeyboardSelect = useCallback(
    (item: Item) => {
      setSelection(selectSingle(item.id));
      anchorRef.current = item.id;
    },
    [setSelection],
  );

  /** Khaali jagah par drag = rubber band (7.8). */
  const onLanesPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const lanes = event.currentTarget;
      lanes.setPointerCapture(event.pointerId);

      const box = lanes.getBoundingClientRect();
      const origin = { x: event.clientX - box.left, y: event.clientY - box.top };
      const additive = event.ctrlKey || event.metaKey;
      const before = store.getState().selection;

      // Sirf click (bina ghaseete) matlab "sab chhod do" — Esc dabane ke liye
      // keyboard tak jaana har baar chidhata hai.
      let dragged = false;

      function onMove(move: PointerEvent) {
        const point = { x: move.clientX - box.left, y: move.clientY - box.top };
        const rect = rectFromPoints(origin, point);
        if (rect.width < 3 && rect.height < 3) return;
        dragged = true;
        setMarquee(rect);

        const hits = itemsInMarquee(store.getState().doc.items, rows, rect, pxPerFrame);
        setSelection(
          additive
            ? createSelection([...new Set([...before.itemIds, ...hits])])
            : createSelection(hits),
        );
      }

      function onUp() {
        lanes.removeEventListener("pointermove", onMove);
        lanes.removeEventListener("pointerup", onUp);
        setMarquee(null);
        if (!dragged && !additive) setSelection(EMPTY_SELECTION);
      }

      lanes.addEventListener("pointermove", onMove);
      lanes.addEventListener("pointerup", onUp);
    },
    [store, setSelection, rows, pxPerFrame],
  );

  /* ------------------------------------------------- virtualization (7.7) */

  const range = visibleFrames({ scrollLeft, viewportWidth, pxPerFrame });
  const playheadX = frameToX(playheadFrame, pxPerFrame);
  const hasRange = inFrame !== null && outFrame !== null && outFrame > inFrame;

  return (
    <section className="flex h-full min-h-0 flex-col bg-ink-900">
      <Toolbar
        onZoomIn={() => zoomBy(ZOOM_STEP)}
        onZoomOut={() => zoomBy(1 / ZOOM_STEP)}
        onFit={fitProject}
        followPlayhead={followPlayhead}
        onToggleFollow={() => setFollowPlayhead(!followPlayhead)}
        pxPerFrame={pxPerFrame}
        selectionCount={selection.itemIds.length}
        itemCount={doc.items.length}
        trackCount={doc.tracks.length}
        inFrame={inFrame}
        outFrame={outFrame}
        fps={fps}
        overlapPolicy={overlapPolicy}
        onOverlapPolicy={setOverlapPolicy}
        autoKeyframe={autoKeyframe}
        onToggleAutoKeyframe={() => setAutoKeyframe(!autoKeyframe)}
        hasRange={hasRange}
        onCutRange={() =>
          applyOp(
            "cutRange",
            { fromFrame: inFrame as number, toFrame: outFrame as number, ripple: true },
            { label: "Cut selection" },
          )
        }
        onKeepRange={() =>
          applyOp(
            "keepRange",
            { fromFrame: inFrame as number, toFrame: outFrame as number, ripple: true },
            { label: "Keep selection" },
          )
        }
      />

      {/*
        * Keyframe lanes (13.8) — sirf **ek** clip par. Multi-select me har clip
        * ka apna local frame hota hai; unhe ek hi lane me dikhana matlab
        * alag-alag paimane ki cheezein ek lakeer par rakhna, jo padhne me jhooth
        * hota hai.
        */}
      {selection.itemIds.length === 1
        ? (() => {
            const only = doc.items.find((item) => item.id === selection.itemIds[0]);
            return only ? (
              <div className="max-h-32 shrink-0 overflow-auto">
                <KeyframeLanes item={only} pxPerFrame={pxPerFrame} contentX={contentX} />
              </div>
            ) : null;
          })()
        : null}

      <div className="flex min-h-0 flex-1">
        {/* Headers ka column — scroll ke saath khud chalta hai (upar dekho). */}
        <div
          className="shrink-0 overflow-hidden border-r border-ink-600"
          style={{ width: TRACK_HEADER_WIDTH }}
        >
          <div className="border-b border-ink-600 bg-ink-900" style={{ height: RULER_HEIGHT }} />
          <div ref={headersRef}>
            {rows.map((row) => (
              <TrackHeader key={row.track.id} track={row.track} height={row.height} />
            ))}
          </div>
        </div>

        <div
          ref={scroller}
          onScroll={onScroll}
          className="relative min-w-0 flex-1 overflow-auto"
        >
          <div className="relative" style={{ width: Math.max(width, 1), minHeight: "100%" }}>
            <div className="sticky top-0 z-20">
              <Ruler range={range} pxPerFrame={pxPerFrame} fps={fps} onScrub={scrubTo} />
            </div>

            <div
              className="relative"
              style={{ height: Math.max(lanesHeight, 1) }}
              onPointerDown={onLanesPointerDown}
            >
              {/* In-Out ke beech ka hissa halka roshan — 8.5 wale dono button
                  isi hisse par chalte hain, isliye wo dikhna chahiye. */}
              {hasRange ? (
                <div
                  className="pointer-events-none absolute inset-y-0 bg-amber/10"
                  style={{
                    left: frameToX(inFrame as number, pxPerFrame),
                    width: frameToX((outFrame as number) - (inFrame as number), pxPerFrame),
                  }}
                />
              ) : null}

              {rows.map((row) => {
                const onTrack = doc.items.filter((item) => item.trackId === row.track.id);
                // Sirf dikh rahe clips DOM me jaate hain (7.7).
                const shown = visibleItems(onTrack, range);
                return (
                  <div
                    key={row.track.id}
                    className={clsx(
                      "absolute inset-x-0 border-b border-ink-800",
                      row.track.locked && "bg-ink-950/40",
                    )}
                    style={{ top: row.top, height: row.height }}
                  >
                    {shown.map((item) => (
                      <Clip
                        key={item.id}
                        item={item}
                        track={row.track}
                        pxPerFrame={pxPerFrame}
                        fps={fps}
                        selected={selection.itemIds.includes(item.id)}
                        dragging={draggingIds.has(item.id)}
                        onBeginDrag={onClipPointerDown}
                        onKeyboardSelect={onKeyboardSelect}
                      />
                    ))}
                  </div>
                );
              })}

              {/* Ghost — drop karne par kya hoga (8.1). Doc abhi chhua nahi gaya. */}
              {ghosts.map((ghost) => {
                const row = rows.find((entry) => entry.track.id === ghost.trackId);
                if (!row) return null;
                return (
                  <div
                    key={ghost.itemId}
                    className="pointer-events-none absolute z-20 rounded border-2 border-amber bg-amber/20"
                    style={{
                      left: frameToX(ghost.startFrame, pxPerFrame),
                      width: Math.max(2, frameToX(ghost.durationInFrames, pxPerFrame)),
                      top: row.top + 2,
                      height: row.height - 4,
                    }}
                  />
                );
              })}

              {marquee ? (
                <div
                  className="pointer-events-none absolute z-20 border border-amber bg-amber/10"
                  style={{
                    left: marquee.x,
                    top: marquee.y,
                    width: marquee.width,
                    height: marquee.height,
                  }}
                />
              ) : null}
            </div>

            {/* Snap ki lakeer (8.2) — sirf tab jab snap sach me laga ho. */}
            {drag?.snappedTo !== null && drag?.snappedTo !== undefined ? (
              <div
                className="pointer-events-none absolute inset-y-0 z-30 w-px bg-amber"
                style={{ left: frameToX(drag.snappedTo, pxPerFrame) }}
              />
            ) : null}

            {/* In/Out (7.11) */}
            {inFrame !== null ? (
              <Marker frame={inFrame} pxPerFrame={pxPerFrame} kind="in" />
            ) : null}
            {outFrame !== null ? (
              <Marker frame={outFrame} pxPerFrame={pxPerFrame} kind="out" />
            ) : null}

            {/* Playhead sabse upar — uska sirf handle pakda ja sakta hai, lakeer
                nahi, warna wo neeche ke clips ke click kha jaata. */}
            <div
              className="pointer-events-none absolute inset-y-0 z-30 w-px bg-terracotta"
              style={{ left: playheadX }}
            >
              <span
                className="pointer-events-auto absolute -left-1.5 top-0 h-3 w-3 cursor-ew-resize rounded-b bg-terracotta"
                title="Playhead"
                onPointerDown={(event) => {
                  event.stopPropagation();
                  event.currentTarget.setPointerCapture(event.pointerId);
                  scrubTo(event.clientX);
                }}
                onPointerMove={(event) => {
                  if (event.buttons !== 1) return;
                  scrubTo(event.clientX);
                }}
              />
            </div>

            {doc.items.length === 0 ? (
              // 7.12 — naye project me saaf hint. Khaali kaali patti dekh kar
              // pehla sawaal hamesha "ab kya karun" hota hai.
              <div className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-xs text-chalk-500">
                Timeline khaali hai — baayein Media library se koi file yahan drag karo
                <br />
                <span className="text-[11px] text-ink-500">
                  (drag se clip banana Phase 9 me aayega)
                </span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- toolbar */

function Toolbar(props: {
  onZoomIn(): void;
  onZoomOut(): void;
  onFit(): void;
  followPlayhead: boolean;
  onToggleFollow(): void;
  pxPerFrame: number;
  selectionCount: number;
  itemCount: number;
  trackCount: number;
  inFrame: number | null;
  outFrame: number | null;
  fps: number;
  overlapPolicy: OverlapPolicy;
  onOverlapPolicy(policy: OverlapPolicy): void;
  autoKeyframe: boolean;
  onToggleAutoKeyframe(): void;
  hasRange: boolean;
  onCutRange(): void;
  onKeepRange(): void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-ink-600 px-2 py-1">
      <span className="text-xs uppercase tracking-wide text-chalk-500">Timeline</span>

      <IconButton onClick={props.onZoomOut} title="Zoom out (-)" aria-label="Zoom out" className="h-6 w-6">
        <ZoomOut size={12} />
      </IconButton>
      <IconButton onClick={props.onZoomIn} title="Zoom in (+)" aria-label="Zoom in" className="h-6 w-6">
        <ZoomIn size={12} />
      </IconButton>
      <IconButton onClick={props.onFit} title="Poora project fit karo" aria-label="Fit project" className="h-6 w-6">
        <Maximize2 size={12} />
      </IconButton>
      <IconButton
        onClick={props.onToggleFollow}
        title={
          props.followPlayhead
            ? "Playback me timeline playhead ke peeche chalti hai"
            : "Playback me timeline apni jagah rehti hai"
        }
        aria-label="Playhead follow"
        variant={props.followPlayhead ? "primary" : "ghost"}
        className="h-6 w-6"
      >
        <Crosshair size={12} />
      </IconButton>

      <span className="font-mono text-[11px] text-chalk-500">
        {props.pxPerFrame.toFixed(2)} px/frame
      </span>

      {/*
        * Auto-keyframe (13.4). Default off hai: on rehne par har chhoti edit ek
        * keyframe chhod jaati hai, aur do din baad clip par bees keyframes hote
        * hain jinme se pandrah user ne jaan kar nahi lagaye. Us gandagi ko saaf
        * karna keyframe lagane se zyada mehnat ka kaam hai.
        */}
      <button
        type="button"
        onClick={() => props.onToggleAutoKeyframe()}
        title={
          props.autoKeyframe
            ? "Auto-keyframe ON — property badalne par playhead par keyframe banega"
            : "Auto-keyframe OFF — property seedhi badlegi (keyframe ke liye panel me diamond dabao)"
        }
        className={clsx(
          "rounded-md border px-2 py-1 text-[11px] transition-colors",
          props.autoKeyframe
            ? "border-amber/50 bg-amber/15 text-amber"
            : "border-ink-600 text-chalk-500 hover:bg-ink-700",
        )}
      >
        Auto-KF
      </button>

      {/*
       * Overlap policy (8.9) — ek hi jagah, aur har op yahi maanta hai.
       * List `OVERLAP_POLICIES` se banti hai, yahan koi naam likha nahi hai.
       */}
      <select
        value={props.overlapPolicy}
        onChange={(event) => props.onOverlapPolicy(event.target.value as OverlapPolicy)}
        title="Do clips ek jagah aa jaayein to kya ho"
        className="rounded-md border border-ink-600 bg-ink-900 px-1 py-0.5 text-[11px] outline-none"
      >
        {OVERLAP_POLICIES.map((policy) => (
          <option key={policy.id} value={policy.id} title={policy.hint}>
            {policy.label}
          </option>
        ))}
      </select>

      <span className="flex-1" />

      {/*
       * Cut / Keep sirf tab dikhte hain jab In aur Out dono lage hon.
       * Bina range ke ye button kuch kar hi nahi sakte — aur jo button kuch
       * nahi karta wo toota hua button hai (README rule 5).
       */}
      {props.hasRange ? (
        <>
          <span className="font-mono text-[11px] text-amber">
            {framesToTimecode(props.inFrame as number, props.fps, { compact: true })} →{" "}
            {framesToTimecode(props.outFrame as number, props.fps, { compact: true })}
          </span>
          <Button
            icon={<Scissors size={12} />}
            onClick={props.onCutRange}
            title="In-Out ke beech ka hissa hatao (aage ka sab khisak jaayega)"
            className="px-2 py-0.5 text-[11px]"
          >
            Cut
          </Button>
          <Button
            icon={<SquareDashedBottom size={12} />}
            onClick={props.onKeepRange}
            title="Sirf In-Out ke beech ka hissa rakho"
            className="px-2 py-0.5 text-[11px]"
          >
            Keep
          </Button>
        </>
      ) : null}

      <span className="text-[11px] text-chalk-500">
        {props.trackCount} track · {props.itemCount} item
        {props.selectionCount > 0 ? ` · ${props.selectionCount} chune hue` : ""}
      </span>
    </div>
  );
}

function Marker({
  frame,
  pxPerFrame,
  kind,
}: {
  frame: number;
  pxPerFrame: number;
  kind: "in" | "out";
}) {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-10 w-px bg-amber/70"
      style={{ left: frameToX(frame, pxPerFrame) }}
    >
      <span
        className={clsx(
          "absolute top-0 rounded-b bg-amber px-0.5 text-[9px] font-bold leading-tight text-ink-950",
          kind === "in" ? "left-0" : "right-0",
        )}
      >
        {kind === "in" ? "I" : "O"}
      </span>
    </div>
  );
}
