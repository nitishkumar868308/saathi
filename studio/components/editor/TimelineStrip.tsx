"use client";

import { requireTrackType } from "@reel/core";

import { useEditorStore } from "@/lib/store";

/**
 * Neeche ki timeline — abhi sirf tracks ki list.
 *
 * Ruler, clips, zoom aur drag Phase 7 me aayenge. Jo aaj yahan hai wo asli doc se
 * hai (banaya hua nahi): jitne tracks doc me hain utne hi dikhte hain, unke naam
 * aur icon TRACK_TYPES registry se aate hain. Fixed 7 tracks kahin hardcode nahi
 * (Dynamic rule 5).
 */
export function TimelineStrip() {
  const doc = useEditorStore((state) => state.doc);

  const tracks = [...doc.tracks].sort((a, b) => a.order - b.order);

  return (
    <section className="flex h-full min-h-0 flex-col bg-ink-900">
      <div className="flex shrink-0 items-center justify-between border-b border-ink-600 px-3 py-1.5">
        <span className="text-xs uppercase tracking-wide text-chalk-500">Timeline</span>
        <span className="text-[11px] text-chalk-500">
          {tracks.length} track · {doc.items.length} item · asli timeline Phase 7 me
        </span>
      </div>

      <ul className="min-h-0 flex-1 divide-y divide-ink-800 overflow-auto">
        {tracks.map((track) => {
          const type = requireTrackType(track.type);
          const items = doc.items.filter((item) => item.trackId === track.id);
          return (
            <li
              key={track.id}
              className="flex items-center gap-3 px-3"
              style={{ height: type.defaultHeight }}
            >
              <span className="w-32 shrink-0 truncate text-sm text-chalk-300">{track.name}</span>
              <span className="rounded bg-ink-700 px-1.5 py-0.5 text-[10px] uppercase text-chalk-500">
                {type.label}
              </span>
              <span className="flex-1 rounded border border-dashed border-ink-600 px-2 py-1 text-[11px] text-chalk-500">
                {items.length === 0 ? "khaali" : `${items.length} item`}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
