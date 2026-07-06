"use client";

import {
  createContext,
  useCallback,
  useContext,
  useState,
} from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

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

const STYLES: Record<
  ToastKind,
  { bg: string; icon: React.ReactNode }
> = {
  success: {
    bg: "rgba(124,138,107,0.97)",
    icon: <CheckCircle2 size={18} />,
  },
  error: { bg: "rgba(168,73,43,0.97)", icon: <AlertCircle size={18} /> },
  info: { bg: "rgba(46,40,35,0.97)", icon: <Info size={18} /> },
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
  return (
    <motion.div
      layout
      initial={reduce ? { opacity: 0 } : { opacity: 0, x: 32, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, x: 32, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 380, damping: 30 }}
      className="pointer-events-auto flex w-full items-center gap-3 rounded-2xl border border-white/20 px-4 py-3.5 shadow-warm backdrop-blur-md sm:w-auto sm:max-w-sm"
      style={{ backgroundColor: s.bg }}
      role="status"
      aria-live="polite"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/20 text-white">
        {s.icon}
      </span>
      <p className="flex-1 text-sm font-semibold leading-snug text-white">
        {item.text}
      </p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="shrink-0 rounded-full p-0.5 text-white/70 transition hover:bg-white/20 hover:text-white"
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
