"use client";

import clsx from "clsx";
import { RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  SHORTCUTS,
  comboLabel,
  conflictingIds,
  eventCombo,
  readRemap,
  resolvedKeys,
  writeRemap,
  type ShortcutEntry,
} from "@/lib/shortcuts";
import { useEditorStore } from "@/lib/store";

/**
 * Shortcut cheat-sheet + remap (16.6 / 16.7).
 *
 * ⚠️ List **registry se** banti hai (`SHORTCUTS`), haath se nahi likhi jaati.
 * Haath se likhi list ka anjaam hamesha ek hi hota hai: koi naya shortcut jodta
 * hai, list update karna bhool jaata hai, aur cheat-sheet dheere-dheere jhoothi
 * ho jaati hai. Jhoothi cheat-sheet na hone se buri hai.
 */

const GROUP_LABELS: Record<ShortcutEntry["group"], string> = {
  edit: "Edit",
  transport: "Chalana",
  timeline: "Timeline",
  editing: "Clip editing",
};

export function ShortcutsDialog() {
  const open = useEditorStore((state) => state.shortcutsOpen);
  const setOpen = useEditorStore((state) => state.setShortcutsOpen);

  const [remap, setRemap] = useState<Record<string, string>>({});
  const [capturing, setCapturing] = useState<string | null>(null);

  useEffect(() => {
    if (open) setRemap(readRemap());
  }, [open]);

  /*
   * Capture ke dauraan poora keyboard yahin pakda jaata hai (capture phase me),
   * warna user jo key chun raha hai wahi apna kaam bhi kar deti — "Delete" ko
   * remap karne ki koshish me selection ud jaati.
   */
  useEffect(() => {
    if (!capturing) return;

    function onKeyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (["control", "meta", "alt", "shift"].includes(key)) return;

      event.preventDefault();
      event.stopPropagation();

      if (key === "escape") {
        setCapturing(null);
        return;
      }

      const next = { ...remap, [capturing as string]: eventCombo(event) };
      setRemap(next);
      writeRemap(next);
      setCapturing(null);
    }

    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [capturing, remap]);

  if (!open) return null;

  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);
  const clashing = conflictingIds(SHORTCUTS, remap);

  const groups = (["transport", "timeline", "editing", "edit"] as const).map((group) => ({
    group,
    entries: SHORTCUTS.filter((entry) => entry.group === group),
  }));

  function reset(id: string): void {
    const next = { ...remap };
    delete next[id];
    setRemap(next);
    writeRemap(next);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={(event) => {
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-lg border border-ink-600 bg-ink-900">
        <header className="flex items-center justify-between border-b border-ink-700 px-4 py-2">
          <h2 className="text-sm text-chalk-100">Keyboard shortcuts</h2>
          <button
            type="button"
            aria-label="Band karo"
            onClick={() => setOpen(false)}
            className="rounded p-1 text-chalk-500 hover:bg-ink-700 hover:text-chalk-200"
          >
            <X size={14} />
          </button>
        </header>

        {clashing.length > 0 ? (
          <p className="border-b border-amber/30 bg-amber/10 px-4 py-1.5 text-[11px] text-amber">
            {clashing.length} shortcut ek hi key par baithe hain — pehla wala hi chalega.
          </p>
        ) : null}

        <div className="grid min-h-0 flex-1 grid-cols-1 gap-x-6 overflow-y-auto p-4 sm:grid-cols-2">
          {groups.map(({ group, entries }) => (
            <section key={group} className="mb-3">
              <h3 className="pb-1 text-[10px] uppercase tracking-wide text-chalk-500">
                {GROUP_LABELS[group]}
              </h3>
              <ul className="space-y-0.5">
                {entries.map((entry) => {
                  const keys = resolvedKeys(entry, remap);
                  const custom = remap[entry.id] !== undefined;
                  return (
                    <li key={entry.id} className="flex items-center gap-2 text-[11px]">
                      <span className="min-w-0 flex-1 truncate text-chalk-400">{entry.label}</span>

                      {custom ? (
                        <button
                          type="button"
                          title="Default par wapas"
                          aria-label={`${entry.label} reset`}
                          onClick={() => reset(entry.id)}
                          className="rounded p-0.5 text-chalk-500 hover:text-chalk-200"
                        >
                          <RotateCcw size={10} />
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setCapturing(entry.id)}
                        title="Dabao, phir nayi key dabao (Esc = rehne do)"
                        className={clsx(
                          "min-w-[64px] rounded border px-1.5 py-0.5 font-mono text-[10px] transition-colors",
                          capturing === entry.id
                            ? "border-terracotta bg-terracotta/20 text-chalk-100"
                            : clashing.includes(entry.id)
                              ? "border-amber/60 text-amber"
                              : "border-ink-600 text-chalk-300 hover:bg-ink-700",
                        )}
                      >
                        {capturing === entry.id ? "dabao…" : comboLabel(keys, isMac)}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>

        <footer className="border-t border-ink-700 px-4 py-1.5 text-[11px] text-chalk-500">
          Key par click karke badlo. Ye badlav is machine par rehte hain, project me nahi —
          keyboard aadmi ka hota hai, project ka nahi.
        </footer>
      </div>
    </div>
  );
}
