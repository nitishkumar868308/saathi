"use client";

import {
  EMPTY_SELECTION,
  clampFrame,
  createSelection,
  framesToTimecode,
  selectRange,
  selectSingle,
  toggleSelection,
  type Item,
} from "@reel/core";
import clsx from "clsx";
import { Crosshair, Maximize2, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { Clip } from "@/components/editor/timeline/Clip";
import { Ruler } from "@/components/editor/timeline/Ruler";
import { TrackHeader } from "@/components/editor/timeline/TrackHeader";
import { IconButton } from "@/components/ui/Button";
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
 * Timeline — dikhna, chunna, aur playhead. **Editing Phase 8 me.**
 *
 * Poora naksha `lib/timeline.ts` ke pure functions se banta hai; yahan sirf DOM,
 * pointer aur scroll ka kaam hai. Yahi wajah hai ki ruler, clip, playhead aur
 * marquee chaaron ek hi `frameToX` par baithte hain — chaar jagah alag math
 * likhne par teen mil jaate hain aur chautha hamesha aadha pixel khisak kar
 * chalta hai.
 *
 * ⚠️ **Playhead ka sach store me hai** (`playheadFrame`) — wahi jo Phase 6 ka
 * player padhta hai. Timeline ka scrub, ruler ka drag, transport ka bar, teeno
 * usi ek jagah likhte hain (7.10 / 6.6).
 *
 * ⚠️ **Selection `uiSlice` me hai, doc me nahi** (7.9). Doc me daalne par har
 * click autosave chalata aur Ctrl+Z selection ko bhi ulta deta.
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

  const onClipPointerDown = useCallback(
    (event: React.PointerEvent, item: Item) => {
      // Clip par dabane se marquee shuru nahi hona chahiye.
      event.stopPropagation();
      const state = store.getState();

      if (event.ctrlKey || event.metaKey) {
        setSelection(toggleSelection(state.selection, item.id));
        anchorRef.current = item.id;
        return;
      }
      if (event.shiftKey && anchorRef.current) {
        setSelection(selectRange(state.doc, anchorRef.current, item.id));
        return;
      }
      setSelection(selectSingle(item.id));
      anchorRef.current = item.id;
    },
    [store, setSelection],
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
      />

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
                        onPointerDown={onClipPointerDown}
                        onKeyboardSelect={onKeyboardSelect}
                      />
                    ))}
                  </div>
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

            {/* In/Out (7.11) — abhi sirf dikhte hain, kaam Phase 8 me. */}
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
                  (drag se clip banana Phase 8 me aayega)
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

      <span className="flex-1" />

      {props.inFrame !== null || props.outFrame !== null ? (
        <span className="font-mono text-[11px] text-amber">
          In {props.inFrame === null ? "—" : framesToTimecode(props.inFrame, props.fps, { compact: true })} /
          Out {props.outFrame === null ? "—" : framesToTimecode(props.outFrame, props.fps, { compact: true })}
        </span>
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
