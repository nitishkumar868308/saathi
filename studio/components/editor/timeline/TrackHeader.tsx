"use client";

import { requireTrackType, type Track } from "@reel/core";
import clsx from "clsx";
import { Eye, EyeOff, Lock, LockOpen, Volume2, VolumeX } from "lucide-react";

import { Icon } from "@/components/ui/Icon";
import { useEditorStore } from "@/lib/store";
import { MIN_TRACK_HEIGHT, clampTrackHeight } from "@/lib/timeline";

/**
 * Ek track ka header — naam, type icon, mute/hide/lock, aur oonchai ka handle.
 *
 * ⚠️ Teeno toggle **op se** chalte hain (`setTrackProperty`), seedha
 * `track.muted = true` se nahi. Mute ek chhoti si cheez lagti hai par uska
 * Ctrl+Z utna hi zaroori hai jitna clip sarkane ka — aur bina op ke wo wapas
 * aata hi nahi (Dynamic rule 12).
 *
 * Icon `TRACK_TYPES` registry ke `icon` naam se aata hai, yahan koi switch nahi.
 */
export function TrackHeader({ track, height }: { track: Track; height: number }) {
  const applyOp = useEditorStore((state) => state.applyOp);
  const setTrackHeight = useEditorStore((state) => state.setTrackHeight);
  const type = requireTrackType(track.type);

  function toggle(path: "muted" | "hidden" | "locked", value: boolean) {
    applyOp(
      "setTrackProperty",
      { trackId: track.id, path, value },
      { label: `${track.name}: ${path}` },
    );
  }

  return (
    <div
      className="relative flex items-center gap-1.5 border-b border-ink-800 bg-ink-900 px-2"
      style={{ height }}
    >
      <span
        className="h-6 w-1 shrink-0 rounded"
        // Rang registry se — naya track type jodne par yahan kuch nahi badalta.
        style={{ backgroundColor: type.color }}
      />
      <Icon name={type.icon} size={12} className="shrink-0 text-chalk-500" />

      <span className="min-w-0 flex-1 truncate text-xs text-chalk-300" title={track.name}>
        {track.name}
      </span>

      <div className="flex shrink-0 items-center gap-0.5">
        <HeaderToggle
          on={track.muted}
          onIcon={<VolumeX size={11} />}
          offIcon={<Volume2 size={11} />}
          title={track.muted ? "Awaaz on karo" : "Mute"}
          // Audio na dene wale track par mute ka koi matlab nahi — aur jo button
          // kuch nahi karta wo toota hua button hai (README rule 5).
          hidden={type.kind !== "audio" && !type.accepts.includes("video")}
          onClick={() => toggle("muted", !track.muted)}
        />
        <HeaderToggle
          on={track.hidden}
          onIcon={<EyeOff size={11} />}
          offIcon={<Eye size={11} />}
          title={track.hidden ? "Dikhao" : "Chhupao"}
          hidden={type.kind === "audio"}
          onClick={() => toggle("hidden", !track.hidden)}
        />
        <HeaderToggle
          on={track.locked}
          onIcon={<Lock size={11} />}
          offIcon={<LockOpen size={11} />}
          title={track.locked ? "Unlock" : "Lock"}
          onClick={() => toggle("locked", !track.locked)}
        />
      </div>

      {/*
       * Oonchai ka handle. Yahan `setPointerCapture` isliye chahiye ki tez
       * kheenchne par pointer header se bahar nikal jaata hai aur uske bina drag
       * wahin chhoot jaata — wo har baar hota hai, kabhi-kabhi nahi.
       */}
      <div
        role="separator"
        aria-label={`${track.name} ki oonchai`}
        className="absolute inset-x-0 bottom-0 h-1.5 cursor-row-resize hover:bg-terracotta/40"
        onPointerDown={(event) => {
          event.preventDefault();
          const element = event.currentTarget;
          element.setPointerCapture(event.pointerId);
          const startY = event.clientY;
          const startHeight = height;

          function onMove(move: PointerEvent) {
            setTrackHeight(track.id, clampTrackHeight(startHeight + (move.clientY - startY)));
          }
          function onUp() {
            element.removeEventListener("pointermove", onMove);
            element.removeEventListener("pointerup", onUp);
          }
          element.addEventListener("pointermove", onMove);
          element.addEventListener("pointerup", onUp);
        }}
        onDoubleClick={() => setTrackHeight(track.id, MIN_TRACK_HEIGHT)}
      />
    </div>
  );
}

function HeaderToggle({
  on,
  onIcon,
  offIcon,
  title,
  hidden,
  onClick,
}: {
  on: boolean;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
  title: string;
  hidden?: boolean;
  onClick(): void;
}) {
  if (hidden) return null;
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={on}
      onClick={onClick}
      className={clsx(
        "flex h-5 w-5 items-center justify-center rounded transition-colors",
        on ? "bg-terracotta/25 text-amber" : "text-chalk-500 hover:bg-ink-700",
      )}
    >
      {on ? onIcon : offIcon}
    </button>
  );
}
