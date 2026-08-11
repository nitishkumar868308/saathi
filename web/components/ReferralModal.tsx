"use client";

import { useEffect } from "react";
import { Gift, X, Smartphone, FileText, Bell } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useOffers } from "@/lib/useOffers";
import { tpl } from "@/lib/offers";
import { PLAY_STORE_URL } from "@/lib/links";

/**
 * Referral modal — landing auto-open aur section ke CTA click, dono ke liye
 * ek hi (same) design. Compact, warm, aur responsive: mobile pe bottom sheet,
 * desktop pe centered card. Reward ke 2 kaam (document + reminder) alag se,
 * icons ke saath saaf-saaf.
 */
export default function ReferralModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { referral: t, a11y } = useT();
  const offers = useOffers();
  const vars = { d: offers.referralDays };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const tasks = [
    { icon: FileText, label: t.taskDocument },
    { icon: Bell, label: t.taskReminder },
  ];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/60 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[92vh] w-full max-w-md animate-pop-in flex-col overflow-hidden rounded-t-3xl bg-surface shadow-warm sm:rounded-[1.75rem]"
      >
        {/* ---------- Header (compact, warm) ---------- */}
        <div className="relative bg-gradient-to-br from-terracotta to-amber-warm px-6 pb-5 pt-6 text-center">
          <span
            aria-hidden
            className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10"
          />
          <span
            aria-hidden
            className="absolute -bottom-10 -left-6 h-24 w-24 rounded-full bg-black/5"
          />
          <button
            onClick={onClose}
            aria-label={a11y.close}
            className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
          >
            <X size={15} />
          </button>

          <div className="relative mx-auto flex h-14 w-14 animate-float items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30">
            <Gift size={26} className="text-white" strokeWidth={1.9} />
          </div>
          <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/95">
            <Gift size={12} />
            {t.badge}
          </p>
        </div>

        {/* ---------- Body (scrolls only if needed) ---------- */}
        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <h2
            className="animate-fade-up text-balance font-display text-[1.55rem] font-semibold leading-[1.15] tracking-tight"
            style={{ animationDelay: "0.04s" }}
          >
            {tpl(t.cardTitle, vars)}
          </h2>
          <p
            className="mt-2 animate-fade-up text-sm leading-relaxed text-ink-soft"
            style={{ animationDelay: "0.1s" }}
          >
            {tpl(t.sub, vars)}
          </p>

          {/* Steps 1 & 2 */}
          <div
            className="mt-5 animate-fade-up space-y-2"
            style={{ animationDelay: "0.16s" }}
          >
            {t.steps.slice(0, 2).map((step, i) => (
              <div
                key={step}
                className="flex items-center gap-3 rounded-xl border border-line bg-cream-deep/25 px-3.5 py-2.5"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-terracotta text-[11px] font-bold text-white">
                  {i + 1}
                </span>
                <span className="text-[13.5px] leading-snug text-ink">{step}</span>
              </div>
            ))}

            {/* Step 3 — reward ke 2 kaam, alag se saaf-saaf */}
            <div className="rounded-xl border border-terracotta/25 bg-terracotta/[0.06] px-3.5 py-3">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-terracotta text-[11px] font-bold text-white">
                  3
                </span>
                <span className="text-[13.5px] font-bold text-ink">
                  {t.tasksTitle}
                </span>
              </div>
              <div className="mt-2.5 grid gap-2 pl-9">
                {tasks.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-2.5">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface text-terracotta shadow-soft">
                      <Icon size={15} />
                    </span>
                    <span className="text-[13.5px] font-semibold text-ink">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <p
            className="mt-4 flex animate-fade-up items-start gap-2 text-xs leading-relaxed text-ink-soft"
            style={{ animationDelay: "0.24s" }}
          >
            <Gift size={14} className="mt-0.5 shrink-0 text-terracotta" />
            {tpl(t.capNote, vars)}
          </p>
        </div>

        {/* ---------- CTA (sticky footer) ---------- */}
        <div className="border-t border-line bg-surface px-5 py-4 sm:px-6">
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-[52px] w-full items-center justify-center gap-2.5 rounded-2xl bg-terracotta px-6 text-[15px] font-semibold text-white shadow-warm transition hover:bg-terracotta-dark active:scale-[0.99]"
          >
            <Smartphone size={18} />
            {t.downloadApp}
          </a>
        </div>
      </div>
    </div>
  );
}
