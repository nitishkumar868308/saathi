"use client";

import clsx from "clsx";
import {
  ArrowLeft,
  Download,
  LayoutGrid,
  ListVideo,
  Play,
  Redo2,
  SlidersHorizontal,
  Undo2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { ExportDialog } from "@/components/editor/ExportDialog";
import { LEFT_PANELS, findPanel } from "@/components/editor/panels";
import { PreviewStage } from "@/components/editor/PreviewStage";
import { PropertiesPanel } from "@/components/editor/properties/PropertiesPanel";
import { SaveStatus } from "@/components/editor/SaveStatus";
import { SceneCards } from "@/components/editor/scenes/SceneCards";
import { TimelineView } from "@/components/editor/timeline/TimelineView";
import { useEditorStore } from "@/lib/store";
import type { Screen } from "@/lib/breakpoint";

/**
 * Phone aur tablet ka editor.
 *
 * ⚠️ Desktop wala teen-column layout yahan **chhota karke** nahi daala gaya, aur
 * yahi is file ka poora point hai. 390px me media + preview + properties +
 * timeline ek saath ghusane par chaaron itne patle ho jaate hain ki koi bhi
 * kaam ka nahi rehta — naap ke hisaab se wo "dikh raha hai", istemaal ke hisaab
 * se toota hua hai. Isliye chhoti screen par **ek waqt me ek hi pane** poori
 * jagah leta hai, aur neeche ki patti se pane badalta hai.
 *
 * ⚠️ Store wahi hai jo desktop ka hai — `leftPanelId`, `mode`, `selection` sab
 * wahin se aate hain. Mobile ke liye alag state rakhne par ek din phone par
 * kuch chuna hua hota aur desktop par kuch aur, aur wo farak samajh hi nahi
 * aata. Sirf "kaun sa pane khula hai" yahan ka apna hai, kyunki wo sawaal
 * desktop me hota hi nahi.
 *
 * ⚠️ Tablet par preview **hamesha upar rehta hai**. Phone par jagah hai hi nahi,
 * par 768px+ par preview chhupa dena ulta padta hai: reel banate waqt har badlav
 * ka jawab preview hi hai, aur use dekhne ke liye baar-baar tab badalna padta.
 */

type Pane = "preview" | "edit" | "properties" | "tools";

interface PaneDef {
  id: Pane;
  label: string;
  icon: typeof Play;
}

export function MobileShell({ screen }: { screen: Screen }) {
  const mode = useEditorStore((state) => state.mode);
  const setMode = useEditorStore((state) => state.setMode);
  const selectedCount = useEditorStore((state) => state.selection.itemIds.length);
  const leftPanelId = useEditorStore((state) => state.leftPanelId);
  const setLeftPanel = useEditorStore((state) => state.setLeftPanel);

  const isPhone = screen === "phone";
  // Tablet par preview upar chipka rehta hai, isliye neeche uska tab nahi hota.
  const [pane, setPane] = useState<Pane>(isPhone ? "preview" : "edit");

  useEffect(() => {
    // Ghumane par (portrait ↔ landscape) naap badal jaata hai. Tablet par
    // "preview" pane ka koi matlab nahi — wo upar pehle se hai.
    if (!isPhone && pane === "preview") setPane("edit");
  }, [isPhone, pane]);

  const panes: PaneDef[] = [
    ...(isPhone ? [{ id: "preview" as const, label: "Preview", icon: Play }] : []),
    {
      id: "edit",
      label: mode === "beginner" ? "Scenes" : "Timeline",
      icon: ListVideo,
    },
    { id: "properties", label: "Controls", icon: SlidersHorizontal },
    { id: "tools", label: "Tools", icon: LayoutGrid },
  ];

  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-ink-900">
      <MobileTopBar />

      {/* Tablet: preview upar chipka hua, neeche badalne wala pane. */}
      {!isPhone && (
        <div className="flex min-h-0 flex-[1.1] flex-col border-b border-ink-600">
          <PreviewStage />
        </div>
      )}

      {/*
        ⚠️ `flex flex-col` — yahi wo cheez hai jiske bina poora pane ghut jaata
        hai. Andar ke saare pane `flex-1` par khade hain, aur `flex-1` sirf tab
        chalta hai jab uska maa-baap khud flex ho. Bina iske PreviewStage apni
        content jitni oonchai le leta tha — naapa hua: player ka dabba 34px ka
        rah gaya tha, aur uske andar 1080x1920 ka player bahar nikal jaata tha.
      */}
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {pane === "preview" && <PreviewStage />}

        {pane === "edit" && (
          <div className="flex h-full min-h-0 flex-col">
            {/* Scenes ↔ Timeline — chhoti screen par TopBar me jagah nahi bachti. */}
            <div className="flex shrink-0 gap-1 border-b border-ink-600 bg-ink-800 p-2">
              {(["beginner", "advanced"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={clsx(
                    "min-h-[44px] flex-1 rounded-lg px-3 text-sm font-medium transition-colors",
                    value === mode
                      ? "bg-terracotta/20 text-chalk-100"
                      : "text-chalk-500 hover:bg-ink-700",
                  )}
                >
                  {value === "beginner" ? "Scenes — aasan" : "Timeline — poora control"}
                </button>
              ))}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              {mode === "beginner" ? <SceneCards /> : <TimelineView />}
            </div>
          </div>
        )}

        {pane === "properties" && (
          <div className="flex h-full min-h-0 flex-col">
            <div className="flex min-h-[44px] shrink-0 items-center justify-between border-b border-ink-600 bg-ink-800 px-3">
              <span className="text-xs uppercase tracking-wide text-chalk-500">Controls</span>
              {selectedCount > 1 ? (
                <span className="rounded bg-ink-700 px-2 py-1 text-[11px] text-chalk-500">
                  {selectedCount} chune hue
                </span>
              ) : null}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <PropertiesPanel />
            </div>
          </div>
        )}

        {pane === "tools" && (
          <div className="flex h-full min-h-0 flex-col">
            {/*
             * Gyarah panel hain — phone par wo ek patti me nahi aate. Isliye
             * patti khud khiskati hai. Chhota karke thoons dene par har tab ka
             * naam kat jaata aur icon se hi pehchanna padta.
             */}
            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-ink-600 bg-ink-800 p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {LEFT_PANELS.map((panel) => {
                const Icon = panel.icon;
                const selected = panel.id === leftPanelId;
                return (
                  <button
                    key={panel.id}
                    type="button"
                    onClick={() => setLeftPanel(panel.id)}
                    className={clsx(
                      "inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-lg px-3 text-sm transition-colors",
                      selected
                        ? "bg-terracotta/20 text-chalk-100"
                        : "text-chalk-500 hover:bg-ink-700",
                    )}
                  >
                    <Icon size={16} />
                    {panel.label}
                  </button>
                );
              })}
            </div>
            <div className="min-h-0 flex-1 overflow-auto">
              <ActivePanel />
            </div>
          </div>
        )}
      </main>

      {/*
        Neeche ki patti — ungli ka natural ghar.
        ⚠️ Upar rakhne par phone par usko chhuna hi mushkil hota hai; iOS/Android
        dono apne app ke tabs neeche hi rakhte hain aur user ka haath wahi
        pehunchta hai. `pb-[env(safe-area-inset-bottom)]` iPhone ke home bar ke
        neeche button chale jaane se bachata hai.
      */}
      <nav className="flex shrink-0 border-t border-ink-600 bg-ink-800 pb-[env(safe-area-inset-bottom)]">
        {panes.map((entry) => {
          const Icon = entry.icon;
          const selected = pane === entry.id;
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => setPane(entry.id)}
              aria-current={selected ? "page" : undefined}
              className={clsx(
                "relative flex min-h-[56px] flex-1 flex-col items-center justify-center gap-1 text-[11px] transition-colors",
                selected ? "text-terracotta" : "text-chalk-500",
              )}
            >
              <Icon size={20} />
              {entry.label}
              {/*
                Chuna hua item hai par Controls khula nahi — phone par ye sabse
                aam uljhan hai: user clip chunta hai aur uske baad "ab kya?"
                wahin ruk jaata hai. Ye nishaan agla kadam khud dikha deta hai.
              */}
              {entry.id === "properties" && selectedCount > 0 && !selected ? (
                <span className="absolute right-1/4 top-2 h-2 w-2 rounded-full bg-terracotta" />
              ) : null}
              {selected ? (
                <span className="absolute inset-x-4 top-0 h-0.5 rounded-b bg-terracotta" />
              ) : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function ActivePanel() {
  const leftPanelId = useEditorStore((state) => state.leftPanelId);
  const Panel = findPanel(leftPanelId).component;
  return <Panel />;
}

/**
 * Chhoti screen ki upari patti.
 *
 * ⚠️ Desktop wali `TopBar` yahan reuse **nahi** hoti. Usme naam ka input, mode
 * toggle, undo/redo, save status aur Export — sab ek hi line me hain, aur 390px
 * par wo line 480px lambi ho jaati hai (naapi gayi). Yahan sirf wahi hai jo
 * chalte-firte sach me chahiye; naam badalna Tools → Project me hai, jahan uske
 * liye poori jagah hai.
 */
function MobileTopBar() {
  const doc = useEditorStore((state) => state.doc);
  const undo = useEditorStore((state) => state.undo);
  const redo = useEditorStore((state) => state.redo);
  const canUndo = useEditorStore((state) => state.canUndo);
  const canRedo = useEditorStore((state) => state.canRedo);
  const setLeftPanel = useEditorStore((state) => state.setLeftPanel);
  const [exportOpen, setExportOpen] = useState(false);

  return (
    <header className="flex min-h-[52px] shrink-0 items-center gap-1 border-b border-ink-600 bg-ink-800 px-2">
      <Link
        href="/"
        aria-label="Project list"
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-chalk-300 hover:bg-ink-700"
      >
        <ArrowLeft size={18} />
      </Link>

      <span className="min-w-0 flex-1 truncate px-1 text-sm text-chalk-100">
        {doc.project.name}
      </span>

      <SaveStatus />

      <button
        type="button"
        onClick={undo}
        disabled={!canUndo}
        aria-label="Undo"
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-chalk-300 hover:bg-ink-700 disabled:opacity-30"
      >
        <Undo2 size={18} />
      </button>
      <button
        type="button"
        onClick={redo}
        disabled={!canRedo}
        aria-label="Redo"
        className="inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg text-chalk-300 hover:bg-ink-700 disabled:opacity-30"
      >
        <Redo2 size={18} />
      </button>
      <button
        type="button"
        onClick={() => setExportOpen(true)}
        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-terracotta px-3 text-sm font-medium text-white"
      >
        <Download size={16} />
        Export
      </button>

      <ExportDialog
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        onStarted={() => setLeftPanel("renders")}
      />
    </header>
  );
}
