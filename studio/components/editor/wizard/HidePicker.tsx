"use client";

import clsx from "clsx";
import { Trash2 } from "lucide-react";
import { useRef, useState } from "react";

/**
 * Frame ka jo hissa dikhna nahi chahiye — us par chaukor kheencho.
 *
 * ⚠️ Ye ek chhota sa "kheencho" wala tarika hai, chaar sliders nahi. Chaar number
 * (x, y, chaudai, oonchai) likhne par aadmi ko har baar preview aur dabbe ke beech
 * aankh daudani padti hai, aur wo teesre number par chhod deta hai. Kheenchna wahi
 * kaam ek nazar me kar deta hai.
 *
 * ⚠️ Naap **0-1 me** jaata hai, pixel me nahi — kyunki ye reel ke poore frame ka
 * anupaat hai. Preview kitna bhi bada-chhota ho, chunav wahi rehta hai. Pixel
 * likhne par preview ka naap badalte hi dabba khisak jaata.
 */

export interface HideRegion {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Isse chhota chaukor galti se laga hua maana jaata hai. */
const MIN_SIDE = 0.03;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

export function HidePicker({
  preview,
  aspect,
  regions,
  onChange,
}: {
  /** Peeche dikhne wali jhalak — tasveer ka URL. `null` = sirf khaali khaka. */
  preview: string | null;
  /** Frame ka anupaat (chaudai / oonchai) — preview usi shakal me dikhe. */
  aspect: number;
  regions: readonly HideRegion[];
  onChange(next: HideRegion[]): void;
}) {
  const boxRef = useRef<HTMLDivElement | null>(null);
  const [drawing, setDrawing] = useState<HideRegion | null>(null);
  const startRef = useRef<{ x: number; y: number } | null>(null);

  function pointAt(event: React.PointerEvent): { x: number; y: number } | null {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box || box.width === 0 || box.height === 0) return null;
    return {
      x: clamp01((event.clientX - box.left) / box.width),
      y: clamp01((event.clientY - box.top) / box.height),
    };
  }

  function begin(event: React.PointerEvent): void {
    const point = pointAt(event);
    if (!point) return;
    startRef.current = point;
    setDrawing({ x: point.x, y: point.y, width: 0, height: 0 });
    /*
     * ⚠️ Pointer pakad lo. Bina iske ungli/mouse preview se bahar jaate hi
     * kheenchna beech me chhoot jaata hai, aur aadhe kheenche hue dabbe reh jaate
     * hain — aur wo bilkul waisa lagta hai jaise app atak gaya ho.
     */
    (event.target as Element).setPointerCapture?.(event.pointerId);
  }

  function move(event: React.PointerEvent): void {
    const from = startRef.current;
    if (!from) return;
    const point = pointAt(event);
    if (!point) return;
    setDrawing({
      x: Math.min(from.x, point.x),
      y: Math.min(from.y, point.y),
      width: Math.abs(point.x - from.x),
      height: Math.abs(point.y - from.y),
    });
  }

  function end(): void {
    const made = drawing;
    startRef.current = null;
    setDrawing(null);
    /*
     * ⚠️ Bahut chhota chaukor chhod diya jaata hai. Ek saada click bhi ek
     * 0x0 ka dabba banata hai, aur wo list me ek aisi qatar ban kar baithta hai
     * jo dikhti kuch nahi aur hataani padti hai.
     */
    if (!made || made.width < MIN_SIDE || made.height < MIN_SIDE) return;
    onChange([...regions, made]);
  }

  const shown = drawing ? [...regions, drawing] : regions;

  return (
    <div className="space-y-1.5">
      <div
        ref={boxRef}
        onPointerDown={begin}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        style={{ aspectRatio: `${aspect}` }}
        className="relative w-full max-w-[160px] cursor-crosshair overflow-hidden rounded border border-ink-600 bg-ink-900 touch-none select-none"
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" draggable={false} className="h-full w-full object-cover" />
        ) : null}

        {shown.map((region, at) => (
          <div
            key={at}
            className="absolute border border-red-400/70 bg-black/75"
            style={{
              left: `${region.x * 100}%`,
              top: `${region.y * 100}%`,
              width: `${region.width * 100}%`,
              height: `${region.height * 100}%`,
            }}
          />
        ))}
      </div>

      <p className="text-[10px] leading-snug text-chalk-500">
        Jis hisse par dabba kheencho wo reel me dikhega nahi — kaale se dhak jaayega.
      </p>

      {regions.length > 0 ? (
        <ul className="space-y-1">
          {regions.map((region, at) => (
            <li key={at} className="flex items-center gap-1.5">
              <span className={clsx("min-w-0 flex-1 truncate font-mono text-[10px] text-chalk-500")}>
                {Math.round(region.width * 100)}% × {Math.round(region.height * 100)}%
              </span>
              <button
                type="button"
                title="Ye dabba hata do"
                onClick={() => onChange(regions.filter((_, other) => other !== at))}
                className="rounded border border-ink-600 px-1 py-0.5 text-chalk-400 transition-colors hover:border-red-400 hover:text-red-300"
              >
                <Trash2 size={10} />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
