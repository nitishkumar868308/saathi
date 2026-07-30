"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bot, MessageCircle, Mail, RefreshCw } from "lucide-react";
import { SkeletonRows } from "@/components/Loader";
import Pagination, { usePagination } from "@/components/admin/Pagination";

/**
 * "AI & WhatsApp" — humara kitna istemaal ho raha hai (item 3).
 *
 * `Usage` tab se alag sawaal hai. Wo batata hai KAUN user kitna active hai;
 * ye batata hai HUMARA kitna kharcha ho raha hai: Gemini ko kitne token gaye,
 * Twilio se kitne WhatsApp nikle, SMTP se kitne email — aur kitne fail hue.
 *
 * Fail hone ki ginti jaan-boojh ke saamne rakhi hai: Twilio ka template reject
 * ho jaye ya SMTP ka password badal jaye to sabse pehla ishaara wahi hota hai,
 * aur wo aksar hafton tak kisi ko dikhta hi nahi.
 */

type SpendRow = {
  service: string;
  kind: string;
  calls: number;
  units: number;
  failures: number;
  last_at: string | null;
};

const RANGES = [
  { key: "today", label: "Today" },
  { key: "7", label: "7 days" },
  { key: "30", label: "30 days" },
  { key: "all", label: "All" },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

const SERVICES = [
  {
    key: "gemini",
    label: "AI (Gemini)",
    icon: Bot,
    /** Gemini me `units` = token; baaki me message/email ki ginti. */
    unitLabel: "tokens",
    tint: "bg-terracotta/10 text-terracotta",
  },
  {
    key: "twilio",
    label: "WhatsApp (Twilio)",
    icon: MessageCircle,
    unitLabel: "messages",
    tint: "bg-sage/15 text-sage",
  },
  {
    key: "email",
    label: "Email (SMTP)",
    icon: Mail,
    unitLabel: "emails",
    tint: "bg-amber-warm/15 text-amber-warm",
  },
] as const;

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

function fmtWhen(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function AdminSpend() {
  const [rows, setRows] = useState<SpendRow[]>([]);
  const [range, setRange] = useState<RangeKey>("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/spend?range=${range}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "read failed");
      setRows((data.totals ?? []) as SpendRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "read failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Service ke hisaab se jod — upar ke teen bade card isi se bante hain. */
  const byService = useMemo(() => {
    const map = new Map<string, { calls: number; units: number; failures: number; last: string | null }>();
    for (const r of rows) {
      const cur = map.get(r.service) ?? { calls: 0, units: 0, failures: 0, last: null };
      cur.calls += Number(r.calls) || 0;
      cur.units += Number(r.units) || 0;
      cur.failures += Number(r.failures) || 0;
      if (r.last_at && (!cur.last || r.last_at > cur.last)) cur.last = r.last_at;
      map.set(r.service, cur);
    }
    return map;
  }, [rows]);

  const hasAny = rows.length > 0;

  // Har service × kind ka apna row — services badhne par ye table lambi hoti
  // jaati hai. Range badle to page 1 par wapas.
  const pg = usePagination(rows, 12, range);

  return (
    <div className="mt-6">
      {/* Range + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                range === r.key
                  ? "bg-terracotta text-white shadow-warm"
                  : "border border-line bg-surface text-ink-soft hover:text-ink"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink-soft transition hover:text-terracotta"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/5 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-terracotta" />
          <p className="text-sm leading-relaxed text-ink">{error}</p>
        </div>
      )}

      {/* Teen bade card — ek nazar me poora hisaab */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map(({ key, label, icon: Icon, unitLabel, tint }) => {
          const s = byService.get(key);
          return (
            <div key={key} className="rounded-3xl border border-line bg-surface p-5">
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tint}`}>
                  <Icon size={18} />
                </span>
                <span className="text-sm font-semibold text-ink">{label}</span>
              </div>

              <p className="mt-4 font-display text-3xl font-semibold tracking-tight">
                {loading ? "—" : fmtNum(s?.units ?? 0)}
              </p>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                {unitLabel}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-3 text-xs text-ink-soft">
                <span>
                  <b className="text-ink">{fmtNum(s?.calls ?? 0)}</b> calls
                </span>
                {!!s?.failures && (
                  <span className="font-semibold text-terracotta">
                    {fmtNum(s.failures)} failed
                  </span>
                )}
                <span className="ml-auto">{fmtWhen(s?.last ?? null)}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tod-ke — kaunse kaam se kitna laga */}
      <h2 className="mt-9 font-display text-lg font-semibold">Breakdown</h2>
      <div className="mt-3 overflow-hidden rounded-3xl border border-line bg-surface">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={5} />
          </div>
        ) : !hasAny ? (
          <p className="p-6 text-sm text-ink-soft">
            Abhi tak koi usage record nahi hui. Agar aapko yakeen hai ki AI/WhatsApp chal
            raha hai, to Supabase me <code>supabase/service-usage.sql</code> run karna baaki
            hai.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead className="border-b border-line text-xs font-semibold uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-5 py-3">Service</th>
                  <th className="px-5 py-3">What</th>
                  <th className="px-5 py-3 text-right">Calls</th>
                  <th className="px-5 py-3 text-right">Units</th>
                  <th className="px-5 py-3 text-right">Failed</th>
                  <th className="px-5 py-3 text-right">Last</th>
                </tr>
              </thead>
              <tbody>
                {pg.pageItems.map((r) => (
                  <tr key={`${r.service}-${r.kind}`} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-3 font-semibold text-ink">{r.service}</td>
                    <td className="px-5 py-3 text-ink-soft">{r.kind}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtNum(r.calls)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{fmtNum(r.units)}</td>
                    <td
                      className={`px-5 py-3 text-right tabular-nums ${
                        r.failures > 0 ? "font-semibold text-terracotta" : "text-ink-soft"
                      }`}
                    >
                      {r.failures || "—"}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-ink-soft">
                      {fmtWhen(r.last_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 pb-4">
              <Pagination
                page={pg.page}
                pageCount={pg.pageCount}
                total={pg.total}
                from={pg.from}
                to={pg.to}
                onPage={pg.setPage}
                label="rows"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
