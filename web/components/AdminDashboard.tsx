"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Heart,
  Lock,
  LogOut,
  Users,
  MessageSquare,
  Search,
  Download,
  RefreshCw,
  Loader2,
  Mail,
  TrendingUp,
  Inbox,
} from "lucide-react";

type WaitlistEntry = { email: string; createdAt: string };
type ContactEntry = {
  name: string;
  email: string;
  message: string;
  createdAt: string;
};
type Data = {
  waitlist: WaitlistEntry[];
  contacts: ContactEntry[];
  stats: { waitlist: number; contacts: number };
};

type Tab = "waitlist" | "contacts";

function fmt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function timeAgo(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return "abhi";
    if (m < 60) return `${m}m pehle`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h pehle`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}d pehle`;
    return fmt(iso);
  } catch {
    return "";
  }
}

function isToday(iso: string): boolean {
  try {
    const d = new Date(iso);
    const n = new Date();
    return (
      d.getDate() === n.getDate() &&
      d.getMonth() === n.getMonth() &&
      d.getFullYear() === n.getFullYear()
    );
  } catch {
    return false;
  }
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

export default function AdminDashboard() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/data", { cache: "no-store" });
      if (res.status === 401) {
        setAuthed(false);
        return;
      }
      const d = (await res.json()) as Data;
      setData(d);
      setAuthed(true);
    } catch {
      setAuthed(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthed(false);
    setData(null);
  }

  if (authed === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <Loader2 className="animate-spin text-terracotta" size={28} />
      </div>
    );
  }

  if (!authed) return <LoginGate onSuccess={load} />;

  return (
    <Dashboard data={data} loading={loading} onRefresh={load} onLogout={logout} />
  );
}

/* ------------------------------- Login ------------------------------- */

function LoginGate({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "loading">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Galat password 🙈");
        setStatus("idle");
        return;
      }
      onSuccess();
    } catch {
      setError("Kuch gadbad ho gayi.");
      setStatus("idle");
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream px-5">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-amber-warm/20 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-terracotta/15 blur-3xl" />
      </div>
      <form
        onSubmit={submit}
        className="relative w-full max-w-sm rounded-3xl border border-line bg-surface p-8 shadow-warm"
      >
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-terracotta text-white shadow-warm">
          <Lock size={22} />
        </span>
        <h1 className="mt-5 font-display text-2xl font-semibold">
          Admin dashboard
        </h1>
        <p className="mt-1 text-sm text-ink-soft">
          Password daalo dashboard dekhne ke liye.
        </p>
        <input
          type="password"
          autoFocus
          placeholder="Admin password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-5 h-12 w-full rounded-2xl border border-line bg-cream px-4 text-base outline-none transition focus:border-terracotta focus:ring-4 focus:ring-terracotta/15"
        />
        {error && (
          <p className="mt-2 text-sm font-medium text-terracotta-dark">{error}</p>
        )}
        <button
          type="submit"
          disabled={status === "loading"}
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-terracotta px-6 text-base font-semibold text-white shadow-warm transition hover:bg-terracotta-dark disabled:opacity-70"
        >
          {status === "loading" ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            "Login"
          )}
        </button>
      </form>
    </div>
  );
}

/* ----------------------------- Dashboard ----------------------------- */

function Dashboard({
  data,
  loading,
  onRefresh,
  onLogout,
}: {
  data: Data | null;
  loading: boolean;
  onRefresh: () => void;
  onLogout: () => void;
}) {
  const [tab, setTab] = useState<Tab>("waitlist");
  const [query, setQuery] = useState("");

  const waitlist = data?.waitlist ?? [];
  const contacts = data?.contacts ?? [];

  const todayCount = useMemo(
    () =>
      waitlist.filter((w) => isToday(w.createdAt)).length +
      contacts.filter((c) => isToday(c.createdAt)).length,
    [waitlist, contacts],
  );

  const filteredWaitlist = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return waitlist;
    return waitlist.filter((w) => w.email.toLowerCase().includes(q));
  }, [waitlist, query]);

  const filteredContacts = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        c.message.toLowerCase().includes(q),
    );
  }, [contacts, query]);

  function exportCsv() {
    if (tab === "waitlist") {
      download(
        "saathi-waitlist.csv",
        toCsv([
          ["Email", "Joined at"],
          ...filteredWaitlist.map((w) => [w.email, fmt(w.createdAt)]),
        ]),
      );
    } else {
      download(
        "saathi-contacts.csv",
        toCsv([
          ["Name", "Email", "Message", "Sent at"],
          ...filteredContacts.map((c) => [
            c.name,
            c.email,
            c.message,
            fmt(c.createdAt),
          ]),
        ]),
      );
    }
  }

  return (
    <div className="min-h-screen bg-cream">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-line bg-cream/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-8 sm:py-3.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-terracotta text-white shadow-warm">
              <Heart size={16} className="fill-white" strokeWidth={2.4} />
            </span>
            <span className="truncate font-display text-lg font-semibold">
              Saathi Admin
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              onClick={onRefresh}
              className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-3 text-sm font-semibold text-ink-soft transition hover:text-terracotta sm:px-4"
            >
              <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
            <button
              onClick={onLogout}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-ink px-3 text-sm font-semibold text-cream transition hover:bg-ink/90 sm:px-4"
            >
              <LogOut size={15} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-7 sm:px-8 sm:py-10">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          <StatCard
            icon={<Users size={20} />}
            label="Waitlist signups"
            value={waitlist.length}
            accent="from-terracotta/15 to-terracotta/5 text-terracotta"
          />
          <StatCard
            icon={<MessageSquare size={20} />}
            label="Contact messages"
            value={contacts.length}
            accent="from-sage/20 to-sage/5 text-sage"
          />
          <StatCard
            icon={<TrendingUp size={20} />}
            label="Aaj naye"
            value={todayCount}
            accent="from-amber-warm/25 to-amber-warm/5 text-amber-warm"
            className="col-span-2 lg:col-span-1"
          />
        </div>

        {/* Controls */}
        <div className="mt-7 flex flex-col gap-3 sm:mt-9 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex rounded-2xl border border-line bg-surface p-1">
            <TabButton active={tab === "waitlist"} onClick={() => setTab("waitlist")}>
              Waitlist · {waitlist.length}
            </TabButton>
            <TabButton active={tab === "contacts"} onClick={() => setTab("contacts")}>
              Contacts · {contacts.length}
            </TabButton>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search..."
                className="h-11 w-full rounded-2xl border border-line bg-surface pl-10 pr-4 text-sm outline-none transition focus:border-terracotta focus:ring-4 focus:ring-terracotta/15"
              />
            </div>
            <button
              onClick={exportCsv}
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-2xl border border-line bg-surface px-4 text-sm font-semibold text-ink-soft transition hover:text-terracotta"
            >
              <Download size={16} />
              <span className="hidden sm:inline">CSV</span>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="mt-5">
          {tab === "waitlist" ? (
            <WaitlistView rows={filteredWaitlist} />
          ) : (
            <ContactsView rows={filteredContacts} />
          )}
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  accent: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-3xl border border-line bg-gradient-to-br ${accent} p-5 shadow-soft sm:p-6 ${className}`}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-surface/80 shadow-soft">
        {icon}
      </span>
      <p className="mt-4 font-display text-3xl font-semibold text-ink sm:text-4xl">
        {value.toLocaleString("en-IN")}
      </p>
      <p className="mt-1 text-sm font-medium text-ink-soft">{label}</p>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl px-3.5 py-2 text-sm font-semibold transition sm:px-4 ${
        active
          ? "bg-terracotta text-white shadow-warm"
          : "text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}

/* ------------------------------ Waitlist ----------------------------- */

function WaitlistView({ rows }: { rows: WaitlistEntry[] }) {
  if (!rows.length) return <Empty label="Abhi koi signup nahi." />;
  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-surface shadow-soft">
      {/* Desktop table */}
      <table className="hidden w-full text-left text-sm md:table">
        <thead>
          <tr className="border-b border-line text-xs font-bold uppercase tracking-wide text-ink-soft">
            <th className="px-5 py-3.5">#</th>
            <th className="px-5 py-3.5">Email</th>
            <th className="px-5 py-3.5">Joined</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.email + i} className="border-b border-line/60 last:border-0">
              <td className="px-5 py-3.5 text-ink-soft">{i + 1}</td>
              <td className="px-5 py-3.5 font-medium text-ink">
                <span className="inline-flex items-center gap-2">
                  <Mail size={14} className="text-terracotta" />
                  {r.email}
                </span>
              </td>
              <td className="whitespace-nowrap px-5 py-3.5 text-ink-soft">
                {fmt(r.createdAt)} · {timeAgo(r.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <div className="divide-y divide-line md:hidden">
        {rows.map((r, i) => (
          <div key={r.email + i} className="flex items-center gap-3 px-4 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta">
              <Mail size={15} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink">
                {r.email}
              </p>
              <p className="text-xs text-ink-soft">{timeAgo(r.createdAt)}</p>
            </div>
            <span className="shrink-0 text-xs font-semibold text-ink-soft">
              #{i + 1}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------ Contacts ----------------------------- */

function ContactsView({ rows }: { rows: ContactEntry[] }) {
  if (!rows.length) return <Empty label="Abhi koi message nahi." />;
  return (
    <div className="space-y-3">
      {rows.map((r, i) => (
        <div
          key={r.email + i}
          className="rounded-3xl border border-line bg-surface p-5 shadow-soft transition hover:shadow-warm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: ["#C25A37", "#7C8A6B", "#E0A458"][i % 3] }}
              >
                {r.name.charAt(0).toUpperCase()}
              </span>
              <div>
                <p className="font-semibold text-ink">{r.name}</p>
                <a
                  href={`mailto:${r.email}`}
                  className="text-sm text-ink-soft transition hover:text-terracotta"
                >
                  {r.email}
                </a>
              </div>
            </div>
            <span className="text-xs font-medium text-ink-soft">
              {timeAgo(r.createdAt)}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-wrap rounded-2xl bg-cream-deep/30 p-4 text-sm leading-relaxed text-ink">
            {r.message}
          </p>
          <div className="mt-3 flex justify-end">
            <a
              href={`mailto:${r.email}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta hover:underline"
            >
              <Mail size={14} />
              Reply
            </a>
          </div>
        </div>
      ))}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-line bg-surface py-16 text-center shadow-soft">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-deep/50 text-ink-soft">
        <Inbox size={24} />
      </span>
      <p className="text-sm text-ink-soft">{label}</p>
    </div>
  );
}
