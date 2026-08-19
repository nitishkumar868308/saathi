"use client";

import {
  EMPTY_SELECTION,
  selectAll,
  selectSingle,
  timelineOrder,
  type Item,
} from "@reel/core";
import { useEffect } from "react";

import { usePlayback, type PlaybackApi } from "@/lib/playback";
import { useEditorStoreApi, type EditorState } from "@/lib/store";
import { ZOOM_STEP, clampPxPerFrame } from "@/lib/timeline";

/**
 * Keyboard shortcuts — **registry**, if-else nahi.
 *
 * Naya shortcut jodna is list me ek entry hai. Aage ke phases (timeline editing,
 * tracks, captions) me darjanon aane hain; unhe alag-alag `onKeyDown` me bikharne
 * dena matlab ek din do shortcut ek hi key par baith jaayenge aur pata bhi nahi
 * chalega.
 *
 * `mod` = Ctrl (Windows/Linux) ya Cmd (Mac) — dono ek hi entry se chalte hain.
 *
 * Entry ko poora context milta hai (`editor` + `playback`) kyunki transport ke
 * shortcut ko player chahiye hota hai aur edit ke shortcut ko store. Do alag
 * registry banane se ek hi key do jagah baith sakti thi aur takraav dikhta hi nahi.
 */

export interface ShortcutContext {
  editor: EditorState;
  playback: PlaybackApi;
}

export interface ShortcutEntry {
  id: string;
  /** `"mod+z"`, `"space"`, `"shift+arrowleft"` — chhote akshar me. */
  keys: string;
  label: string;
  /** UI me grouping ke liye. */
  group: "edit" | "transport" | "timeline";
  /** Input/textarea ke andar bhi chale? Default nahi (warna typing tootegi). */
  allowInInput?: boolean;
  run(context: ShortcutContext): void | Promise<void>;
}

export const SHORTCUTS: readonly ShortcutEntry[] = [
  {
    id: "undo",
    keys: "mod+z",
    label: "Undo",
    group: "edit",
    run: ({ editor }) => editor.undo(),
  },
  {
    id: "redo",
    keys: "mod+shift+z",
    label: "Redo",
    group: "edit",
    run: ({ editor }) => editor.redo(),
  },
  {
    // Windows ki purani aadat — Ctrl+Y bhi redo hi hai.
    id: "redo-alt",
    keys: "mod+y",
    label: "Redo",
    group: "edit",
    run: ({ editor }) => editor.redo(),
  },
  {
    id: "save",
    keys: "mod+s",
    label: "Abhi save karo",
    group: "edit",
    // Naam type karte waqt Ctrl+S dabana bilkul aam hai — browser ka "save page"
    // dialog wahan sabse zyada chidhata hai.
    allowInInput: true,
    run: ({ editor }) => editor.saveNow(),
  },

  /* ------------------------------------------------------------- transport */

  {
    id: "play-pause",
    keys: "space",
    label: "Play / pause",
    group: "transport",
    run: ({ playback }) => playback.toggle(),
  },
  {
    id: "frame-back",
    keys: "arrowleft",
    label: "Ek frame peeche",
    group: "transport",
    run: ({ playback }) => playback.stepFrames(-1),
  },
  {
    id: "frame-forward",
    keys: "arrowright",
    label: "Ek frame aage",
    group: "transport",
    run: ({ playback }) => playback.stepFrames(1),
  },
  {
    id: "second-back",
    keys: "shift+arrowleft",
    label: "Ek second peeche",
    group: "transport",
    run: ({ playback }) => playback.stepSeconds(-1),
  },
  {
    id: "second-forward",
    keys: "shift+arrowright",
    label: "Ek second aage",
    group: "transport",
    run: ({ playback }) => playback.stepSeconds(1),
  },
  {
    id: "to-start",
    keys: "home",
    label: "Shuruaat me",
    group: "transport",
    run: ({ playback }) => playback.toStart(),
  },
  {
    id: "to-end",
    keys: "end",
    label: "Ant me",
    group: "transport",
    run: ({ playback }) => playback.toEnd(),
  },
  /* -------------------------------------------------------------- timeline */

  {
    id: "zoom-in",
    // Bade keyboard par `+` ke liye Shift dabani padti hai, isliye `=` bhi.
    keys: "=",
    label: "Timeline zoom in",
    group: "timeline",
    run: ({ editor }) => editor.setZoom(clampPxPerFrame(editor.zoom * ZOOM_STEP)),
  },
  {
    id: "zoom-in-plus",
    keys: "+",
    label: "Timeline zoom in",
    group: "timeline",
    run: ({ editor }) => editor.setZoom(clampPxPerFrame(editor.zoom * ZOOM_STEP)),
  },
  {
    id: "zoom-out",
    keys: "-",
    label: "Timeline zoom out",
    group: "timeline",
    run: ({ editor }) => editor.setZoom(clampPxPerFrame(editor.zoom / ZOOM_STEP)),
  },
  {
    id: "select-all",
    keys: "mod+a",
    label: "Sab chuno",
    group: "timeline",
    run: ({ editor }) => editor.setSelection(selectAll(editor.doc)),
  },
  {
    id: "clear-selection",
    keys: "escape",
    label: "Selection chhodo",
    group: "timeline",
    run: ({ editor }) => editor.setSelection(EMPTY_SELECTION),
  },
  {
    id: "mark-in",
    keys: "i",
    label: "In point lagao",
    group: "timeline",
    run: ({ editor }) => editor.markIn(editor.playheadFrame),
  },
  {
    id: "mark-out",
    keys: "o",
    label: "Out point lagao",
    group: "timeline",
    run: ({ editor }) => editor.markOut(editor.playheadFrame),
  },
  {
    /*
     * 7.13 me "Tab/arrow" likha hai. Dono ka jawab alag-alag jagah se aata hai,
     * aur ye jaan-boojhkar hai:
     *
     * - **Tab** yahan hai hi nahi. Clip khud `<button>` hai, isliye browser ka
     *   apna Tab pehle se ek clip se doosri par le jaata hai — aur us par Enter
     *   dabane se wo chun jaati hai. Tab ko yahan pakad lene se poore app ka
     *   focus mar jaata: media panel, toolbar, dialog — kisi tak Tab se pahunchna
     *   hi namumkin ho jaata. Ek feature ke liye poori keyboard todna galat sauda hai.
     * - **Arrow** khaali nahi ho sakta, wo Phase 6 me frame step ko mil chuka hai
     *   (6.4) aur har second kaam aata hai. Isliye Alt ke saath.
     */
    id: "next-clip-alt",
    keys: "alt+arrowright",
    label: "Agla clip",
    group: "timeline",
    run: ({ editor }) => stepClip(editor, 1),
  },
  {
    id: "prev-clip-alt",
    keys: "alt+arrowleft",
    label: "Pichhla clip",
    group: "timeline",
    run: ({ editor }) => stepClip(editor, -1),
  },
];

/**
 * Timeline order me agla / pichhla clip chuno (7.13).
 *
 * Chunne ke saath playhead bhi us clip ke start par jaata hai. Sirf chunna kaafi
 * lagta hai, par tab wo clip screen se bahar bhi ho sakti hai aur "kuch hua hi
 * nahi" jaisa mehsoos hota hai — playhead hilne se timeline uske peeche chal
 * padti hai (7.4) aur clip saamne aa jaata hai.
 */
function stepClip(editor: EditorState, delta: number): void {
  const ordered = timelineOrder(editor.doc);
  if (ordered.length === 0) return;

  const current = editor.selection.itemIds[editor.selection.itemIds.length - 1];
  const at = current ? ordered.findIndex((item) => item.id === current) : -1;

  // Kuch chuna hi na ho to playhead ke sabse kareeb wale se shuru karo — wahi
  // wo clip hai jise user dekh raha hota hai.
  const from = at === -1 ? nearestIndex(ordered, editor.playheadFrame) - (delta > 0 ? 1 : -1) : at;
  const next = ordered[Math.min(ordered.length - 1, Math.max(0, from + delta))];
  if (!next) return;

  editor.setSelection(selectSingle(next.id));
  editor.setPlayhead(next.startFrame);
}

function nearestIndex(ordered: readonly Item[], frame: number): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  ordered.forEach((item, index) => {
    const distance = Math.abs(item.startFrame - frame);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}


/**
 * Event ko `"mod+shift+z"` jaisi string me badlo.
 *
 * Space ko `" "` ki jagah `"space"` likha jaata hai — `"mod+ "` jaisi string
 * padhne aur likhne dono me galti karwati hai.
 */
export function eventCombo(event: KeyboardEvent): string {
  const parts: string[] = [];
  if (event.ctrlKey || event.metaKey) parts.push("mod");
  if (event.altKey) parts.push("alt");
  if (event.shiftKey) parts.push("shift");

  const key = event.key.toLowerCase();
  // `Shift` khud ko key ki tarah bhi bhejta hai — usko combo me mat ginno.
  if (!["control", "meta", "alt", "shift"].includes(key)) {
    parts.push(key === " " ? "space" : key);
  }
  return parts.join("+");
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return ["input", "textarea", "select"].includes(target.tagName.toLowerCase());
}

/**
 * Ye element khud is key ko sambhalta hai kya?
 *
 * Button par focus hote hue Space dabana usi button ko dabata hai. Uske upar se
 * apna play/pause bhi chala dene par ek hi dabane me do cheezein hoti hain —
 * jaise "Loop" dabao aur video bhi chalne lage. Isliye aise mauke par browser
 * ko jeetne dete hain.
 */
export function nativeHandlesKey(target: EventTarget | null, combo: string): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (combo !== "space") return false;
  const tag = target.tagName.toLowerCase();
  return tag === "button" || tag === "a" || target.getAttribute("role") === "button";
}

/** Shortcuts ko window par chipka do. Editor shell ek hi baar bulata hai. */
export function useShortcuts(): void {
  const store = useEditorStoreApi();
  const playback = usePlayback();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const combo = eventCombo(event);
      const typing = isTypingTarget(event.target);

      for (const shortcut of SHORTCUTS) {
        if (shortcut.keys !== combo) continue;
        if (typing && !shortcut.allowInInput) continue;
        if (nativeHandlesKey(event.target, combo)) continue;

        event.preventDefault();
        void shortcut.run({ editor: store.getState(), playback });
        return;
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [store, playback]);
}

/** UI me dikhane layak: `mod+shift+z` -> `Ctrl+Shift+Z` (Mac par `⌘`). */
export function comboLabel(keys: string, isMac = false): string {
  const NAMES: Record<string, string> = {
    space: "Space",
    tab: "Tab",
    escape: "Esc",
    alt: "Alt",
    arrowleft: "←",
    arrowright: "→",
    arrowup: "↑",
    arrowdown: "↓",
    home: "Home",
    end: "End",
  };

  return keys
    .split("+")
    .map((part) => {
      if (part === "mod") return isMac ? "⌘" : "Ctrl";
      if (NAMES[part]) return NAMES[part] as string;
      if (part.length === 1) return part.toUpperCase();
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(isMac ? "" : "+");
}
