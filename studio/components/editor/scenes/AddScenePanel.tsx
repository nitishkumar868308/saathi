"use client";

import {
  assetKindForSlot,
  listSceneTypes,
  missingRequiredSlots,
  requireSceneType,
  type SceneTypeEntry,
} from "@reel/core";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { useState } from "react";

import { AssetPickerButton } from "@/components/editor/scenes/AssetPicker";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { useEditorStore } from "@/lib/store";

/**
 * "+ Add Scene" (12.7).
 *
 * ⚠️ Type ka grid aur uske baad ka poora form — dono **registry se** bante hain.
 * Har scene type ke liye haath se form likhna wahi galti hoti jo properties
 * panel me hoti: naya type jodne par dus jagah edit karni padti aur ek na ek
 * jagah hamesha chhoot jaati.
 *
 * ⚠️ Audio ke liye README 3C ka niyam yahan bhi lagta hai — abhi sirf **Upload**
 * ka raasta hai (Media panel se aayi hui file chuno). "Generate" aur "Both" ke
 * button **hain hi nahi**, kyunki TTS Phase 22 me aayega. Aise button dikhana jo
 * dabate hi kuch na karein, sabse bura hota hai.
 */
export function AddScenePanel() {
  const applyOp = useEditorStore((state) => state.applyOp);

  const [typeId, setTypeId] = useState<string | null>(null);
  const [slots, setSlots] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  const entry = typeId ? requireSceneType(typeId) : null;
  const missing = entry ? missingRequiredSlots(entry.id, slots) : [];

  function reset(): void {
    setTypeId(null);
    setSlots({});
    setError(null);
  }

  function add(): void {
    if (!entry) return;
    try {
      applyOp("addScene", { typeId: entry.id, slots }, { label: `Scene: ${entry.label}` });
      reset();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  if (!entry) {
    const groups: SceneTypeEntry["group"][] = ["media", "text", "audio", "special"];
    return (
      <div className="rounded border border-dashed border-ink-600 p-3">
        <p className="mb-2 flex items-center gap-1.5 text-[11px] text-chalk-500">
          <Plus size={12} /> Scene jodo
        </p>
        {groups.map((group) => {
          const types = listSceneTypes().filter((type) => type.group === group);
          if (types.length === 0) return null;
          return (
            <div key={group} className="mb-2">
              <p className="mb-1 text-[10px] uppercase tracking-wide text-chalk-500">{group}</p>
              <div className="grid grid-cols-3 gap-1.5">
                {types.map((type) => (
                  <button
                    key={type.id}
                    type="button"
                    title={type.hint}
                    onClick={() => {
                      setTypeId(type.id);
                      setSlots({});
                      setError(null);
                    }}
                    className="flex items-center gap-1.5 rounded border border-ink-600 px-2 py-1.5 text-left text-[11px] text-chalk-300 transition-colors hover:border-terracotta hover:bg-ink-700"
                  >
                    <Icon name={type.icon} size={12} className="shrink-0 text-chalk-500" />
                    <span className="min-w-0 truncate">{type.label}</span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded border border-terracotta/50 bg-ink-800 p-3">
      <div className="flex items-center gap-2">
        <Icon name={entry.icon} size={14} className="shrink-0 text-chalk-500" />
        <span className="min-w-0 flex-1 truncate text-sm text-chalk-100">{entry.label}</span>
        <button type="button" onClick={reset} className="text-[11px] text-chalk-500 underline">
          badlo
        </button>
      </div>
      <p className="text-[11px] text-chalk-500">{entry.hint}</p>

      {entry.slots.length === 0 ? (
        <p className="text-[11px] text-chalk-500">Is scene ko kuch chahiye hi nahi — bas jod do.</p>
      ) : (
        entry.slots.map((slot) => {
          const value = slots[slot.id];
          if (slot.kind === "text") {
            const Field = slot.multiline ? "textarea" : "input";
            return (
              <label key={slot.id} className="block space-y-1">
                <span className="text-[11px] text-chalk-500">
                  {slot.label}
                  {slot.required ? <span className="text-amber"> *</span> : null}
                </span>
                <Field
                  {...(slot.multiline ? { rows: 2 } : { type: "text" })}
                  value={typeof value === "string" ? value : ""}
                  placeholder={slot.hint}
                  onChange={(event: { target: { value: string } }) =>
                    setSlots((current) => ({ ...current, [slot.id]: event.target.value }))
                  }
                  onKeyDown={(event: React.KeyboardEvent) => event.stopPropagation()}
                  className="w-full rounded border border-ink-600 bg-ink-900 px-1.5 py-1 text-xs outline-none focus:border-terracotta"
                />
              </label>
            );
          }

          return (
            <div key={slot.id} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-[11px] text-chalk-500" title={slot.hint}>
                {slot.label}
                {slot.required ? <span className="text-amber"> *</span> : null}
              </span>
              <AssetPickerButton
                kind={assetKindForSlot(slot)}
                assetId={typeof value === "string" ? value : null}
                onPick={(assetId) => setSlots((current) => ({ ...current, [slot.id]: assetId }))}
              />
            </div>
          );
        })
      )}

      {error ? <p className="text-[11px] text-red-300">{error}</p> : null}

      <div className="flex items-center gap-2 pt-1">
        <Button
          variant="primary"
          className="px-2 py-1 text-[11px]"
          disabled={missing.length > 0}
          title={
            missing.length > 0
              ? `Pehle ye bharo: ${missing.map((slot) => slot.label).join(", ")}`
              : undefined
          }
          onClick={add}
        >
          Scene jodo
        </Button>
        {missing.length > 0 ? (
          <span className={clsx("text-[11px] text-chalk-500")}>
            {missing.map((slot) => slot.label).join(", ")} chahiye
          </span>
        ) : null}
      </div>
    </div>
  );
}
