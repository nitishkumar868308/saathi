"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Loader2,
  AlertTriangle,
  Download,
  FileText,
  Bell,
  MessageSquare,
  Activity,
  Search,
} from "lucide-react";

type UsageRow = {
  id: string;
  email: string | null;
  name: string | null;
  plan: "free" | "plus";
  joinedAt: string;
  documents: number;
  reminders: number;
  messages: number;
  lastActive: string | null;
};

const INACTIVE_DAYS = 14;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24));
}

/** Bilkul use nahi kar raha: koi document/reminder/chat nahi. */
function isDormant(u: UsageRow): boolean {
  return u.documents === 0 && u.reminders === 0 && u.messages === 0;
}

/** Pehle active tha par ab {INACTIVE_DAYS}+ din se kuch nahi. */
function isInactive(u: UsageRow): boolean {
  const d = daysAgo(u.lastActive);
  return !isDormant(u) && d !== null && d >= INACTIVE_DAYS;
}

function toCsv(rows: string[][]): string {
  return rows
    .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

function download(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Filter = "all" | "active" | "inactive" | "dormant";

export default function AdminUsage() {
  const [usage, setUsage] = useState<UsageRow[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/usage", { cache: "no-store" });
      const body = (await res.json()) as { usage?: UsageRow[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setUsage(body.usage ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Usage load nahi hua");
      setUsage([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const list = usage ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((u) => {
      if (filter === "dormant" && !isDormant(u)) return false;
      if (filter === "inactive" && !isInactive(u)) return false;
      if (filter === "active" && (isDormant(u) || isInactive(u))) return false;
      if (!q) return true;
      return (
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [usage, filter, query]);

  const stats = useMemo(() => {
    const list = usage ?? [];
    return {
      total: list.length,
      dormant: list.filter(isDormant).length,
      inactive: list.filter(isInactive).length,
    };
  }, [usage]);

  function exportCsv() {
    download(
      "apka-saathi-usage.csv",
      toCsv([
        ["Name", "Email", "Plan", "Documents", "Reminders", "Chats", "Last active", "Joined"],
        ...rows.map((u) => [
          u.name ?? "",
          u.email ?? "",
          u.plan,
          String(u.documents),
          String(u.reminders),
          String(u.messages),
          fmtDate(u.lastActive),
          fmtDate(u.joinedAt),
        ]),
      ]),
    );
  }

  if (!usage) {
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

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <Stat label="Total users" value={stats.total} />
        <Stat label={`Inactive (${INACTIVE_DAYS}d+)`} value={stats.inactive} />
        <Stat label="Kabhi use nahi kiya" value={stats.dormant} />
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Email ya naam..."
            className="h-11 w-full rounded-2xl border border-line bg-surface pl-10 pr-4 text-sm outline-none transition focus:border-terracotta focus:ring-4 focus:ring-terracotta/15"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-2xl border border-line bg-surface p-1">
            {(["all", "active", "inactive", "dormant"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`h-9 rounded-xl px-2.5 text-xs font-semibold capitalize transition ${
                  filter === f ? "bg-terracotta text-white" : "text-ink-soft hover:text-ink"
                }`}
              >
                {f === "dormant" ? "Never" : f}
              </button>
            ))}
          </div>
          <button
            onClick={exportCsv}
            disabled={!rows.length}
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-4 text-sm font-semibold text-ink-soft transition hover:text-terracotta disabled:opacity-50"
          >
            <Download size={16} />
            CSV
          </button>
        </div>
      </div>

      {!rows.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-line bg-surface py-16 text-center shadow-soft">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-deep/50 text-ink-soft">
            <Activity size={24} />
          </span>
          <p className="text-sm text-ink-soft">Is filter me koi user nahi.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-3xl border border-line bg-surface shadow-soft lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-cream-deep/25 text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-semibold">User</th>
                  <th className="px-4 py-3 text-center font-semibold">Docs</th>
                  <th className="px-4 py-3 text-center font-semibold">Reminders</th>
                  <th className="px-4 py-3 text-center font-semibold">Chats</th>
                  <th className="px-4 py-3 font-semibold">Last active</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-b border-line/60">
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-ink">{u.name || "—"}</p>
                      <p className="text-xs text-ink-soft">{u.email ?? "—"}</p>
                    </td>
                    <td className="px-4 py-3.5 text-center font-semibold text-ink">
                      {u.documents}
                    </td>
                    <td className="px-4 py-3.5 text-center font-semibold text-ink">
                      {u.reminders}
                    </td>
                    <td className="px-4 py-3.5 text-center font-semibold text-ink">
                      {u.messages}
                    </td>
                    <td className="px-4 py-3.5 text-ink-soft">{fmtDate(u.lastActive)}</td>
                    <td className="px-4 py-3.5">
                      <StatusBadge u={u} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {rows.map((u) => (
              <div key={u.id} className="rounded-3xl border border-line bg-surface p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">{u.name || "—"}</p>
                    <p className="truncate text-xs text-ink-soft">{u.email ?? "—"}</p>
                  </div>
                  <StatusBadge u={u} />
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
                  <Count icon={<FileText size={14} />} label="Docs" n={u.documents} />
                  <Count icon={<Bell size={14} />} label="Reminders" n={u.reminders} />
                  <Count icon={<MessageSquare size={14} />} label="Chats" n={u.messages} />
                </div>
                <p className="mt-2 text-center text-xs text-ink-soft">
                  Last active: {fmtDate(u.lastActive)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ u }: { u: UsageRow }) {
  if (isDormant(u)) {
    return (
      <span className="inline-flex items-center rounded-full bg-terracotta/12 px-2.5 py-1 text-xs font-bold text-terracotta-dark">
        Never used
      </span>
    );
  }
  if (isInactive(u)) {
    return (
      <span className="inline-flex items-center rounded-full bg-amber-warm/15 px-2.5 py-1 text-xs font-bold text-amber-warm">
        Inactive
      </span>
    );
  }
  return (
    <span className="inline-flex items-center rounded-full bg-sage/15 px-2.5 py-1 text-xs font-bold text-sage">
      Active
    </span>
  );
}

function Count({ icon, label, n }: { icon: React.ReactNode; label: string; n: number }) {
  return (
    <div>
      <p className="flex items-center justify-center gap-1 font-display text-lg font-bold text-ink">
        {icon}
        {n}
      </p>
      <p className="text-[11px] text-ink-soft">{label}</p>
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
