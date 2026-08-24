"use client";

import {
  ANIMATION_PLAIN_NAMES,
  EFFECT_PLAIN_NAMES,
  TRANSITION_PLAIN_NAMES,
  plainAnimation,
  plainEffect,
  plainTransition,
  type PlainName,
} from "@reel/core";
import clsx from "clsx";
import { Check, RotateCw } from "lucide-react";
import { useState } from "react";

/**
 * Animation / transition chunne wala (26.7).
 *
 * ⚠️ **Registry ke label yahan kabhi nahi aate.** "Ken Burns punch" ek technique
 * ka naam hai; jise wo technique pata hai usi ko wo kuch batata hai. Wizard theek
 * us aadmi ke liye bana hai jise nahi pata, aur uske liye wo naam ek paheli hai.
 * Paheli ke saamne aadmi kuch chunta nahi — wo bas "Aage" daba deta hai.
 *
 * Isliye har option par do cheezein hain: aam bhasha wala naam, aur **kab ye
 * theek hai**. Doosri pehli se zyada kaam ki hai — naam se andaaza lag bhi jaaye
 * to "istemal kab karna hai" ka jawab kahin nahi milta.
 *
 * ⚠️ Sifaarish ka nishaan wahi id par lagta hai jo `suggestAnimation` /
 * `suggestTransition` deti hai — yaani jo apne aap laga tha. Aadmi ko dikhna
 * chahiye ki wo default kahan se aaya, warna "system ne kuch kar diya" wala
 * ehsaas rehta hai.
 */

function Row({
  entry,
  chosen,
  recommended,
  onPick,
}: {
  entry: PlainName;
  chosen: boolean;
  recommended: boolean;
  onPick(): void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={clsx(
        "flex w-full items-start gap-2 rounded border px-2 py-1.5 text-left transition-colors",
        chosen ? "border-terracotta bg-terracotta/10" : "border-ink-600 hover:border-chalk-500",
      )}
    >
      <span className="mt-0.5 w-3 shrink-0">{chosen ? <Check size={11} /> : null}</span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="text-[11px] text-chalk-100">{entry.label}</span>
          {recommended ? (
            <span className="rounded bg-terracotta/20 px-1 py-px text-[9px] text-terracotta">
              Sifaarish
            </span>
          ) : null}
        </span>
        <span className="block text-[10px] leading-snug text-chalk-500">{entry.when}</span>
      </span>
    </button>
  );
}

/**
 * Har kism ka apna khaana — list, naam dhoondhne ka tarika, aur patti ka label.
 *
 * ⚠️ Ye teen cheezein ek jagah hain, teen `if` me nahi. Pehle yahan `kind ===
 * "animation" ? … : …` tha, aur teesri kism (effect) jodte hi wo teen jagah
 * badalna padta — jinme se ek jagah bhool jaane par UI "Pichhle scene se: Safed-
 * kaala" jaisa kuch dikhata, bina kisi error ke.
 */
const KINDS = {
  animation: { list: ANIMATION_PLAIN_NAMES, find: plainAnimation, label: "Harkat" },
  transition: { list: TRANSITION_PLAIN_NAMES, find: plainTransition, label: "Pichhle scene se" },
  effect: { list: EFFECT_PLAIN_NAMES, find: plainEffect, label: "Rang / effect" },
} as const;

export function ChoicePicker({
  kind,
  value,
  recommended,
  onPick,
}: {
  kind: keyof typeof KINDS;
  value: string | null;
  /** Jo `suggest*` ne diya tha — uspar "Sifaarish" ka nishaan lagta hai. */
  recommended: string | null;
  onPick(id: string): void;
}) {
  const [open, setOpen] = useState(false);

  const { list, find: findName, label } = KINDS[kind];
  const chosen = value ? findName(value) : null;

  return (
    <div>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] text-chalk-500">{label}:</span>
        <span className="text-[10px] text-chalk-300">{chosen?.label ?? "kuch nahi"}</span>
        {value && value === recommended ? (
          <span className="text-[10px] text-chalk-500">· apne aap chuna</span>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen((was) => !was)}
          className="ml-auto flex shrink-0 items-center gap-1 rounded border border-ink-600 px-1.5 py-0.5 text-[10px] text-chalk-400 transition-colors hover:border-chalk-500 hover:text-chalk-100"
        >
          <RotateCw size={9} />
          {open ? "band" : "badlo"}
        </button>
      </div>

      {open ? (
        <div className="mt-1 space-y-1">
          {list.map((entry) => (
            <Row
              key={entry.id}
              entry={entry}
              chosen={entry.id === value}
              recommended={entry.id === recommended}
              onPick={() => {
                onPick(entry.id);
                setOpen(false);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
