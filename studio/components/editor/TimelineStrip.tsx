"use client";

import { framesToTimecode, requireTrackType } from "@reel/core";

import { ScrubBar } from "@/components/editor/preview/ScrubBar";
import { useEditorStore } from "@/lib/store";

/**
 * Neeche ki timeline — tracks ki list + playhead ka scrub.
 *
 * Asli ruler, clips, zoom aur drag Phase 7 me aayenge. Jo aaj yahan hai wo asli
 * doc se hai (banaya hua nahi): jitne tracks doc me hain utne hi dikhte hain,
 * unke naam aur icon TRACK_TYPES registry se aate hain. Fixed 7 tracks kahin
 * hardcode nahi (Dynamic rule 5).
 *
 * Scrub bar Phase 6 me isliye aayi ki checklist 6.7 ki maang hai: **preview ka
 * drag aur timeline ka drag ek hi frame par jaayein**. Dono wahi `<ScrubBar>`
 * hain aur dono `setPlayhead` likhte hain — do jagah ka playhead alag ho hi
 * nahi sakta (6.6). Phase 7 isko asli ruler se badlega, par vyavhaar wahi rahega.
 */
export function TimelineStrip() {
  const doc = useEditorStore((state) => state.doc);
  const playheadFrame = useEditorStore((state) => state.playheadFrame);
  const setPlayhead = useEditorStore((state) => state.setPlayhead);

  const tracks = [...doc.tracks].sort((a, b) => a.order - b.order);
  const { fps, durationInFrames } = doc.project;
  const last = Math.max(1, durationInFrames - 1);

  return (
    <section className="flex h-full min-h-0 flex-col bg-ink-900">
      <div className="flex shrink-0 items-center justify-between border-b border-ink-600 px-3 py-1.5">
        <span className="text-xs uppercase tracking-wide text-chalk-500">Timeline</span>
        <span className="font-mono text-[11px] text-chalk-500">
          {framesToTimecode(playheadFrame, fps, { compact: true })} · {tracks.length} track ·{" "}
          {doc.items.length} item · asli timeline Phase 7 me
        </span>
      </div>

      <div className="shrink-0 border-b border-ink-600 px-3 py-2">
        <ScrubBar
          frame={playheadFrame}
          durationInFrames={durationInFrames}
          onScrub={setPlayhead}
          height={10}
        />
      </div>

      <div className="relative min-h-0 flex-1 overflow-auto">
        {/*
         * Playhead ki lakeer tracks ke upar — sirf dikhane ke liye, isliye
         * `pointer-events-none`. Iske bina ye lakeer hi har click kha jaati aur
         * neeche ke track select karna namumkin ho jaata.
         */}
        <div
          className="pointer-events-none absolute inset-y-0 z-10 w-px bg-terracotta"
          style={{ left: `calc(${(Math.min(playheadFrame, last) / last) * 100}% )` }}
        />

        <ul className="divide-y divide-ink-800">
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
      </div>
    </section>
  );
}
