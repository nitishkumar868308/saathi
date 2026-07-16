"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Users as UsersIcon,
  Search,
  Download,
  Loader2,
  AlertTriangle,
  Crown,
  Infinity as InfinityIcon,
  ChevronDown,
  Check,
  Clock,
  FileText,
} from "lucide-react";

type AdminUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  plan: "free" | "plus";
  planExpiresAt: string | null;
  planSource: string | null;
  referralDaysEarned: number;
  referralCode: string | null;
  createdAt: string;
};

type UserReferral = {
  id: string;
  email: string | null;
  name: string | null;
  joined_at: string;
  qualified_at: string | null;
  rewarded_at: string | null;
  days: number;
};

type UserDetail = {
  id: string;
  email: string | null;
  full_name: string | null;
  joined_at: string;
  plan: "free" | "plus";
  plan_expires_at: string | null;
  plan_source: string | null;
  referral_code: string | null;
  referral_days_earned: number;
  referred_by: { email: string | null; code: string | null } | null;
  referrals: UserReferral[];
  documents: UserDocument[];
  documents_count: number;
  storage_bytes: number;
};

type UserDocument = {
  id: string;
  name: string;
  type: string;
  expiry: string | null;
  file_size: number | null;
  in_storage: boolean;
  created_at: string;
};

/* ------------------------------ helpers ------------------------------ */

function fmtBytes(n: number | null): string {
  if (!n || n <= 0) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Plus + plan_expires_at === null  => lifetime / chalti hui subscription.
 * Plus + future date              => tab tak active.
 * Plus + past date                => expire ho chuka (DB abhi bhi 'plus' keh sakta hai).
 */
type Status = { label: string; tone: "plus" | "free" | "expired"; lifetime: boolean };

function statusOf(u: { plan: string; planExpiresAt: string | null }): Status {
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

const sourceLabel = (s: string | null) => (s ? (SOURCE_LABEL[s] ?? s) : "—");

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
  const [openId, setOpenId] = useState<string | null>(null);

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

  const toggle = (id: string) => setOpenId((cur) => (cur === id ? null : id));

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

      <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
        <Stat label="Total users" value={stats.total} />
        <Stat label="Plus (active)" value={stats.plus} />
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
                  <Th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const st = statusOf(u);
                  const open = openId === u.id;
                  return (
                    <Fragment key={u.id}>
                      <tr
                        onClick={() => toggle(u.id)}
                        className={`cursor-pointer border-b border-line/60 transition hover:bg-cream-deep/20 ${
                          open ? "bg-cream-deep/25" : ""
                        }`}
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
                        <td className="px-3 py-3.5 text-ink-soft">
                          <ChevronDown
                            size={16}
                            className={`transition-transform ${open ? "rotate-180" : ""}`}
                          />
                        </td>
                      </tr>
                      {open && (
                        <tr className="border-b border-line/60">
                          <td colSpan={7} className="bg-cream-deep/10 px-4 py-5">
                            <Detail id={u.id} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-3 lg:hidden">
            {rows.map((u) => {
              const st = statusOf(u);
              const open = openId === u.id;
              return (
                <div key={u.id} className="rounded-3xl border border-line bg-surface shadow-soft">
                  <button
                    onClick={() => toggle(u.id)}
                    className="w-full p-4 text-left"
                    aria-expanded={open}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-ink">{u.fullName || "—"}</p>
                        <p className="truncate text-xs text-ink-soft">{u.email ?? "—"}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <PlanBadge status={st} />
                        <ChevronDown
                          size={16}
                          className={`text-ink-soft transition-transform ${open ? "rotate-180" : ""}`}
                        />
                      </div>
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
                  </button>
                  {open && (
                    <div className="border-t border-line bg-cream-deep/10 p-4">
                      <Detail id={u.id} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <p className="text-xs text-ink-soft">
            {users.length} me se {rows.length} users dikh rahe hain. (Zyada se zyada 500 latest.)
            Row pe click karo — poora referral history khulega.
          </p>
        </>
      )}
    </div>
  );
}

/* ---------------------------- Detail panel ---------------------------- */

/** Lazy — sirf expand karne pe fetch hota hai, list me har user ke liye nahi. */
function Detail({ id }: { id: string }) {
  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/admin/users/${id}`, { cache: "no-store" });
        const body = (await res.json()) as { detail?: UserDetail; error?: string };
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        if (alive) setDetail(body.detail ?? null);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Detail load nahi hui");
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  if (error) return <p className="text-sm text-terracotta-dark">{error}</p>;
  if (!detail) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="animate-spin text-terracotta" size={20} />
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Left: facts */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-ink-soft">Details</h4>
        <DetailRow label="Referral code" value={detail.referral_code ?? "—"} mono />
        <DetailRow
          label="Kis code se aaya"
          value={
            detail.referred_by
              ? `${detail.referred_by.code ?? "—"} (${detail.referred_by.email ?? "—"})`
              : "Kisi ne refer nahi kiya"
          }
        />
        <DetailRow
          label="Referral se kamaaye"
          value={`${detail.referral_days_earned} din`}
        />
        <DetailRow
          label="Plan khatam"
          value={
            detail.plan === "plus" && !detail.plan_expires_at
              ? "Unlimited"
              : fmtDate(detail.plan_expires_at)
          }
        />
      </div>

      {/* Right: kisko refer kiya */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-ink-soft">
          Kisko refer kiya ({detail.referrals.length})
        </h4>
        {detail.referrals.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-line bg-surface px-4 py-5 text-center text-sm text-ink-soft">
            Abhi kisi ne iske code se join nahi kiya.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {detail.referrals.map((r) => (
              <ReferralItem key={r.id} r={r} />
            ))}
          </ul>
        )}

        {/* Documents — kya upload kiya, kab, size */}
        <h4 className="mt-5 text-xs font-bold uppercase tracking-wider text-ink-soft">
          Documents ({detail.documents_count}) · {fmtBytes(detail.storage_bytes)}
        </h4>
        {detail.documents.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-line bg-surface px-4 py-5 text-center text-sm text-ink-soft">
            Koi document nahi.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {detail.documents.map((d) => (
              <li
                key={d.id}
                className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cream-deep text-ink-soft">
                  <FileText size={14} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink">{d.name}</p>
                  <p className="truncate text-xs text-ink-soft">
                    {fmtDate(d.created_at)}
                    {d.expiry ? ` · exp ${fmtDate(d.expiry)}` : ""}
                    {d.in_storage ? "" : " · sirf device pe"}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-semibold text-ink-soft">
                  {fmtBytes(d.file_size)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ReferralItem({ r }: { r: UserReferral }) {
  const done = Boolean(r.rewarded_at);

  const Icon = done ? Check : Clock;
  const iconCls = done ? "bg-sage text-white" : "bg-cream-deep text-ink-soft";

  const note = done
    ? `${fmtDate(r.rewarded_at)} · +${r.days} din`
    : `Joined ${fmtDate(r.joined_at)} · document + chat pending`;

  return (
    <li className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-2.5">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${iconCls}`}
      >
        <Icon size={14} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink">
          {r.name?.trim() || r.email || "—"}
        </p>
        <p className="truncate text-xs text-ink-soft">{note}</p>
      </div>
      {done && (
        <span className="shrink-0 text-sm font-bold text-sage">+{r.days}</span>
      )}
    </li>
  );
}

function DetailRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="shrink-0 text-ink-soft">{label}</span>
      <span
        className={`min-w-0 truncate text-right font-semibold text-ink ${mono ? "tracking-wider" : ""}`}
      >
        {value}
      </span>
    </div>
  );
}

/* ------------------------------- bits -------------------------------- */

function Th({ children, className = "" }: { children?: React.ReactNode; className?: string }) {
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
