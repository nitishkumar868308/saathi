"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LifeBuoy,
  Send,
  RefreshCw,
  Search,
  AlertTriangle,
  CheckCircle2,
  Mail,
  Smartphone,
} from "lucide-react";

import Loader from "@/components/Loader";
import Pagination, { usePagination } from "@/components/admin/Pagination";
import { useAdminT, atpl } from "@/lib/i18n/admin";

/**
 * Support tickets — app se aaye sawaal aur unke jawab.
 *
 * Baayen list, daayen us ticket ki poori baatcheet — WhatsApp jaisi, taaki
 * sandarbh kabhi na toote. Pehle ye sab bikhre hue email the: admin ko pichhli
 * baat dhoondhne ke liye inbox me scroll karna padta tha, aur user ke paas to
 * apne sawaal ka koi nishaan hi nahi hota tha.
 *
 * Jawab dete hi user ko email + phone par notification dono chali jaati hain,
 * aur app me wahi baatcheet khul jaati hai.
 */

type Ticket = {
  id: string;
  ticket_no: string;
  user_id: string;
  email: string | null;
  name: string | null;
  subject: string;
  status: string;
  last_message_at: string;
  created_at: string;
};

type Msg = {
  id: number;
  sender: string;
  body: string;
  seen_at: string | null;
  created_at: string;
};

type ListResponse = {
  tickets?: Ticket[];
  last?: Record<string, { body: string; sender: string; at: string }>;
  needsMigration?: boolean;
  error?: string;
};

type Filter = "all" | "open" | "answered" | "closed";

/** Us user ki SMS-OTP ginti — `/api/admin/users/:id/otp-reset` se. */
type OtpStatus = {
  blocked: boolean;
  sent_hour: number;
  sent_day: number;
  per_hour: number;
  per_day: number;
};

/**
 * Ticket ke saath us user ki OTP limit — dekhne aur reset karne ke liye.
 *
 * ⚠️ Ye yahan (ticket ke andar) isliye hai, Users screen me nahi. "Mera number
 * verify nahi ho raha" support ki sabse aam ticket hai, aur uska jawab aksar ek
 * hi hota hai: limit poori ho gayi. Pehle admin ko wo ginti dekhne ke liye
 * Supabase kholna padta tha aur reset ke liye SQL likhni padti thi — yaani
 * aadhi ticketein bina jawab ke padi rehti thi. Ab jawab dene wali jagah par hi
 * pura sandarbh aur ek button hai.
 *
 * Ginti pehle dikhti hai, reset baad me — jaan-boojh ke. Jo user aaj 3 SMS
 * mangwa chuka hai aur jo 15, dono ki ticket bilkul ek jaisi padhti hai; bina
 * ginti dekhe reset dena aksar galti hoti hai.
 */
function OtpLimitPanel({
  userId,
  s,
}: {
  userId: string;
  s: ReturnType<typeof useAdminT>["support"];
}) {
  const [status, setStatus] = useState<OtpStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/otp-reset`, { cache: "no-store" });
      const out = (await res.json()) as { status?: OtpStatus };
      setStatus(out.status ?? null);
    } catch {
      setStatus(null);
    }
  }, [userId]);

  useEffect(() => {
    setNote(null);
    void load();
  }, [load]);

  async function reset() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/otp-reset`, { method: "POST" });
      const out = (await res.json()) as { ok?: boolean; cleared?: number; status?: OtpStatus };
      if (!res.ok || !out.ok) throw new Error("failed");
      setStatus(out.status ?? null);
      setNote(atpl(s.otpResetDone, { n: out.cleared ?? 0 }));
    } catch {
      setNote(s.otpResetFailed);
    } finally {
      setBusy(false);
    }
  }

  if (!status) return null;

  return (
    <div
      className={`mt-3 rounded-2xl border p-3 ${
        status.blocked ? "border-terracotta/50 bg-terracotta/10" : "border-line bg-cream/40"
      }`}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="text-xs font-bold text-ink">{s.otpTitle}</span>
        <span className="text-xs text-ink-soft">
          {atpl(s.otpCount, {
            hour: status.sent_hour,
            perHour: status.per_hour,
            day: status.sent_day,
            perDay: status.per_day,
          })}
        </span>
        <span
          className={`text-xs font-bold ${status.blocked ? "text-terracotta" : "text-sage"}`}
        >
          {status.blocked ? s.otpBlocked : s.otpFine}
        </span>
        <button
          type="button"
          onClick={() => void reset()}
          disabled={busy}
          className="ml-auto inline-flex items-center gap-1.5 rounded-xl border border-terracotta px-3 py-1.5 text-xs font-bold text-terracotta transition hover:bg-terracotta hover:text-white disabled:opacity-50"
        >
          <RefreshCw size={13} className={busy ? "animate-spin" : undefined} />
          {busy ? s.otpResetting : s.otpReset}
        </button>
      </div>
      {!!note && <p className="mt-2 text-xs text-ink-soft">{note}</p>}
    </div>
  );
}

function fmt(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function AdminSupport() {
  const t = useAdminT();
  const s = t.support;

  const [data, setData] = useState<ListResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const [openId, setOpenId] = useState<string | null>(null);
  const [thread, setThread] = useState<{ ticket: Ticket | null; messages: Msg[] } | null>(null);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sentNote, setSentNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/support", { cache: "no-store" });
      const body = (await res.json()) as ListResponse;
      if (!res.ok) throw new Error(body?.error ?? `HTTP ${res.status}`);
      setData(body);
    } catch {
      setError(s.loadFailed);
    } finally {
      setBusy(false);
    }
  }, [s.loadFailed]);

  useEffect(() => {
    void load();
  }, [load]);

  const openThread = useCallback(async (id: string) => {
    setOpenId(id);
    setThread(null);
    setReply("");
    setSentNote(null);
    try {
      const res = await fetch(`/api/admin/support?ticketId=${encodeURIComponent(id)}`, {
        cache: "no-store",
      });
      const body = (await res.json()) as { ticket?: Ticket; messages?: Msg[] };
      setThread({ ticket: body.ticket ?? null, messages: body.messages ?? [] });
    } catch {
      setThread({ ticket: null, messages: [] });
    }
  }, []);

  async function send(status?: "answered" | "closed") {
    const body = reply.trim();
    if (!openId || (!body && !status)) return;
    setSending(true);
    setSentNote(null);
    try {
      const res = await fetch("/api/admin/support", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ticketId: openId, message: body, status }),
      });
      const out = (await res.json()) as {
        ok?: boolean;
        error?: string;
        notify?: { email: boolean; push: number };
      };
      if (!res.ok || out.error) throw new Error(out.error ?? "failed");
      setReply("");
      // Admin ko saaf dikhna chahiye ki khabar sach me gayi ya nahi — "bhej diya"
      // likh dena aur email chup-chaap fail ho jaana sabse bura hota.
      if (out.notify) {
        setSentNote(
          atpl(s.sentNote, {
            email: out.notify.email ? s.yes : s.no,
            push: out.notify.push,
          }),
        );
      }
      await openThread(openId);
      await load();
    } catch {
      setSentNote(s.sendFailed);
    } finally {
      setSending(false);
    }
  }

  const tickets = data?.tickets ?? [];
  const last = data?.last ?? {};

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tickets.filter((x) => {
      if (filter !== "all" && x.status !== filter) return false;
      if (!q) return true;
      return (
        x.ticket_no.toLowerCase().includes(q) ||
        x.subject.toLowerCase().includes(q) ||
        (x.email ?? "").toLowerCase().includes(q) ||
        (x.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [tickets, filter, query]);

  const pg = usePagination(filtered, 10, `${filter}|${query}`);

  const counts = useMemo(
    () => ({
      open: tickets.filter((x) => x.status === "open").length,
      answered: tickets.filter((x) => x.status === "answered").length,
      closed: tickets.filter((x) => x.status === "closed").length,
    }),
    [tickets],
  );

  if (!data && busy) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <Loader size={44} />
        <p className="text-sm text-ink-soft">{t.common.loading}</p>
      </div>
    );
  }

  if (data?.needsMigration) {
    return (
      <div className="mx-auto flex max-w-2xl items-start gap-3 rounded-2xl border border-amber-warm/50 bg-amber-warm/10 p-5 text-sm text-ink">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-terracotta-dark" />
        <span>{s.needsMigration}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-terracotta/40 bg-terracotta/10 p-4 text-sm text-terracotta-dark">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-terracotta/40 bg-surface px-3 py-2 text-xs font-bold"
          >
            <RefreshCw size={13} /> {t.common.refresh}
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "open", "answered", "closed"] as Filter[]).map((f) => (
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
            {f === "all"
              ? s.fAll
              : f === "open"
                ? `${s.stOpen} (${counts.open})`
                : f === "answered"
                  ? `${s.stAnswered} (${counts.answered})`
                  : `${s.stClosed} (${counts.closed})`}
          </button>
        ))}
        <div className="relative ml-auto min-w-[200px]">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={s.searchPh}
            className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-terracotta"
          />
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink-soft transition hover:text-ink"
        >
          <RefreshCw size={14} className={busy ? "animate-spin" : ""} /> {t.common.refresh}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        {/* ------------------------------ list ------------------------------ */}
        <div className="rounded-3xl border border-line bg-surface">
          {filtered.length === 0 ? (
            <p className="px-5 py-12 text-center text-sm text-ink-soft">{s.empty}</p>
          ) : (
            <>
              <ul className="divide-y divide-line/60">
                {pg.pageItems.map((x) => {
                  const l = last[x.id];
                  const on = openId === x.id;
                  return (
                    <li key={x.id}>
                      <button
                        type="button"
                        onClick={() => void openThread(x.id)}
                        className={`w-full px-4 py-3 text-left transition ${
                          on ? "bg-terracotta/[0.06]" : "hover:bg-cream/60"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[11px] font-bold tracking-wide text-terracotta">
                            {x.ticket_no}
                          </span>
                          <StatusPill status={x.status} s={s} />
                          <span className="ml-auto whitespace-nowrap text-[11px] text-ink-soft">
                            {fmt(x.last_message_at)}
                          </span>
                        </div>
                        <p className="mt-1 truncate text-sm font-semibold text-ink">
                          {x.subject}
                        </p>
                        <p className="truncate text-xs text-ink-soft">
                          {x.name || x.email || "—"}
                          {l ? ` · ${l.sender === "admin" ? s.you : s.them}: ${l.body}` : ""}
                        </p>
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="border-t border-line px-4 py-3">
                <Pagination
                  page={pg.page}
                  pageCount={pg.pageCount}
                  total={pg.total}
                  from={pg.from}
                  to={pg.to}
                  onPage={pg.setPage}
                  label={s.tickets}
                />
              </div>
            </>
          )}
        </div>

        {/* ----------------------------- thread ----------------------------- */}
        <div className="rounded-3xl border border-line bg-surface p-4 sm:p-5">
          {!openId ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center">
              <LifeBuoy size={30} className="text-ink-soft" />
              <p className="text-sm text-ink-soft">{s.pickOne}</p>
            </div>
          ) : !thread ? (
            <div className="flex justify-center py-16">
              <Loader size={38} />
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-2 border-b border-line pb-3">
                <span className="font-mono text-xs font-bold tracking-wide text-terracotta">
                  {thread.ticket?.ticket_no}
                </span>
                {!!thread.ticket && <StatusPill status={thread.ticket.status} s={s} />}
                <span className="ml-auto text-xs text-ink-soft">
                  {thread.ticket?.email ?? "—"}
                </span>
              </div>
              <p className="mt-3 text-base font-bold text-ink">{thread.ticket?.subject}</p>

              {/* Is user ki OTP limit — "number verify nahi ho raha" wali
                  ticket ka jawab aksar yahi ek button hai. */}
              {!!thread.ticket?.user_id && (
                <OtpLimitPanel userId={thread.ticket.user_id} s={s} />
              )}

              <ul className="mt-4 max-h-[420px] space-y-3 overflow-y-auto pr-1">
                {thread.messages.map((m) => {
                  const mine = m.sender === "admin";
                  return (
                    <li
                      key={m.id}
                      className={`max-w-[86%] rounded-2xl px-4 py-2.5 ${
                        mine
                          ? "ml-auto rounded-br-md bg-terracotta text-white"
                          : "rounded-bl-md border border-line bg-cream/50 text-ink"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {m.body}
                      </p>
                      <p
                        className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-ink-soft"}`}
                      >
                        {fmt(m.created_at)}
                        {/* User ne jawab dekha ya nahi — admin ka sabse aam
                            agla sawaal yahi hota hai. */}
                        {mine && (m.seen_at ? ` · ${s.seen}` : ` · ${s.notSeen}`)}
                      </p>
                    </li>
                  );
                })}
              </ul>

              <div className="mt-4 border-t border-line pt-4">
                <textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={4}
                  placeholder={s.replyPh}
                  className="w-full resize-y rounded-2xl border border-line bg-cream/40 px-4 py-3 text-sm leading-relaxed text-ink outline-none focus:border-terracotta"
                />
                <p className="mt-2 text-xs text-ink-soft">{s.replyNote}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={sending || !reply.trim()}
                    className="inline-flex items-center gap-2 rounded-2xl bg-terracotta px-5 py-3 text-sm font-bold text-white transition hover:bg-terracotta-dark disabled:opacity-50"
                  >
                    {sending ? <Loader size={18} /> : <Send size={15} />}
                    {sending ? s.sending : s.sendReply}
                  </button>
                  <button
                    type="button"
                    onClick={() => void send("closed")}
                    disabled={sending}
                    className="inline-flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink-soft transition hover:border-terracotta/40 hover:text-ink disabled:opacity-50"
                  >
                    <CheckCircle2 size={15} /> {s.closeTicket}
                  </button>
                </div>
                {!!sentNote && (
                  <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-ink-soft">
                    <Mail size={13} />
                    <Smartphone size={13} />
                    {sentNote}
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusPill({
  status,
  s,
}: {
  status: string;
  s: ReturnType<typeof useAdminT>["support"];
}) {
  const map: Record<string, { label: string; cls: string }> = {
    open: { label: s.stOpen, cls: "bg-amber-warm/20 text-terracotta-dark" },
    answered: { label: s.stAnswered, cls: "bg-sage/15 text-sage" },
    closed: { label: s.stClosed, cls: "bg-cream-deep text-ink-soft" },
  };
  const v = map[status] ?? map.open;
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${v.cls}`}>{v.label}</span>
  );
}
