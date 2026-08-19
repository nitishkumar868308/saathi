"use client";

import type { ControlDescriptor } from "@reel/core";
import type { ComponentType } from "react";

import type { MaybeMixed } from "@/lib/properties";

/**
 * Har control ka ek hi interface (9.2).
 *
 * Yahi wo cheez hai jo "naya item type = zero panel code" ko sach banati hai:
 * panel ko sirf `control.control` ka naam pata hota hai, aur wo registry se
 * component uthakar ye props de deta hai. Kisi control ko ye pata nahi hota ki
 * wo kis item par lag raha hai — aur usko pata hona bhi nahi chahiye.
 */
export interface ControlProps {
  control: ControlDescriptor;
  /** Multi-select me `MIXED` ho sakti hai — har control ko ye sambhalna hota hai. */
  value: MaybeMixed;
  onChange(value: unknown): void;
  /** Double-click par default par wapas (9.4). Default registry se aati hai. */
  onReset(): void;
  disabled?: boolean;
}

export type ControlComponent = ComponentType<ControlProps>;
