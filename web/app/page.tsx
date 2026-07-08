"use client";

import {
  FileClock,
  Sunrise,
  Mic,
  Sparkles,
  ShieldCheck,
  Bell,
  ScanLine,
  Globe,
  Lock,
  MessageCircleHeart,
  Sun,
  Clock,
  Plane,
  BadgeCheck,
  Cake,
  IndianRupee,
} from "lucide-react";
import DownloadApp from "@/components/DownloadApp";
import HeroVisual from "@/components/HeroVisual";
import Marquee from "@/components/Marquee";
import Faq from "@/components/Faq";
import Reveal from "@/components/Reveal";
import LiveDemo from "@/components/LiveDemo";
import TrustSection from "@/components/TrustSection";
import SupportedDocs from "@/components/SupportedDocs";
import Testimonials from "@/components/Testimonials";
import Pricing from "@/components/Pricing";
import ReferralSection from "@/components/ReferralSection";
import Footer from "@/components/Footer";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import SaathiMark from "@/components/SaathiMark";
import { useT } from "@/lib/i18n/LanguageProvider";

const featureIcons = [FileClock, Sunrise, Mic, MessageCircleHeart, Lock];
const featureAccents = [
  "bg-terracotta/10 text-terracotta",
  "bg-amber-warm/15 text-amber-warm",
  "bg-sage/15 text-sage",
  "bg-terracotta/10 text-terracotta",
  "bg-sage/15 text-sage",
];
const stepIcons = [ScanLine, Sparkles, Bell];
const dayIcons = [Sun, FileClock, Mic];
const dayColors = [
  "bg-amber-warm/15 text-amber-warm",
  "bg-terracotta/10 text-terracotta",
  "bg-sage/15 text-sage",
];
const exampleIcons = [Plane, ShieldCheck, Cake, IndianRupee];
const trustIcons = [ShieldCheck, Mic, MessageCircleHeart, Bell];

export default function Home() {
  const t = useT();

  return (
    <div className="relative overflow-hidden">
      {/* Soft background blobs */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="blob -left-32 -top-24 h-80 w-80 bg-amber-warm/25 sm:h-96 sm:w-96" />
        <div className="blob right-[-8rem] top-44 h-80 w-80 bg-terracotta/15 sm:h-[28rem] sm:w-[28rem]" />
        <div className="blob bottom-[20%] left-1/4 h-72 w-72 bg-sage/15" />
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-line/0 bg-cream/80 backdrop-blur-md">
        <div className="container-page flex items-center justify-between gap-2 py-3 sm:py-4">
          <a href="/" className="flex shrink-0 items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-terracotta text-white shadow-warm sm:h-10 sm:w-10">
              <SaathiMark size={22} className="text-white" />
            </span>
            <span className="font-display text-lg font-semibold tracking-tight sm:text-2xl">
              Apka Saathi
            </span>
          </a>
          <div className="flex items-center gap-1 sm:gap-2.5">
            <nav className="flex items-center">
              <a
                href="/"
                className="rounded-full bg-terracotta/10 px-2.5 py-2 text-[13px] font-semibold text-terracotta transition sm:px-3 sm:text-sm"
              >
                {t.nav.home}
              </a>
              <a
                href="/about"
                className="rounded-full px-2.5 py-2 text-[13px] font-semibold text-ink-soft transition hover:bg-cream-deep/50 hover:text-ink sm:px-3 sm:text-sm"
              >
                {t.nav.about}
              </a>
              <a
                href="/contact"
                className="rounded-full px-2.5 py-2 text-[13px] font-semibold text-ink-soft transition hover:bg-cream-deep/50 hover:text-ink sm:px-3 sm:text-sm"
              >
                {t.nav.contact}
              </a>
            </nav>
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="container-page grid items-center gap-8 pb-12 pt-6 sm:gap-10 sm:pt-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:pb-24">
          <div>
            <div className="animate-fade-up">
              <span className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-ink-soft">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-terracotta" />
                {t.hero.badge}
              </span>
            </div>

            <div className="animate-fade-up [animation-delay:80ms]">
              <h1 className="mt-4 font-display text-4xl font-semibold leading-[1.08] tracking-tight sm:mt-6 sm:text-6xl lg:text-[4.25rem]">
                {t.hero.titleA}
                <br />
                {t.hero.titleB}{" "}
                <span className="relative inline-block text-terracotta">
                  {t.hero.titleAccent}
                  <svg
                    aria-hidden
                    viewBox="0 0 200 12"
                    className="absolute -bottom-1 left-0 h-3 w-full text-amber-warm"
                    preserveAspectRatio="none"
                  >
                    <path
                      d="M2 8 C 50 2, 150 2, 198 8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
              </h1>
              <p className="mt-3 font-display text-sm font-semibold uppercase tracking-[0.2em] text-terracotta/80">
                {t.hero.tagline}
              </p>
            </div>

            <div className="animate-fade-up [animation-delay:160ms]">
              <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft sm:mt-6 sm:text-xl">
                {t.hero.desc.pre}
                <span className="font-semibold text-ink">
                  {t.hero.desc.strong}
                </span>
                {t.hero.desc.post}
              </p>
            </div>

            <div className="animate-fade-up [animation-delay:240ms]">
              <div className="mt-7 max-w-xl sm:mt-8" id="download">
                <DownloadApp />
              </div>
            </div>

            <div className="animate-fade-up [animation-delay:360ms]">
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2.5 text-sm text-ink-soft">
                {t.hero.trust.map((label, i) => {
                  const Icon = trustIcons[i] ?? ShieldCheck;
                  return (
                    <span key={label} className="inline-flex items-center gap-2">
                      <Icon size={15} className="text-sage" />
                      {label}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Hero visual: premium animated phone + floating cards */}
          <div className="order-first animate-fade-up [animation-delay:200ms] lg:order-none">
            <HeroVisual />
          </div>
        </section>

        {/* Real-life examples strip */}
        <section className="container-page pb-10 sm:pb-14">
          <Reveal>
            <p className="mb-4 text-center text-sm font-semibold uppercase tracking-widest text-ink-soft">
              {t.hero.examplesLabel}
            </p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
              {t.hero.examples.map((ex, i) => {
                const Icon = exampleIcons[i] ?? BadgeCheck;
                return (
                  <div
                    key={ex.label}
                    className="group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-warm"
                  >
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta transition group-hover:scale-110">
                      <Icon size={20} />
                    </span>
                    <div className="min-w-0 leading-tight">
                      <p className="truncate font-display text-base font-semibold">
                        {ex.label}
                      </p>
                      <p className="truncate text-xs text-ink-soft">{ex.sub}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Reveal>
        </section>

        {/* Marquee */}
        <Marquee />

        {/* Insight strip — Saathi bina pooche yaad dilata hai */}
        <section className="container-page py-14 sm:py-20">
          <Reveal>
            <p className="mx-auto max-w-3xl text-center font-display text-2xl font-medium leading-snug text-ink sm:text-4xl">
              {t.insight.pre}{" "}
              <span className="text-terracotta">{t.insight.accent}</span>
            </p>
          </Reveal>
        </section>

        {/* Features */}
        <section id="features" className="container-page scroll-mt-24 pb-16 sm:pb-24">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
                {t.features.heading}
              </h2>
              <p className="mt-3 text-base text-ink-soft sm:mt-4 sm:text-lg">
                {t.features.sub}
              </p>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-4 sm:mt-14 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
            {t.features.items.map((f, i) => {
              const Icon = featureIcons[i] ?? Sparkles;
              return (
                <Reveal key={f.title} delay={i * 0.06}>
                  <div className="group h-full rounded-4xl border border-line bg-surface p-6 shadow-soft transition duration-300 hover:-translate-y-1.5 hover:border-terracotta/25 hover:shadow-warm sm:p-7">
                    <span
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl transition duration-300 group-hover:scale-110 group-hover:-rotate-3 ${featureAccents[i]}`}
                    >
                      <Icon size={24} strokeWidth={2} />
                    </span>
                    <h3 className="mt-5 font-display text-xl font-semibold">
                      {f.title}
                    </h3>
                    <p className="mt-2.5 leading-relaxed text-ink-soft">
                      {f.body}
                    </p>
                  </div>
                </Reveal>
              );
            })}

            <Reveal delay={0.3}>
              <div className="flex h-full flex-col justify-center rounded-4xl bg-ink p-7 text-cream shadow-soft">
                <h3 className="font-display text-2xl font-semibold leading-snug">
                  {t.features.cta.title}
                </h3>
                <p className="mt-3 leading-relaxed text-cream/70">
                  {t.features.cta.body}
                </p>
                <a
                  href="#download"
                  className="mt-6 inline-flex w-fit items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta-dark active:scale-95"
                >
                  {t.features.cta.button}
                </a>
              </div>
            </Reveal>
          </div>
        </section>

        {/* Live product demo */}
        <section id="demo" className="scroll-mt-24 bg-cream-deep/40 py-16 sm:py-28">
          <div className="container-page">
            <Reveal>
              <div className="mx-auto max-w-2xl text-center">
                <span className="inline-flex items-center gap-2 rounded-full bg-terracotta/10 px-4 py-1.5 text-sm font-semibold text-terracotta">
                  <Sparkles size={15} />
                  {t.demo.badge}
                </span>
                <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight sm:text-5xl">
                  {t.demo.heading}
                </h2>
                <p className="mt-3 text-base text-ink-soft sm:mt-4 sm:text-lg">
                  {t.demo.sub}
                </p>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="mt-12 sm:mt-14">
                <LiveDemo />
              </div>
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section className="container-page py-16 sm:py-28">
          <Reveal>
            <div className="mx-auto max-w-2xl text-center">
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
                {t.how.heading}
              </h2>
              <p className="mt-3 text-base text-ink-soft sm:mt-4 sm:text-lg">
                {t.how.sub}
              </p>
            </div>
          </Reveal>

          <div className="mt-12 grid gap-8 sm:mt-14 md:grid-cols-3 md:gap-6">
            {t.how.steps.map((s, i) => {
              const Icon = stepIcons[i] ?? Sparkles;
              return (
                <Reveal key={s.title} delay={i * 0.1}>
                  <div className="group text-center">
                    <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl border border-line bg-surface text-terracotta shadow-soft transition duration-300 group-hover:-translate-y-1 group-hover:shadow-warm">
                      <Icon size={26} strokeWidth={2} />
                    </div>
                    <span className="mt-5 inline-block font-display text-xs font-bold uppercase tracking-widest text-ink-soft">
                      Step {i + 1}
                    </span>
                    <h3 className="mt-1 font-display text-2xl font-semibold">
                      {s.title}
                    </h3>
                    <p className="mx-auto mt-2 max-w-xs leading-relaxed text-ink-soft">
                      {s.body}
                    </p>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* A day with Saathi */}
        <section className="container-page pb-16 sm:pb-28">
          <div className="grid gap-10 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
            <Reveal>
              <div className="lg:sticky lg:top-28">
                <span className="inline-flex items-center gap-2 rounded-full bg-terracotta/10 px-4 py-1.5 text-sm font-semibold text-terracotta">
                  <Clock size={15} />
                  {t.day.badge}
                </span>
                <h2 className="mt-5 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                  {t.day.heading}
                </h2>
                <p className="mt-4 text-base leading-relaxed text-ink-soft sm:text-lg">
                  {t.day.sub}
                </p>
              </div>
            </Reveal>

            <div className="relative space-y-4">
              <div
                aria-hidden
                className="absolute left-[26px] top-4 bottom-4 w-px bg-line sm:left-[30px]"
              />
              {t.day.items.map((d, i) => {
                const Icon = dayIcons[i] ?? Sun;
                return (
                  <Reveal key={d.time} delay={i * 0.1}>
                    <div className="relative flex gap-4 sm:gap-5">
                      <span
                        className={`relative z-10 flex shrink-0 items-center justify-center rounded-2xl border-4 border-cream ${dayColors[i]}`}
                        style={{ height: 52, width: 52 }}
                      >
                        <Icon size={22} />
                      </span>
                      <div className="flex-1 rounded-3xl border border-line bg-surface p-5 shadow-soft transition duration-300 hover:shadow-warm">
                        <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                          {d.time}
                        </p>
                        <p className="mt-2 leading-relaxed text-ink">{d.text}</p>
                      </div>
                    </div>
                  </Reveal>
                );
              })}
            </div>
          </div>
        </section>

        {/* Trust / Your Data Your Control */}
        <section className="container-page pb-16 sm:pb-28">
          <Reveal>
            <TrustSection />
          </Reveal>
        </section>

        {/* Supported documents */}
        <section className="bg-cream-deep/40 py-16 sm:py-28">
          <div className="container-page">
            <Reveal>
              <SupportedDocs />
            </Reveal>
          </div>
        </section>

        {/* India-first */}
        <section className="container-page py-16 sm:py-28">
          <Reveal>
            <div className="overflow-hidden rounded-[2rem] border border-line bg-surface shadow-soft sm:rounded-[2.5rem]">
              <div className="grid items-center gap-8 p-7 sm:p-12 lg:grid-cols-2 lg:p-16">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full bg-terracotta/10 px-4 py-1.5 text-sm font-semibold text-terracotta">
                    <Globe size={15} />
                    {t.india.badge}
                  </span>
                  <h2 className="mt-5 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                    {t.india.heading}
                  </h2>
                  <p className="mt-4 text-base leading-relaxed text-ink-soft sm:text-lg">
                    {t.india.body}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  {t.india.items.map((doc) => (
                    <div
                      key={doc}
                      className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-line bg-cream-deep/30 px-3 py-3.5 transition hover:border-terracotta/30 hover:bg-surface sm:gap-3 sm:px-4"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta">
                        <FileClock size={17} />
                      </span>
                      <span className="min-w-0 break-words text-sm font-semibold">
                        {doc}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Reveal>
        </section>

        {/* Testimonials */}
        <section className="bg-cream-deep/40 py-16 sm:py-28">
          <div className="container-page">
            <Reveal>
              <Testimonials />
            </Reveal>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="container-page scroll-mt-24 py-16 sm:py-28">
          <Reveal>
            <Pricing />
          </Reveal>
        </section>

        {/* Referral — click pe /referral (login ke peeche) */}
        <section id="referral" className="container-page scroll-mt-24 pb-16 sm:pb-24">
          <Reveal>
            <ReferralSection />
          </Reveal>
        </section>

        {/* FAQ */}
        <section id="faq" className="container-page scroll-mt-24 pb-16 sm:pb-28">
          <Reveal>
            <div className="mx-auto mb-10 max-w-2xl text-center sm:mb-12">
              <h2 className="font-display text-3xl font-semibold tracking-tight sm:text-5xl">
                {t.faq.heading}
              </h2>
            </div>
          </Reveal>
          <Reveal delay={0.05}>
            <Faq />
          </Reveal>
        </section>

        {/* Final CTA */}
        <section className="container-page pb-20 sm:pb-24">
          <Reveal>
            <div className="relative overflow-hidden rounded-[2rem] bg-ink px-6 py-14 text-center text-cream sm:rounded-[2.5rem] sm:px-12 sm:py-20">
              <div aria-hidden className="absolute inset-0 -z-0">
                <div className="blob -right-20 -top-20 h-72 w-72 bg-terracotta/30" />
                <div className="blob -bottom-24 -left-10 h-72 w-72 bg-amber-warm/20" />
              </div>
              <div className="relative mx-auto max-w-2xl">
                <h2 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-5xl">
                  {t.finalCta.heading}
                </h2>
                <p className="mt-4 text-base text-cream/75 sm:text-lg">
                  {t.finalCta.sub}
                </p>
                <div className="mx-auto mt-8 flex max-w-lg flex-col items-center">
                  <DownloadApp dark />
                </div>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      <Footer />
    </div>
  );
}
