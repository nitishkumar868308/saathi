"use client";

import {
  BUILTIN_DEVICES,
  DEFAULT_DEVICE_ID,
  ZOOM_PRESETS,
  checkZoomUpscale,
  deviceForAspect,
  findDevice,
  getItemType,
  type Item,
} from "@reel/core";
import clsx from "clsx";
import { AlertTriangle, Crosshair, Hand, Smartphone, Trash2 } from "lucide-react";

import { useAssetDurations } from "@/lib/assetMeta";
import { useEditorStore } from "@/lib/store";

/**
 * Phone mockup + zoom presets (18.1 / 18.4 / 18.7 / 18.8).
 *
 * ⚠️ Zoom presets **keyframes** banate hain, koi "zoom setting" nahi. Har preset
 * sirf ek chhota param set hai (`ZOOM_PRESETS`), aur wo `applyZoomPan` op se
 * guzarta hai — wahi op jo preview par chaukor kheenchne se chalta hai. Do alag
 * raaste hone par ek din preset wala zoom keyframes ke bina lagta aur uspar undo
 * kaam nahi karta.
 */
export function MockupSection({ items }: { items: readonly Item[] }) {
  const doc = useEditorStore((store) => store.doc);
  const applyOp = useEditorStore((store) => store.applyOp);
  const playheadFrame = useEditorStore((store) => store.playheadFrame);
  const zoomToolOn = useEditorStore((store) => store.zoomToolOn);
  const setZoomToolOn = useEditorStore((store) => store.setZoomToolOn);
  const meta = useAssetDurations(doc.project.fps);

  // Mockup sirf un items par jinme kuch dikhta hai aur jinka apna source ho.
  const target = items.length === 1 ? (items[0] as Item) : null;
  if (!target || !getItemType(target.type)?.hasVisual || target.assetId === null) return null;

  const mockup = target.mockup;
  const device = mockup ? findDevice(mockup.deviceId) : null;
  const source = meta.sourceSize(target.assetId);

  const set = (patch: Record<string, unknown>, label: string, coalesce?: string) =>
    applyOp(
      "setMockup",
      {
        itemIds: [target.id],
        mockup: {
          deviceId: DEFAULT_DEVICE_ID,
          colorId: "graphite",
          // Naye mockup par koi tap nahi (18.11) — nishaan user khud jodta hai.
          taps: [],
          widthPercent: 58,
          shadow: true,
          glare: false,
          tiltX: 0,
          tiltY: 0,
          screenFit: "cover" as const,
          ...(mockup ?? {}),
          ...patch,
        },
      },
      { label, coalesceKey: coalesce },
    );

  return (
    <section className="border-t border-ink-800">
      <h3 className="flex items-center justify-between px-3 pb-1 pt-2 text-[10px] uppercase tracking-wide text-chalk-500">
        <span className="flex items-center gap-1">
          <Smartphone size={10} />
          Phone frame
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={mockup !== null}
          onClick={() => {
            if (mockup) {
              applyOp("setMockup", { itemIds: [target.id], mockup: null }, { label: "Frame hataya" });
              return;
            }
            /*
             * Frame lagate waqt device **source ke aspect se** chuna jaata hai
             * (18.9). Hamesha ek hi default dena galat hota: 16:9 recording ko
             * 19.5:9 frame me daalne par uske upar-neeche kaali pattiyan aati
             * hain, aur wo turant nakli lagta hai.
             */
            const guessed = source ? deviceForAspect(source.width, source.height) : null;
            set({ deviceId: guessed?.id ?? DEFAULT_DEVICE_ID }, "Frame lagaya");
          }}
          className={clsx(
            "h-3 w-6 rounded-full border transition-colors",
            mockup ? "border-terracotta bg-terracotta" : "border-ink-500 bg-ink-700",
          )}
        />
      </h3>

      {mockup ? (
        <div className="space-y-1.5 px-3 pb-2">
          <label className="flex items-center gap-2 text-[11px] text-chalk-500">
            <span className="w-16 shrink-0">Device</span>
            <select
              value={mockup.deviceId}
              onChange={(event) => set({ deviceId: event.target.value }, "Device")}
              className="min-w-0 flex-1 rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-xs outline-none focus:border-terracotta"
            >
              {BUILTIN_DEVICES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>

          {device ? (
            <div className="flex items-center gap-2 text-[11px] text-chalk-500">
              <span className="w-16 shrink-0">Rang</span>
              <div className="flex gap-1">
                {device.colors.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    title={color.label}
                    aria-label={color.label}
                    onClick={() => set({ colorId: color.id }, "Frame ka rang")}
                    className={clsx(
                      "h-5 w-5 rounded border-2 transition-colors",
                      mockup.colorId === color.id ? "border-terracotta" : "border-ink-600",
                    )}
                    style={{ backgroundColor: color.body }}
                  />
                ))}
              </div>
            </div>
          ) : null}

          <MockupSlider
            label="Size"
            value={mockup.widthPercent}
            min={20}
            max={100}
            unit="%"
            onChange={(widthPercent) => set({ widthPercent }, "Frame size", `mk:size:${target.id}`)}
          />
          <MockupSlider
            label="Tilt X"
            value={mockup.tiltX}
            min={-30}
            max={30}
            unit="°"
            onChange={(tiltX) => set({ tiltX }, "Tilt", `mk:tx:${target.id}`)}
          />
          <MockupSlider
            label="Tilt Y"
            value={mockup.tiltY}
            min={-30}
            max={30}
            unit="°"
            onChange={(tiltY) => set({ tiltY }, "Tilt", `mk:ty:${target.id}`)}
          />

          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-chalk-500">
            <input
              type="checkbox"
              checked={mockup.shadow}
              onChange={(event) => set({ shadow: event.target.checked }, "Shadow")}
              className="accent-terracotta"
            />
            Parchhai
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[11px] text-chalk-500">
            <input
              type="checkbox"
              checked={mockup.glare}
              onChange={(event) => set({ glare: event.target.checked }, "Glare")}
              className="accent-terracotta"
            />
            Chamak
          </label>
          <p className="text-[11px] text-chalk-500">
            Chamak default band hai — screen recording par wo text padhna mushkil kar deti hai.
          </p>
        </div>
      ) : null}

      {/* ------------------------------------------------------ zoom (18.6 / 18.7) */}
      <div className="space-y-1.5 border-t border-ink-800 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide text-chalk-500">Zoom</span>
          <button
            type="button"
            onClick={() => setZoomToolOn(!zoomToolOn)}
            className={clsx(
              "flex items-center gap-1 rounded border px-1.5 py-0.5 text-[11px] transition-colors",
              zoomToolOn
                ? "border-terracotta bg-terracotta/15 text-chalk-200"
                : "border-ink-600 text-chalk-400 hover:bg-ink-700",
            )}
          >
            <Crosshair size={11} />
            {zoomToolOn ? "chaukor kheencho" : "chaukor se zoom"}
          </button>
        </div>

        <div className="flex flex-wrap gap-1">
          {ZOOM_PRESETS.map((preset) => {
            const steps = preset.steps.map((step) => ({
              frame: Math.round(step.atSeconds * doc.project.fps),
              rect: step.rect,
            }));
            const upscale = source
              ? checkZoomUpscale({
                  steps,
                  source,
                  frame: { width: doc.project.width, height: doc.project.height },
                  baseScale: target.transform.scale,
                })
              : null;

            return (
              <button
                key={preset.id}
                type="button"
                title={`${preset.hint}${upscale?.advice ? ` — ⚠️ ${upscale.advice}` : ""}`}
                onClick={() =>
                  applyOp(
                    "applyZoomPan",
                    {
                      itemId: target.id,
                      // Clip se lambe steps chhod dete hain — warna keyframe clip
                      // ke bahar chala jaata aur kabhi dikhta hi nahi.
                      steps: steps.filter((step) => step.frame < target.durationInFrames),
                    },
                    { label: preset.label },
                  )
                }
                className={clsx(
                  "rounded border px-1.5 py-0.5 text-[11px] transition-colors",
                  upscale?.level === "error"
                    ? "border-amber/50 text-amber hover:bg-amber/10"
                    : "border-ink-600 text-chalk-400 hover:bg-ink-700",
                )}
              >
                {preset.label}
                {upscale?.level === "error" ? <AlertTriangle size={9} className="ml-1 inline" /> : null}
              </button>
            );
          })}
        </div>

        {!source ? (
          // Chup-chaap chhod dena galat hai: bina source ki naap ke over-zoom ki
          // chetavni de hi nahi sakte, aur user ko wo pata hona chahiye.
          <p className="text-[11px] text-chalk-500">
            Is asset ki naap abhi pata nahi — isliye over-zoom ki chetavni nahi de sakte.
          </p>
        ) : null}
      </div>

      {/* ------------------------------------------------ tap ke nishaan (18.11) */}
      {mockup ? (
        <div className="space-y-1.5 border-t border-ink-800/60 px-3 pb-2 pt-2">
          <p className="text-[10px] uppercase tracking-wide text-chalk-500">Tap ke nishaan</p>

          <button
            type="button"
            onClick={() => {
              /*
               * ⚠️ Tap **playhead par** judta hai, aur uska frame item-local hota
               * hai — clip ke apne start se. Absolute frame likhne par clip
               * khiskate hi nishaan apni jagah chhod deta, aur wo galti sirf
               * export dekhne par pakdi jaati.
               *
               * Jagah abhi beech me (0.5, 0.5) hai. Screen par chun kar rakhna
               * Phase 18 ke baad ka kaam hai; beech se shuru karna is se behtar
               * hai ki tap kahin dikhe hi na.
               */
              const local = playheadFrame - target.startFrame;
              if (local < 0 || local >= target.durationInFrames) return;
              applyOp(
                "setMockup",
                {
                  itemIds: [target.id],
                  mockup: { ...mockup, taps: [...mockup.taps, { frame: local, x: 0.5, y: 0.5 }] },
                },
                { label: "Tap jodo" },
              );
            }}
            disabled={
              playheadFrame < target.startFrame ||
              playheadFrame >= target.startFrame + target.durationInFrames
            }
            title={
              playheadFrame < target.startFrame ||
              playheadFrame >= target.startFrame + target.durationInFrames
                ? "Playhead is clip ke bahar hai — tap clip ke andar hi lagta hai"
                : "Playhead par tap ka nishaan jodo"
            }
            className={clsx(
              "flex w-full items-center justify-center gap-1 rounded border px-2 py-1 text-[11px] transition-colors",
              playheadFrame >= target.startFrame &&
                playheadFrame < target.startFrame + target.durationInFrames
                ? "border-ink-600 text-chalk-400 hover:border-terracotta hover:text-chalk-200"
                : "cursor-not-allowed border-ink-600 text-chalk-500",
            )}
          >
            <Hand size={11} />
            Playhead par tap jodo
          </button>

          {mockup.taps.length === 0 ? (
            <p className="text-[10px] text-chalk-500">
              Abhi koi nishaan nahi. Screen recording me ungli kahan padi ye dikhane se
              achanak badalti screen ko wajah mil jaati hai.
            </p>
          ) : (
            <ul className="space-y-0.5">
              {mockup.taps.map((tap, index) => (
                <li
                  key={`${tap.frame}-${index}`}
                  className="flex items-center gap-2 text-[10px] text-chalk-400"
                >
                  <span className="flex-1 font-mono">
                    frame {tap.frame} · {Math.round(tap.x * 100)}% / {Math.round(tap.y * 100)}%
                  </span>
                  <button
                    type="button"
                    title="Ye nishaan hatao"
                    aria-label="Tap hatao"
                    onClick={() =>
                      applyOp(
                        "setMockup",
                        {
                          itemIds: [target.id],
                          mockup: {
                            ...mockup,
                            taps: mockup.taps.filter((_, at) => at !== index),
                          },
                        },
                        { label: "Tap hataya" },
                      )
                    }
                    className="shrink-0 rounded p-0.5 text-chalk-500 hover:bg-ink-700 hover:text-amber"
                  >
                    <Trash2 size={9} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </section>
  );
}

function MockupSlider({
  label,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[11px] text-chalk-500">
      <span className="w-16 shrink-0">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="min-w-0 flex-1 accent-terracotta"
      />
      <span className="w-10 shrink-0 text-right font-mono text-chalk-400">
        {value}
        {unit}
      </span>
    </label>
  );
}
