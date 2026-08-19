"use client";

import { MIN_VOLUME_DB, dbToGain, gainToDb, getItemType, itemGainAt, type Item } from "@reel/core";
import { useRef } from "react";

import { useEditorStore } from "@/lib/store";

/**
 * Clip ke upar volume ki lakeer (15.2 / 15.4).
 *
 * Lakeer wahi gain dikhati hai jo sach me bajega — `itemGainAt()` se, yaani
 * fades, volume ke keyframes **aur ducking** teeno milakar. Isi wajah se duck
 * envelope apne aap dikh jaata hai (15.4) aur uske liye koi alag drawing code
 * nahi likhna pada.
 *
 * ⚠️ Lakeer ka oonchai wala paimana **dB** hai, gain nahi. Linear gain par
 * -6 dB (aadhi awaaz) lakeer ke aadhe se kaafi upar baithta hai aur user ko
 * lagta hai ki kuch hua hi nahi. dB par har 6 dB ek jaisa dikhta hai, jaisa har
 * mixer me hota hai.
 *
 * Vertical drag se clip ka apna volume badalta hai. Keyframes lage hon to drag
 * band hai — warna ek drag chup-chaap poori automation ko ek sthir value se
 * badal deta, aur wo undo karne par bhi wapas nahi aati.
 */

/** Lakeer kitne bindu par naapi jaaye — 60 se zyada par farak dikhta nahi. */
const SAMPLES = 60;

/** Sabse neeche wali dB — isse neeche kaan farak nahi karta. */
const FLOOR_DB = -40;

export function VolumeLine({ item, width }: { item: Item; width: number }) {
  const doc = useEditorStore((state) => state.doc);
  const applyOp = useEditorStore((state) => state.applyOp);
  const dragFrom = useRef<{ y: number; db: number } | null>(null);

  if (!getItemType(item.type)?.hasAudio) return null;
  if (item.audio.muted) return null;

  const track = doc.tracks.find((entry) => entry.id === item.trackId);
  if (!track) return null;

  const keyframed = (item.keyframes["audio.volume"]?.length ?? 0) > 0;

  const points: string[] = [];
  for (let index = 0; index <= SAMPLES; index += 1) {
    const localFrame = Math.round((index / SAMPLES) * (item.durationInFrames - 1));
    const gain = itemGainAt({ doc, item, track, localFrame });
    const db = gainToDb(gain);
    // 0 dB upar, FLOOR_DB neeche. `1 - t` isliye ki SVG me y neeche badhta hai.
    const t = Math.min(1, Math.max(0, (db - FLOOR_DB) / (0 - FLOOR_DB)));
    points.push(`${(index / SAMPLES) * 100},${(1 - t) * 100}`);
  }

  function onPointerDown(event: React.PointerEvent<SVGSVGElement>): void {
    if (keyframed || item.locked) return;
    event.stopPropagation();
    event.preventDefault();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    dragFrom.current = { y: event.clientY, db: gainToDb(item.audio.volume) };
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>): void {
    const from = dragFrom.current;
    if (!from) return;
    // Ek clip ki poori oonchai lagbhag 40 dB — wahi paimana jo lakeer dikhati hai.
    const height = (event.currentTarget as SVGSVGElement).clientHeight || 1;
    const db = from.db + ((from.y - event.clientY) / height) * (0 - FLOOR_DB);
    applyOp(
      "setItemAudio",
      {
        itemIds: [item.id],
        field: "volume",
        value: dbToGain(Math.max(MIN_VOLUME_DB, Math.min(12, db))),
      },
      { label: "Volume", coalesceKey: `vol-line:${item.id}` },
    );
  }

  function onPointerUp(): void {
    dragFrom.current = null;
  }

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      width={Math.max(2, width)}
      className={keyframed || item.locked ? "absolute inset-0" : "absolute inset-0 cursor-ns-resize"}
      style={{ height: "100%" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      aria-hidden
    >
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="rgba(255,255,255,0.85)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
