"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SkeletonRows } from "@/components/Loader";
import {
  Star,
  AlertTriangle,
  Globe,
  Download,
  MessageSquare,
  Check,
  X,
  Clock,
  Undo2,
} from "lucide-react";
import Pagination, { usePagination } from "@/components/admin/Pagination";
import { useAdminT } from "@/lib/i18n/admin";

type ReviewStatus = "pending" | "approved" | "rejected";

type AdminReview = {
  id: string;
  rating: number;
  text: string | null;
  allowDisplay: boolean;
  webStatus: ReviewStatus;
  webStatusAt: string | null;
  createdAt: string;
  email: string | null;
  name: string | null;
};

/**
 * Ye review website par ABHI dikh raha hai?
 *
 * Teen shartein, aur teeno zaroori hain — bilkul wahi jo `public_reviews()` SQL
 * me hain. Yahan dohrayi ja rahi hain kyunki admin ko ye number saaf dikhna
 * chahiye: "20 logon ne anumati di" aur "8 website par dikh rahe hain" do bilkul
 * alag baatein hain, aur inhe ek maan lena hi wo bhram hai jisse lagta hai ki
 * website par sab pahunch gaya.
 *
 * Text ki shart (>= 8) isliye ki bina likhe 5-star ka card khaali quote jaisa
 * lagta hai — wo ginti me aata hai, deewar par nahi.
 */
function isLive(r: AdminReview): boolean {
  return (
    r.allowDisplay && r.webStatus === "approved" && (r.text?.trim().length ?? 0) >= 8
  );
}

/**
 * Kisi review ko manzoori mil sakti hai?
 *
 * Nahi, jab user ne hi anumati na di ho. Us soorat me approve karna ek jhootha
 * bharosa deta hai: admin button dabata hai, darja 'approved' ho jaata hai, aur
 * review phir bhi website par nahi jaata (`public_reviews()` dono shartein
 * maangta hai). Isliye button hi nahi dikhate — jagah par wajah likhte hain.
 */
function canGoLive(r: AdminReview): boolean {
  return r.allowDisplay && (r.text?.trim().length ?? 0) >= 8;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

function Stars({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          size={15}
          className={i <= n ? "fill-amber-warm text-amber-warm" : "text-line"}
        />
      ))}
    </span>
  );
}

export default function AdminReviews() {
  const t = useAdminT();
  const d = t.data.reviews;
  const sh = t.data.shared;
  const [reviews, setReviews] = useState<AdminReview[] | null>(null);
  const [error, setError] = useState("");
  /**
   * `pending` default filter hai, `all` nahi.
   *
   * Ye screen ab ek KAAM ki screen hai, sirf padhne ki nahi: jo review manzoori
   * ka intezaar kar raha hai wahi sabse pehle dikhna chahiye. `all` par khulne se
   * naya review 200 purane ke beech kahin dab jaata hai aur hafton pending pada
   * rehta.
   */
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">(
    "pending",
  );
  /** Kis review ka faisla abhi server par ja raha hai (button disable karne ke liye). */
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/reviews", { cache: "no-store" });
      const body = (await res.json()) as { reviews?: AdminReview[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setReviews(body.reviews ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : sh.loadFailed);
      setReviews([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /**
   * Approve / reject / wapas pending.
   *
   * Pehle local state badalte hain (button turant jawab de), aur fail hone par
   * usse wapas palat dete hain. Bina palat-ne wala optimistic update yahan sabse
   * bura hota: admin ko lagta ki review reject ho gaya, aur wo landing page par
   * pada rehta.
   */
  const setStatus = useCallback(
    async (r: AdminReview, status: ReviewStatus) => {
      if (r.webStatus === status) return;
      setBusyId(r.id);
      setError("");
      setReviews((prev) =>
        (prev ?? []).map((x) => (x.id === r.id ? { ...x, webStatus: status } : x)),
      );
      try {
        const res = await fetch("/api/admin/reviews", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id: r.id, status }),
        });
        const body = (await res.json()) as { error?: string };
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      } catch (e) {
        setReviews((prev) =>
          (prev ?? []).map((x) => (x.id === r.id ? { ...x, webStatus: r.webStatus } : x)),
        );
        setError(e instanceof Error ? e.message : d.statusFailed);
      } finally {
        setBusyId(null);
      }
    },
    [d.statusFailed],
  );

  const rows = useMemo(() => {
    const list = reviews ?? [];
    if (filter === "all") return list;
    return list.filter((r) => r.webStatus === filter);
  }, [reviews, filter]);

  const pager = usePagination(rows, 10, filter);

  const stats = useMemo(() => {
    const list = reviews ?? [];
    const avg = list.length
      ? (list.reduce((s, r) => s + r.rating, 0) / list.length).toFixed(1)
      : "—";
    return {
      total: list.length,
      avg,
      display: list.filter((r) => r.allowDisplay).length,
      // Yahi wo number hai jo sach me landing page par dikhta hai. "Website OK"
      // se alag rakhna zaroori hai: anumati 20 logon ne di ho sakti hai, par
      // manzoori ke bina unme se ek bhi wahan nahi jaata.
      live: list.filter(isLive).length,
      // Sirf wo pending jinke saath admin kuch KAR sakta hai. Jis review par user
      // ne anumati hi nahi di uska "pending" hona bekaar hai — usse ginne se ye
      // number kabhi zero nahi hota aur badge hamesha laal rehta.
      pending: list.filter((r) => r.webStatus === "pending" && canGoLive(r)).length,
    };
  }, [reviews]);

  function exportCsv() {
    download(
      "apka-saathi-reviews.csv",
      toCsv([
        [
          sh.name,
          sh.email,
          d.rating,
          d.review,
          d.websiteAllowed,
          "status",
          d.liveOnSite,
          sh.date,
        ],
        ...rows.map((r) => [
          r.name ?? "",
          r.email ?? "",
          String(r.rating),
          r.text ?? "",
          r.allowDisplay ? "yes" : "no",
          r.webStatus,
          isLive(r) ? "yes" : "no",
          fmtDate(r.createdAt),
        ]),
      ]),
    );
  }

  if (!reviews) {
    return (
      <SkeletonRows rows={6} />
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

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-5 sm:gap-3">
        <Stat label={d.totalReviews} value={String(stats.total)} />
        <Stat label={d.average} value={stats.avg} />
        <Stat label={d.websiteOk} value={String(stats.display)} />
        <Stat label={d.pendingCount} value={String(stats.pending)} highlight={stats.pending > 0} />
        <Stat label={d.liveOnSite} value={String(stats.live)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap rounded-2xl border border-line bg-surface p-1">
          {(["pending", "approved", "rejected", "all"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`h-9 rounded-xl px-3 text-xs font-semibold transition ${
                filter === f ? "bg-terracotta text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {f === "pending"
                ? d.filterPending
                : f === "approved"
                  ? d.filterApproved
                  : f === "rejected"
                    ? d.filterRejected
                    : d.filterAll}
              {f === "pending" && stats.pending > 0 && (
                <span
                  className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                    filter === "pending"
                      ? "bg-white/25 text-white"
                      : "bg-terracotta/15 text-terracotta-dark"
                  }`}
                >
                  {stats.pending}
                </span>
              )}
            </button>
          ))}
        </div>
        <button
          onClick={exportCsv}
          disabled={!rows.length}
          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-2xl border border-line bg-surface px-4 text-sm font-semibold text-ink-soft transition hover:text-terracotta disabled:opacity-50"
        >
          <Download size={16} />
          CSV
        </button>
      </div>

      {!rows.length ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-line bg-surface py-16 text-center shadow-soft">
          <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-deep/50 text-ink-soft">
            <MessageSquare size={24} />
          </span>
          <p className="text-sm text-ink-soft">
            {reviews.length ? sh.emptyFilter : sh.empty}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pager.pageItems.map((r) => (
            <div
              key={r.id}
              className="rounded-3xl border border-line bg-surface p-5 shadow-soft"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{r.name || "—"}</p>
                  <p className="truncate text-sm text-ink-soft">{r.email ?? "—"}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Stars n={r.rating} />
                  <span className="text-xs font-medium text-ink-soft">
                    {fmtDate(r.createdAt)}
                  </span>
                </div>
              </div>
              {r.text && (
                <p className="mt-3 whitespace-pre-wrap break-words rounded-2xl bg-cream-deep/30 p-4 text-sm leading-relaxed text-ink">
                  {r.text}
                </p>
              )}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {r.allowDisplay && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-sage/15 px-2.5 py-1 text-xs font-bold text-sage">
                    <Globe size={12} />
                    {d.websiteAllowed}
                  </span>
                )}

                <StatusBadge status={r.webStatus} d={d} />

                {/* Anumati user ki, manzoori admin ki — website par jaane ke liye
                    DONO chahiye. Jis review par user ne haan nahi kaha uske liye
                    approve button dikhana ek jhootha bharosa hai: darja badal
                    jaata par review phir bhi live nahi hota. Isliye wahan wajah
                    likhte hain, button nahi. */}
                {canGoLive(r) ? (
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    {r.webStatus !== "approved" && (
                      <button
                        onClick={() => void setStatus(r, "approved")}
                        disabled={busyId === r.id}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full bg-sage px-3 text-xs font-bold text-on-accent transition hover:opacity-90 disabled:opacity-50"
                      >
                        <Check size={13} />
                        {d.approveBtn}
                      </button>
                    )}
                    {r.webStatus !== "rejected" && (
                      <button
                        onClick={() => void setStatus(r, "rejected")}
                        disabled={busyId === r.id}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-terracotta/40 px-3 text-xs font-bold text-terracotta-dark transition hover:bg-terracotta/10 disabled:opacity-50"
                      >
                        <X size={13} />
                        {d.rejectBtn}
                      </button>
                    )}
                    {r.webStatus !== "pending" && (
                      <button
                        onClick={() => void setStatus(r, "pending")}
                        disabled={busyId === r.id}
                        className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line px-3 text-xs font-semibold text-ink-soft transition hover:text-ink disabled:opacity-50"
                      >
                        <Undo2 size={13} />
                        {d.undoBtn}
                      </button>
                    )}
                  </div>
                ) : (
                  !r.allowDisplay && (
                    <span className="text-xs leading-relaxed text-ink-soft">
                      {d.noPermissionNote}
                    </span>
                  )
                )}
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
            label="reviews"
          />
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  /** "Aapke intezaar me" zero se upar ho to aankh me aana chahiye. */
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-3.5 text-center shadow-soft sm:p-4 ${
        highlight
          ? "border-terracotta/35 bg-terracotta/10"
          : "border-line bg-surface"
      }`}
    >
      <p
        className={`font-display text-2xl font-bold ${
          highlight ? "text-terracotta-dark" : "text-ink"
        }`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-[11px] leading-tight text-ink-soft sm:text-xs">{label}</p>
    </div>
  );
}

/** Darja ek nazar me — rang aur icon dono se, sirf text se nahi. */
function StatusBadge({
  status,
  d,
}: {
  status: ReviewStatus;
  d: ReturnType<typeof useAdminT>["data"]["reviews"];
}) {
  const map = {
    pending: {
      cls: "bg-amber-warm/20 text-ink",
      icon: <Clock size={12} />,
      label: d.badgePending,
    },
    approved: {
      // Sage dono theme me ujla hai — safed text uspar 3.4:1 (light) aur
      // 2.4:1 (dark) par gir jaata tha.
      cls: "bg-sage text-on-accent",
      icon: <Check size={12} />,
      label: d.badgeApproved,
    },
    rejected: {
      cls: "bg-terracotta/10 text-terracotta-dark",
      icon: <X size={12} />,
      label: d.badgeRejected,
    },
  }[status];

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${map.cls}`}
    >
      {map.icon}
      {map.label}
    </span>
  );
}
