"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle,
  IndianRupee,
  PowerOff,
  RefreshCw,
  RotateCcw,
  Users,
  Zap,
} from "lucide-react";
import { SkeletonRows } from "@/components/Loader";
import Pagination, { usePagination } from "@/components/admin/Pagination";
import { useAdminT, atpl } from "@/lib/i18n/admin";

/**
 * Admin > Payments — Play Store / RevenueCat ka har event.
 *
 * ⚠️ Ye screen `Spend` se ULTA sawaal poochti hai, aur dono ko alag rakhna
 * zaroori hai: `Spend` humara KHARCHA hai (Gemini, Twilio, SMTP), ye hamari
 * KAMAI. Isliye iska apna menu hai — jise bill dekhna hai use har user ka
 * transaction dikhna zaroori nahi.
 *
 * ⚠️ Ye Play Console live hone se PEHLE hi taiyaar hai. Live hote hi pehla
 * event yahan aa jaayega — na koi migration us din chalani hai, na koi code
 * badalna. Ulta karne par (pehle live, phir screen) shuruati din — jo sabse
 * zyada dekhne laayak hote hain — hamesha ke liye khaali reh jaate.
 */

type PaymentRow = {
  id: string;
  userId: string | null;
  email: string | null;
  name: string | null;
  eventType: string | null;
  productId: string | null;
  store: string | null;
  transactionId: string | null;
  amount: number | null;
  currency: string | null;
  periodType: string | null;
  environment: string | null;
  status: string | null;
  expiresAt: string | null;
  at: string;
};

type Totals = {
  events: number;
  payers: number;
  refunds: number;
  trials: number;
  sandbox: number;
  revenue: Record<string, number>;
};

const RANGE_KEYS = ["today", "7", "30", "90", "all"] as const;
type RangeKey = (typeof RANGE_KEYS)[number];

const EMPTY_TOTALS: Totals = {
  events: 0,
  payers: 0,
  refunds: 0,
  trials: 0,
  sandbox: 0,
  revenue: {},
};

/**
 * Event ka rang.
 *
 * ⚠️ Refund aur expiry ko kharidari jaise rang me dikhana sabse bhaddi galti
 * hoti: list par ek nazar daalne wale ko sab "paisa aaya" jaisa lagta hai.
 * Isliye paisa AANE wale hare, paisa JAANE wale laal, baaki chup-chaap grey.
 */
const EVENT_TINT: Record<string, string> = {
  INITIAL_PURCHASE: "bg-sage/15 text-sage",
  RENEWAL: "bg-sage/15 text-sage",
  UNCANCELLATION: "bg-sage/15 text-sage",
  NON_RENEWING_PURCHASE: "bg-sage/15 text-sage",
  SUBSCRIPTION_EXTENDED: "bg-sage/15 text-sage",
  REFUND: "bg-terracotta/10 text-terracotta",
  EXPIRATION: "bg-terracotta/10 text-terracotta",
  CANCELLATION: "bg-amber-warm/15 text-amber-warm",
  BILLING_ISSUE: "bg-amber-warm/15 text-amber-warm",
};

/** Currency ka chinh — jo pata hai wo, warna code hi (jhooth se behtar hai). */
const SYMBOL: Record<string, string> = { INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "د.إ" };

function money(currency: string, amount: number): string {
  const sym = SYMBOL[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
  // Poore number par decimal dikhana bhadda lagta hai (₹99.00), par 1.99 par
  // zaroori hai — warna wo "₹2" dikhta aur hisaab galat lagta.
  const n = Number.isInteger(amount) ? amount.toLocaleString("en-IN") : amount.toFixed(2);
  return `${sym}${n}`;
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

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function AdminPayments() {
  const at = useAdminT();
  const p = at.data.payments;

  const [rows, setRows] = useState<PaymentRow[]>([]);
  const [totals, setTotals] = useState<Totals>(EMPTY_TOTALS);
  const [billing, setBilling] = useState<{ on: boolean; status: string } | null>(null);
  const [range, setRange] = useState<RangeKey>("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/payments?range=${range}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        // Migration na chali ho — uski wajah saaf dikhni chahiye, warna wo ek
        // poora din kha jaati hai.
        throw new Error(data?.detail ?? data?.error ?? "read failed");
      }
      setRows((data.rows ?? []) as PaymentRow[]);
      setTotals((data.totals ?? EMPTY_TOTALS) as Totals);
      setBilling(data.playBilling ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "read failed");
      setRows([]);
      setTotals(EMPTY_TOTALS);
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const rangeLabel: Record<RangeKey, string> = {
    today: p.today,
    "7": p.days7,
    "30": p.days30,
    "90": p.days90,
    all: p.all,
  };

  // Range badle to page 1 par wapas.
  const pg = usePagination(rows, 15, range);

  const currencies = Object.keys(totals.revenue);

  return (
    <div className="mt-6">
      {/* Range + refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {RANGE_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => setRange(key)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                range === key
                  ? "bg-terracotta text-white shadow-warm"
                  : "border border-line bg-surface text-ink-soft hover:text-ink"
              }`}
            >
              {rangeLabel[key]}
            </button>
          ))}
        </div>
        <button
          onClick={() => void load()}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink-soft transition hover:text-terracotta"
        >
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          {at.common.refresh}
        </button>
      </div>

      {error && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/5 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-terracotta" />
          <p className="text-sm leading-relaxed text-ink">{error}</p>
        </div>
      )}

      {/*
        ⚠️ Ye banner khaali screen ki WAJAH batata hai, aur wahi is screen ka
        sabse kaam ka hissa hai jab tak Play live nahi hota. "Abhi koi payment
        nahi hua" aur "payment ho bhi jaye to khabar aayegi hi nahi" — dono ek
        jaisi khaali table dikhate hain, par doosri ek toota hua setup hai.
      */}
      {billing && !billing.on && (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-warm/40 bg-amber-warm/5 p-4">
          <PowerOff size={18} className="mt-0.5 shrink-0 text-amber-warm" />
          <div>
            <p className="text-sm font-semibold text-ink">{p.offTitle}</p>
            <p className="mt-1 text-sm leading-relaxed text-ink-soft">
              {atpl(p.offBody, { status: billing.status })}
            </p>
          </div>
        </div>
      )}

      {/* Upar ke card — ek nazar me poora hisaab */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/*
          Kamai currency ke hisaab se ALAG dikhti hai, ek jodi hui ginti nahi.
          App har desh me chalti hai; ₹99 aur $99 ko jodne ka koi matlab nahi
          hota, aur wo jodi hui sankhya hamesha asli se bahut badi dikhti hai.
        */}
        <div className="rounded-3xl border border-line bg-surface p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sage/15 text-sage">
              <IndianRupee size={18} />
            </span>
            <span className="text-sm font-semibold text-ink">{p.revenue}</span>
          </div>
          {loading ? (
            <p className="mt-4 font-display text-3xl font-semibold tracking-tight">—</p>
          ) : currencies.length === 0 ? (
            <p className="mt-4 font-display text-3xl font-semibold tracking-tight">0</p>
          ) : (
            <div className="mt-4 space-y-1">
              {currencies.map((c) => (
                <p key={c} className="font-display text-2xl font-semibold tracking-tight">
                  {money(c, totals.revenue[c])}
                </p>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
            {p.trials}: {loading ? "—" : totals.trials}
          </p>
        </div>

        <Stat
          icon={Users}
          tint="bg-terracotta/10 text-terracotta"
          label={p.payers}
          value={loading ? "—" : String(totals.payers)}
        />
        <Stat
          icon={Zap}
          tint="bg-amber-warm/15 text-amber-warm"
          label={p.events}
          value={loading ? "—" : String(totals.events)}
          // Test purchase ko yahin dikhana zaroori hai: wo `events` me ginta hai
          // par kamai me nahi, aur bina is line ke dono number kabhi nahi milte.
          note={totals.sandbox ? `${totals.sandbox} ${p.sandbox}` : undefined}
        />
        <Stat
          icon={RotateCcw}
          tint="bg-terracotta/10 text-terracotta"
          label={p.refunds}
          value={loading ? "—" : String(totals.refunds)}
          danger={totals.refunds > 0}
        />
      </div>

      {/* Poori list */}
      <div className="mt-8 overflow-hidden rounded-3xl border border-line bg-surface">
        {loading ? (
          <div className="p-5">
            <SkeletonRows rows={6} />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-6 text-sm text-ink-soft">{p.none}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] text-left text-sm">
              <thead className="border-b border-line text-xs font-semibold uppercase tracking-wide text-ink-soft">
                <tr>
                  <th className="px-5 py-3">{p.when}</th>
                  <th className="px-5 py-3">{p.user}</th>
                  <th className="px-5 py-3">{p.event}</th>
                  <th className="px-5 py-3">{p.product}</th>
                  <th className="px-5 py-3 text-right">{p.amount}</th>
                  <th className="px-5 py-3">{p.till}</th>
                  <th className="px-5 py-3">{p.txn}</th>
                </tr>
              </thead>
              <tbody>
                {pg.pageItems.map((r) => (
                  <tr key={r.id} className="border-b border-line/60 last:border-0">
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-ink-soft">
                      {fmtWhen(r.at)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-semibold text-ink">{r.name || "—"}</div>
                      <div className="text-xs text-ink-soft">{r.email || r.userId || "—"}</div>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${
                          EVENT_TINT[r.eventType ?? ""] ?? "bg-line/40 text-ink-soft"
                        }`}
                      >
                        {r.eventType ?? "—"}
                      </span>
                      {/*
                        ⚠️ Sandbox ka nishaan har row par. Iske bina test
                        kharidari asli list me bilkul asli jaisi dikhti hai —
                        aur "kamai" wala card usse ginta hi nahi, to dono number
                        kabhi nahi milte aur wajah kahin dikhti nahi.
                      */}
                      {r.environment === "SANDBOX" && (
                        <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                          {p.testTag}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-ink-soft">
                      <div>{r.productId ?? "—"}</div>
                      {r.periodType && r.periodType !== "NORMAL" && (
                        <div className="text-xs text-amber-warm">{r.periodType}</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-right tabular-nums font-semibold text-ink">
                      {r.amount != null && r.currency ? money(r.currency, r.amount) : "—"}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-xs text-ink-soft">
                      {fmtDate(r.expiresAt)}
                    </td>
                    <td
                      className="max-w-[180px] truncate px-5 py-3 font-mono text-xs text-ink-soft"
                      title={r.transactionId ?? ""}
                    >
                      {r.transactionId ?? "—"}
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
                label={p.rows}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  icon: Icon,
  tint,
  label,
  value,
  note,
  danger,
}: {
  icon: typeof Users;
  tint: string;
  label: string;
  value: string;
  note?: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-line bg-surface p-5">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-2xl ${tint}`}>
          <Icon size={18} />
        </span>
        <span className="text-sm font-semibold text-ink">{label}</span>
      </div>
      <p
        className={`mt-4 font-display text-3xl font-semibold tracking-tight ${
          danger ? "text-terracotta" : ""
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-ink-soft">
        {note ?? " "}
      </p>
    </div>
  );
}
