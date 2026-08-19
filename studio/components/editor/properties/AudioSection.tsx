"use client";

import {
  FADE_SHAPES,
  MAX_VOLUME_DB,
  MIN_VOLUME_DB,
  dbToGain,
  gainToDb,
  getItemType,
  type Item,
} from "@reel/core";
import clsx from "clsx";
import { Volume2, VolumeX } from "lucide-react";

import { KeyframeButton } from "@/components/controls/KeyframeButton";
import { useEditorStore } from "@/lib/store";

/**
 * Ek clip ka audio (15.1 / 15.2).
 *
 * ⚠️ Volume **dB me** dikhta hai, 0-1 me nahi — aur ye ek soch-samajh kar liya
 * faisla hai. 0-1 wala slider dhokha deta hai: 0.5 par awaaz aadhi nahi lagti,
 * lagbhag 0.7 jitni lagti hai, kyunki kaan log scale par sunta hai. dB par
 * "-6" ka matlab har jagah ek hi hota hai aur user ka dusre editors ka tajurba
 * yahan seedha kaam aa jaata hai.
 *
 * Andar doc me linear gain hi rehta hai (render ko wahi chahiye); badalna sirf
 * dikhane ke liye hai.
 */
export function AudioSection({ items, localFrame }: { items: readonly Item[]; localFrame: number }) {
  const applyOp = useEditorStore((state) => state.applyOp);

  // Sirf un items par jinke paas sach me awaaz hoti hai. Shape/text par volume
  // slider dikhana ek jhooth hai — wo kabhi kuch nahi karta.
  const audible = items.filter((item) => getItemType(item.type)?.hasAudio);
  if (audible.length === 0) return null;

  const itemIds = audible.map((item) => item.id);
  const first = audible[0] as Item;
  const single = audible.length === 1 ? first : null;

  const db = gainToDb(first.audio.volume);
  const mixed = audible.some((item) => item.audio.volume !== first.audio.volume);

  const set = (field: string, value: unknown, label: string, coalesce?: string) =>
    applyOp("setItemAudio", { itemIds, field, value }, { label, coalesceKey: coalesce });

  return (
    <section className="border-t border-ink-800">
      <h3 className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-wide text-chalk-500">Audio</h3>

      <div className="space-y-1.5 px-3 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            title={first.audio.muted ? "Awaaz chalu karo" : "Chup karo"}
            aria-label={first.audio.muted ? "Unmute" : "Mute"}
            onClick={() => set("muted", !first.audio.muted, first.audio.muted ? "Unmute" : "Mute")}
            className={clsx(
              "shrink-0 rounded border px-1 py-0.5",
              first.audio.muted
                ? "border-amber/50 bg-amber/10 text-amber"
                : "border-ink-600 text-chalk-500 hover:bg-ink-700",
            )}
          >
            {first.audio.muted ? <VolumeX size={12} /> : <Volume2 size={12} />}
          </button>

          <input
            type="range"
            min={MIN_VOLUME_DB}
            max={MAX_VOLUME_DB}
            step={0.5}
            value={mixed ? 0 : Math.round(db * 2) / 2}
            disabled={first.audio.muted}
            onChange={(event) =>
              set("volume", dbToGain(Number(event.target.value)), "Volume", `vol:${itemIds.join(",")}`)
            }
            className="min-w-0 flex-1 accent-terracotta disabled:opacity-40"
          />
          <span className="w-14 shrink-0 text-right font-mono text-[11px] text-chalk-400">
            {mixed ? "—" : db <= MIN_VOLUME_DB ? "chup" : `${db > 0 ? "+" : ""}${db.toFixed(1)} dB`}
          </span>

          {/*
           * Volume par keyframe (15.2). Path `audio.volume` hai — wahi keyframe
           * engine jo transform par chalta hai, koi alag audio-automation system
           * nahi.
           */}
          {single ? (
            <KeyframeButton
              item={single}
              path="audio.volume"
              value={single.audio.volume}
              localFrame={localFrame}
            />
          ) : null}
        </div>

        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-chalk-500">
          <input
            type="checkbox"
            checked={first.audio.solo}
            onChange={(event) => set("solo", event.target.checked, "Solo")}
            className="accent-terracotta"
          />
          Solo — sirf yahi sunai de
        </label>

        <label className="flex cursor-pointer items-center gap-2 text-[11px] text-chalk-500">
          <input
            type="checkbox"
            checked={first.audio.loop}
            onChange={(event) => set("loop", event.target.checked, "Loop")}
            className="accent-terracotta"
          />
          Loop — clip ke ant tak dohrao
        </label>
        {first.audio.loop && single && single.sourceDurationFrames === null ? (
          // Chup-chaap kuch na karna sabse bura hota. Loop bina source ki lambai
          // ke lag hi nahi sakta, aur user ko wo pata hona chahiye.
          <p className="text-[11px] text-amber">
            Is asset ki lambai abhi pata nahi hai — loop tab tak nahi lagega.
          </p>
        ) : null}

        <FadeRow
          label="Fade in"
          frames={first.audio.fadeInFrames}
          onChange={(frames) => set("fadeInFrames", frames, "Fade in", `fin:${itemIds.join(",")}`)}
          max={first.durationInFrames}
        />
        <FadeRow
          label="Fade out"
          frames={first.audio.fadeOutFrames}
          onChange={(frames) => set("fadeOutFrames", frames, "Fade out", `fout:${itemIds.join(",")}`)}
          max={first.durationInFrames}
        />

        <label className="flex items-center gap-2 text-[11px] text-chalk-500">
          <span className="w-20 shrink-0">Fade shape</span>
          <select
            value={first.audio.fadeShape}
            onChange={(event) => set("fadeShape", event.target.value, "Fade shape")}
            className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-xs outline-none focus:border-terracotta"
          >
            {FADE_SHAPES.map((shape) => (
              <option key={shape} value={shape}>
                {shape === "equal-power" ? "Equal power (default)" : "Linear"}
              </option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

function FadeRow({
  label,
  frames,
  max,
  onChange,
}: {
  label: string;
  frames: number;
  max: number;
  onChange: (frames: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[11px] text-chalk-500">
      <span className="w-20 shrink-0">{label}</span>
      <input
        type="range"
        min={0}
        // Aadhi clip se lamba fade ka koi matlab nahi — dono fade milkar clip se
        // lambe ho jaate aur beech me awaaz kabhi poori nahi aati.
        max={Math.max(1, Math.floor(max / 2))}
        step={1}
        value={Math.min(frames, Math.floor(max / 2))}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-w-0 flex-1 accent-terracotta"
      />
      <span className="w-14 shrink-0 text-right font-mono text-chalk-400">{frames}f</span>
    </label>
  );
}
