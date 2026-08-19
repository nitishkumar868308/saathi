"use client";

import {
  DEFAULT_OVERLAP_POLICY,
  EMPTY_SELECTION,
  OPS,
  createHistory,
  isStructuralOp,
  parseDoc,
  pruneSelection,
  recomputeDuration,
  type Doc,
  type History,
  type Op,
  type OpName,
  type OverlapPolicy,
  type Selection,
} from "@reel/core";
import { createContext, useContext, useState, type ReactNode } from "react";
import { createStore, useStore, type StoreApi } from "zustand";
import { DEFAULT_SNAP_OPTIONS, type SnapOptions } from "@/lib/clipEdit";

import { createSaveScheduler, type SaveScheduler, type SaveStatus } from "@/lib/autosave";
import { clearLocalDraft, saveLocalDraft } from "@/lib/localDraft";
import { HISTORY_LIMIT, SNAPSHOT_EVERY_SAVES, SNAPSHOT_MAX_INTERVAL_MS } from "@/lib/config";
import {
  DEFAULT_PX_PER_FRAME,
  clampPxPerFrame,
  clampTrackHeight,
  setInPoint,
  setOutPoint,
} from "@/lib/timeline";

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

export type OpArgsOf<K extends OpName> = (typeof OPS)[K] extends Op<infer A> ? A : never;

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
  /**
   * Timeline ka zoom — **px per frame**, koi "level" nahi.
   *
   * Level rakhne se Ctrl+wheel jhatke se chalta aur "Fit project" kisi bhi level
   * par theek nahi baithta. Hadd `clampPxPerFrame()` lagata hai.
   */
  zoom: number;
  /** Playback ke dauraan timeline playhead ke peeche chale (7.4). */
  followPlayhead: boolean;
  /**
   * Track ki oonchai jo user ne kheench kar badli (px), trackId se.
   *
   * ⚠️ Ye jaan-boojhkar **doc me nahi** hai: oonchai dekhne ka tarika hai, project
   * ka data nahi — doc me daalne par ek track kheenchna hi autosave aur ek naya
   * version bana deta. Isi wajah se ye reload par reset ho jaati hai; asli track
   * manager Phase 16 me hai, wahi iska sahi ghar hoga.
   */
  /** In/Out markers (7.11) — inka asli kaam 8.5 me (`cutRange` / `keepRange`). */
  inFrame: number | null;
  outFrame: number | null;
  /**
   * Overlap policy (8.9) — do clips ek jagah aa jaayein to kya ho.
   *
   * Ye ek **editing preference** hai, doc ka data nahi: isse badalne se project
   * me kuch nahi badalta, sirf agli edit ka vyavhaar badalta hai. Doc me daalne
   * par Ctrl+Z is setting ko bhi ulta deta, jo bilkul galat lagta.
   */
  overlapPolicy: OverlapPolicy;
  /**
   * Auto-keyframe (13.4) — on hone par property badalna playhead par keyframe
   * banata hai, static value nahi.
   *
   * ⚠️ Ye default **off** hai aur ye soch kar hai: on rehne par har chhoti si
   * edit ek keyframe chhod jaati hai, aur do din baad clip par bees keyframes
   * hote hain jinme se pandrah user ne jaan kar nahi lagaye the. Us gandagi ko
   * saaf karna keyframe lagane se zyada mehnat ka kaam hai.
   */
  autoKeyframe: boolean;
  /**
   * Snapping ke toggles (16.11).
   *
   * Doc me nahi hai — ye editing preference hai. Doc me daalne par Ctrl+Z ise
   * bhi ulta deta, jo bilkul galat lagta (wahi wajah jo `overlapPolicy` ki hai).
   */
  snapOptions: SnapOptions;
  /** Cheat-sheet khula hai? (16.6) */
  shortcutsOpen: boolean;
  /**
   * "Poori timeline dikhao" ki farmaaish — ek ginti (16.5).
   *
   * ⚠️ Zoom ki value yahan nahi ban sakti: fit karne ke liye timeline ki asli
   * chaudai chahiye, aur wo sirf `TimelineView` ko pata hoti hai. Isliye store
   * sirf ginti badhata hai aur view usi par apna hisaab lagata hai. Store me
   * width rakhne par wo har resize par badalti aur poora editor dobara render
   * hota, jabki uski zaroorat sirf ek button dabane par hai.
   */
  fitZoomRequest: number;
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
  setFollowPlayhead(value: boolean): void;
  setTrackHeight(trackId: string, height: number): void;
  markIn(frame: number): void;
  markOut(frame: number): void;
  clearInOut(): void;
  setOverlapPolicy(policy: OverlapPolicy): void;
  setAutoKeyframe(value: boolean): void;
  setSnapOptions(patch: Partial<SnapOptions>): void;
  setShortcutsOpen(open: boolean): void;
  requestFitZoom(): void;
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
      /*
       * Server par pahunch gaya — ab local draft ka koi kaam nahi (16.14).
       *
       * Ise saaf karna zaroori hai: chhoda hua draft agli baar "recover karein?"
       * poochhta rehta hai jabki bachane ko kuch hai hi nahi. Do-teen baar aisa
       * hone ke baad user us sawaal ko padhna hi band kar deta hai — aur jis din
       * sach me kuch bacha hoga us din bhi wo "nahi" daba dega.
       */
      void clearLocalDraft(get().projectId);

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

      /*
       * Local draft (16.14) — server par bhejne se **pehle**, aur uske natije
       * ki parwah kiye bina.
       *
       * ⚠️ Yahi is jaal ka poora point hai. Server wala save fail ho sakta hai
       * (net gaya, token expire hua) aur tab tak user kaam karta rehta hai. Draft
       * yahin, isi pal likh dene se wo kaam browser me bacha rehta hai — chahe
       * agle hi second tab crash ho jaaye.
       *
       * `void` isliye ki ye chal kar khatam hone ka intezaar nahi karna — draft
       * likhne me 2ms lagein ya 20, edit turant dikhni chahiye.
       */
      void saveLocalDraft({
        projectId: get().projectId,
        doc: get().doc,
        at: Date.now(),
        baseUpdatedAt: get().savedAt || null,
      });
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
      zoom: DEFAULT_PX_PER_FRAME,
      followPlayhead: true,
      inFrame: null,
      outFrame: null,
      overlapPolicy: DEFAULT_OVERLAP_POLICY,
      autoKeyframe: false,
      snapOptions: DEFAULT_SNAP_OPTIONS,
      shortcutsOpen: false,
      fitZoomRequest: 0,
      mode: readMode(project.id),
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
          inFrame: null,
          outFrame: null,
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
          const next = history.apply(
            doc,
            (draft) => {
              op.recipe(draft, args);

              /*
               * Structural op ke baad project ki lambai dobara ginn lo (8.14).
               *
               * Ye **usi** history entry ke andar hota hai, alag op ki tarah
               * nahi — warna ek clip delete karne par do baar Ctrl+Z dabana
               * padta: ek duration wapas laane ko, ek clip wapas laane ko.
               *
               * ⚠️ Items khaali hon to lambai ko haath nahi lagate. Exact
               * ginti wahan 1 frame deti hai, aur naya khaali project 1 frame
               * ka ho jaana bilkul toota hua lagta — jabki user ne to sirf
               * aakhri clip hataayi thi.
               */
              if (isStructuralOp(name) && draft.items.length > 0) {
                recomputeDuration.recipe(draft, undefined as never);
              }
            },
            {
              label: options.label ?? name,
              ...(options.coalesceKey === undefined ? {} : { coalesceKey: options.coalesceKey }),
            },
          );
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
        set({ zoom: clampPxPerFrame(zoom) });
      },
      setFollowPlayhead(followPlayhead) {
        set({ followPlayhead });
      },
      setTrackHeight(trackId, height) {
        /*
         * Oonchai ab doc me hai, isliye ye ek op hai — aur uska Ctrl+Z bhi
         * chalta hai. `coalesceKey` se poora drag ek hi undo entry banta hai,
         * warna ek baar oonchai badalne par bees baar Ctrl+Z dabana padta.
         */
        get().applyOp(
          "setTrackProperty",
          { trackId, path: "heightPx", value: clampTrackHeight(height) },
          { label: "Track ki oonchai", coalesceKey: `track-height:${trackId}` },
        );
      },
      markIn(frame) {
        const last = Math.max(0, get().doc.project.durationInFrames - 1);
        set(setInPoint({ inFrame: get().inFrame, outFrame: get().outFrame }, frame, last));
      },
      markOut(frame) {
        const last = Math.max(0, get().doc.project.durationInFrames - 1);
        set(setOutPoint({ inFrame: get().inFrame, outFrame: get().outFrame }, frame, last));
      },
      clearInOut() {
        set({ inFrame: null, outFrame: null });
      },
      setOverlapPolicy(overlapPolicy) {
        set({ overlapPolicy });
      },
      setAutoKeyframe(autoKeyframe) {
        set({ autoKeyframe });
      },
      setSnapOptions(patch) {
        set({ snapOptions: { ...get().snapOptions, ...patch } });
      },
      setShortcutsOpen(shortcutsOpen) {
        set({ shortcutsOpen });
      },
      requestFitZoom() {
        set({ fitZoomRequest: get().fitZoomRequest + 1 });
      },
      setMode(mode) {
        set({ mode });
        rememberMode(get().projectId, mode);
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

/* --------------------------------------------------------------- mode yaad */

/**
 * Beginner/Advanced ka chunaav **per project** yaad rehta hai (12.9).
 *
 * ⚠️ Ye doc me **nahi** jaata, aur ye soch kar hai: mode is machine par kaam
 * karne ka tarika hai, project ka data nahi. Doc me daalne par teen cheezein
 * kharaab hoti — Ctrl+Z mode badal deta, mode badalna autosave chalata, aur
 * ek hi project do machine par khole to dono ek doosre ka view badalte rehte.
 *
 * ⚠️ `typeof window` ki jaanch zaroori hai: store SSR ke dauraan bhi banta hai
 * (dekho upar wala ⚠️), aur wahan `localStorage` hai hi nahi.
 */
const MODE_STORAGE_KEY = "reel-studio.mode.v1";

type EditorMode = "beginner" | "advanced";

function readMode(projectId: string): EditorMode {
  if (typeof window === "undefined") return "advanced";
  try {
    const raw = window.localStorage.getItem(MODE_STORAGE_KEY);
    if (!raw) return "advanced";
    const map = JSON.parse(raw) as Record<string, EditorMode>;
    return map[projectId] === "beginner" ? "beginner" : "advanced";
  } catch {
    return "advanced";
  }
}

function rememberMode(projectId: string, mode: EditorMode): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(MODE_STORAGE_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, EditorMode>) : {};
    map[projectId] = mode;
    window.localStorage.setItem(MODE_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // localStorage bhara ho ya band ho — mode yaad na rehna kaam rokne layak
    // galti nahi hai.
  }
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
