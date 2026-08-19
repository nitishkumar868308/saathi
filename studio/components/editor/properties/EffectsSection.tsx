"use client";

import {
  BLEND_MODES,
  EFFECT_PRESETS,
  effectParamPath,
  effectsCost,
  listEffects,
  requireEffect,
  type Item,
  type Mask,
} from "@reel/core";
import clsx from "clsx";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import { controlComponent } from "@/components/controls";
import { KeyframeButton } from "@/components/controls/KeyframeButton";
import { IconButton } from "@/components/ui/Button";
import { useEditorStore } from "@/lib/store";

/**
 * Effects + Mask + Blend section (14.11).
 *
 * ⚠️ Yahan **kisi effect ka naam likha hi nahi hai**. Dropdown `EFFECTS` registry
 * se banta hai aur har effect ke controls uski apni entry ke `controls[]` se —
 * wahi system jo Phase 9 me bana tha. Naya effect jodna registry me ek entry hai,
 * is file me kuch nahi (14.12).
 */
export function EffectsSection({ items, localFrame }: { items: readonly Item[]; localFrame: number }) {
  const applyOp = useEditorStore((state) => state.applyOp);

  const itemIds = items.map((item) => item.id);
  const single = items.length === 1 ? (items[0] as Item) : null;
  const cost = single ? effectsCost(single) : 0;

  return (
    <>
      <section>
        <h3 className="flex items-center justify-between px-3 pb-1 pt-2 text-[10px] uppercase tracking-wide text-chalk-500">
          <span>Effects</span>
          {/*
           * Bhaaripan sirf tab batate hain jab wo sach me maayne rakhta ho.
           * "Render dheema" likha hai, "quality kharab" nahi — dono ek saath keh
           * dena user ko galat faisla karwaata hai (14.8).
           */}
          {cost >= 6 ? (
            <span className="normal-case tracking-normal text-amber-500" title="Blur jaise effects har frame par poora layer dobara banate hain">
              render dheema hoga
            </span>
          ) : null}
        </h3>

        {/* Presets sirf param sets hain (14.6) — isliye ye ek list par map hai. */}
        <div className="flex flex-wrap gap-1 px-3 pb-2">
          {EFFECT_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.hint}
              onClick={() =>
                applyOp("applyEffectPreset", { itemIds, presetId: preset.id }, { label: preset.label })
              }
              className="rounded border border-ink-600 px-1.5 py-0.5 text-[11px] text-chalk-500 transition-colors hover:bg-ink-700 hover:text-chalk-300"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="px-3 pb-2">
          <label className="flex items-center gap-2">
            <Plus size={12} className="shrink-0 text-chalk-500" />
            <select
              value=""
              onChange={(event) => {
                if (!event.target.value) return;
                applyOp(
                  "addEffect",
                  { itemIds, typeId: event.target.value },
                  { label: `Effect: ${event.target.value}` },
                );
                event.target.value = "";
              }}
              className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-xs outline-none focus:border-terracotta"
            >
              <option value="">Effect jodo…</option>
              {listEffects().map((entry) => (
                <option key={entry.id} value={entry.id} title={entry.hint}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {single === null ? (
          <p className="px-3 pb-2 text-[11px] text-chalk-500">
            Multi-select me effect jodi ja sakti hai, par uske parameters ek-ek clip par alag
            hote hain — unhe badalne ke liye ek clip chuno.
          </p>
        ) : single.effects.length === 0 ? (
          <p className="px-3 pb-2 text-[11px] text-chalk-500">
            Koi effect nahi. Upar se preset lagao ya ek jodo.
          </p>
        ) : (
          <ol className="space-y-2 px-3 pb-2">
            {single.effects.map((effect, index) => (
              <EffectRow
                key={`${effect.type}-${index}`}
                item={single}
                effect={effect as Record<string, unknown>}
                index={index}
                count={single.effects.length}
                localFrame={localFrame}
              />
            ))}
          </ol>
        )}
      </section>

      {single ? <MaskRow item={single} /> : null}
      <BlendRow itemIds={itemIds} value={single ? single.blendMode : null} />
    </>
  );
}

/**
 * Ek effect ka card.
 *
 * Kram badalne ke teer isliye hain ki **stack ka kram sach me matlab rakhta hai**
 * (14.4): CSS filters baayein se daayein lagte hain, isliye `grayscale` phir
 * `sepia` aur `sepia` phir `grayscale` do alag nateeje dete hain.
 */
function EffectRow({
  item,
  effect,
  index,
  count,
  localFrame,
}: {
  item: Item;
  effect: Record<string, unknown>;
  index: number;
  count: number;
  localFrame: number;
}) {
  const applyOp = useEditorStore((state) => state.applyOp);
  const entry = requireEffect(String(effect.type));
  const enabled = effect.enabled !== false;

  return (
    <li className="rounded border border-ink-600 bg-ink-900/60">
      <div className="flex items-center gap-1 border-b border-ink-700 px-2 py-1">
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          title={enabled ? "Band karo" : "Chalu karo"}
          onClick={() =>
            applyOp(
              "setEffectParam",
              { itemId: item.id, index, param: "enabled", value: !enabled },
              { label: `${entry.label} ${enabled ? "off" : "on"}` },
            )
          }
          className={clsx(
            "h-3 w-3 shrink-0 rounded-full border",
            enabled ? "border-terracotta bg-terracotta" : "border-ink-500 bg-ink-700",
          )}
        />
        <span
          className={clsx(
            "min-w-0 flex-1 truncate text-[11px]",
            enabled ? "text-chalk-300" : "text-chalk-500",
          )}
          title={entry.hint}
        >
          {entry.label}
        </span>

        <IconButton
          className="h-5 w-5"
          title="Upar"
          aria-label="Upar"
          disabled={index === 0}
          onClick={() =>
            applyOp(
              "reorderEffects",
              { itemId: item.id, from: index, to: index - 1 },
              { label: "Effect ka kram" },
            )
          }
        >
          <ChevronUp size={11} />
        </IconButton>
        <IconButton
          className="h-5 w-5"
          title="Neeche"
          aria-label="Neeche"
          disabled={index === count - 1}
          onClick={() =>
            applyOp(
              "reorderEffects",
              { itemId: item.id, from: index, to: index + 1 },
              { label: "Effect ka kram" },
            )
          }
        >
          <ChevronDown size={11} />
        </IconButton>
        <IconButton
          className="h-5 w-5"
          variant="danger"
          title="Hatao"
          aria-label="Hatao"
          onClick={() =>
            applyOp("removeEffect", { itemId: item.id, index }, { label: `${entry.label} hataya` })
          }
        >
          <Trash2 size={11} />
        </IconButton>
      </div>

      {enabled ? (
        <div className="divide-y divide-ink-800/60">
          {entry.controls.map((control) => {
            const Control = controlComponent(control.control);
            // Keyframe path me index hai — ops use reorder par saath khiskate hain.
            const path = effectParamPath(index, control.path);
            return (
              <div key={control.path} className="flex items-start gap-1 pr-1">
                <span className="min-w-0 flex-1">
                  <Control
                    control={control}
                    value={effect[control.path]}
                    onChange={(next) =>
                      applyOp(
                        "setEffectParam",
                        { itemId: item.id, index, param: control.path, value: next },
                        {
                          label: `${entry.label}: ${control.label}`,
                          coalesceKey: `fx:${item.id}:${index}:${control.path}`,
                        },
                      )
                    }
                    onReset={() =>
                      applyOp(
                        "setEffectParam",
                        {
                          itemId: item.id,
                          index,
                          param: control.path,
                          value: entry.defaults[control.path],
                        },
                        { label: `${control.label} reset` },
                      )
                    }
                  />
                </span>

                {control.keyframable ? (
                  <span className="pt-1.5">
                    <KeyframeButton
                      item={item}
                      path={path}
                      value={effect[control.path]}
                      localFrame={localFrame}
                    />
                  </span>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
    </li>
  );
}

const MASK_SHAPES = [
  { value: "rect", label: "Aayat" },
  { value: "rounded", label: "Gol kone" },
  { value: "circle", label: "Gola" },
] as const;

const DEFAULT_MASK = { shape: "rect", inset: 8, radius: 48, feather: 0, assetId: null } as const;

/**
 * Mask (14.9).
 *
 * ⚠️ Image mask schema me hai par yahan **koi button nahi** — kyunki wo abhi
 * lagta nahi hai. Aadhi bani cheez ka button dikhana sabse bura hota hai: user
 * use daba kar sochta hai ki usne kuch galat kiya.
 */
function MaskRow({ item }: { item: Item }) {
  const applyOp = useEditorStore((state) => state.applyOp);
  const mask = item.mask;

  const set = (next: Partial<NonNullable<Mask>>) =>
    applyOp(
      "setMask",
      { itemIds: [item.id], mask: { ...DEFAULT_MASK, ...(mask ?? {}), ...next } },
      { label: "Mask", coalesceKey: `mask:${item.id}` },
    );

  return (
    <section className="border-t border-ink-800">
      <h3 className="flex items-center justify-between px-3 pb-1 pt-2 text-[10px] uppercase tracking-wide text-chalk-500">
        <span>Mask</span>
        <button
          type="button"
          role="switch"
          aria-checked={mask !== null}
          onClick={() =>
            applyOp(
              "setMask",
              { itemIds: [item.id], mask: mask ? null : { ...DEFAULT_MASK } },
              { label: mask ? "Mask hataya" : "Mask lagaya" },
            )
          }
          className={clsx(
            "h-3 w-6 rounded-full border transition-colors",
            mask ? "border-terracotta bg-terracotta" : "border-ink-500 bg-ink-700",
          )}
        />
      </h3>

      {mask ? (
        <div className="space-y-1.5 px-3 pb-2">
          <div className="flex gap-1">
            {MASK_SHAPES.map((shape) => (
              <button
                key={shape.value}
                type="button"
                onClick={() => set({ shape: shape.value })}
                className={clsx(
                  "flex-1 rounded border px-1 py-0.5 text-[11px] transition-colors",
                  mask.shape === shape.value
                    ? "border-terracotta bg-terracotta/15 text-chalk-200"
                    : "border-ink-600 text-chalk-500 hover:bg-ink-700",
                )}
              >
                {shape.label}
              </button>
            ))}
          </div>

          <MaskSlider label="Andar" value={mask.inset} min={0} max={49} onChange={(v) => set({ inset: v })} unit="%" />
          {mask.shape === "rounded" ? (
            <MaskSlider label="Radius" value={mask.radius} min={0} max={500} onChange={(v) => set({ radius: v })} unit="px" />
          ) : null}
          <MaskSlider label="Narm kinara" value={mask.feather} min={0} max={50} onChange={(v) => set({ feather: v })} unit="%" />
        </div>
      ) : null}
    </section>
  );
}

function MaskSlider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[11px] text-chalk-500">
      <span className="w-20 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-w-0 flex-1 accent-terracotta"
      />
      <span className="w-10 shrink-0 text-right tabular-nums text-chalk-400">
        {value}
        {unit}
      </span>
    </label>
  );
}

/** Blend mode (14.10) — chaar hi, kyunki reel me yahi kaam aate hain. */
function BlendRow({ itemIds, value }: { itemIds: readonly string[]; value: string | null }) {
  const applyOp = useEditorStore((state) => state.applyOp);

  return (
    <section className="border-t border-ink-800 px-3 py-2">
      <label className="flex items-center gap-2 text-[11px] text-chalk-500">
        <span className="w-20 shrink-0">Blend</span>
        <select
          value={value ?? ""}
          onChange={(event) =>
            applyOp(
              "setItemsProperty",
              { itemIds, path: "blendMode", value: event.target.value },
              { label: "Blend mode" },
            )
          }
          className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-xs outline-none focus:border-terracotta"
        >
          {value === null ? <option value="">— alag-alag —</option> : null}
          {BLEND_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {mode}
            </option>
          ))}
        </select>
      </label>
    </section>
  );
}
