"use client";

import { aspectRatioLabel, framesToTimecode } from "@reel/core";

import { useEditorStore } from "@/lib/store";

/**
 * Beech ka canvas — abhi khaali frame.
 *
 * Asli player Phase 6 me `@remotion/player` se aayega, aur wahi component render
 * ke waqt bhi chalega (Section E #4 — preview aur render me farak nahi hona
 * chahiye). Isliye yahan koi apna "chhota preview" nahi banaya gaya: wo do alag
 * dimaag ban jaate hain aur framing me farak hamesha aakhir me pakda jaata hai.
 *
 * Frame ka naap project se aata hai — 1080/1920 kahin likha nahi hai.
 */
export function PreviewStage() {
  const doc = useEditorStore((state) => state.doc);
  const playheadFrame = useEditorStore((state) => state.playheadFrame);

  const { width, height, fps, durationInFrames, background } = doc.project;

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-ink-950">
      <div className="flex min-h-0 flex-1 items-center justify-center p-6">
        <div
          className="relative max-h-full max-w-full border border-ink-600"
          style={{
            aspectRatio: `${width} / ${height}`,
            // Landscape chaudai se bandha hai, portrait oonchai se — warna bada
            // frame panel se bahar nikal jaata hai.
            ...(width >= height ? { width: "100%" } : { height: "100%" }),
            background,
          }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center">
            <span className="font-mono text-sm text-chalk-300">
              {width}×{height} · {aspectRatioLabel(width, height)} · {fps}fps
            </span>
            <span className="text-xs text-chalk-500">Player Phase 6 me</span>
          </div>
        </div>
      </div>

      <div className="flex h-8 shrink-0 items-center justify-center gap-3 border-t border-ink-600 bg-ink-900 font-mono text-[11px] text-chalk-500">
        <span>{framesToTimecode(playheadFrame, fps, { compact: true })}</span>
        <span className="text-ink-500">/</span>
        <span>{framesToTimecode(durationInFrames, fps, { compact: true })}</span>
      </div>
    </section>
  );
}
