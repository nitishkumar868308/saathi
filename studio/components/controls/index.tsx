"use client";

import {
  BUILTIN_FONTS,
  DEFAULT_BRAND_TOKENS,
  isBrandToken,
  resolveToken,
  type ControlKind,
} from "@reel/core";
import clsx from "clsx";
import { AlignCenter, AlignLeft, AlignRight } from "lucide-react";

import { NumberField } from "@/components/controls/NumberField";
import type { ControlComponent, ControlProps } from "@/components/controls/types";
import { isMixed } from "@/lib/properties";

/**
 * Control ka **registry** — `ControlKind` se component.
 *
 * Panel me `if (control.control === "slider")` jaisi ek bhi line nahi hai
 * (Dynamic rule 2/3). Naya control kism jodna = yahan ek entry aur ek component;
 * uske baad koi bhi registry entry usko use kar sakti hai.
 *
 * ⚠️ Har control ko `MIXED` sambhalna padta hai (9.5). Sabse aasan galti ye hai
 * ki multi-select me pehle item ki value dikha di jaaye — user ko lagta hai sab
 * clips ka rang laal hai, jabki sirf ek ka hai.
 */

/* ------------------------------------------------------------------ label */

function Row({
  control,
  children,
  stacked,
}: {
  control: ControlProps["control"];
  children: React.ReactNode;
  stacked?: boolean;
}) {
  return (
    <label
      className={clsx("block px-2 py-1", stacked ? "space-y-1" : "flex items-center gap-2")}
      title={control.help}
    >
      <span
        className={clsx(
          "text-[11px] text-chalk-500",
          stacked ? "block" : "w-24 shrink-0 truncate",
        )}
      >
        {control.label}
      </span>
      <span className={clsx("min-w-0", stacked ? "block" : "flex-1")}>{children}</span>
    </label>
  );
}

/* ----------------------------------------------------------------- number */

const NumberControl: ControlComponent = (props) => (
  <Row control={props.control}>
    <NumberField
      value={isMixed(props.value) ? 0 : Number(props.value ?? 0)}
      mixed={isMixed(props.value)}
      {...(props.control.min === undefined ? {} : { min: props.control.min })}
      {...(props.control.max === undefined ? {} : { max: props.control.max })}
      step={props.control.step ?? 1}
      {...(props.control.unit === undefined ? {} : { unit: props.control.unit })}
      {...(props.disabled === undefined ? {} : { disabled: props.disabled })}
      onChange={props.onChange}
      onReset={props.onReset}
      label="↔"
    />
  </Row>
);

/**
 * Slider + number ek saath.
 *
 * Sirf slider dena kaafi lagta hai par nahi hai: 0.01 step wali scale par exact
 * value slider se pakadna namumkin hota. Aur sirf number dena scrub karne ka
 * mazaa chheen leta hai. Dono ek hi value par chalte hain.
 */
const SliderControl: ControlComponent = (props) => {
  const mixed = isMixed(props.value);
  const min = props.control.min ?? 0;
  const max = props.control.max ?? 1;
  const step = props.control.step ?? 0.01;
  const value = mixed ? (min + max) / 2 : Number(props.value ?? min);

  return (
    <Row control={props.control}>
      <span className="flex items-center gap-2">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={props.disabled}
          onChange={(event) => props.onChange(Number(event.target.value))}
          onDoubleClick={props.onReset}
          className={clsx("h-1 min-w-0 flex-1 accent-terracotta", mixed && "opacity-40")}
        />
        <span className="w-16 shrink-0">
          <NumberField
            value={value}
            mixed={mixed}
            min={min}
            max={max}
            step={step}
            {...(props.disabled === undefined ? {} : { disabled: props.disabled })}
            onChange={props.onChange}
            onReset={props.onReset}
          />
        </span>
      </span>
    </Row>
  );
};

/* ------------------------------------------------------------------- text */

const TextControl: ControlComponent = (props) => (
  <Row control={props.control}>
    <input
      type="text"
      value={isMixed(props.value) ? "" : String(props.value ?? "")}
      placeholder={isMixed(props.value) ? "—" : undefined}
      disabled={props.disabled}
      onChange={(event) => props.onChange(event.target.value)}
      className="w-full rounded border border-ink-600 bg-ink-900 px-1.5 py-0.5 text-xs outline-none focus:border-terracotta"
    />
  </Row>
);

const TextareaControl: ControlComponent = (props) => (
  <Row control={props.control} stacked>
    <textarea
      rows={3}
      value={isMixed(props.value) ? "" : String(props.value ?? "")}
      placeholder={isMixed(props.value) ? "— (alag-alag)" : undefined}
      disabled={props.disabled}
      onChange={(event) => props.onChange(event.target.value)}
      className="w-full resize-y rounded border border-ink-600 bg-ink-900 px-1.5 py-1 text-xs outline-none focus:border-terracotta"
    />
  </Row>
);

/* ------------------------------------------------------------------ color */

/**
 * Rang — aur **brand tokens** (9.12).
 *
 * Chips par token save hota hai (`brand.primary`), hex nahi. Isi ek baat par
 * poora Phase 17 tika hai: brand badalne se saari reels badal jaayein. Hex daal
 * dene par har item ko haath se badalna padta.
 */
const ColorControl: ControlComponent = (props) => {
  const mixed = isMixed(props.value);
  const raw = mixed ? "" : String(props.value ?? "");
  const token = raw !== "" && isBrandToken(raw);
  const swatch = raw === "" ? "#000000" : resolveToken(raw, DEFAULT_BRAND_TOKENS);

  const brandColors = Object.entries(DEFAULT_BRAND_TOKENS).filter(
    ([name]) => !name.startsWith("brand.font."),
  );

  return (
    <Row control={props.control} stacked>
      <span className="flex items-center gap-1.5">
        <input
          type="color"
          value={/^#[0-9a-f]{6}$/i.test(swatch) ? swatch : "#000000"}
          disabled={props.disabled}
          onChange={(event) => props.onChange(event.target.value)}
          className="h-6 w-8 shrink-0 cursor-pointer rounded border border-ink-600 bg-ink-900"
          title={token ? `${raw} → ${swatch}` : swatch}
        />
        <input
          type="text"
          value={raw}
          placeholder={mixed ? "—" : "#RRGGBB ya brand.primary"}
          disabled={props.disabled}
          onChange={(event) => props.onChange(event.target.value)}
          className={clsx(
            "min-w-0 flex-1 rounded border bg-ink-900 px-1.5 py-0.5 text-xs outline-none focus:border-terracotta",
            token ? "border-amber/50 text-amber" : "border-ink-600",
          )}
        />
      </span>

      <span className="flex flex-wrap gap-1">
        {brandColors.map(([name, hex]) => (
          <button
            key={name}
            type="button"
            title={`${name} (${hex})`}
            onClick={() => props.onChange(name)}
            className={clsx(
              "h-4 w-4 rounded border",
              raw === name ? "border-amber ring-1 ring-amber" : "border-black/40",
            )}
            style={{ backgroundColor: hex }}
          />
        ))}
      </span>
    </Row>
  );
};

/* ------------------------------------------------------- select / segmented */

const SelectControl: ControlComponent = (props) => (
  <Row control={props.control}>
    <select
      value={isMixed(props.value) ? "" : String(props.value ?? "")}
      disabled={props.disabled}
      onChange={(event) => {
        const option = props.control.options?.find(
          (entry) => String(entry.value) === event.target.value,
        );
        props.onChange(option ? option.value : event.target.value);
      }}
      className="w-full rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-xs outline-none focus:border-terracotta"
    >
      {isMixed(props.value) ? <option value="">—</option> : null}
      {(props.control.options ?? []).map((option) => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  </Row>
);

const SegmentedControl: ControlComponent = (props) => (
  <Row control={props.control}>
    <span className="flex flex-wrap rounded border border-ink-600">
      {(props.control.options ?? []).map((option) => {
        const on = !isMixed(props.value) && props.value === option.value;
        return (
          <button
            key={String(option.value)}
            type="button"
            disabled={props.disabled}
            onClick={() => props.onChange(option.value)}
            className={clsx(
              "flex-1 px-1.5 py-0.5 text-[11px] transition-colors first:rounded-l last:rounded-r",
              on ? "bg-terracotta/25 text-chalk-100" : "text-chalk-500 hover:bg-ink-700",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </span>
  </Row>
);

/* ----------------------------------------------------------------- toggle */

const ToggleControl: ControlComponent = (props) => {
  const mixed = isMixed(props.value);
  return (
    <Row control={props.control}>
      <button
        type="button"
        role="switch"
        aria-checked={mixed ? "mixed" : Boolean(props.value)}
        disabled={props.disabled}
        onClick={() => props.onChange(mixed ? true : !props.value)}
        className={clsx(
          "h-4 w-8 rounded-full border transition-colors",
          mixed
            ? "border-amber/50 bg-amber/20"
            : props.value
              ? "border-terracotta bg-terracotta"
              : "border-ink-500 bg-ink-700",
        )}
      >
        <span
          className={clsx(
            "block h-3 w-3 rounded-full bg-chalk-100 transition-transform",
            mixed ? "translate-x-2.5" : props.value ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
    </Row>
  );
};

/**
 * Nullable object ka switch — stroke / shadow / background box / crop.
 *
 * On karne par `enableDefault` bhar jaata hai, off karne par `null`. Ye toggle
 * se alag isliye hai ki inka "off" `false` nahi **`null`** hota hai; `false`
 * likhne par schema hi toot jaata.
 */
const EnableControl: ControlComponent = (props) => {
  const mixed = isMixed(props.value);
  const on = !mixed && props.value !== null && props.value !== undefined;

  return (
    <Row control={props.control}>
      <button
        type="button"
        role="switch"
        aria-checked={mixed ? "mixed" : on}
        disabled={props.disabled}
        onClick={() => props.onChange(on ? null : (props.control.enableDefault ?? {}))}
        className={clsx(
          "h-4 w-8 rounded-full border transition-colors",
          mixed
            ? "border-amber/50 bg-amber/20"
            : on
              ? "border-terracotta bg-terracotta"
              : "border-ink-500 bg-ink-700",
        )}
      >
        <span
          className={clsx(
            "block h-3 w-3 rounded-full bg-chalk-100 transition-transform",
            mixed ? "translate-x-2.5" : on ? "translate-x-4" : "translate-x-0.5",
          )}
        />
      </button>
    </Row>
  );
};

/* --------------------------------------------------------------- vector2 */

const Vector2Control: ControlComponent = (props) => {
  const mixed = isMixed(props.value);
  const pair = Array.isArray(props.value) ? (props.value as number[]) : [0, 0];

  function setAt(index: 0 | 1, next: number): void {
    const out = [pair[0] ?? 0, pair[1] ?? 0];
    out[index] = next;
    props.onChange(out);
  }

  return (
    <Row control={props.control}>
      <span className="flex items-center gap-1.5">
        <NumberField
          value={pair[0] ?? 0}
          mixed={mixed}
          {...(props.control.min === undefined ? {} : { min: props.control.min })}
          {...(props.control.max === undefined ? {} : { max: props.control.max })}
          step={props.control.step ?? 0.01}
          {...(props.disabled === undefined ? {} : { disabled: props.disabled })}
          onChange={(next) => setAt(0, next)}
          onReset={props.onReset}
          label="X"
        />
        <NumberField
          value={pair[1] ?? 0}
          mixed={mixed}
          {...(props.control.min === undefined ? {} : { min: props.control.min })}
          {...(props.control.max === undefined ? {} : { max: props.control.max })}
          step={props.control.step ?? 0.01}
          {...(props.disabled === undefined ? {} : { disabled: props.disabled })}
          onChange={(next) => setAt(1, next)}
          onReset={props.onReset}
          label="Y"
        />
      </span>
    </Row>
  );
};

/* ------------------------------------------------------------------ align */

const ALIGN_ICONS = [
  { value: "left", label: "Left", Icon: AlignLeft },
  { value: "center", label: "Center", Icon: AlignCenter },
  { value: "right", label: "Right", Icon: AlignRight },
] as const;

const AlignControl: ControlComponent = (props) => (
  <Row control={props.control}>
    <span className="flex rounded border border-ink-600">
      {ALIGN_ICONS.map(({ value, label, Icon }) => {
        const on = !isMixed(props.value) && props.value === value;
        return (
          <button
            key={value}
            type="button"
            title={label}
            aria-label={label}
            disabled={props.disabled}
            onClick={() => props.onChange(value)}
            className={clsx(
              "flex flex-1 items-center justify-center py-1 transition-colors first:rounded-l last:rounded-r",
              on ? "bg-terracotta/25 text-chalk-100" : "text-chalk-500 hover:bg-ink-700",
            )}
          >
            <Icon size={12} />
          </button>
        );
      })}
    </span>
  </Row>
);

/* ------------------------------------------------------------------- font */

/**
 * Font picker (9.10).
 *
 * List `@reel/core` ke font registry se aati hai — wahi list jispar render bhi
 * chalta hai. Anjaan naam (purane doc me) list me nahi hoga, isliye use bhi ek
 * option ki tarah dikhaya jaata hai, saaf nishaan ke saath: chupchaap kisi aur
 * font par gir jaana ek baar dekh kar samajh nahi aata.
 */
const FontControl: ControlComponent = (props) => {
  const mixed = isMixed(props.value);
  const current = mixed ? "" : String(props.value ?? "");
  /*
   * List panel se aati hai (`props.fonts`), yahan se import nahi hoti — warna
   * `public/fonts/fonts.json` me daala font is dropdown me kabhi nahi aata,
   * chahe render use theek hi kyun na dikhaye (9.10).
   */
  const fonts = props.fonts ?? BUILTIN_FONTS;
  const known = fonts.some((font) => font.id === current);

  return (
    <Row control={props.control}>
      <select
        value={current}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
        className="w-full rounded border border-ink-600 bg-ink-900 px-1 py-0.5 text-xs outline-none focus:border-terracotta"
      >
        {mixed ? <option value="">—</option> : null}
        {!mixed && !known && current !== "" ? (
          <option value={current}>
            {current.startsWith("brand.") ? `${current} (brand token)` : `${current} (list me nahi)`}
          </option>
        ) : null}
        {fonts.map((font) => (
          <option key={font.id} value={font.id}>
            {font.label}
          </option>
        ))}
      </select>
    </Row>
  );
};

/* ------------------------------------------------------------------ asset */

const AssetControl: ControlComponent = (props) => (
  <Row control={props.control}>
    <span className="text-[11px] text-chalk-500">
      {isMixed(props.value) ? "—" : String(props.value ?? "koi asset nahi")}
    </span>
  </Row>
);

/* --------------------------------------------------------------- registry */

export const CONTROL_COMPONENTS: Record<ControlKind, ControlComponent> = {
  slider: SliderControl,
  number: NumberControl,
  text: TextControl,
  textarea: TextareaControl,
  color: ColorControl,
  select: SelectControl,
  segmented: SegmentedControl,
  toggle: ToggleControl,
  vector2: Vector2Control,
  asset: AssetControl,
  font: FontControl,
  align: AlignControl,
  enable: EnableControl,
};

export function controlComponent(kind: ControlKind): ControlComponent {
  return CONTROL_COMPONENTS[kind] ?? TextControl;
}
