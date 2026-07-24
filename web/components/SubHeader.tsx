"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import SaathiWordmark from "@/components/SaathiWordmark";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * Poori site ka shared header — home aur baaki pages dono.
 *
 * Mobile pe pehle nav links (Home/About/Contact) chhup jaate the kyunki language
 * switcher unhe screen se bahar dhakel deta tha. Ab mobile pe ek hamburger menu
 * hai jisme saare links + "Dost ko bulao" button aate hain. Desktop pe sab ek
 * line me. "Dost ko bulao" referral page (/referral) kholta hai.
 *
 * Saare internal links Next.js <Link> hain — isliye About/Contact pe jaate waqt
 * poora page reload nahi hota (pehle <a> tags the, isliye reload hota tha).
 */
export default function SubHeader() {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Route badle to mobile menu apne aap band.
  useEffect(() => setOpen(false), [pathname]);

  const links = [
    { href: "/", label: t.nav.home },
    { href: "/about", label: t.nav.about },
    { href: "/contact", label: t.nav.contact },
  ];

  const linkCls = (href: string) =>
    `rounded-full px-3 py-2 text-sm font-semibold transition ${
      pathname === href
        ? "bg-terracotta/10 text-terracotta"
        : "text-ink-soft hover:bg-cream-deep/50 hover:text-ink"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/80 backdrop-blur-md">
      <div className="container-page flex items-center justify-between gap-2 py-3 sm:py-4">
        <Link href="/" className="flex shrink-0 items-center" aria-label="Apka Saathi">
          <SaathiWordmark className="h-10 sm:h-11" />
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-1.5 sm:flex">
          <nav className="flex items-center">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className={linkCls(l.href)}>
                {l.label}
              </Link>
            ))}
          </nav>
          <LanguageSwitcher />
        </div>

        {/* Mobile controls */}
        <div className="flex shrink-0 items-center gap-1.5 sm:hidden">
          <LanguageSwitcher />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label={t.nav.menu}
            aria-expanded={open}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-ink transition hover:bg-cream-deep/40"
          >
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div className="border-t border-line bg-cream/95 backdrop-blur-md sm:hidden">
          <nav className="container-page flex flex-col gap-1 py-3">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-xl px-4 py-3 text-[15px] font-semibold transition ${
                  pathname === l.href
                    ? "bg-terracotta/10 text-terracotta"
                    : "text-ink hover:bg-cream-deep/50"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
