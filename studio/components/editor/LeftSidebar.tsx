"use client";

import clsx from "clsx";

import { findPanel, LEFT_PANELS } from "@/components/editor/panels";
import { useEditorStore } from "@/lib/store";

/**
 * Baayan sidebar — tabs registry se bante hain (`panels/index.tsx`).
 *
 * Yahan koi tab ka naam likha hua nahi hai. Naya panel = registry me ek entry;
 * is file me kabhi kuch nahi badalta.
 */
export function LeftSidebar() {
  const activeId = useEditorStore((state) => state.leftPanelId);
  const setLeftPanel = useEditorStore((state) => state.setLeftPanel);
  const active = findPanel(activeId);
  const Panel = active.component;

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-ink-600 bg-ink-800">
      <nav className="flex shrink-0 border-b border-ink-600">
        {LEFT_PANELS.map((panel) => {
          const Icon = panel.icon;
          const selected = panel.id === active.id;
          return (
            <button
              key={panel.id}
              type="button"
              onClick={() => setLeftPanel(panel.id)}
              className={clsx(
                "flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs transition-colors",
                selected
                  ? "border-b-2 border-terracotta text-chalk-100"
                  : "border-b-2 border-transparent text-chalk-500 hover:text-chalk-300",
              )}
            >
              <Icon size={14} />
              {panel.label}
            </button>
          );
        })}
      </nav>
      <div className="min-h-0 flex-1 overflow-auto">
        <Panel />
      </div>
    </aside>
  );
}
