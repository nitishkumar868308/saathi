"use client";

import { assetKindForSlot, type Scene, type SlotDef } from "@reel/core";
import { useEffect, useState } from "react";

import { AssetPickerButton } from "@/components/editor/scenes/AssetPicker";
import { useEditorStore } from "@/lib/store";

/**
 * Ek slot ki ek line (12.2).
 *
 * ⚠️ **Yahan kisi scene type ka naam nahi hai.** Slot ki `kind` dekh kar control
 * chunta hai — `text` par khaana, `asset:*` par picker. Isliye naya scene type
 * jodne par uska form apne aap ban jaata hai, bilkul waise jaise properties
 * panel item type ka form banata hai (Dynamic rule 2).
 */
export function SceneSlotRow({ scene, slot }: { scene: Scene; slot: SlotDef }) {
  const applyOp = useEditorStore((state) => state.applyOp);
  const value = scene.slots[slot.id];

  if (slot.kind === "text") {
    return (
      <TextSlot
        slot={slot}
        value={typeof value === "string" ? value : ""}
        onCommit={(next) =>
          applyOp(
            "setSceneSlot",
            { sceneId: scene.id, slotId: slot.id, value: next },
            { label: slot.label, coalesceKey: `slot:${scene.id}:${slot.id}` },
          )
        }
      />
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-[11px] text-chalk-500" title={slot.hint}>
        {slot.label}
        {slot.required ? <span className="text-amber"> *</span> : null}
      </span>
      <AssetPickerButton
        kind={assetKindForSlot(slot)}
        assetId={typeof value === "string" ? value : null}
        onPick={(assetId) =>
          applyOp(
            "setSceneSlot",
            { sceneId: scene.id, slotId: slot.id, value: assetId },
            { label: `${slot.label} badla` },
          )
        }
      />
    </div>
  );
}

/**
 * Text ka khaana.
 *
 * ⚠️ Local state rakhna zaroori hai: har akshar par op chalane se history bhar
 * jaati (coalesce ke bawajood re-render har keystroke par hota) aur cursor
 * kabhi-kabhi kood jaata hai. Isliye typing local rehti hai aur blur/Enter par
 * lagti hai.
 */
function TextSlot({
  slot,
  value,
  onCommit,
}: {
  slot: SlotDef;
  value: string;
  onCommit(next: string): void;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);

  const shared = {
    value: draft,
    placeholder: slot.hint,
    onChange: (event: { target: { value: string } }) => setDraft(event.target.value),
    onBlur: () => {
      if (draft !== value) onCommit(draft);
    },
    className:
      "w-full rounded border border-ink-600 bg-ink-900 px-1.5 py-1 text-xs outline-none focus:border-terracotta",
  };

  return (
    <label className="block space-y-1">
      <span className="text-[11px] text-chalk-500">
        {slot.label}
        {slot.required ? <span className="text-amber"> *</span> : null}
      </span>
      {slot.multiline ? (
        <textarea rows={2} {...shared} />
      ) : (
        <input
          type="text"
          {...shared}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            event.stopPropagation();
          }}
        />
      )}
    </label>
  );
}
