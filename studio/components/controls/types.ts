"use client";

import type { ControlDescriptor, FontEntry } from "@reel/core";
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
  /**
   * Is machine par abhi maujood fonts — built-in + `public/fonts/fonts.json` (9.10).
   *
   * Panel se aati hai, control ke andar se **padhi nahi jaati**. Font ki list
   * chalti-firti cheez hai (fonts.json kabhi bhi badal sakti hai), aur usko
   * control ke andar import kar lene par wo list wahin jam jaati hai — phir
   * `fonts.json` me daala font dropdown me kabhi nahi aata.
   *
   * `undefined` ka matlab "list abhi aayi nahi" — control built-in par gir
   * jaata hai, kyunki khaali dropdown dikhana usse bura hai.
   */
  fonts?: readonly FontEntry[];
}

export type ControlComponent = ComponentType<ControlProps>;
