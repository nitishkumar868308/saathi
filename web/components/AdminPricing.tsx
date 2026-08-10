"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Plus,
  Trash2,
  Save,
  Globe,
  Check,
  Search,
  RefreshCw,
  ExternalLink,
  Lock,
} from "lucide-react";
import Loader from "@/components/Loader";
import Pagination, { usePagination } from "@/components/admin/Pagination";
import { useAdminT } from "@/lib/i18n/admin";

type Row = {
  country_code: string;
  country_name: string;
  currency: string;
  symbol: string;
  conversion_rate: number;
  multiplier: number;
  enabled: boolean;
};

type CountryOption = { code: string; name: string; currency?: string; symbol?: string };
type Base = { monthly: number; yearly: number };

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
  /** Saare env set hain? Na hon to neeche wali manual table hi chalti hai. */
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

const PLAY_CONSOLE_URL = "https://play.google.com/console";

/** "2 ghante pehle" — poori date se ye jaldi samajh aata hai. */
function ago(iso: string | null): string | null {
  if (!iso) return null;
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const min = Math.floor(ms / 60000);
  if (min < 1) return "abhi";
  if (min < 60) return `${min} min pehle`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} ghante pehle`;
  return `${Math.floor(hr / 24)} din pehle`;
}

const STALE_MS = 3 * 24 * 60 * 60 * 1000;

function roundPrice(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n >= 20 ? Math.round(n) : Math.round(n * 10) / 10;
}

export default function AdminPricing() {
  const t = useAdminT();
  const d = t.data.pricing;
  const sh = t.data.shared;
  const [rows, setRows] = useState<Row[] | null>(null);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [base, setBase] = useState<Base>({ monthly: 99, yearly: 999 });
  const [play, setPlay] = useState<PlayState | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addCode, setAddCode] = useState("");
  const [bulkMult, setBulkMult] = useState("3");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/pricing", { cache: "no-store" });
      const body = (await res.json()) as {
        rows?: Row[];
        countries?: CountryOption[];
        base?: Base;
        play?: PlayState;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setRows(body.rows ?? []);
      setCountries(body.countries ?? []);
      if (body.base) setBase(body.base);
      if (body.play) setPlay(body.play);
    } catch (e) {
      setError(e instanceof Error ? e.message : sh.loadFailed);
      setRows([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const available = useMemo(() => {
    const have = new Set((rows ?? []).map((r) => r.country_code));
    return countries.filter((c) => !have.has(c.code));
  }, [rows, countries]);

  /**
   * ⚠️ Ye table 250+ desh ek saath dikhata tha — ek hi page par, bina search ke.
   * Kisi ek desh ka multiplier badalna matlab minute bhar scroll karna.
   *
   * Hooks yahan (early return se PEHLE) hone chahiye — neeche `if (!rows)` wala
   * return hai, aur uske baad hook call karna React ka niyam todta hai.
   */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows ?? [];
    if (!q) return list;
    return list.filter(
      (r) =>
        r.country_name.toLowerCase().includes(q) ||
        r.country_code.toLowerCase().includes(q) ||
        r.currency.toLowerCase().includes(q),
    );
  }, [rows, query]);

  const pg = usePagination(filtered, 15, query);

  function patchRow(code: string, patch: Partial<Row>) {
    setSaved(false);
    setRows((prev) =>
      (prev ?? []).map((r) => (r.country_code === code ? { ...r, ...patch } : r)),
    );
  }

  /**
   * Currency/symbol DB (countries table) se apne aap bhar jaate hain —
   * conversion rate admin bharega. Sab mandatory hain.
   */
  function newRow(c: CountryOption, mult: number): Row {
    return {
      country_code: c.code,
      country_name: c.name,
      currency: c.currency ?? "",
      symbol: c.symbol ?? "",
      conversion_rate: c.code === "IN" ? 1 : 0,
      multiplier: c.code === "IN" ? 1 : mult,
      enabled: true,
    };
  }

  function addCountry() {
    const c = countries.find((x) => x.code === addCode);
    if (!c || !rows) return;
    setRows([...rows, newRow(c, 1)]);
    setAddCode("");
    setSaved(false);
  }

  function addAll() {
    if (!rows) return;
    const mult = Math.max(0, Number(bulkMult)) || 1;
    const have = new Set(rows.map((r) => r.country_code));
    const additions = countries.filter((c) => !have.has(c.code)).map((c) => newRow(c, mult));
    setRows([...rows, ...additions]);
    setSaved(false);
  }

  function applyBulkMultiplier() {
    const mult = Math.max(0, Number(bulkMult)) || 1;
    setRows((prev) =>
      (prev ?? []).map((r) => (r.country_code === "IN" ? r : { ...r, multiplier: mult })),
    );
    setSaved(false);
  }

  async function removeRow(code: string) {
    if (code === "IN") return;
    // Local se hata do; save pe DB me DELETE bhejenge.
    await fetch(`/api/admin/pricing?code=${code}`, { method: "DELETE" }).catch(() => {});
    setRows((prev) => (prev ?? []).filter((r) => r.country_code !== code));
    setSaved(false);
  }

  async function save() {
    if (!rows || saving) return;
    // Mandatory: har row me currency, symbol, rate>0, multiplier>0.
    const bad = rows.find(
      (r) =>
        !r.currency.trim() ||
        !r.symbol.trim() ||
        !(r.conversion_rate > 0) ||
        !(r.multiplier > 0),
    );
    if (bad) {
      setError(
        `${bad.country_code} — currency, symbol, conversion rate aur multiplier sab bharo (0 se bade).`,
      );
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/pricing", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, base }),
      });
      const body = (await res.json()) as { rows?: Row[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (body.rows) setRows(body.rows);
      setSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.data.rewards.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  if (!rows) {
    return (
      <div className="flex justify-center py-16">
        <Loader size={52} />
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

      {/* Google Play — ASLI daam. Sabse upar, kyunki yahi sach hai. */}
      <PlaySection play={play} countries={countries} onSynced={load} />

      {/* Base price (INR) — ab sirf FALLBACK */}
      <div className="rounded-3xl border border-line bg-surface p-5 shadow-soft">
        <h3 className="font-display text-lg font-semibold">
          {d.play.fallbackTitle}
        </h3>
        <p className="mt-1 text-sm text-ink-soft">{d.play.fallbackBody}</p>
        <p className="mt-1 text-sm text-ink-soft">
          Har country ka price = base × multiplier × conversion rate.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <LabeledInput
            label={`${d.monthly} ₹`}
            value={base.monthly}
            onChange={(v) => {
              setBase((b) => ({ ...b, monthly: v }));
              setSaved(false);
            }}
          />
          <LabeledInput
            label={`${d.yearly} ₹`}
            value={base.yearly}
            onChange={(v) => {
              setBase((b) => ({ ...b, yearly: v }));
              setSaved(false);
            }}
          />
        </div>
      </div>

      {/* Add + bulk */}
      <div className="flex flex-col gap-3 rounded-3xl border border-line bg-surface p-5 shadow-soft sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="text-xs font-semibold text-ink-soft">{d.addCountry}</label>
          <div className="mt-1.5 flex gap-2">
            <select
              value={addCode}
              onChange={(e) => setAddCode(e.target.value)}
              className="h-10 flex-1 rounded-xl border border-line bg-cream px-3 text-sm outline-none focus:border-terracotta"
            >
              <option value="">{d.choose}</option>
              {available.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
            <button
              onClick={addCountry}
              disabled={!addCode}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-terracotta px-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Plus size={15} /> Add
            </button>
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold text-ink-soft">{d.multiplier}</label>
          <div className="mt-1.5 flex gap-2">
            <input
              value={bulkMult}
              onChange={(e) => setBulkMult(e.target.value)}
              inputMode="decimal"
              className="h-10 w-20 rounded-xl border border-line bg-cream px-3 text-sm outline-none focus:border-terracotta"
            />
            <button
              onClick={addAll}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-ink-soft hover:text-terracotta"
            >
              <Globe size={15} /> Add all
            </button>
            <button
              onClick={applyBulkMultiplier}
              className="inline-flex h-10 items-center rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-ink-soft hover:text-terracotta"
            >
              {d.applyToAll}
            </button>
          </div>
        </div>
      </div>

      {/* Search — 250+ desh me se ek dhundhne ka aasan raasta */}
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
        />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={sh.searchPh}
          className="w-full rounded-2xl border border-line bg-surface py-3 pl-10 pr-4 text-sm text-ink shadow-soft outline-none transition focus:border-terracotta"
        />
      </div>

      {/* Rows */}
      <div className="overflow-x-auto rounded-3xl border border-line bg-surface shadow-soft">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line bg-cream-deep/25 text-xs uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-3 py-3 font-semibold">{d.country}</th>
              <th className="px-3 py-3 font-semibold">{d.currency}</th>
              <th className="px-3 py-3 font-semibold">{d.symbol}</th>
              <th className="px-3 py-3 font-semibold">{d.multiplier}</th>
              <th className="px-3 py-3 font-semibold">1 INR =</th>
              <th className="px-3 py-3 font-semibold">{d.monthly}</th>
              <th className="px-3 py-3 font-semibold">On</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {pg.pageItems.map((r) => {
              const monthly = roundPrice(base.monthly * r.multiplier * r.conversion_rate);
              const yearly = roundPrice(base.yearly * r.multiplier * r.conversion_rate);
              return (
                <tr key={r.country_code} className="border-b border-line/60">
                  <td className="px-3 py-2.5 font-semibold text-ink">
                    {r.country_name}
                    <span className="ml-1 text-xs font-normal text-ink-soft">{r.country_code}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <Cell
                      value={r.currency}
                      w="w-16"
                      invalid={!r.currency.trim()}
                      onChange={(v) => patchRow(r.country_code, { currency: v.toUpperCase() })}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Cell
                      value={r.symbol}
                      w="w-14"
                      invalid={!r.symbol.trim()}
                      onChange={(v) => patchRow(r.country_code, { symbol: v })}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <NumCell
                      value={r.multiplier}
                      disabled={r.country_code === "IN"}
                      invalid={!(r.multiplier > 0)}
                      onChange={(v) => patchRow(r.country_code, { multiplier: v })}
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <NumCell
                      value={r.conversion_rate}
                      disabled={r.country_code === "IN"}
                      invalid={!(r.conversion_rate > 0)}
                      onChange={(v) => patchRow(r.country_code, { conversion_rate: v })}
                    />
                  </td>
                  <td className="px-3 py-2.5 font-bold text-ink">
                    {r.symbol}
                    {monthly.toLocaleString("en-IN")}
                    <span className="block text-xs font-normal text-ink-soft">
                      /yr {r.symbol}
                      {yearly.toLocaleString("en-IN")}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <button
                      onClick={() => patchRow(r.country_code, { enabled: !r.enabled })}
                      className={`flex h-6 w-11 items-center rounded-full px-0.5 transition ${
                        r.enabled ? "bg-sage" : "bg-line"
                      }`}
                    >
                      <span
                        className={`h-5 w-5 rounded-full bg-white transition ${
                          r.enabled ? "translate-x-5" : ""
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-3 py-2.5">
                    {r.country_code !== "IN" && (
                      <button
                        onClick={() => removeRow(r.country_code)}
                        className="text-ink-soft transition hover:text-terracotta-dark"
                        aria-label={d.remove}
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface px-4 py-5 text-center text-sm text-ink-soft">
          {sh.emptyFilter}
        </p>
      ) : (
        <Pagination
          page={pg.page}
          pageCount={pg.pageCount}
          total={pg.total}
          from={pg.from}
          to={pg.to}
          onPage={pg.setPage}
          label={sh.countries}
        />
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-terracotta px-6 text-sm font-semibold text-white shadow-warm transition hover:bg-terracotta-dark disabled:opacity-70"
        >
          {saving ? <Loader size={18} /> : <Save size={16} />}
          {saving ? t.common.saving : t.common.save}
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-sage">
            <Check size={16} /> {t.data.rewards.saved}
          </span>
        )}
      </div>

      <p className="text-xs leading-relaxed text-ink-soft">
        Note: ye sirf <b>display</b> price hai. Actual charge Google Play user ke
        account-country se leta hai — VPN/fake-GPS se display badal sakta hai, charge nahi.
        Jahan Play ka price maujood hai, wahan website upar wali table se dikhati
        hai — ye manual hisaab tab bhi chalta hai jab Play par us desh ka daam na ho.
      </p>
    </div>
  );
}

/**
 * Play Console ka live price — sirf padhne ke liye.
 *
 * ⚠️ Yahan koi input box jaan-boojh ke nahi hai. Ek baar bhi admin ko yahan se
 *    daam badalne diya, to do maalik ban jaate hain aur ek din website ₹99
 *    dikhayegi jabki Play ₹149 kaat lega. Ye sirf user ka bharosa todne wali
 *    baat nahi — Play ki policy bhi yahi maangti hai ki jo dikhe wahi kate.
 *    Daam badalne ka ek hi raasta hai: Play Console → phir "Sync now".
 */
function PlaySection({
  play,
  countries,
  onSynced,
}: {
  play: PlayState | null;
  countries: CountryOption[];
  onSynced: () => Promise<void> | void;
}) {
  const t = useAdminT();
  const d = t.data.pricing.play;
  const sh = t.data.shared;
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState("");
  const [query, setQuery] = useState("");

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
    setSyncError("");
    try {
      const res = await fetch("/api/admin/pricing/sync", { method: "POST" });
      const body = (await res.json()) as { ok?: boolean; error?: string; message?: string };
      if (!res.ok || !body.ok) throw new Error(body.error ?? body.message ?? `HTTP ${res.status}`);
      // Poora page dobara load — sync ke baad table, ginti aur "aakhri sync"
      // teenon badalte hain, aur unhe alag-alag patch karna sirf teen naye bug
      // ka mauka hai.
      await onSynced();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const syncedAgo = ago(play?.syncedAt ?? null);
  const stale =
    Boolean(play?.syncedAt) && Date.now() - new Date(play!.syncedAt!).getTime() > STALE_MS;

  return (
    <div className="rounded-3xl border border-line bg-surface p-5 shadow-soft">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 font-display text-lg font-semibold">
            {d.title}
            <span className="inline-flex items-center gap-1 rounded-full bg-cream-deep/50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-ink-soft">
              <Lock size={11} /> read-only
            </span>
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">{d.sub}</p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={PLAY_CONSOLE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-ink-soft transition hover:text-terracotta"
          >
            <ExternalLink size={15} /> {d.openConsole}
          </a>
          <button
            onClick={sync}
            disabled={syncing || !play?.configured}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-terracotta px-4 text-sm font-semibold text-white shadow-warm transition hover:bg-terracotta-dark disabled:opacity-50"
          >
            {syncing ? <Loader size={16} /> : <RefreshCw size={15} />}
            {syncing ? d.syncing : d.syncNow}
          </button>
        </div>
      </div>

      {/* Chalu hai ya nahi — aur nahi to KYUN. Ye ek line poore setup ka
          sabse kaam ka hissa hai. */}
      {play && !play.configured && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-line bg-cream-deep/25 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-ink-soft" />
          <div className="min-w-0 text-sm">
            <p className="font-semibold text-ink">{d.offTitle}</p>
            <p className="mt-0.5 text-ink-soft">{play.status}</p>
            <p className="mt-1 text-ink-soft">{d.offBody}</p>
          </div>
        </div>
      )}

      {/* Sync chal to raha hai par fail ho raha hai — ye chup-chaap nahi rehna
          chahiye, warna purana price hafton tak sahi lagta rehta hai. */}
      {play?.configured && play.message && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/10 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-terracotta-dark" />
          <p className="text-sm leading-relaxed text-terracotta-dark">{play.message}</p>
        </div>
      )}

      {syncError && (
        <div className="mt-4 flex items-start gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/10 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-terracotta-dark" />
          <p className="text-sm leading-relaxed text-terracotta-dark">{syncError}</p>
        </div>
      )}

      {stale && (
        <p className="mt-4 rounded-2xl border border-terracotta/30 bg-terracotta/10 px-4 py-3 text-sm font-semibold text-terracotta-dark">
          {d.staleWarn}
        </p>
      )}

      <p className="mt-4 text-sm text-ink-soft">
        {d.lastSync}: <b className="text-ink">{syncedAgo ?? d.never}</b>
        {regions.length > 0 && (
          <>
            {" · "}
            {regions.length} {d.regions}
          </>
        )}
        {play?.products?.length ? <> · {play.products.join(", ")}</> : null}
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
                  <th className="px-3 py-2.5 font-semibold">{t.data.pricing.country}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.data.pricing.currency}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.data.pricing.monthly}</th>
                  <th className="px-3 py-2.5 font-semibold">{t.data.pricing.yearly}</th>
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
                    {/* Label seedha server se aata hai (Intl se bana) — symbol ki
                        jagah har currency me alag hoti hai, isliye yahan number
                        aur symbol dobara jodne ki koshish nahi karte. */}
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
  );
}

function LabeledInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  const [text, setText] = useState(() => (value ? String(value) : ""));

  useEffect(() => {
    const n = Number(text);
    const inSync = text.trim() !== "" && Number.isFinite(n) && n === value;
    if (!inSync) setText(value ? String(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handle(raw: string) {
    if (!/^\d*\.?\d*$/.test(raw)) return;
    setText(raw);
    const n = Number(raw);
    onChange(raw.trim() === "" || !Number.isFinite(n) ? 0 : n);
  }

  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-soft">{label}</span>
      <input
        value={text}
        inputMode="decimal"
        placeholder="0"
        onChange={(e) => handle(e.target.value)}
        className="mt-1.5 h-10 w-full rounded-xl border border-line bg-cream px-3 text-sm outline-none focus:border-terracotta"
      />
    </label>
  );
}

function Cell({
  value,
  onChange,
  w = "w-20",
  invalid = false,
}: {
  value: string;
  onChange: (v: string) => void;
  w?: string;
  invalid?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 ${w} rounded-lg border bg-cream px-2 text-sm outline-none focus:border-terracotta ${
        invalid ? "border-terracotta" : "border-line"
      }`}
    />
  );
}

/**
 * Number input jo type karte waqt raw text rakhta hai — warna "0", "0." ya
 * "0.01" jaisi value beech me hi reset ho jaati thi (0.012 daali hi nahi
 * ja sakti thi). Calculation ke liye number bahar bhejta hai.
 */
function NumCell({
  value,
  onChange,
  disabled = false,
  invalid = false,
  width = "w-24",
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  invalid?: boolean;
  width?: string;
}) {
  const [text, setText] = useState(() => (value ? String(value) : ""));

  // Bahar se value badle (load / "Apply to all" / save) to text sync karo.
  // Jab user type kar raha ho (text ka number wahi hai) tab chhedo mat.
  useEffect(() => {
    const n = Number(text);
    const inSync = text.trim() !== "" && Number.isFinite(n) && n === value;
    if (!inSync) setText(value ? String(value) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function handle(raw: string) {
    // khaali, "0", "0.", ".5", "0.012" — sab allowed. Aur kuch nahi.
    if (!/^\d*\.?\d*$/.test(raw)) return;
    setText(raw);
    const n = Number(raw);
    onChange(raw.trim() === "" || !Number.isFinite(n) ? 0 : n);
  }

  return (
    <input
      value={text}
      disabled={disabled}
      inputMode="decimal"
      placeholder="0.00"
      onChange={(e) => handle(e.target.value)}
      className={`h-9 ${width} rounded-lg border bg-cream px-2 text-sm outline-none focus:border-terracotta disabled:opacity-60 ${
        invalid && !disabled ? "border-terracotta" : "border-line"
      }`}
    />
  );
}
