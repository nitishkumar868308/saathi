"use client";

import { useEffect } from "react";

import { ConflictBanner } from "@/components/editor/ConflictBanner";
import { LeftSidebar } from "@/components/editor/LeftSidebar";
import { PreviewStage } from "@/components/editor/PreviewStage";
import { ResizeHandle } from "@/components/editor/ResizeHandle";
import { RightSidebar } from "@/components/editor/RightSidebar";
import { TimelineView } from "@/components/editor/timeline/TimelineView";
import { TopBar } from "@/components/editor/TopBar";
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

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar />
      <ConflictBanner />

      {opError ? (
        <div className="flex items-center gap-3 border-b border-red-500/40 bg-red-500/10 px-4 py-1.5 text-sm text-red-300">
          <span className="flex-1">{opError}</span>
          <button type="button" onClick={clearOpError} className="text-xs underline">
            theek hai
          </button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1">
        <div style={{ width: layout.left }} className="min-h-0 shrink-0">
          <LeftSidebar />
        </div>
        <ResizeHandle
          orientation="vertical"
          label="Left panel resize"
          onDelta={(delta) => setPanel("left", layout.left + delta)}
        />

        <div className="flex min-w-0 flex-1 flex-col">
          <PreviewStage />
          <ResizeHandle
            orientation="horizontal"
            label="Timeline resize"
            // Timeline neeche hai, isliye upar kheenchne (delta negative) par badi hoti hai.
            onDelta={(delta) => setPanel("timeline", layout.timeline - delta)}
          />
          <div style={{ height: layout.timeline }} className="min-h-0 shrink-0">
            <TimelineView />
          </div>
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
