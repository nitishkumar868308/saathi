"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Globe,
  Smartphone,
  Search,
  MousePointerClick,
  Eye,
  RefreshCw,
} from "lucide-react";

import Loader from "@/components/Loader";
import Pagination, { usePagination } from "@/components/admin/Pagination";
import { useAdminT } from "@/lib/i18n/admin";

/**
 * Analytics — app aur web dono ka safar ek jagah.
 *
 * Do hisse:
 *   1. Roz ka summary + sabse zyada dekhe gaye screens/pages.
 *   2. Ek user ka poora journey: kaunsi screen, kaunsa button, kis order me.
 *      User ID Users tab se copy karke yahan daal do.
 *
 * Data apne hi `analytics_events` table se aata hai (koi teesra vendor nahi),
 * aur padhna sirf server route se hota hai — service_role ke bina koi doosre
 * user ke events nahi dekh sakta.
 */

type Daily = {
  day: string;
  events: number;
  sessions: number;
  users: number;
  web: number;
  app: number;
};

type Top = { source: string; name: string; target: string; hits: number };

type Summary = { daily: Daily[]; top: Top[] };

type JourneyRow = {
  id: number;
  session_id: string | null;
  source: string;
  name: string;
  target: string | null;
  props: Record<string, unknown> | null;
  created_at: string;
  device_id: string | null;
};

function fmtDay(d: string): string {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function AdminAnalytics() {
  const t = useAdminT();
  const sh = t.data.shared;
  const a = t.data.analytics;

  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [days, setDays] = useState(14);
  const [busy, setBusy] = useState(false);

  const [userId, setUserId] = useState("");
  const [journey, setJourney] = useState<JourneyRow[] | null>(null);
  const [journeyBusy, setJourneyBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/analytics?days=${days}`, { cache: "no-store" });
      const body = (await res.json()) as { summary?: Summary; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setSummary(body.summary ?? { daily: [], top: [] });
    } catch (e) {
      setError(e instanceof Error ? e.message : sh.loadFailed);
      setSummary({ daily: [], top: [] });
    } finally {
      setBusy(false);
    }
  }, [days, sh.loadFailed]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadJourney() {
    const id = userId.trim();
    if (!id) return;
    setJourneyBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/analytics?user=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const body = (await res.json()) as { journey?: JourneyRow[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setJourney(body.journey ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : sh.loadFailed);
      setJourney([]);
    } finally {
      setJourneyBusy(false);
    }
  }

  const totals = useMemo(() => {
    const d = summary?.daily ?? [];
    return {
      events: d.reduce((s, x) => s + Number(x.events), 0),
      sessions: d.reduce((s, x) => s + Number(x.sessions), 0),
      users: Math.max(0, ...d.map((x) => Number(x.users))),
      web: d.reduce((s, x) => s + Number(x.web), 0),
    };
  }, [summary]);

  // Bar chart ki sabse oonchi line — baaki isi ke hisaab se scale hoti hain.
  const peak = Math.max(1, ...(summary?.daily ?? []).map((d) => Number(d.events)));

  // Top screens aur journey — dono lambi list ban jaati hain. Hooks yahan,
  // `if (!summary)` wale early return se PEHLE (React ka niyam).
  const topPg = usePagination(summary?.top ?? [], 10, days);
  const journeyPg = usePagination(journey ?? [], 15, userId);

  if (!summary) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader size={44} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/10 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-terracotta-dark" />
          <p className="text-sm leading-relaxed text-terracotta-dark">{error}</p>
        </div>
      )}

      {/* Range */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-2xl border border-line bg-surface p-1">
          {[7, 14, 30].map((n) => (
            <button
              key={n}
              onClick={() => setDays(n)}
              className={`h-9 rounded-xl px-3 text-xs font-semibold transition ${
                days === n ? "bg-terracotta text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {n} {t.time.d}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-2xl border border-line bg-surface px-4 text-sm font-semibold text-ink-soft transition hover:text-terracotta"
        >
          <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
          {t.common.refresh}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <Stat label={a.events} value={totals.events} />
        <Stat label={a.sessions} value={totals.sessions} />
        <Stat label={a.peakUsers} value={totals.users} />
        <Stat label={a.fromWeb} value={totals.web} />
      </div>

      {/* Rozana — chhota bar chart. Har din ki oonchai peak ke hisaab se. */}
      <div className="rounded-3xl border border-line bg-surface p-5 shadow-soft">
        <h3 className="font-display text-base font-semibold">{a.daily}</h3>
        {!summary.daily.length ? (
          <p className="py-10 text-center text-sm text-ink-soft">{sh.empty}</p>
        ) : (
          <div className="mt-5 flex h-40 items-end gap-1.5">
            {summary.daily.map((d) => (
              <div key={d.day} className="flex flex-1 flex-col items-center gap-1.5">
                <div
                  className="w-full rounded-t-md bg-terracotta/80 transition hover:bg-terracotta"
                  style={{ height: `${(Number(d.events) / peak) * 100}%`, minHeight: 3 }}
                  title={`${d.events} ${a.events} · ${d.sessions} ${a.sessions}`}
                />
                <span className="text-[10px] leading-none text-ink-soft">
                  {fmtDay(d.day)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top screens / pages */}
      <div className="rounded-3xl border border-line bg-surface shadow-soft">
        <div className="border-b border-line px-5 py-3.5">
          <h3 className="font-display text-base font-semibold">{a.topScreens}</h3>
        </div>
        {!summary.top.length ? (
          <p className="px-5 py-10 text-center text-sm text-ink-soft">{sh.empty}</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {topPg.pageItems.map((row, i) => (
              <li key={`${row.source}-${row.name}-${row.target}-${i}`} className="flex items-center gap-3 px-5 py-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    row.source === "web"
                      ? "bg-sage/15 text-sage"
                      : "bg-terracotta/12 text-terracotta-dark"
                  }`}
                >
                  {row.source === "web" ? <Globe size={15} /> : <Smartphone size={15} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-mono text-sm text-ink">{row.target}</p>
                  <p className="text-xs text-ink-soft">{row.name}</p>
                </div>
                <span className="shrink-0 text-sm font-bold text-ink">{row.hits}</span>
              </li>
            ))}
          </ul>
        )}
        {summary.top.length > 0 && (
          <div className="px-5 pb-4">
            <Pagination
              page={topPg.page}
              pageCount={topPg.pageCount}
              total={topPg.total}
              from={topPg.from}
              to={topPg.to}
              onPage={topPg.setPage}
              label={sh.pages}
            />
          </div>
        )}
      </div>

      {/* Ek user ka journey */}
      <div className="rounded-3xl border border-line bg-surface p-5 shadow-soft">
        <h3 className="font-display text-base font-semibold">{a.journeyTitle}</h3>
        <p className="mt-1 text-sm text-ink-soft">{a.journeySub}</p>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
            />
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadJourney()}
              placeholder={a.userIdPh}
              className="h-11 w-full rounded-2xl border border-line bg-cream pl-10 pr-4 font-mono text-sm outline-none transition focus:border-terracotta"
            />
          </div>
          <button
            onClick={loadJourney}
            disabled={!userId.trim() || journeyBusy}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl bg-terracotta px-5 text-sm font-semibold text-white transition hover:bg-terracotta-dark disabled:opacity-50"
          >
            {journeyBusy ? <Loader size={18} /> : null}
            {a.showJourney}
          </button>
        </div>

        {journey && (
          <div className="mt-5">
            {!journey.length ? (
              <p className="py-8 text-center text-sm text-ink-soft">{a.noJourney}</p>
            ) : (
              <ol className="relative space-y-0 border-l border-line pl-5">
                {journeyPg.pageItems.map((e) => (
                  <li key={e.id} className="relative py-2.5">
                    <span
                      className={`absolute -left-[26px] top-4 flex h-5 w-5 items-center justify-center rounded-full border-2 border-surface ${
                        e.name === "tap" || e.name === "click"
                          ? "bg-amber-warm/80 text-white"
                          : "bg-terracotta/80 text-white"
                      }`}
                    >
                      {e.name === "tap" || e.name === "click" ? (
                        <MousePointerClick size={10} />
                      ) : (
                        <Eye size={10} />
                      )}
                    </span>
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      <span className="font-mono text-sm font-semibold text-ink">
                        {e.target ?? e.name}
                      </span>
                      <span className="text-xs text-ink-soft">
                        {e.source} · {e.name}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-ink-soft">
                        {fmtTime(e.created_at)}
                      </span>
                    </div>
                    {e.props && (
                      <p className="mt-0.5 truncate font-mono text-[11px] text-ink-soft">
                        {JSON.stringify(e.props)}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            )}
            {journey.length > 0 && (
              <div className="mt-3">
                <Pagination
                  page={journeyPg.page}
                  pageCount={journeyPg.pageCount}
                  total={journeyPg.total}
                  from={journeyPg.from}
                  to={journeyPg.to}
                  onPage={journeyPg.setPage}
                  label={sh.events}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5 text-center shadow-soft sm:p-4">
      <p className="font-display text-2xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-ink-soft sm:text-xs">{label}</p>
    </div>
  );
}
