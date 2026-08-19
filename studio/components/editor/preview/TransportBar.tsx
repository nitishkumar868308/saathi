"use client";

import { framesToTimecode, guidesForSize } from "@reel/core";
import clsx from "clsx";
import {
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Grid2x2,
  Pause,
  Play,
  Repeat,
  Volume2,
  VolumeX,
} from "lucide-react";

import { ScrubBar } from "@/components/editor/preview/ScrubBar";
import { IconButton } from "@/components/ui/Button";
import { usePlayback } from "@/lib/playback";
import { ZOOM_LEVELS, effectiveGuideId } from "@/lib/preview";
import { SHORTCUTS, comboLabel } from "@/lib/shortcuts";
import { useEditorStore } from "@/lib/store";

/**
 * Transport — play/pause, frame step, jump, loop, volume, zoom, guides.
 *
 * Har button ka `title` uske shortcut ke saath aata hai, aur wo shortcut **usi
 * registry se** padha jaata hai jo keyboard chalati hai. Haath se "Space" likh
 * dene par ek din shortcut badal jaata aur tooltip jhooth bolne lagta.
 *
 * ⚠️ Yahan koi button playhead ko apne paas nahi rakhta — sab `playback` ke
 * command bulate hain, jo store ka `playheadFrame` badalte hain (6.6).
 */
function shortcutLabel(id: string): string {
  const entry = SHORTCUTS.find((shortcut) => shortcut.id === id);
  return entry ? ` (${comboLabel(entry.keys)})` : "";
}

export function TransportBar() {
  const doc = useEditorStore((state) => state.doc);
  const playheadFrame = useEditorStore((state) => state.playheadFrame);
  const setPlayhead = useEditorStore((state) => state.setPlayhead);
  const playback = usePlayback();

  const { fps, durationInFrames, width, height } = doc.project;
  const guides = guidesForSize(width, height);
  // Project ka size badal chuka ho to purani guide yahan chup-chaap nahi rehti —
  // select wahi dikhata hai jo is frame par sach me lagu hoti hai.
  const guideId = effectiveGuideId(width, height, playback.guideId) ?? "";

  return (
    <div className="shrink-0 border-t border-ink-600 bg-ink-900">
      {playback.stutter ? (
        /*
         * Ye hint tabhi aata hai jab playback sach me naap kar dheemi mili hai
         * (`createStutterWatch`) — "3 se zyada video hain" jaise andaaze par nahi.
         */
        <div className="flex items-center gap-2 border-b border-amber/30 bg-amber/10 px-3 py-1 text-[11px] text-amber">
          <span className="flex-1">
            Preview hakla rahi hai — asli{" "}
            {playback.measuredFps === null ? "?" : playback.measuredFps.toFixed(1)} fps, chahiye{" "}
            {fps}. Ye sirf preview ki baat hai; final render par koi asar nahi.
          </span>
          <button
            type="button"
            onClick={() => playback.setDraft(!playback.draft)}
            className="underline"
          >
            {playback.draft ? "Draft band karo" : "Draft quality on karo"}
          </button>
        </div>
      ) : null}

      <div className="px-3 pt-2">
        <ScrubBar
          frame={playheadFrame}
          durationInFrames={durationInFrames}
          onScrub={setPlayhead}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <IconButton
          onClick={playback.toggle}
          title={`${playback.isPlaying ? "Pause" : "Play"}${shortcutLabel("play-pause")}`}
          aria-label={playback.isPlaying ? "Pause" : "Play"}
          variant={playback.isPlaying ? "primary" : "ghost"}
        >
          {playback.isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </IconButton>

        <div className="flex items-center gap-0.5">
          <IconButton
            onClick={playback.toStart}
            title={`Shuruaat me${shortcutLabel("to-start")}`}
            aria-label="Shuruaat me"
          >
            <ChevronFirst size={14} />
          </IconButton>
          <IconButton
            onClick={() => playback.stepFrames(-1)}
            title={`Ek frame peeche${shortcutLabel("frame-back")}`}
            aria-label="Ek frame peeche"
          >
            <ChevronLeft size={14} />
          </IconButton>
          <IconButton
            onClick={() => playback.stepFrames(1)}
            title={`Ek frame aage${shortcutLabel("frame-forward")}`}
            aria-label="Ek frame aage"
          >
            <ChevronRight size={14} />
          </IconButton>
          <IconButton
            onClick={playback.toEnd}
            title={`Ant me${shortcutLabel("to-end")}`}
            aria-label="Ant me"
          >
            <ChevronLast size={14} />
          </IconButton>
        </div>

        {/* Timecode (6.5) — dono hisse fps se bante hain, `framesToTimecode` se. */}
        <span className="font-mono text-xs text-chalk-300">
          {framesToTimecode(playheadFrame, fps)}
        </span>
        <span className="font-mono text-[11px] text-chalk-500">
          / {framesToTimecode(durationInFrames, fps)} · frame {playheadFrame}/{durationInFrames}
        </span>

        <span className="flex-1" />

        <IconButton
          onClick={() => playback.setLoop(!playback.loop)}
          title={playback.loop ? "Loop chalu hai" : "Loop band hai"}
          aria-label="Loop"
          variant={playback.loop ? "primary" : "ghost"}
        >
          <Repeat size={14} />
        </IconButton>

        <div className="flex items-center gap-1">
          <IconButton
            onClick={() => playback.setMuted(!playback.muted)}
            title={playback.muted ? "Awaaz on karo" : "Mute"}
            aria-label="Mute"
            variant={playback.muted ? "primary" : "ghost"}
          >
            {playback.muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
          </IconButton>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={playback.muted ? 0 : playback.volume}
            onChange={(event) => playback.setVolume(Number(event.target.value))}
            title={`Volume ${Math.round(playback.volume * 100)}%`}
            aria-label="Volume"
            className="h-1 w-20 accent-terracotta"
          />
        </div>

        {/* Guides (6.10) — kaunsi guides milengi wo project ke naap se tay hota hai. */}
        <div className="flex items-center gap-1">
          <IconButton
            onClick={() => playback.setGuidesOn(!playback.guidesOn)}
            title={playback.guidesOn ? "Guides band karo" : "Safe-area guides dikhao"}
            aria-label="Guides"
            variant={playback.guidesOn ? "primary" : "ghost"}
          >
            <Grid2x2 size={14} />
          </IconButton>
          {playback.guidesOn ? (
            <select
              value={guideId}
              onChange={(event) => playback.setGuideId(event.target.value)}
              title="Kaunsi safe area"
              className="rounded-md border border-ink-600 bg-ink-900 px-1 py-1 text-[11px] outline-none"
            >
              {guides.map((guide) => (
                <option key={guide.id} value={guide.id} title={guide.hint}>
                  {guide.label}
                </option>
              ))}
            </select>
          ) : null}
        </div>

        {/* Zoom (6.3) — koi pixel naap nahi, sirf project ke aspect par scale. */}
        <div className="flex items-center rounded-md border border-ink-600">
          {ZOOM_LEVELS.map((level) => (
            <button
              key={level.id}
              type="button"
              onClick={() => playback.setZoomId(level.id)}
              title={level.hint}
              className={clsx(
                "px-2 py-1 text-[11px] transition-colors first:rounded-l-md last:rounded-r-md",
                level.id === playback.zoomId
                  ? "bg-terracotta/20 text-chalk-100"
                  : "text-chalk-500 hover:bg-ink-700",
              )}
            >
              {level.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => playback.setDraft(!playback.draft)}
          title="Preview ko aadhe naap par banao — raster ka kaam ghatta hai. Final render par koi asar nahi."
          className={clsx(
            "rounded-md border px-2 py-1 text-[11px] transition-colors",
            playback.draft
              ? "border-amber/50 bg-amber/15 text-amber"
              : "border-ink-600 text-chalk-500 hover:bg-ink-700",
          )}
        >
          Draft
        </button>
      </div>
    </div>
  );
}
