"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Plus, Save, Search } from "lucide-react";

import Loader from "@/components/Loader";
import Pagination, { usePagination } from "@/components/admin/Pagination";
import { useAdminT } from "@/lib/i18n/admin";

/**
 * SEO editor — har page ka title, description, keywords aur OG.
 *
 * Pehle ye sab code me tha, isliye ek shabd badalne ke liye bhi deploy karna
 * padta tha. Ab yahin se badalta hai aur save karte hi website par lag jaata hai.
 *
 * Do counter jaan-boojh ke lagaye hain — title ~60 aur description ~155
 * characters se lamba ho to Google use kaat deta hai. Limit paar hote hi number
 * laal ho jaata hai, taaki likhte waqt hi pata chale.
 */

type Page = {
  path: string;
  title: string | null;
  description: string | null;
  keywords: string[] | null;
  og_title: string | null;
  og_description: string | null;
  noindex: boolean;
};

const TITLE_MAX = 60;
const DESC_MAX = 155;

const inputCls =
  "mt-1.5 w-full rounded-xl border border-line bg-cream-deep/20 px-3 py-2 text-sm outline-none focus:border-terracotta";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-ink-soft";

export default function AdminSeo() {
  const t = useAdminT();
  const sh = t.data.shared;
  const s = t.data.seo;

  const [pages, setPages] = useState<Page[] | null>(null);
  const [error, setError] = useState("");
  const [savingPath, setSavingPath] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(null);
  const [newPath, setNewPath] = useState("");
  const [query, setQuery] = useState("");

  // Har page ka apna bada card hai — 20 pages matlab 20 lambi cards ek page par.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = pages ?? [];
    if (!q) return list;
    return list.filter(
      (p) =>
        p.path.toLowerCase().includes(q) ||
        (p.title ?? "").toLowerCase().includes(q),
    );
  }, [pages, query]);

  const pg = usePagination(filtered, 5, query);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/seo", { cache: "no-store" });
      const body = (await res.json()) as { pages?: Page[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setPages(body.pages ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : sh.loadFailed);
      setPages([]);
    }
  }, [sh.loadFailed]);

  useEffect(() => {
    load();
  }, [load]);

  function patch(path: string, patchObj: Partial<Page>) {
    setPages((prev) =>
      (prev ?? []).map((p) => (p.path === path ? { ...p, ...patchObj } : p)),
    );
    setSavedPath(null);
  }

  async function save(page: Page) {
    setSavingPath(page.path);
    setError("");
    try {
      const res = await fetch("/api/admin/seo", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(page),
      });
      const body = (await res.json()) as { page?: Page; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setSavedPath(page.path);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.data.rewards.saveFailed);
    } finally {
      setSavingPath(null);
    }
  }

  function addPage() {
    const path = newPath.trim();
    if (!path.startsWith("/")) return;
    if ((pages ?? []).some((p) => p.path === path)) return;
    setPages((prev) => [
      {
        path,
        title: null,
        description: null,
        keywords: null,
        og_title: null,
        og_description: null,
        noindex: false,
      },
      ...(prev ?? []),
    ]);
    setNewPath("");
  }

  if (!pages) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader size={44} />
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

      {/* Naya page jodo */}
      <div className="flex flex-col gap-2 rounded-3xl border border-line bg-surface p-5 shadow-soft sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className={labelCls}>{s.addPath}</label>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3 top-1/2 mt-[3px] -translate-y-1/2 text-ink-soft"
            />
            <input
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addPage()}
              placeholder="/new-page"
              className={`${inputCls} pl-9 font-mono`}
            />
          </div>
        </div>
        <button
          onClick={addPage}
          disabled={!newPath.trim().startsWith("/")}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-terracotta px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          <Plus size={15} /> {s.addBtn}
        </button>
      </div>

      {/* Filter — path ya title se */}
      {pages.length > 5 && (
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={sh.searchPh}
            className="w-full rounded-2xl border border-line bg-surface py-3 pl-10 pr-4 text-sm text-ink shadow-soft outline-none transition focus:border-terracotta"
          />
        </div>
      )}

      {pages.length > 0 && filtered.length === 0 && (
        <p className="rounded-2xl border border-line bg-surface px-4 py-5 text-center text-sm text-ink-soft">
          {sh.emptyFilter}
        </p>
      )}

      {pg.pageItems.map((p) => {
        const titleLen = (p.title ?? "").length;
        const descLen = (p.description ?? "").length;
        return (
          <div key={p.path} className="rounded-3xl border border-line bg-surface p-5 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <code className="rounded-lg bg-cream-deep/40 px-2.5 py-1 font-mono text-sm font-semibold text-ink">
                {p.path}
              </code>
              <label className="flex items-center gap-2 text-sm font-medium text-ink-soft">
                <input
                  type="checkbox"
                  checked={p.noindex}
                  onChange={(e) => patch(p.path, { noindex: e.target.checked })}
                />
                {s.noindex}
              </label>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              <div>
                <div className="flex items-baseline justify-between">
                  <label className={labelCls}>{s.title}</label>
                  <span
                    className={`text-[11px] font-semibold ${
                      titleLen > TITLE_MAX ? "text-terracotta-dark" : "text-ink-soft"
                    }`}
                  >
                    {titleLen}/{TITLE_MAX}
                  </span>
                </div>
                <input
                  value={p.title ?? ""}
                  onChange={(e) => patch(p.path, { title: e.target.value })}
                  className={inputCls}
                />
              </div>

              <div>
                <label className={labelCls}>{s.ogTitle}</label>
                <input
                  value={p.og_title ?? ""}
                  onChange={(e) => patch(p.path, { og_title: e.target.value })}
                  placeholder={p.title ?? ""}
                  className={inputCls}
                />
              </div>

              <div className="lg:col-span-2">
                <div className="flex items-baseline justify-between">
                  <label className={labelCls}>{s.description}</label>
                  <span
                    className={`text-[11px] font-semibold ${
                      descLen > DESC_MAX ? "text-terracotta-dark" : "text-ink-soft"
                    }`}
                  >
                    {descLen}/{DESC_MAX}
                  </span>
                </div>
                <textarea
                  value={p.description ?? ""}
                  onChange={(e) => patch(p.path, { description: e.target.value })}
                  rows={2}
                  className={inputCls}
                />
              </div>

              <div className="lg:col-span-2">
                <label className={labelCls}>{s.ogDescription}</label>
                <textarea
                  value={p.og_description ?? ""}
                  onChange={(e) => patch(p.path, { og_description: e.target.value })}
                  rows={2}
                  placeholder={p.description ?? ""}
                  className={inputCls}
                />
              </div>

              <div className="lg:col-span-2">
                <label className={labelCls}>{s.keywords}</label>
                <input
                  value={(p.keywords ?? []).join(", ")}
                  onChange={(e) =>
                    patch(p.path, {
                      keywords: e.target.value
                        .split(",")
                        .map((k) => k.trim())
                        .filter(Boolean),
                    })
                  }
                  placeholder="reminder app, document expiry reminder"
                  className={inputCls}
                />
                <p className="mt-1.5 text-xs text-ink-soft">{s.keywordsHint}</p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={() => save(p)}
                disabled={savingPath === p.path}
                className="inline-flex items-center gap-2 rounded-xl bg-terracotta px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta-dark disabled:opacity-60"
              >
                {savingPath === p.path ? <Loader size={18} /> : <Save size={15} />}
                {savingPath === p.path ? t.common.saving : t.common.save}
              </button>
              {savedPath === p.path && (
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-sage">
                  <Check size={16} /> {t.data.rewards.saved}
                </span>
              )}
            </div>
          </div>
        );
      })}

      <Pagination
        page={pg.page}
        pageCount={pg.pageCount}
        total={pg.total}
        from={pg.from}
        to={pg.to}
        onPage={pg.setPage}
        label={sh.pages}
      />
    </div>
  );
}
