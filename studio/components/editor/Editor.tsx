"use client";

import { useEffect } from "react";

import { ConflictBanner } from "@/components/editor/ConflictBanner";
import { LeftSidebar } from "@/components/editor/LeftSidebar";
import { PreviewStage } from "@/components/editor/PreviewStage";
import { SceneCards } from "@/components/editor/scenes/SceneCards";
import { ResizeHandle } from "@/components/editor/ResizeHandle";
import { RightSidebar } from "@/components/editor/RightSidebar";
import { TimelineView } from "@/components/editor/timeline/TimelineView";
import { DraftRecovery } from "@/components/editor/DraftRecovery";
import { ShortcutsDialog } from "@/components/editor/ShortcutsDialog";
import { TopBar } from "@/components/editor/TopBar";
import { MobileShell } from "@/components/editor/MobileShell";
import { useScreen } from "@/lib/breakpoint";
import { useLayout } from "@/lib/layout";
import { PlaybackProvider } from "@/lib/playback";
import { useShortcuts } from "@/lib/shortcuts";
import {
  EditorStoreProvider,
  useEditorStore,
  useEditorStoreApi,
  type LoadedProjectInput,
} from "@/lib/store";

/**
 * Editor ka dhaancha: TopBar / LeftSidebar / Preview / RightSidebar / Timeline.
 *
 * Store provider **bahar** hai aur shell andar — isliye jab shell ka pehla render
 * hota hai tab store me doc pehle se maujood hota hai. Isi wajah se kisi child ko
 * `doc === null` ka rasta nahi sambhalna padta, aur server ka HTML bhi poora
 * nikalta hai (module-level store ke saath ye sach me toota tha — dekho store.tsx).
 */
export function Editor({ project }: { project: LoadedProjectInput }) {
  return (
    <EditorStoreProvider project={project}>
      {/*
       * Playback provider store ke **andar** hai: uske commands (step, jump)
       * doc ka fps aur duration padhte hain, aur playhead store me hi likhte hain.
       * Bahar rakhne par usko doc alag se dena padta — do jagah ek hi sach.
       */}
      <PlaybackProvider>
        <EditorShell />
      </PlaybackProvider>
    </EditorStoreProvider>
  );
}

function EditorShell() {
  const store = useEditorStoreApi();
  const opError = useEditorStore((state) => state.opError);
  const clearOpError = useEditorStore((state) => state.clearOpError);
  const mode = useEditorStore((state) => state.mode);

  useShortcuts();
  const { layout, setPanel } = useLayout();

  /*
   * Editor band ho raha hai — pending edit **abhi save karo**.
   *
   * ⚠️ Yahan pehle `dispose()` tha aur wo ek asli, chupchaap chalne wala bug tha:
   * React StrictMode dev me har effect ko mount → cleanup → mount chalata hai,
   * isliye cleanup mount ke turant baad chal jaata tha, scheduler mar jaata tha,
   * aur uske baad har edit par screen "Saved" dikhati thi jabki DB me kuch nahi
   * jaata tha. Browser me chalakar hi ye pakda gaya. Ab do deewaarein hain: yahan
   * flush, aur store me mara hua scheduler dobara khada ho jaata hai.
   */
  useEffect(() => () => void store.getState().saveNow(), [store]);

  /*
   * Tab band karne se pehle chetavni — sirf tab jab sach me kuch bacha ho.
   * Browser apna hi text dikhata hai; `preventDefault` hi wo signal hai.
   */
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!store.getState().hasUnsavedWork()) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [store]);

  /*
   * Chhoti screen ka apna shell.
   *
   * ⚠️ Ye faisla yahan, sabse upar hota hai — CSS ke breakpoints se neeche nahi.
   * `hidden md:flex` se dono layout ek saath render hote: do preview player, do
   * timeline, dono ke apne effects aur listeners. Player do baar chalna sirf
   * bhaari nahi, galat bhi hai (do audio, do playhead). Isliye ek waqt me ek hi
   * shell tree me rehta hai.
   *
   * ⚠️ Banner (conflict, draft recovery, op error) dono shell ke bahar hain —
   * wo har naap par ek jaise chahiye, aur unhe do jagah likhna matlab ek din
   * phone par conflict ka banner aana band ho jaana, jo kisi ko dikhta bhi nahi.
   */
  const screen = useScreen();

  if (screen !== "desktop") {
    return (
      <div className="flex h-[100dvh] flex-col overflow-hidden">
        <ConflictBanner />
        <DraftRecovery />
        <ShortcutsDialog />
        {opError ? <OpError message={opError} onClear={clearOpError} /> : null}
        <div className="min-h-0 flex-1">
          <MobileShell screen={screen} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar />
      <ConflictBanner />
      {/* Crash/offline ke baad bacha hua kaam (16.14). */}
      <DraftRecovery />
      {/* `?` se khulta hai — list registry se banti hai, haath se nahi (16.6). */}
      <ShortcutsDialog />

      {opError ? <OpError message={opError} onClear={clearOpError} /> : null}

      <div className="flex min-h-0 flex-1">
        <div style={{ width: layout.left }} className="min-h-0 shrink-0">
          <LeftSidebar />
        </div>
        <ResizeHandle
          orientation="vertical"
          label="Left panel resize"
          onDelta={(delta) => setPanel("left", layout.left + delta)}
        />

        {/*
          * Beginner aur Advanced ek hi doc par chalte hain — koi conversion nahi
          * (12.9). Preview dono me rehta hai, isliye beginner ko timeline
          * kholne ki zaroorat hi nahi padti (12.10).
          */}
        <div className="flex min-w-0 flex-1 flex-col">
          <PreviewStage />
          {mode === "beginner" ? (
            <>
              <ResizeHandle
                orientation="horizontal"
                label="Scene cards resize"
                onDelta={(delta) => setPanel("timeline", layout.timeline - delta)}
              />
              <div style={{ height: layout.timeline }} className="min-h-0 shrink-0 overflow-auto bg-ink-900">
                <SceneCards />
              </div>
            </>
          ) : (
            <>
              <ResizeHandle
                orientation="horizontal"
                label="Timeline resize"
                // Timeline neeche hai, isliye upar kheenchne (delta negative) par badi hoti hai.
                onDelta={(delta) => setPanel("timeline", layout.timeline - delta)}
              />
              <div style={{ height: layout.timeline }} className="min-h-0 shrink-0">
                <TimelineView />
              </div>
            </>
          )}
        </div>

        <ResizeHandle
          orientation="vertical"
          label="Right panel resize"
          onDelta={(delta) => setPanel("right", layout.right - delta)}
        />
        <div style={{ width: layout.right }} className="min-h-0 shrink-0">
          <RightSidebar />
        </div>
      </div>
    </div>
  );
}

/**
 * Op fail hone par upar aane wali patti.
 *
 * Alag component isliye ki ye desktop aur mobile dono shell me chahiye — aur ek
 * hi jagah rehne se wo dono par hamesha ek jaisi rehti hai.
 */
function OpError({ message, onClear }: { message: string; onClear: () => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-red-500/40 bg-red-500/10 px-4 py-1.5 text-sm text-red-300">
      <span className="flex-1">{message}</span>
      <button type="button" onClick={onClear} className="text-xs underline">
        theek hai
      </button>
    </div>
  );
}
