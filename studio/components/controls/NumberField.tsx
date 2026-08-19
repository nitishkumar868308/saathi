"use client";

import clsx from "clsx";
import { useEffect, useRef, useState } from "react";

/**
 * Number ka khaana — jise **label ghaseet kar** bhi badla ja sakta hai (9.4).
 *
 * Teen tareeke, teeno ek hi jagah:
 *  - label par pointer ghaseeto -> value badalti hai
 *  - khaane me type karo -> Enter ya blur par lagti hai
 *  - arrow keys -> ek step; Shift ke saath dus guna
 *  - label par double-click -> default par wapas
 *
 * ⚠️ Ghaseetne ke dauraan `value` prop badalti rehti hai, isliye drag ka hisaab
 * **shuruaati value** se hota hai (`startValue`), maujooda se nahi. Maujooda se
 * karne par har pointermove pichhle nateeje ke upar judta hai aur value ungli se
 * kai guna tez bhagti hai — ye galti dekh kar samajh nahi aati, sirf "control
 * pagal ho gaya" lagta hai.
 *
 * ⚠️ Type karte waqt local text rakha jaata hai. Seedha `value` par likhne se
 * "1.5" type karna namumkin ho jaata hai: "1." parse hokar 1 ban jaata hai aur
 * dashamlav mit jaata hai.
 */
export function NumberField({
  value,
  mixed,
  min,
  max,
  step = 1,
  unit,
  disabled,
  onChange,
  onReset,
  label,
}: {
  value: number;
  mixed?: boolean;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  onChange(next: number): void;
  onReset?(): void;
  /** Ghaseetne wala label. Na do to sirf khaana dikhta hai. */
  label?: string;
}) {
  const [text, setText] = useState<string>("");
  const [typing, setTyping] = useState(false);

  useEffect(() => {
    if (!typing) setText(mixed ? "" : formatNumber(value));
  }, [value, mixed, typing]);

  const dragging = useRef(false);

  function clamp(next: number): number {
    let out = next;
    if (min !== undefined) out = Math.max(min, out);
    if (max !== undefined) out = Math.min(max, out);
    // Step ke hisaab se round — warna 0.1 step par 0.30000000000000004 aata hai.
    const decimals = decimalsOf(step);
    return Number(out.toFixed(decimals));
  }

  function commit(raw: string): void {
    const parsed = Number(raw.replace(",", "."));
    if (!Number.isFinite(parsed)) {
      setText(mixed ? "" : formatNumber(value));
      return;
    }
    onChange(clamp(parsed));
  }

  function nudge(direction: number, big: boolean): void {
    const base = mixed ? 0 : value;
    onChange(clamp(base + direction * step * (big ? 10 : 1)));
  }

  return (
    <span className="flex min-w-0 items-center gap-1">
      {label ? (
        <span
          role="slider"
          tabIndex={-1}
          aria-label={label}
          aria-valuenow={mixed ? undefined : value}
          title={`${label} — ghaseeto, ya double-click se default`}
          className={clsx(
            "shrink-0 cursor-ew-resize select-none text-[11px] text-chalk-500",
            disabled && "cursor-not-allowed opacity-50",
          )}
          onDoubleClick={() => onReset?.()}
          onPointerDown={(event) => {
            if (disabled) return;
            event.preventDefault();
            const element = event.currentTarget;
            element.setPointerCapture(event.pointerId);
            dragging.current = true;

            const startX = event.clientX;
            // Drag ka hisaab shuruaati value se — upar wala ⚠️ dekho.
            const startValue = mixed ? 0 : value;

            function onMove(move: PointerEvent) {
              if (!dragging.current) return;
              // Har 3px par ek step: ungli ke hisaab se sahi lagta hai aur
              // choti step wali property par bhi bhagta nahi.
              const steps = Math.round((move.clientX - startX) / 3);
              onChange(clamp(startValue + steps * step * (move.shiftKey ? 10 : 1)));
            }
            function onUp() {
              dragging.current = false;
              element.removeEventListener("pointermove", onMove);
              element.removeEventListener("pointerup", onUp);
            }
            element.addEventListener("pointermove", onMove);
            element.addEventListener("pointerup", onUp);
          }}
        >
          {label}
        </span>
      ) : null}

      <input
        type="text"
        inputMode="decimal"
        value={text}
        placeholder={mixed ? "—" : undefined}
        disabled={disabled}
        onChange={(event) => {
          setTyping(true);
          setText(event.target.value);
        }}
        onBlur={(event) => {
          setTyping(false);
          commit(event.target.value);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.currentTarget.blur();
            return;
          }
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            // Yahan rok zaroori hai: warna arrow poore editor tak pahunch kar
            // playhead/clip bhi hila deta hai (6.4 / 8.10).
            event.preventDefault();
            event.stopPropagation();
            nudge(event.key === "ArrowUp" ? 1 : -1, event.shiftKey);
          }
        }}
        className="w-full min-w-0 rounded border border-ink-600 bg-ink-900 px-1.5 py-0.5 text-right text-xs tabular-nums outline-none focus:border-terracotta disabled:opacity-50"
      />
      {unit ? <span className="shrink-0 text-[10px] text-chalk-500">{unit}</span> : null}
    </span>
  );
}

function decimalsOf(step: number): number {
  const text = String(step);
  const at = text.indexOf(".");
  return at === -1 ? 0 : text.length - at - 1;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "";
  // Lambe dashamlav khaane me bhare rehna padhne layak nahi hota.
  return String(Number(value.toFixed(4)));
}
