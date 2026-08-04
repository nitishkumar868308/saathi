"use client";

import { Monitor, Moon, Sun } from "lucide-react";

import { THEMES, useTheme, type Theme } from "@/lib/theme";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * Light / dark / system — teen chhote button, ek patti me.
 *
 * Dropdown ki jagah teen saaf button isliye: dark mode ek aisi cheez hai jise
 * log baar-baar badalte hain (din me light, raat ko dark), aur har baar do tap
 * lagna khijhata hai. Yahan chunav ek hi nazar me dikhta bhi hai aur ek hi tap
 * me badalta bhi hai.
 */

const ICONS: Record<Theme, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

export default function ThemeToggle({ className = "" }: { className?: string }) {
  const [theme, setTheme] = useTheme();
  const t = useT();

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5 ${className}`}
      role="group"
      aria-label={t.theme.label}
    >
      {THEMES.map((k) => {
        const Icon = ICONS[k];
        const active = theme === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => setTheme(k)}
            aria-pressed={active}
            title={t.theme[k]}
            aria-label={t.theme[k]}
            className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
              active ? "bg-ink text-cream" : "text-ink-soft hover:text-ink"
            }`}
          >
            <Icon size={14} />
          </button>
        );
      })}
    </div>
  );
}
