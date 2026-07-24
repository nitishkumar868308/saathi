"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Client-side pagination — data pehle se loaded hota hai, ye sirf slice karta hai.
 *
 * `resetKey` badalne pe (search/filter/range change) page 1 pe wapas — taaki
 * filtered result ka pehla page dikhe, na ki purana page number.
 */
export function usePagination<T>(items: T[], pageSize = 10, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // Search/filter badla → page 1.
  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  // List chhoti ho gayi to valid page pe reha karo.
  useEffect(() => {
    if (page > pageCount) setPage(1);
  }, [page, pageCount]);

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  );

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return { page, setPage, pageCount, pageItems, total, from, to, pageSize };
}

/** Prev/next + page numbers + "X–Y of Z". Ek page ho to sirf count dikhta hai. */
export default function Pagination({
  page,
  pageCount,
  total,
  from,
  to,
  onPage,
  label = "items",
}: {
  page: number;
  pageCount: number;
  total: number;
  from: number;
  to: number;
  onPage: (p: number) => void;
  label?: string;
}) {
  if (total === 0) return null;

  const pages = pageWindow(page, pageCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
      <p className="text-xs font-medium text-ink-soft">
        <span className="font-bold text-ink">
          {from}–{to}
        </span>{" "}
        / {total} {label}
      </p>
      {pageCount > 1 && (
        <div className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface p-1 shadow-soft">
          <PagerBtn onClick={() => onPage(page - 1)} disabled={page <= 1} label="Pichla">
            <ChevronLeft size={16} />
          </PagerBtn>
          {pages.map((p, i) =>
            p === "…" ? (
              <span
                key={`gap-${i}`}
                className="flex h-9 w-6 items-center justify-center text-xs text-ink-soft"
              >
                …
              </span>
            ) : (
              <button
                key={p}
                onClick={() => onPage(p)}
                aria-current={p === page ? "page" : undefined}
                className={`h-9 min-w-9 rounded-xl px-2.5 text-sm font-semibold transition ${
                  p === page
                    ? "bg-terracotta text-white shadow-warm"
                    : "text-ink-soft hover:bg-cream-deep/50 hover:text-ink"
                }`}
              >
                {p}
              </button>
            ),
          )}
          <PagerBtn onClick={() => onPage(page + 1)} disabled={page >= pageCount} label="Agla">
            <ChevronRight size={16} />
          </PagerBtn>
        </div>
      )}
    </div>
  );
}

function PagerBtn({
  onClick,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-soft transition hover:bg-cream-deep/50 hover:text-ink disabled:pointer-events-none disabled:opacity-30"
    >
      {children}
    </button>
  );
}

/** Compact page list: 1 … 4 5 [6] 7 8 … 20 */
function pageWindow(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 7) return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < pageCount - 1) out.push("…");
  out.push(pageCount);
  return out;
}
