"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  FileText,
  Search,
  Eye,
  HardDrive,
  Users,
  Download,
  Loader2,
  ExternalLink,
  FolderOpen,
} from "lucide-react";
import { SkeletonRows } from "@/components/Loader";
import Modal from "@/components/admin/Modal";
import Pagination, { usePagination } from "@/components/admin/Pagination";

type Doc = {
  id: string;
  name: string;
  type: string;
  expiry: string | null;
  summary: string | null;
  fileSize: number | null;
  filePath: string | null;
  mimeType: string | null;
  inStorage: boolean;
  createdAt: string;
  userId: string | null;
  userEmail: string | null;
  userName: string | null;
};

const RANGES = [
  { key: "today", label: "Aaj" },
  { key: "yesterday", label: "Kal" },
  { key: "7", label: "7 din" },
  { key: "30", label: "30 din" },
  { key: "all", label: "Sab" },
] as const;
type RangeKey = (typeof RANGES)[number]["key"];

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function fmtBytes(n: number | null): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminDocuments() {
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState("");
  const [range, setRange] = useState<RangeKey>("all");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [view, setView] = useState<"all" | "byUser">("all");
  const [preview, setPreview] = useState<Doc | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/admin/documents?range=${range}`, { cache: "no-store" });
      const body = (await res.json()) as { rows?: Doc[]; total?: number; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setDocs(body.rows ?? []);
      setTotal(body.total ?? body.rows?.length ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Documents load nahi hue");
      setDocs([]);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  const types = useMemo(() => {
    const set = new Set<string>();
    (docs ?? []).forEach((d) => d.type && set.add(d.type));
    return Array.from(set).sort();
  }, [docs]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (docs ?? []).filter((d) => {
      if (typeFilter !== "all" && d.type !== typeFilter) return false;
      if (!q) return true;
      return (
        d.name.toLowerCase().includes(q) ||
        (d.userName ?? "").toLowerCase().includes(q) ||
        (d.userEmail ?? "").toLowerCase().includes(q)
      );
    });
  }, [docs, query, typeFilter]);

  const stats = useMemo(() => {
    const list = docs ?? [];
    const uploaders = new Set(list.map((d) => d.userId).filter(Boolean));
    return {
      total: list.length,
      inStorage: list.filter((d) => d.inStorage).length,
      uploaders: uploaders.size,
      bytes: list.reduce((s, d) => s + (d.fileSize ?? 0), 0),
    };
  }, [docs]);

  // Kisne kitna + kab (user-wise) — client-side group.
  const byUser = useMemo(() => {
    const map = new Map<
      string,
      { name: string | null; email: string | null; count: number; bytes: number; latest: string }
    >();
    for (const d of docs ?? []) {
      const key = d.userId ?? d.userEmail ?? "unknown";
      const cur = map.get(key);
      if (!cur) {
        map.set(key, {
          name: d.userName,
          email: d.userEmail,
          count: 1,
          bytes: d.fileSize ?? 0,
          latest: d.createdAt,
        });
      } else {
        cur.count += 1;
        cur.bytes += d.fileSize ?? 0;
        if (d.createdAt > cur.latest) cur.latest = d.createdAt;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [docs]);

  const pager = usePagination(filtered, 10, `${query}|${typeFilter}|${range}`);
  const userPager = usePagination(byUser, 10, range);

  if (!docs) return <SkeletonRows rows={6} />;

  return (
    <div className="space-y-5">
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-terracotta/30 bg-terracotta/10 p-4">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-terracotta-dark" />
          <p className="text-sm leading-relaxed text-terracotta-dark">{error}</p>
        </div>
      )}

      {/* Range */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex rounded-2xl border border-line bg-surface p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`h-9 rounded-xl px-3 text-xs font-semibold transition ${
                range === r.key ? "bg-terracotta text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex rounded-2xl border border-line bg-surface p-1">
          {(["all", "byUser"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`h-9 rounded-xl px-3 text-xs font-semibold transition ${
                view === v ? "bg-terracotta text-white" : "text-ink-soft hover:text-ink"
              }`}
            >
              {v === "all" ? "Saare" : "User-wise"}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <Stat icon={FileText} label="Documents" value={String(stats.total)} />
        <Stat icon={HardDrive} label="Storage me" value={String(stats.inStorage)} />
        <Stat icon={Users} label="Uploaders" value={String(stats.uploaders)} />
        <Stat icon={FolderOpen} label="Total size" value={fmtBytes(stats.bytes)} />
      </div>

      {view === "all" ? (
        <>
          {/* Search + type filter */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search
                size={16}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-soft"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Document, naam ya email..."
                className="h-11 w-full rounded-2xl border border-line bg-surface pl-10 pr-4 text-sm outline-none transition focus:border-terracotta focus:ring-4 focus:ring-terracotta/15"
              />
            </div>
            {types.length > 0 && (
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-11 rounded-2xl border border-line bg-surface px-3 text-sm font-semibold text-ink-soft outline-none focus:border-terracotta"
              >
                <option value="all">Sab type</option>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}
          </div>

          {!filtered.length ? (
            <Empty label="Is filter me koi document nahi." />
          ) : (
            <>
              <div className="overflow-x-auto rounded-3xl border border-line bg-surface shadow-soft">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="border-b border-line bg-cream-deep/25 text-xs uppercase tracking-wider text-ink-soft">
                    <tr>
                      <th className="px-4 py-3 font-semibold">User</th>
                      <th className="px-4 py-3 font-semibold">Document</th>
                      <th className="px-4 py-3 font-semibold">Kab upload</th>
                      <th className="px-4 py-3 font-semibold">Size</th>
                      <th className="px-4 py-3 font-semibold">Storage</th>
                      <th className="px-4 py-3 text-right font-semibold">Dekho</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pager.pageItems.map((d) => (
                      <tr key={d.id} className="border-b border-line/60 transition hover:bg-cream-deep/20">
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-ink">{d.userName || "—"}</p>
                          <p className="text-xs text-ink-soft">{d.userEmail ?? "—"}</p>
                        </td>
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-ink">{d.name || "—"}</p>
                          <p className="text-xs text-ink-soft">{d.type || "—"}</p>
                        </td>
                        <td className="px-4 py-3.5 text-ink-soft">{fmtDateTime(d.createdAt)}</td>
                        <td className="px-4 py-3.5 text-ink-soft">{fmtBytes(d.fileSize)}</td>
                        <td className="px-4 py-3.5">
                          {d.inStorage ? (
                            <span className="inline-flex items-center rounded-full bg-sage/15 px-2.5 py-1 text-xs font-bold text-sage">
                              Storage me
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-ink/10 px-2.5 py-1 text-xs font-bold text-ink-soft">
                              Sirf device
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            onClick={() => setPreview(d)}
                            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-semibold text-ink-soft transition hover:text-terracotta"
                          >
                            <Eye size={14} />
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={pager.page}
                pageCount={pager.pageCount}
                total={pager.total}
                from={pager.from}
                to={pager.to}
                onPage={pager.setPage}
                label="documents"
              />
            </>
          )}
        </>
      ) : (
        <>
          {!byUser.length ? (
            <Empty label="Abhi kisi ne document upload nahi kiya." />
          ) : (
            <>
              <div className="grid gap-2.5 sm:grid-cols-2">
                {userPager.pageItems.map((u, i) => (
                  <button
                    key={(u.email ?? "") + i}
                    onClick={() => {
                      setQuery(u.email ?? u.name ?? "");
                      setView("all");
                    }}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 text-left shadow-soft transition hover:shadow-warm"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-ink">{u.name || u.email || "—"}</p>
                      <p className="truncate text-xs text-ink-soft">
                        {u.email ?? "—"} · aakhri {fmtDateTime(u.latest)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-display text-xl font-bold text-terracotta">{u.count}</p>
                      <p className="text-[11px] text-ink-soft">{fmtBytes(u.bytes)}</p>
                    </div>
                  </button>
                ))}
              </div>
              <Pagination
                page={userPager.page}
                pageCount={userPager.pageCount}
                total={userPager.total}
                from={userPager.from}
                to={userPager.to}
                onPage={userPager.setPage}
                label="users"
              />
            </>
          )}
        </>
      )}

      <p className="text-xs text-ink-soft">
        Total {total} documents (naye 500 tak load hote hain). File preview short-lived signed link se
        khulta hai — sirf tumhe (admin) dikhta hai.
      </p>

      <DocPreview doc={preview} onClose={() => setPreview(null)} />
    </div>
  );
}

/* ------------------------------ preview modal ----------------------------- */

function DocPreview({ doc, onClose }: { doc: Doc | null; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setUrl(null);
    setMsg("");
    if (!doc || !doc.inStorage || !doc.filePath) {
      setState("idle");
      return;
    }
    let alive = true;
    setState("loading");
    fetch(`/api/admin/documents/signed-url?path=${encodeURIComponent(doc.filePath)}`, {
      cache: "no-store",
    })
      .then(async (r) => {
        const b = (await r.json()) as { url?: string; error?: string };
        if (!r.ok) throw new Error(b.error ?? `HTTP ${r.status}`);
        if (alive) {
          setUrl(b.url ?? null);
          setState("idle");
        }
      })
      .catch((e) => {
        if (alive) {
          setState("error");
          setMsg(e instanceof Error ? e.message : "load fail");
        }
      });
    return () => {
      alive = false;
    };
  }, [doc]);

  if (!doc) return null;

  const isPdf =
    doc.mimeType === "application/pdf" || (doc.filePath ?? "").toLowerCase().endsWith(".pdf");

  return (
    <Modal
      open={!!doc}
      onClose={onClose}
      title={doc.name || "Document"}
      subtitle={`${doc.userName || doc.userEmail || "—"} · ${fmtDateTime(doc.createdAt)}`}
      size="lg"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <code className="max-w-full truncate rounded-lg bg-cream-deep/40 px-2 py-1 text-xs text-ink-soft">
            {doc.filePath ?? "storage me nahi"}
          </code>
          {url && (
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl bg-terracotta px-4 text-sm font-semibold text-white transition hover:bg-terracotta-dark"
            >
              <ExternalLink size={14} />
              Naye tab me
            </a>
          )}
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <Meta label="Type" value={doc.type || "—"} />
          <Meta label="Size" value={fmtBytes(doc.fileSize)} />
          <Meta label="Expiry" value={doc.expiry ? fmtDateTime(doc.expiry) : "—"} />
          <Meta label="Storage" value={doc.inStorage ? "Haan" : "Nahi"} />
        </div>

        {doc.summary && (
          <div className="rounded-2xl border border-line bg-cream-deep/20 p-3">
            <p className="text-[11px] uppercase tracking-wide text-ink-soft">AI ne kya samjha</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-ink">
              {doc.summary}
            </p>
          </div>
        )}

        {!doc.inStorage || !doc.filePath ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-line bg-cream-deep/20 py-12 text-center">
            <Download size={22} className="text-ink-soft" />
            <p className="text-sm text-ink-soft">
              Ye document sirf user ke device pe hai — storage me upload nahi hua, isliye preview nahi.
            </p>
          </div>
        ) : state === "loading" ? (
          <div className="flex items-center justify-center gap-2 py-16 text-ink-soft">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Preview la rahe hain...</span>
          </div>
        ) : state === "error" ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-terracotta/30 bg-terracotta/10 py-12 text-center">
            <AlertTriangle size={20} className="text-terracotta-dark" />
            <p className="text-sm text-terracotta-dark">{msg || "Preview load nahi hua."}</p>
          </div>
        ) : url ? (
          isPdf ? (
            <iframe
              src={url}
              title={doc.name}
              className="h-[60vh] w-full rounded-2xl border border-line bg-white"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={doc.name}
              className="mx-auto max-h-[60vh] w-auto rounded-2xl border border-line object-contain"
            />
          )
        ) : null}
      </div>
    </Modal>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-ink-soft">{label}</p>
      <p className="mt-0.5 truncate font-semibold text-ink">{value}</p>
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof FileText;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-3.5 shadow-soft sm:p-4">
      <Icon size={16} className="text-terracotta" />
      <p className="mt-2 font-display text-xl font-bold text-ink">{value}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-ink-soft sm:text-xs">{label}</p>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-line bg-surface py-16 text-center shadow-soft">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cream-deep/50 text-ink-soft">
        <FileText size={24} />
      </span>
      <p className="text-sm text-ink-soft">{label}</p>
    </div>
  );
}
