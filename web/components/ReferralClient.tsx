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
} from "lucide-react";
import SaathiMark from "@/components/SaathiMark";
import { supabaseBrowser, supabaseConfigured } from "@/lib/supabase-browser";
import { useOffers } from "@/lib/useOffers";
import { PLAY_STORE_URL } from "@/lib/links";

type Info = { code: string | null; daysEarned: number; total: number; rewarded: number };

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "https://apkasaathi.com";

export default function ReferralClient() {
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
    const { data: sub } = supabaseBrowser.auth.onAuthStateChange((_e, s) =>
      setSession(s),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!supabaseConfigured) {
    return (
      <Shell>
        <p className="text-center text-ink-soft">
          Referral abhi web pe set nahi hai (<code>NEXT_PUBLIC_SUPABASE_URL</code> /{" "}
          <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> missing). Tab tak app se share karo.
        </p>
      </Shell>
    );
  }

  if (booting) {
    return (
      <Shell>
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-terracotta" size={26} />
        </div>
      </Shell>
    );
  }

  if (!offers.referralsEnabled) {
    return (
      <Shell>
        <p className="text-center text-ink-soft">
          Referral program abhi band hai. Baad me try karo 🙂
        </p>
      </Shell>
    );
  }

  return session ? (
    <ReferralCard session={session} days={offers.referralDays} cap={offers.referralCapMonths} />
  ) : (
    <LoginCard />
  );
}

/* ------------------------------- Shell ------------------------------- */

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-cream px-4 py-10 sm:px-5">
      <div className="w-full max-w-md rounded-4xl border border-line bg-surface p-6 shadow-warm sm:p-8">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-terracotta text-white shadow-warm">
            <SaathiMark size={21} className="text-white" />
          </span>
          <span className="font-display text-xl font-semibold">Apka Saathi</span>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------- Login ------------------------------- */

function LoginCard() {
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
    <Shell>
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-terracotta/10 text-terracotta">
        <Gift size={26} />
      </div>
      <h1 className="mt-5 text-center font-display text-2xl font-semibold">
        Apna referral link lo
      </h1>
      <p className="mt-2 text-center text-sm leading-relaxed text-ink-soft">
        Wahi account jo app me use karte ho — usi se login karo.
      </p>

      <form onSubmit={login} className="mt-6">
        <label className="text-sm font-semibold">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="aapka@email.com"
          className={input}
          autoComplete="email"
          required
        />
        <label className="mt-4 block text-sm font-semibold">Password</label>
        <input
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
          {busy ? <Loader2 size={18} className="animate-spin" /> : "Login karo"}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <span className="h-px flex-1 bg-line" />
        <span className="text-xs text-ink-soft">ya</span>
        <span className="h-px flex-1 bg-line" />
      </div>

      <button
        onClick={google}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-6 text-sm font-semibold text-ink transition hover:bg-cream-deep/40"
      >
        Google se continue karo
      </button>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Account nahi hai?{" "}
        <a href={PLAY_STORE_URL} className="font-semibold text-terracotta hover:underline">
          App download karo
        </a>
      </p>
    </Shell>
  );
}

/* ------------------------------ Referral ----------------------------- */

function ReferralCard({
  session,
  days,
  cap,
}: {
  session: Session;
  days: number;
  cap: number;
}) {
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
      setError(e instanceof Error ? e.message : "Info load nahi hui");
    } finally {
      setLoading(false);
    }
  }, [session.user.id]);

  useEffect(() => {
    load();
  }, [load]);

  const link = info?.code ? `${SITE}/r/${info.code}` : "";
  const message = `Main Apka Saathi use karta hoon — documents ki expiry aur zaroori kaam khud yaad dila deta hai. 🙂\n\nMere code se join karo, dono ko ${days} din Saathi Plus FREE:\n${link}`;

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
    if (navigator.share) {
      await navigator.share({ text: message }).catch(() => {});
    } else {
      copy();
    }
  }

  const capDays = cap * 30;
  const earned = info?.daysEarned ?? 0;
  const pct = Math.min(100, Math.round((earned / capDays) * 100));

  return (
    <Shell>
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-terracotta" size={26} />
        </div>
      ) : error ? (
        <p className="text-center text-sm text-terracotta-dark">{error}</p>
      ) : (
        <>
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-3xl bg-terracotta/10 text-terracotta">
              <Gift size={26} />
            </div>
            <h1 className="mt-4 font-display text-2xl font-semibold">
              Dono ko {days} din Plus free
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Apna link bhejo. Dost join kare, apna pehla document daale aur Saathi se ek
              baar baat kare — dono ko {days} din Saathi Plus.
            </p>
          </div>

          {/* Code */}
          <div className="mt-6 rounded-2xl border-2 border-dashed border-terracotta bg-terracotta/[0.07] py-5 text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-ink-soft">
              Aapka code
            </p>
            <p className="mt-1.5 font-display text-3xl font-bold tracking-[0.28em] text-terracotta">
              {info?.code ?? "—"}
            </p>
          </div>

          {/* Link + actions */}
          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-line bg-cream-deep/20 px-3 py-2.5">
            <p className="min-w-0 flex-1 truncate text-sm text-ink-soft">{link || "—"}</p>
            <button
              onClick={copy}
              disabled={!link}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-xs font-semibold text-cream transition hover:opacity-90 disabled:opacity-50"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-sage px-4 text-sm font-semibold text-white transition hover:opacity-90"
            >
              <MessageCircle size={16} />
              WhatsApp
            </a>
            <button
              onClick={nativeShare}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl bg-terracotta px-4 text-sm font-semibold text-white shadow-warm transition hover:bg-terracotta-dark"
            >
              <Share2 size={16} />
              Share
            </button>
          </div>

          {/* Stats */}
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            <Stat label="Successful referrals" value={info?.rewarded ?? 0} />
            <Stat label="Din kamaaye" value={earned} />
          </div>

          <p className="mt-4 text-xs font-medium text-ink-soft">
            {earned} / {capDays} din (max {cap} mahine)
          </p>
          <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-sage" style={{ width: `${pct}%` }} />
          </div>

          {(info?.total ?? 0) > (info?.rewarded ?? 0) && (
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              {(info!.total - info!.rewarded)} dost join to hue, par abhi unhone document
              add + chat poora nahi kiya.
            </p>
          )}

          <div className="mt-7 flex items-center justify-between border-t border-line pt-5">
            <a
              href={PLAY_STORE_URL}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta hover:underline"
            >
              <Smartphone size={15} />
              App kholo
            </a>
            <button
              onClick={() => supabaseBrowser?.auth.signOut()}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-soft hover:text-ink"
            >
              <LogOut size={15} />
              Logout
            </button>
          </div>
        </>
      )}
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4 text-center">
      <p className="text-2xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-xs text-ink-soft">{label}</p>
    </div>
  );
}
