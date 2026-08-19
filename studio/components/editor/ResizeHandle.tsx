"use client";

import clsx from "clsx";
import { useRef } from "react";

/**
 * Do panel ke beech ka pakadne wala kinara.
 *
 * Pointer events use hote hain (mouse nahi) — `setPointerCapture` ki wajah se
 * drag tab bhi chalti rehti hai jab pointer iframe ya preview ke upar chala
 * jaaye. Sirf `mousemove` se wahin drag chhoot jaati hai, aur wo bug samajhne
 * me sabse zyada waqt khaata hai.
 */

interface Props {
  orientation: "vertical" | "horizontal";
  /** Drag ka delta px me — caller apna hisaab (jodna/ghatana) khud karta hai. */
  onDelta(delta: number): void;
  label: string;
}

export function ResizeHandle({ orientation, onDelta, label }: Props) {
  const last = useRef<number | null>(null);
  const vertical = orientation === "vertical";

  return (
    <div
      role="separator"
      aria-orientation={vertical ? "vertical" : "horizontal"}
      aria-label={label}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        last.current = vertical ? event.clientX : event.clientY;
      }}
      onPointerMove={(event) => {
        if (last.current === null) return;
        const position = vertical ? event.clientX : event.clientY;
        onDelta(position - last.current);
        last.current = position;
      }}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        last.current = null;
      }}
      className={clsx(
        "shrink-0 bg-ink-900 transition-colors hover:bg-terracotta/60",
        vertical ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize",
      )}
    />
  );
}
