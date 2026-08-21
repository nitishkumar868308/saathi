"use client";

import { requireTrackType, type Track } from "@reel/core";
import clsx from "clsx";
import { Eye, EyeOff, Headphones, Lock, LockOpen, MoreHorizontal, Volume2, VolumeX, X } from "lucide-react";
import { useState } from "react";

import { TrackMenu, TrackOpacity } from "@/components/editor/timeline/TrackMenu";
import { Icon } from "@/components/ui/Icon";
import { useScreen } from "@/lib/breakpoint";
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
  /*
   * ⚠️ Chhoti screen par header sirf pehchaan dikhata hai — rang, icon, naam —
   * aur baaki sab ek sheet me chala jaata hai.
   *
   * Naapa hua: 390px ki screen par poora header 185px kha raha tha (aadhe se
   * zyada), aur timeline ke liye 200px bhi nahi bachte the. Sab kuch thoons kar
   * chhota kar dena aasan hota, par tab har toggle 20px ka ho jaata — yaani
   * ungli se dabana namumkin. Isliye chunav saaf hai: header patla, controls
   * poore naap ke, ek jagah par.
   */
  const compact = useScreen() !== "desktop";
  const [sheetOpen, setSheetOpen] = useState(false);

  function toggle(path: "muted" | "hidden" | "locked" | "solo", value: boolean) {
    applyOp(
      "setTrackProperty",
      { trackId: track.id, path, value },
      { label: `${track.name}: ${path}` },
    );
  }

  const toggles = (withLabel = false) => (
    <>
      <HeaderToggle
        withLabel={withLabel}
        on={track.solo}
        onIcon={<Headphones size={11} />}
        offIcon={<Headphones size={11} />}
        title={track.solo ? "Solo hatao" : "Solo — sirf yahi"}
        onClick={() => toggle("solo", !track.solo)}
      />
      <HeaderToggle
        withLabel={withLabel}
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
        withLabel={withLabel}
        on={track.hidden}
        onIcon={<EyeOff size={11} />}
        offIcon={<Eye size={11} />}
        title={track.hidden ? "Dikhao" : "Chhupao"}
        hidden={type.kind === "audio"}
        onClick={() => toggle("hidden", !track.hidden)}
      />
      <HeaderToggle
        withLabel={withLabel}
        on={track.locked}
        onIcon={<Lock size={11} />}
        offIcon={<LockOpen size={11} />}
        title={track.locked ? "Unlock" : "Lock"}
        onClick={() => toggle("locked", !track.locked)}
      />
    </>
  );

  if (compact) {
    return (
      <div className="relative border-b border-ink-800 bg-ink-900" style={{ height }}>
        {/*
         * ⚠️ Poora header ek hi button hai — alag se "⋯" wala button nahi.
         *
         * Pehle "⋯" alag tha aur wo ek asli gadbad bani: ungli wale device par
         * har button kam se kam 44px chauda hota hai (globals.css), aur 104px ke
         * header me wo aadhi jagah kha jaata tha — track ka naam "Vi…" ho jaata
         * tha. Ab wahi 104px poora tap target hai, aur naam ko poori chaudai
         * milti hai. Ek jagah, ek kaam.
         */}
        <button
          type="button"
          aria-label={`${track.name} ke controls`}
          onClick={() => setSheetOpen(true)}
          className="flex h-full w-full items-center gap-1.5 px-2 text-left hover:bg-ink-800"
        >
          <span
            className="h-6 w-1 shrink-0 rounded"
            style={{ backgroundColor: type.color }}
          />
          <Icon name={type.icon} size={12} className="shrink-0 text-chalk-500" />
          <span className="min-w-0 flex-1 truncate text-xs text-chalk-300">{track.name}</span>
          {/*
            Jo haalat abhi lagi hui hai wo header par hi dikhti rehti hai — mute
            hua track sheet khole bina pehchana jaana chahiye.
          */}
          <span className="flex shrink-0 items-center gap-0.5 text-chalk-500">
            {track.muted ? <VolumeX size={11} /> : null}
            {track.hidden ? <EyeOff size={11} /> : null}
            {track.locked ? <Lock size={11} /> : null}
          </span>
          <MoreHorizontal size={14} className="shrink-0 text-chalk-500" />
        </button>

        {sheetOpen ? (
          <TrackSheet track={track} onClose={() => setSheetOpen(false)}>
            {toggles(true)}
          </TrackSheet>
        ) : null}
      </div>
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

      <TrackOpacity track={track} />
      <TrackMenu track={track} />

      {/* Wahi toggles jo phone ki sheet me jaate hain — ek hi jagah likhe hue. */}
      <div className="flex shrink-0 items-center gap-0.5">{toggles()}</div>

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
  withLabel,
  onClick,
}: {
  on: boolean;
  onIcon: React.ReactNode;
  offIcon: React.ReactNode;
  title: string;
  hidden?: boolean;
  /**
   * Naam bhi dikhao (sirf sheet me).
   *
   * ⚠️ Header me sirf icon hai kyunki wahan jagah hi nahi — aur wahan tooltip
   * kaam kar jaata hai. Sheet me jagah hai, aur wahan icon-hi-icon rakhna sabse
   * aam shikayat banti hai: "ye headphone wala button kya karta hai?". Phone par
   * tooltip hota hi nahi, isliye naam ke bina jawab kahin se nahi milta.
   */
  withLabel?: boolean;
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
        "flex items-center justify-center rounded transition-colors",
        withLabel ? "gap-2 px-3 text-xs" : "h-5 w-5",
        on ? "bg-terracotta/25 text-amber" : "text-chalk-500 hover:bg-ink-700",
      )}
    >
      {on ? onIcon : offIcon}
      {withLabel ? <span>{title}</span> : null}
    </button>
  );
}


/**
 * Chhoti screen par track ke saare controls — neeche se aane wali sheet me.
 *
 * ⚠️ Sheet neeche se aati hai, beech me nahi. Ungli ka ghar neeche hai; beech
 * me khulne wale dialog par phone me haath upar le jaana padta hai aur wo har
 * baar khalta hai. Yahi wajah hai ki har mobile app me action sheet neeche se
 * aati hai.
 *
 * ⚠️ Peeche ki kaali chaadar par tap karne se sheet band hoti hai — bina uske
 * user "X" dhoondhta rehta hai, aur wo har naye bande ke saath hota hai.
 */
function TrackSheet({
  track,
  onClose,
  children,
}: {
  track: Track;
  onClose(): void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Band karo"
        onClick={onClose}
        className="absolute inset-0 bg-black/60"
      />
      <div className="relative w-full rounded-t-2xl border-t border-ink-600 bg-ink-800 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2 pb-3">
          <span className="min-w-0 flex-1 truncate text-sm text-chalk-100">{track.name}</span>
          <button
            type="button"
            aria-label="Band karo"
            onClick={onClose}
            className="flex items-center justify-center rounded-lg px-3 text-chalk-500 hover:bg-ink-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-ink-600 pt-3">
          {children}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-ink-600 pt-3">
          <span className="text-xs text-chalk-500">Opacity</span>
          <TrackOpacity track={track} />
          <span className="flex-1" />
          {/*
            Rename / copy / delete — sirf icon, par unke saath aria-label aur
            title dono hain. Inhe alag line me rakha hai kyunki inme se ek
            (delete) sach me kuch mita deta hai, aur use toggles ke beech me
            rakhna galti se dab jaane ka nyota hai.
          */}
          <TrackMenu track={track} />
        </div>
      </div>
    </div>
  );
}
