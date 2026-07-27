"use client";

import { useState } from "react";
import { Send, Users, UserX, CheckCircle2, AlertTriangle } from "lucide-react";
import Loader from "@/components/Loader";
import { useAdminT, atpl } from "@/lib/i18n/admin";

type Result = { audience: string; total: number; sent: number; skipped: number };

export default function AdminBroadcast() {
  const t = useAdminT();
  const [audience, setAudience] = useState<"all" | "inactive">("inactive");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canSend = subject.trim().length > 0 && message.trim().length > 0 && !sending;

  async function send() {
    if (!canSend) return;
    setSending(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ subject, message, audience }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data as Result);
        setSubject("");
        setMessage("");
      } else {
        setError(data?.error ?? t.broadcast.errGeneric);
      }
    } catch {
      setError(t.broadcast.network);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
        {/* Audience */}
        <label className="mb-2 block text-sm font-semibold text-ink">{t.broadcast.whoTitle}</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setAudience("inactive")}
            className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              audience === "inactive"
                ? "border-terracotta bg-terracotta/8 text-terracotta"
                : "border-line bg-surface text-ink-soft hover:border-terracotta/40"
            }`}
          >
            <UserX size={17} /> {t.broadcast.inactive}
          </button>
          <button
            type="button"
            onClick={() => setAudience("all")}
            className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${
              audience === "all"
                ? "border-terracotta bg-terracotta/8 text-terracotta"
                : "border-line bg-surface text-ink-soft hover:border-terracotta/40"
            }`}
          >
            <Users size={17} /> {t.broadcast.all}
          </button>
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          {audience === "inactive" ? t.broadcast.inactiveHint : t.broadcast.allHint}
        </p>

        {/* Subject */}
        <label className="mb-2 mt-5 block text-sm font-semibold text-ink">{t.broadcast.subject}</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={t.broadcast.subjectPh}
          className="w-full rounded-2xl border border-line bg-cream/40 px-4 py-3 text-sm text-ink outline-none focus:border-terracotta"
        />

        {/* Message */}
        <label className="mb-2 mt-5 block text-sm font-semibold text-ink">{t.broadcast.message}</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          placeholder={t.broadcast.messagePh}
          className="w-full resize-y rounded-2xl border border-line bg-cream/40 px-4 py-3 text-sm leading-relaxed text-ink outline-none focus:border-terracotta"
        />
        <p className="mt-2 text-xs text-ink-soft">{t.broadcast.note}</p>

        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-terracotta px-5 py-3.5 text-sm font-bold text-white transition hover:bg-terracotta-dark disabled:opacity-50"
        >
          {sending ? <Loader size={22} /> : <Send size={16} />}
          {sending ? t.broadcast.sending : t.broadcast.send}
        </button>
      </div>

      {result && (
        <div className="flex items-start gap-3 rounded-2xl border border-sage/40 bg-sage/10 p-4 text-sm text-ink">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-sage" />
          <span>
            {atpl(t.broadcast.doneN, {
              sent: result.sent,
              skipped: result.skipped ? ` · ${result.skipped} skip` : "",
              total: result.total,
            })}
            {result.total === 0 && t.broadcast.noMatch}
          </span>
        </div>
      )}
      {error && (
        <div className="flex items-start gap-3 rounded-2xl border border-terracotta/40 bg-terracotta/10 p-4 text-sm text-terracotta-dark">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
