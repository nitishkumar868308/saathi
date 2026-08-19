"use client";

import {
  MAX_PLAYBACK_RATE,
  MIN_PLAYBACK_RATE,
  getItemType,
  type Item,
} from "@reel/core";
import clsx from "clsx";
import { Snowflake } from "lucide-react";

import { useEditorStore } from "@/lib/store";

/** Aksar chahiye jaane wali speeds — poora slider ghumane se tez. */
const SPEED_PRESETS = [0.5, 1, 1.5, 2] as const;

/** Freeze kitna lamba ho, jab tak user na badle. */
const FREEZE_SECONDS = 1.5;

/**
 * Clip ki speed, freeze aur crop (15.7 / 15.8 / 15.10).
 *
 * ⚠️ Speed badalne par clip ki lambai **aur uske keyframes** dono badalte hain,
 * aur wo poora hisaab `setPlaybackRate` op ke andar hai — yahan nahi. Yahi wajah
 * hai ki yahan sirf ek number bheja jaata hai: agar UI apna hisaab lagati, to AI
 * ka patch ya template usi op ko bina us hisaab ke bulakar keyframes tod deta.
 */
export function ClipSection({ items }: { items: readonly Item[] }) {
  const applyOp = useEditorStore((state) => state.applyOp);
  const fps = useEditorStore((state) => state.doc.project.fps);
  const playheadFrame = useEditorStore((state) => state.playheadFrame);

  // Speed sirf un cheezon par jinme waqt hota hai. Image/shape/text par speed ka
  // koi matlab nahi — wahan slider dikhana ek jhooth hai.
  const timed = items.filter((item) => {
    const entry = getItemType(item.type);
    return entry?.hasAudio || item.type === "video";
  });

  const cropable = items.filter((item) => getItemType(item.type)?.hasVisual);
  if (timed.length === 0 && cropable.length === 0) return null;

  const first = timed[0];
  const single = items.length === 1 ? (items[0] as Item) : null;
  const localFrame = single ? playheadFrame - single.startFrame : -1;
  const canFreeze =
    single !== null &&
    timed.length === 1 &&
    localFrame > 0 &&
    localFrame < single.durationInFrames &&
    !single.locked;

  const crop = single?.transform.crop ?? null;

  return (
    <section className="border-t border-ink-800">
      <h3 className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-wide text-chalk-500">Clip</h3>

      {timed.length > 0 && first ? (
        <div className="space-y-1.5 px-3 pb-2">
          <div className="flex items-center gap-2 text-[11px] text-chalk-500">
            <span className="w-20 shrink-0">Speed</span>
            <input
              type="range"
              min={MIN_PLAYBACK_RATE}
              max={MAX_PLAYBACK_RATE}
              step={0.05}
              value={first.playbackRate}
              onChange={(event) =>
                applyOp(
                  "setPlaybackRate",
                  { itemIds: timed.map((item) => item.id), rate: Number(event.target.value) },
                  { label: "Speed", coalesceKey: `speed:${timed.map((i) => i.id).join(",")}` },
                )
              }
              className="min-w-0 flex-1 accent-terracotta"
            />
            <span className="w-14 shrink-0 text-right font-mono text-chalk-400">
              {first.playbackRate.toFixed(2)}x
            </span>
          </div>

          <div className="flex gap-1">
            {SPEED_PRESETS.map((rate) => (
              <button
                key={rate}
                type="button"
                onClick={() =>
                  applyOp(
                    "setPlaybackRate",
                    { itemIds: timed.map((item) => item.id), rate },
                    { label: `Speed ${rate}x` },
                  )
                }
                className={clsx(
                  "flex-1 rounded border px-1 py-0.5 text-[11px] transition-colors",
                  Math.abs(first.playbackRate - rate) < 0.01
                    ? "border-terracotta bg-terracotta/15 text-chalk-200"
                    : "border-ink-600 text-chalk-500 hover:bg-ink-700",
                )}
              >
                {rate}x
              </button>
            ))}
          </div>

          <p className="text-[11px] text-chalk-500">
            Speed badalne par clip ki lambai aur uske keyframes dono saath badalte hain.
          </p>

          <button
            type="button"
            disabled={!canFreeze}
            title={
              canFreeze
                ? "Playhead wale frame ko rok do"
                : "Ek clip chuno aur playhead uske andar rakho (kinare par nahi)"
            }
            onClick={() =>
              single &&
              applyOp(
                "freezeFrame",
                {
                  itemId: single.id,
                  frame: playheadFrame,
                  durationInFrames: Math.round(FREEZE_SECONDS * fps),
                },
                { label: "Freeze frame" },
              )
            }
            className="flex w-full items-center justify-center gap-1.5 rounded border border-ink-600 px-2 py-1 text-[11px] text-chalk-400 transition-colors hover:bg-ink-700 hover:text-chalk-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Snowflake size={12} />
            Freeze frame ({FREEZE_SECONDS}s)
          </button>
        </div>
      ) : null}

      {single && cropable.length > 0 ? (
        <div className="space-y-1.5 px-3 pb-2">
          <div className="flex items-center justify-between text-[11px] text-chalk-500">
            <span>Crop</span>
            <button
              type="button"
              role="switch"
              aria-checked={crop !== null}
              onClick={() =>
                applyOp(
                  "setCrop",
                  {
                    itemIds: [single.id],
                    crop: crop ? null : { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
                  },
                  { label: crop ? "Crop hataya" : "Crop lagaya" },
                )
              }
              className={clsx(
                "h-3 w-6 rounded-full border transition-colors",
                crop ? "border-terracotta bg-terracotta" : "border-ink-500 bg-ink-700",
              )}
            />
          </div>

          {crop ? (
            <>
              <CropRow
                label="X"
                value={crop.x}
                max={1 - crop.width}
                onChange={(x) =>
                  applyOp("setCrop", { itemIds: [single.id], crop: { ...crop, x } }, { label: "Crop X", coalesceKey: `crop:${single.id}` })
                }
              />
              <CropRow
                label="Y"
                value={crop.y}
                max={1 - crop.height}
                onChange={(y) =>
                  applyOp("setCrop", { itemIds: [single.id], crop: { ...crop, y } }, { label: "Crop Y", coalesceKey: `crop:${single.id}` })
                }
              />
              <CropRow
                label="Chaudai"
                value={crop.width}
                min={0.05}
                max={1 - crop.x}
                onChange={(width) =>
                  applyOp("setCrop", { itemIds: [single.id], crop: { ...crop, width } }, { label: "Crop chaudai", coalesceKey: `crop:${single.id}` })
                }
              />
              <CropRow
                label="Oonchai"
                value={crop.height}
                min={0.05}
                max={1 - crop.y}
                onChange={(height) =>
                  applyOp("setCrop", { itemIds: [single.id], crop: { ...crop, height } }, { label: "Crop oonchai", coalesceKey: `crop:${single.id}` })
                }
              />
              <button
                type="button"
                onClick={() =>
                  applyOp(
                    "setCrop",
                    { itemIds: [single.id], crop: { x: 0, y: 0, width: 1, height: 1 } },
                    { label: "Crop reset" },
                  )
                }
                className="w-full rounded border border-ink-600 px-2 py-0.5 text-[11px] text-chalk-500 hover:bg-ink-700"
              >
                Poora frame
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function CropRow({
  label,
  value,
  min = 0,
  max = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[11px] text-chalk-500">
      <span className="w-20 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={Math.max(min, max)}
        step={0.01}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-w-0 flex-1 accent-terracotta"
      />
      <span className="w-14 shrink-0 text-right font-mono text-chalk-400">
        {Math.round(value * 100)}%
      </span>
    </label>
  );
}
