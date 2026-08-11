"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ExternalLink,
  Lock,
  RefreshCw,
  Search,
} from "lucide-react";
import Loader from "@/components/Loader";
import Pagination, { usePagination } from "@/components/admin/Pagination";
import { useAdminT } from "@/lib/i18n/admin";

/**
 * Admin ka Pricing tab — Google Play Console ka daam, sirf PADHNE ke liye.
 *
 * ⚠️ Yahan pehle ek poora manual pricing editor tha: base price (₹99/₹999),
 *    250 desh ki table, per-country multiplier aur conversion rate, bulk apply.
 *    Wo sab hata diya gaya — aur ye is screen ki sabse zaroori baat hai.
 *
 *    Wo table haath se bhari jaati thi. Conversion rate roz badalti hai, aur
 *    admin mahine me ek baar hi use chhoo paata tha. Natija hamesha ek: website
 *    ek daam dikhati aur Play doosra kaat leta. Ye sirf user ka bharosa todne
 *    wali baat nahi — Play ki policy bhi yahi maangti hai ki jo dikhe wahi kate,
 *    aur uspar app reject hoti hai.
 *
 *    Ab daam ka ek hi maalik hai: Play Console. Is screen par koi input box
 *    jaan-boojh ke nahi hai. Ek bhi wapas jodne ka matlab hai do maalik, aur
 *    wahi purana bug lautana.
 */

/** Ek desh ki ek line — monthly + yearly, dono Play Console se. */
type PlayRegion = {
  region: string;
  currency: string;
  monthly: number | null;
  yearly: number | null;
  monthlyLabel: string | null;
  yearlyLabel: string | null;
};

type PlayState = {
  /** Saare env set hain? Na hon to sync chal hi nahi sakta. */
  configured: boolean;
  /** Band hone ki asli wajah (ya "on") — setup me yahi sabse kaam ka hai. */
  status: string;
  syncedAt: string | null;
  attemptedAt: string | null;
  ok: boolean;
  message: string | null;
  rowsCount: number;
  products: string[];
  regions: PlayRegion[];
};

type CountryOption = { code: string; name: string };

const PLAY_CONSOLE_URL = "https://play.google.com/console";
const STALE_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * "2 ghante pehle" — poori date se ye jaldi samajh aata hai.
 *
 * Labels dictionary se aate hain. ⚠️ Pehle ye seedhe Hinglish string lautata
 * tha — screen par dikhta tha par kisi JSX me nahi tha, isliye bhasha badalne
 * par chup-chaap Hinglish hi pada rehta.
 */
function ago(iso: string | null, d: AdminPlayDict): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const fill = (s: string, n: number) => s.replace("{n}", String(n));
  const min = Math.floor(ms / 60000);
  if (min < 1) return d.justNow;
  if (min < 60) return fill(d.minsAgo, min);
  const hr = Math.floor(min / 60);
  if (hr < 24) return fill(d.hoursAgo, hr);
  return fill(d.daysAgo, Math.floor(hr / 24));
}

type AdminPlayDict = ReturnType<typeof useAdminT>["data"]["pricing"]["play"];

export default function AdminPricing() {
  const t = useAdminT();
  const d = t.data.pricing;
  const dp = d.play;
  const sh = t.data.shared;

  const [play, setPlay] = useState<PlayState | null>(null);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/pricing", { cache: "no-store" });
      const body = (await res.json()) as {
        countries?: CountryOption[];
        play?: PlayState;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setCountries(body.countries ?? []);
      setPlay(body.play ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : sh.loadFailed);
      setPlay(null);
    }
  }, [sh.loadFailed]);

  useEffect(() => {
    load();
  }, [load]);

  const nameOf = useMemo(() => {
    const m = new Map(countries.map((c) => [c.code, c.name]));
    return (code: string) => m.get(code) ?? code;
  }, [countries]);

  const regions = play?.regions ?? [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return regions;
    return regions.filter(
      (r) =>
        r.region.toLowerCase().includes(q) ||
        r.currency.toLowerCase().includes(q) ||
        nameOf(r.region).toLowerCase().includes(q),
    );
  }, [regions, query, nameOf]);

  const pg = usePagination(filtered, 15, query);

  async function sync() {
    if (syncing) return;
    setSyncing(true);
    setError("");
    setSynced(false);
    try {
      const res = await fetch("/api/admin/pricing/sync", { method: "POST" });
      const body = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? body.message ?? `HTTP ${res.status}`);
      // Poora dobara load — sync ke baad table, ginti aur "aakhri sync" teenon
      // badalte hain, aur unhe alag-alag patch karna sirf teen naye bug ka mauka
      // hai.
      await load();
      setSynced(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "sync failed");
    } finally {
      setSyncing(false);
    }
  }

  if (!play && !error) {
    return (
      <div className="flex justify-center py-16">
        <Loader size={52} />
      </div>
    );
  }

  const syncedAgo = ago(play?.syncedAt ?? null, dp);
  const stale =
    Boolean(play?.syncedAt) && Date.now() - new Date(play!.syncedAt!).getTime() > STALE_MS;

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/10 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-terracotta-dark" />
          <p className="text-sm leading-relaxed text-terracotta-dark">{error}</p>
        </div>
      )}

      <div className="rounded-3xl border border-line bg-surface p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
              {dp.title}
              <span className="inline-flex items-center gap-1 rounded-full bg-cream-deep/50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
                <Lock size={11} /> read-only
              </span>
            </h3>
            <p className="mt-1 max-w-2xl text-sm text-ink-soft">{dp.sub}</p>
          </div>
          <div className="flex items-center gap-2">
            <a
              href={PLAY_CONSOLE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-ink-soft transition hover:text-terracotta"
            >
              <ExternalLink size={15} /> {dp.openConsole}
            </a>
            <button
              onClick={sync}
              disabled={syncing || !play?.configured}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-terracotta px-4 text-sm font-semibold text-white shadow-warm transition hover:bg-terracotta-dark disabled:opacity-50"
            >
              {syncing ? <Loader size={16} /> : <RefreshCw size={15} />}
              {syncing ? dp.syncing : dp.syncNow}
            </button>
          </div>
        </div>

        {/* Chalu hai ya nahi — aur nahi to KYUN. Ye ek line poore setup ka
            sabse kaam ka hissa hai. */}
        {play && !play.configured && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-line bg-cream-deep/25 p-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-ink-soft" />
            <div className="min-w-0 text-sm">
              <p className="font-semibold text-ink">{dp.offTitle}</p>
              <p className="mt-0.5 text-ink-soft">{play.status}</p>
              <p className="mt-1 text-ink-soft">{dp.offBody}</p>
            </div>
          </div>
        )}

        {/* Sync chal to raha hai par fail ho raha hai — ye chup-chaap nahi
            rehna chahiye, warna purana daam hafton tak sahi lagta rehta hai. */}
        {play?.configured && play.message && (
          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/10 p-4">
            <AlertTriangle size={18} className="mt-0.5 shrink-0 text-terracotta-dark" />
            <p className="text-sm leading-relaxed text-terracotta-dark">{play.message}</p>
          </div>
        )}

        {stale && (
          <p className="mt-4 rounded-2xl border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm font-semibold text-terracotta-dark">
            {dp.staleWarn}
          </p>
        )}

        <p className="mt-4 flex flex-wrap items-center gap-x-1.5 text-sm text-ink-soft">
          <span>
            {dp.lastSync}: <b className="text-ink">{syncedAgo ?? dp.never}</b>
          </span>
          {regions.length > 0 && (
            <span>
              · {regions.length} {dp.regions}
            </span>
          )}
          {play?.products?.length ? <span>· {play.products.join(", ")}</span> : null}
          {synced && (
            <span className="inline-flex items-center gap-1 font-semibold text-sage">
              <Check size={15} /> {t.data.rewards.saved}
            </span>
          )}
        </p>

        {regions.length > 0 && (
          <>
            <div className="relative mt-4">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={sh.searchPh}
                className="w-full rounded-2xl border border-line bg-cream py-2.5 pl-10 pr-4 text-sm text-ink outline-none transition focus:border-terracotta"
              />
            </div>

            <div className="mt-3 overflow-x-auto rounded-2xl border border-line">
              <table className="w-full min-w-[480px] text-left text-sm">
                <thead className="border-b border-line bg-cream-deep/25 text-xs uppercase tracking-wider text-ink-soft">
                  <tr>
                    <th className="px-3 py-2.5 font-semibold">{d.country}</th>
                    <th className="px-3 py-2.5 font-semibold">{d.currency}</th>
                    <th className="px-3 py-2.5 font-semibold">{d.monthly}</th>
                    <th className="px-3 py-2.5 font-semibold">{d.yearly}</th>
                  </tr>
                </thead>
                <tbody>
                  {pg.pageItems.map((r) => (
                    <tr key={r.region} className="border-b border-line/60">
                      <td className="px-3 py-2 font-semibold text-ink">
                        {nameOf(r.region)}
                        <span className="ml-1 text-xs font-normal text-ink-soft">{r.region}</span>
                      </td>
                      <td className="px-3 py-2 text-ink-soft">{r.currency}</td>
                      {/* Label seedha server se aata hai (Intl se bana) — symbol
                          ki jagah har currency me alag hoti hai, isliye yahan
                          number aur symbol dobara jodne ki koshish nahi karte. */}
                      <td className="px-3 py-2 font-bold text-ink">{r.monthlyLabel ?? "—"}</td>
                      <td className="px-3 py-2 font-bold text-ink">{r.yearlyLabel ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filtered.length === 0 ? (
              <p className="mt-3 rounded-2xl border border-line px-4 py-4 text-center text-sm text-ink-soft">
                {sh.emptyFilter}
              </p>
            ) : (
              <div className="mt-3">
                <Pagination
                  page={pg.page}
                  pageCount={pg.pageCount}
                  total={pg.total}
                  from={pg.from}
                  to={pg.to}
                  onPage={pg.setPage}
                  label={sh.countries}
                />
              </div>
            )}
          </>
        )}
      </div>

      <p className="text-xs leading-relaxed text-ink-soft">{dp.note}</p>
    </div>
  );
}
