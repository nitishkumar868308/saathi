"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Plus, Save, Trash2, Eye, EyeOff, Search } from "lucide-react";

import Loader from "@/components/Loader";
import Pagination, { usePagination } from "@/components/admin/Pagination";
import { useAdminT } from "@/lib/i18n/admin";

/**
 * Blog editor.
 *
 * Post ki body "sections" me hoti hai — har section ka ek heading (h2) aur uske
 * neeche paragraphs. Ye jaan-boojh ke rich-text nahi hai: heading + paragraph
 * wala dhaancha Google ko saaf dikhta hai, aur is tarah koi galti se toota hua
 * HTML nahi daal sakta.
 *
 * Paragraphs ek hi textarea me likhe jaate hain — **khaali line se naya
 * paragraph** banta hai. Server bhi isi tarah todta hai.
 */

type Section = { h: string; p: string[] };

type Post = {
  slug: string;
  title: string;
  description: string;
  heading: string;
  intro: string;
  sections: Section[];
  tags: string[];
  reading_minutes: number;
  is_published: boolean;
  published_at: string;
};

const EMPTY: Post = {
  slug: "",
  title: "",
  description: "",
  heading: "",
  intro: "",
  sections: [{ h: "", p: [] }],
  tags: [],
  reading_minutes: 4,
  is_published: true,
  published_at: new Date().toISOString().slice(0, 10),
};

const inputCls =
  "mt-1.5 w-full rounded-xl border border-line bg-cream-deep/20 px-3 py-2 text-sm outline-none focus:border-terracotta";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-ink-soft";

export default function AdminBlog() {
  const t = useAdminT();
  const sh = t.data.shared;
  const b = t.data.blog;

  const [posts, setPosts] = useState<Post[] | null>(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<Post | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState("");

  // Blog badhta hi jaata hai — poori list ek saath dikhane ka koi faayda nahi.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = posts ?? [];
    if (!q) return list;
    return list.filter(
      (p) => p.title.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q),
    );
  }, [posts, query]);

  const pg = usePagination(filtered, 10, query);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/blog", { cache: "no-store" });
      const body = (await res.json()) as { posts?: Post[]; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setPosts(body.posts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : sh.loadFailed);
      setPosts([]);
    }
  }, [sh.loadFailed]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    if (!editing) return;
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch("/api/admin/blog", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing),
      });
      const body = (await res.json()) as { post?: Post; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setSaved(true);
      await load();
      if (body.post) setEditing(body.post);
    } catch (e) {
      setError(e instanceof Error ? e.message : t.data.rewards.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function remove(slug: string) {
    setError("");
    try {
      const res = await fetch(`/api/admin/blog?slug=${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      if (editing?.slug === slug) setEditing(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : sh.loadFailed);
    }
  }

  function patch(p: Partial<Post>) {
    setEditing((prev) => (prev ? { ...prev, ...p } : prev));
    setSaved(false);
  }

  if (!posts) {
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

      {/* Post list */}
      <div className="rounded-3xl border border-line bg-surface shadow-soft">
        <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
          <h3 className="font-display text-base font-semibold">
            {posts.length} {b.postsLabel}
          </h3>
          <button
            onClick={() => {
              setEditing({ ...EMPTY, sections: [{ h: "", p: [] }] });
              setSaved(false);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-terracotta px-3.5 text-sm font-semibold text-white"
          >
            <Plus size={15} /> {b.newPost}
          </button>
        </div>

        {posts.length > 10 && (
          <div className="relative border-b border-line px-5 py-3">
            <Search
              size={15}
              className="pointer-events-none absolute left-8 top-1/2 -translate-y-1/2 text-ink-soft"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={sh.searchPh}
              className="w-full rounded-xl border border-line bg-cream/40 py-2 pl-8 pr-3 text-sm text-ink outline-none focus:border-terracotta"
            />
          </div>
        )}

        {!posts.length ? (
          <p className="px-5 py-10 text-center text-sm text-ink-soft">{b.noPosts}</p>
        ) : !filtered.length ? (
          <p className="px-5 py-10 text-center text-sm text-ink-soft">{sh.emptyFilter}</p>
        ) : (
          <ul className="divide-y divide-line/60">
            {pg.pageItems.map((p) => (
              <li key={p.slug} className="flex items-center gap-3 px-5 py-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                    p.is_published ? "bg-sage/15 text-sage" : "bg-cream-deep/60 text-ink-soft"
                  }`}
                  title={p.is_published ? b.published : b.draft}
                >
                  {p.is_published ? <Eye size={15} /> : <EyeOff size={15} />}
                </span>
                <button
                  onClick={() => {
                    setEditing(p);
                    setSaved(false);
                  }}
                  className="min-w-0 flex-1 text-left"
                >
                  <p className="truncate font-semibold text-ink">{p.title}</p>
                  <p className="truncate font-mono text-xs text-ink-soft">/blog/{p.slug}</p>
                </button>
                <span className="shrink-0 text-xs text-ink-soft">{p.published_at}</span>
                <button
                  onClick={() => remove(p.slug)}
                  aria-label={t.common.delete}
                  className="shrink-0 text-ink-soft transition hover:text-terracotta-dark"
                >
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {filtered.length > 0 && (
          <div className="px-5 pb-4">
            <Pagination
              page={pg.page}
              pageCount={pg.pageCount}
              total={pg.total}
              from={pg.from}
              to={pg.to}
              onPage={pg.setPage}
              label={sh.posts}
            />
          </div>
        )}
      </div>

      {/* Editor */}
      {editing && (
        <div className="space-y-4 rounded-3xl border border-line bg-surface p-5 shadow-soft">
          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className={labelCls}>{b.title}</label>
              <input
                value={editing.title}
                onChange={(e) => patch({ title: e.target.value })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>{b.slug}</label>
              <input
                value={editing.slug}
                onChange={(e) => patch({ slug: e.target.value })}
                placeholder={b.slugHint}
                className={`${inputCls} font-mono`}
              />
            </div>

            <div className="lg:col-span-2">
              <label className={labelCls}>{b.description}</label>
              <textarea
                value={editing.description}
                onChange={(e) => patch({ description: e.target.value })}
                rows={2}
                className={inputCls}
              />
              <p className="mt-1.5 text-xs text-ink-soft">{b.descriptionHint}</p>
            </div>

            <div className="lg:col-span-2">
              <label className={labelCls}>{b.heading}</label>
              <input
                value={editing.heading}
                onChange={(e) => patch({ heading: e.target.value })}
                placeholder={editing.title}
                className={inputCls}
              />
            </div>

            <div className="lg:col-span-2">
              <label className={labelCls}>{b.intro}</label>
              <textarea
                value={editing.intro}
                onChange={(e) => patch({ intro: e.target.value })}
                rows={3}
                className={inputCls}
              />
            </div>

            <div>
              <label className={labelCls}>{b.tags}</label>
              <input
                value={editing.tags.join(", ")}
                onChange={(e) =>
                  patch({
                    tags: e.target.value
                      .split(",")
                      .map((x) => x.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Documents, Reminders"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>{b.readingMinutes}</label>
                <input
                  type="number"
                  value={editing.reading_minutes}
                  onChange={(e) => patch({ reading_minutes: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>{b.publishedAt}</label>
                <input
                  type="date"
                  value={editing.published_at?.slice(0, 10) ?? ""}
                  onChange={(e) => patch({ published_at: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Sections */}
          <div className="space-y-3">
            <p className={labelCls}>{b.sections}</p>
            {editing.sections.map((sec, i) => (
              <div key={i} className="rounded-2xl border border-line bg-cream-deep/15 p-4">
                <div className="flex items-center gap-2">
                  <input
                    value={sec.h}
                    onChange={(e) => {
                      const next = [...editing.sections];
                      next[i] = { ...sec, h: e.target.value };
                      patch({ sections: next });
                    }}
                    placeholder={b.sectionHeading}
                    className="flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-semibold outline-none focus:border-terracotta"
                  />
                  <button
                    onClick={() =>
                      patch({ sections: editing.sections.filter((_, k) => k !== i) })
                    }
                    aria-label={t.common.delete}
                    className="shrink-0 text-ink-soft transition hover:text-terracotta-dark"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <textarea
                  value={sec.p.join("\n\n")}
                  onChange={(e) => {
                    const next = [...editing.sections];
                    next[i] = {
                      ...sec,
                      p: e.target.value.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean),
                    };
                    patch({ sections: next });
                  }}
                  rows={5}
                  placeholder={b.sectionBody}
                  className="mt-2 w-full rounded-xl border border-line bg-surface px-3 py-2 text-sm leading-relaxed outline-none focus:border-terracotta"
                />
              </div>
            ))}
            <button
              onClick={() => patch({ sections: [...editing.sections, { h: "", p: [] }] })}
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-surface px-4 py-2 text-sm font-semibold text-ink-soft transition hover:text-terracotta"
            >
              <Plus size={15} /> {b.addSection}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={editing.is_published}
                onChange={(e) => patch({ is_published: e.target.checked })}
              />
              {b.publish}
            </label>
            <button
              onClick={save}
              disabled={saving || !editing.title.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-terracotta px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-terracotta-dark disabled:opacity-60"
            >
              {saving ? <Loader size={18} /> : <Save size={15} />}
              {saving ? t.common.saving : t.common.save}
            </button>
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-sage">
                <Check size={16} /> {t.data.rewards.saved}
              </span>
            )}
            <button
              onClick={() => setEditing(null)}
              className="ml-auto text-sm font-semibold text-ink-soft hover:text-terracotta"
            >
              {t.common.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
