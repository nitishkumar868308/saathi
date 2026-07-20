"use client";

import { useEffect, useState } from "react";
import { Gift, X, Smartphone, FileText, Bell, Sparkles } from "lucide-react";
import { useT } from "@/lib/i18n/LanguageProvider";
import { useOffers } from "@/lib/useOffers";
import { tpl } from "@/lib/offers";
import { PLAY_STORE_URL } from "@/lib/links";

/**
 * Home page khulte hi referral landing popup — page ke TOP-LEVEL pe.
 *
 * Ye ek alag, sajaya hua modal hai (neeche wale CTA modal se alag): warm
 * illustration header + entrance animation + staggered content, taaki user
 * turant band na kare — pehle padhe. Reward ke 2 kaam (ek document upload + ek
 * reminder) alag se, icons ke saath, saaf-saaf dikhaye gaye hain.
 */
export default function LandingReferralPopup() {
  const { referral: t } = useT();
  const offers = useOffers();
  const [open, setOpen] = useState(false);
  const days = offers.referralDays;
  const vars = { d: days };

  // Home khulte hi thodi der baad khulo (page pehle render ho jaaye).
  useEffect(() => {
    if (!offers.referralsEnabled) return;
    const id = setTimeout(() => setOpen(true), 700);
    return () => clearTimeout(id);
  }, [offers.referralsEnabled]);

  // Escape se band + background scroll lock.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!offers.referralsEnabled || !open) return null;

  const tasks = [
    { icon: FileText, label: t.taskDocument },
    { icon: Bell, label: t.taskReminder },
  ];

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/55 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[94vh] w-full max-w-md animate-pop-in overflow-y-auto rounded-t-4xl border border-line bg-surface shadow-warm sm:rounded-4xl"
      >
        {/* ---------- Illustration header (warm, celebratory) ---------- */}
        <div className="relative overflow-hidden bg-gradient-to-br from-terracotta via-terracotta to-amber-warm px-6 pb-8 pt-9">
          {/* Sparkles */}
          <Sparkles
            size={18}
            className="absolute left-8 top-7 animate-sparkle text-white/80"
            style={{ animationDelay: "0.2s" }}
          />
          <Sparkles
            size={13}
            className="absolute right-16 top-10 animate-sparkle text-white/70"
            style={{ animationDelay: "0.9s" }}
          />
          <Sparkles
            size={15}
            className="absolute bottom-6 left-16 animate-sparkle text-white/60"
            style={{ animationDelay: "1.4s" }}
          />
          <span
            aria-hidden
            className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/10"
          />
          <span
            aria-hidden
            className="absolute -bottom-12 -left-8 h-32 w-32 rounded-full bg-black/5"
          />

          {/* Close */}
          <button
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
          >
            <X size={16} />
          </button>

          {/* Floating gift + reward badge */}
          <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
            <span className="absolute inset-0 animate-float rounded-3xl bg-white/15 backdrop-blur" />
            <span className="absolute inset-0 flex animate-float items-center justify-center">
              <Gift size={44} className="text-white" strokeWidth={1.8} />
            </span>
            <span className="absolute -right-3 -top-2 animate-pulse-soft rounded-full bg-white px-2.5 py-1 text-xs font-extrabold text-terracotta shadow-warm">
              +{days}
            </span>
          </div>

          <span className="mt-5 flex items-center justify-center gap-2 text-center text-xs font-bold uppercase tracking-[0.2em] text-white/90">
            <Gift size={13} />
            {t.badge}
          </span>
        </div>

        {/* ---------- Content (staggered reveal) ---------- */}
        <div className="px-6 pb-6 pt-6 sm:px-7">
          <h2
            className="animate-fade-up text-balance font-display text-2xl font-semibold leading-tight tracking-tight sm:text-[1.7rem]"
            style={{ animationDelay: "0.05s" }}
          >
            {tpl(t.cardTitle, vars)}
          </h2>
          <p
            className="mt-2.5 animate-fade-up text-[15px] leading-relaxed text-ink-soft"
            style={{ animationDelay: "0.12s" }}
          >
            {tpl(t.sub, vars)}
          </p>

          {/* Steps 1 & 2 */}
          <ol
            className="mt-6 animate-fade-up space-y-2.5"
            style={{ animationDelay: "0.2s" }}
          >
            {t.steps.slice(0, 2).map((step, i) => (
              <li
                key={step}
                className="flex items-start gap-3.5 rounded-2xl border border-line bg-cream-deep/25 p-3.5"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-terracotta text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="pt-0.5 text-sm leading-snug text-ink">{step}</span>
              </li>
            ))}
          </ol>

          {/* Step 3 — reward ke 2 kaam, alag se saaf-saaf */}
          <div
            className="mt-2.5 animate-fade-up rounded-2xl border border-terracotta/25 bg-terracotta/[0.06] p-4"
            style={{ animationDelay: "0.28s" }}
          >
            <div className="flex items-center gap-3.5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-terracotta text-xs font-bold text-white">
                3
              </span>
              <p className="text-sm font-bold text-ink">{t.tasksTitle}</p>
            </div>
            <div className="mt-3 grid gap-2.5 pl-[2.6rem]">
              {tasks.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-surface text-terracotta shadow-soft">
                    <Icon size={16} />
                  </span>
                  <span className="text-sm font-semibold text-ink">{label}</span>
                </div>
              ))}
            </div>
          </div>

          <p
            className="mt-4 flex animate-fade-up items-start gap-2 text-sm font-medium text-ink-soft"
            style={{ animationDelay: "0.34s" }}
          >
            <Gift size={15} className="mt-0.5 shrink-0 text-terracotta" />
            {tpl(t.capNote, vars)}
          </p>

          {/* CTA — sirf app download, halka pulse taaki dhyaan jaaye */}
          <a
            href={PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex h-14 w-full animate-pulse-soft items-center justify-center gap-2.5 rounded-2xl bg-terracotta px-6 text-base font-semibold text-white shadow-warm transition hover:bg-terracotta-dark active:scale-[0.99]"
          >
            <Smartphone size={19} />
            {t.downloadApp}
          </a>
        </div>
      </div>
    </div>
  );
}
