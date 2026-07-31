"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Send,
  Users,
  UserX,
  ListChecks,
  Search,
  Mail,
  Smartphone,
  Layers,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
} from "lucide-react";
import Loader from "@/components/Loader";
import Pagination, { usePagination } from "@/components/admin/Pagination";
import AdminMessageReport from "@/components/AdminMessageReport";
import { useAdminT, atpl } from "@/lib/i18n/admin";

type Result = {
  audience: string;
  channel: Channel;
  total: number;
  sent: number;
  skipped: number;
  /** Push bheja ho to — kitne device, kitne par pahunchi. */
  push: { sent: number; failed: number; devices: number } | null;
};

/** Email, phone ki notification, ya dono. */
type Channel = "email" | "push" | "both";

type Recipient = {
  id: string;
  email: string | null;
  name: string | null;
  joinedAt: string | null;
  /** Kabhi ek reminder/document banaya? Warna "inactive". */
  active: boolean;
  /** Is user ka koi phone register hai? Push sirf inhi tak ja sakti hai. */
  hasDevice: boolean;
};

type Audience = "inactive" | "all" | "picked";

/**
 * Admin se users ko email — ab naam dekh ke, chun ke (item 8).
 *
 * ⚠️ Pehle yahan sirf do button the ("sab" / "inactive") aur mail seedha chala
 * jaata tha. Do dikkatein thi: admin ko pata hi nahi chalta tha ki kis-kis ko
 * jaayega, aur ek galat click par un logon ko bhi "wapas aa jao" wala mail
 * chala jaata tha jo app roz use kar rahe hain — sabse bhadda tajurba.
 *
 * Ab teesra vikalp hai: poori list, har naam ke saamne active/inactive ka tag,
 * aur checkbox. Jo chuna hai bas usi ko jaata hai.
 */
export default function AdminBroadcast() {
  const t = useAdminT();
  /**
   * Do tab: bhejna, aur bhejne ke BAAD ka hisaab.
   *
   * Report ko alag section (left nav me apna item) banane ke bajaye yahin rakha
   * hai — ye do kaam ek hi soch ke do hisse hain. Admin message bhejta hai aur
   * turant dekhna chahta hai ki uska kya hua; do alag jagah jaana padta to wo
   * dekhna hi nahi hota.
   */
  const [tab, setTab] = useState<"send" | "report">("send");

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex gap-2">
        <TabBtn active={tab === "send"} onClick={() => setTab("send")}>
          <Send size={15} /> {t.report.tabSend}
        </TabBtn>
        <TabBtn active={tab === "report"} onClick={() => setTab("report")}>
          <BarChart3 size={15} /> {t.report.tabReport}
        </TabBtn>
      </div>
      {tab === "send" ? <SendPanel /> : <AdminMessageReport />}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2.5 text-sm font-bold transition ${
        active
          ? "border-terracotta bg-terracotta/8 text-terracotta"
          : "border-line bg-surface text-ink-soft hover:border-terracotta/40"
      }`}
    >
      {children}
    </button>
  );
}

function SendPanel() {
  const t = useAdminT();
  const b = t.broadcast;
  const [audience, setAudience] = useState<Audience>("inactive");
  const [channel, setChannel] = useState<Channel>("email");
  /**
   * Firebase set hai ya nahi.
   *
   * `null` = abhi pata nahi (list load nahi hui). Jab tak pata na ho tab tak
   * push wale button ko band dikhana galat hoga — admin ko lagega ki feature hai
   * hi nahi. Isliye list ke saath hi ye bhi aata hai.
   */
  const [pushReady, setPushReady] = useState<boolean | null>(null);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  /* ------------------------------ list ------------------------------ */

  const [users, setUsers] = useState<Recipient[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [query, setQuery] = useState("");
  const [onlyInactive, setOnlyInactive] = useState(false);

  // Ek hi baar, screen khulte hi. Sirf list ke liye nahi — isi jawab se pata
  // chalta hai ki Firebase set hai ya nahi, aur wo channel wale buttons ke liye
  // turant chahiye (list se pehle).
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/notify", { cache: "no-store" });
        const body = (await res.json()) as {
          users?: Recipient[];
          pushReady?: boolean;
          error?: string;
        };
        if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
        if (!alive) return;
        setUsers(body.users ?? []);
        setPushReady(!!body.pushReady);
      } catch {
        if (alive) {
          setListError(b.listFailed);
          setPushReady(false);
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [b.listFailed]);

  const filtered = useMemo(() => {
    const list = users ?? [];
    const q = query.trim().toLowerCase();
    return list.filter((u) => {
      if (onlyInactive && u.active) return false;
      if (!q) return true;
      return (
        (u.email ?? "").toLowerCase().includes(q) ||
        (u.name ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, query, onlyInactive]);

  // Filter badle to page 1 pe — warna admin ko khaali page dikhta hai.
  const pg = usePagination(filtered, 10, `${query}|${onlyInactive}`);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  /** "Sab chuno" sirf JO ABHI DIKH RAHE HAIN un par — filter ka matlab hi yahi hai. */
  function selectAllShown() {
    setPicked((prev) => {
      const next = new Set(prev);
      filtered.forEach((u) => next.add(u.id));
      return next;
    });
  }

  /* ------------------------------ send ------------------------------ */

  const needsPick = audience === "picked";

  /**
   * Push kitno tak pahunchegi.
   *
   * ⚠️ Ye ginti bhejne se PEHLE dikhani zaroori hai. Warna admin "dono" chun ke
   * bhejta hai, email chala jaata hai, notification kahin nahi jaati, aur uska
   * karan sirf bhejne ke BAAD wale ek line me pata chalta hai.
   */
  const withApp = useMemo(
    () => (users ?? []).filter((u) => u.hasDevice).length,
    [users],
  );
  const pickedWithApp = useMemo(
    () => (users ?? []).filter((u) => picked.has(u.id) && u.hasDevice).length,
    [users, picked],
  );
  const wantsPush = channel !== "email";
  const noDeviceWarning =
    wantsPush &&
    users !== null &&
    (needsPick ? picked.size > 0 && pickedWithApp === 0 : withApp === 0);

  const canSend =
    subject.trim().length > 0 &&
    message.trim().length > 0 &&
    !sending &&
    (!needsPick || picked.size > 0);

  async function send() {
    if (!canSend) return;
    setSending(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/notify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          subject,
          message,
          channel,
          // "picked" me audience ka koi matlab nahi — server bhi userIds aate hi
          // usse ignore kar deta hai. Bhejte hain sirf saaf-saaf rehne ke liye.
          audience: needsPick ? "all" : audience,
          ...(needsPick ? { userIds: Array.from(picked) } : {}),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data as Result);
        setSubject("");
        setMessage("");
        setPicked(new Set());
      } else {
        setError(data?.error ?? b.errGeneric);
      }
    } catch {
      setError(b.network);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
        {/* Audience */}
        <label className="mb-2 block text-sm font-semibold text-ink">{b.whoTitle}</label>
        <div className="grid gap-3 sm:grid-cols-3">
          <AudienceBtn
            active={audience === "inactive"}
            onClick={() => setAudience("inactive")}
            icon={<UserX size={17} />}
            label={b.inactive}
          />
          <AudienceBtn
            active={audience === "all"}
            onClick={() => setAudience("all")}
            icon={<Users size={17} />}
            label={b.all}
          />
          <AudienceBtn
            active={audience === "picked"}
            onClick={() => setAudience("picked")}
            icon={<ListChecks size={17} />}
            label={b.picked}
          />
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          {audience === "inactive"
            ? b.inactiveHint
            : audience === "all"
              ? b.allHint
              : b.pickedHint}
        </p>

        {/* Recipient list — sirf "khud chuno" me */}
        {needsPick && (
          <div className="mt-4 rounded-2xl border border-line bg-cream/30 p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-wider text-ink-soft">
                {b.listTitle}
              </p>
              <span className="rounded-full bg-terracotta/10 px-2.5 py-1 text-xs font-bold text-terracotta">
                {atpl(b.selectedN, { n: picked.size })}
              </span>
            </div>

            {/* Search + filter */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div className="relative min-w-[200px] flex-1">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft"
                />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={b.searchPh}
                  className="w-full rounded-xl border border-line bg-surface py-2 pl-9 pr-3 text-sm text-ink outline-none focus:border-terracotta"
                />
              </div>
              <button
                type="button"
                onClick={() => setOnlyInactive((v) => !v)}
                className={`rounded-xl border px-3 py-2 text-xs font-semibold transition ${
                  onlyInactive
                    ? "border-terracotta bg-terracotta/8 text-terracotta"
                    : "border-line bg-surface text-ink-soft hover:border-terracotta/40"
                }`}
              >
                {b.onlyInactive}
              </button>
              <button
                type="button"
                onClick={selectAllShown}
                className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink-soft transition hover:border-terracotta/40 hover:text-ink"
              >
                {b.selectAll}
              </button>
              <button
                type="button"
                onClick={() => setPicked(new Set())}
                disabled={picked.size === 0}
                className="rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink-soft transition hover:border-terracotta/40 hover:text-ink disabled:opacity-40"
              >
                {b.clearAll}
              </button>
            </div>

            {/* Rows */}
            {listError ? (
              <p className="mt-4 text-sm text-terracotta-dark">{listError}</p>
            ) : users === null ? (
              <div className="flex justify-center py-6">
                <Loader size={36} />
              </div>
            ) : filtered.length === 0 ? (
              <p className="mt-4 rounded-xl border border-line bg-surface px-4 py-5 text-center text-sm text-ink-soft">
                {b.noMatch.trim()}
              </p>
            ) : (
              <>
                <ul className="mt-3 space-y-1.5">
                  {pg.pageItems.map((u) => {
                    const on = picked.has(u.id);
                    return (
                      <li key={u.id}>
                        <label
                          className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 transition ${
                            on
                              ? "border-terracotta bg-terracotta/[0.06]"
                              : "border-line bg-surface hover:border-terracotta/30"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={on}
                            onChange={() => toggle(u.id)}
                            className="h-4 w-4 shrink-0 accent-[#C25A37]"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold text-ink">
                              {u.name || u.email}
                            </span>
                            {!!u.name && (
                              <span className="block truncate text-xs text-ink-soft">
                                {u.email}
                              </span>
                            )}
                          </span>
                          {/* App hai ya nahi — push isi par tiki hai. */}
                          <span
                            title={u.hasDevice ? b.hasApp : b.noApp}
                            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              u.hasDevice
                                ? "bg-terracotta/10 text-terracotta"
                                : "bg-cream-deep text-ink-soft"
                            }`}
                          >
                            <Smartphone size={11} />
                            {u.hasDevice ? b.hasApp : b.noApp}
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                              u.active
                                ? "bg-sage/15 text-sage"
                                : "bg-amber-warm/20 text-terracotta-dark"
                            }`}
                          >
                            {u.active ? b.activeTag : b.inactiveTag}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <div className="mt-3">
                  <Pagination
                    page={pg.page}
                    pageCount={pg.pageCount}
                    total={pg.total}
                    from={pg.from}
                    to={pg.to}
                    onPage={pg.setPage}
                    label={b.users}
                  />
                </div>
              </>
            )}
          </div>
        )}

        {/* Channel — email, phone ki notification, ya dono.
            Push tabhi chun sakte hain jab Firebase set ho; warna button band
            rehta hai aur neeche saaf likha aata hai ki karna kya hai. */}
        <label className="mb-2 mt-5 block text-sm font-semibold text-ink">
          {b.channelTitle}
        </label>
        <div className="grid gap-3 sm:grid-cols-3">
          <AudienceBtn
            active={channel === "email"}
            onClick={() => setChannel("email")}
            icon={<Mail size={17} />}
            label={b.chEmail}
          />
          <AudienceBtn
            active={channel === "push"}
            onClick={() => setChannel("push")}
            icon={<Smartphone size={17} />}
            label={b.chPush}
            disabled={pushReady === false}
          />
          <AudienceBtn
            active={channel === "both"}
            onClick={() => setChannel("both")}
            icon={<Layers size={17} />}
            label={b.chBoth}
            disabled={pushReady === false}
          />
        </div>
        {pushReady === false && (
          <p className="mt-2 text-xs font-semibold text-terracotta-dark">{b.pushOff}</p>
        )}
        {pushReady !== false && users !== null && (
          <p className="mt-2 text-xs text-ink-soft">
            {atpl(b.devicesSummary, { withApp, total: users.length })}
          </p>
        )}
        {noDeviceWarning && (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs font-semibold text-terracotta-dark">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            {b.pushNoDevices}
          </p>
        )}

        {/* Subject */}
        <label className="mb-2 mt-5 block text-sm font-semibold text-ink">{b.subject}</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder={b.subjectPh}
          className="w-full rounded-2xl border border-line bg-cream/40 px-4 py-3 text-sm text-ink outline-none focus:border-terracotta"
        />

        {/* Message */}
        <label className="mb-2 mt-5 block text-sm font-semibold text-ink">{b.message}</label>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={6}
          placeholder={b.messagePh}
          className="w-full resize-y rounded-2xl border border-line bg-cream/40 px-4 py-3 text-sm leading-relaxed text-ink outline-none focus:border-terracotta"
        />
        <p className="mt-2 text-xs text-ink-soft">{b.note}</p>

        {needsPick && picked.size === 0 && (
          <p className="mt-2 text-xs font-semibold text-terracotta-dark">{b.noneSelected}</p>
        )}

        <button
          type="button"
          onClick={send}
          disabled={!canSend}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-terracotta px-5 py-3.5 text-sm font-bold text-white transition hover:bg-terracotta-dark disabled:opacity-50"
        >
          {sending ? <Loader size={22} /> : <Send size={16} />}
          {sending ? b.sending : b.send}
        </button>
      </div>

      {result && (
        <div className="flex items-start gap-3 rounded-2xl border border-sage/40 bg-sage/10 p-4 text-sm text-ink">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-sage" />
          <div className="space-y-1">
            {result.channel !== "push" && (
              <p>
                {atpl(b.doneN, {
                  sent: result.sent,
                  skipped: result.skipped ? ` · ${result.skipped} skip` : "",
                  total: result.total,
                })}
                {result.total === 0 && b.noMatch}
              </p>
            )}
            {/* Push ka apna hisaab: users nahi, DEVICES ginte hain — ek user ke
                do phone ho sakte hain, aur kai ne app install hi nahi ki. */}
            {!!result.push && (
              <p>
                {result.push.devices === 0
                  ? b.pushNone
                  : atpl(b.pushDone, {
                      sent: result.push.sent,
                      devices: result.push.devices,
                    })}
              </p>
            )}
          </div>
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

function AudienceBtn({
  active,
  onClick,
  icon,
  label,
  disabled = false,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45 ${
        active
          ? "border-terracotta bg-terracotta/8 text-terracotta"
          : "border-line bg-surface text-ink-soft hover:border-terracotta/40"
      }`}
    >
      {icon} {label}
    </button>
  );
}
