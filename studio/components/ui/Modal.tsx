"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

import { IconButton } from "@/components/ui/Button";

/**
 * Saada modal — koi library nahi.
 *
 * `<dialog>` ka native modal aakarshak lagta hai par uske andar focus, backdrop
 * aur Escape ka behaviour browser-dar-browser alag hai. Yahan sirf teen cheezein
 * chahiye thi: backdrop, Escape, aur scroll lock.
 */

interface ModalProps {
  open: boolean;
  title: string;
  onClose(): void;
  children: ReactNode;
  footer?: ReactNode;
  /** Chaudai — `max-w-*` class. */
  width?: string;
}

export function Modal({ open, title, onClose, children, footer, width = "max-w-lg" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative w-full ${width} max-h-[88vh] overflow-auto rounded-xl border border-ink-600 bg-ink-800 shadow-2xl`}
      >
        <header className="flex items-center justify-between border-b border-ink-600 px-5 py-3">
          <h2 className="text-sm font-semibold tracking-tight text-chalk-100">{title}</h2>
          <IconButton onClick={onClose} aria-label="Band karo">
            <X size={16} />
          </IconButton>
        </header>
        <div className="px-5 py-4">{children}</div>
        {footer ? (
          <footer className="flex items-center justify-end gap-2 border-t border-ink-600 px-5 py-3">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>
  );
}
