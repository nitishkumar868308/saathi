"use client";

import { useEffect, useRef, useState } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";
import { useLanguage } from "@/lib/i18n/LanguageProvider";
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/dictionaries";

export default function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const { locale, setLocale } = useLanguage();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Change language"
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-2 text-sm font-semibold transition sm:px-3 ${
          dark
            ? "border-white/20 bg-white/10 text-cream hover:bg-white/20"
            : "border-line bg-surface text-ink hover:border-terracotta/40 hover:bg-cream-deep/40"
        }`}
      >
        <Globe size={16} />
        <span className="hidden sm:inline">{LOCALE_META[locale].label}</span>
        <ChevronDown
          size={14}
          className={`hidden transition-transform sm:block ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute right-0 z-50 mt-2 w-40 overflow-hidden rounded-2xl border border-line bg-surface p-1 shadow-warm"
        >
          {LOCALES.map((l: Locale) => (
            <li key={l}>
              <button
                type="button"
                role="option"
                aria-selected={locale === l}
                onClick={() => {
                  setLocale(l);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-ink transition hover:bg-cream-deep/50 ${
                  locale === l ? "bg-cream-deep/40" : ""
                }`}
              >
                <span className="flex items-center gap-2">
                  <span aria-hidden>{LOCALE_META[l].flag}</span>
                  {LOCALE_META[l].label}
                </span>
                {locale === l && (
                  <Check size={15} className="text-terracotta" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
