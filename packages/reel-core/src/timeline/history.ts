import {
  applyPatches,
  enablePatches,
  produceWithPatches,
  type Draft,
  type Patch,
} from "immer";

/**
 * Undo / redo.
 *
 * **Patches, snapshots nahi.** Ek 30-second reel ka doc ~100KB hota hai; 50
 * snapshots matlab 5MB har project par, aur har keystroke pe ek poori copy.
 * Patches me sirf "kya badla" rehta hai — kuch bytes.
 *
 * **Coalescing** doosri zaroori cheez hai: clip drag karte waqt 60 mousemove
 * aate hain. Bina coalesce ke user ko 60 baar Ctrl+Z dabana padta. Ek hi
 * `coalesceKey` waale lagataar edits ek undo entry me mil jaate hain.
 */

enablePatches();

export const DEFAULT_HISTORY_LIMIT = 50;

export interface HistoryEntry {
  label: string;
  /** Ek hi key waale lagataar edits ek entry me mil jaate hain (drag, slider). */
  coalesceKey?: string;
  patches: Patch[];
  inverse: Patch[];
}

export interface ApplyOptions {
  label?: string;
  coalesceKey?: string;
}

export interface History<T> {
  /** Recipe chalao, naya state do, aur badlav history me daal do. */
  apply(state: T, recipe: (draft: Draft<T>) => void, options?: ApplyOptions): T;
  undo(state: T): T;
  redo(state: T): T;
  canUndo(): boolean;
  canRedo(): boolean;
  /** Agla undo kya wapas lega — UI tooltip ke liye. */
  peekUndoLabel(): string | null;
  peekRedoLabel(): string | null;
  clear(): void;
  size(): { past: number; future: number };
}

export interface HistoryOptions {
  /** Kitni entries yaad rakhein. Ring buffer hai — purani girti jaati hai. */
  limit?: number;
}

export function createHistory<T>(options: HistoryOptions = {}): History<T> {
  const limit = options.limit ?? DEFAULT_HISTORY_LIMIT;
  let past: HistoryEntry[] = [];
  let future: HistoryEntry[] = [];

  return {
    apply(state, recipe, applyOptions = {}) {
      const [next, patches, inverse] = produceWithPatches(state, (draft) => {
        recipe(draft as Draft<T>);
      });

      // Kuch bhi nahi badla to history gandi mat karo — warna user ka Ctrl+Z
      // "kuch nahi hua" wale steps par bekaar me lagta rehta hai.
      if (patches.length === 0) return state;

      const label = applyOptions.label ?? "edit";
      const key = applyOptions.coalesceKey;
      const top = past[past.length - 1];

      if (key !== undefined && top && top.coalesceKey === key) {
        top.patches = [...top.patches, ...patches];
        // Undo ulti disha me chalta hai, isliye inverse aage lagte hain.
        top.inverse = [...inverse, ...top.inverse];
        top.label = label;
      } else {
        past.push({ label, patches, inverse, ...(key === undefined ? {} : { coalesceKey: key }) });
        if (past.length > limit) past = past.slice(past.length - limit);
      }

      // Nayi edit ke baad redo ka rasta band — wahi har editor karta hai.
      future = [];
      return next as T;
    },

    undo(state) {
      const entry = past.pop();
      if (!entry) return state;
      future.push(entry);
      return applyPatches(state as object, entry.inverse) as T;
    },

    redo(state) {
      const entry = future.pop();
      if (!entry) return state;
      past.push(entry);
      return applyPatches(state as object, entry.patches) as T;
    },

    canUndo() {
      return past.length > 0;
    },

    canRedo() {
      return future.length > 0;
    },

    peekUndoLabel() {
      return past[past.length - 1]?.label ?? null;
    },

    peekRedoLabel() {
      return future[future.length - 1]?.label ?? null;
    },

    clear() {
      past = [];
      future = [];
    },

    size() {
      return { past: past.length, future: future.length };
    },
  };
}
