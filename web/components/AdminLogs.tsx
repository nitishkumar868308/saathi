"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bug, ChevronDown, RefreshCw, Smartphone, Globe } from "lucide-react";
import { SkeletonRows } from "@/components/Loader";

type AppError = {
  id: string;
  source: string;
  level: string;
  message: string;
  stack: string | null;
  context: Record<string, unknown> | null;
  platform: string | null;
  appVersion: string | null;
  createdAt: string;
  email: string | null;
  name: string | null;
};

const RANGES = [
  { key: 1, label: "Aaj" },
  { key: 2, label: "Kal se" },
  { key: 7, label: "7 din" },
  { key: 30, label: "30 din" },
] as const;

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function AdminLogs() {
  const [errors, setErrors] = useState<AppError[] | null>(null);
  const [error, setError] = useState("");
  const [days, setDays] = useState<number>(7);
  const [source, setSource] = useState<"all" | "app" | "web">("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/errors?days=${days}&source=${source}`, {
        cache: "no-store",
      });
      const body = (await res.json()) as { errors?: AppError[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setErrors(body.errors ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Logs load nahi hue");
      setErrors([]);
    } finally {
      setBusy(false);
    }
  }, [days, source]);

  useEffect(() => {
    load();
  }, [load]);

  /** Ek jaisa message = ek group (kitni baar aaya). */
  const groups = useMemo(() => {
    const map = new Map<string, { sample: AppError; count: number }>();
    for (const e of errors ?? []) {
      const key = `${e.source}|${e.message}`;
      const g = map.get(key);
      if (g) g.count++;
      else map.set(key, { sample: e, count: 1 });
    }
    return Array.from(map.values()).sort(
      (a, b) =>
        b.count - a.count ||
        new Date(b.sample.createdAt).getTime() - new Date(a.sample.createdAt).getTime(),
    );
  }, [errors]);

  if (!errors) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/10 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-terracotta-dark" />
          <p className="text-sm leading-relaxed text-terracotta-dark">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <Stat label="Total errors" value={errors.length} />
        <Stat label="Alag tarah ke" value={groups.length} />
        <Stat label="App se" value={errors.filter((e) => e.source === "app").length} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-2xl border border-line bg-surface p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setDays(r.key)}
              className={`h-9 rounded-xl px-3 text-xs font-semibold transition ${
                days === r.key ? "bg-terracotta text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex rounded-2xl border border-line bg-surface p-1">
          {(["all", "app", "web"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSource(s)}
              className={`h-9 rounded-xl px-3 text-xs font-semibold capitalize transition ${
                source === s ? "bg-terracotta text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          className="ml-auto inline-flex h-10 items-center gap-2 rounded-2xl border border-line bg-surface px-4 text-sm font-semibold text-ink-soft transition hover:text-terracotta"
        >
          <RefreshCw size={15} className={busy ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {!groups.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-line bg-surface py-16 text-center shadow-soft">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sage/15 text-sage">
            <Bug size={24} />
          </span>
          <p className="text-sm font-semibold text-ink">Koi error nahi 🎉</p>
          <p className="text-sm text-ink-soft">Is range me sab theek chala.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map(({ sample, count }) => {
            const open = openId === sample.id;
            return (
              <div key={sample.id} className="rounded-3xl border border-line bg-surface shadow-soft">
                <button
                  onClick={() => setOpenId(open ? null : sample.id)}
                  className="w-full p-4 text-left"
                  aria-expanded={open}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        sample.source === "web"
                          ? "bg-cream-deep text-ink-soft"
                          : "bg-terracotta/12 text-terracotta-dark"
                      }`}
                    >
                      {sample.source === "web" ? <Globe size={14} /> : <Smartphone size={14} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold text-ink">{sample.message}</p>
                      <p className="mt-1 text-xs text-ink-soft">
                        {sample.source} · {sample.platform ?? "—"} · v{sample.appVersion ?? "—"} ·{" "}
                        {fmt(sample.createdAt)}
                        {sample.email ? ` · ${sample.email}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-cream-deep px-2.5 py-1 text-xs font-bold text-ink-soft">
                      ×{count}
                    </span>
                    <ChevronDown
                      size={16}
                      className={`mt-1 shrink-0 text-ink-soft transition-transform ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>
                {open && (
                  <div className="space-y-3 border-t border-line p-4">
                    {sample.context && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                          Context
                        </p>
                        <pre className="mt-1.5 overflow-x-auto rounded-xl bg-cream-deep/40 p-3 text-xs text-ink">
                          {JSON.stringify(sample.context, null, 2)}
                        </pre>
                      </div>
                    )}
                    {sample.stack && (
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                          Stack
                        </p>
                        <pre className="mt-1.5 max-h-72 overflow-auto rounded-xl bg-cream-deep/40 p-3 text-[11px] leading-relaxed text-ink-soft">
                          {sample.stack}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-ink-soft">
        Ek jaisi error ek hi row me hai (×N = kitni baar aayi). Naye errors ka email har
        30 min me <b>saathi8683@gmail.com</b> pe jaata hai.
      </p>
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
