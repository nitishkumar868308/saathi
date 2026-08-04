"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Lock,
  LogOut,
  MessageSquare,
  Search,
  Download,
  RefreshCw,
  Mail,
  Inbox,
  Gift,
  Menu,
  X,
  Users,
  Star,
  Activity,
  Globe,
  Bug,
  FileText,
  NotebookPen,
  Megaphone,
  LineChart,
  PenLine,
  Wallet,
  LifeBuoy,
  RotateCw,
  UserMinus,
} from "lucide-react";
import SaathiLogo from "@/components/SaathiLogo";
import Loader from "@/components/Loader";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useAdminT, atpl, type AdminDict } from "@/lib/i18n/admin";
import Pagination, { usePagination } from "@/components/admin/Pagination";
import AdminRewards from "@/components/AdminRewards";
import AdminUsers from "@/components/AdminUsers";
import AdminReviews from "@/components/AdminReviews";
import AdminUsage from "@/components/AdminUsage";
import AdminSpend from "@/components/AdminSpend";
import AdminBroadcast from "@/components/AdminBroadcast";
import AdminDocuments from "@/components/AdminDocuments";
import AdminNotes from "@/components/AdminNotes";
import AdminPricing from "@/components/AdminPricing";
import AdminLogs from "@/components/AdminLogs";
import AdminAnalytics from "@/components/AdminAnalytics";
import AdminSeo from "@/components/AdminSeo";
import AdminBlog from "@/components/AdminBlog";
import AdminRenewals from "@/components/AdminRenewals";
import AdminDeleteRequests from "@/components/AdminDeleteRequests";
import AdminSupport from "@/components/AdminSupport";

type ContactEntry = {
  name: string;
  email: string;
  message: string;
  createdAt: string;
};

type Data = { contacts: ContactEntry[] };
type Section =
  | "analytics"
  | "seo"
  | "blog"
  | "rewards"
  | "pricing"
  | "users"
  | "usage"
  | "spend"
  | "notes"
  | "documents"
  | "reviews"
  | "logs"
  | "contacts"
  | "support"
  | "renewals"
  | "deleteRequests"
  | "message";

const NAV: { key: Section; icon: typeof Gift }[] = [
  { key: "users", icon: Users },
  { key: "analytics", icon: LineChart },
  { key: "seo", icon: Search },
  { key: "blog", icon: PenLine },
  { key: "message", icon: Megaphone },
  { key: "support", icon: LifeBuoy },
  { key: "usage", icon: Activity },
  { key: "spend", icon: Wallet },
  // Notes documents ke theek upar — dono "user ka apna rakha hua" hain, aur
  // admin unhe ek saath dekhta hai.
  { key: "notes", icon: NotebookPen },
  { key: "documents", icon: FileText },
  // Renew guides documents ke theek neeche — wo unhi documents ka agla sawaal
  // hai ("expire ho raha hai, ab karun kya?").
  { key: "renewals", icon: RotateCw },
  { key: "reviews", icon: Star },
  { key: "logs", icon: Bug },
  { key: "contacts", icon: MessageSquare },
  // Delete requests contacts ke theek neeche — pehle ye contacts me hi ek
  // prefix ke saath dabi hoti thi, isliye admin ki aankh yahin dhoondhti hai.
  { key: "deleteRequests", icon: UserMinus },
  { key: "pricing", icon: Globe },
  { key: "rewards", icon: Gift },
];

/* ------------------------------ helpers ------------------------------ */

function fmt(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function timeAgo(iso: string, tt: AdminDict["time"]): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60) return tt.now;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}${tt.m}`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}${tt.h}`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}${tt.d}`;
  return fmt(iso);
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

/* ------------------------------- Shell ------------------------------- */

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
      setData((await res.json()) as Data);
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
        <Loader size={44} />
      </div>
    );
  }
  if (!authed) return <LoginGate onSuccess={load} />;

  return <Dashboard data={data} loading={loading} onRefresh={load} onLogout={logout} />;
}

/* ------------------------------- Login ------------------------------- */

function LoginGate({ onSuccess }: { onSuccess: () => void }) {
  const t = useAdminT();
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
        setError(t.login.wrong);
        setStatus("idle");
        return;
      }
      onSuccess();
    } catch {
      setError(t.login.error);
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
        <h1 className="mt-5 font-display text-2xl font-semibold">{t.login.title}</h1>
        <p className="mt-1 text-sm text-ink-soft">{t.login.sub}</p>
        <input
          type="password"
          autoFocus
          placeholder={t.login.placeholder}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-5 h-12 w-full rounded-2xl border border-line bg-cream px-4 text-base outline-none transition focus:border-terracotta focus:ring-4 focus:ring-terracotta/15"
        />
        {error && <p className="mt-2 text-sm font-medium text-terracotta-dark">{error}</p>}
        <button
          type="submit"
          disabled={status === "loading"}
          className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-terracotta px-6 text-base font-semibold text-white shadow-warm transition hover:bg-terracotta-dark disabled:opacity-70"
        >
          {status === "loading" ? <Loader size={22} /> : t.login.button}
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
  const t = useAdminT();
  const [section, setSection] = useState<Section>("users");
  const [navOpen, setNavOpen] = useState(false);
  const [query, setQuery] = useState("");

  const contacts = useMemo(() => data?.contacts ?? [], [data]);

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
    download(
      "apka-saathi-contacts.csv",
      toCsv([
        ["Name", "Email", "Message", "Received at"],
        ...filteredContacts.map((c) => [c.name, c.email, c.message, fmt(c.createdAt)]),
      ]),
    );
  }

  function go(s: Section) {
    setSection(s);
    setNavOpen(false);
  }

  const nav = (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ key, icon: Icon }) => {
        const active = section === key;
        return (
          <button
            key={key}
            onClick={() => go(key)}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition ${
              active
                ? "bg-terracotta text-white shadow-warm"
                : "text-ink-soft hover:bg-cream-deep/50 hover:text-ink"
            }`}
          >
            <Icon size={18} />
            {t.nav[key]}
            {key === "contacts" && contacts.length > 0 && (
              <span
                className={`ml-auto rounded-full px-2 py-0.5 text-xs font-bold ${
                  active ? "bg-white/20" : "bg-cream-deep text-ink-soft"
                }`}
              >
                {contacts.length}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-cream">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-cream/90 px-4 py-3 backdrop-blur-md lg:hidden">
        <button
          onClick={() => setNavOpen(true)}
          aria-label="Menu"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-ink"
        >
          <Menu size={18} />
        </button>
        <span className="font-display text-lg font-semibold">{t.common.admin}</span>
        <div className="flex items-center gap-2">
          <LanguageSwitcher />
          <button
            onClick={onRefresh}
            aria-label={t.common.refresh}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-surface text-ink-soft"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {navOpen && (
        <div className="fixed inset-0 z-40 lg:hidden" onClick={() => setNavOpen(false)}>
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />
          <aside
            onClick={(e) => e.stopPropagation()}
            className="absolute left-0 top-0 flex h-full w-72 flex-col overflow-hidden border-r border-line bg-surface p-5"
          >
            <div className="flex shrink-0 items-center justify-between">
              <Brand />
              <button
                onClick={() => setNavOpen(false)}
                aria-label={t.common.close}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-ink-soft"
              >
                <X size={16} />
              </button>
            </div>
            {/* Desktop jaisa hi — sirf list scroll karti hai (item 2). */}
            <div className="-mr-2 mt-7 min-h-0 flex-1 overflow-y-auto pr-2">{nav}</div>
            <LogoutBtn onLogout={onLogout} className="mt-4 shrink-0" />
          </aside>
        </div>
      )}

      <div className="lg:flex">
        {/* Desktop sidebar.

            ⚠️ Pehle poora `aside` ek hi h-screen box tha aur andar kuch bhi
            scroll nahi karta tha. Bara nav (12 menu) chhote laptop par neeche
            se bahar nikal jaata tha — Rewards/Pricing jaise aakhri items tak
            pahunchne ka koi raasta hi nahi bachta tha (item 2).

            Ab sirf nav wala hissa scroll karta hai: brand upar chipka rehta
            hai, logout neeche chipka rehta hai, aur beech me list apne aap
            scroll ho jaati hai. */}
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-hidden border-r border-line bg-surface p-5 lg:flex">
          <Brand />
          <div className="-mr-2 mt-8 min-h-0 flex-1 overflow-y-auto pr-2">{nav}</div>
          <LogoutBtn onLogout={onLogout} className="mt-4 shrink-0" />
        </aside>

        {/* Content */}
        <main className="min-w-0 flex-1 px-4 py-6 sm:px-8 sm:py-9">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
                  {t.headings[section].title}
                </h1>
                <p className="mt-1 text-sm text-ink-soft">
                  {section === "contacts"
                    ? atpl(t.contacts.countMsg, { n: contacts.length })
                    : t.headings[section].sub}
                </p>
              </div>

              <div className="hidden items-center gap-2 lg:flex">
                <LanguageSwitcher />
                <button
                  onClick={onRefresh}
                  className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink-soft transition hover:text-terracotta"
                >
                  <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
                  {t.common.refresh}
                </button>
              </div>
            </div>

            {section === "contacts" && (
              <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
                  />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t.contacts.searchPh}
                    className="h-11 w-full rounded-2xl border border-line bg-surface pl-10 pr-4 text-sm outline-none transition focus:border-terracotta focus:ring-4 focus:ring-terracotta/15"
                  />
                </div>
                <button
                  onClick={exportCsv}
                  disabled={!filteredContacts.length}
                  className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-4 text-sm font-semibold text-ink-soft transition hover:text-terracotta disabled:opacity-50"
                >
                  <Download size={16} />
                  CSV
                </button>
              </div>
            )}

            <div className="mt-6">
              {section === "rewards" && <AdminRewards />}
              {section === "pricing" && <AdminPricing />}
              {section === "users" && <AdminUsers />}
              {section === "message" && <AdminBroadcast />}
              {section === "support" && <AdminSupport />}
              {section === "usage" && <AdminUsage />}
              {/* "Usage" = kaun user kitna active hai.
                  "AI & WhatsApp" = humara kitna kharcha ho raha hai (item 3). */}
              {section === "spend" && <AdminSpend />}
              {section === "notes" && <AdminNotes />}
              {section === "documents" && <AdminDocuments />}
              {section === "reviews" && <AdminReviews />}
              {section === "logs" && <AdminLogs />}
              {section === "analytics" && <AdminAnalytics />}
              {section === "seo" && <AdminSeo />}
              {section === "blog" && <AdminBlog />}
              {section === "renewals" && <AdminRenewals />}
              {section === "deleteRequests" && <AdminDeleteRequests />}
              {section === "contacts" && <ContactsView rows={filteredContacts} />}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

function Brand() {
  const t = useAdminT();
  return (
    <div className="flex items-center gap-2.5">
      <SaathiLogo size={52} className="rounded-2xl shadow-warm" />
      <p className="text-sm font-semibold text-ink-soft">{t.common.admin}</p>
    </div>
  );
}

function LogoutBtn({ onLogout, className = "" }: { onLogout: () => void; className?: string }) {
  const t = useAdminT();
  return (
    <button
      onClick={onLogout}
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-ink px-4 text-sm font-semibold text-cream transition hover:opacity-90 ${className}`}
    >
      <LogOut size={15} />
      {t.common.logout}
    </button>
  );
}

/* ------------------------------ Contacts ----------------------------- */

function ContactsView({ rows }: { rows: ContactEntry[] }) {
  const t = useAdminT();
  const pager = usePagination(rows, 10, rows);
  if (!rows.length) return <Empty label={t.contacts.empty} />;
  return (
    <div className="space-y-3">
      {pager.pageItems.map((r, i) => (
        <div
          key={r.email + i}
          className="rounded-3xl border border-line bg-surface p-5 shadow-soft transition hover:shadow-warm"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                style={{ backgroundColor: ["#C25A37", "#7C8A6B", "#E0A458"][i % 3] }}
              >
                {r.name.charAt(0).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{r.name}</p>
                <a
                  href={`mailto:${r.email}`}
                  className="block truncate text-sm text-ink-soft transition hover:text-terracotta"
                >
                  {r.email}
                </a>
              </div>
            </div>
            <span className="shrink-0 text-xs font-medium text-ink-soft">
              {timeAgo(r.createdAt, t.time)}
            </span>
          </div>
          <p className="mt-3 whitespace-pre-wrap break-words rounded-2xl bg-cream-deep/30 p-4 text-sm leading-relaxed text-ink">
            {r.message}
          </p>
          <div className="mt-3 flex justify-end">
            <a
              href={`mailto:${r.email}`}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-terracotta hover:underline"
            >
              <Mail size={14} />
              {t.contacts.reply}
            </a>
          </div>
        </div>
      ))}
      <Pagination
        page={pager.page}
        pageCount={pager.pageCount}
        total={pager.total}
        from={pager.from}
        to={pager.to}
        onPage={pager.setPage}
        label="messages"
      />
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
