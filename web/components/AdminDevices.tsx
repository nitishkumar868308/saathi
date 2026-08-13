"use client";

import { useCallback, useEffect, useState } from "react";
import { Search, Smartphone, CheckCircle2, ShieldCheck, AlertTriangle } from "lucide-react";

import { SkeletonRows } from "@/components/Loader";
import Pagination from "@/components/admin/Pagination";

/**
 * Admin > Devices — "kaun sa user kaun se phone se chal raha hai".
 *
 * Ek waqt me ek hi phone "active" rehta hai (`supabase/device-approval.sql`).
 * Active phone par hi reminder ke alarm lagte hain aur notification jaati hai;
 * baaki phone par app chalti hai par chup rehti hai.
 *
 * ⚠️ Yahan device ki asli **hardware id kabhi nahi** aati, aur wo jaan-boojh ke
 * hai — wo server par bheji hi nahi jaati (sirf uska salted hash, aur wo bhi
 * sirf referral anti-fraud ke liye). Support ke liye itna kaafi hai: platform,
 * brand/model, aur kab se kab tak dikha.
 *
 * ⚠️ "Chaalu karo" ek BHAARI button hai. Wo us user ke saare reminder is phone
 * par le aata hai AUR uske purane phone par band kar deta hai. Isliye pehle
 * confirm poochha jaata hai jisme saaf likha hai ki kya hoga.
 */

type Device = {
  id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  platform: string | null;
  fingerprint: string | null;
  language: string | null;
  first_seen_at: string;
  last_seen_at: string;
  is_active: boolean;
  approved_at: string | null;
  approved_via: string | null;
  is_first_owner: boolean;
};

const PAGE = 50;

function fmtDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** "samsung|SM-G991B|Android|14" → "samsung SM-G991B · Android 14" */
function prettyDevice(fp: string | null, platform: string | null): string {
  if (!fp) return platform ?? "—";
  const [brand, model, os, ver] = fp.split("|");
  const left = [brand, model].filter(Boolean).join(" ");
  const right = [os, ver].filter(Boolean).join(" ");
  return [left, right].filter(Boolean).join(" · ") || (platform ?? "—");
}

export default function AdminDevices() {
  const [rows, setRows] = useState<Device[]>([]);
  const [total, setTotal] = useState(0);
  // ⚠️ 1-indexed — `components/admin/Pagination` isi hisaab par chalta hai.
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Device | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE),
        offset: String((page - 1) * PAGE),
      });
      if (q.trim()) params.set("q", q.trim());
      const res = await fetch(`/api/admin/devices?${params}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "load failed");
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, q]);

  // Search par har akshar pe call na jaye — thoda ruk ke.
  useEffect(() => {
    const t = setTimeout(() => void load(), 300);
    return () => clearTimeout(t);
  }, [load]);

  async function approve(d: Device) {
    if (!d.user_id) return;
    setBusyId(d.id);
    try {
      const res = await fetch("/api/admin/devices", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ userId: d.user_id, deviceId: d.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error ?? "approve failed");
      setConfirm(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "approve failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-soft" />
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
          placeholder="Email, naam, device id ya phone model se dhoondho"
          className="w-full rounded-2xl border border-line bg-surface py-3 pl-10 pr-4 text-sm text-ink outline-none placeholder:text-ink-soft focus:border-terracotta"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-2xl border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <SkeletonRows rows={6} />
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center text-sm text-ink-soft">
          Koi device nahi mila.
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((d) => (
            <div
              key={d.id}
              className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-center"
            >
              <div className="flex min-w-0 flex-1 items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    d.is_active ? "bg-sage/15 text-sage" : "bg-line/60 text-ink-soft"
                  }`}
                >
                  <Smartphone className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-ink">
                      {d.name || d.email || "—"}
                    </span>
                    {d.is_active && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-sage/15 px-2 py-0.5 text-[11px] font-bold text-sage">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </span>
                    )}
                    {d.approved_via === "admin" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-terracotta/12 px-2 py-0.5 text-[11px] font-bold text-terracotta">
                        <ShieldCheck className="h-3 w-3" /> Admin ne kiya
                      </span>
                    )}
                    {d.is_first_owner && (
                      <span className="rounded-full bg-line/70 px-2 py-0.5 text-[11px] font-semibold text-ink-soft">
                        Pehla maalik
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-ink-soft">{d.email}</div>
                  <div className="mt-1 text-xs text-ink-soft">
                    {prettyDevice(d.fingerprint, d.platform)}
                  </div>
                  <div className="mt-1 text-[11px] text-ink-soft">
                    Aakhri baar {fmtDateTime(d.last_seen_at)} · Pehli baar{" "}
                    {fmtDateTime(d.first_seen_at)}
                  </div>
                  {/* Device id poori — support par user se milaane ke liye. */}
                  <div className="mt-1 break-all font-mono text-[10px] text-ink-soft/70">
                    {d.id}
                  </div>
                </div>
              </div>

              {!d.is_active && d.user_id && (
                <button
                  onClick={() => setConfirm(d)}
                  disabled={busyId === d.id}
                  className="shrink-0 rounded-xl bg-terracotta px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  Is phone ko chaalu karo
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Pagination
        page={page}
        pageCount={Math.max(1, Math.ceil(total / PAGE))}
        total={total}
        from={total === 0 ? 0 : (page - 1) * PAGE + 1}
        to={Math.min(page * PAGE, total)}
        onPage={setPage}
        label="devices"
      />

      {/**
       * Confirm — kyunki ye kaam wapas nahi hota aur doosre phone par asar daalta
       * hai. Yahan saaf-saaf likha hai ki kya hoga, "kya aap sure hain?" jaisa
       * bemtlab sawaal nahi.
       */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl border border-line bg-surface p-6">
            <h3 className="text-lg font-extrabold text-ink">Is phone ko chaalu karein?</h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              <span className="font-semibold text-ink">
                {confirm.name || confirm.email}
              </span>{" "}
              ke saare reminder aur alert ab{" "}
              <span className="font-semibold text-ink">
                {prettyDevice(confirm.fingerprint, confirm.platform)}
              </span>{" "}
              par aayenge.
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Unke baaki phone par notification aana <strong>band</strong> ho jayega.
            </p>
            <div className="mt-5 flex gap-3">
              <button
                onClick={() => setConfirm(null)}
                className="flex-1 rounded-xl border border-line py-2.5 text-sm font-semibold text-ink-soft"
              >
                Rehne do
              </button>
              <button
                onClick={() => void approve(confirm)}
                disabled={busyId === confirm.id}
                className="flex-1 rounded-xl bg-terracotta py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {busyId === confirm.id ? "Ho raha hai…" : "Haan, chaalu karo"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
