"use client";

import {
  DIMENSION_STEP,
  FPS_CHOICES,
  SIZE_PRESETS,
  aspectRatioLabel,
  framesToTimecode,
  getSizePreset,
  normalizeDimension,
  parseTimecode,
  resolveSize,
} from "@reel/core";
import { useState } from "react";

import { NumberField } from "@/components/controls/NumberField";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useEditorStore } from "@/lib/store";

/**
 * Project ki settings — ab **badli** ja sakti hain (9.13).
 *
 * ⚠️ Size aur fps dono ke saath ek sawaal aata hai, aur ye jaan-boojhkar aata
 * hai. Dono badlaav items ko chhu sakte hain:
 *
 *  - size badalne par items ko naye frame me re-fit karna pad sakta hai
 *  - fps badalne par frames ki ginti hi badal jaati hai (30fps ke 90 frame
 *    3 second hain, 60fps par wahi 90 frame 1.5 second)
 *
 * Dono me se koi bhi jawab hamesha sahi nahi hota — kabhi user sirf canvas
 * badalna chahta hai, kabhi poori reel. Isliye **poochha** jaata hai. Chupchaap
 * kuch bhi chun lena README rule 5 ka wahi doosra roop hai.
 */
export function ProjectPanel() {
  const doc = useEditorStore((state) => state.doc);
  const applyOp = useEditorStore((state) => state.applyOp);

  const { project } = doc;
  const preset = getSizePreset(project.sizePresetId);

  const [pendingSize, setPendingSize] = useState<{ width: number; height: number; presetId: string } | null>(null);
  const [pendingFps, setPendingFps] = useState<number | null>(null);
  const [durationText, setDurationText] = useState<string | null>(null);

  function askSize(presetId: string, width?: number, height?: number): void {
    const size =
      presetId === "custom"
        ? { width: width ?? project.width, height: height ?? project.height }
        : resolveSize({ presetId });
    if (size.width === project.width && size.height === project.height) {
      // Sirf preset ka naam badla, pixels wahi — kuch poochhne layak nahi.
      applyOp("setProjectSize", { ...size, sizePresetId: presetId }, { label: "Size preset" });
      return;
    }
    setPendingSize({ ...size, presetId });
  }

  return (
    <div className="space-y-4 p-3">
      <label className="block space-y-1">
        <span className="text-[11px] text-chalk-500">Naam</span>
        <input
          type="text"
          value={project.name}
          onChange={(event) =>
            applyOp(
              "setProjectProperty",
              { path: "name", value: event.target.value },
              { label: "Project ka naam", coalesceKey: "project:name" },
            )
          }
          className="w-full rounded border border-ink-600 bg-ink-900 px-1.5 py-1 text-sm outline-none focus:border-terracotta"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] text-chalk-500">Size</span>
        <select
          value={project.sizePresetId}
          onChange={(event) => askSize(event.target.value)}
          className="w-full rounded border border-ink-600 bg-ink-900 px-1 py-1 text-sm outline-none focus:border-terracotta"
        >
          {SIZE_PRESETS.map((entry) => (
            <option key={entry.id} value={entry.id} title={entry.hint}>
              {entry.label}
              {entry.width ? ` — ${entry.width}×${entry.height}` : ""}
            </option>
          ))}
        </select>
      </label>

      {project.sizePresetId === "custom" ? (
        <div className="flex items-center gap-2">
          <NumberField
            value={project.width}
            step={DIMENSION_STEP}
            onChange={(next) => askSize("custom", normalizeDimension(next), project.height)}
            label="W"
          />
          <NumberField
            value={project.height}
            step={DIMENSION_STEP}
            onChange={(next) => askSize("custom", project.width, normalizeDimension(next))}
            label="H"
          />
        </div>
      ) : null}

      <label className="block space-y-1">
        <span className="text-[11px] text-chalk-500">fps</span>
        <select
          value={project.fps}
          onChange={(event) => setPendingFps(Number(event.target.value))}
          className="w-full rounded border border-ink-600 bg-ink-900 px-1 py-1 text-sm outline-none focus:border-terracotta"
        >
          {FPS_CHOICES.map((fps) => (
            <option key={fps} value={fps}>
              {fps}
            </option>
          ))}
        </select>
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] text-chalk-500">Background</span>
        <span className="flex items-center gap-1.5">
          <input
            type="color"
            value={/^#[0-9a-f]{6}$/i.test(project.background) ? project.background : "#000000"}
            onChange={(event) =>
              applyOp(
                "setProjectProperty",
                { path: "background", value: event.target.value },
                { label: "Background", coalesceKey: "project:bg" },
              )
            }
            className="h-7 w-9 shrink-0 cursor-pointer rounded border border-ink-600 bg-ink-900"
          />
          <input
            type="text"
            value={project.background}
            onChange={(event) =>
              applyOp(
                "setProjectProperty",
                { path: "background", value: event.target.value },
                { label: "Background", coalesceKey: "project:bg" },
              )
            }
            className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-1.5 py-1 text-sm outline-none focus:border-terracotta"
          />
        </span>
      </label>

      <label className="block space-y-1">
        <span className="text-[11px] text-chalk-500">Lambai</span>
        <input
          type="text"
          value={durationText ?? framesToTimecode(project.durationInFrames, project.fps, { compact: true })}
          onChange={(event) => setDurationText(event.target.value)}
          onBlur={() => {
            if (durationText === null) return;
            const parsed = parseTimecode(durationText, project.fps);
            setDurationText(null);
            if (parsed === null || parsed < 1) return;
            /*
             * Lambai `setProjectProperty` se nahi jaati (wo path protected hai) —
             * yahan `recomputeDuration` ke bajay ek chhota trick: duration badhane
             * ke liye ek khaali "grow" chahiye. Isliye seedha op nahi hai aur
             * button bhi nahi dikhaya jaata jab tak Phase 11 me export ke saath
             * uska apna op na aa jaaye.
             */
          }}
          disabled
          title="Lambai abhi items se apne aap banti hai (aakhri clip ka ant). Iska apna control Phase 11 me aayega."
          className="w-full rounded border border-ink-600 bg-ink-900/50 px-1.5 py-1 text-sm text-chalk-500 outline-none"
        />
        <span className="block text-[10px] text-chalk-500">
          {project.durationInFrames} frames · aakhri clip ke ant se apne aap banti hai
        </span>
      </label>

      <dl className="space-y-1 border-t border-ink-600 pt-3">
        {(
          [
            ["Aspect", aspectRatioLabel(project.width, project.height)],
            ["Preset", preset?.label ?? project.sizePresetId],
            ["Tracks", String(doc.tracks.length)],
            ["Items", String(doc.items.length)],
          ] as [string, string][]
        ).map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-2 text-xs">
            <dt className="text-chalk-500">{label}</dt>
            <dd className="font-mono text-chalk-300">{value}</dd>
          </div>
        ))}
      </dl>

      {/* ---------------------------------------------------- size ka sawaal */}
      <Modal
        open={pendingSize !== null}
        title="Size badal rahe ho — items ka kya karein?"
        onClose={() => setPendingSize(null)}
      >
        <div className="space-y-3 text-sm">
          <p className="text-chalk-300">
            {project.width}×{project.height} → {pendingSize?.width}×{pendingSize?.height}
          </p>
          <p className="text-xs leading-relaxed text-chalk-500">
            {doc.items.length} items abhi purane frame ke hisaab se rakhe hain. Re-fit karne par
            unki jagah aur scale naye frame ke anupaat me badal jaayegi. Nahi karne par wo
            waise ke waise rahenge — kuch frame se bahar nikal sakte hain.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => {
                if (!pendingSize) return;
                applyOp(
                  "setProjectSize",
                  {
                    width: pendingSize.width,
                    height: pendingSize.height,
                    sizePresetId: pendingSize.presetId,
                    refit: true,
                  },
                  { label: "Size + re-fit" },
                );
                setPendingSize(null);
              }}
            >
              Items ko re-fit karo
            </Button>
            <Button
              onClick={() => {
                if (!pendingSize) return;
                applyOp(
                  "setProjectSize",
                  {
                    width: pendingSize.width,
                    height: pendingSize.height,
                    sizePresetId: pendingSize.presetId,
                  },
                  { label: "Size" },
                );
                setPendingSize(null);
              }}
            >
              Sirf frame badlo
            </Button>
            <Button variant="ghost" onClick={() => setPendingSize(null)}>
              Rehne do
            </Button>
          </div>
          <p className="text-[11px] text-chalk-500">Dono me se kuch bhi Ctrl+Z se wapas aa jaayega.</p>
        </div>
      </Modal>

      {/* ----------------------------------------------------- fps ka sawaal */}
      <Modal
        open={pendingFps !== null}
        title="fps badal rahe ho — timing ka kya karein?"
        onClose={() => setPendingFps(null)}
      >
        <div className="space-y-3 text-sm">
          <p className="text-chalk-300">
            {project.fps}fps → {pendingFps}fps
          </p>
          <p className="text-xs leading-relaxed text-chalk-500">
            Frames ki ginti fps par tiki hai. {project.fps}fps ke {project.fps * 3} frames 3
            second hain; {pendingFps}fps par wahi frames{" "}
            {pendingFps ? ((project.fps * 3) / pendingFps).toFixed(1) : "?"} second ho jaayenge.
            Convert karne par har clip ka **waqt** waisa hi rahega (frames badlenge); na karne
            par frames waise rahenge aur poori reel ki timing badal jaayegi.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              onClick={() => {
                if (pendingFps === null) return;
                applyOp(
                  "setProjectFps",
                  { fps: pendingFps, rescaleItems: true },
                  { label: "fps + timing convert" },
                );
                setPendingFps(null);
              }}
            >
              Waqt waisa hi rakho
            </Button>
            <Button
              onClick={() => {
                if (pendingFps === null) return;
                applyOp("setProjectFps", { fps: pendingFps }, { label: "fps" });
                setPendingFps(null);
              }}
            >
              Sirf fps badlo
            </Button>
            <Button variant="ghost" onClick={() => setPendingFps(null)}>
              Rehne do
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
