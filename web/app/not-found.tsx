import type { Metadata } from "next";
import Link from "next/link";
import { Home, FileText, Mail, ArrowRight } from "lucide-react";

import SubHeader from "@/components/SubHeader";
import Footer from "@/components/Footer";

/**
 * 404 — page nahi mila.
 *
 * Do cheezein zaroori hain:
 *  1. `noindex` — warna Google har toota hua URL ko ek asli page samajh leta hai
 *     aur "soft 404" ki warning aati hai.
 *  2. Aage ka raasta. Khaali "Not found" likh dena user ko wahin chhod deta hai;
 *     yahan seedhe woh links hain jahan log jaana chahte the.
 */
export const metadata: Metadata = {
  title: "Page not found",
  description: "This page does not exist. Here is the way back.",
  robots: { index: false, follow: true },
};

const LINKS = [
  { href: "/", icon: Home, label: "Home", sub: "What Saathi does" },
  { href: "/blog", icon: FileText, label: "Blog", sub: "Guides on documents and reminders" },
  { href: "/contact", icon: Mail, label: "Contact", sub: "Tell us what you were looking for" },
];

export default function NotFound() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-cream">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="blob -left-32 -top-24 h-80 w-80 bg-amber-warm/15 sm:h-96 sm:w-96" />
      </div>

      <SubHeader />

      <main className="container-page flex min-h-[60vh] items-center py-14 sm:py-20">
        <div className="mx-auto w-full max-w-xl text-center">
          <p className="font-display text-6xl font-semibold text-terracotta sm:text-7xl">
            404
          </p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight sm:text-4xl">
            This page went missing
          </h1>
          <p className="mt-3 leading-relaxed text-ink-soft">
            Saathi remembers a lot of things, but this page is not one of them.
            The link may be old, or the address may have a typo.
          </p>

          <div className="mt-8 space-y-3 text-left">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-4 transition hover:border-terracotta/40"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-terracotta/10 text-terracotta">
                  <l.icon size={19} />
                </span>
                <span className="flex-1">
                  <span className="block font-semibold text-ink">{l.label}</span>
                  <span className="block text-sm text-ink-soft">{l.sub}</span>
                </span>
                <ArrowRight size={17} className="text-ink-soft" />
              </Link>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
