"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Mail,
  Smartphone,
  Eye,
  MousePointerClick,
  EyeOff,
  Globe,
  RefreshCw,
  Search,
  X,
  AlertTriangle,
} from "lucide-react";

import Loader from "@/components/Loader";
import Pagination, { usePagination } from "@/components/admin/Pagination";
import { useAdminT, atpl } from "@/lib/i18n/admin";

/**
 * "Message users" ka doosra tab — bhejne ke BAAD ka poora hisaab.
 *
 * ⚠️ Pehle bhejne ke baad kuch bacha hi nahi rehta tha: API ek ginti lauta deti
 * thi ("42 bheja") aur screen band hote hi wo bhi gayab. Do sawaal jo admin roz
 * poochta hai, unka jawab kahin se nahi milta tha:
 *
 *   • "Isko pichhle mahine kitni baar message gaya?"
 *   • "Kisne khola, kisne click kiya, kaun ignore kar gaya, aur kaun email se
 *      app par gaya aur kaun website par?"
 *
 * Ab dono ka jawab yahan hai. Data `/api/admin/notify/report` se aata hai.
 */

type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  last: string;
  emailSent: number;
  emailFailed: number;
  pushSent: number;
  pushFailed: number;
  opened: number;
  clicked: number;
  openCount: number;
  clickCount: number;
  toApp: number;
  toWeb: number;
};

type BatchRow = {
  id: string;
  subject: string;
  channel: string;
  audience: string;
  total: number;
  createdAt: string;
  emailSent: number;
  pushSent: number;
  opened: number;
  clicked: number;
  toApp: number;
  toWeb: number;
};

type SendDetail = {
  id: string;
  subject: string | null;
  channel: string;
  status: string;
  error: string | null;
  devices: number;
  opened_at: string | null;
  clicked_at: string | null;
  open_count: number;
  click_count: number;
  last_target: string | null;
  created_at: string;
};

type EventDetail = {
  send_id: string;
  type: string;
  target: string | null;
  url: string | null;
  created_at: string;
};

type Report = {
  users: UserRow[];
  batches: BatchRow[];
  truncated: boolean;
  needsMigration?: boolean;
  error?: string;
  detail?: { sends: SendDetail[]; events: EventDetail[] } | null;
};

type Filter = "all" | "opened" | "ignored";

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function AdminMessageReport() {
  const t = useAdminT();
  const r = t.report;

  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/notify/report", { cache: "no-store" });
      const body = (await res.json()) as Report;
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setData(body);
    } catch {
      setError(r.failed);
    } finally {
      setBusy(false);
    }
  }, [r.failed]);

  useEffect(() => {
    void load();
  }, [load]);

  /* ------------------------------ totals ------------------------------ */

  const totals = useMemo(() => {
    const u = data?.users ?? [];
    const sum = (pick: (x: UserRow) => number) => u.reduce((a, x) => a + pick(x), 0);
    const emailSent = sum((x) => x.emailSent);
    const pushSent = sum((x) => x.pushSent);
    const opened = sum((x) => x.opened);
    return {
      emailSent,
      pushSent,
      opened,
      clicked: sum((x) => x.clicked),
      toApp: sum((x) => x.toApp),
      toWeb: sum((x) => x.toWeb),
      // "Ignore" = gaya to sahi, par kabhi khola hi nahi. Isi ek aankde par
      // agla broadcast tay hota hai, isliye ise alag card mila hai.
      ignored: Math.max(0, emailSent + pushSent - opened),
    };
  }, [data]);

  /* ------------------------------ filter ------------------------------ */

  const filtered = useMemo(() => {
    const list = data?.users ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((u) => {
      if (filter === "opened" && u.opened === 0) return false;
      if (filter === "ignored" && u.opened > 0) return false;
      if (!q) return true;
      return (
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [data, query, filter]);

  const pg = usePagination(filtered, 12, `${query}|${filter}`);

  /* ---------------------------- drill-down ---------------------------- */

  const [openUser, setOpenUser] = useState<UserRow | null>(null);

  if (!data && busy) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <Loader size={44} />
        <p className="text-sm text-ink-soft">{r.loading}</p>
      </div>
    );
  }

  if (data?.needsMigration) {
    return (
      <div className="mx-auto flex max-w-2xl items-start gap-3 rounded-2xl border border-amber-warm/50 bg-amber-warm/10 p-5 text-sm text-ink">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-terracotta-dark" />
        <span>{r.needsMigration}</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 rounded-2xl border border-terracotta/40 bg-terracotta/10 p-5 text-sm text-terracotta-dark">
        <span>{error}</span>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-terracotta/40 bg-surface px-3 py-2 text-xs font-bold text-terracotta"
        >
          <RefreshCw size={13} /> {r.refresh}
        </button>
      </div>
    );
  }

  const users = data?.users ?? [];

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card icon={<Mail size={16} />} label={r.cardEmail} value={totals.emailSent} />
        <Card icon={<Smartphone size={16} />} label={r.cardPush} value={totals.pushSent} />
        <Card icon={<Eye size={16} />} label={r.cardOpened} value={totals.opened} tone="good" />
        <Card
          icon={<MousePointerClick size={16} />}
          label={r.cardClicked}
          value={totals.clicked}
          tone="good"
        />
        <Card icon={<Smartphone size={16} />} label={r.cardApp} value={totals.toApp} tone="good" />
        <Card icon={<Globe size={16} />} label={r.cardWeb} value={totals.toWeb} tone="good" />
        <Card icon={<EyeOff size={16} />} label={r.cardIgnored} value={totals.ignored} tone="warn" />
        <div className="flex items-center justify-center rounded-2xl border border-line bg-surface p-4">
          <button
            type="button"
            onClick={() => void load()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-cream px-4 py-2.5 text-sm font-bold text-ink transition hover:border-terracotta/40 disabled:opacity-50"
          >
            <RefreshCw size={14} className={busy ? "animate-spin" : ""} /> {r.refresh}
          </button>
        </div>
      </div>

      {/* Pixel/open ki seema saaf likhi hai — warna ye aankde sach se zyada
          bharosemand lagne lagte hain, aur uske upar galat faisle hote hain. */}
      <p className="rounded-2xl border border-line bg-cream/40 px-4 py-3 text-xs leading-relaxed text-ink-soft">
        {r.accuracyNote}
      </p>

      {data?.truncated && (
        <p className="rounded-2xl border border-amber-warm/50 bg-amber-warm/10 px-4 py-3 text-xs font-semibold text-terracotta-dark">
          {atpl(r.truncated, { n: 5000 })}
        </p>
      )}

      {/* ----------------------------- users ----------------------------- */}

      <div className="rounded-3xl border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-bold text-ink">{r.usersTitle}</p>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[190px]">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={r.searchPh}
                className="w-full rounded-xl border border-line bg-cream/40 py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-terracotta"
              />
            </div>
            {(["all", "opened", "ignored"] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  filter === f
                    ? "border-terracotta bg-terracotta/8 text-terracotta"
                    : "border-line bg-surface text-ink-soft hover:border-terracotta/40"
                }`}
              >
                {f === "all" ? r.onlySent : f === "opened" ? r.onlyOpened : r.onlyIgnored}
              </button>
            ))}
          </div>
        </div>

        {users.length === 0 ? (
          <p className="mt-5 rounded-2xl border border-line bg-cream/40 px-4 py-8 text-center text-sm text-ink-soft">
            {r.empty}
          </p>
        ) : (
          <>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="text-xs uppercase tracking-wider text-ink-soft">
                    <Th>{r.colUser}</Th>
                    <Th>{r.colEmail}</Th>
                    <Th>{r.colPush}</Th>
                    <Th>{r.colOpened}</Th>
                    <Th>{r.colClicked}</Th>
                    <Th>{r.colWhere}</Th>
                    <Th>{r.colLast}</Th>
                  </tr>
                </thead>
                <tbody>
                  {pg.pageItems.map((u) => {
                    const sentAny = u.emailSent + u.pushSent;
                    const ignored = sentAny > 0 && u.opened === 0;
                    return (
                      <tr
                        key={u.id || u.email || u.last}
                        onClick={() => setOpenUser(u)}
                        className="cursor-pointer border-t border-line transition hover:bg-cream/50"
                      >
                        <Td>
                          <span className="block font-semibold text-ink">
                            {u.name || u.email || "—"}
                          </span>
                          {!!u.name && (
                            <span className="block text-xs text-ink-soft">{u.email}</span>
                          )}
                        </Td>
                        <Td>
                          <Count n={u.emailSent} fail={u.emailFailed} t={r.timesN} />
                        </Td>
                        <Td>
                          <Count n={u.pushSent} fail={u.pushFailed} t={r.timesN} />
                        </Td>
                        <Td>
                          {u.openCount > 0 ? (
                            <span className="font-bold text-sage">
                              {atpl(r.timesN, { n: u.openCount })}
                            </span>
                          ) : ignored ? (
                            <span className="rounded-full bg-amber-warm/20 px-2 py-0.5 text-[11px] font-bold text-terracotta-dark">
                              {r.ignored}
                            </span>
                          ) : (
                            <span className="text-ink-soft">{r.never}</span>
                          )}
                        </Td>
                        <Td>
                          {u.clickCount > 0 ? (
                            <span className="font-bold text-terracotta">
                              {atpl(r.timesN, { n: u.clickCount })}
                            </span>
                          ) : (
                            <span className="text-ink-soft">{r.never}</span>
                          )}
                        </Td>
                        <Td>
                          <span className="flex flex-wrap gap-1">
                            {u.toApp > 0 && <Pill tone="good">{`${r.app} ${u.toApp}`}</Pill>}
                            {u.toWeb > 0 && <Pill>{`${r.web} ${u.toWeb}`}</Pill>}
                            {u.toApp === 0 && u.toWeb === 0 && (
                              <span className="text-ink-soft">{r.never}</span>
                            )}
                          </span>
                        </Td>
                        <Td>
                          <span className="whitespace-nowrap text-xs text-ink-soft">
                            {fmt(u.last)}
                          </span>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-3">
              <Pagination
                page={pg.page}
                pageCount={pg.pageCount}
                total={pg.total}
                from={pg.from}
                to={pg.to}
                onPage={pg.setPage}
                label={r.allUsers}
              />
            </div>
          </>
        )}
      </div>

      {/* ---------------------------- batches ---------------------------- */}

      {(data?.batches?.length ?? 0) > 0 && (
        <div className="rounded-3xl border border-line bg-surface p-4 sm:p-5">
          <p className="text-sm font-bold text-ink">{r.batchesTitle}</p>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-ink-soft">
                  <Th>{r.colSubject}</Th>
                  <Th>{r.colWhen}</Th>
                  <Th>{r.colAudience}</Th>
                  <Th>{r.colReach}</Th>
                </tr>
              </thead>
              <tbody>
                {data!.batches.map((b) => {
                  const sent = b.emailSent + b.pushSent;
                  return (
                    <tr key={b.id} className="border-t border-line">
                      <Td>
                        <span className="block font-semibold text-ink">{b.subject}</span>
                        <span className="block text-xs text-ink-soft">
                          {b.channel === "push"
                            ? r.chPush
                            : b.channel === "both"
                              ? `${r.chEmail} + ${r.chPush}`
                              : r.chEmail}
                        </span>
                      </Td>
                      <Td>
                        <span className="whitespace-nowrap text-xs text-ink-soft">
                          {fmt(b.createdAt)}
                        </span>
                      </Td>
                      <Td>
                        <span className="text-xs text-ink-soft">{b.audience}</span>
                      </Td>
                      <Td>
                        <span className="block text-xs font-semibold text-ink">
                          {atpl(r.openedOfSent, { opened: b.opened, sent })}
                        </span>
                        <span className="mt-1 flex flex-wrap gap-1">
                          {b.toApp > 0 && <Pill tone="good">{`${r.app} ${b.toApp}`}</Pill>}
                          {b.toWeb > 0 && <Pill>{`${r.web} ${b.toWeb}`}</Pill>}
                        </span>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {openUser && <UserDetail user={openUser} onClose={() => setOpenUser(null)} />}
    </div>
  );
}

/* ------------------------------ drill-down ------------------------------ */

/**
 * Ek bande ka poora hisaab — har message alag se, aur uske neeche uska timeline.
 *
 * Alag request isliye jaati hai ki events bahut hote hain: har user ke saare
 * events pehli hi list me bhejne par report screen bhaari ho jaati.
 */
function UserDetail({ user, onClose }: { user: UserRow; onClose: () => void }) {
  const t = useAdminT();
  const r = t.report;
  const [detail, setDetail] = useState<Report["detail"]>(undefined);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch(
          `/api/admin/notify/report?userId=${encodeURIComponent(user.id)}`,
          { cache: "no-store" },
        );
        const body = (await res.json()) as Report;
        if (alive) setDetail(body.detail ?? { sends: [], events: [] });
      } catch {
        if (alive) setDetail({ sends: [], events: [] });
      }
    })();
    return () => {
      alive = false;
    };
  }, [user.id]);

  const eventsBySend = useMemo(() => {
    const m = new Map<string, EventDetail[]>();
    (detail?.events ?? []).forEach((e) => {
      const list = m.get(e.send_id) ?? [];
      list.push(e);
      m.set(e.send_id, list);
    });
    return m;
  }, [detail]);

  const evLabel = (type: string) =>
    type === "click" ? r.evClick : type === "push_open" ? r.evPushOpen : r.evOpen;

  const stLabel = (s: string) =>
    s === "sent" ? r.stSent : s === "failed" ? r.stFailed : r.stSkipped;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4 sm:p-8"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl border border-line bg-surface p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
              {r.detailTitle}
            </p>
            <p className="mt-1 text-lg font-bold text-ink">{user.name || user.email}</p>
            {!!user.name && <p className="text-sm text-ink-soft">{user.email}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={r.close}
            className="rounded-xl border border-line bg-cream p-2 text-ink-soft transition hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>

        {detail === undefined ? (
          <div className="flex justify-center py-10">
            <Loader size={36} />
          </div>
        ) : !detail || detail.sends.length === 0 ? (
          <p className="mt-5 rounded-2xl border border-line bg-cream/40 px-4 py-6 text-center text-sm text-ink-soft">
            {r.detailEmpty}
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {detail.sends.map((s) => {
              const evs = eventsBySend.get(s.id) ?? [];
              return (
                <li key={s.id} className="rounded-2xl border border-line bg-cream/30 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-ink">{s.subject ?? "—"}</span>
                    <Pill>{s.channel === "push" ? r.chPush : r.chEmail}</Pill>
                    <Pill tone={s.status === "sent" ? "good" : "warn"}>{stLabel(s.status)}</Pill>
                    <span className="ml-auto text-xs text-ink-soft">{fmt(s.created_at)}</span>
                  </div>
                  {/* "Nahi gaya" ka karan sabse kaam ki line hai — yahi wo jawab
                      hai jo pehle kahin nahi milta tha. */}
                  {!!s.error && (
                    <p className="mt-2 text-xs font-semibold text-terracotta-dark">{s.error}</p>
                  )}
                  {evs.length === 0 ? (
                    <p className="mt-2 text-xs text-ink-soft">
                      {s.status === "sent" ? r.ignored : r.never}
                    </p>
                  ) : (
                    <ul className="mt-3 space-y-1.5 border-l-2 border-terracotta/25 pl-3">
                      {evs.map((e, i) => (
                        <li key={i} className="text-xs text-ink">
                          <span className="font-semibold">{evLabel(e.type)}</span>
                          {!!e.target && (
                            <span className="ml-1.5 text-ink-soft">
                              · {e.target === "app" ? r.app : r.web}
                            </span>
                          )}
                          <span className="ml-1.5 text-ink-soft">· {fmt(e.created_at)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* -------------------------------- bits -------------------------------- */

function Card({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "good" | "warn";
}) {
  const color =
    tone === "good" ? "text-sage" : tone === "warn" ? "text-terracotta-dark" : "text-ink";
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center gap-2 text-ink-soft">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`mt-2 text-2xl font-extrabold ${color}`}>{value}</p>
    </div>
  );
}

function Count({ n, fail, t }: { n: number; fail: number; t: string }) {
  if (n === 0 && fail === 0) return <span className="text-ink-soft">—</span>;
  return (
    <span className="whitespace-nowrap">
      <span className="font-bold text-ink">{atpl(t, { n })}</span>
      {fail > 0 && (
        <span className="ml-1.5 text-xs font-semibold text-terracotta-dark">+{fail}✕</span>
      )}
    </span>
  );
}

function Pill({ children, tone }: { children: React.ReactNode; tone?: "good" | "warn" }) {
  const cls =
    tone === "good"
      ? "bg-sage/15 text-sage"
      : tone === "warn"
        ? "bg-amber-warm/20 text-terracotta-dark"
        : "bg-cream-deep text-ink-soft";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${cls}`}>{children}</span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="whitespace-nowrap px-3 pb-2 font-bold">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-3 py-3 align-top">{children}</td>;
}
