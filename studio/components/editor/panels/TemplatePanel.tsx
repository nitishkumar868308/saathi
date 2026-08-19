"use client";

import {
  BUILTIN_TEMPLATES,
  applyTemplate,
  templateFromDoc,
  type Template,
  type TemplateSlot,
} from "@reel/core";
import clsx from "clsx";
import { ArrowLeft, LayoutTemplate, Save } from "lucide-react";
import { useState } from "react";

import { AssetPickerButton } from "@/components/editor/scenes/AssetPicker";
import { useEditorStore } from "@/lib/store";

/**
 * Template gallery + slot wizard (17.8).
 *
 * ⚠️ Template lagane par **project ka doc poora badal jaata hai**, isliye pehle
 * ek saaf chetavni dikhti hai. Chup-chaap badal dena sabse buri baat hoti: user
 * ka poora kaam ek click me chala jaata aur wo Ctrl+Z ki taraf bhaagta.
 *
 * Ctrl+Z chalta hai (badlav `replaceDoc` op se hota hai), par uspar bharosa
 * karke bina bataye badalna galat hai — user ko pata hona chahiye ki kya hone
 * wala hai.
 */
export function TemplatePanel() {
  const doc = useEditorStore((state) => state.doc);
  const applyOp = useEditorStore((state) => state.applyOp);
  const [chosen, setChosen] = useState<Template | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState<string | null>(null);

  function choose(template: Template): void {
    setChosen(template);
    // Default values pehle se bhar do — wizard khaali dikhne se ye lagta hai ki
    // sab kuch khud likhna padega, jabki aksar teen-chaar hi badalne hote hain.
    setValues(
      Object.fromEntries(
        template.slots
          .filter((slot) => slot.defaultValue !== null)
          .map((slot) => [slot.key, slot.defaultValue as string]),
      ),
    );
  }

  if (chosen) {
    const missing = chosen.slots.filter(
      (slot) => slot.required && !(values[slot.key] ?? "").trim(),
    );

    return (
      <div className="space-y-3 p-3 text-[11px]">
        <button
          type="button"
          onClick={() => setChosen(null)}
          className="flex items-center gap-1 text-chalk-500 hover:text-chalk-300"
        >
          <ArrowLeft size={11} />
          Saare templates
        </button>

        <div>
          <h3 className="text-sm text-chalk-100">{chosen.name}</h3>
          <p className="text-chalk-500">{chosen.description}</p>
        </div>

        <div className="space-y-2">
          {chosen.slots.map((slot) => (
            <SlotField
              key={slot.key}
              slot={slot}
              value={values[slot.key] ?? ""}
              onChange={(value) => setValues((previous) => ({ ...previous, [slot.key]: value }))}
            />
          ))}
        </div>

        {missing.length > 0 ? (
          <p className="rounded border border-amber/40 bg-amber/10 px-2 py-1 text-amber">
            {missing.length} zaroori cheez baaki hai. Bina uske bhi bana sakte ho — text ki
            jagah ek nishaan aayega, aur jis scene ko asset chahiye wo chhoot jaayega.
          </p>
        ) : null}

        <p className="text-chalk-500">
          Ye poore project ko badal dega ({doc.items.length} clips abhi hain). Ctrl+Z se wapas
          aa sakte ho.
        </p>

        <button
          type="button"
          onClick={() => {
            const result = applyTemplate({
              template: chosen,
              slots: values,
              presetId: doc.project.sizePresetId,
              fps: doc.project.fps,
              name: doc.project.name,
            });
            applyOp("replaceDoc", { doc: result.doc }, { label: `Template: ${chosen.name}` });
            setChosen(null);
          }}
          className="w-full rounded bg-terracotta px-2 py-1.5 text-chalk-100 transition-opacity hover:opacity-90"
        >
          Ye template lagao
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3 p-3 text-[11px]">
      <section className="space-y-1.5">
        <h3 className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-chalk-500">
          <LayoutTemplate size={10} />
          Templates
        </h3>
        {BUILTIN_TEMPLATES.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => choose(template)}
            className="w-full rounded border border-ink-600 px-2 py-1.5 text-left transition-colors hover:bg-ink-700"
          >
            <span className="block text-chalk-200">{template.name}</span>
            <span className="block text-chalk-500">{template.description}</span>
            <span className="mt-0.5 block text-[10px] text-chalk-500">
              {template.scenes.length} scene · {template.slots.length} cheezein bharni hain
            </span>
          </button>
        ))}
      </section>

      <section className="space-y-1.5 border-t border-ink-800 pt-2">
        <h3 className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-chalk-500">
          <Save size={10} />
          Isse template banao
        </h3>
        <p className="text-chalk-500">
          Abhi ka project ek template ban jaayega — har asset aur text ek "bharne wali jagah"
          ban jaayega.
        </p>
        <button
          type="button"
          onClick={() => {
            const { template, dropped } = templateFromDoc(doc, {
              id: `local-${doc.project.id}`,
              name: `${doc.project.name} template`,
            });
            /*
             * ⚠️ Abhi ye sirf clipboard me jaata hai, DB me nahi.
             *
             * `reel_templates` table ka SQL likha hua hai par user ne use abhi
             * chalaya nahi hai. Save ka button dikha kar chup-chaap kuch na
             * karna sabse bura hota — isliye jo sach me hota hai wahi likha hai.
             */
            void navigator.clipboard?.writeText(JSON.stringify(template, null, 2));
            setSaved(
              `${template.scenes.length} scene copy ho gaye${dropped > 0 ? ` (${dropped} haath se banaye hue scene chhoot gaye)` : ""}`,
            );
          }}
          className="w-full rounded border border-ink-600 px-2 py-1 text-chalk-400 hover:bg-ink-700"
        >
          Template JSON copy karo
        </button>
        {saved ? <p className="text-chalk-400">{saved}</p> : null}
        <p className="text-chalk-500">
          Abhi ye clipboard me jaata hai. DB me save karne ke liye
          <code className="mx-1 rounded bg-ink-800 px-1">supabase/reel-studio-templates.sql</code>
          chalana baaki hai.
        </p>
      </section>
    </div>
  );
}

function SlotField({
  slot,
  value,
  onChange,
}: {
  slot: TemplateSlot;
  value: string;
  onChange: (value: string) => void;
}) {
  const label = (
    <span className="mb-0.5 flex items-baseline gap-1">
      <span className="text-chalk-300">{slot.label}</span>
      {slot.required ? null : <span className="text-[10px] text-chalk-500">(optional)</span>}
    </span>
  );

  if (slot.kind === "image" || slot.kind === "video" || slot.kind === "audio") {
    return (
      <label className="block">
        {label}
        <AssetPickerButton kind={slot.kind} assetId={value || null} onPick={onChange} />
        {slot.hint ? <span className="mt-0.5 block text-[10px] text-chalk-500">{slot.hint}</span> : null}
      </label>
    );
  }

  if (slot.kind === "color") {
    return (
      <label className="flex items-center gap-2">
        <span className="min-w-0 flex-1">{label}</span>
        <input
          type="color"
          value={value || "#C25A37"}
          onChange={(event) => onChange(event.target.value)}
          className="h-6 w-10 shrink-0 cursor-pointer rounded border border-ink-600 bg-transparent"
        />
      </label>
    );
  }

  return (
    <label className="block">
      {label}
      {slot.multiline ? (
        <textarea
          value={value}
          rows={2}
          placeholder={slot.hint}
          onChange={(event) => onChange(event.target.value)}
          className={clsx(
            "w-full resize-y rounded border border-ink-600 bg-ink-900 px-1.5 py-1",
            "text-chalk-200 outline-none focus:border-terracotta",
          )}
        />
      ) : (
        <input
          value={value}
          placeholder={slot.hint}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded border border-ink-600 bg-ink-900 px-1.5 py-1 text-chalk-200 outline-none focus:border-terracotta"
        />
      )}
      {slot.hint && slot.multiline ? (
        <span className="mt-0.5 block text-[10px] text-chalk-500">{slot.hint}</span>
      ) : null}
    </label>
  );
}
