"use client";

import {
  ANIMATION_PRESETS,
  BUILTIN_TRANSITIONS,
  clampTransitionFrames,
  getTransition,
  listAnimations,
  requireAnimation,
  type Item,
} from "@reel/core";
import clsx from "clsx";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";

import { controlComponent } from "@/components/controls";
import { NumberField } from "@/components/controls/NumberField";
import { IconButton } from "@/components/ui/Button";
import { useEditorStore } from "@/lib/store";

/**
 * Animation + Transition section (10.7 ka panel wala hissa / 10.8 / 10.9 / 10.10).
 *
 * ⚠️ Yahan **kisi animation ka naam likha hi nahi hai**. Dropdown `ANIMATIONS`
 * registry se banta hai, aur har animation ke controls uski apni entry ke
 * `controls[]` descriptor se — wahi system jo Phase 9 me bana tha. Isliye naya
 * animation jodna sach me do cheezon ka kaam hai: registry me ek entry, aur bas
 * (10.12).
 */
export function AnimationSection({ items }: { items: readonly Item[] }) {
  const applyOp = useEditorStore((state) => state.applyOp);
  const fps = useEditorStore((state) => state.doc.project.fps);

  const itemIds = items.map((item) => item.id);
  const single = items.length === 1 ? (items[0] as Item) : null;

  return (
    <>
      <section>
        <h3 className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-wide text-chalk-500">
          Animation
        </h3>

        {/* Preset — sirf param sets hain (10.10), isliye ye ek list par map hai. */}
        <div className="flex flex-wrap gap-1 px-3 pb-2">
          {ANIMATION_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              title={preset.hint}
              onClick={() =>
                applyOp(
                  "applyAnimationPreset",
                  { itemIds, presetId: preset.id },
                  { label: preset.label },
                )
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
                  "addAnimation",
                  { itemIds, typeId: event.target.value },
                  { label: `Animation: ${event.target.value}` },
                );
                event.target.value = "";
              }}
              className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-xs outline-none focus:border-terracotta"
            >
              <option value="">Animation jodo…</option>
              {listAnimations().map((entry) => (
                <option key={entry.id} value={entry.id} title={entry.hint}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {single === null ? (
          <p className="px-3 pb-2 text-[11px] text-chalk-500">
            Multi-select me animation **jodi** ja sakti hai, par uske parameters ek-ek clip
            par alag hote hain — unhe badalne ke liye ek clip chuno.
          </p>
        ) : single.animations.length === 0 ? (
          <p className="px-3 pb-2 text-[11px] text-chalk-500">
            Koi animation nahi. Upar se preset lagao ya ek jodo.
          </p>
        ) : (
          <ol className="space-y-2 px-3 pb-2">
            {single.animations.map((animation, index) => (
              <AnimationRow
                key={`${animation.type}-${index}`}
                item={single}
                animation={animation as Record<string, unknown>}
                index={index}
                count={single.animations.length}
              />
            ))}
          </ol>
        )}
      </section>

      {single ? <TransitionRows item={single} fps={fps} /> : null}
    </>
  );
}

/**
 * Ek animation ka card.
 *
 * Kram badalne ke teer isliye hain ki **stack ka kram sach me matlab rakhta hai**
 * (10.9): scale guna hoti hai aur position judti hai, isliye pehle zoom phir pan
 * aur pehle pan phir zoom do alag nateeje dete hain.
 */
function AnimationRow({
  item,
  animation,
  index,
  count,
}: {
  item: Item;
  animation: Record<string, unknown>;
  index: number;
  count: number;
}) {
  const applyOp = useEditorStore((state) => state.applyOp);
  const entry = requireAnimation(String(animation.type));
  const enabled = animation.enabled !== false;

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
              "setAnimationParam",
              { itemId: item.id, index, path: "enabled", value: !enabled },
              { label: `${entry.label} ${enabled ? "off" : "on"}` },
            )
          }
          className={clsx(
            "h-3 w-3 shrink-0 rounded-full border",
            enabled ? "border-terracotta bg-terracotta" : "border-ink-500 bg-ink-700",
          )}
        />
        <span
          className={clsx("min-w-0 flex-1 truncate text-[11px]", enabled ? "text-chalk-300" : "text-chalk-500")}
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
              "reorderAnimations",
              { itemId: item.id, from: index, to: index - 1 },
              { label: "Animation ka kram" },
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
              "reorderAnimations",
              { itemId: item.id, from: index, to: index + 1 },
              { label: "Animation ka kram" },
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
            applyOp(
              "removeAnimation",
              { itemId: item.id, index },
              { label: `${entry.label} hataya` },
            )
          }
        >
          <Trash2 size={11} />
        </IconButton>
      </div>

      {enabled ? (
        <div className="divide-y divide-ink-800/60">
          {entry.controls.map((control) => {
            const Control = controlComponent(control.control);
            return (
              <Control
                key={control.path}
                control={control}
                value={animation[control.path]}
                onChange={(next) =>
                  applyOp(
                    "setAnimationParam",
                    { itemId: item.id, index, path: control.path, value: next },
                    {
                      label: `${entry.label}: ${control.label}`,
                      coalesceKey: `anim:${item.id}:${index}:${control.path}`,
                    },
                  )
                }
                onReset={() =>
                  applyOp(
                    "setAnimationParam",
                    {
                      itemId: item.id,
                      index,
                      path: control.path,
                      value: entry.defaults[control.path],
                    },
                    { label: `${control.label} reset` },
                  )
                }
              />
            );
          })}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Clip ke dono kinaron ki transition (10.5 / 10.6).
 *
 * ⚠️ Lambai ki hadd yahan **dikhayi** jaati hai, lagayi nahi — clamp op ke andar
 * hota hai (`setTransition`). Do jagah clamp rakhne par AI ka patch ya template
 * UI wali hadd ko bypass kar jaata, aur tab clip ka beech ka hissa kabhi poora
 * dikhta hi nahi.
 */
function TransitionRows({ item, fps }: { item: Item; fps: number }) {
  const applyOp = useEditorStore((state) => state.applyOp);

  const clamped = clampTransitionFrames({
    durationInFrames: item.durationInFrames,
    inFrames: item.transitionIn.durationInFrames,
    outFrames: item.transitionOut.durationInFrames,
  });

  return (
    <section>
      <h3 className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-wide text-chalk-500">
        Transition
      </h3>

      {clamped.clamped ? (
        <p className="mx-3 mb-1 rounded border border-amber/40 bg-amber/10 px-2 py-1 text-[11px] text-amber">
          Transition clip se lambi thi — sim kar {clamped.inFrames}/{clamped.outFrames} frames
          kar di gayi. Clip ka kam se kam ek frame poora dikhna chahiye.
        </p>
      ) : null}

      {(["in", "out"] as const).map((side) => {
        const transition = side === "in" ? item.transitionIn : item.transitionOut;
        return (
          <div key={side} className="flex items-center gap-2 px-3 py-1">
            <span className="w-8 shrink-0 text-[11px] text-chalk-500">
              {side === "in" ? "In" : "Out"}
            </span>
            <select
              value={transition.type}
              onChange={(event) =>
                applyOp(
                  "setTransition",
                  {
                    itemIds: [item.id],
                    side,
                    type: event.target.value,
                    // Naya type chunte hi ek dikhne layak lambai — 0 par user ko
                    // lagta hai transition lagi hi nahi.
                    ...(transition.durationInFrames === 0 && event.target.value !== "none"
                      ? { durationInFrames: Math.round(fps / 2) }
                      : {}),
                  },
                  { label: `Transition ${side}` },
                )
              }
              className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-xs outline-none focus:border-terracotta"
            >
              {BUILTIN_TRANSITIONS.map((entry) => (
                <option key={entry.id} value={entry.id} title={entry.hint}>
                  {entry.label}
                </option>
              ))}
            </select>
            <span className="w-20 shrink-0">
              <NumberField
                value={transition.durationInFrames}
                min={0}
                step={1}
                unit="f"
                disabled={transition.type === "none"}
                onChange={(next) =>
                  applyOp(
                    "setTransition",
                    { itemIds: [item.id], side, durationInFrames: next },
                    { label: `Transition ${side} lambai`, coalesceKey: `trans:${item.id}:${side}` },
                  )
                }
              />
            </span>
          </div>
        );
      })}

      {/*
       * Transition ke apne controls — bilkul animation ki tarah, uski registry
       * entry ke `controls[]` descriptor se. Yahan bhi kisi transition ka naam
       * likha nahi hai.
       */}
      {(["in", "out"] as const).map((side) => {
        const transition = side === "in" ? item.transitionIn : item.transitionOut;
        const entry = getTransition(transition.type);
        if (!entry || entry.controls.length === 0) return null;

        return (
          <div key={`${side}-params`} className="divide-y divide-ink-800/60">
            <p className="px-3 pt-1 text-[10px] uppercase tracking-wide text-chalk-500">
              {side === "in" ? "In" : "Out"} — {entry.label}
            </p>
            {entry.controls.map((control) => {
              const Control = controlComponent(control.control);
              return (
                <Control
                  key={`${side}-${control.path}`}
                  control={control}
                  value={(transition as Record<string, unknown>)[control.path]}
                  onChange={(next) =>
                    applyOp(
                      "setTransition",
                      { itemIds: [item.id], side, params: { [control.path]: next } },
                      {
                        label: `${entry.label}: ${control.label}`,
                        coalesceKey: `transparam:${item.id}:${side}:${control.path}`,
                      },
                    )
                  }
                  onReset={() =>
                    applyOp(
                      "setTransition",
                      {
                        itemIds: [item.id],
                        side,
                        params: { [control.path]: entry.defaults[control.path] },
                      },
                      { label: `${control.label} reset` },
                    )
                  }
                />
              );
            })}
          </div>
        );
      })}
    </section>
  );
}
