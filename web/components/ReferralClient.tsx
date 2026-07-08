"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import {
  Gift,
  Copy,
  Check,
  Share2,
  Loader2,
  LogOut,
  Smartphone,
  MessageCircle,
  Info,
} from "lucide-react";
import SubHeader from "@/components/SubHeader";
import Footer from "@/components/Footer";
import { supabaseBrowser, supabaseConfigured } from "@/lib/supabase-browser";
import { useOffers } from "@/lib/useOffers";
import { tpl } from "@/lib/offers";
import { useT } from "@/lib/i18n/LanguageProvider";
import { PLAY_STORE_URL } from "@/lib/links";

type Info = { code: string | null; daysEarned: number; total: number; rewarded: number };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://apkasaathi.com";

/* ------------------------------- Page shell ------------------------------- */

/**
 * Poora page = SubHeader + content + Footer. Andar ka content state ke hisaab
 * se badalta hai, par header/footer hamesha rehte hain — warna user phans jaata
 * hai (na nav, na wapas jaane ka raasta).
 */
function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-cream">
      <SubHeader />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}

/** Hero band — har state me same, taki page kabhi khaali na lage. */
function Hero({ badge, heading, sub }: { badge: string; heading: string; sub: string }) {
  return (
    <section className="relative overflow-hidden border-b border-line">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-72 w-72 rounded-full bg-amber-warm/20 blur-3xl" />
        <div className="absolute -right-24 top-10 h-72 w-72 rounded-full bg-terracotta/12 blur-3xl" />
      </div>
      <div className="container-page relative py-12 text-center sm:py-16">
        <span className="inline-flex items-center gap-2 rounded-full border border-terracotta/25 bg-terracotta/8 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-terracotta">
          <Gift size={13} />
          {badge}
        </span>
        <h1 className="mx-auto mt-5 max-w-2xl text-balance font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl md:text-5xl">
          {heading}
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-base leading-relaxed text-ink-soft sm:text-lg">
          {sub}
        </p>
      </div>
    </section>
  );
}

/** Content ke liye ek narrow, centered container. */
function Body({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div className="container-page py-10 sm:py-14">
      <div className={wide ? "mx-auto max-w-5xl" : "mx-auto max-w-md"}>{children}</div>
    </div>
  );
}

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-4xl border border-line bg-surface p-6 shadow-warm sm:p-8 ${className}`}
    >
      {children}
    </div>
  );
}

/** "Kaise kaam karta hai" — login se pehle bhi, baad me bhi dikhta hai. */
function Steps({ steps, capNote }: { steps: string[]; capNote: string }) {
  return (
    <div>
      <ol className="space-y-4">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-4">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-terracotta/10 font-display text-base font-bold text-terracotta">
              {i + 1}
            </span>
            <p className="pt-1.5 text-sm leading-relaxed text-ink-soft">{s}</p>
          </li>
        ))}
      </ol>
      <p className="mt-6 flex items-start gap-2.5 rounded-2xl border border-line bg-cream-deep/25 p-4 text-xs leading-relaxed text-ink-soft">
        <Info size={15} className="mt-px shrink-0 text-terracotta" />
        {capNote}
      </p>
    </div>
  );
}

/* -------------------------------- Root -------------------------------- */

export default function ReferralClient() {
  const { referral: t } = useT();
  const offers = useOffers();
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    if (!supabaseBrowser) {
      setBooting(false);
      return;
    }
    supabaseBrowser.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setBooting(false);
    });
    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const days = offers.referralDays;
  const cap = offers.referralCapMonths;
  const hero = (
    <Hero badge={t.badge} heading={t.heading} sub={tpl(t.sub, { d: days })} />
  );

  if (!supabaseConfigured || !offers.referralsEnabled) {
    return (
      <Page>
        {hero}
        <Body>
          <Card className="text-center">
            <p className="text-sm leading-relaxed text-ink-soft">
              {supabaseConfigured ? t.disabled : t.notConfigured}
            </p>
            <a
              href={PLAY_STORE_URL}
              className="mt-6 inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-terracotta px-6 text-sm font-semibold text-white shadow-warm transition hover:bg-terracotta-dark"
            >
              <Smartphone size={16} />
              {t.downloadApp}
            </a>
          </Card>
        </Body>
      </Page>
    );
  }

  if (booting) {
    return (
      <Page>
        {hero}
        <Body>
          <div className="flex justify-center py-10">
            <Loader2 className="animate-spin text-terracotta" size={28} />
          </div>
        </Body>
      </Page>
    );
  }

  return (
    <Page>
      {hero}
      <Body wide>
        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:gap-10">
          {/* Mobile pe pehle asli kaam (code / login), steps neeche */}
          <div className="order-1">
            {session ? <ReferralCard session={session} days={days} cap={cap} /> : <LoginCard />}
          </div>
          <Card className="order-2 lg:sticky lg:top-24">
            <h2 className="font-display text-xl font-semibold">{t.heading}</h2>
            <p className="mt-1.5 text-sm text-ink-soft">{tpl(t.sub, { d: days })}</p>
            <div className="mt-6">
              <Steps steps={t.steps} capNote={tpl(t.capNote, { d: days, cap })} />
            </div>
          </Card>
        </div>
      </Body>
    </Page>
  );
}

/* ------------------------------- Login ------------------------------- */

function LoginCard() {
  const { referral: t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function login(e: React.FormEvent) {
    e.preventDefault();
    if (!supabaseBrowser || busy) return;
    setBusy(true);
    setError("");
    const { error } = await supabaseBrowser.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) setError(error.message);
    setBusy(false);
  }

  async function google() {
    if (!supabaseBrowser) return;
    await supabaseBrowser.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${SITE}/referral` },
    });
  }

  const input =
    "mt-1.5 h-12 w-full rounded-2xl border border-line bg-cream-deep/20 px-4 text-base outline-none transition focus:border-terracotta focus:ring-4 focus:ring-terracotta/15";

  return (
    <Card>
      <h2 className="font-display text-2xl font-semibold">{t.loginTitle}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{t.loginSub}</p>

      <form onSubmit={login} className="mt-6">
        <label className="text-sm font-semibold" htmlFor="ref-email">
          {t.email}
        </label>
        <input
          id="ref-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="aapka@email.com"
          className={input}
          autoComplete="email"
          required
        />
        <label className="mt-4 block text-sm font-semibold" htmlFor="ref-pass">
          {t.password}
        </label>
        <input
          id="ref-pass"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="••••••"
          className={input}
          autoComplete="current-password"
          required
        />
        {error && <p className="mt-3 text-sm font-medium text-terracotta-dark">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-terracotta px-6 text-base font-semibold text-white shadow-warm transition hover:bg-terracotta-dark disabled:opacity-70"
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : t.loginBtn}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-ink-soft">{t.or}</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <button
        onClick={google}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-6 text-sm font-semibold text-ink transition hover:bg-cream-deep/40"
      >
        {t.google}
      </button>

      <p className="mt-6 text-center text-sm text-ink-soft">
        {t.noAccount}{" "}
        <a href={PLAY_STORE_URL} className="font-semibold text-terracotta hover:underline">
          {t.downloadApp}
        </a>
      </p>
    </Card>
  );
}

/* ------------------------------ Referral ----------------------------- */

function ReferralCard({ session, days, cap }: { session: Session; days: number; cap: number }) {
  const { referral: t } = useT();
  const [info, setInfo] = useState<Info | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabaseBrowser) return;
    try {
      const uid = session.user.id;
      const [{ data: prof, error: pErr }, { data: refs }] = await Promise.all([
        supabaseBrowser
          .from("profiles")
          .select("referral_code, referral_days_earned")
          .eq("id", uid)
          .single(),
        supabaseBrowser.from("referrals").select("rewarded_at").eq("referrer_id", uid),
      ]);
      if (pErr) throw pErr;
      const list = refs ?? [];
      setInfo({
        code: (prof?.referral_code as string) ?? null,
        daysEarned: (prof?.referral_days_earned as number) ?? 0,
        total: list.length,
        rewarded: list.filter((r) => r.rewarded_at).length,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  useEffect(() => {
    load();
  }, [load]);

  const link = info?.code ? `${SITE}/r/${info.code}` : "";
  const message = tpl(t.shareMessage, { d: days, link });

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked */
    }
  }

  async function nativeShare() {
    if (!link) return;
    if (navigator.share) await navigator.share({ text: message }).catch(() => {});
    else copy();
  }

  const capDays = cap * 30;
  const earned = info?.daysEarned ?? 0;
  const pct = Math.min(100, Math.round((earned / capDays) * 100));

  if (loading) {
    return (
      <Card>
        <div className="flex justify-center py-10">
          <Loader2 className="animate-spin text-terracotta" size={26} />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <p className="text-center text-sm text-terracotta-dark">{error}</p>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="font-display text-2xl font-semibold">{tpl(t.cardTitle, { d: days })}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">{tpl(t.cardSub, { d: days })}</p>

      <div className="mt-6 rounded-3xl border-2 border-dashed border-terracotta bg-terracotta/[0.07] px-4 py-6 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
          {t.yourCode}
        </p>
        <p className="mt-2 break-all font-display text-3xl font-bold tracking-[0.28em] text-terracotta sm:text-4xl">
          {info?.code ?? "—"}
        </p>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-2xl border border-line bg-cream-deep/20 px-3 py-2.5">
        <p className="min-w-0 flex-1 truncate text-sm text-ink-soft">{link || "—"}</p>
        <button
          onClick={copy}
          disabled={!link}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-cream transition hover:opacity-90 disabled:opacity-50"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? t.copied : t.copy}
        </button>
      </div>

      <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(message)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-sage px-4 text-sm font-semibold text-white transition hover:opacity-90"
        >
          <MessageCircle size={16} />
          {t.whatsapp}
        </a>
        <button
          onClick={nativeShare}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-terracotta px-4 text-sm font-semibold text-white shadow-warm transition hover:bg-terracotta-dark"
        >
          <Share2 size={16} />
          {t.share}
        </button>
      </div>

      <div className="mt-7 grid grid-cols-2 gap-2.5">
        <Stat label={t.statReferrals} value={info?.rewarded ?? 0} />
        <Stat label={t.statDays} value={earned} />
      </div>

      <p className="mt-4 text-xs font-medium text-ink-soft">
        {tpl(t.capLine, { earned, capDays, cap })}
      </p>
      <div
        className="mt-2 h-2.5 overflow-hidden rounded-full bg-line"
        role="progressbar"
        aria-valuenow={earned}
        aria-valuemin={0}
        aria-valuemax={capDays}
      >
        <div
          className="h-full rounded-full bg-sage transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>

      {(info?.total ?? 0) > (info?.rewarded ?? 0) && (
        <p className="mt-4 rounded-2xl bg-amber-warm/12 p-3.5 text-sm leading-relaxed text-ink-soft">
          {tpl(t.pending, { x: (info?.total ?? 0) - (info?.rewarded ?? 0) })}
        </p>
      )}

      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <a
          href={PLAY_STORE_URL}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta hover:underline"
        >
          <Smartphone size={15} />
          {t.openApp}
        </a>
        <button
          onClick={() => supabaseBrowser?.auth.signOut()}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft transition hover:text-ink"
        >
          <LogOut size={15} />
          {t.logout}
        </button>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-cream-deep/20 p-4 text-center">
      <p className="font-display text-3xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink-soft">{label}</p>
    </div>
  );
}
