"use client";

import {
  CUSTOM_SIZE_PRESET_ID,
  DEFAULT_FPS,
  DEFAULT_PROJECT_DURATION_SECONDS,
  DEFAULT_SIZE_PRESET_ID,
  FPS_CHOICES,
  SIZE_PRESETS,
  aspectRatioLabel,
  isValidDimension,
  listSizePresets,
  type SizePreset,
} from "@reel/core";
import clsx from "clsx";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { sizeLabel } from "@/lib/format";
import { NewProjectInputSchema } from "@/lib/project-input";

/**
 * "Naya project" — README Section 3B ka poora size selector.
 *
 * ⚠️ Yahan ek bhi size likhi hui nahi hai. Poori list `SIZE_PRESETS` se aati hai
 * aur fps `FPS_CHOICES` se. Nayi size chahiye to `packages/reel-core/src/config/
 * presets.ts` me ek entry — is file me kuch nahi badalta (Dynamic rule 4).
 *
 * Thumbnail bhi asli aspect se banta hai: `aspect-ratio: w / h`. Isliye naya
 * preset apne aap sahi shakal me dikhta hai, koi per-preset CSS nahi.
 */

interface Props {
  open: boolean;
  onClose(): void;
  onCreated(projectId: string): void;
}

/** Group ka sar-naam — id se label. Registry-shaili: naya group apne aap dikhega. */
const GROUP_LABELS: Record<string, string> = {
  social: "Reel / social",
  wide: "Landscape",
  other: "Doosre",
  custom: "Apni size",
};

export function NewProjectDialog({ open, onClose, onCreated }: Props) {
  const [name, setName] = useState("");
  const [presetId, setPresetId] = useState<string>(DEFAULT_SIZE_PRESET_ID);
  const [customWidth, setCustomWidth] = useState(1080);
  const [customHeight, setCustomHeight] = useState(1920);
  const [fps, setFps] = useState(DEFAULT_FPS);
  const [seconds, setSeconds] = useState(DEFAULT_PROJECT_DURATION_SECONDS);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const groups = useMemo(() => {
    const byGroup = new Map<string, SizePreset[]>();
    for (const preset of listSizePresets()) {
      const bucket = byGroup.get(preset.group) ?? [];
      bucket.push(preset);
      byGroup.set(preset.group, bucket);
    }
    return [...byGroup.entries()];
  }, []);

  const isCustom = presetId === CUSTOM_SIZE_PRESET_ID;
  const selected = SIZE_PRESETS.find((preset) => preset.id === presetId);
  const width = isCustom ? customWidth : (selected?.width ?? 0);
  const height = isCustom ? customHeight : (selected?.height ?? 0);
  const customBroken = isCustom && (!isValidDimension(width) || !isValidDimension(height));

  async function create() {
    setBusy(true);
    setError(null);
    try {
      // Wahi schema jo server par lagta hai — do jagah do rules kabhi nahi.
      const parsed = NewProjectInputSchema.safeParse({
        ...(name.trim() ? { name: name.trim() } : {}),
        presetId,
        ...(isCustom ? { width: customWidth, height: customHeight } : {}),
        fps,
        durationInSeconds: seconds,
      });
      if (!parsed.success) {
        setError(parsed.error.issues[0]?.message ?? "input galat hai");
        return;
      }

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await response.json()) as {
        project?: { id: string };
        error?: string;
        reason?: string;
      };
      if (!response.ok || !data.project) {
        setError(data.reason ?? data.error ?? "project nahi bana");
        return;
      }
      onCreated(data.project.id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      title="Naya project"
      onClose={onClose}
      width="max-w-2xl"
      footer={
        <>
          <Button onClick={onClose} variant="ghost">
            Rehne do
          </Button>
          <Button onClick={create} variant="primary" disabled={busy || customBroken}>
            {busy ? "Ban raha hai…" : "Banao"}
          </Button>
        </>
      }
    >
      <label className="block text-xs uppercase tracking-wide text-chalk-500">Naam</label>
      <input
        value={name}
        autoFocus
        onChange={(event) => setName(event.target.value)}
        placeholder="Naya project"
        className="mt-1 w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-terracotta"
      />

      <div className="mt-5 text-xs uppercase tracking-wide text-chalk-500">Size</div>
      <div className="mt-2 space-y-4">
        {groups.map(([group, presets]) => (
          <div key={group}>
            <div className="mb-1.5 text-[11px] text-chalk-500">
              {GROUP_LABELS[group] ?? group}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {presets.map((preset) => (
                <PresetCard
                  key={preset.id}
                  preset={preset}
                  selected={preset.id === presetId}
                  customSize={{ width: customWidth, height: customHeight }}
                  onSelect={() => setPresetId(preset.id)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {isCustom ? (
        <div className="mt-3 flex items-end gap-3">
          <NumberField
            label="Width"
            value={customWidth}
            onChange={setCustomWidth}
            invalid={!isValidDimension(customWidth)}
          />
          <span className="pb-2 text-chalk-500">×</span>
          <NumberField
            label="Height"
            value={customHeight}
            onChange={setCustomHeight}
            invalid={!isValidDimension(customHeight)}
          />
          <p className="pb-2 text-xs text-chalk-500">
            {/* yuv420p ka chroma plane aadha hota hai — visham size par encoder rota hai. */}
            Dono even hone chahiye (encoder ki zaroorat)
          </p>
        </div>
      ) : null}

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs uppercase tracking-wide text-chalk-500">fps</div>
          <div className="mt-1 flex gap-1">
            {FPS_CHOICES.map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => setFps(choice)}
                className={clsx(
                  "rounded-md border px-2.5 py-1 text-sm transition-colors",
                  choice === fps
                    ? "border-terracotta bg-terracotta/15 text-chalk-100"
                    : "border-ink-600 text-chalk-300 hover:bg-ink-700",
                )}
              >
                {choice}
              </button>
            ))}
          </div>
        </div>
        <NumberField
          label="Lambai (second)"
          value={seconds}
          onChange={setSeconds}
          invalid={!(seconds > 0)}
        />
      </div>

      <p className="mt-4 text-xs text-chalk-500">
        {width && height ? (
          <>
            Banega: <span className="text-chalk-300">{sizeLabel(width, height)}</span> (
            {aspectRatioLabel(width, height)}) @ {fps}fps
          </>
        ) : (
          "Size chuno"
        )}
      </p>

      {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
    </Modal>
  );
}

function PresetCard({
  preset,
  selected,
  customSize,
  onSelect,
}: {
  preset: SizePreset;
  selected: boolean;
  customSize: { width: number; height: number };
  onSelect(): void;
}) {
  const width = preset.width ?? customSize.width;
  const height = preset.height ?? customSize.height;

  return (
    <button
      type="button"
      onClick={onSelect}
      title={preset.hint}
      className={clsx(
        "flex items-center gap-3 rounded-lg border p-2.5 text-left transition-colors",
        selected
          ? "border-terracotta bg-terracotta/10"
          : "border-ink-600 hover:border-ink-500 hover:bg-ink-700",
      )}
    >
      {/* Thumbnail asli aspect se banta hai — per-preset CSS kahin nahi. */}
      <span className="flex h-10 w-10 shrink-0 items-center justify-center">
        <span
          className={clsx(
            "block rounded-[3px] border",
            selected ? "border-terracotta bg-terracotta/25" : "border-chalk-500 bg-ink-600",
          )}
          style={{
            aspectRatio: `${width} / ${height}`,
            ...(width >= height ? { width: "100%" } : { height: "100%" }),
          }}
        />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm text-chalk-100">{preset.label}</span>
        <span className="block text-xs text-chalk-500">
          {preset.width && preset.height
            ? `${sizeLabel(preset.width, preset.height)} · ${preset.aspectLabel}`
            : "jo chaaho"}
        </span>
      </span>
    </button>
  );
}

function NumberField({
  label,
  value,
  onChange,
  invalid,
}: {
  label: string;
  value: number;
  onChange(value: number): void;
  invalid?: boolean;
}) {
  return (
    <label className="block">
      <span className="block text-xs uppercase tracking-wide text-chalk-500">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={clsx(
          "mt-1 w-full rounded-md border bg-ink-900 px-3 py-2 text-sm outline-none",
          invalid ? "border-red-500/60" : "border-ink-600 focus:border-terracotta",
        )}
      />
    </label>
  );
}
