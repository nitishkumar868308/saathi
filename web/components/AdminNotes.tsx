"use client";

import { useCallback, useEffect, useState } from "react";
import { NotebookPen, AlarmClock, Bookmark, Users, AlertTriangle } from "lucide-react";
import { SkeletonRows } from "@/components/Loader";
import Pagination, { usePagination } from "@/components/admin/Pagination";
import { useAdminT, atpl } from "@/lib/i18n/admin";

/**
 * Admin: Notes ka haal.
 *
 * ⚠️ Yahan kisi ka LIKHA HUA nahi dikhta, aur na dikh sakta hai — API use bhejti
 * hi nahi. Note user ki sabse niji cheez hai (bazaar ki list, ek idea, kisi ka
 * number, kabhi paise ka hisaab). Jo sawaal admin ka sach me hai — "feature
 * chal raha hai? note se reminder banta bhi hai ya log likh ke chhod dete
 * hain?" — uska poora jawab ginti aur waqt se mil jaata hai.
 *
 * Sabse kaam ka aankda "with reminder" hai: wahi batata hai ki notes aur
 * reminders ek doosre se jud rahe hain ya Notes ek alag, bhoola hua kona ban
 * gaya hai.
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

export default function AdminNotes() {
  const t = useAdminT();
  const d = t.data.notes;
  const sh = t.data.shared;

  const [totals, setTotals] = useState<Totals | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState("");

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
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wider text-ink-soft">
                    <th className="pb-2 pr-3 font-semibold">{d.colUser}</th>
                    <th className="pb-2 pr-3 font-semibold">{d.colNotes}</th>
                    <th className="pb-2 pr-3 font-semibold">{d.colWithReminder}</th>
                    <th className="pb-2 font-semibold">{d.colLast}</th>
                  </tr>
                </thead>
                <tbody>
                  {pg.pageItems.map((u) => (
                    <tr key={u.user_id} className="border-b border-line/60 last:border-0">
                      <td className="py-2.5 pr-3">
                        <span className="block font-semibold text-ink">
                          {u.full_name || u.email || u.user_id.slice(0, 8)}
                        </span>
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
                      <td className="py-2.5 text-ink-soft">{fmt(u.last_at)}</td>
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
