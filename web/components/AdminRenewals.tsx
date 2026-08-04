"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Check, Globe, Languages, Plus, RefreshCw, Save, Trash2 } from "lucide-react";

import Loader from "@/components/Loader";
import { useAdminT } from "@/lib/i18n/admin";

/**
 * "Ye document renew kaise karein" — har desh ke liye.
 *
 * User ko sirf ye batana kaafi nahi ki document expire ho raha hai; uske baad ka
 * sawaal hamesha "ab karun kya?" hota hai. Ye editor usi ka jawab rakhta hai.
 *
 * ⚠️ Do parat, aur yahi sabse zaroori baat hai:
 *
 *   country = '*'      har desh ke liye — safety net, HAMESHA rehti hai
 *   country = 'IN'/... us desh ka apna content — jab bane, tab '*' ko hara deta hai
 *
 * App 190+ deshon me chalti hai. Har desh ka content kabhi nahi banega, par
 * jawab har user ko milna chahiye. Isliye '*' wali rows delete nahi ho sakti
 * (API bhi rokta hai) — sirf badli ja sakti hain.
 */

type Text = { title: string; steps: string[]; note?: string | null };
type Guide = {
  doc_type: string;
  country: string;
  url: string | null;
  authority: string | null;
  content: Record<string, Text>;
  reviewed: boolean;
  updated_at?: string;
};

type Loc = "hinglish" | "hi" | "en";
const LOCALES: Loc[] = ["hinglish", "hi", "en"];

/** documents.type — app me yahi saat hote hain. */
const DOC_TYPES = ["car", "license", "passport", "fastag", "warranty", "health", "other"];

const inputCls =
  "mt-1.5 w-full rounded-xl border border-line bg-cream-deep/20 px-3 py-2 text-sm outline-none focus:border-terracotta";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-ink-soft";

function emptyText(): Text {
  return { title: "", steps: [""], note: "" };
}

export default function AdminRenewals() {
  const t = useAdminT();
  const s = t.data.renewals;

  const [guides, setGuides] = useState<Guide[] | null>(null);
  const [translateOn, setTranslateOn] = useState(false);
  const [error, setError] = useState("");
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  /** Kaunsi row khuli hai. Sab ek saath khuli rakhna padhne layak nahi rehta. */
  const [openKey, setOpenKey] = useState<string | null>(null);
  /** Editor kis bhasha me likh raha hai. */
  const [editLoc, setEditLoc] = useState<Loc>("hinglish");
  /** Khuli row ka draft. */
  const [draft, setDraft] = useState<Guide | null>(null);
  const [doTranslate, setDoTranslate] = useState(true);

  const [newType, setNewType] = useState(DOC_TYPES[0]);
  const [newCountry, setNewCountry] = useState("");

  const keyOf = (g: Pick<Guide, "doc_type" | "country">) => `${g.doc_type}:${g.country}`;

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/renewals", { cache: "no-store" });
      const body = (await res.json()) as { guides?: Guide[]; translateOn?: boolean; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setGuides(body.guides ?? []);
      setTranslateOn(Boolean(body.translateOn));
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
      setGuides([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * '*' wali rows sabse upar — wahi sabse zyada users ko dikhti hain, isliye
   * unka theek hona sabse zyada maayne rakhta hai.
   */
  const sorted = useMemo(() => {
    return [...(guides ?? [])].sort((a, b) => {
      if (a.country === "*" && b.country !== "*") return -1;
      if (b.country === "*" && a.country !== "*") return 1;
      if (a.doc_type !== b.doc_type) return a.doc_type.localeCompare(b.doc_type);
      return a.country.localeCompare(b.country);
    });
  }, [guides]);

  /** Kitne doc_type ke paas '*' wala fallback hai — ek bhi missing ho to warning. */
  const missingGlobal = useMemo(() => {
    const have = new Set((guides ?? []).filter((g) => g.country === "*").map((g) => g.doc_type));
    return DOC_TYPES.filter((d) => !have.has(d));
  }, [guides]);

  function openEditor(g: Guide) {
    const k = keyOf(g);
    if (openKey === k) {
      setOpenKey(null);
      setDraft(null);
      return;
    }
    setOpenKey(k);
    setDraft(JSON.parse(JSON.stringify(g)) as Guide);
    // Jo bhasha pehle se bhari hai wahi kholo — warna editor khaali dikhta hai.
    const first = LOCALES.find((l) => g.content?.[l]?.title) ?? "hinglish";
    setEditLoc(first);
  }

  function draftText(): Text {
    return draft?.content?.[editLoc] ?? emptyText();
  }

  function setDraftText(next: Partial<Text>) {
    setDraft((d) => {
      if (!d) return d;
      const cur = d.content?.[editLoc] ?? emptyText();
      return { ...d, content: { ...d.content, [editLoc]: { ...cur, ...next } } };
    });
  }

  async function save(g: Guide) {
    const k = keyOf(g);
    setSavingKey(k);
    setError("");
    try {
      const res = await fetch("/api/admin/renewals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          doc_type: g.doc_type,
          country: g.country,
          url: g.url,
          authority: g.authority,
          source_locale: editLoc,
          text: g.content?.[editLoc],
          existing_content: g.content,
          translate: doTranslate && translateOn,
        }),
      });
      const body = (await res.json()) as { guide?: Guide; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setSavedKey(k);
      setTimeout(() => setSavedKey(null), 2000);
      await load();
      // Save ke baad naya content (anuvaad samet) editor me bhi dikhna chahiye.
      if (body.guide) setDraft(JSON.parse(JSON.stringify(body.guide)) as Guide);
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
    } finally {
      setSavingKey(null);
    }
  }

  async function remove(g: Guide) {
    if (!confirm(s.deleteAsk)) return;
    setError("");
    try {
      const res = await fetch(
        `/api/admin/renewals?doc_type=${encodeURIComponent(g.doc_type)}&country=${encodeURIComponent(g.country)}`,
        { method: "DELETE" },
      );
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      if (openKey === keyOf(g)) {
        setOpenKey(null);
        setDraft(null);
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
    }
  }

  function addNew() {
    const c = newCountry.trim().toUpperCase();
    if (!/^[A-Z]{2}$/.test(c)) {
      setError(s.countryFormat);
      return;
    }
    if ((guides ?? []).some((g) => g.doc_type === newType && g.country === c)) {
      setError(s.alreadyExists);
      return;
    }
    const fresh: Guide = {
      doc_type: newType,
      country: c,
      url: null,
      authority: null,
      content: { hinglish: emptyText() },
      reviewed: true,
    };
    setGuides((list) => [...(list ?? []), fresh]);
    setNewCountry("");
    setError("");
    openEditor(fresh);
  }

  if (guides === null) return <Loader />;

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

      {/* ⚠️ Ye warning sabse zaroori hai: '*' row na hone ka matlab hai ki us
          document type par un saare deshon me KUCH bhi nahi dikhega jinka apna
          content nahi bana. */}
      {missingGlobal.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-warm/40 bg-amber-warm/10 p-3 text-sm text-ink">
          <Globe className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{s.missingGlobal.replace("{types}", missingGlobal.join(", "))}</span>
        </div>
      )}

      {/* Naya desh jodo */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-line bg-surface p-4">
        <div>
          <label className={labelCls}>{s.docType}</label>
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value)}
            className={inputCls}
          >
            {DOC_TYPES.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>{s.country}</label>
          <input
            value={newCountry}
            onChange={(e) => setNewCountry(e.target.value.toUpperCase().slice(0, 2))}
            placeholder="US"
            className={`${inputCls} w-24 uppercase`}
          />
        </div>
        <button
          onClick={addNew}
          className="mb-0.5 inline-flex items-center gap-1.5 rounded-xl bg-terracotta px-4 py-2 text-sm font-semibold text-white hover:bg-terracotta-dark"
        >
          <Plus className="h-4 w-4" /> {s.add}
        </button>
      </div>

      {/* Guides */}
      <div className="space-y-3">
        {sorted.map((g) => {
          const k = keyOf(g);
          const open = openKey === k;
          const cur = open && draft ? draft : g;
          const filled = LOCALES.filter((l) => cur.content?.[l]?.title);
          return (
            <div key={k} className="rounded-2xl border border-line bg-surface">
              <button
                onClick={() => openEditor(g)}
                className="flex w-full items-center gap-3 p-4 text-left"
              >
                <span
                  className={`rounded-lg px-2 py-1 text-xs font-bold ${
                    g.country === "*"
                      ? "bg-sage/20 text-sage"
                      : "bg-terracotta/12 text-terracotta"
                  }`}
                >
                  {g.country === "*" ? s.allCountries : g.country}
                </span>
                <span className="font-semibold text-ink">{g.doc_type}</span>
                <span className="truncate text-sm text-ink-soft">
                  {cur.content?.hinglish?.title ?? cur.content?.en?.title ?? ""}
                </span>
                <span className="ml-auto flex items-center gap-2 text-xs text-ink-soft">
                  {g.url && <span className="rounded bg-cream-deep px-1.5 py-0.5">link</span>}
                  {!g.reviewed && (
                    <span className="rounded bg-amber-warm/20 px-1.5 py-0.5 text-amber-warm">
                      {s.unreviewed}
                    </span>
                  )}
                  <span>{filled.length}/3</span>
                </span>
              </button>

              {open && draft && (
                <div className="space-y-4 border-t border-line p-4">
                  {/* bhasha */}
                  <div className="flex flex-wrap items-center gap-2">
                    {LOCALES.map((l) => (
                      <button
                        key={l}
                        onClick={() => setEditLoc(l)}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          editLoc === l
                            ? "bg-ink text-white"
                            : draft.content?.[l]?.title
                              ? "bg-cream-deep text-ink"
                              : "bg-cream-deep/40 text-ink-soft"
                        }`}
                      >
                        {l}
                        {!draft.content?.[l]?.title && " ·"}
                      </button>
                    ))}
                    {translateOn && (
                      <label className="ml-auto inline-flex items-center gap-2 text-xs text-ink-soft">
                        <input
                          type="checkbox"
                          checked={doTranslate}
                          onChange={(e) => setDoTranslate(e.target.checked)}
                        />
                        <Languages className="h-3.5 w-3.5" />
                        {s.autoTranslate}
                      </label>
                    )}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className={labelCls}>{s.url}</label>
                      <input
                        value={draft.url ?? ""}
                        onChange={(e) => setDraft({ ...draft, url: e.target.value })}
                        placeholder={s.urlPlaceholder}
                        className={inputCls}
                      />
                      <p className="mt-1 text-xs text-ink-soft">{s.urlHint}</p>
                    </div>
                    <div>
                      <label className={labelCls}>{s.authority}</label>
                      <input
                        value={draft.authority ?? ""}
                        onChange={(e) => setDraft({ ...draft, authority: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>{s.guideTitle}</label>
                    <input
                      value={draftText().title}
                      onChange={(e) => setDraftText({ title: e.target.value })}
                      className={inputCls}
                    />
                  </div>

                  <div>
                    <label className={labelCls}>{s.steps}</label>
                    <div className="mt-1.5 space-y-2">
                      {draftText().steps.map((st, i) => (
                        <div key={i} className="flex gap-2">
                          <span className="mt-2 w-5 text-xs font-bold text-ink-soft">{i + 1}.</span>
                          <textarea
                            value={st}
                            rows={2}
                            onChange={(e) => {
                              const next = [...draftText().steps];
                              next[i] = e.target.value;
                              setDraftText({ steps: next });
                            }}
                            className="w-full rounded-xl border border-line bg-cream-deep/20 px-3 py-2 text-sm outline-none focus:border-terracotta"
                          />
                          <button
                            onClick={() => {
                              const next = draftText().steps.filter((_, j) => j !== i);
                              setDraftText({ steps: next.length ? next : [""] });
                            }}
                            className="mt-1 h-8 w-8 shrink-0 rounded-lg text-ink-soft hover:bg-cream-deep"
                          >
                            <Trash2 className="mx-auto h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        onClick={() => setDraftText({ steps: [...draftText().steps, ""] })}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-cream-deep"
                      >
                        <Plus className="h-3.5 w-3.5" /> {s.addStep}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className={labelCls}>{s.note}</label>
                    <textarea
                      value={draftText().note ?? ""}
                      rows={2}
                      onChange={(e) => setDraftText({ note: e.target.value })}
                      className={inputCls}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => save(draft)}
                      disabled={savingKey === k}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-terracotta px-4 py-2 text-sm font-semibold text-white hover:bg-terracotta-dark disabled:opacity-60"
                    >
                      {savingKey === k ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : savedKey === k ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      {savedKey === k ? t.data.rewards.saved : t.common.save}
                    </button>

                    {/* '*' wali row har desh ka fallback hai — delete nahi hoti. */}
                    {g.country !== "*" && (
                      <button
                        onClick={() => remove(g)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-terracotta/30 px-3 py-2 text-sm font-semibold text-terracotta hover:bg-terracotta/5"
                      >
                        <Trash2 className="h-4 w-4" /> {t.common.delete}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
