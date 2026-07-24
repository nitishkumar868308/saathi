"use client";

import Link from "next/link";
import { Instagram, Twitter, Linkedin, Mail, Play } from "lucide-react";
import { usePathname } from "next/navigation";
import { useT } from "@/lib/i18n/LanguageProvider";
import SaathiWordmark from "@/components/SaathiWordmark";

// 👉 Apne asli social handles yahan daal dena jab pages ban jaayein.
const SOCIALS = [
  { icon: Instagram, label: "Instagram", href: "https://instagram.com/" },
  { icon: Twitter, label: "X (Twitter)", href: "https://x.com/" },
  { icon: Linkedin, label: "LinkedIn", href: "https://linkedin.com/" },
  { icon: Mail, label: "Email", href: "mailto:info@apkasaathi.com" },
];

export default function Footer() {
  const { footer: t } = useT();
  const pathname = usePathname();
  const year = new Date().getFullYear();

  const linkCls = (href: string) =>
    `transition ${
      pathname === href
        ? "font-semibold text-terracotta"
        : "text-ink-soft hover:text-terracotta"
    }`;

  return (
    <footer className="border-t border-line bg-cream-deep/20">
      <div className="container-page py-14 sm:py-16">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
          {/* Brand */}
          <div>
            <div className="flex items-center">
              <SaathiWordmark className="h-12" />
            </div>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-ink-soft">
              {t.tagline}
            </p>

            {/* Play Store coming soon */}
            <span className="mt-5 inline-flex items-center gap-2.5 rounded-2xl border border-line bg-surface px-4 py-2.5 shadow-soft">
              <Play size={18} className="fill-terracotta text-terracotta" />
              <span className="leading-tight">
                <span className="block text-[10px] font-semibold uppercase tracking-wide text-ink-soft">
                  Android
                </span>
                <span className="block text-sm font-semibold text-ink">
                  {t.playstore}
                </span>
              </span>
            </span>
          </div>

          {/* Product */}
          <nav aria-label={t.product}>
            <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">
              {t.product}
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[
                [t.links.features, "/#features"],
                [t.links.demo, "/#demo"],
                [t.links.pricing, "/#pricing"],
                [t.links.faq, "/#faq"],
                [t.links.about, "/about"],
                [t.links.referral, "/referral"],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className={linkCls(href)}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Legal */}
          <nav aria-label={t.legal}>
            <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">
              {t.legal}
            </p>
            <ul className="mt-4 space-y-2.5 text-sm">
              {[
                [t.links.privacy, "/privacy"],
                [t.links.terms, "/terms"],
                [t.links.contact, "/contact"],
              ].map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className={linkCls(href)}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Social */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-ink-soft">
              {t.social}
            </p>
            <div className="mt-4 flex gap-2.5">
              {SOCIALS.map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-ink-soft shadow-soft transition hover:-translate-y-0.5 hover:border-terracotta/40 hover:text-terracotta"
                >
                  <s.icon size={18} />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-line pt-6 text-sm text-ink-soft sm:flex-row">
          <p>
            © {year} Apka Saathi. {t.rights}
          </p>
          <p className="flex items-center gap-1.5">
            {t.madeIn}
          </p>
        </div>
      </div>
    </footer>
  );
}
