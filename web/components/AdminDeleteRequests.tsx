"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Eye, EyeOff, RefreshCw, Trash2, X } from "lucide-react";

import Loader from "@/components/Loader";
import { useAdminT } from "@/lib/i18n/admin";

/**
 * Account delete requests — dekhna AUR poora karna.
 *
 * ⚠️ Pehle ye requests `contact_messages` me ek prefix ke saath padi rehti thi.
 * Admin unhe sirf padh sakta tha: na status, na koi action. Play Store ki
 * data-deletion shart ke liye request lena kaafi nahi hai — use poora karna bhi
 * padta hai.
 *
 * Do raaste, jaan-boojh ke alag rakhe gaye hain:
 *
 *   Hide (soft)  — data DB me rehta hai, par user side band. Wapas laaya ja
 *                  sakta hai. User aksar do din baad wapas aata hai.
 *   Delete (hard)— sab kuch sach me mit jaata hai. Wapas nahi aata.
 *
 * Aur delete dabane se PEHLE poora hisaab dikhta hai ("42 documents, 130
 * reminders, 8 files") — khaali Delete button par kisi ko bharosa nahi ho sakta.
 */

type Req = {
  id: string;
  user_id: string | null;
  name: string | null;
  email: string;
  reason: string | null;
  status: "pending" | "hidden" | "deleted" | "rejected";
  handled_at: string | null;
  note: string | null;
  removed: Record<string, number> | null;
  created_at: string;
};

type Profile = { deleted_at: string | null; email: string | null };
type InvItem = { table: string; col: string; label: string; count: number | null };
type Inventory = { items: InvItem[]; files: number };

export default function AdminDeleteRequests() {
  const t = useAdminT();
  const s = t.data.deleteRequests;

  const [rows, setRows] = useState<Req[] | null>(null);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  /** Khuli hui request ka poora hisaab. */
  const [openId, setOpenId] = useState<string | null>(null);
  const [inv, setInv] = useState<Inventory | null>(null);
  const [invLoading, setInvLoading] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/delete-requests", { cache: "no-store" });
      const body = (await res.json()) as {
        requests?: Req[];
        profiles?: Record<string, Profile>;
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setRows(body.requests ?? []);
      setProfiles(body.profiles ?? {});
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function openInventory(r: Req) {
    if (openId === r.id) {
      setOpenId(null);
      setInv(null);
      return;
    }
    setOpenId(r.id);
    setInv(null);
    if (!r.user_id) return; // bina login ke bhari gayi request
    setInvLoading(true);
    try {
      const res = await fetch("/api/admin/delete-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "inventory", user_id: r.user_id }),
      });
      const body = (await res.json()) as Inventory & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setInv(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "inventory failed");
    } finally {
      setInvLoading(false);
    }
  }

  async function act(r: Req, action: "hide" | "unhide" | "purge" | "reject") {
    if (action === "purge") {
      // ⚠️ Do baar poochte hain, aur doosri baar email likhwate hain. Ye kaam
      // wapas nahi hota — ek galat click par kisi ka poora data chala jaata hai.
      const typed = prompt(s.purgeConfirm.replace("{email}", r.email));
      if (typed?.trim().toLowerCase() !== r.email.toLowerCase()) return;
    } else if (action === "hide" && !confirm(s.hideConfirm)) {
      return;
    }

    setBusyId(r.id);
    setError("");
    try {
      const res = await fetch("/api/admin/delete-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, id: r.id, user_id: r.user_id }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setInv(null);
      setOpenId(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "action failed");
    } finally {
      setBusyId(null);
    }
  }

  if (rows === null) return <Loader />;

  const badge: Record<Req["status"], string> = {
    pending: "bg-amber-warm/20 text-amber-warm",
    hidden: "bg-sage/20 text-sage",
    deleted: "bg-terracotta/15 text-terracotta",
    rejected: "bg-cream-deep text-ink-soft",
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl text-ink">{s.title}</h2>
        <p className="mt-1 text-sm text-ink-soft">{s.sub}</p>
      </div>

      {!!error && (
        <div className="flex items-start gap-2 rounded-xl border border-terracotta/30 bg-terracotta/5 p-3 text-sm text-terracotta">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {rows.length === 0 && (
        <p className="rounded-2xl border border-line bg-surface p-6 text-sm text-ink-soft">
          {s.empty}
        </p>
      )}

      <div className="space-y-3">
        {rows.map((r) => {
          const prof = r.user_id ? profiles[r.user_id] : undefined;
          const isHidden = Boolean(prof?.deleted_at);
          const open = openId === r.id;
          return (
            <div key={r.id} className="rounded-2xl border border-line bg-surface">
              <button
                onClick={() => openInventory(r)}
                className="flex w-full flex-wrap items-center gap-3 p-4 text-left"
              >
                <span className={`rounded-lg px-2 py-1 text-xs font-bold ${badge[r.status]}`}>
                  {s.status[r.status]}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-ink">{r.name || "—"}</p>
                  <p className="truncate text-sm text-ink-soft">{r.email}</p>
                </div>
                <span className="ml-auto text-xs text-ink-soft">
                  {new Date(r.created_at).toLocaleDateString()}
                </span>
                {/* Bina user_id wali request — email se koi account nahi mila. */}
                {!r.user_id && (
                  <span className="rounded bg-cream-deep px-2 py-1 text-xs text-ink-soft">
                    {s.noAccount}
                  </span>
                )}
              </button>

              {open && (
                <div className="space-y-4 border-t border-line p-4">
                  {!!r.reason && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        {s.reason}
                      </p>
                      <p className="mt-1 text-sm text-ink">{r.reason}</p>
                    </div>
                  )}

                  {/* Purge ho chuka — ab ginti hi ekmatra saboot hai. */}
                  {r.status === "deleted" && r.removed && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        {s.removedTitle}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(r.removed).map(([k, v]) => (
                          <span
                            key={k}
                            className="rounded-lg bg-cream-deep px-2 py-1 text-xs text-ink"
                          >
                            {k}: <b>{v}</b>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Kya-kya delete hoga */}
                  {r.status !== "deleted" && r.user_id && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-soft">
                        {s.willDelete}
                      </p>
                      {invLoading && <Loader />}
                      {!!inv && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {inv.items
                            .filter((i) => (i.count ?? 0) > 0)
                            .map((i) => (
                              <span
                                key={`${i.table}.${i.col}`}
                                className="rounded-lg bg-cream-deep px-2 py-1 text-xs text-ink"
                              >
                                {i.label}: <b>{i.count}</b>
                              </span>
                            ))}
                          {inv.files > 0 && (
                            <span className="rounded-lg bg-cream-deep px-2 py-1 text-xs text-ink">
                              {s.files}: <b>{inv.files}</b>
                            </span>
                          )}
                          {inv.items.every((i) => !i.count) && inv.files === 0 && (
                            <span className="text-sm text-ink-soft">{s.nothingLeft}</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {!r.user_id && <p className="text-sm text-ink-soft">{s.noAccountHelp}</p>}

                  {/* Actions */}
                  {r.user_id && r.status !== "deleted" && (
                    <div className="flex flex-wrap items-center gap-2">
                      {isHidden ? (
                        <button
                          onClick={() => act(r, "unhide")}
                          disabled={busyId === r.id}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink hover:bg-cream-deep disabled:opacity-60"
                        >
                          <Eye className="h-4 w-4" /> {s.unhide}
                        </button>
                      ) : (
                        <button
                          onClick={() => act(r, "hide")}
                          disabled={busyId === r.id}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-ink px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                        >
                          <EyeOff className="h-4 w-4" /> {s.hide}
                        </button>
                      )}

                      <button
                        onClick={() => act(r, "purge")}
                        disabled={busyId === r.id}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-terracotta px-3 py-2 text-sm font-semibold text-white hover:bg-terracotta-dark disabled:opacity-60"
                      >
                        {busyId === r.id ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        {s.purge}
                      </button>

                      {r.status === "pending" && (
                        <button
                          onClick={() => act(r, "reject")}
                          disabled={busyId === r.id}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-cream-deep disabled:opacity-60"
                        >
                          <X className="h-4 w-4" /> {s.reject}
                        </button>
                      )}
                    </div>
                  )}

                  <p className="text-xs leading-relaxed text-ink-soft">{s.hideVsDelete}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
