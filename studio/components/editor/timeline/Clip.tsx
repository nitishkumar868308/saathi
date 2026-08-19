"use client";

import { getItemType, requireTrackType, type Item, type Track } from "@reel/core";
import clsx from "clsx";
import { EyeOff, Lock } from "lucide-react";

import { useAssetUrl } from "@/lib/assetUrls";
import { TRIM_HANDLE_PX, type DragMode } from "@/lib/clipEdit";
import { clipLabel, clipTooltip, frameToX } from "@/lib/timeline";

/**
 * Ek clip.
 *
 * Rang track type ki registry entry se aata hai (7.6) — clip me `if (type ===
 * "audio")` jaisa kuch nahi. Naya track type jodne par uska rang apne aap yahan
 * aa jaata hai.
 *
 * **Thumbnail dobara nahi banti.** Phase 5 me har asset ka thumbnail ek hi baar
 * bana tha (`permanent/thumbs/<id>.jpg`) — image ka resize, video ka poster,
 * audio ki waveform. Yahi wapas use hota hai (`?thumb=1`), isliye timeline khol
 * ne par koi naya kaam nahi hota.
 *
 * ⚠️ Image/video ke liye thumbnail **repeat** hoti hai (film-strip jaisi), aur
 * audio ke liye poori chaudai me khinchti hai. Waveform ko repeat karna galat
 * hoga: wo poori clip ki awaaz ki shakl hai, ek tile nahi — repeat karne par wo
 * jhooth bolne lagti.
 */
export function Clip({
  item,
  track,
  pxPerFrame,
  fps,
  selected,
  dragging,
  onBeginDrag,
  onKeyboardSelect,
}: {
  item: Item;
  track: Track;
  pxPerFrame: number;
  fps: number;
  selected: boolean;
  /** Abhi ghaseeti ja rahi hai — asli clip halki dikhti hai, ghost saaf. */
  dragging: boolean;
  onBeginDrag(event: React.PointerEvent, item: Item, mode: DragMode): void;
  onKeyboardSelect(item: Item): void;
}) {
  const type = requireTrackType(track.type);
  const itemType = getItemType(item.type);
  const { url } = useAssetUrl(item.assetId, { thumb: true });

  const width = frameToX(item.durationInFrames, pxPerFrame);
  const strip = url
    ? itemType?.hasAudio && !itemType.hasVisual
      ? { backgroundImage: `url(${url})`, backgroundSize: "100% 100%" }
      : { backgroundImage: `url(${url})`, backgroundSize: "auto 100%", backgroundRepeat: "repeat-x" }
    : undefined;

  /*
   * Handle tabhi dikhte hain jab clip unke liye kaafi chaudi ho.
   *
   * Patli clip par do handle poori clip ko dhak lete hain aur usko ghaseetna hi
   * namumkin ho jaata hai — user ko lagta hai clip "chipak gayi" hai. Handle
   * hatane se wo clip kam se kam sarkayi to ja sakti hai (trim ke liye zoom
   * karna padega, jo saaf raasta hai).
   */
  const showHandles = !item.locked && width > TRIM_HANDLE_PX * 3;

  return (
    <div
      data-clip-id={item.id}
      className={clsx(
        "absolute overflow-hidden rounded border",
        selected
          ? // Selected ka outline **andar** hai (ring-inset), bahar nahi — bahar
            // wala ring paas-paas rakhe do clips ke beech ghus kar dono ko
            // chuna hua dikhata hai.
            "border-amber ring-2 ring-inset ring-amber/70"
          : "border-black/30 hover:border-chalk-500/50",
        item.hidden && "opacity-40",
        dragging && "opacity-30",
      )}
      style={{
        left: frameToX(item.startFrame, pxPerFrame),
        width: Math.max(2, width),
        top: 2,
        bottom: 2,
        backgroundColor: type.color,
      }}
    >
      {strip ? (
        <span
          className="pointer-events-none absolute inset-0 opacity-45"
          style={strip}
          aria-hidden
        />
      ) : null}

      <button
        type="button"
        title={clipTooltip(item, fps)}
        aria-label={clipLabel(item)}
        aria-pressed={selected}
        onPointerDown={(event) => onBeginDrag(event, item, "move")}
        /*
         * Clip ek asli `<button>` hai, isliye browser ka apna Tab ek clip se
         * doosri par le jaata hai (7.13) — iske liye kisi shortcut ki zaroorat
         * nahi, aur Tab poore app me chalti bhi rehti hai.
         *
         * `detail === 0` ka matlab hai "ye click maus se nahi aayi" — Enter ya
         * Space se aayi hai. Sirf usi par chunte hain; maus wala raasta
         * `onPointerDown` sambhalta hai, jahan Ctrl/Shift ka matlab hota hai.
         */
        onClick={(event) => {
          if (event.detail === 0) onKeyboardSelect(item);
        }}
        className={clsx(
          "absolute inset-0 cursor-grab text-left active:cursor-grabbing",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-chalk-100",
        )}
      >
        {/* Label ke peeche halki chaadar — warna thumbnail ke upar text padhna
            mushkil ho jaata hai, khaas kar safed frames par. */}
        <span className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-1 bg-black/35 px-1 py-0.5">
          {item.locked ? <Lock size={9} className="shrink-0 text-amber" /> : null}
          {item.hidden ? <EyeOff size={9} className="shrink-0 text-chalk-300" /> : null}
          <span className="truncate text-[10px] leading-none text-chalk-100">
            {clipLabel(item)}
          </span>
        </span>
      </button>

      {showHandles ? (
        <>
          <TrimHandle side="start" onPointerDown={(event) => onBeginDrag(event, item, "trim-start")} />
          <TrimHandle side="end" onPointerDown={(event) => onBeginDrag(event, item, "trim-end")} />
        </>
      ) : null}
    </div>
  );
}

/**
 * Kinare ka handle.
 *
 * ⚠️ Ye button ke **upar** baithta hai (baad me render hota hai), isliye kinare
 * par dabane se trim shuru hoti hai aur beech me dabane se move. Ulta kram
 * rakhne par trim kabhi chalti hi nahi — button poori clip ghera hua hai.
 */
function TrimHandle({
  side,
  onPointerDown,
}: {
  side: "start" | "end";
  onPointerDown(event: React.PointerEvent): void;
}) {
  return (
    <span
      role="separator"
      aria-label={side === "start" ? "Shuruaat trim" : "Ant trim"}
      onPointerDown={onPointerDown}
      className={clsx(
        "absolute inset-y-0 cursor-ew-resize bg-chalk-100/0 transition-colors hover:bg-chalk-100/30",
        side === "start" ? "left-0" : "right-0",
      )}
      style={{ width: TRIM_HANDLE_PX }}
    />
  );
}
