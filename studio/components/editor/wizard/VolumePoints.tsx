"use client";

import { volumeCurve, type VolumePoint } from "@reel/core";
import clsx from "clsx";
import { Plus, X } from "lucide-react";

/**
 * Scene ke andar awaaz ka safar — "yahan se itna tez" (26.29).
 *
 * ⚠️ Ye "Awaaz ka level" wali patti ki jagah nahi hai, uske **neeche** hai. Wo
 * patti ek scene ka *ek* level chunti hai aur 90% scene ke liye wahi theek hai;
 * ye us level ka safar hai. Dono ek me mila dene par aam haalat (ek level) bhi
 * teen point ka kaam ban jaati, aur aadmi teesre scene par chhod deta.
 *
 * ⚠️ Wahi hisaab jo reel me lagta hai (`volumeCurve`) yahan **tasveer** bhi
 * banata hai. Do alag hisaab rakhne par lakeer kuch aur dikhati aur kaan kuch
 * aur sunta — aur us halat me tasveer ka hona na hone se bura hai, kyunki wo
 * bharosa deti hai.
 *
 * ⚠️ "Dhire" aur "Turant" dono chahiye. Music dhire uthna chahiye (turant uthne
 * par wo "kisi ne volume ka button daba diya" jaisa lagta hai), aur bolne wale ke
 * aate hi dhun ko turant peeche jaana chahiye (dhire jaane par pehle do shabd
 * dhun me dab jaate hain).
 */

/** Tasveer banane ke liye — asli fps se koi lena-dena nahi, sirf naap ka paimana. */
const SKETCH_FPS = 30;

export function VolumePoints({
  label,
  hint,
  maxSeconds,
  base,
  points,
  onChange,
}: {
  label: string;
  /** Ek line: is safar ka matlab kya hai. */
  hint: string;
  /** Ye awaaz kitni der bajegi — point isse aage nahi ja sakta. */
  maxSeconds: number;
  /** Point na hone par jo level chalta hai — lakeer yahin se shuru hoti hai. */
  base: number;
  points: readonly VolumePoint[];
  onChange(next: VolumePoint[]): void;
}) {
  const limit = Math.max(0.5, maxSeconds);

  /*
   * ⚠️ List hamesha waqt ke kram me rakhi jaati hai. Bina iske aadmi teesre point
   * ka waqt 1s kar deta hai aur wo list me teesre number par hi baitha rehta —
   * jabki reel me wo pehla baj raha hota hai. Lakeer sahi dikhti hai aur list
   * jhooth bolti hai, aur wo farak samjhaaya nahi ja sakta.
   */
  function put(next: VolumePoint[]): void {
    onChange([...next].sort((a, b) => a.atSeconds - b.atSeconds));
  }

  function add(): void {
    const last = points.length > 0 ? Math.max(...points.map((point) => point.atSeconds)) : 0;
    const at = points.length === 0 ? Math.round(limit * 0.5 * 10) / 10 : Math.min(limit, last + 1);
    put([...points, { atSeconds: at, volume: base, ramp: true }]);
  }

  function patch(index: number, change: Partial<VolumePoint>): void {
    put(points.map((point, at) => (at === index ? { ...point, ...change } : point)));
  }

  function remove(index: number): void {
    put(points.filter((_, at) => at !== index));
  }

  /*
   * Lakeer — wahi curve jo reel me bajega, `volumeCurve` se hi.
   *
   * ⚠️ Ise haath se banane ka lalach hota hai (do point jodo, seedhi lakeer) aur
   * wo "turant" wale mod ko bilkul chhupa deta: tasveer me dheemi dhalaan dikhti
   * aur kaan me achanak mod sunai deta.
   */
  const frames = Math.max(1, Math.round(limit * SKETCH_FPS));
  const curve = volumeCurve({ points, base, durationInFrames: frames, fps: SKETCH_FPS });
  const shape =
    curve.length > 0
      ? [...curve, { frame: frames - 1, value: curve[curve.length - 1]!.value }]
      : [
          { frame: 0, value: Math.max(0, Math.min(1, base)) },
          { frame: frames - 1, value: Math.max(0, Math.min(1, base)) },
        ];

  const path = shape
    .map((entry, at) => {
      const x = (entry.frame / Math.max(1, frames - 1)) * 100;
      const y = 100 - entry.value * 100;
      return `${at === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  return (
    <div className="space-y-1 rounded border border-ink-700 px-1.5 py-1">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-chalk-500">{label}</span>
        {points.length > 0 ? (
          <span className="rounded bg-terracotta/20 px-1 text-[9px] text-terracotta">
            {points.length} mod
          </span>
        ) : null}
        <button
          type="button"
          onClick={add}
          title={hint}
          className="ml-auto flex shrink-0 items-center gap-1 rounded border border-ink-600 px-1.5 py-0.5 text-[10px] text-chalk-400 transition-colors hover:border-terracotta hover:text-chalk-100"
        >
          <Plus size={9} />
          Mod jodo
        </button>
        {points.length > 0 ? (
          <button
            type="button"
            onClick={() => put([])}
            title="Poore scene par ek hi level — safar hata do"
            className="shrink-0 rounded border border-ink-600 px-1.5 py-0.5 text-[10px] text-chalk-400 transition-colors hover:border-chalk-500"
          >
            Hata do
          </button>
        ) : null}
      </div>

      {/*
        ⚠️ Tasveer tab bhi dikhti hai jab ek bhi mod na ho — seedhi lakeer. Use
        chhupa dene par "Mod jodo" ke baad achanak ek nayi cheez aa jaati hai aur
        aadmi ko samajhna padta hai ki ye kya hai. Seedhi lakeer pehle se yahi
        bata deti hai ki ye "poore scene me level" hai.
      */}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-7 w-full" aria-hidden>
        <line x1="0" y1="50" x2="100" y2="50" stroke="currentColor" strokeWidth="0.4" className="text-ink-700" />
        <path
          d={path}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
          className="text-terracotta"
        />
      </svg>

      {points.map((point, index) => (
        <div key={index} className="flex items-center gap-1">
          {/*
            ⚠️ Waqt ek number ka khaana hai, slider nahi. "3.0s par" ek pakki baat
            hai jo aadmi ke dimaag me pehle se hoti hai; slider se usse hit karna
            ek khel ban jaata hai, aur 0.1s ki galti bhi sunai deti hai.
          */}
          <input
            type="number"
            min={0}
            max={limit}
            step={0.1}
            value={point.atSeconds}
            onChange={(event) =>
              patch(index, {
                atSeconds: Math.max(0, Math.min(limit, Number(event.target.value) || 0)),
              })
            }
            className="w-12 shrink-0 rounded border border-ink-600 bg-ink-950 px-1 py-0.5 text-right font-mono text-[10px] text-chalk-200"
          />
          <span className="shrink-0 text-[10px] text-chalk-500">s</span>

          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={point.volume}
            onChange={(event) => patch(index, { volume: Number(event.target.value) })}
            className="min-w-0 flex-1 accent-terracotta"
          />
          <span className="w-8 shrink-0 text-right font-mono text-[10px] text-chalk-300">
            {Math.round(point.volume * 100)}%
          </span>

          <button
            type="button"
            onClick={() => patch(index, { ramp: !point.ramp })}
            title={
              point.ramp
                ? "Dhire pahunchega — pichhle mod se yahan tak lagatar"
                : "Turant badlega — theek is second par"
            }
            className={clsx(
              "shrink-0 rounded border px-1 py-0.5 text-[10px] transition-colors",
              point.ramp
                ? "border-ink-600 text-chalk-400 hover:border-chalk-500"
                : "border-terracotta bg-terracotta/10 text-chalk-100",
            )}
          >
            {point.ramp ? "dhire" : "turant"}
          </button>

          <button
            type="button"
            onClick={() => remove(index)}
            title="Ye mod hata do"
            className="shrink-0 rounded border border-ink-600 p-0.5 text-chalk-400 transition-colors hover:border-chalk-500 hover:text-chalk-100"
          >
            <X size={9} />
          </button>
        </div>
      ))}

      {points.length === 0 ? (
        <p className="text-[10px] leading-snug text-chalk-500">{hint}</p>
      ) : null}
    </div>
  );
}
