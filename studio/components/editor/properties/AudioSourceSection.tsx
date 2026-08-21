"use client";

import { CLEANUP_STEPS, DEFAULT_CLEANUP, getItemType, type AudioSource, type Item } from "@reel/core";
import clsx from "clsx";
import { AlertTriangle, Mic, Upload, Wand2 } from "lucide-react";

import { AssetPickerButton } from "@/components/editor/scenes/AssetPicker";
import { AudioPreview } from "@/components/media/AudioPreview";
import { VoiceRecorder } from "@/components/editor/properties/VoiceRecorder";
import { VoiceGenerate } from "@/components/editor/properties/VoiceGenerate";
import { useEditorStore } from "@/lib/store";

/**
 * Audio ke teen raaste (22.1 / 22.2 / 22.7 / 22.10).
 *
 * ⚠️ `both` ka matlab "dono ek saath baja do" **nahi** hai. Wo "dono rakho, ek
 * chalao" hai — taaki apni recording aane tak generated wali chalti rahe, aur
 * aane ke baad ek click me badal jaaye. Dono ek saath bajana galat hota: wahi
 * baat do awaazon me sunai deti hai.
 */

const DEFAULT_SOURCE: NonNullable<AudioSource> = {
  mode: "generate",
  text: "",
  // Khaali = "jo bhi is machine par chal sake" — dekho AudioSourceSchema.
  providerId: "",
  categoryId: "male",
  voiceId: "",
  rate: 1,
  pitch: 0,
  uploadedAssetId: null,
  generatedAssetId: null,
  primary: "uploaded",
  generatedFromText: "",
  cleanup: { enabled: {}, params: {}, order: [] },
};

const TABS = [
  { id: "generate", label: "Generate", icon: Wand2 },
  { id: "upload", label: "Upload", icon: Upload },
  { id: "both", label: "Both", icon: Mic },
] as const;

export function AudioSourceSection({ items }: { items: readonly Item[] }) {
  const applyOp = useEditorStore((store) => store.applyOp);
  const fps = useEditorStore((store) => store.doc.project.fps);

  const target = items.length === 1 ? (items[0] as Item) : null;
  if (!target || !getItemType(target.type)?.hasAudio) return null;

  const source = target.audio.source;

  const set = (patch: Partial<NonNullable<AudioSource>>, label: string, coalesce?: string) =>
    applyOp(
      "setItemAudio",
      {
        itemIds: [target.id],
        field: "source",
        value: { ...DEFAULT_SOURCE, ...(source ?? {}), ...patch },
      },
      { label, coalesceKey: coalesce },
    );

  const cleanupOn = (id: string): boolean =>
    source?.cleanup.enabled[id] ?? Boolean(DEFAULT_CLEANUP.enabled[id as never]);

  /*
   * "Voice outdated" (22.10) — text badla par awaaz purani hai. Bina iske purani
   * awaaz chup-chaap chalti rehti hai aur user ko lagta hai ki regenerate kaam
   * nahi kar raha, jabki usne kabhi dabaya hi nahi.
   */
  const stale =
    source !== null &&
    source.generatedAssetId !== null &&
    source.text.trim() !== source.generatedFromText.trim();

  return (
    <section className="border-t border-ink-800">
      <h3 className="flex items-center justify-between px-3 pb-1 pt-2 text-[10px] uppercase tracking-wide text-chalk-500">
        <span>Awaaz kahan se</span>
        <button
          type="button"
          role="switch"
          aria-checked={source !== null}
          onClick={() =>
            applyOp(
              "setItemAudio",
              {
                itemIds: [target.id],
                field: "source",
                value: source ? null : { ...DEFAULT_SOURCE },
              },
              { label: source ? "Audio source hataya" : "Audio source" },
            )
          }
          className={clsx(
            "h-3 w-6 rounded-full border transition-colors",
            source ? "border-terracotta bg-terracotta" : "border-ink-500 bg-ink-700",
          )}
        />
      </h3>

      {source === null ? (
        <p className="px-3 pb-2 text-[11px] text-chalk-500">
          Abhi seedha asset lagi hai. On karke text se awaaz banao, apni recording daalo, ya
          dono rakho.
        </p>
      ) : (
        <div className="space-y-1.5 px-3 pb-2">
          <div className="flex gap-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => set({ mode: tab.id }, `Audio: ${tab.label}`)}
                className={clsx(
                  "flex flex-1 items-center justify-center gap-1 rounded border px-1 py-0.5 text-[11px] transition-colors",
                  source.mode === tab.id
                    ? "border-terracotta bg-terracotta/15 text-chalk-200"
                    : "border-ink-600 text-chalk-500 hover:bg-ink-700",
                )}
              >
                <tab.icon size={10} />
                {tab.label}
              </button>
            ))}
          </div>

          {source.mode !== "upload" ? (
            <>
              <textarea
                value={source.text}
                rows={2}
                placeholder="Kya bolna hai"
                onChange={(event) =>
                  set({ text: event.target.value }, "Voice text", `voice-text:${target.id}`)
                }
                className="w-full resize-y rounded border border-ink-600 bg-ink-900 px-1.5 py-1 text-[11px] text-chalk-200 outline-none focus:border-terracotta"
              />

              {stale ? (
                <p className="flex items-start gap-1 rounded border border-amber/40 bg-amber/10 px-1.5 py-1 text-[11px] text-amber">
                  <AlertTriangle size={11} className="mt-0.5 shrink-0" />
                  Voice purani hai — text badal chuka hai. Dobara generate karo.
                </p>
              ) : null}



              <VoiceSlider
                label="Raftaar"
                value={source.rate}
                min={0.5}
                max={2}
                step={0.05}
                format={(value) => `${value.toFixed(2)}x`}
                onChange={(rate) => set({ rate }, "Voice rate", `voice-rate:${target.id}`)}
              />
              <VoiceSlider
                label="Pitch"
                value={source.pitch}
                min={-12}
                max={12}
                step={1}
                format={(value) => `${value > 0 ? "+" : ""}${value}`}
                onChange={(pitch) => set({ pitch }, "Voice pitch", `voice-pitch:${target.id}`)}
              />

              {/*
               * ⚠️ Button ab hai — par wo tabhi dabta hai jab is machine par koi
               * provider sach me chal sakta ho. `VoiceGenerate` ye `GET /api/tts`
               * se **poochhta** hai; maan kar nahi chalta. Aisa button dikhana jo
               * dabane par kuch na kare, sabse bura hota — user sochta hai app
               * toota hua hai, jabki sirf ek key ya ek `pip install` baaki tha.
               */}
              <VoiceGenerate
                source={{ ...DEFAULT_SOURCE, ...source }}
                itemId={target.id}
                fps={fps}
                onChange={(patch, label) => set(patch, label)}
                onSyncDuration={(durationInFrames) =>
                  applyOp(
                    "syncDurationToVoice",
                    { itemId: target.id, durationInFrames },
                    { label: "Lambai voice ke barabar" },
                  )
                }
              />
            </>
          ) : null}

          {source.mode !== "generate" ? (
            <>
              <div className="flex items-center gap-2 text-[11px] text-chalk-500">
                <span className="w-14 shrink-0">File</span>
                <AssetPickerButton
                  kind="audio"
                  assetId={source.uploadedAssetId}
                  onPick={(uploadedAssetId) => set({ uploadedAssetId }, "Recording")}
                />
              </div>
              {/* Apni recording bhi yahin sunn lo — lagane se pehle. */}
              {source.uploadedAssetId ? (
                <AudioPreview assetId={source.uploadedAssetId} />
              ) : null}

              {/*
               * 22.13 — file chunne ke alawa **yahin record** bhi kar sakte ho.
               * Recording aam upload ban kar jaati hai (`permanent`), isliye use
               * dedup, probe, waveform aur cleanup sab apne aap milte hain.
               */}
              <VoiceRecorder
                onRecorded={(uploadedAssetId) => set({ uploadedAssetId }, "Recording")}
              />
            </>
          ) : null}

          {source.mode === "both" ? (
            <div className="flex items-center gap-2 text-[11px] text-chalk-500">
              <span className="w-14 shrink-0">Chalega</span>
              <div className="flex flex-1 gap-1">
                {(["uploaded", "generated"] as const).map((which) => (
                  <button
                    key={which}
                    type="button"
                    onClick={() => set({ primary: which }, "Primary awaaz")}
                    className={clsx(
                      "flex-1 rounded border px-1 py-0.5 transition-colors",
                      source.primary === which
                        ? "border-terracotta bg-terracotta/15 text-chalk-200"
                        : "border-ink-600 hover:bg-ink-700",
                    )}
                  >
                    {which === "uploaded" ? "meri recording" : "generated"}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {/* ------------------------------------------------ cleanup (22.7) */}
          <div className="border-t border-ink-800 pt-1.5">
            <p className="pb-1 text-[10px] uppercase tracking-wide text-chalk-500">Cleanup</p>
            {CLEANUP_STEPS.map((step) => (
              <label
                key={step.id}
                title={step.hint}
                className="flex cursor-pointer items-center gap-2 py-0.5 text-[11px] text-chalk-500"
              >
                <input
                  type="checkbox"
                  checked={cleanupOn(step.id)}
                  onChange={(event) =>
                    set(
                      {
                        cleanup: {
                          ...(source.cleanup ?? { enabled: {}, params: {}, order: [] }),
                          enabled: {
                            ...source.cleanup.enabled,
                            [step.id]: event.target.checked,
                          },
                        },
                      },
                      `Cleanup: ${step.label}`,
                    )
                  }
                  className="accent-terracotta"
                />
                {step.label}
              </label>
            ))}
            <p className="pt-1 text-[11px] text-chalk-500">
              Shor aur de-esser default me band hain — dono achhi recording ko patla kar sakte
              hain. Limiter hamesha aakhir me lagta hai.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}

function VoiceSlider({
  label,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[11px] text-chalk-500">
      <span className="w-14 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-w-0 flex-1 accent-terracotta"
      />
      <span className="w-12 shrink-0 text-right font-mono text-chalk-400">{format(value)}</span>
    </label>
  );
}
