"use client";

import clsx from "clsx";
import { Magnet } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import type { SnapOptions } from "@/lib/clipEdit";
import { useEditorStore } from "@/lib/store";

/**
 * Snapping ke toggles (16.11).
 *
 * ⚠️ Ye ek **list** hai, ek switch nahi. Sab kuch ek switch par band karne ka
 * matlab hai ki jise sirf "seconds grid par mat chipko" chahiye tha, use clips
 * par snap bhi chhodna padta — aur tab clips ke beech ek-ek frame ke gaddhe reh
 * jaate hain, jo render me kaale flash bankar dikhte hain.
 *
 * Alt dabaye rakhne se drag ke dauraan sab kuch band ho jaata hai (8.2); ye list
 * uska pakka roop hai.
 */

const CHOICES: { key: keyof SnapOptions; label: string; hint: string }[] = [
  { key: "playhead", label: "Playhead", hint: "Playhead aur In/Out ke nishaan par" },
  { key: "clips", label: "Clips", hint: "Doosri clips ke dono kinaron par" },
  { key: "markers", label: "Markers", hint: "Timeline ke markers par" },
  { key: "scenes", label: "Scenes", hint: "Scene ki shuruaat aur ant par" },
  { key: "seconds", label: "Seconds", hint: "Har poore second par — zoom-out par kaam ka" },
];

export function SnapMenu() {
  const snapOptions = useEditorStore((state) => state.snapOptions);
  const setSnapOptions = useEditorStore((state) => state.setSnapOptions);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(event: PointerEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    }
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [open]);

  const onCount = CHOICES.filter((choice) => snapOptions[choice.key]).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="Snapping — kis-kis cheez par chipke"
        aria-label="Snapping"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className={clsx(
          "flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] transition-colors",
          onCount > 0
            ? "border-terracotta/50 bg-terracotta/15 text-chalk-200"
            : "border-ink-600 text-chalk-500 hover:bg-ink-700",
        )}
      >
        <Magnet size={12} />
        {onCount}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1 w-52 rounded border border-ink-600 bg-ink-900 p-1 shadow-lg">
          {CHOICES.map((choice) => (
            <label
              key={choice.key}
              title={choice.hint}
              className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[11px] text-chalk-400 hover:bg-ink-700"
            >
              <input
                type="checkbox"
                checked={snapOptions[choice.key]}
                onChange={(event) => setSnapOptions({ [choice.key]: event.target.checked })}
                className="accent-terracotta"
              />
              {choice.label}
            </label>
          ))}
          <p className="px-1.5 pb-1 pt-0.5 text-[10px] text-chalk-500">
            Drag ke dauraan Alt dabaye rakho to sab band.
          </p>
        </div>
      ) : null}
    </div>
  );
}
