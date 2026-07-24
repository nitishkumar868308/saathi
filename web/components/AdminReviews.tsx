"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SkeletonRows } from "@/components/Loader";
import { Star, AlertTriangle, Globe, Download, MessageSquare } from "lucide-react";
import Pagination, { usePagination } from "@/components/admin/Pagination";

type AdminReview = {
  id: string;
  rating: number;
  text: string | null;
  allowDisplay: boolean;
  createdAt: string;
  email: string | null;
  name: string | null;
};

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
  const [reviews, setReviews] = useState<AdminReview[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "display">("all");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/reviews", { cache: "no-store" });
      const body = (await res.json()) as { reviews?: AdminReview[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setReviews(body.reviews ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Reviews load nahi hue");
      setReviews([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const list = reviews ?? [];
    return filter === "display" ? list.filter((r) => r.allowDisplay) : list;
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
    };
  }, [reviews]);

  function exportCsv() {
    download(
      "apka-saathi-reviews.csv",
      toCsv([
        ["Name", "Email", "Rating", "Review", "Website allowed", "Date"],
        ...rows.map((r) => [
          r.name ?? "",
          r.email ?? "",
          String(r.rating),
          r.text ?? "",
          r.allowDisplay ? "yes" : "no",
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

      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <Stat label="Total reviews" value={String(stats.total)} />
        <Stat label="Average" value={stats.avg} />
        <Stat label="Website OK" value={String(stats.display)} />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex rounded-2xl border border-line bg-surface p-1">
          {(["all", "display"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`h-9 rounded-xl px-3 text-xs font-semibold transition ${
                filter === f ? "bg-terracotta text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {f === "all" ? "All" : "Website-allowed"}
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
            {reviews.length ? "Is filter me koi review nahi." : "Abhi koi review nahi aaya."}
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
              {r.allowDisplay && (
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-sage/15 px-2.5 py-1 text-xs font-bold text-sage">
                  <Globe size={12} />
                  Website pe dikhane ki anumati di
                </span>
              )}
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5 text-center shadow-soft sm:p-4">
      <p className="font-display text-2xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-ink-soft sm:text-xs">{label}</p>
    </div>
  );
}
