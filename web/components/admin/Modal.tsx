"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

type Size = "sm" | "md" | "lg" | "xl";

const SIZE: Record<Size, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

/**
 * Ek hi modal sab admin sections ke liye — backdrop, Esc/click-out close,
 * body scroll-lock. Header (title + close) fixed, content scroll hota hai.
 */
export default function Modal({
  open,
  onClose,
  title,
  subtitle,
  size = "lg",
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  size?: Size;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => {
        if (!panelRef.current?.contains(e.target as Node)) onClose();
      }}
    >
      <div className="absolute inset-0 bg-ink/45 backdrop-blur-sm" />
      <div
        ref={panelRef}
        className={`relative flex max-h-[92vh] w-full ${SIZE[size]} flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-warm sm:rounded-3xl`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold text-ink">{title}</h3>
            {subtitle && <p className="mt-0.5 truncate text-sm text-ink-soft">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            aria-label="Band karo"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-ink-soft transition hover:text-terracotta"
          >
            <X size={16} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}
