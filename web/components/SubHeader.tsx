"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import SaathiMark from "@/components/SaathiMark";
import { useT } from "@/lib/i18n/LanguageProvider";

export default function SubHeader() {
  const t = useT();
  const pathname = usePathname();

  const linkCls = (href: string) =>
    `rounded-full px-2.5 py-2 text-[13px] font-semibold transition sm:px-3 sm:text-sm ${
      pathname === href
        ? "bg-terracotta/10 text-terracotta"
        : "text-ink-soft hover:bg-cream-deep/50 hover:text-ink"
    }`;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-cream/80 backdrop-blur-md">
      <div className="container-page flex items-center justify-between gap-2 py-3 sm:py-4">
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-terracotta text-white shadow-warm sm:h-10 sm:w-10">
            <SaathiMark size={22} className="text-white" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight sm:text-2xl">
            Apka Saathi
          </span>
        </Link>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2.5">
          {/* Mobile pe nav chhupao taaki language switcher hamesha dikhe.
              Logo tap se home; footer me saare links. */}
          <nav className="hidden items-center sm:flex">
            <Link href="/" className={linkCls("/")}>
              {t.nav.home}
            </Link>
            <Link href="/about" className={linkCls("/about")}>
              {t.nav.about}
            </Link>
            <Link href="/contact" className={linkCls("/contact")}>
              {t.nav.contact}
            </Link>
          </nav>
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
