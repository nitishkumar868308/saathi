"use client";

import { useEditorStore } from "@/lib/store";

/**
 * Daayan sidebar — properties ka ghar.
 *
 * Abhi yahan sirf ye likha hai ki kya select hai. Asli panel Phase 9 me banega
 * aur wo **registry ke `controls` descriptor se generate** hoga — kisi type ke
 * liye haath se panel likhna mana hai (Dynamic rule 2). Isliye yahan aaj koi
 * "temporary" control nahi rakha gaya: wo baad me hataana hi padta.
 */
export function RightSidebar() {
  const selection = useEditorStore((state) => state.selection);
  const doc = useEditorStore((state) => state.doc);
  const count = selection.itemIds.length;

  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-ink-600 bg-ink-800">
      <div className="shrink-0 border-b border-ink-600 px-3 py-2 text-xs uppercase tracking-wide text-chalk-500">
        Properties
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3 text-sm text-chalk-500">
        {count === 0 ? (
          <p>
            Kuch select nahi hai.
            <span className="mt-2 block text-xs">
              Items Phase 5 (assets) se aayenge, aur properties panel Phase 9 me registry ke
              controls se apne aap banega.
            </span>
          </p>
        ) : (
          <p>
            {count} item select hai ({doc.items.length} me se). Controls Phase 9 me.
          </p>
        )}
      </div>
    </aside>
  );
}
