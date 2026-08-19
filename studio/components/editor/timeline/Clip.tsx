"use client";

import { getItemType, requireTrackType, type Item, type Track } from "@reel/core";
import clsx from "clsx";
import { EyeOff, Lock } from "lucide-react";

import { useAssetUrl } from "@/lib/assetUrls";
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
  onPointerDown,
  onKeyboardSelect,
}: {
  item: Item;
  track: Track;
  pxPerFrame: number;
  fps: number;
  selected: boolean;
  onPointerDown(event: React.PointerEvent, item: Item): void;
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

  return (
    <button
      type="button"
      data-clip-id={item.id}
      title={clipTooltip(item, fps)}
      aria-label={clipLabel(item)}
      aria-pressed={selected}
      onPointerDown={(event) => onPointerDown(event, item)}
      /*
       * Clip ek asli `<button>` hai, isliye browser ka apna Tab ek clip se
       * doosri par le jaata hai (7.13) — iske liye kisi shortcut ki zaroorat
       * nahi, aur Tab poore app me chalti bhi rehti hai.
       *
       * `detail === 0` ka matlab hai "ye click maus se nahi aayi" — Enter ya
       * Space se aayi hai. Sirf usi par chunte hain; maus wala raasta
       * `onPointerDown` sambhalta hai, jahan Ctrl/Shift ka matlab hota hai.
       * `onFocus` par chunna aasan lagta hai par wo Ctrl+click ko tod deta:
       * click focus bhi karti hai, aur focus wala handler baad me chal kar
       * toggle ko single selection se badal deta.
       */
      onClick={(event) => {
        if (event.detail === 0) onKeyboardSelect(item);
      }}
      className={clsx(
        "absolute overflow-hidden rounded border text-left transition-shadow",
        // Selected ka outline **andar** hai (ring-inset), bahar nahi — bahar wala
        // ring paas-paas rakhe do clips ke beech ghus kar dono ko chuna hua
        // dikhata hai.
        selected
          ? "border-amber ring-2 ring-inset ring-amber/70"
          : "border-black/30 hover:border-chalk-500/50",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-chalk-100",
        item.hidden && "opacity-40",
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
  );
}
