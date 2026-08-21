"use client";

import clsx from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * Ek button, teen roop.
 *
 * ⚠️ `disabled` par `title` dena **zaroori** hai (README rule 5). Studio me
 * kuch buttons jaan-boojhkar band hain kyunki unka phase abhi aaya nahi —
 * band button jiska koi kaaran na dikhe, wo toote hue button jaisa hi lagta hai.
 */

export type ButtonVariant = "primary" | "ghost" | "danger" | "subtle";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  icon?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-terracotta text-white hover:bg-terracotta/90 border-transparent",
  ghost: "bg-transparent text-chalk-100 hover:bg-ink-700 border-ink-600",
  subtle: "bg-ink-700 text-chalk-100 hover:bg-ink-600 border-ink-600",
  danger: "bg-transparent text-red-300 hover:bg-red-500/10 border-red-500/40",
};

export function Button({
  variant = "subtle",
  icon,
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm",
        // Wahi wajah jo IconButton me likhi hai — ungli wale device par poora naap.
        "[@media(pointer:coarse)]:min-h-[44px] [@media(pointer:coarse)]:px-4",
        "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber/60",
        "disabled:cursor-not-allowed disabled:opacity-40",
        VARIANTS[variant],
        className,
      )}
    >
      {icon}
      {children}
    </button>
  );
}

/** Toolbar ka chhota, sirf-icon wala button. */
export function IconButton({
  variant = "ghost",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type="button"
      {...rest}
      className={clsx(
        "inline-flex h-8 w-8 items-center justify-center rounded-md border",
        /*
         * ⚠️ Ungli wale device par 44px — aur ye **screen ki chaudai se nahi,
         * pointer se** tay hota hai. Chaudai galat sawaal hai: touchscreen
         * laptop par bhi ungli hi chalti hai, aur maus wale chhote window me
         * 44px ka button bekaar jagah khaata hai. `pointer: coarse` seedha yahi
         * poochhta hai — "is device par ishaara motha hai kya?".
         *
         * 44px Apple ka aur 48px Google ka naap hai; 32px (h-8) dono se aadha
         * hai aur phone par uspar ungli rakhna kismat ka khel ban jaata hai.
         */
        "[@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11",
        "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber/60",
        "disabled:cursor-not-allowed disabled:opacity-40",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </button>
  );
}
