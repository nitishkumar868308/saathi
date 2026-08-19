"use client";

import {
  DEFAULT_DUCK_TARGET_DB,
  estimateMixPeak,
  gainToDb,
  getTrackType,
  suggestedMasterVolume,
} from "@reel/core";
import clsx from "clsx";
import { AlertTriangle } from "lucide-react";

import { useEditorStore } from "@/lib/store";

/**
 * Master audio + ducking (15.4 / 15.6).
 *
 * ⚠️ Loudness target yahan se seedha render ke `finalizeMp4` me jaata hai — UI
 * kisi item ka volume nahi badalti. Do jagah volume ka ganit rakhne par project
 * dobara kholne par user ke apne set kiye hue volume badle hue milte, aur uski
 * wajah kabhi samajh nahi aati.
 */
export function MasterAudioPanel() {
  const doc = useEditorStore((state) => state.doc);
  const applyOp = useEditorStore((state) => state.applyOp);

  const master = doc.project.audio;
  const ducking = master.ducking;

  /*
   * Audio track wahi hai jo `audio` item leta ho — track ke naam se nahi, uske
   * **type ki registry entry** se. Naam se dhoondhna ("Music", "Voiceover")
   * kabhi kaam nahi karta: user track ka naam badal deta hai aur list khaali ho
   * jaati hai.
   */
  const audioTracks = doc.tracks.filter((track) =>
    (getTrackType(track.type)?.accepts ?? []).includes("audio"),
  );
  const { peak, frame } = estimateMixPeak(doc);
  const suggestion = suggestedMasterVolume(doc);

  const toggleTrack = (list: readonly string[], id: string): string[] =>
    list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];

  return (
    <div className="space-y-3 p-3 text-[11px]">
      <section className="space-y-1.5">
        <h3 className="text-[10px] uppercase tracking-wide text-chalk-500">Master</h3>

        <label className="flex items-center gap-2 text-chalk-500">
          <span className="w-24 shrink-0">Volume</span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.01}
            value={master.volume}
            onChange={(event) =>
              applyOp(
                "setMasterAudio",
                { volume: Number(event.target.value) },
                { label: "Master volume", coalesceKey: "master:volume" },
              )
            }
            className="min-w-0 flex-1 accent-terracotta"
          />
          <span className="w-14 shrink-0 text-right font-mono text-chalk-400">
            {gainToDb(master.volume) <= -60 ? "chup" : `${gainToDb(master.volume).toFixed(1)} dB`}
          </span>
        </label>

        <label className="flex items-center gap-2 text-chalk-500">
          <span className="w-24 shrink-0">Loudness</span>
          <input
            type="range"
            min={-24}
            max={-9}
            step={1}
            value={master.loudnessLufs}
            onChange={(event) =>
              applyOp(
                "setMasterAudio",
                { loudnessLufs: Number(event.target.value) },
                { label: "Loudness target", coalesceKey: "master:lufs" },
              )
            }
            className="min-w-0 flex-1 accent-terracotta"
          />
          <span className="w-14 shrink-0 text-right font-mono text-chalk-400">
            {master.loudnessLufs} LUFS
          </span>
        </label>
        <p className="text-chalk-500">
          −14 LUFS Instagram/YouTube ka apna target hai. Isse ooncha bhejne par wo khud neeche
          kar dete hain, aur tab awaaz chapti lagti hai.
        </p>

        <label className="flex cursor-pointer items-center gap-2 text-chalk-500">
          <input
            type="checkbox"
            checked={master.limiter}
            onChange={(event) =>
              applyOp("setMasterAudio", { limiter: event.target.checked }, { label: "Limiter" })
            }
            className="accent-terracotta"
          />
          Limiter (−1 dBTP)
        </label>

        {/*
         * Clipping ki chetavni — aur uske saath ek seedha upaay. Sirf "clipping
         * ho sakti hai" likh dena user ko atka deta hai; number aur ek button
         * dono hone se wo turant nikal sakta hai.
         */}
        {suggestion !== null ? (
          <div className="flex items-start gap-1.5 rounded border border-amber/40 bg-amber/10 px-2 py-1 text-amber">
            <AlertTriangle size={12} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p>
                Frame {frame} par saari awaazein milkar {peak.toFixed(2)} par ja rahi hain (1 se
                upar = clipping ka khatra).
              </p>
              <button
                type="button"
                onClick={() =>
                  applyOp(
                    "setMasterAudio",
                    { volume: suggestion },
                    { label: "Master auto-gain" },
                  )
                }
                className="mt-1 rounded border border-amber/50 px-1.5 py-0.5 text-amber hover:bg-amber/20"
              >
                Master {suggestion.toFixed(2)} par le aao
              </button>
              <p className="mt-1 opacity-80">
                Ye anumaan hai (sab gain ka jod), asli naap render ke baad hoti hai — isliye ye
                hamesha thoda zyada batata hai.
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="space-y-1.5 border-t border-ink-800 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] uppercase tracking-wide text-chalk-500">Ducking</h3>
          <button
            type="button"
            role="switch"
            aria-checked={ducking.enabled}
            onClick={() =>
              applyOp("setDucking", { enabled: !ducking.enabled }, { label: "Ducking" })
            }
            className={clsx(
              "h-3 w-6 rounded-full border transition-colors",
              ducking.enabled ? "border-terracotta bg-terracotta" : "border-ink-500 bg-ink-700",
            )}
          />
        </div>

        {!ducking.enabled ? (
          <p className="text-chalk-500">
            Voice chale to music apne aap neeche. On karke batao kaun si track voice hai aur kaun
            si music.
          </p>
        ) : audioTracks.length < 2 ? (
          // Ek hi audio track par ducking ka koi matlab nahi — aur wo baat saaf
          // likhi honi chahiye, warna user settings ghumata rehta hai.
          <p className="text-amber">
            Ducking ke liye kam se kam do audio tracks chahiye — ek voice, ek music.
          </p>
        ) : (
          <>
            <TrackPicker
              label="Voice"
              tracks={audioTracks}
              selected={ducking.voiceTrackIds}
              disabled={ducking.duckedTrackIds}
              onToggle={(id) =>
                applyOp(
                  "setDucking",
                  { voiceTrackIds: toggleTrack(ducking.voiceTrackIds, id) },
                  { label: "Voice track" },
                )
              }
            />
            <TrackPicker
              label="Neeche"
              tracks={audioTracks}
              selected={ducking.duckedTrackIds}
              disabled={ducking.voiceTrackIds}
              onToggle={(id) =>
                applyOp(
                  "setDucking",
                  { duckedTrackIds: toggleTrack(ducking.duckedTrackIds, id) },
                  { label: "Ducked track" },
                )
              }
            />

            <label className="flex items-center gap-2 text-chalk-500">
              <span className="w-24 shrink-0">Kitna neeche</span>
              <input
                type="range"
                min={-30}
                max={-3}
                step={1}
                value={ducking.targetDb}
                onChange={(event) =>
                  applyOp(
                    "setDucking",
                    { targetDb: Number(event.target.value) },
                    { label: "Duck level", coalesceKey: "duck:target" },
                  )
                }
                className="min-w-0 flex-1 accent-terracotta"
              />
              <span className="w-14 shrink-0 text-right font-mono text-chalk-400">
                {ducking.targetDb} dB
              </span>
            </label>

            <label className="flex items-center gap-2 text-chalk-500">
              <span className="w-24 shrink-0">Attack</span>
              <input
                type="range"
                min={0}
                max={30}
                step={1}
                value={ducking.attackFrames}
                onChange={(event) =>
                  applyOp(
                    "setDucking",
                    { attackFrames: Number(event.target.value) },
                    { label: "Duck attack", coalesceKey: "duck:attack" },
                  )
                }
                className="min-w-0 flex-1 accent-terracotta"
              />
              <span className="w-14 shrink-0 text-right font-mono text-chalk-400">
                {ducking.attackFrames}f
              </span>
            </label>

            <label className="flex items-center gap-2 text-chalk-500">
              <span className="w-24 shrink-0">Release</span>
              <input
                type="range"
                min={0}
                max={60}
                step={1}
                value={ducking.releaseFrames}
                onChange={(event) =>
                  applyOp(
                    "setDucking",
                    { releaseFrames: Number(event.target.value) },
                    { label: "Duck release", coalesceKey: "duck:release" },
                  )
                }
                className="min-w-0 flex-1 accent-terracotta"
              />
              <span className="w-14 shrink-0 text-right font-mono text-chalk-400">
                {ducking.releaseFrames}f
              </span>
            </label>

            <p className="text-chalk-500">
              Default {Math.abs(DEFAULT_DUCK_TARGET_DB)} dB. Attack voice ke shuru hone se{" "}
              <em>pehle</em> lagta hai, taaki pehla shabd music ke upar na chadhe.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function TrackPicker({
  label,
  tracks,
  selected,
  disabled,
  onToggle,
}: {
  label: string;
  tracks: readonly { id: string; name: string }[];
  selected: readonly string[];
  /** Doosri list me chuni hui tracks — ek track dono me nahi ho sakti. */
  disabled: readonly string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex items-start gap-2 text-chalk-500">
      <span className="w-24 shrink-0 pt-0.5">{label}</span>
      <div className="flex min-w-0 flex-1 flex-wrap gap-1">
        {tracks.map((track) => {
          const isOn = selected.includes(track.id);
          const isBlocked = disabled.includes(track.id);
          return (
            <button
              key={track.id}
              type="button"
              disabled={isBlocked}
              title={isBlocked ? "Ye track doosri list me hai" : track.name}
              onClick={() => onToggle(track.id)}
              className={clsx(
                "max-w-full truncate rounded border px-1.5 py-0.5 transition-colors",
                isOn
                  ? "border-terracotta bg-terracotta/15 text-chalk-200"
                  : "border-ink-600 text-chalk-500 hover:bg-ink-700",
                isBlocked && "cursor-not-allowed opacity-30",
              )}
            >
              {track.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
