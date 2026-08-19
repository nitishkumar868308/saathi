"use client";

import { PropertiesPanel } from "@/components/editor/properties/PropertiesPanel";
import { useEditorStore } from "@/lib/store";

/**
 * Daayan sidebar — properties ka ghar.
 *
 * Yahan ab bas ek dabba hai; asli panel `PropertiesPanel` me hai aur wo **poora
 * registry ke `controls` descriptor se generate** hota hai (Dynamic rule 2).
 * Kisi item type ka naam is poore raaste me kahin likha nahi hai.
 */
export function RightSidebar() {
  const count = useEditorStore((state) => state.selection.itemIds.length);

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-ink-600 bg-ink-800">
      <div className="flex shrink-0 items-center justify-between border-b border-ink-600 px-3 py-2">
        <span className="text-xs uppercase tracking-wide text-chalk-500">Properties</span>
        {count > 1 ? (
          <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] text-chalk-500">
            {count} chune hue
          </span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <PropertiesPanel />
      </div>
    </aside>
  );
}
