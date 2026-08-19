"use client";

import {
  EMPTY_SELECTION,
  OPS,
  createHistory,
  parseDoc,
  pruneSelection,
  type Doc,
  type History,
  type Op,
  type OpName,
  type Selection,
} from "@reel/core";
import { createContext, useContext, useState, type ReactNode } from "react";
import { createStore, useStore, type StoreApi } from "zustand";

import { createSaveScheduler, type SaveScheduler, type SaveStatus } from "@/lib/autosave";
import { HISTORY_LIMIT, SNAPSHOT_EVERY_SAVES, SNAPSHOT_MAX_INTERVAL_MS } from "@/lib/config";

/**
 * Editor ka poora state — do slice, ek store.
 *
 *  - **docSlice**: Project JSON. Yahi ek sach hai; renderer aur save dono isi ko dekhte hain.
 *  - **uiSlice**: selection, playhead, zoom, mode. Ye doc ke **andar nahi** ja sakta
 *    (Section E ka faisla) — warna Ctrl+Z playhead aur selection bhi hila deta, aur
 *    ek din tum "undo ne mera selection kyun badla" dhoondh rahe hote.
 *
 * ⚠️ **Doc ki har mutation `applyOp` se hoti hai** (Dynamic rule 12). Component me
 * `doc.items[0].x = 5` likhna mana hai. Iske bina teen cheezein ek saath tootti
 * hain: undo/redo, AI ke patches, aur templates.
 *
 * ⚠️ **Store module-level nahi hai, har editor ka apna hai** (context se). Ye
 * jaan-boojhkar hai aur maine ise sach me pakda: module-level store ke saath
 * server render me `useSyncExternalStore` ka snapshot store bharne se *pehle* jam
 * jaata tha, aur server ka HTML bina preview/timeline ke nikalta tha (client par
 * hydration mismatch). Store ab render se pehle poora bana hua aata hai, isliye
 * pehla hi snapshot sahi hota hai. Doosra faayda: do project ek saath render hone
 * par ek doosre ka state nahi chhoote.
 *
 * History aur autosave scheduler store ke **bahar**, uske closure me hain: ye
 * state nahi, machinery hain. State me rakhne se har render par inki pehchaan
 * badalti aur `useEffect` ka jaal ban jaata.
 */

type OpArgsOf<K extends OpName> = (typeof OPS)[K] extends Op<infer A> ? A : never;

export interface ApplyOpOptions {
  /** Undo tooltip me dikhne wala naam. */
  label?: string;
  /** Ek hi key waale lagataar edits ek undo entry me mil jaate hain (drag, slider). */
  coalesceKey?: string;
}

export interface LoadedProjectInput {
  id: string;
  name: string;
  docVersion: number;
  updatedAt: string;
  doc: Doc;
}

export interface ConflictInfo {
  serverVersion: number;
  serverUpdatedAt: string;
}

export interface EditorState {
  /* ---------------- doc slice ---------------- */
  projectId: string;
  doc: Doc;
  docVersion: number;
  canUndo: boolean;
  canRedo: boolean;
  undoLabel: string | null;
  redoLabel: string | null;

  /* ---------------- ui slice ----------------- */
  selection: Selection;
  playheadFrame: number;
  /** Timeline ka zoom (px per frame) — Phase 7 me kaam me aayega. */
  zoom: number;
  mode: "beginner" | "advanced";
  leftPanelId: string;

  /* --------------- save slice ---------------- */
  saveStatus: SaveStatus;
  saveMessage: string | null;
  savedAt: string;
  conflict: ConflictInfo | null;
  /** Aakhri snapshot ke baad kitne save ho chuke — policy config.ts me hai. */
  savesSinceSnapshot: number;
  lastSnapshotAt: number;
  opError: string | null;

  /* ----------------- actions ----------------- */
  /** Naye doc par poora reset (version se reload, conflict ke baad). */
  reset(project: LoadedProjectInput): void;
  applyOp<K extends OpName>(name: K, args: OpArgsOf<K>, options?: ApplyOpOptions): void;
  undo(): void;
  redo(): void;

  setSelection(selection: Selection): void;
  setPlayhead(frame: number): void;
  setZoom(zoom: number): void;
  setMode(mode: "beginner" | "advanced"): void;
  setLeftPanel(id: string): void;
  clearOpError(): void;

  saveNow(): Promise<void>;
  saveVersion(label: string): Promise<{ ok: boolean; message?: string }>;
  restoreVersion(versionId: string): Promise<{ ok: boolean; message?: string }>;
  /** Conflict: doosri tab ka version le lo (mera abhi ka kaam chala jaayega). */
  reloadFromServer(): Promise<void>;
  /** Conflict: mera version rakho — DB ka doc pehle snapshot me jaata hai. */
  keepMineOnConflict(): Promise<void>;
  hasUnsavedWork(): boolean;
  /**
   * Pending timer band karo. **Editor ke unmount par ye mat chalao** — wahan
   * `saveNow()` (flush) chahiye, warna aakhri edit bina save ke chali jaati hai.
   * Ye mukhya roop se tests ke liye hai.
   */
  dispose(): void;
}

export type EditorStore = StoreApi<EditorState>;

export function createEditorStore(project: LoadedProjectInput): EditorStore {
  let history: History<Doc> = createHistory<Doc>({ limit: HISTORY_LIMIT });
  let scheduler: SaveScheduler | null = null;

  return createStore<EditorState>((set, get) => {
    /** History ke flags state me mirror karo — UI inhi se re-render hota hai. */
    function syncHistoryFlags(): void {
      set({
        canUndo: history.canUndo(),
        canRedo: history.canRedo(),
        undoLabel: history.peekUndoLabel(),
        redoLabel: history.peekRedoLabel(),
      });
    }

    /** Asli save — scheduler isi ko bulata hai. Taaza doc hamesha store se. */
    async function performSave(overwrite = false) {
      const { projectId, doc, docVersion } = get();

      let response: Response;
      try {
        response = await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            doc,
            doc_version: docVersion,
            ...(overwrite ? { overwrite: true } : {}),
          }),
        });
      } catch (error) {
        // Network gaya — ye dobara koshish karne layak hai.
        return {
          kind: "retry" as const,
          message: error instanceof Error ? error.message : String(error),
        };
      }

      const data = (await response.json().catch(() => ({}))) as {
        doc_version?: number;
        updated_at?: string;
        error?: string;
        reason?: string;
        serverVersion?: number;
        serverUpdatedAt?: string;
      };

      if (response.status === 409) {
        set({
          conflict: {
            serverVersion: data.serverVersion ?? 0,
            serverUpdatedAt: data.serverUpdatedAt ?? "",
          },
        });
        return { kind: "conflict" as const };
      }
      if (response.status >= 500 || response.status === 408 || response.status === 429) {
        return {
          kind: "retry" as const,
          message: data.reason ?? data.error ?? `${response.status}`,
        };
      }
      if (!response.ok) {
        return {
          kind: "fatal" as const,
          message: data.reason ?? data.error ?? `${response.status}`,
        };
      }

      set({
        docVersion: data.doc_version ?? get().docVersion + 1,
        savedAt: data.updated_at ?? new Date().toISOString(),
        conflict: null,
        savesSinceSnapshot: get().savesSinceSnapshot + 1,
      });
      void maybeSnapshot();
      return { kind: "saved" as const };
    }

    /**
     * Version snapshot ki policy (4.10): har 10 save ya 5 minute me ek.
     *
     * Ye "chupchaap fail ho jaane layak" kaam hai — snapshot na banne se project
     * ka data nahi jaata, isliye iski galti autosave ko nahi rokti. Par status me
     * likh dete hain, warna ek din pata chalega ki mahine bhar se koi snapshot
     * bana hi nahi.
     */
    async function maybeSnapshot(): Promise<void> {
      const { savesSinceSnapshot, lastSnapshotAt } = get();
      const dueByCount = savesSinceSnapshot >= SNAPSHOT_EVERY_SAVES;
      const dueByTime = Date.now() - lastSnapshotAt >= SNAPSHOT_MAX_INTERVAL_MS;
      if (!dueByCount && !dueByTime) return;

      const result = await get().saveVersion("autosave");
      if (!result.ok) set({ saveMessage: `snapshot nahi bana: ${result.message ?? ""}` });
    }

    /**
     * Har edit yahan se save maangti hai — seedha `scheduler.schedule()` se nahi.
     *
     * ⚠️ Ye guard sach me kamaaya hua hai. Pehle `dispose()` scheduler ko null kar
     * deta tha aur uske baad har `schedule()` chupchaap kuch nahi karti thi —
     * screen par "Saved" likha rehta tha aur DB me kuch nahi jaata tha. React
     * StrictMode dev me har effect ko mount → cleanup → mount chalata hai, isliye
     * ye dev me **hamesha** hota tha. Ab mara hua scheduler dobara khada ho jaata
     * hai: autosave ka chupchaap marna mumkin hi nahi.
     */
    function requestSave(): void {
      if (!scheduler || scheduler.isDisposed()) startScheduler();
      scheduler?.schedule();
    }

    function startScheduler(): void {
      scheduler?.dispose();
      scheduler = createSaveScheduler({
        save: () => performSave(),
        onStatus: (status, detail) =>
          set({
            saveStatus: status,
            saveMessage:
              detail.message === undefined
                ? null
                : detail.attempt
                  ? `${detail.message} (koshish ${detail.attempt})`
                  : detail.message,
          }),
      });
    }

    startScheduler();

    return {
      projectId: project.id,
      doc: project.doc,
      docVersion: project.docVersion,
      canUndo: false,
      canRedo: false,
      undoLabel: null,
      redoLabel: null,

      selection: EMPTY_SELECTION,
      playheadFrame: 0,
      zoom: 1,
      mode: "advanced",
      leftPanelId: "media",

      saveStatus: "saved",
      saveMessage: null,
      savedAt: project.updatedAt,
      conflict: null,
      savesSinceSnapshot: 0,
      /*
       * `0` se shuru — do wajah:
       *  1. `Date.now()` yahan likhne se server aur client ki value alag hoti
       *     aur hydration mismatch aata.
       *  2. Iska seedha asar ye hai ki **session ka pehla save ek snapshot bhi
       *     banata hai** (0 se ab tak 5 minute se zyada ho hi chuke hain). Ye
       *     chaahiye tha: "aaj kaam shuru karne se pehle wala roop" hamesha ek
       *     version me pada rehta hai.
       */
      lastSnapshotAt: 0,
      opError: null,

      reset(next) {
        history = createHistory<Doc>({ limit: HISTORY_LIMIT });
        startScheduler();
        set({
          projectId: next.id,
          doc: next.doc,
          docVersion: next.docVersion,
          savedAt: next.updatedAt,
          canUndo: false,
          canRedo: false,
          undoLabel: null,
          redoLabel: null,
          selection: EMPTY_SELECTION,
          playheadFrame: 0,
          saveStatus: "saved",
          saveMessage: null,
          conflict: null,
          savesSinceSnapshot: 0,
          lastSnapshotAt: Date.now(),
          opError: null,
        });
      },

      applyOp(name, args, options = {}) {
        const doc = get().doc;
        const op = OPS[name] as Op<unknown>;
        try {
          const next = history.apply(doc, (draft) => op.recipe(draft, args), {
            label: options.label ?? name,
            ...(options.coalesceKey === undefined ? {} : { coalesceKey: options.coalesceKey }),
          });
          if (next === doc) return; // kuch nahi badla — history bhi gandi nahi hui

          set({ doc: next, selection: pruneSelection(next, get().selection), opError: null });
          syncHistoryFlags();
          requestSave();
        } catch (error) {
          /*
           * Op ka error galti nahi, jawab hai — "locked item", "track ye type nahi
           * leta" waghera. Isko crash banane se poora editor chala jaata hai;
           * chupchaap khaa jaane se user ko lagta hai button toota hai.
           */
          set({ opError: error instanceof Error ? error.message : String(error) });
        }
      },

      undo() {
        if (!history.canUndo()) return;
        const next = history.undo(get().doc);
        set({ doc: next, selection: pruneSelection(next, get().selection) });
        syncHistoryFlags();
        requestSave();
      },

      redo() {
        if (!history.canRedo()) return;
        const next = history.redo(get().doc);
        set({ doc: next, selection: pruneSelection(next, get().selection) });
        syncHistoryFlags();
        requestSave();
      },

      setSelection(selection) {
        set({ selection });
      },
      setPlayhead(frame) {
        set({ playheadFrame: Math.max(0, Math.round(frame)) });
      },
      setZoom(zoom) {
        set({ zoom });
      },
      setMode(mode) {
        set({ mode });
      },
      setLeftPanel(leftPanelId) {
        set({ leftPanelId });
      },
      clearOpError() {
        set({ opError: null });
      },

      async saveNow() {
        await scheduler?.flush();
      },

      async saveVersion(label) {
        try {
          const response = await fetch(`/api/projects/${get().projectId}/versions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ label }),
          });
          if (!response.ok) {
            const data = (await response.json().catch(() => ({}))) as { reason?: string };
            return { ok: false, message: data.reason ?? `${response.status}` };
          }
          set({ savesSinceSnapshot: 0, lastSnapshotAt: Date.now() });
          return { ok: true };
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : String(error) };
        }
      },

      async restoreVersion(versionId) {
        try {
          const response = await fetch(`/api/projects/${get().projectId}/versions/${versionId}`);
          const data = (await response.json().catch(() => ({}))) as {
            doc?: unknown;
            reason?: string;
          };
          if (!response.ok || !data.doc) {
            return { ok: false, message: data.reason ?? `${response.status}` };
          }
          // Restore bhi ek op hai — isliye galat version uthane par Ctrl+Z bacha leta hai.
          get().applyOp("replaceDoc", { doc: parseDoc(data.doc) }, { label: "version restore" });
          return { ok: true };
        } catch (error) {
          return { ok: false, message: error instanceof Error ? error.message : String(error) };
        }
      },

      async reloadFromServer() {
        const response = await fetch(`/api/projects/${get().projectId}`);
        const data = (await response.json().catch(() => ({}))) as {
          project?: LoadedProjectInput;
          reason?: string;
        };
        if (!response.ok || !data.project) {
          set({ saveStatus: "error", saveMessage: data.reason ?? "reload nahi hua" });
          return;
        }
        // Poora reset — history bhi. Server ka doc ab neenv hai; purani patches
        // uspar lagana matlab do alag itihaas mila dena.
        get().reset({ ...data.project, doc: parseDoc(data.project.doc) });
      },

      async keepMineOnConflict() {
        scheduler?.reset();
        set({ saveStatus: "saving", saveMessage: null });
        const outcome = await performSave(true);
        if (outcome.kind === "saved") {
          set({ saveStatus: "saved", saveMessage: null, conflict: null });
          return;
        }
        set({
          saveStatus: outcome.kind === "conflict" ? "conflict" : "error",
          saveMessage: "message" in outcome ? outcome.message : null,
        });
      },

      hasUnsavedWork() {
        const status = get().saveStatus;
        if (status === "conflict" || status === "error" || status === "retrying") return true;
        return scheduler?.hasPendingWork() ?? false;
      },

      dispose() {
        scheduler?.dispose();
        scheduler = null;
      },
    };
  });
}

/* ------------------------------------------------------------------ context */

const EditorStoreContext = createContext<EditorStore | null>(null);

export function EditorStoreProvider({
  project,
  children,
}: {
  project: LoadedProjectInput;
  children: ReactNode;
}) {
  // Store render se **pehle** poora ban jaata hai — SSR ka snapshot isliye sahi
  // hota hai (upar wala ⚠️ dekho).
  const [store] = useState(() => createEditorStore(project));
  return <EditorStoreContext.Provider value={store}>{children}</EditorStoreContext.Provider>;
}

export function useEditorStoreApi(): EditorStore {
  const store = useContext(EditorStoreContext);
  if (!store) throw new Error("useEditorStore sirf <EditorStoreProvider> ke andar chalta hai");
  return store;
}

export function useEditorStore<T>(selector: (state: EditorState) => T): T {
  return useStore(useEditorStoreApi(), selector);
}
