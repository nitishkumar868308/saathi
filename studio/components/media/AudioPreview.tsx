"use client";

import clsx from "clsx";
import { AlertTriangle, Loader2, Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useAssetUrl } from "@/lib/assetUrls";

/**
 * Awaaz sunne ka chhota player — media library, asset ka panel, aur TTS ke baad.
 *
 * ⚠️ Ye isliye bana ki **sunne ka koi raasta tha hi nahi**. TTS se awaaz ban
 * jaati thi, media me upload ho jaati thi, timeline par lag bhi jaati thi — par
 * use bajaakar dekhne ke liye poori reel preview karni padti thi. Aur jo cheez
 * sirf kaan se pakdi jaati hai (galat voice, galat raftaar, aadhi kati hui
 * recording), wo aankh se kabhi nahi dikhti.
 *
 * ⚠️ Ek waqt me **ek hi** awaaz bajti hai. Do player ek saath chalna sabse
 * chidhane wali cheez hoti hai, aur media library me 20 card ek saath hote hain.
 * Isliye jo naya chalta hai wo purane ko rok deta hai (`stopOthers`).
 */

/** Abhi jo baj raha hai — poore app me ek hi. */
let current: HTMLAudioElement | null = null;

function stopOthers(next: HTMLAudioElement | null): void {
  if (current && current !== next) {
    current.pause();
    current.currentTime = 0;
  }
  current = next;
}

export function AudioPreview({
  assetId,
  /** `bar` = library card par patli patti, `full` = panel me poora player. */
  variant = "bar",
  className,
}: {
  assetId: string | null;
  variant?: "bar" | "full";
  className?: string;
}) {
  const { url, error } = useAssetUrl(assetId);
  const ref = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [at, setAt] = useState(0);
  const [total, setTotal] = useState(0);

  // Asset badle to purani awaaz turant band — warna nayi clip chunne par purani
  // bajti rehti hai aur samajh nahi aata ki kaun si sunai de rahi hai.
  useEffect(() => {
    return () => {
      if (ref.current) {
        ref.current.pause();
        if (current === ref.current) current = null;
      }
    };
  }, [assetId]);

  if (!assetId) return null;

  if (error) {
    return (
      <p className={clsx("flex items-center gap-1 text-[10px] text-amber", className)}>
        <AlertTriangle size={10} />
        Awaaz nahi mili
      </p>
    );
  }

  if (!url) {
    return (
      <p className={clsx("flex items-center gap-1 text-[10px] text-chalk-500", className)}>
        <Loader2 size={10} className="animate-spin" />
        khul rahi hai…
      </p>
    );
  }

  function toggle(): void {
    const el = ref.current;
    if (!el) return;
    if (el.paused) {
      stopOthers(el);
      void el.play();
    } else {
      el.pause();
    }
  }

  const seconds = (value: number): string => {
    if (!Number.isFinite(value)) return "0:00";
    const whole = Math.floor(value);
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
  };

  const progress = total > 0 ? (at / total) * 100 : 0;

  return (
    <div className={clsx("flex items-center gap-1.5", className)}>
      <audio
        ref={ref}
        src={url}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setAt(0); }}
        onTimeUpdate={(event) => setAt(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setTotal(event.currentTarget.duration)}
      />

      <button
        type="button"
        onClick={(event) => { event.stopPropagation(); toggle(); }}
        title={playing ? "Rok do" : "Sun kar dekho"}
        aria-label={playing ? "Pause" : "Play"}
        className={clsx(
          "flex shrink-0 items-center justify-center rounded-full border transition-colors",
          playing
            ? "border-terracotta bg-terracotta/20 text-chalk-100"
            : "border-ink-600 text-chalk-400 hover:border-terracotta hover:text-chalk-200",
          variant === "full" ? "h-7 w-7" : "h-5 w-5",
        )}
      >
        {playing ? <Pause size={variant === "full" ? 13 : 10} /> : <Play size={variant === "full" ? 13 : 10} />}
      </button>

      {/*
       * Patti par click se seek. `bar` variant me bhi rakhi hai — 30 second ki
       * awaaz me beech ka hissa sunne ke liye poora shuru se sunna sazaa hai.
       */}
      <div
        className="h-1 min-w-0 flex-1 cursor-pointer rounded bg-ink-700"
        onClick={(event) => {
          event.stopPropagation();
          const el = ref.current;
          if (!el || !Number.isFinite(el.duration)) return;
          const box = event.currentTarget.getBoundingClientRect();
          el.currentTime = ((event.clientX - box.left) / box.width) * el.duration;
        }}
      >
        <div className="h-full rounded bg-terracotta/70" style={{ width: `${progress}%` }} />
      </div>

      <span className="shrink-0 font-mono text-[9px] tabular-nums text-chalk-500">
        {seconds(at)}/{seconds(total)}
      </span>
    </div>
  );
}
