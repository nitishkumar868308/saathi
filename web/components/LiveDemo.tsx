"use client";

import { useEffect, useState } from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
} from "framer-motion";
import { Upload, ScanText, BellRing, Check, FileText } from "lucide-react";

const STAGES = [
  {
    key: "upload",
    icon: Upload,
    title: "Upload",
    caption: "Document ki photo daali",
    accent: "text-terracotta",
    ring: "ring-terracotta/25",
    dot: "bg-terracotta",
  },
  {
    key: "read",
    icon: ScanText,
    title: "AI Read",
    caption: "Saathi ne padha & samjha",
    accent: "text-amber-warm",
    ring: "ring-amber-warm/25",
    dot: "bg-amber-warm",
  },
  {
    key: "reminder",
    icon: BellRing,
    title: "Reminder Created",
    caption: "Expiry se pehle yaad dila denge",
    accent: "text-sage",
    ring: "ring-sage/25",
    dot: "bg-sage",
  },
] as const;

export default function LiveDemo() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (reduce) {
      setActive(STAGES.length - 1);
      return;
    }
    const id = setInterval(
      () => setActive((a) => (a + 1) % STAGES.length),
      2200,
    );
    return () => clearInterval(id);
  }, [reduce]);

  return (
    <div className="mx-auto w-full max-w-3xl">
      {/* Stage rail */}
      <div className="relative grid grid-cols-3 gap-2 sm:gap-4">
        {/* connecting line */}
        <div
          aria-hidden
          className="absolute left-[16.66%] right-[16.66%] top-7 h-0.5 bg-line sm:top-8"
        />
        <motion.div
          aria-hidden
          className="absolute left-[16.66%] top-7 h-0.5 origin-left bg-terracotta sm:top-8"
          style={{ right: "16.66%" }}
          animate={{ scaleX: active / (STAGES.length - 1) }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />

        {STAGES.map((s, i) => {
          const on = i <= active;
          const isCurrent = i === active;
          const Icon = s.icon;
          return (
            <div key={s.key} className="relative z-10 flex flex-col items-center text-center">
              <motion.span
                className={`flex h-14 w-14 items-center justify-center rounded-2xl border border-line bg-surface shadow-soft ring-4 ring-transparent sm:h-16 sm:w-16 ${
                  on ? `${s.accent} ${isCurrent ? s.ring : ""}` : "text-ink-soft/40"
                }`}
                animate={
                  reduce
                    ? undefined
                    : { scale: isCurrent ? 1.08 : 1, y: isCurrent ? -2 : 0 }
                }
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                {on && i < active ? (
                  <Check size={24} strokeWidth={2.4} />
                ) : (
                  <Icon size={24} strokeWidth={2} />
                )}
              </motion.span>
              <span
                className={`mt-3 font-display text-sm font-semibold sm:text-base ${
                  on ? "text-ink" : "text-ink-soft/50"
                }`}
              >
                {s.title}
              </span>
              <span className="mt-0.5 hidden text-xs text-ink-soft sm:block">
                {s.caption}
              </span>
            </div>
          );
        })}
      </div>

      {/* Live preview card */}
      <div className="mt-8 overflow-hidden rounded-3xl border border-line bg-surface p-5 shadow-soft sm:p-7">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -12 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
          >
            {active === 0 && (
              <div className="flex items-center gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-terracotta/10 text-terracotta">
                  <FileText size={26} />
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">
                    car-insurance.jpg
                  </p>
                  <p className="text-sm text-ink-soft">
                    Aapne bas ek photo bheji — bas itna hi.
                  </p>
                </div>
              </div>
            )}
            {active === 1 && (
              <div className="space-y-3">
                <p className="text-sm font-semibold text-amber-warm">
                  Saathi padh raha hai…
                </p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {[
                    ["Type", "Car Insurance"],
                    ["Policy", "TATA AIG"],
                    ["Expiry", "12 March 2026"],
                  ].map(([k, v]) => (
                    <div
                      key={k}
                      className="rounded-xl border border-line bg-cream-deep/30 px-3 py-2.5"
                    >
                      <p className="text-[11px] font-bold uppercase tracking-wide text-ink-soft">
                        {k}
                      </p>
                      <p className="mt-0.5 text-sm font-semibold text-ink">{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {active === 2 && (
              <div className="flex items-start gap-4">
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-sage/15 text-sage">
                  <BellRing size={26} />
                </span>
                <div>
                  <p className="font-semibold text-ink">
                    Reminder set — 3 alerts
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {["1 mahina pehle", "1 hafta pehle", "Expiry ke din"].map(
                      (t) => (
                        <span
                          key={t}
                          className="inline-flex items-center gap-1.5 rounded-full bg-sage/10 px-3 py-1 text-xs font-semibold text-sage"
                        >
                          <Check size={12} strokeWidth={3} />
                          {t}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
