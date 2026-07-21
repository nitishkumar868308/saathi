"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, AlertTriangle, Plus, Trash2, Save, Globe, Check } from "lucide-react";

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

function roundPrice(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n >= 20 ? Math.round(n) : Math.round(n * 10) / 10;
}

export default function AdminPricing() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [base, setBase] = useState<Base>({ monthly: 99, yearly: 999 });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [addCode, setAddCode] = useState("");
  const [bulkMult, setBulkMult] = useState("3");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/pricing", { cache: "no-store" });
      const body = (await res.json()) as {
        rows?: Row[];
        countries?: CountryOption[];
        base?: Base;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setRows(body.rows ?? []);
      setCountries(body.countries ?? []);
      if (body.base) setBase(body.base);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Pricing load nahi hui");
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
      setError(e instanceof Error ? e.message : "Save nahi hua");
    } finally {
      setSaving(false);
    }
  }

  if (!rows) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="animate-spin text-terracotta" size={26} />
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

      {/* Base price (INR) */}
      <div className="rounded-3xl border border-line bg-surface p-5 shadow-soft">
        <h3 className="font-display text-lg font-semibold">Base price (INR)</h3>
        <p className="mt-1 text-sm text-ink-soft">
          Har country ka price = base × multiplier × conversion rate.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <LabeledInput
            label="Monthly ₹"
            value={base.monthly}
            onChange={(v) => {
              setBase((b) => ({ ...b, monthly: v }));
              setSaved(false);
            }}
          />
          <LabeledInput
            label="Yearly ₹"
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
          <label className="text-xs font-semibold text-ink-soft">Country add karo</label>
          <div className="mt-1.5 flex gap-2">
            <select
              value={addCode}
              onChange={(e) => setAddCode(e.target.value)}
              className="h-10 flex-1 rounded-xl border border-line bg-cream px-3 text-sm outline-none focus:border-terracotta"
            >
              <option value="">Choose…</option>
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
          <label className="text-xs font-semibold text-ink-soft">Multiplier (bahar ke liye)</label>
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
              Apply to all
            </button>
          </div>
        </div>
      </div>

      {/* Rows */}
      <div className="overflow-x-auto rounded-3xl border border-line bg-surface shadow-soft">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line bg-cream-deep/25 text-xs uppercase tracking-wider text-ink-soft">
            <tr>
              <th className="px-3 py-3 font-semibold">Country</th>
              <th className="px-3 py-3 font-semibold">Currency</th>
              <th className="px-3 py-3 font-semibold">Symbol</th>
              <th className="px-3 py-3 font-semibold">Multiplier</th>
              <th className="px-3 py-3 font-semibold">1 INR =</th>
              <th className="px-3 py-3 font-semibold">Monthly</th>
              <th className="px-3 py-3 font-semibold">On</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
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
                        aria-label="Remove"
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

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex h-11 items-center gap-2 rounded-2xl bg-terracotta px-6 text-sm font-semibold text-white shadow-warm transition hover:bg-terracotta-dark disabled:opacity-70"
        >
          {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
          Save
        </button>
        {saved && (
          <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-sage">
            <Check size={16} /> Save ho gaya
          </span>
        )}
      </div>

      <p className="text-xs leading-relaxed text-ink-soft">
        Note: ye sirf <b>display</b> price hai. Actual charge Google Play user ke
        account-country se leta hai — VPN/fake-GPS se display badal sakta hai, charge nahi.
      </p>
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
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-soft">{label}</span>
      <input
        value={value}
        inputMode="numeric"
        onChange={(e) => onChange(Number(e.target.value) || 0)}
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

function NumCell({
  value,
  onChange,
  disabled = false,
  invalid = false,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  invalid?: boolean;
}) {
  return (
    <input
      value={value || ""}
      disabled={disabled}
      inputMode="decimal"
      placeholder="0"
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className={`h-9 w-20 rounded-lg border bg-cream px-2 text-sm outline-none focus:border-terracotta disabled:opacity-60 ${
        invalid && !disabled ? "border-terracotta" : "border-line"
      }`}
    />
  );
}
