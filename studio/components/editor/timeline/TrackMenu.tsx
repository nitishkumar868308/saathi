"use client";

import { listTrackTypes, requireTrackType, type Doc, type Track } from "@reel/core";
import { Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Icon } from "@/components/ui/Icon";
import { useEditorStore } from "@/lib/store";

/**
 * Track manager (16.1) — add / rename / duplicate / remove / opacity.
 *
 * ⚠️ Track hataane par uske items ka kya ho — ye **poochha** jaata hai, apne aap
 * tay nahi kiya jaata. Chup-chaap items mita dena sabse buri baat hai (ghanton
 * ka kaam ek click me gaya), aur chup-chaap unhe kahin aur khiska dena bhi bura
 * hai (user ko lagta hai wo gayab ho gaye). Poochhne se dono galtiyan nahi hoti.
 */
export function TrackMenu({ track }: { track: Track }) {
  const doc = useEditorStore((state) => state.doc);
  const applyOp = useEditorStore((state) => state.applyOp);
  const [renaming, setRenaming] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const itemCount = doc.items.filter((item) => item.trackId === track.id).length;

  if (renaming) {
    return (
      <input
        autoFocus
        defaultValue={track.name}
        onBlur={(event) => {
          const name = event.target.value.trim();
          if (name && name !== track.name) {
            applyOp(
              "setTrackProperty",
              { trackId: track.id, path: "name", value: name },
              { label: "Track ka naam" },
            );
          }
          setRenaming(false);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") setRenaming(false);
        }}
        className="min-w-0 flex-1 rounded border border-terracotta bg-ink-800 px-1 text-xs text-chalk-100 outline-none"
      />
    );
  }

  if (confirmDelete) {
    return (
      <div className="flex min-w-0 flex-1 items-center gap-1 text-[10px]">
        <span className="truncate text-amber">{itemCount} clip?</span>
        <button
          type="button"
          title="Track aur uske saare clips hata do"
          onClick={() => {
            applyOp("removeTrack", { trackId: track.id, items: "delete" }, { label: "Track hataya" });
            setConfirmDelete(false);
          }}
          className="rounded border border-red-500/50 px-1 text-red-300 hover:bg-red-500/20"
        >
          mitao
        </button>
        <button
          type="button"
          title="Clips ko paas wali track par bhej do"
          onClick={() => {
            applyOp("removeTrack", { trackId: track.id, items: "move" }, { label: "Track hataya" });
            setConfirmDelete(false);
          }}
          className="rounded border border-ink-500 px-1 text-chalk-400 hover:bg-ink-700"
        >
          bacha lo
        </button>
        <button
          type="button"
          onClick={() => setConfirmDelete(false)}
          className="rounded px-1 text-chalk-500 hover:bg-ink-700"
        >
          rehne do
        </button>
      </div>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <button
        type="button"
        title="Naam badlo"
        aria-label="Naam badlo"
        onClick={() => setRenaming(true)}
        className="flex h-5 w-5 items-center justify-center rounded text-[10px] text-chalk-500 hover:bg-ink-700"
      >
        Aa
      </button>
      <button
        type="button"
        title="Track ki copy"
        aria-label="Track ki copy"
        onClick={() =>
          applyOp("duplicateTrack", { trackId: track.id }, { label: "Track ki copy" })
        }
        className="flex h-5 w-5 items-center justify-center rounded text-chalk-500 hover:bg-ink-700"
      >
        <Copy size={10} />
      </button>
      <button
        type="button"
        title={itemCount > 0 ? `${itemCount} clip iske upar hain` : "Track hatao"}
        aria-label="Track hatao"
        onClick={() => {
          // Khaali track par poochhne ka koi matlab nahi — kuch kho hi nahi sakta.
          if (itemCount === 0) {
            applyOp("removeTrack", { trackId: track.id, items: "delete" }, { label: "Track hataya" });
            return;
          }
          setConfirmDelete(true);
        }}
        className="flex h-5 w-5 items-center justify-center rounded text-chalk-500 hover:bg-red-500/20 hover:text-red-300"
      >
        <Trash2 size={10} />
      </button>
    </div>
  );
}

/**
 * Naya track jodo — type registry se (16.1 / 16.3).
 *
 * Yahan koi track-type ka naam likha nahi hai. Naya track type registry me ek
 * entry hai aur wo apne aap is list me aa jaata hai.
 */
export function AddTrackButton({ doc }: { doc: Doc }) {
  const applyOp = useEditorStore((state) => state.applyOp);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-1.5 border-b border-ink-800 px-2 py-1.5 text-[11px] text-chalk-500 transition-colors hover:bg-ink-800 hover:text-chalk-300"
      >
        <Plus size={11} />
        Track jodo
      </button>
    );
  }

  return (
    <div className="border-b border-ink-800 p-1">
      {listTrackTypes().map((entry) => (
        <button
          key={entry.id}
          type="button"
          title={`${entry.label} — ${entry.accepts.length > 0 ? entry.accepts.join(", ") : "kuch bhi"}`}
          onClick={() => {
            applyOp(
              "addTrack",
              {
                typeId: entry.id,
                // Sabse neeche — wahi wo jagah hai jahan user dekh raha hota hai
                // jab wo "track jodo" dabata hai.
                order: Math.max(0, ...doc.tracks.map((track) => track.order)) + 1,
              },
              { label: `${entry.label} track` },
            );
            setOpen(false);
          }}
          className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-[11px] text-chalk-400 hover:bg-ink-700"
        >
          <span className="h-3 w-1 shrink-0 rounded" style={{ backgroundColor: entry.color }} />
          <Icon name={entry.icon} size={11} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">{entry.label}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="w-full px-1.5 py-0.5 text-left text-[10px] text-chalk-500 hover:text-chalk-300"
      >
        rehne do
      </button>
    </div>
  );
}

/** Track ki opacity (16.2) — sirf un tracks par jinme kuch dikhta hai. */
export function TrackOpacity({ track }: { track: Track }) {
  const applyOp = useEditorStore((state) => state.applyOp);
  const type = requireTrackType(track.type);
  // Audio track ki opacity ka koi matlab nahi — aur jo control kuch nahi karta
  // wo toota hua control hai.
  if (type.kind === "audio") return null;

  return (
    <input
      type="range"
      min={0}
      max={1}
      step={0.05}
      value={track.opacity}
      title={`Opacity ${Math.round(track.opacity * 100)}%`}
      aria-label={`${track.name} opacity`}
      onChange={(event) =>
        applyOp(
          "setTrackProperty",
          { trackId: track.id, path: "opacity", value: Number(event.target.value) },
          { label: "Track opacity", coalesceKey: `track-opacity:${track.id}` },
        )
      }
      className="h-1 w-10 shrink-0 accent-terracotta"
    />
  );
}
