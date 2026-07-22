"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Download,
  FileText,
  Bell,
  MessageSquare,
  Activity,
  Search,
  X,
} from "lucide-react";
import { SkeletonRows } from "@/components/Loader";

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

type ActivityRow = {
  kind: "document" | "reminder" | "chat";
  itemId: string;
  title: string;
  detail: string | null;
  userId: string | null;
  email: string | null;
  name: string | null;
  at: string;
};

const RANGES = [
  { key: "today", label: "Aaj" },
  { key: "yesterday", label: "Kal" },
  { key: "7", label: "7 din" },
  { key: "30", label: "30 din" },
  { key: "all", label: "Sab" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

const INACTIVE_DAYS = 14;

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

function daysAgo(iso: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

const isDormant = (u: UsageRow) => u.documents === 0 && u.reminders === 0 && u.messages === 0;
const isInactive = (u: UsageRow) => {
  const d = daysAgo(u.lastActive);
  return !isDormant(u) && d !== null && d >= INACTIVE_DAYS;
};

function toCsv(rows: string[][]): string {
  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
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

const KIND = {
  document: { icon: FileText, label: "Document", cls: "bg-terracotta/12 text-terracotta-dark" },
  reminder: { icon: Bell, label: "Reminder", cls: "bg-amber-warm/20 text-amber-warm" },
  chat: { icon: MessageSquare, label: "Chat", cls: "bg-sage/15 text-sage" },
} as const;

type Filter = "all" | "active" | "inactive" | "dormant";

export default function AdminUsage() {
  const [usage, setUsage] = useState<UsageRow[] | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [range, setRange] = useState<RangeKey>("7");
  const [query, setQuery] = useState("");
  /** Kisi ek user pe zoom — uski hi activity dikhegi. */
  const [focus, setFocus] = useState<UsageRow | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const qs = new URLSearchParams({ range });
      if (focus) qs.set("uid", focus.id);
      const res = await fetch(`/api/admin/usage?${qs}`, { cache: "no-store" });
      const body = (await res.json()) as {
        usage?: UsageRow[];
        activity?: ActivityRow[];
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setUsage(body.usage ?? []);
      setActivity(body.activity ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Usage load nahi hua");
      setUsage([]);
    }
  }, [range, focus]);

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
        (u.email ?? "").toLowerCase().includes(q) || (u.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [usage, filter, query]);

  const stats = useMemo(() => {
    const list = usage ?? [];
    return {
      docs: list.reduce((s, u) => s + u.documents, 0),
      rems: list.reduce((s, u) => s + u.reminders, 0),
      chats: list.reduce((s, u) => s + u.messages, 0),
      active: list.filter((u) => !isDormant(u)).length,
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

  if (!usage) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/10 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-terracotta-dark" />
          <p className="text-sm leading-relaxed text-terracotta-dark">{error}</p>
        </div>
      )}

      {/* Date range — sab kuch isi ke hisaab se */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-2xl border border-line bg-surface p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`h-9 rounded-xl px-3 text-xs font-semibold transition ${
                range === r.key ? "bg-terracotta text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        {focus && (
          <button
            onClick={() => setFocus(null)}
            className="inline-flex h-9 items-center gap-2 rounded-full bg-terracotta px-3 text-xs font-bold text-white"
          >
            {focus.name || focus.email || "user"}
            <X size={13} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <Stat label="Documents" value={stats.docs} />
        <Stat label="Reminders" value={stats.rems} />
        <Stat label="Chats" value={stats.chats} />
        <Stat label="Active users" value={stats.active} />
      </div>

      {/* Activity feed — kaun sa item, kab */}
      <div className="rounded-3xl border border-line bg-surface shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-display text-base font-semibold">
            {focus ? `${focus.name || focus.email} ne kya kiya` : "Kya-kya hua"}
          </h3>
          <span className="text-xs font-semibold text-ink-soft">{activity.length} items</span>
        </div>
        {!activity.length ? (
          <p className="px-5 py-10 text-center text-sm text-ink-soft">
            Is range me koi activity nahi.
          </p>
        ) : (
          <ul className="max-h-[420px] divide-y divide-line/60 overflow-y-auto">
            {activity.map((a) => {
              const k = KIND[a.kind];
              const Icon = k.icon;
              return (
                <li key={`${a.kind}-${a.itemId}`} className="flex items-start gap-3 px-5 py-3">
                  <span
                    className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${k.cls}`}
                  >
                    <Icon size={14} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink">{a.title || "—"}</p>
                    <p className="truncate text-xs text-ink-soft">
                      {k.label}
                      {a.detail ? ` · ${a.detail}` : ""}
                      {!focus && (a.name || a.email) ? ` · ${a.name || a.email}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-ink-soft">{fmtTime(a.at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Per-user */}
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
        <div className="overflow-x-auto rounded-3xl border border-line bg-surface shadow-soft">
          <table className="w-full min-w-[640px] text-left text-sm">
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
                <tr
                  key={u.id}
                  onClick={() => setFocus(u)}
                  className="cursor-pointer border-b border-line/60 transition hover:bg-cream-deep/20"
                >
                  <td className="px-4 py-3.5">
                    <p className="font-semibold text-ink">{u.name || "—"}</p>
                    <p className="text-xs text-ink-soft">{u.email ?? "—"}</p>
                  </td>
                  <td className="px-4 py-3.5 text-center font-semibold text-ink">{u.documents}</td>
                  <td className="px-4 py-3.5 text-center font-semibold text-ink">{u.reminders}</td>
                  <td className="px-4 py-3.5 text-center font-semibold text-ink">{u.messages}</td>
                  <td className="px-4 py-3.5 text-ink-soft">{fmtDate(u.lastActive)}</td>
                  <td className="px-4 py-3.5">
                    <StatusBadge u={u} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-ink-soft">
        Ginti chuni hui date range ki hai. Kisi user pe click karo — sirf uski activity dikhegi.
      </p>
    </div>
  );
}

function StatusBadge({ u }: { u: UsageRow }) {
  if (isDormant(u))
    return (
      <span className="inline-flex items-center rounded-full bg-terracotta/12 px-2.5 py-1 text-xs font-bold text-terracotta-dark">
        Never used
      </span>
    );
  if (isInactive(u))
    return (
      <span className="inline-flex items-center rounded-full bg-amber-warm/15 px-2.5 py-1 text-xs font-bold text-amber-warm">
        Inactive
      </span>
    );
  return (
    <span className="inline-flex items-center rounded-full bg-sage/15 px-2.5 py-1 text-xs font-bold text-sage">
      Active
    </span>
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
