"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";

export type ToastKind = "success" | "error" | "info";
type ToastItem = { id: number; kind: ToastKind; text: string };

type ToastCtx = { toast: (kind: ToastKind, text: string) => void };

const Ctx = createContext<ToastCtx | null>(null);

let counter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const reduce = useReducedMotion();

  const remove = useCallback((id: number) => {
    setItems((list) => list.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (kind: ToastKind, text: string) => {
      const id = ++counter;
      setItems((list) => [...list, { id, kind, text }]);
      setTimeout(() => remove(id), 4200);
    },
    [remove],
  );

  return (
    <Ctx.Provider value={{ toast }}>
      {children}

      {/* Top-right stack */}
      <div className="pointer-events-none fixed inset-x-4 top-4 z-[80] flex flex-col items-center gap-2.5 sm:inset-x-auto sm:right-5 sm:top-5 sm:items-end">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <ToastCard
              key={t.id}
              item={t}
              reduce={!!reduce}
              onClose={() => remove(t.id)}
            />
          ))}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

/**
 * Toast ka rang — theme ke saath badalta hua.
 *
 * ⚠️ Pehle yahan teen tay rgba() the aur text hamesha `text-white`. Dono theme
 * me ek hi rang ka matlab yahi tha ki dark mode me toast dikhta hi nahi:
 *
 *   • `info` ka bg `rgba(46,40,35,.97)` tha — theek wahi rang jo dark page ka
 *     background hai (`--c-cream: 26 23 20`). Ek gehre patch par gehra patch:
 *     user ko sirf ek halki si parchhai dikhti thi.
 *   • `success` ka sage aur `error` ka terracotta bhi dark theme ke liye alag
 *     (ujle) shade rakhte hain, aur un par safed text 3.4:1 par gir jaata hai —
 *     WCAG AA se saaf neeche.
 *
 * Ab teenon rang wahi CSS variables se aate hain jo poori site use karti hai,
 * isliye theme badalte hi ye khud sahi ho jaate hain. Text `text-cream` hai —
 * wo bhi ulta hota hai (light me ujla, dark me gehra), yaani har soorat me
 * background se ulta. Bilkul wahi hisaab jo app ke toast me hai.
 */
const STYLES: Record<ToastKind, { bg: string; icon: React.ReactNode }> = {
  success: { bg: "bg-sage/95", icon: <CheckCircle2 size={18} /> },
  error: { bg: "bg-terracotta-dark/95", icon: <AlertCircle size={18} /> },
  info: { bg: "bg-ink/95", icon: <Info size={18} /> },
};

function ToastCard({
  item,
  reduce,
  onClose,
}: {
  item: ToastItem;
  reduce: boolean;
  onClose: () => void;
}) {
  const s = STYLES[item.kind];
  const { a11y } = useT();
  return (
    <motion.div
      layout
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: 32, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 32, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className={`pointer-events-auto flex w-full items-center gap-3 rounded-2xl border border-cream/25 px-4 py-3.5 text-cream shadow-warm backdrop-blur-md sm:w-auto sm:max-w-sm ${s.bg}`}
      role="status"
      aria-live="polite"
    >
      {/* Rang `currentColor` se — parent ka `text-cream` dono theme me ulta
          hota hai, isliye icon aur border apne aap saath chalte hain. */}
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-cream/20">
        {s.icon}
      </span>
      <p className="flex-1 text-sm font-semibold leading-snug">{item.text}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label={a11y.close}
        className="shrink-0 rounded-full p-0.5 opacity-70 transition hover:bg-cream/20 hover:opacity-100"
      >
        <X size={15} />
      </button>
    </motion.div>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
