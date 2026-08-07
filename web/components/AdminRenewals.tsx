"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  Globe,
  Languages,
  Lock,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from "lucide-react";

import Loader from "@/components/Loader";
import { useAdminT, atpl } from "@/lib/i18n/admin";

/**
 * "Ye document renew kaise karein" — har desh ke liye.
 *
 * ⚠️ Pehle is page ka dhaancha CODE me tay tha: har guide me sirf `title`,
 * `steps[]` aur `note` ho sakte the, aur sirf teen bhasha. Naya khaana (jaise
 * "Fees", "Kagaz kya lagenge", "Chetavni") jodne ke liye app + admin + API
 * teeno badalne padte the, phir app release — yaani content team apne aap kuch
 * naya jod hi nahi sakti thi.
 *
 * Ab do parat hain:
 *
 *   MASTER  — guide ka dhaancha khud: kaun se khaane, kis tarteeb me, kis kism
 *             ke; kaun se tag; kaun si bhasha. App wahi, usi tarteeb me dikhati
 *             hai.
 *   GUIDES  — asli content, master ke hisaab se bhara hua.
 *
 * ⚠️ `key` hi content JSON ki chaabi hai — isliye wo banne ke baad badli nahi
 * ja sakti (DB me bhi trigger rok lagata hai). Badalte hi us khaane ka saara
 * likha hua anaath ho jaata: JSON me purani chaabi padi rehti aur app nayi
 * dhoondhti rehti.
 *
 * ⚠️ Doosri parat jo pehle bhi thi aur ab bhi utni hi zaroori hai:
 *
 *   country = '*'      har desh ke liye — safety net, HAMESHA rehti hai
 *   country = 'IN'/... us desh ka apna content — jab bane, tab '*' ko hara deta hai
 *
 * App 190+ deshon me chalti hai. Har desh ka content kabhi nahi banega, par
 * jawab har user ko milna chahiye. Isliye '*' wali rows delete nahi ho sakti
 * (API bhi rokta hai) — sirf badli ja sakti hain.
 */

/* ------------------------------ shapes ------------------------------ */

type FieldKind = "text" | "longtext" | "list" | "link" | "note";

type Field = {
  key: string;
  label: string;
  kind: FieldKind;
  sort: number;
  required: boolean;
  icon: string | null;
  hint: string | null;
  enabled: boolean;
};

type Tag = { key: string; label: string; color: string | null; sort: number; enabled: boolean };
type Lang = { code: string; label: string; native: string | null; sort: number; enabled: boolean };

/** Ek bhasha ke khaane: { fieldKey: value }. List wale khaane string[] hote hain. */
type Body = Record<string, string | string[]>;

type Guide = {
  doc_type: string;
  country: string;
  content: Record<string, Body>;
  tags: string[];
  reviewed: boolean;
  updated_at?: string;
};

/** App ka renewal card in do par tika hai — band ho sakte hain, hat nahi sakte. */
const LOCKED_FIELDS = new Set(["title", "steps"]);

const inputCls =
  "mt-1.5 w-full rounded-xl border border-line bg-cream-deep/20 px-3 py-2 text-sm outline-none focus:border-terracotta";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-ink-soft";
const cardCls = "rounded-2xl border border-line bg-surface p-4";

export default function AdminRenewals() {
  const t = useAdminT();
  const s = t.data.renewals;

  const [tab, setTab] = useState<"guides" | "master">("guides");

  const [guides, setGuides] = useState<Guide[] | null>(null);
  const [fields, setFields] = useState<Field[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [langs, setLangs] = useState<Lang[]>([]);
  const [translateOn, setTranslateOn] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch("/api/admin/renewals", { cache: "no-store" });
      const body = (await res.json()) as {
        guides?: Guide[];
        fields?: Field[];
        tags?: Tag[];
        languages?: Lang[];
        translateOn?: boolean;
        error?: string;
        detail?: string;
      };
      if (!res.ok) {
        // Migration na chali ho — wahi sabse aam wajah hai, aur uska ilaaj saaf
        // hai. Use aam "load failed" me chhupa dena bekaar hai.
        throw new Error(
          body.error === "migration_missing"
            ? (body.detail ?? s.migrationMissing)
            : (body.error ?? `HTTP ${res.status}`),
        );
      }
      setGuides(body.guides ?? []);
      setFields(body.fields ?? []);
      setTags(body.tags ?? []);
      setLangs(body.languages ?? []);
      setTranslateOn(Boolean(body.translateOn));
    } catch (e) {
      setError(e instanceof Error ? e.message : "load failed");
      setGuides([]);
    }
  }, [s.migrationMissing]);

  useEffect(() => {
    void load();
  }, [load]);

  if (guides === null) return <Loader />;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-display text-2xl text-ink">{s.title}</h2>
        <p className="mt-1 text-sm text-ink-soft">{tab === "master" ? s.masterSub : s.sub}</p>
      </div>

      {!!error && (
        <div className="flex items-start gap-2 rounded-xl border border-terracotta/30 bg-terracotta/5 p-3 text-sm text-terracotta">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex gap-2">
        {(["guides", "master"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              tab === k ? "bg-ink text-white" : "bg-cream-deep text-ink-soft hover:text-ink"
            }`}
          >
            {k === "guides" ? s.tabGuides : s.tabMaster}
          </button>
        ))}
      </div>

      {tab === "master" ? (
        <MasterTab
          fields={fields}
          tags={tags}
          langs={langs}
          guides={guides}
          onChanged={load}
          setError={setError}
        />
      ) : (
        <GuidesTab
          guides={guides}
          fields={fields}
          tags={tags}
          langs={langs}
          translateOn={translateOn}
          onChanged={load}
          setError={setError}
        />
      )}
    </div>
  );
}

/* =================================================================== */
/*  MASTER — guide ka dhaancha                                          */
/* =================================================================== */

function MasterTab({
  fields,
  tags,
  langs,
  guides,
  onChanged,
  setError,
}: {
  fields: Field[];
  tags: Tag[];
  langs: Lang[];
  guides: Guide[];
  onChanged: () => Promise<void>;
  setError: (v: string) => void;
}) {
  const t = useAdminT();
  const s = t.data.renewals;

  async function put(kind: "field" | "tag" | "language", row: Record<string, unknown>) {
    setError("");
    try {
      const res = await fetch("/api/admin/renewals/master", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, row }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      await onChanged();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "save failed");
      return false;
    }
  }

  async function del(kind: "field" | "tag" | "language", key: string, ask: string) {
    if (!confirm(ask)) return;
    setError("");
    try {
      const res = await fetch(
        `/api/admin/renewals/master?kind=${kind}&key=${encodeURIComponent(key)}`,
        { method: "DELETE" },
      );
      const body = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
    }
  }

  /**
   * Har khaana kitni guides me sach me bhara hai.
   *
   * Ye ginti delete se pehle wahi ek baat batati hai jo maayne rakhti hai:
   * "ye khaali pada hai" aur "isme 40 guides ka content hai" — dono me delete
   * ka button ek jaisa dikhta hai, par nateeja bilkul alag hota hai.
   */
  const usage = useMemo(() => {
    const count: Record<string, number> = {};
    for (const g of guides) {
      const keys = new Set<string>();
      for (const body of Object.values(g.content ?? {})) {
        for (const [k, v] of Object.entries(body ?? {})) {
          if (Array.isArray(v) ? v.length > 0 : String(v ?? "").trim()) keys.add(k);
        }
      }
      keys.forEach((k) => (count[k] = (count[k] ?? 0) + 1));
    }
    return count;
  }, [guides]);

  return (
    <div className="space-y-5">
      {/* ---------------- Fields ---------------- */}
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-bold text-ink">{s.fields}</h3>
          <p className="text-sm text-ink-soft">{s.fieldsSub}</p>
        </div>

        {fields.length === 0 ? (
          <p className={`${cardCls} text-sm text-ink-soft`}>{s.noFields}</p>
        ) : (
          <div className="space-y-2">
            {fields.map((f) => (
              <FieldRow
                key={f.key}
                field={f}
                usedIn={usage[f.key] ?? 0}
                onSave={(row) => put("field", row)}
                onDelete={() => del("field", f.key, s.deleteFieldAsk)}
              />
            ))}
          </div>
        )}

        <NewField onSave={(row) => put("field", row)} nextSort={nextSort(fields)} />
      </section>

      {/* ---------------- Tags ---------------- */}
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-bold text-ink">{s.tags}</h3>
          <p className="text-sm text-ink-soft">{s.tagsSub}</p>
        </div>

        {tags.length === 0 ? (
          <p className={`${cardCls} text-sm text-ink-soft`}>{s.noTags}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {tags.map((tg) => (
              <span
                key={tg.key}
                className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm"
                style={
                  tg.color
                    ? { borderColor: `${tg.color}66`, backgroundColor: `${tg.color}14`, color: tg.color }
                    : undefined
                }
              >
                <span className={tg.enabled ? "font-semibold" : "font-semibold opacity-50"}>
                  {tg.label}
                </span>
                <span className="text-xs opacity-60">{tg.key}</span>
                <button
                  onClick={() => del("tag", tg.key, s.deleteTagAsk)}
                  className="opacity-60 hover:opacity-100"
                  aria-label={`${t.common.delete} ${tg.label}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        )}

        <NewTag onSave={(row) => put("tag", row)} nextSort={nextSort(tags)} />
      </section>

      {/* ---------------- Languages ---------------- */}
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-bold text-ink">{s.languages}</h3>
          <p className="text-sm text-ink-soft">{s.languagesSub}</p>
        </div>

        {/* ⚠️ Ye warning zaroori hai. "Language master" padh ke sabse pehla
            matlab yahi nikalta hai ki app poori us bhasha me ho jayegi — wo
            nahi hota, aur us galatfehmi ka pata bahut baad me chalta hai. */}
        <div className="flex items-start gap-2 rounded-xl border border-amber-warm/40 bg-amber-warm/10 p-3 text-sm text-ink">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{s.languagesWarn}</span>
        </div>

        {langs.length === 0 ? (
          <p className={`${cardCls} text-sm text-ink-soft`}>{s.noLanguages}</p>
        ) : (
          <div className="space-y-2">
            {langs.map((l) => (
              <LangRow
                key={l.code}
                lang={l}
                onSave={(row) => put("language", row)}
                onDelete={() => del("language", l.code, s.deleteLangAsk)}
              />
            ))}
          </div>
        )}

        <NewLang onSave={(row) => put("language", row)} nextSort={nextSort(langs)} />
      </section>
    </div>
  );
}

function nextSort(rows: { sort: number }[]): number {
  return rows.length === 0 ? 10 : Math.max(...rows.map((r) => r.sort)) + 10;
}

/* ------------------------------ field row ------------------------------ */

function FieldRow({
  field,
  usedIn,
  onSave,
  onDelete,
}: {
  field: Field;
  usedIn: number;
  onSave: (row: Record<string, unknown>) => Promise<boolean>;
  onDelete: () => void;
}) {
  const t = useAdminT();
  const s = t.data.renewals;
  const [d, setD] = useState<Field>(field);
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);

  // Baahar se naya data aaye (save ke baad reload) to draft bhi refresh ho.
  useEffect(() => setD(field), [field]);

  const locked = LOCKED_FIELDS.has(field.key);
  const dirty = JSON.stringify(d) !== JSON.stringify(field);

  async function save() {
    setBusy(true);
    const done = await onSave({
      key: d.key,
      label: d.label,
      // API `kind` ko row ki kism samajhta hai (field/tag/language), isliye
      // field ki apni kism alag naam se jaati hai.
      kind_of: d.kind,
      sort: d.sort,
      required: d.required,
      icon: d.icon,
      hint: d.hint,
      enabled: d.enabled,
    });
    setBusy(false);
    if (done) {
      setOk(true);
      setTimeout(() => setOk(false), 1800);
    }
  }

  return (
    <div className={cardCls}>
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-lg bg-cream-deep px-2 py-1 text-xs font-bold text-ink">
          {field.key}
        </code>
        {locked && (
          <span
            title={s.lockedHint}
            className="inline-flex items-center gap-1 rounded-lg bg-sage/15 px-2 py-1 text-xs font-bold text-sage"
          >
            <Lock className="h-3 w-3" /> {s.lockedBadge}
          </span>
        )}
        {!field.enabled && (
          <span className="rounded-lg bg-cream-deep px-2 py-1 text-xs font-bold text-ink-soft">
            {s.disabledBadge}
          </span>
        )}
        {usedIn > 0 && (
          <span className="text-xs text-ink-soft">{atpl(s.fieldInUse, { n: usedIn })}</span>
        )}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={labelCls}>{s.labelLabel}</label>
          <input value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>{s.kindLabel}</label>
          <select
            value={d.kind}
            // title/steps ki kism badalna content tod deta hai: `list` se `text`
            // karte hi purana array ek string ke khaane me pahunch jaata hai
            // aur app use render nahi kar paati. API bhi ise rokta hai.
            disabled={locked}
            onChange={(e) => setD({ ...d, kind: e.target.value as FieldKind })}
            className={`${inputCls} disabled:opacity-60`}
          >
            <option value="text">{s.kindText}</option>
            <option value="longtext">{s.kindLongtext}</option>
            <option value="list">{s.kindList}</option>
            <option value="link">{s.kindLink}</option>
            <option value="note">{s.kindNote}</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>{s.sortLabel}</label>
          <input
            type="number"
            value={d.sort}
            onChange={(e) => setD({ ...d, sort: Number(e.target.value) })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>{s.iconLabel}</label>
          <input
            value={d.icon ?? ""}
            onChange={(e) => setD({ ...d, icon: e.target.value })}
            placeholder="bulb-outline"
            className={inputCls}
          />
        </div>
      </div>

      <div className="mt-3">
        <label className={labelCls}>{s.hintLabel}</label>
        <input value={d.hint ?? ""} onChange={(e) => setD({ ...d, hint: e.target.value })} className={inputCls} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-4">
        <label className="inline-flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={d.required}
            onChange={(e) => setD({ ...d, required: e.target.checked })}
          />
          {s.requiredLabel}
        </label>
        <label className="inline-flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={d.enabled}
            onChange={(e) => setD({ ...d, enabled: e.target.checked })}
          />
          {s.enabledLabel}
        </label>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={save}
            disabled={busy || !dirty}
            className="inline-flex items-center gap-1.5 rounded-xl bg-terracotta px-3 py-2 text-sm font-semibold text-white hover:bg-terracotta-dark disabled:opacity-50"
          >
            {busy ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : ok ? (
              <Check className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {t.common.save}
          </button>
          {/* Locked fields par delete dikhta hi nahi — button dikha ke error
              dena, use na dikhane se hamesha bura hota hai. */}
          {!locked && (
            <button
              onClick={onDelete}
              className="inline-flex items-center gap-1.5 rounded-xl border border-terracotta/30 px-3 py-2 text-sm font-semibold text-terracotta hover:bg-terracotta/5"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function NewField({
  onSave,
  nextSort: sort,
}: {
  onSave: (row: Record<string, unknown>) => Promise<boolean>;
  nextSort: number;
}) {
  const t = useAdminT();
  const s = t.data.renewals;
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [kind, setKind] = useState<FieldKind>("text");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!key.trim() || !label.trim()) return;
    setBusy(true);
    const done = await onSave({ key, label, kind_of: kind, sort });
    setBusy(false);
    if (done) {
      setKey("");
      setLabel("");
      setKind("text");
    }
  }

  return (
    <div className={`${cardCls} flex flex-wrap items-end gap-3`}>
      <div>
        <label className={labelCls}>{s.keyLabel}</label>
        <input
          value={key}
          // Key JSON ki chaabi banti hai — space ya '.' ghusne par PostgREST ke
          // filter aur JSON path dono tootte hain, aur wo error bahut baad me
          // dikhta hai. Isliye yahin saaf kar dete hain.
          onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          placeholder="fees"
          className={`${inputCls} w-32`}
        />
      </div>
      <div>
        <label className={labelCls}>{s.labelLabel}</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Fees"
          className={`${inputCls} w-40`}
        />
      </div>
      <div>
        <label className={labelCls}>{s.kindLabel}</label>
        <select value={kind} onChange={(e) => setKind(e.target.value as FieldKind)} className={inputCls}>
          <option value="text">{s.kindText}</option>
          <option value="longtext">{s.kindLongtext}</option>
          <option value="list">{s.kindList}</option>
          <option value="link">{s.kindLink}</option>
          <option value="note">{s.kindNote}</option>
        </select>
      </div>
      <button
        onClick={add}
        disabled={busy || !key.trim() || !label.trim()}
        className="mb-0.5 inline-flex items-center gap-1.5 rounded-xl bg-terracotta px-4 py-2 text-sm font-semibold text-white hover:bg-terracotta-dark disabled:opacity-50"
      >
        <Plus className="h-4 w-4" /> {s.addField}
      </button>
      <p className="w-full text-xs text-ink-soft">{s.keyHint}</p>
    </div>
  );
}

/* ------------------------------ tag / lang ------------------------------ */

function NewTag({
  onSave,
  nextSort: sort,
}: {
  onSave: (row: Record<string, unknown>) => Promise<boolean>;
  nextSort: number;
}) {
  const t = useAdminT();
  const s = t.data.renewals;
  const [key, setKey] = useState("");
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("#c25a37");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!key.trim() || !label.trim()) return;
    setBusy(true);
    const done = await onSave({ key, label, color, sort });
    setBusy(false);
    if (done) {
      setKey("");
      setLabel("");
    }
  }

  return (
    <div className={`${cardCls} flex flex-wrap items-end gap-3`}>
      <div>
        <label className={labelCls}>{s.keyLabel}</label>
        <input
          value={key}
          onChange={(e) => setKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
          placeholder="urgent"
          className={`${inputCls} w-32`}
        />
      </div>
      <div>
        <label className={labelCls}>{s.labelLabel}</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Urgent"
          className={`${inputCls} w-40`}
        />
      </div>
      <div>
        <label className={labelCls}>{s.colorLabel}</label>
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="mt-1.5 h-10 w-16 rounded-xl border border-line bg-surface p-1"
        />
      </div>
      <button
        onClick={add}
        disabled={busy || !key.trim() || !label.trim()}
        className="mb-0.5 inline-flex items-center gap-1.5 rounded-xl bg-terracotta px-4 py-2 text-sm font-semibold text-white hover:bg-terracotta-dark disabled:opacity-50"
      >
        <Plus className="h-4 w-4" /> {s.addTag}
      </button>
    </div>
  );
}

function LangRow({
  lang,
  onSave,
  onDelete,
}: {
  lang: Lang;
  onSave: (row: Record<string, unknown>) => Promise<boolean>;
  onDelete: () => void;
}) {
  const t = useAdminT();
  const s = t.data.renewals;
  const [d, setD] = useState<Lang>(lang);
  const [busy, setBusy] = useState(false);

  useEffect(() => setD(lang), [lang]);
  const dirty = JSON.stringify(d) !== JSON.stringify(lang);

  return (
    <div className={`${cardCls} flex flex-wrap items-end gap-3`}>
      <code className="mb-2.5 rounded-lg bg-cream-deep px-2 py-1 text-xs font-bold text-ink">
        {lang.code}
      </code>
      <div>
        <label className={labelCls}>{s.labelLabel}</label>
        <input value={d.label} onChange={(e) => setD({ ...d, label: e.target.value })} className={`${inputCls} w-36`} />
      </div>
      <div>
        <label className={labelCls}>{s.nativeLabel}</label>
        <input
          value={d.native ?? ""}
          onChange={(e) => setD({ ...d, native: e.target.value })}
          className={`${inputCls} w-36`}
        />
      </div>
      <div>
        <label className={labelCls}>{s.sortLabel}</label>
        <input
          type="number"
          value={d.sort}
          onChange={(e) => setD({ ...d, sort: Number(e.target.value) })}
          className={`${inputCls} w-20`}
        />
      </div>
      <label className="mb-3 inline-flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={d.enabled} onChange={(e) => setD({ ...d, enabled: e.target.checked })} />
        {s.enabledLabel}
      </label>
      <div className="mb-0.5 ml-auto flex items-center gap-2">
        <button
          onClick={async () => {
            setBusy(true);
            await onSave({ code: d.code, label: d.label, native: d.native, sort: d.sort, enabled: d.enabled });
            setBusy(false);
          }}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-1.5 rounded-xl bg-terracotta px-3 py-2 text-sm font-semibold text-white hover:bg-terracotta-dark disabled:opacity-50"
        >
          {busy ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {t.common.save}
        </button>
        <button
          onClick={onDelete}
          className="inline-flex items-center gap-1.5 rounded-xl border border-terracotta/30 px-3 py-2 text-sm font-semibold text-terracotta hover:bg-terracotta/5"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function NewLang({
  onSave,
  nextSort: sort,
}: {
  onSave: (row: Record<string, unknown>) => Promise<boolean>;
  nextSort: number;
}) {
  const t = useAdminT();
  const s = t.data.renewals;
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [native, setNative] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!code.trim() || !label.trim()) return;
    setBusy(true);
    const done = await onSave({ code, label, native, sort });
    setBusy(false);
    if (done) {
      setCode("");
      setLabel("");
      setNative("");
    }
  }

  return (
    <div className={`${cardCls} flex flex-wrap items-end gap-3`}>
      <div>
        <label className={labelCls}>{s.keyLabel}</label>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
          placeholder="ta"
          className={`${inputCls} w-24`}
        />
      </div>
      <div>
        <label className={labelCls}>{s.labelLabel}</label>
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Tamil"
          className={`${inputCls} w-36`}
        />
      </div>
      <div>
        <label className={labelCls}>{s.nativeLabel}</label>
        <input
          value={native}
          onChange={(e) => setNative(e.target.value)}
          placeholder="தமிழ்"
          className={`${inputCls} w-36`}
        />
      </div>
      <button
        onClick={add}
        disabled={busy || !code.trim() || !label.trim()}
        className="mb-0.5 inline-flex items-center gap-1.5 rounded-xl bg-terracotta px-4 py-2 text-sm font-semibold text-white hover:bg-terracotta-dark disabled:opacity-50"
      >
        <Plus className="h-4 w-4" /> {s.addLanguage}
      </button>
    </div>
  );
}

/* =================================================================== */
/*  GUIDES — asli content                                               */
/* =================================================================== */

function GuidesTab({
  guides,
  fields,
  tags,
  langs,
  translateOn,
  onChanged,
  setError,
}: {
  guides: Guide[];
  fields: Field[];
  tags: Tag[];
  langs: Lang[];
  translateOn: boolean;
  onChanged: () => Promise<void>;
  setError: (v: string) => void;
}) {
  const t = useAdminT();
  const s = t.data.renewals;

  const liveFields = useMemo(() => fields.filter((f) => f.enabled), [fields]);
  const liveLangs = useMemo(() => langs.filter((l) => l.enabled), [langs]);

  const [rows, setRows] = useState<Guide[]>(guides);
  useEffect(() => setRows(guides), [guides]);

  const [openKey, setOpenKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<Guide | null>(null);
  const [editLoc, setEditLoc] = useState<string>(liveLangs[0]?.code ?? "");
  const [doTranslate, setDoTranslate] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  const [newType, setNewType] = useState("");
  const [newCountry, setNewCountry] = useState("");

  const keyOf = (g: Pick<Guide, "doc_type" | "country">) => `${g.doc_type}:${g.country}`;

  /**
   * Dropdown ki asli list — jo bhi DB me pehle se hai.
   *
   * ⚠️ Pehle yahan ek hardcoded list thi (car/license/passport…), aur uske do
   * nateeje the: naye document type ka guide banane ke liye app release chahiye
   * tha, aur SQL se daali gayi row dropdown me dikhti hi nahi thi.
   */
  const docTypes = useMemo(() => {
    return Array.from(new Set(rows.map((g) => g.doc_type).filter(Boolean))).sort();
  }, [rows]);

  /** '*' wali rows sabse upar — wahi sabse zyada users ko dikhti hain. */
  const sorted = useMemo(() => {
    return [...rows].sort((a, b) => {
      if (a.country === "*" && b.country !== "*") return -1;
      if (b.country === "*" && a.country !== "*") return 1;
      if (a.doc_type !== b.doc_type) return a.doc_type.localeCompare(b.doc_type);
      return a.country.localeCompare(b.country);
    });
  }, [rows]);

  /**
   * Kin doc_type ke paas '*' wala fallback NAHI hai.
   *
   * ⚠️ Ye ab hardcoded list se nahi, DB me maujood types se banti hai — pehle
   * ye warning un saat types ke liye lagti thi jo code me likhe the, chahe wo
   * istemaal me hon ya nahi, aur admin ke banaye naye type ke liye kabhi nahi
   * lagti thi (jahan iski sabse zyada zaroorat hai).
   */
  const missingGlobal = useMemo(() => {
    const have = new Set(rows.filter((g) => g.country === "*").map((g) => g.doc_type));
    return docTypes.filter((d) => !have.has(d));
  }, [rows, docTypes]);

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
    const filled = liveLangs.find((l) => hasContent(g.content?.[l.code]));
    setEditLoc(filled?.code ?? liveLangs[0]?.code ?? "");
  }

  function draftBody(): Body {
    return draft?.content?.[editLoc] ?? {};
  }

  function setDraftField(key: string, value: string | string[]) {
    setDraft((d) => {
      if (!d) return d;
      const cur = d.content?.[editLoc] ?? {};
      return { ...d, content: { ...d.content, [editLoc]: { ...cur, [key]: value } } };
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
          source_locale: editLoc,
          text: g.content?.[editLoc] ?? {},
          existing_content: g.content,
          tags: g.tags ?? [],
          translate: doTranslate && translateOn,
        }),
      });
      const body = (await res.json()) as { guide?: Guide; error?: string };
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setSavedKey(k);
      setTimeout(() => setSavedKey(null), 2000);
      await onChanged();
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
      await onChanged();
    } catch (e) {
      setError(e instanceof Error ? e.message : "delete failed");
    }
  }

  function addNew() {
    const c = newCountry.trim() === "*" ? "*" : newCountry.trim().toUpperCase();
    // "*" = har desh wala safety-net guide. Naya doc_type banate waqt SABSE
    // pehle yahi banna chahiye — uske bina us type ke un users ko kuch bhi
    // nahi dikhta jinke desh ka apna content nahi hai.
    if (c !== "*" && !/^[A-Z]{2}$/.test(c)) {
      setError(s.countryFormat);
      return;
    }
    const type = newType.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!type) {
      setError(s.docTypeNeeded);
      return;
    }
    if (rows.some((g) => g.doc_type === type && g.country === c)) {
      setError(s.alreadyExists);
      return;
    }
    const fresh: Guide = { doc_type: type, country: c, content: {}, tags: [], reviewed: true };
    // Sirf local list me — save hone tak DB me kuch nahi jaata.
    setRows((list) => [...list, fresh]);
    setNewType("");
    setNewCountry("");
    setError("");
    openEditor(fresh);
  }

  // Master khaali ho to content bharne ko kuch hai hi nahi — ye keh dena, ek
  // khaali editor dikhane se hamesha behtar hai.
  if (liveFields.length === 0 || liveLangs.length === 0) {
    return <p className={`${cardCls} text-sm text-ink-soft`}>{s.needMaster}</p>;
  }

  return (
    <div className="space-y-4">
      {/* ⚠️ '*' row na hone ka matlab hai ki us document type par un saare
          deshon me KUCH bhi nahi dikhega jinka apna content nahi bana. */}
      {missingGlobal.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-warm/40 bg-amber-warm/10 p-3 text-sm text-ink">
          <Globe className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{s.missingGlobal.replace("{types}", missingGlobal.join(", "))}</span>
        </div>
      )}

      {/* Naya guide */}
      <div className={`${cardCls} flex flex-wrap items-end gap-3`}>
        <div>
          <label className={labelCls}>{s.docType}</label>
          <input
            value={newType}
            onChange={(e) => setNewType(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
            placeholder={s.newTypePh}
            list="renewal-doc-types"
            className={`${inputCls} w-40`}
          />
          {/* Pehle se maujood types sujhaav ki tarah — par likhne par koi rok
              nahi, kyunki naya type banana hi is page ka aadha kaam hai. */}
          <datalist id="renewal-doc-types">
            {docTypes.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>
        <div>
          <label className={labelCls}>{s.country}</label>
          <input
            value={newCountry}
            onChange={(e) =>
              setNewCountry(e.target.value === "*" ? "*" : e.target.value.toUpperCase().slice(0, 2))
            }
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

      {sorted.length === 0 ? (
        <p className={`${cardCls} text-sm text-ink-soft`}>{s.noGuides}</p>
      ) : (
        <div className="space-y-3">
          {sorted.map((g) => {
            const k = keyOf(g);
            const open = openKey === k;
            const cur = open && draft ? draft : g;
            const filled = liveLangs.filter((l) => hasContent(cur.content?.[l.code]));
            const heading = firstText(cur.content, liveLangs);

            return (
              <div key={k} className="rounded-2xl border border-line bg-surface">
                <button
                  onClick={() => openEditor(g)}
                  className="flex w-full flex-wrap items-center gap-3 p-4 text-left"
                >
                  <span
                    className={`rounded-lg px-2 py-1 text-xs font-bold ${
                      g.country === "*" ? "bg-sage/20 text-sage" : "bg-terracotta/12 text-terracotta"
                    }`}
                  >
                    {g.country === "*" ? s.allCountries : g.country}
                  </span>
                  <span className="font-semibold text-ink">{g.doc_type}</span>
                  <span className="truncate text-sm text-ink-soft">{heading}</span>

                  {(cur.tags ?? []).map((tk) => {
                    const tg = tags.find((x) => x.key === tk);
                    if (!tg) return null;
                    return (
                      <span
                        key={tk}
                        className="rounded-full px-2 py-0.5 text-xs font-semibold"
                        style={{
                          backgroundColor: `${tg.color ?? "#888888"}1a`,
                          color: tg.color ?? undefined,
                        }}
                      >
                        {tg.label}
                      </span>
                    );
                  })}

                  <span className="ml-auto flex items-center gap-2 text-xs text-ink-soft">
                    {!g.reviewed && (
                      <span className="rounded bg-amber-warm/20 px-1.5 py-0.5 text-amber-warm">
                        {s.unreviewed}
                      </span>
                    )}
                    <span>
                      {filled.length}/{liveLangs.length}
                    </span>
                  </span>
                </button>

                {open && draft && (
                  <div className="space-y-4 border-t border-line p-4">
                    {/* bhasha */}
                    <div className="flex flex-wrap items-center gap-2">
                      {liveLangs.map((l) => (
                        <button
                          key={l.code}
                          onClick={() => setEditLoc(l.code)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                            editLoc === l.code
                              ? "bg-ink text-white"
                              : hasContent(draft.content?.[l.code])
                                ? "bg-cream-deep text-ink"
                                : "bg-cream-deep/40 text-ink-soft"
                          }`}
                        >
                          {l.native || l.label}
                          {!hasContent(draft.content?.[l.code]) && " ·"}
                        </button>
                      ))}
                      {translateOn && liveLangs.length > 1 && (
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

                    {/* Tags */}
                    {tags.length > 0 && (
                      <div>
                        <label className={labelCls}>{s.entryTags}</label>
                        <div className="mt-1.5 flex flex-wrap gap-2">
                          {tags
                            .filter((tg) => tg.enabled)
                            .map((tg) => {
                              const on = (draft.tags ?? []).includes(tg.key);
                              return (
                                <button
                                  key={tg.key}
                                  onClick={() =>
                                    setDraft({
                                      ...draft,
                                      tags: on
                                        ? (draft.tags ?? []).filter((x) => x !== tg.key)
                                        : [...(draft.tags ?? []), tg.key],
                                    })
                                  }
                                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                                    on ? "border-transparent" : "border-line text-ink-soft"
                                  }`}
                                  style={
                                    on
                                      ? {
                                          backgroundColor: `${tg.color ?? "#888888"}1f`,
                                          color: tg.color ?? undefined,
                                        }
                                      : undefined
                                  }
                                >
                                  {tg.label}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    )}

                    {/* Khaane — MASTER se, usi tarteeb me jisme app dikhati hai */}
                    {liveFields.map((f) => (
                      <FieldInput
                        key={f.key}
                        field={f}
                        value={draftBody()[f.key]}
                        onChange={(v) => setDraftField(f.key, v)}
                      />
                    ))}

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
      )}
    </div>
  );
}

/** Is bhasha me kuch likha bhi hai ya bas khaali khaane pade hain? */
function hasContent(body: Body | undefined): boolean {
  if (!body) return false;
  return Object.values(body).some((v) =>
    Array.isArray(v) ? v.some((s) => s.trim()) : String(v ?? "").trim(),
  );
}

/** List me dikhane ke liye ek line — jo bhi bhasha pehle bhari mile. */
function firstText(content: Record<string, Body> | undefined, langs: Lang[]): string {
  for (const l of langs) {
    const v = content?.[l.code]?.title;
    if (typeof v === "string" && v.trim()) return v;
  }
  // `title` na ho (admin ne band kar diya ho) to jo bhi pehla text mile.
  for (const body of Object.values(content ?? {})) {
    for (const v of Object.values(body ?? {})) {
      if (typeof v === "string" && v.trim()) return v;
    }
  }
  return "";
}

/* ------------------------------ ek khaana ------------------------------ */

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: string | string[] | undefined;
  onChange: (v: string | string[]) => void;
}) {
  const t = useAdminT();
  const s = t.data.renewals;

  const label = (
    <label className={labelCls}>
      {field.label}
      {field.required && <span className="ml-1 text-terracotta">*</span>}
    </label>
  );

  if (field.kind === "list") {
    const list = Array.isArray(value) ? value : [];
    // Khaali list par ek khaali khaana dikhao — warna "Add" dhoondhna padta hai
    // aur pehli baar me screen bilkul khaali lagti hai.
    const shown = list.length > 0 ? list : [""];
    return (
      <div>
        {label}
        {!!field.hint && <p className="mt-0.5 text-xs text-ink-soft">{field.hint}</p>}
        <div className="mt-1.5 space-y-2">
          {shown.map((st, i) => (
            <div key={i} className="flex gap-2">
              <span className="mt-2 w-5 text-xs font-bold text-ink-soft">{i + 1}.</span>
              <textarea
                value={st}
                rows={2}
                onChange={(e) => {
                  const next = [...shown];
                  next[i] = e.target.value;
                  onChange(next);
                }}
                className="w-full rounded-xl border border-line bg-cream-deep/20 px-3 py-2 text-sm outline-none focus:border-terracotta"
              />
              <button
                onClick={() => {
                  const next = shown.filter((_, j) => j !== i);
                  onChange(next.length ? next : [""]);
                }}
                className="mt-1 h-8 w-8 shrink-0 rounded-lg text-ink-soft hover:bg-cream-deep"
                aria-label={t.common.delete}
              >
                <Trash2 className="mx-auto h-4 w-4" />
              </button>
            </div>
          ))}
          <button
            onClick={() => onChange([...shown, ""])}
            className="inline-flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-semibold text-ink-soft hover:bg-cream-deep"
          >
            <Plus className="h-3.5 w-3.5" /> {s.addStep}
          </button>
        </div>
      </div>
    );
  }

  const str = typeof value === "string" ? value : "";

  if (field.kind === "longtext" || field.kind === "note") {
    return (
      <div>
        {label}
        <textarea value={str} rows={3} onChange={(e) => onChange(e.target.value)} className={inputCls} />
        {!!field.hint && <p className="mt-1 text-xs text-ink-soft">{field.hint}</p>}
      </div>
    );
  }

  return (
    <div>
      {label}
      <input
        value={str}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.kind === "link" ? "https://…" : undefined}
        // Link ka anuvaad kabhi nahi hota (API bhi use chhodta hai), isliye
        // yahan bhi wo saaf LTR me hi likha jaata hai.
        dir={field.kind === "link" ? "ltr" : undefined}
        className={inputCls}
      />
      {!!field.hint && <p className="mt-1 text-xs text-ink-soft">{field.hint}</p>}
    </div>
  );
}
