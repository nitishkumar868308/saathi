"use client";

import {
  AUTO_FIT_ACTIONS,
  animationsMaxScale,
  framesToTimecode,
  getByPath,
  getItemType,
  isScaleUnchanged,
  itemEndFrame,
  parseTimecode,
  suggestFit,
  type Item,
} from "@reel/core";
import clsx from "clsx";
import { useState } from "react";

import { AnimationSection } from "@/components/editor/properties/AnimationSection";
import { controlComponent } from "@/components/controls";
import { KeyframeButton } from "@/components/controls/KeyframeButton";
import { NumberField } from "@/components/controls/NumberField";
import { Button } from "@/components/ui/Button";
import { useAssetDurations } from "@/lib/assetMeta";
import { commonControls, commonValue, defaultValue, isMixed, resolutionReadout, visibleGroups } from "@/lib/properties";
import { useEditorStore } from "@/lib/store";

/**
 * Properties panel — **poora registry se banta hai** (9.1).
 *
 * Yahan kisi item type ka naam likha hi nahi hai. Panel selected items uthata
 * hai, unke `ITEM_TYPES` entry se `controls[]` padhta hai, aur har descriptor ke
 * liye `CONTROL_COMPONENTS` se component nikaal kar laga deta hai. Naya item
 * type jodne par yahan **ek line bhi** nahi badalti — yahi Dynamic rule 2 ka
 * poora matlab hai.
 *
 * ⚠️ Har badlav `applyOp` se jaata hai (`setItemsProperty`), seedha doc par
 * nahi. Ek slider ghumane par bhi op chalta hai — isliye Ctrl+Z har chhoti edit
 * ko wapas laa sakta hai, aur AI ke patches usi raaste se aate hain.
 *
 * ⚠️ Multi-select me sirf **common** controls dikhte hain aur alag-alag values
 * par `—`. Pehle item ki value dikha dena aasan hota, par wo jhooth hai.
 */
export function PropertiesPanel() {
  const doc = useEditorStore((state) => state.doc);
  const selection = useEditorStore((state) => state.selection);
  const applyOp = useEditorStore((state) => state.applyOp);
  const setSelection = useEditorStore((state) => state.setSelection);

  const playheadFrame = useEditorStore((state) => state.playheadFrame);
  const autoKeyframe = useEditorStore((state) => state.autoKeyframe);

  const items = doc.items.filter((item) => selection.itemIds.includes(item.id));

  if (items.length === 0) {
    return (
      <div className="p-3 text-sm text-chalk-500">
        Kuch select nahi hai.
        <span className="mt-2 block text-xs">
          Timeline me kisi clip par click karo — uske saare controls yahan aa jaayenge.
        </span>
      </div>
    );
  }

  const first = items[0] as Item;
  const entry = getItemType(first.type);
  const controls = commonControls(items);
  const groups = visibleGroups(items, controls);
  const locked = items.some((item) => item.locked);

  return (
    <div className="space-y-3 pb-6">
      <header className="flex items-center gap-2 border-b border-ink-600 px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm text-chalk-100" title={first.name}>
          {items.length === 1 ? first.name : `${items.length} items`}
        </span>
        <span className="shrink-0 rounded bg-ink-700 px-1.5 py-0.5 text-[10px] uppercase text-chalk-500">
          {items.length === 1 ? (entry?.label ?? first.type) : "multi"}
        </span>
      </header>

      {locked ? (
        <p className="mx-3 rounded border border-amber/40 bg-amber/10 px-2 py-1 text-[11px] text-amber">
          Isme locked clip hai — uspar koi badlav nahi lagega. Track header se unlock karo.
        </p>
      ) : null}

      <TimingSection items={items} />
      <FitSection items={items} />
      <AnimationSection items={items} />

      {groups.map((group) => (
        <section key={group.group}>
          <h3 className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-wide text-chalk-500">
            {group.group}
          </h3>
          <div className="divide-y divide-ink-800/60">
            {group.controls.map((control) => {
              const Control = controlComponent(control.control);
              const value = commonValue(items, control.path);
              // Playhead clip ke apne start se — keyframes item-local hote hain.
              const localFrame = playheadFrame - first.startFrame;

              return (
                <div
                  key={`${control.path}:${control.control}:${control.label}`}
                  className="flex items-start gap-1 pr-2"
                >
                  <span className="min-w-0 flex-1">
                    <Control
                      control={control}
                      value={value}
                      disabled={locked}
                      onChange={(next) => {
                        /*
                         * Auto-keyframe (13.4): on ho aur property keyframable
                         * ho to badlaav playhead par ek keyframe banta hai,
                         * static value nahi.
                         *
                         * ⚠️ Ye sirf single selection me chalta hai. Multi-select
                         * me har clip ka apna local frame hota hai (sab alag
                         * jagah shuru hoti hain), aur ek hi frame number sab par
                         * lagana galat keyframes bana deta — jo baad me
                         * dhoondhna namumkin hota.
                         */
                        if (
                          autoKeyframe &&
                          control.keyframable &&
                          items.length === 1 &&
                          localFrame >= 0 &&
                          localFrame < first.durationInFrames
                        ) {
                          applyOp(
                            "addKeyframe",
                            {
                              itemId: first.id,
                              path: control.path,
                              frame: localFrame,
                              value: next,
                            },
                            {
                              label: `${control.label} keyframe`,
                              coalesceKey: `kf:${first.id}:${control.path}:${localFrame}`,
                            },
                          );
                          return;
                        }

                        applyOp(
                          "setItemsProperty",
                          { itemIds: items.map((item) => item.id), path: control.path, value: next },
                          {
                            label: control.label,
                            // Slider ghumate waqt har frame ki apni undo entry
                            // banane se Ctrl+Z bekaar ho jaata hai — ek drag =
                            // ek entry.
                            coalesceKey: `prop:${control.path}:${items.map((item) => item.id).join(",")}`,
                          },
                        );
                      }}
                      onReset={() =>
                        applyOp(
                          "setItemsProperty",
                          {
                            itemIds: items.map((item) => item.id),
                            path: control.path,
                            value: defaultValue(first.type, control.path, doc.project.fps),
                          },
                          { label: `${control.label} reset` },
                        )
                      }
                    />
                  </span>

                  {/* Diamond sirf keyframable properties par — registry se (13.5). */}
                  {control.keyframable && items.length === 1 ? (
                    <span className="pt-1.5">
                      <KeyframeButton
                        item={first}
                        path={control.path}
                        value={isMixed(value) ? undefined : value}
                        localFrame={localFrame}
                      />
                    </span>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {items.length === 1 ? (
        <div className="px-3 pt-2">
          <button
            type="button"
            onClick={() => setSelection({ itemIds: [], trackIds: [] })}
            className="text-[11px] text-chalk-500 underline"
          >
            Selection chhodo
          </button>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------ timing (9.7) */

/**
 * Timing — timeline ka drag hi ek raasta nahi hona chahiye.
 *
 * Numeric edit isliye zaroori hai ki "theek 3 second par shuru karo" drag se
 * kabhi exact nahi hota, chahe kitna bhi zoom kar lo. Aur khaana **timecode bhi
 * leta hai** (`00:03:00`), sirf frame number nahi — kyunki aadmi seconds me
 * sochta hai, frames me nahi.
 */
function TimingSection({ items }: { items: readonly Item[] }) {
  const fps = useEditorStore((state) => state.doc.project.fps);
  const applyOp = useEditorStore((state) => state.applyOp);

  if (items.length !== 1) {
    return (
      <section className="px-3">
        <h3 className="pb-1 pt-2 text-[10px] uppercase tracking-wide text-chalk-500">Timing</h3>
        <p className="text-[11px] text-chalk-500">
          Multi-select me timing yahan se nahi badalti — timeline par ghaseeto, ya arrow keys
          se nudge karo (poori selection ek saath khiskti hai).
        </p>
      </section>
    );
  }

  const item = items[0] as Item;

  return (
    <section>
      <h3 className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-wide text-chalk-500">
        Timing
      </h3>
      <div className="space-y-1 px-3">
        <TimecodeRow
          label="Start"
          frames={item.startFrame}
          fps={fps}
          onCommit={(frame) =>
            applyOp(
              "moveItems",
              { itemIds: [item.id], deltaFrames: frame - item.startFrame },
              { label: "Start badla" },
            )
          }
        />
        <TimecodeRow
          label="Duration"
          frames={item.durationInFrames}
          fps={fps}
          min={1}
          onCommit={(frame) =>
            applyOp(
              "trimItemEnd",
              { itemId: item.id, deltaFrames: frame - item.durationInFrames },
              { label: "Duration badli" },
            )
          }
        />
        <div className="flex items-baseline justify-between gap-2 py-0.5 text-[11px]">
          <span className="text-chalk-500">End</span>
          <span className="font-mono text-chalk-300">
            {framesToTimecode(itemEndFrame(item), fps, { compact: true })} ·{" "}
            {itemEndFrame(item)}f
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-2 py-0.5 text-[11px]">
          <span className="text-chalk-500">Trim start</span>
          <span className="font-mono text-chalk-300">
            {framesToTimecode(item.trimStartFrame, fps, { compact: true })} ·{" "}
            {item.trimStartFrame}f
          </span>
        </div>
      </div>
    </section>
  );
}

function TimecodeRow({
  label,
  frames,
  fps,
  min,
  onCommit,
}: {
  label: string;
  frames: number;
  fps: number;
  min?: number;
  onCommit(frame: number): void;
}) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? framesToTimecode(frames, fps, { compact: true });

  return (
    <label className="flex items-center gap-2 py-0.5">
      <span className="w-20 shrink-0 text-[11px] text-chalk-500">{label}</span>
      <input
        type="text"
        value={shown}
        onChange={(event) => setText(event.target.value)}
        onBlur={() => {
          if (text === null) return;
          const parsed = parseTimecode(text, fps);
          setText(null);
          // Galat input par kuch nahi hota aur khaana purani value dikhane lagta
          // hai — chupchaap 0 lagana ek typo par clip ko shuruaat me phenk deta.
          if (parsed === null) return;
          onCommit(Math.max(min ?? 0, parsed));
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setText(null);
          event.stopPropagation();
        }}
        title="Timecode (MM:SS:FF) ya seedha frame number"
        className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-1.5 py-0.5 text-right font-mono text-xs outline-none focus:border-terracotta"
      />
      <span className="w-12 shrink-0 text-right font-mono text-[10px] text-chalk-500">
        {frames}f
      </span>
    </label>
  );
}

/* ------------------------------------------------- auto-fit + resolution */

/**
 * Auto-fit buttons (9.6b) + effective resolution (9.6c) + aspect ki salah.
 *
 * Buttons `AUTO_FIT_ACTIONS` **list** se bante hain, haath se nahi likhe gaye —
 * naya helper jodna core me ek entry hai.
 *
 * ⚠️ Patch UI me banta hai (op me nahi) kyunki uske liye source ke asli pixels
 * chahiye, aur wo `reel_assets` me hain — doc me nahi. Op ko DB ka pata nahi
 * hona chahiye. Lagta poora patch ek hi op me hai, isliye undo bhi ek hi baar.
 */
function FitSection({ items }: { items: readonly Item[] }) {
  const doc = useEditorStore((state) => state.doc);
  const applyOp = useEditorStore((state) => state.applyOp);
  const meta = useAssetDurations(doc.project.fps);

  const frame = { width: doc.project.width, height: doc.project.height };
  const visual = items.filter((item) => getItemType(item.type)?.hasVisual);
  if (visual.length === 0) return null;

  const sized = visual
    .map((item) => ({ item, source: meta.sourceSize(item.assetId) }))
    .filter((entry): entry is { item: Item; source: { width: number; height: number } } =>
      entry.source !== null,
    );

  function runAction(actionId: string): void {
    const action = AUTO_FIT_ACTIONS.find((entry) => entry.id === actionId);
    if (!action || sized.length === 0) return;

    const patches = sized.map(({ item, source }) => {
      const patch = action.apply(source, frame);
      return {
        itemId: item.id,
        mode: patch.mode,
        scale: isScaleUnchanged(patch) ? null : patch.scale,
        x: patch.x,
        y: patch.y,
      };
    });
    applyOp("applyAutoFit", { patches }, { label: action.label });
  }

  const single = sized.length === 1 ? sized[0] : null;
  const readout = single
    ? resolutionReadout({
        source: single.source,
        frame,
        fitMode: single.item.fit.mode,
        itemScale: single.item.transform.scale,
        // Ken Burns ka blur clip ke **aakhir** me aata hai — isliye animations ka
        // sabse bada scale bhi ginti me aana chahiye (10.11), warna chetavni tab
        // aati hai jab video ban chuki hoti hai.
        animationScale: animationsMaxScale(single.item),
      })
    : null;
  const suggestion = single ? suggestFit(single.source, frame) : null;

  return (
    <section>
      <h3 className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-wide text-chalk-500">
        Auto fit
      </h3>

      {sized.length === 0 ? (
        <p className="px-3 text-[11px] text-chalk-500">
          {meta.loaded
            ? "Is clip ke source ka naap pata nahi hai (probe nahi hua), isliye auto-fit ka hisaab nahi ho sakta."
            : "Asset ka naap load ho raha hai…"}
        </p>
      ) : (
        <div className="flex flex-wrap gap-1 px-3">
          {AUTO_FIT_ACTIONS.map((action) => (
            <Button
              key={action.id}
              onClick={() => runAction(action.id)}
              title={action.hint}
              className="px-2 py-0.5 text-[11px]"
            >
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {readout ? (
        <div className="mx-3 mt-2 space-y-0.5 rounded border border-ink-600 bg-ink-900 px-2 py-1.5">
          <p className="text-[10px] uppercase tracking-wide text-chalk-500">
            Effective resolution
          </p>
          <p className="font-mono text-[11px] text-chalk-300">
            {readout.source.width}×{readout.source.height} → {readout.effective.width}×
            {readout.effective.height} ({readout.totalScale.toFixed(2)}×)
          </p>
          {readout.message ? (
            /*
             * Ye A1 quality rule ka **live** roop hai. Export ke waqt warning
             * dena bhi theek hai, par tab tak user ne scale keyframe laga diya
             * hota hai aur badalna mehnga lagta hai.
             */
            <p className="text-[11px] leading-snug text-amber">{readout.message}</p>
          ) : (
            <p className="text-[11px] text-chalk-500">Source ke pixels kaafi hain — upscale nahi ho raha.</p>
          )}
        </div>
      ) : null}

      {suggestion?.mismatch ? (
        <div className="mx-3 mt-2 rounded border border-amber/30 bg-amber/10 px-2 py-1.5">
          <p className="text-[11px] leading-snug text-amber">{suggestion.reason}</p>
          <button
            type="button"
            onClick={() => {
              runAction(suggestion.recommendedMode === "contain" ? "fit-frame" : "fill-frame");
              if (suggestion.recommendedBackground && single) {
                applyOp(
                  "setItemsProperty",
                  {
                    itemIds: [single.item.id],
                    path: "fit.background.kind",
                    value: suggestion.recommendedBackground,
                  },
                  { label: "Background" },
                );
              }
            }}
            className={clsx("mt-1 text-[11px] text-amber underline")}
          >
            Ye laga do
          </button>
        </div>
      ) : null}
    </section>
  );
}

/** Panel ke bahar bhi kaam aata hai — path se value padho (debug/test ke liye). */
export function readPath(item: Item, path: string): unknown {
  return getByPath(item, path);
}

export { isMixed };
