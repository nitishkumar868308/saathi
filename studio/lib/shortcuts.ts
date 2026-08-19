"use client";

import { useEffect } from "react";

import { useEditorStoreApi, type EditorState } from "@/lib/store";

/**
 * Keyboard shortcuts — **registry**, if-else nahi.
 *
 * Naya shortcut jodna is list me ek entry hai. Aage ke phases (timeline editing,
 * tracks, captions) me darjanon aane hain; unhe alag-alag `onKeyDown` me bikharne
 * dena matlab ek din do shortcut ek hi key par baith jaayenge aur pata bhi nahi
 * chalega.
 *
 * `mod` = Ctrl (Windows/Linux) ya Cmd (Mac) — dono ek hi entry se chalte hain.
 */

export interface ShortcutEntry {
  id: string;
  /** `"mod+z"`, `"mod+shift+z"`, `"mod+s"` — chhote akshar me. */
  keys: string;
  label: string;
  /** Input/textarea ke andar bhi chale? Default nahi (warna typing tootegi). */
  allowInInput?: boolean;
  run(store: EditorState): void | Promise<void>;
}

export const SHORTCUTS: readonly ShortcutEntry[] = [
  {
    id: "undo",
    keys: "mod+z",
    label: "Undo",
    run: (store) => store.undo(),
  },
  {
    id: "redo",
    keys: "mod+shift+z",
    label: "Redo",
    run: (store) => store.redo(),
  },
  {
    // Windows ki purani aadat — Ctrl+Y bhi redo hi hai.
    id: "redo-alt",
    keys: "mod+y",
    label: "Redo",
    run: (store) => store.redo(),
  },
  {
    id: "save",
    keys: "mod+s",
    label: "Abhi save karo",
    // Naam type karte waqt Ctrl+S dabana bilkul aam hai — browser ka "save page"
    // dialog wahan sabse zyada chidhata hai.
    allowInInput: true,
    run: (store) => store.saveNow(),
  },
];

/** Event ko `"mod+shift+z"` jaisi string me badlo. */
export function eventCombo(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("mod");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");

  const key = event.key.toLowerCase();
  // `Shift` khud ko key ki tarah bhi bhejta hai — usko combo me mat ginno.
  if (!["control", "meta", "alt", "shift"].includes(key)) parts.push(key);
  return parts.join("+");
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["input", "textarea", "select"].includes(target.tagName.toLowerCase());
}

/** Shortcuts ko window par chipka do. Editor shell ek hi baar bulata hai. */
export function useShortcuts(): void {
  const store = useEditorStoreApi();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const combo = eventCombo(event);
      const typing = isTypingTarget(event.target);

      for (const shortcut of SHORTCUTS) {
        if (shortcut.keys !== combo) continue;
        if (typing && !shortcut.allowInInput) continue;

        event.preventDefault();
        void shortcut.run(store.getState());
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store]);
}

/** UI me dikhane layak: `mod+shift+z` -> `Ctrl+Shift+Z` (Mac par `⌘`). */
export function comboLabel(keys: string, isMac = false): string {
  return keys
    .split("+")
    .map((part) => {
      if (part === "mod") return isMac ? "⌘" : "Ctrl";
      if (part.length === 1) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(isMac ? "" : "+");
}
