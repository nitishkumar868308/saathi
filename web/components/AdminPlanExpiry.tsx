"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, Mail, RefreshCw, ShieldOff } from "lucide-react";

import Loader from "@/components/Loader";
import { useAdminT, atpl } from "@/lib/i18n/admin";

/**
 * "Plus khatam" — jinka Plus nikal chuka hai, unhe uski KHABAR dena.
 *
 * ⚠️ Ye section isliye bana ki downgrade ab apne aap hota hai
 * (`supabase/cron-plan-expiry.sql`) par user ko uski khabar kahin se milti hi
 * nahi thi. Uske liye wo bilkul aisa dikhta hai jaise app kharab ho gayi ho:
 * "mere documents kahan gaye", "reminder aana band kyun ho gaya" — jabki hua
 * kuch galat nahi tha.
 *
 * ⚠️ Bhejna JAAN-BOOJH KE ek click par hai, apne aap nahi. Ye paise wali baat
 * hai: ek galat samjha hua downgrade (Play ka webhook der se aaya, grant galat
 * lag gaya) par apne aap "aapka Plus khatam ho gaya" bhej dena bharosa seedha
 * todta hai — aur us email ko wapas nahi liya ja sakta. Admin pehle ginti dekh
 * leta hai, phir bhejta hai.
 *
 * Email aur notification dono user ki APNI chuni hui bhasha me jaate hain
 * (`profiles.language` — teen me se ek). Server hi wo chunav karta hai, isliye
 * admin ka apna panel kis bhasha me khula hai, usse koi farq nahi padta.
 */

type PlanExpiryUser = {
  id: string;
  email: string | null;
  name: string;
  language: "hinglish" | "hi" | "en";
  expiredAt: string | null;
  notifiedAt: string | null;
  documents: number;
  reminders: number;
  lockedDocuments: number;
  pausedReminders: number;
  hasDevice: boolean;
};

type Payload = {
  users: PlanExpiryUser[];
  offers: { freeDocuments: number; freeReminders: number };
  /** Firebase set hai ya nahi — na ho to notification wale button bekaar hain. */
  push: boolean;
};

const LANG_LABEL: Record<PlanExpiryUser["language"], string> = {
  hinglish: "Hinglish",
  hi: "हिंदी",
  en: "English",
};

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function AdminPlanExpiry() {
  const t = useAdminT();
  const d = t.data.planExpiry;

  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(true);
  /** Kis user par abhi kaam chal raha hai (id -> channel label). */
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/plan-expiry", { cache: "no-store" });
      const json = (await res.json()) as Payload;
      setData(res.ok ? json : { users: [], offers: { freeDocuments: 3, freeReminders: 5 }, push: false });
    } catch {
      setData({ users: [], offers: { freeDocuments: 3, freeReminders: 5 }, push: false });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function send(u: PlanExpiryUser, channels: ("email" | "push")[]) {
    /**
     * ⚠️ Dobara bhejne se pehle poochho.
     *
     * Ye button aur "bhej diya" wala nishaan pass-pass hain, aur ek galti se
     * lagi hui click us user ko wahi baat DOBARA bhej deti hai. Ek hi din me do
     * baar "aapka Plus khatam ho gaya" aana asli spam jaisa lagta hai — us pal
     * jab wo pehle hi thoda naraz hai.
     */
    if (u.notifiedAt && !window.confirm(d.confirmAgain)) return;

    setBusy(u.id);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/plan-expiry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: u.id, channels }),
      });
      const json = (await res.json()) as {
        email?: boolean;
        push?: number;
        errors?: string[];
        error?: string;
      };
      const wentOut = Boolean(json.email) || (json.push ?? 0) > 0;
      setMsg({
        id: u.id,
        // ⚠️ Aadha kaamyab bhi kaamyab hai (email chala gaya par phone
        // registered nahi tha), aur us soorat me wajah bhi saath dikhni chahiye
        // — warna admin ko lagta hai sab theek gaya.
        text: wentOut
          ? [d.sent, ...(json.errors ?? [])].join(" · ")
          : json.errors?.[0] ?? json.error ?? d.failed,
        ok: wentOut,
      });
      if (wentOut) await load();
    } catch {
      setMsg({ id: u.id, text: d.failed, ok: false });
    } finally {
      setBusy(null);
    }
  }

  if (loading) return <Loader />;

  const users = data?.users ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink-soft">{d.sub}</p>
        <button
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm font-semibold hover:bg-cream-deep/30"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* Firebase na ho to notification wale button chalenge hi nahi — pehle hi
          keh dena behtar hai. */}
      {data && !data.push && (
        <div className="flex items-start gap-2 rounded-xl border border-line bg-cream-deep/30 px-3 py-2 text-sm text-ink-soft">
          <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{d.pushOff}</span>
        </div>
      )}

      {users.length === 0 ? (
        <p className="rounded-2xl border border-line bg-cream-deep/20 px-4 py-6 text-center text-sm text-ink-soft">
          {d.empty}
        </p>
      ) : (
        <ul className="space-y-3">
          {users.map((u) => {
            const locked = u.lockedDocuments > 0 || u.pausedReminders > 0;
            const working = busy === u.id;
            return (
              <li key={u.id} className="rounded-2xl border border-line bg-white/60 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-ink">
                      {u.name || u.email || u.id.slice(0, 8)}
                    </div>
                    <div className="truncate text-sm text-ink-soft">{u.email ?? d.noEmail}</div>
                  </div>
                  <div className="text-right text-xs text-ink-soft">
                    <div>
                      {d.expired}: <b>{fmt(u.expiredAt)}</b>
                    </div>
                    <div className={u.notifiedAt ? "text-sage" : "text-terracotta"}>
                      {u.notifiedAt ? `${d.notified}: ${fmt(u.notifiedAt)}` : d.notNotified}
                    </div>
                    <div>
                      {d.lang}: {LANG_LABEL[u.language]}
                    </div>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-line bg-cream-deep/20 px-3 py-2 text-sm">
                  <div className="font-semibold text-ink">
                    {locked
                      ? atpl(d.lockedLine, {
                          locked: u.lockedDocuments,
                          paused: u.pausedReminders,
                        })
                      : d.nothingLocked}
                  </div>
                  <div className="text-xs text-ink-soft">
                    {atpl(d.totals, { docs: u.documents, reminders: u.reminders })}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    disabled={working || !u.email}
                    onClick={() => void send(u, ["email"])}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm font-semibold hover:bg-cream-deep/30 disabled:opacity-50"
                  >
                    <Mail className="h-4 w-4" />
                    {d.email}
                  </button>
                  <button
                    disabled={working || !u.hasDevice || !data?.push}
                    onClick={() => void send(u, ["push"])}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-sm font-semibold hover:bg-cream-deep/30 disabled:opacity-50"
                  >
                    <Bell className="h-4 w-4" />
                    {d.push}
                  </button>
                  <button
                    disabled={working || (!u.email && !u.hasDevice)}
                    onClick={() => void send(u, ["email", "push"])}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-terracotta px-3 py-1.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {working ? d.sending : d.both}
                  </button>

                  {/* Kyun band hai — button ke saath hi. Ek disabled button bina
                      wajah ke sirf uljhan deta hai. */}
                  {!u.email && <span className="text-xs text-ink-soft">{d.noEmail}</span>}
                  {!u.hasDevice && <span className="text-xs text-ink-soft">{d.noDevice}</span>}
                </div>

                {msg?.id === u.id && (
                  <p
                    className={`mt-2 text-sm font-semibold ${msg.ok ? "text-sage" : "text-terracotta"}`}
                  >
                    {msg.text}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
