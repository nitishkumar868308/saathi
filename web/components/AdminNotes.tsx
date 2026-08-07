"use client";

import { useCallback, useEffect, useState } from "react";
import {
  NotebookPen,
  AlarmClock,
  Bookmark,
  Users,
  AlertTriangle,
  Search,
  Pin,
} from "lucide-react";
import { SkeletonRows } from "@/components/Loader";
import Pagination, { usePagination } from "@/components/admin/Pagination";
import { useAdminT, atpl } from "@/lib/i18n/admin";

/**
 * Admin: Notes.
 *
 *   Ginti  — kisne kitne likhe, kitno ka reminder bana
 *   Matn   — kisne kya likha, jaisa likha waisa
 *
 * ⚠️ Pehle yahan kisi ka likha hua nahi dikhta tha, aur API use bhejti bhi nahi
 * thi. Ab dikhta hai. Par jo baat tab sach thi wo ab bhi utni hi sach hai:
 *
 *   Note user ki sabse niji cheez hai — bazaar ki list, ek idea, kisi ka
 *   number, kabhi paise ka hisaab. User ne ye is bharose par likha ki ye uska
 *   apna hai.
 *
 * Isliye do cheezein jaan-boojh ke aisi hain:
 *
 *   1. Matn ALAG tab me hai aur alag call se aata hai — page khulte hi kisi ka
 *      likha hua chup-chaap load nahi hota. Padhna ek kaam hai, ek ittefaq
 *      nahi.
 *   2. Us tab par ek chetavni hamesha rehti hai. Wo shor nahi hai: jo cheez
 *      roz dikhti hai wo aam lagne lagti hai, aur yahi ek jagah hai jahan use
 *      aam nahi lagna chahiye.
 *
 * Sabse kaam ka aankda phir bhi "with reminder" hi hai: wahi batata hai ki
 * notes aur reminders ek doosre se jud rahe hain ya Notes ek alag, bhoola hua
 * kona ban gaya hai.
 */

type Totals = {
  notes: number;
  withReminder: number;
  pinned: number;
  users: number;
  last7: number;
};

type Row = {
  user_id: string;
  full_name: string | null;
  email: string | null;
  notes: number;
  with_reminder: number;
  last_at: string;
};

type Note = {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  title: string | null;
  body: string;
  is_pinned: boolean;
  has_reminder: boolean;
  created_at: string;
  updated_at: string;
};

function fmt(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function who(n: { full_name: string | null; email: string | null; user_id: string }): string {
  return n.full_name || n.email || n.user_id.slice(0, 8);
}

export default function AdminNotes() {
  const t = useAdminT();
  const d = t.data.notes;
  const sh = t.data.shared;

  const [tab, setTab] = useState<"stats" | "content">("stats");
  const [totals, setTotals] = useState<Totals | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

  /** Content tab kis ek user par tika hai (null = sab). */
  const [focusUser, setFocusUser] = useState<{ id: string; name: string } | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/notes", { cache: "no-store" });
      const body = (await res.json()) as {
        totals?: Totals;
        users?: Row[];
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        // Migration na chali ho — wahi sabse aam wajah hai, aur uska ilaaj bhi
        // saaf hai. Use ek aam "load failed" me chhupa dena bekaar hai.
        throw new Error(
          body.error === "migration_missing"
            ? (body.detail ?? d.migrationMissing)
            : (body.error ?? `HTTP ${res.status}`),
        );
      }
      setTotals(body.totals ?? null);
      setRows(body.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : sh.loadFailed);
      setRows([]);
    }
  }, [sh.loadFailed, d.migrationMissing]);

  useEffect(() => {
    load();
  }, [load]);

  const pg = usePagination(rows ?? [], 12, "");

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-ink">{d.title}</h2>
        <p className="mt-1 text-sm text-ink-soft">{d.sub}</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-terracotta/40 bg-terracotta/10 p-4 text-sm text-terracotta-dark">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        {(["stats", "content"] as const).map((k) => (
          <button
            key={k}
            onClick={() => {
              setTab(k);
              if (k === "stats") setFocusUser(null);
            }}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              tab === k ? "bg-ink text-white" : "bg-cream-deep text-ink-soft hover:text-ink"
            }`}
          >
            {k === "stats" ? d.tabStats : d.tabContent}
          </button>
        ))}
      </div>

      {tab === "content" ? (
        <NotesContent focusUser={focusUser} onClearFocus={() => setFocusUser(null)} />
      ) : (
        <>
          {totals && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat icon={<NotebookPen size={16} />} label={d.statNotes} value={totals.notes} />
              {/* Yahi wo ek aankda hai jo batata hai ki Notes aur Reminders ek
                  doosre se jud rahe hain ya nahi. */}
              <Stat
                icon={<AlarmClock size={16} />}
                label={d.statWithReminder}
                value={totals.withReminder}
                hint={
                  totals.notes > 0
                    ? atpl(d.ofTotal, {
                        pct: Math.round((totals.withReminder / totals.notes) * 100),
                      })
                    : undefined
                }
              />
              <Stat icon={<Users size={16} />} label={d.statUsers} value={totals.users} />
              <Stat icon={<Bookmark size={16} />} label={d.statLast7} value={totals.last7} />
            </div>
          )}

          <div className="rounded-3xl border border-line bg-surface p-4 sm:p-5">
            <p className="mb-3 text-xs font-bold uppercase tracking-wider text-ink-soft">
              {d.perUser}
            </p>

            {rows === null ? (
              <SkeletonRows rows={6} />
            ) : rows.length === 0 ? (
              <p className="rounded-xl border border-line bg-cream/40 px-4 py-6 text-center text-sm text-ink-soft">
                {d.empty}
              </p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                        <th className="pb-2 pr-3 font-semibold">{d.colUser}</th>
                        <th className="pb-2 pr-3 font-semibold">{d.colNotes}</th>
                        <th className="pb-2 pr-3 font-semibold">{d.colWithReminder}</th>
                        <th className="pb-2 pr-3 font-semibold">{d.colLast}</th>
                        <th className="pb-2 font-semibold" />
                      </tr>
                    </thead>
                    <tbody>
                      {pg.pageItems.map((u) => (
                        <tr key={u.user_id} className="border-b border-line/60 last:border-0">
                          <td className="py-2.5 pr-3">
                            <span className="block font-semibold text-ink">{who(u)}</span>
                            {!!u.full_name && !!u.email && (
                              <span className="block text-xs text-ink-soft">{u.email}</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 font-semibold text-ink">{u.notes}</td>
                          <td className="py-2.5 pr-3">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${
                                u.with_reminder > 0
                                  ? "bg-sage/15 text-sage"
                                  : "bg-cream-deep text-ink-soft"
                              }`}
                            >
                              <AlarmClock size={11} />
                              {u.with_reminder}
                            </span>
                          </td>
                          <td className="py-2.5 pr-3 text-ink-soft">{fmt(u.last_at)}</td>
                          <td className="py-2.5">
                            {/* Ek bande ka likha hua padhne ka seedha raasta.
                                Ye tab badalta hai — yaani padhna hamesha ek
                                jaan-boojh ke uthaya kadam rehta hai. */}
                            <button
                              onClick={() => {
                                setFocusUser({ id: u.user_id, name: who(u) });
                                setTab("content");
                              }}
                              className="rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-cream-deep hover:text-ink"
                            >
                              {d.viewNotes}
                            </button>
                          </td>
                        </tr>
                      ))}
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
                    label={d.users}
                  />
                </div>
              </>
            )}

            <p className="mt-4 rounded-xl border border-line bg-cream/40 px-3.5 py-3 text-xs leading-relaxed text-ink-soft">
              {d.privacyNote}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/* =================================================================== */
/*  Matn — kisne kya likha                                              */
/* =================================================================== */

const PAGE = 25;

function NotesContent({
  focusUser,
  onClearFocus,
}: {
  focusUser: { id: string; name: string } | null;
  onClearFocus: () => void;
}) {
  const t = useAdminT();
  const d = t.data.notes;
  const sh = t.data.shared;

  const [q, setQ] = useState("");
  /** Jo sach me server ko bheja gaya — har keystroke par nahi. */
  const [query, setQuery] = useState("");
  const [notes, setNotes] = useState<Note[] | null>(null);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  /*
   * Search server par chalti hai (poori table par ILIKE), isliye har keystroke
   * par bhejna do tarah se bura hai: DB par bekaar ka bojh, aur nateeje aage-
   * peeche aa ke ek doosre ko kaat-te hain. 350ms rukna kaafi hai.
   */
  useEffect(() => {
    const id = setTimeout(() => {
      setQuery(q.trim());
      setOffset(0);
    }, 350);
    return () => clearTimeout(id);
  }, [q]);

  // User badla to purane nateeje saaf — warna ek pal ke liye pichhle bande ka
  // likha hua naye naam ke neeche dikhta hai.
  useEffect(() => {
    setOffset(0);
    setNotes(null);
  }, [focusUser?.id]);

  const load = useCallback(
    async (off: number) => {
      setBusy(true);
      setError("");
      try {
        const params = new URLSearchParams({
          view: "content",
          limit: String(PAGE),
          offset: String(off),
        });
        if (focusUser) params.set("user", focusUser.id);
        if (query) params.set("q", query);

        const res = await fetch(`/api/admin/notes?${params}`, { cache: "no-store" });
        const body = (await res.json()) as {
          notes?: Note[];
          total?: number;
          error?: string;
          detail?: string;
        };
        if (!res.ok) {
          throw new Error(
            body.error === "migration_missing"
              ? (body.detail ?? d.contentMigrationMissing)
              : (body.error ?? `HTTP ${res.status}`),
          );
        }
        setTotal(body.total ?? 0);
        // off > 0 = "aur laao" — purane ke aage jodo, badlo mat.
        setNotes((prev) => (off > 0 ? [...(prev ?? []), ...(body.notes ?? [])] : (body.notes ?? [])));
      } catch (e) {
        setError(e instanceof Error ? e.message : sh.loadFailed);
        setNotes([]);
      } finally {
        setBusy(false);
      }
    },
    [focusUser, query, d.contentMigrationMissing, sh.loadFailed],
  );

  useEffect(() => {
    void load(0);
  }, [load]);

  return (
    <div className="space-y-4">
      {/* ⚠️ Ye chetavni hamesha rehti hai, ek baar dikha ke gayab nahi hoti.
          Jo cheez roz dikhti hai wo aam lagne lagti hai — aur yahi ek jagah
          hai jahan use aam nahi lagna chahiye. */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-warm/40 bg-amber-warm/10 p-4 text-sm leading-relaxed text-ink">
        <AlertTriangle size={18} className="mt-0.5 shrink-0" />
        <span>{d.contentWarn}</span>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 sm:min-w-[260px]">
          <Search
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={d.searchPh}
            className="w-full rounded-xl border border-line bg-cream-deep/20 py-2 pl-9 pr-3 text-sm outline-none focus:border-terracotta"
          />
        </div>

        <span className="inline-flex items-center gap-2 rounded-xl bg-cream-deep px-3 py-2 text-xs font-semibold text-ink-soft">
          {focusUser ? focusUser.name : d.allUsers}
          {!!focusUser && (
            <button onClick={onClearFocus} className="text-terracotta hover:underline">
              ×
            </button>
          )}
        </span>

        {notes !== null && (
          <span className="text-xs text-ink-soft">{atpl(d.foundN, { n: total })}</span>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-terracotta/40 bg-terracotta/10 p-4 text-sm text-terracotta-dark">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notes === null ? (
        <SkeletonRows rows={5} />
      ) : notes.length === 0 ? (
        <p className="rounded-2xl border border-line bg-cream/40 px-4 py-8 text-center text-sm text-ink-soft">
          {query ? d.noMatch : d.empty}
        </p>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => (
            <article key={n.id} className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-semibold text-ink">{who(n)}</span>
                {!!n.full_name && !!n.email && <span className="text-ink-soft">{n.email}</span>}
                {n.is_pinned && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-warm/20 px-2 py-0.5 font-bold text-amber-warm">
                    <Pin size={10} /> {d.pinned}
                  </span>
                )}
                {n.has_reminder && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-sage/15 px-2 py-0.5 font-bold text-sage">
                    <AlarmClock size={10} /> {d.hasReminder}
                  </span>
                )}
                <span className="ml-auto text-ink-soft">
                  {d.created} {fmt(n.created_at)}
                  {n.updated_at !== n.created_at && ` · ${d.edited} ${fmt(n.updated_at)}`}
                </span>
              </div>

              <h3 className="mt-2 font-semibold text-ink">
                {n.title?.trim() || <span className="text-ink-soft">{d.untitled}</span>}
              </h3>

              {/*
               * ⚠️ `whitespace-pre-wrap` yahan ki sabse zaroori class hai.
               * Note ka dhaancha hi aksar uska aadha matlab hota hai — ek list,
               * ek hisaab, do hisson me bati hui baat. HTML default me saare
               * line break aur khaali lines nigal jaata hai, aur tab wahi note
               * ek lambi bematlab line ban jaata hai. `break-words` uske saath
               * zaroori hai: bina space wala lamba matn (link, koi number)
               * warna card ke bahar nikal jaata hai.
               */}
              {!!n.body.trim() && (
                <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-ink">
                  {n.body}
                </p>
              )}
            </article>
          ))}

          {notes.length < total && (
            <button
              onClick={() => {
                const next = offset + PAGE;
                setOffset(next);
                void load(next);
              }}
              disabled={busy}
              className="w-full rounded-xl border border-line py-2.5 text-sm font-semibold text-ink-soft hover:bg-cream-deep hover:text-ink disabled:opacity-60"
            >
              {busy ? t.common.loading : d.loadMore}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-soft">
        {icon} {label}
      </span>
      <p className="mt-1.5 text-2xl font-bold text-ink">{value}</p>
      {!!hint && <p className="mt-0.5 text-xs text-ink-soft">{hint}</p>}
    </div>
  );
}
