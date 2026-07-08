"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Users as UsersIcon,
  Search,
  Download,
  Loader2,
  AlertTriangle,
  Crown,
  Infinity as InfinityIcon,
} from "lucide-react";

type AdminUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  plan: "free" | "plus";
  planExpiresAt: string | null;
  planSource: string | null;
  firstNGranted: boolean;
  referralDaysEarned: number;
  referralCode: string | null;
  createdAt: string;
};

/* ------------------------------ helpers ------------------------------ */

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Plus + plan_expires_at === null  => lifetime / active subscription.
 * Plus + future date              => tab tak active.
 * Plus + past date                => expire ho chuka (DB abhi bhi 'plus' keh sakta hai).
 */
type Status = { label: string; tone: "plus" | "free" | "expired"; lifetime: boolean };

function statusOf(u: AdminUser): Status {
  if (u.plan !== "plus") return { label: "Free", tone: "free", lifetime: false };
  if (!u.planExpiresAt) return { label: "Plus", tone: "plus", lifetime: true };
  const expired = new Date(u.planExpiresAt).getTime() < Date.now();
  return expired
    ? { label: "Expired", tone: "expired", lifetime: false }
    : { label: "Plus", tone: "plus", lifetime: false };
}

const SOURCE_LABEL: Record<string, string> = {
  first_n: "First-N offer",
  referral: "Referral",
  reward: "Reward",
  google_play: "Google Play",
  admin: "Admin grant",
};

function sourceLabel(s: string | null): string {
  if (!s) return "—";
  return SOURCE_LABEL[s] ?? s;
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

/* -------------------------------- View -------------------------------- */

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "plus" | "free">("all");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const body = (await res.json()) as { users?: AdminUser[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setUsers(body.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Users load nahi hue");
      setUsers([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const list = users ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((u) => {
      const st = statusOf(u);
      if (filter === "plus" && st.tone !== "plus") return false;
      if (filter === "free" && st.tone === "plus") return false;
      if (!q) return true;
      return (
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.fullName ?? "").toLowerCase().includes(q) ||
        (u.referralCode ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, query, filter]);

  const stats = useMemo(() => {
    const list = users ?? [];
    return {
      total: list.length,
      plus: list.filter((u) => statusOf(u).tone === "plus").length,
      firstN: list.filter((u) => u.firstNGranted).length,
    };
  }, [users]);

  function exportCsv() {
    download(
      "apka-saathi-users.csv",
      toCsv([
        ["Name", "Email", "Plan", "Source", "Joined", "Active till", "Referral days", "Code"],
        ...rows.map((u) => {
          const st = statusOf(u);
          return [
            u.fullName ?? "",
            u.email ?? "",
            st.label,
            sourceLabel(u.planSource),
            fmtDate(u.createdAt),
            st.lifetime ? "Unlimited" : fmtDate(u.planExpiresAt),
            String(u.referralDaysEarned),
            u.referralCode ?? "",
          ];
        }),
      ]),
    );
  }

  if (!users) {
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
        <Stat label="Plus (active)" value={stats.plus} />
        <Stat label="First-N mila" value={stats.firstN} />
      </div>

      {/* Search + filter + export */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Email, naam ya referral code..."
            className="h-11 w-full rounded-2xl border border-line bg-surface pl-10 pr-4 text-sm outline-none transition focus:border-terracotta focus:ring-4 focus:ring-terracotta/15"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex rounded-2xl border border-line bg-surface p-1">
            {(["all", "plus", "free"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`h-9 rounded-xl px-3 text-xs font-semibold capitalize transition ${
                  filter === f ? "bg-terracotta text-white" : "text-ink-soft hover:text-ink"
                }`}
              >
                {f}
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
            <UsersIcon size={24} />
          </span>
          <p className="text-sm text-ink-soft">
            {users.length ? "Is filter me koi user nahi." : "Abhi koi user nahi."}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto rounded-3xl border border-line bg-surface shadow-soft lg:block">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-line bg-cream-deep/25 text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <Th>User</Th>
                  <Th>Plan</Th>
                  <Th>Source</Th>
                  <Th>Joined</Th>
                  <Th>Active till</Th>
                  <Th className="text-right">Referral din</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const st = statusOf(u);
                  return (
                    <tr
                      key={u.id}
                      className="border-b border-line/60 transition last:border-0 hover:bg-cream-deep/20"
                    >
                      <td className="px-4 py-3.5">
                        <p className="font-semibold text-ink">{u.fullName || "—"}</p>
                        <p className="text-xs text-ink-soft">{u.email ?? "—"}</p>
                      </td>
                      <td className="px-4 py-3.5">
                        <PlanBadge status={st} />
                      </td>
                      <td className="px-4 py-3.5 text-ink-soft">{sourceLabel(u.planSource)}</td>
                      <td className="px-4 py-3.5 text-ink-soft">{fmtDate(u.createdAt)}</td>
                      <td className="px-4 py-3.5 text-ink-soft">
                        {st.lifetime ? (
                          <span className="inline-flex items-center gap-1.5 font-medium text-sage">
                            <InfinityIcon size={14} />
                            Unlimited
                          </span>
                        ) : (
                          fmtDate(u.planExpiresAt)
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-right font-semibold text-ink">
                        {u.referralDaysEarned}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {rows.map((u) => {
              const st = statusOf(u);
              return (
                <div
                  key={u.id}
                  className="rounded-3xl border border-line bg-surface p-4 shadow-soft"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{u.fullName || "—"}</p>
                      <p className="truncate text-xs text-ink-soft">{u.email ?? "—"}</p>
                    </div>
                    <PlanBadge status={st} />
                  </div>
                  <dl className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-line pt-3.5 text-xs">
                    <Field label="Joined" value={fmtDate(u.createdAt)} />
                    <Field
                      label="Active till"
                      value={st.lifetime ? "Unlimited" : fmtDate(u.planExpiresAt)}
                    />
                    <Field label="Source" value={sourceLabel(u.planSource)} />
                    <Field label="Referral din" value={String(u.referralDaysEarned)} />
                  </dl>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-ink-soft">
            {rows.length} me se {users.length} users dikh rahe hain. (Zyada se zyada 500 latest.)
          </p>
        </>
      )}
    </div>
  );
}

/* ------------------------------- bits -------------------------------- */

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`px-4 py-3 font-semibold ${className}`}>{children}</th>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-ink-soft">{label}</dt>
      <dd className="mt-0.5 font-semibold text-ink">{value}</dd>
    </div>
  );
}

function PlanBadge({ status }: { status: Status }) {
  const cls =
    status.tone === "plus"
      ? "bg-terracotta/12 text-terracotta-dark"
      : status.tone === "expired"
        ? "bg-cream-deep text-ink-soft line-through"
        : "bg-cream-deep/60 text-ink-soft";
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${cls}`}
    >
      {status.tone === "plus" && <Crown size={12} />}
      {status.label}
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
