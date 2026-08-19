"use client";

import {
  BUILTIN_BRAND_PRESETS,
  brandOverrides,
  brandTokensFor,
  overridesToTokens,
  tokenByColor,
} from "@reel/core";
import clsx from "clsx";
import { Palette } from "lucide-react";

import { AssetPickerButton } from "@/components/editor/scenes/AssetPicker";
import { useEditorStore } from "@/lib/store";

/**
 * Brand panel (17.9 / 17.11 / 17.12).
 *
 * ⚠️ Preset badalne se **items ko haath nahi lagta**. Rang doc me
 * `"brand.primary"` jaise token ke roop me pade hain; preset badalte hi wo naye
 * rang par resolve hone lagte hain. Jahan user ne pakka rang likha hai wo waisa
 * ka waisa rehta hai — aur uski ginti neeche dikhti hai, taaki wo chhupa hua na
 * lage.
 */

/** Panel me dikhne wale token — poori list (35+) me se kaam ke. */
const SHOWN_TOKENS = [
  "brand.primary",
  "brand.accent",
  "brand.text",
  "brand.textMuted",
  "brand.background",
  "brand.surface",
] as const;

const POSITIONS = [
  { value: "top-left", label: "↖" },
  { value: "top-right", label: "↗" },
  { value: "bottom-left", label: "↙" },
  { value: "bottom-right", label: "↘" },
] as const;

export function BrandPanel() {
  const doc = useEditorStore((state) => state.doc);
  const applyOp = useEditorStore((state) => state.applyOp);

  const brand = doc.brand;
  const tokens = brandTokensFor(brand);
  const report = brandOverrides(doc);

  const convertible = overridesToTokens(doc, tokenByColor(tokens));

  return (
    <div className="space-y-3 p-3 text-[11px]">
      <section className="space-y-1.5">
        <h3 className="text-[10px] uppercase tracking-wide text-chalk-500">Preset</h3>
        <div className="space-y-1">
          {BUILTIN_BRAND_PRESETS.map((preset) => {
            const active = brand.presetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() =>
                  applyOp("setBrandPreset", { presetId: preset.id }, { label: preset.name })
                }
                className={clsx(
                  "flex w-full items-center gap-2 rounded border px-1.5 py-1 text-left transition-colors",
                  active
                    ? "border-terracotta bg-terracotta/15 text-chalk-200"
                    : "border-ink-600 text-chalk-400 hover:bg-ink-700",
                )}
              >
                <span className="flex shrink-0 gap-0.5">
                  {["brand.primary", "brand.accent", "brand.background"].map((token) => (
                    <span
                      key={token}
                      className="h-3 w-3 rounded-sm border border-black/30"
                      style={{ backgroundColor: preset.tokens[token] }}
                    />
                  ))}
                </span>
                <span className="min-w-0 flex-1 truncate">{preset.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-1 border-t border-ink-800 pt-2">
        <h3 className="text-[10px] uppercase tracking-wide text-chalk-500">Rang</h3>
        {SHOWN_TOKENS.map((token) => {
          const custom = brand.tokens[token] !== undefined;
          return (
            <label key={token} className="flex items-center gap-2 text-chalk-500">
              <span className="min-w-0 flex-1 truncate font-mono text-[10px]">
                {token.replace("brand.", "")}
              </span>
              <input
                type="color"
                value={tokens[token] ?? "#000000"}
                onChange={(event) =>
                  applyOp(
                    "setBrandToken",
                    { token, value: event.target.value },
                    { label: token, coalesceKey: `brand:${token}` },
                  )
                }
                className="h-5 w-8 shrink-0 cursor-pointer rounded border border-ink-600 bg-transparent"
              />
              {custom ? (
                <button
                  type="button"
                  title="Preset wala rang wapas"
                  onClick={() =>
                    applyOp("setBrandToken", { token, value: null }, { label: `${token} reset` })
                  }
                  className="shrink-0 text-[10px] text-chalk-500 underline hover:text-chalk-300"
                >
                  reset
                </button>
              ) : (
                <span className="w-8 shrink-0" />
              )}
            </label>
          );
        })}
      </section>

      {/*
       * Overrides ki ginti (17.11).
       *
       * ⚠️ Ye chhupa hua nahi hona chahiye. Brand badalne par jo jagah nahi
       * badli, uska pata user ko yahin chalna chahiye — warna wo baar-baar
       * preset badal kar sochta rehta hai ki "ye ek text kyun nahi badla".
       */}
      <section className="space-y-1 border-t border-ink-800 pt-2">
        <h3 className="text-[10px] uppercase tracking-wide text-chalk-500">Manual rang</h3>
        {report.overrides.length === 0 ? (
          <p className="text-chalk-500">
            Sab rang brand se aa rahe hain — preset badalne par poora look badlega.
          </p>
        ) : (
          <>
            <p className="text-chalk-400">
              <span className="text-amber">{report.overrides.length}</span> jagah pakka rang likha
              hai — wo brand badalne par nahi badlegi.
            </p>
            <ul className="max-h-24 space-y-0.5 overflow-y-auto">
              {report.overrides.slice(0, 8).map((site) => (
                <li key={`${site.itemId}:${site.path}`} className="flex items-center gap-1.5">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-sm border border-black/30"
                    style={{ backgroundColor: site.value }}
                  />
                  <span className="min-w-0 flex-1 truncate text-chalk-500" title={site.path}>
                    {site.itemName}
                  </span>
                </li>
              ))}
            </ul>
            {convertible.length > 0 ? (
              <button
                type="button"
                title="Sirf wo rang jo brand me pehle se hain"
                onClick={() => {
                  for (const patch of convertible) {
                    applyOp(
                      "setItemProperty",
                      { itemId: patch.itemId, path: patch.path, value: patch.to },
                      { label: "Brand token", coalesceKey: "brand:tokenise" },
                    );
                  }
                }}
                className="w-full rounded border border-ink-600 px-1.5 py-0.5 text-chalk-400 hover:bg-ink-700"
              >
                {convertible.length} ko brand token bana do
              </button>
            ) : null}
          </>
        )}
      </section>

      <section className="space-y-1.5 border-t border-ink-800 pt-2">
        <div className="flex items-center justify-between">
          <h3 className="text-[10px] uppercase tracking-wide text-chalk-500">Watermark</h3>
          <button
            type="button"
            role="switch"
            aria-checked={brand.watermark.enabled}
            onClick={() =>
              applyOp(
                "setWatermark",
                { enabled: !brand.watermark.enabled },
                { label: "Watermark" },
              )
            }
            className={clsx(
              "h-3 w-6 rounded-full border transition-colors",
              brand.watermark.enabled
                ? "border-terracotta bg-terracotta"
                : "border-ink-500 bg-ink-700",
            )}
          />
        </div>

        {brand.watermark.enabled ? (
          <>
            <div className="flex items-center gap-2">
              <span className="w-16 shrink-0 text-chalk-500">Logo</span>
              <AssetPickerButton
                kind="image"
                assetId={brand.watermark.assetId}
                onPick={(assetId) =>
                  applyOp("setWatermark", { assetId }, { label: "Watermark logo" })
                }
              />
            </div>
            {brand.watermark.assetId === null ? (
              // Chup-chaap kuch na dikhana sabse bura hota — user sochta rehta
              // hai ki watermark toota hua hai, jabki wo bas khaali hai.
              <p className="text-amber">Logo chuno — uske bina watermark render me nahi aayega.</p>
            ) : null}

            <div className="flex items-center gap-2 text-chalk-500">
              <span className="w-16 shrink-0">Jagah</span>
              <div className="flex gap-1">
                {POSITIONS.map((position) => (
                  <button
                    key={position.value}
                    type="button"
                    onClick={() =>
                      applyOp(
                        "setWatermark",
                        { position: position.value },
                        { label: "Watermark ki jagah" },
                      )
                    }
                    className={clsx(
                      "h-5 w-5 rounded border transition-colors",
                      brand.watermark.position === position.value
                        ? "border-terracotta bg-terracotta/15 text-chalk-200"
                        : "border-ink-600 hover:bg-ink-700",
                    )}
                  >
                    {position.label}
                  </button>
                ))}
              </div>
            </div>

            <BrandSlider
              label="Size"
              value={brand.watermark.sizePercent}
              min={2}
              max={40}
              unit="%"
              onChange={(sizePercent) =>
                applyOp("setWatermark", { sizePercent }, { label: "Watermark size", coalesceKey: "wm:size" })
              }
            />
            <BrandSlider
              label="Opacity"
              value={Math.round(brand.watermark.opacity * 100)}
              min={10}
              max={100}
              unit="%"
              onChange={(value) =>
                applyOp(
                  "setWatermark",
                  { opacity: value / 100 },
                  { label: "Watermark opacity", coalesceKey: "wm:opacity" },
                )
              }
            />
          </>
        ) : null}
      </section>

      <section className="space-y-1.5 border-t border-ink-800 pt-2">
        <h3 className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-chalk-500">
          <Palette size={10} />
          CTA
        </h3>
        <input
          value={brand.cta.text}
          placeholder="Ek hi kaam batao"
          onChange={(event) =>
            applyOp(
              "setBrandCta",
              { text: event.target.value },
              { label: "CTA text", coalesceKey: "brand:cta-text" },
            )
          }
          className="w-full rounded border border-ink-600 bg-ink-900 px-1.5 py-1 text-chalk-200 outline-none focus:border-terracotta"
        />
        <input
          value={brand.cta.link}
          placeholder="https://…"
          onChange={(event) =>
            applyOp(
              "setBrandCta",
              { link: event.target.value },
              { label: "CTA link", coalesceKey: "brand:cta-link" },
            )
          }
          className="w-full rounded border border-ink-600 bg-ink-900 px-1.5 py-1 text-chalk-200 outline-none focus:border-terracotta"
        />
        <p className="text-chalk-500">
          CTA text scene me apne aap nahi aata — use CTA scene ya text item me daalo. Yahan wo
          project ke saath yaad rehta hai.
        </p>
      </section>
    </div>
  );
}

function BrandSlider({
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
    <label className="flex items-center gap-2 text-chalk-500">
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
