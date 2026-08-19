"use client";

import { ArrowLeft, Redo2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { SaveStatus } from "@/components/editor/SaveStatus";
import { Button, IconButton } from "@/components/ui/Button";
import { comboLabel, SHORTCUTS } from "@/lib/shortcuts";
import { useEditorStore } from "@/lib/store";

/**
 * Upar ki patti: naam, undo/redo, save ka haal, aur do band buttons.
 *
 * ⚠️ Preview aur Export **saaf-saaf disabled** hain aur tooltip me likha hai kyun.
 * Inhe chalne jaisa dikhana (ya chhupa dena) dono galat hote: pehla jhooth hai,
 * doosra ye bhula deta hai ki wo aane wale hain.
 */

function shortcutHint(id: string): string {
  const entry = SHORTCUTS.find((shortcut) => shortcut.id === id);
  return entry ? ` (${comboLabel(entry.keys)})` : "";
}

export function TopBar() {
  const doc = useEditorStore((state) => state.doc);
  const applyOp = useEditorStore((state) => state.applyOp);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndo = useEditorStore((state) => state.canUndo);
  const canRedo = useEditorStore((state) => state.canRedo);
  const undoLabel = useEditorStore((state) => state.undoLabel);
  const redoLabel = useEditorStore((state) => state.redoLabel);

  const name = doc.project.name;
  const [draft, setDraft] = useState(name);

  // Naam bahar se bhi badal sakta hai (undo, version restore) — tab input ko
  // uske saath aana chahiye, warna wo purana naam pakde rehta hai.
  useEffect(() => setDraft(name), [name]);

  function commitName() {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === name) {
      setDraft(name);
      return;
    }
    applyOp("setProjectProperty", { path: "name", value: trimmed }, { label: "naam badla" });
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-b border-ink-600 bg-ink-800 px-3">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 px-2 py-1 text-xs text-chalk-300 hover:bg-ink-700"
        title="Project list"
      >
        <ArrowLeft size={14} />
        Projects
      </Link>

      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commitName}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
          if (event.key === "Escape") {
            setDraft(name);
            event.currentTarget.blur();
          }
        }}
        aria-label="Project ka naam"
        className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-sm text-chalk-100 outline-none hover:border-ink-600 focus:border-terracotta focus:bg-ink-900"
      />

      <div className="flex items-center gap-1">
        <IconButton
          onClick={undo}
          disabled={!canUndo}
          aria-label="Undo"
          title={
            canUndo
              ? `Undo: ${undoLabel ?? ""}${shortcutHint("undo")}`
              : `Undo karne ko kuch nahi${shortcutHint("undo")}`
          }
        >
          <Undo2 size={15} />
        </IconButton>
        <IconButton
          onClick={redo}
          disabled={!canRedo}
          aria-label="Redo"
          title={
            canRedo
              ? `Redo: ${redoLabel ?? ""}${shortcutHint("redo")}`
              : `Redo karne ko kuch nahi${shortcutHint("redo")}`
          }
        >
          <Redo2 size={15} />
        </IconButton>
      </div>

      <SaveStatus />

      <div className="flex items-center gap-1.5">
        <Button
          disabled
          title="Preview player Phase 6 me aayega — abhi ye button sach me kuch nahi karta"
        >
          Preview
        </Button>
        <Button
          disabled
          variant="primary"
          title="Export pipeline Phase 11 me aayega — abhi ye button sach me kuch nahi karta"
        >
          Export
        </Button>
      </div>
    </header>
  );
}
