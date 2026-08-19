"use client";

import { safeParseDoc } from "@reel/core";
import { RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";

import {
  clearLocalDraft,
  draftAge,
  readLocalDraft,
  shouldOfferDraft,
  type LocalDraft,
} from "@/lib/localDraft";
import { useEditorStore, useEditorStoreApi } from "@/lib/store";

/**
 * "Bina save kiya kaam mila — wapas laayein?" (16.14)
 *
 * ⚠️ Ye sawaal **sirf tab** poochha jaata hai jab sach me kuch bacha ho: draft
 * usi server-version ke upar bana ho jo abhi latest hai, aur uska doc server ke
 * doc se alag ho (`shouldOfferDraft`). Har baar poochhne wala banner do-teen
 * baar me "hamesha nahi" ban jaata hai — aur jis din sach me kuch bacha hoga us
 * din bhi user "nahi" daba dega.
 *
 * Draft ko **schema se guzaara** jaata hai. Wo browser ke storage se aa raha hai
 * jise koi bhi extension chhoo sakta hai; bina jaanche use store me daal dena
 * poore editor ko todne ka sabse aasan tarika hoga.
 */
export function DraftRecovery() {
  const store = useEditorStoreApi();
  const projectId = useEditorStore((state) => state.projectId);
  const [draft, setDraft] = useState<LocalDraft | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    void (async () => {
      const found = await readLocalDraft(projectId);
      if (!alive) return;

      const state = store.getState();
      if (!shouldOfferDraft(found, { doc: state.doc, updatedAt: state.savedAt || null })) {
        // Kaam ka nahi hai to chupchaap hata do — pada rehne se agli baar bhi
        // wahi bekaar sawaal aayega.
        if (found) void clearLocalDraft(projectId);
        return;
      }
      setDraft(found);
    })();

    return () => {
      alive = false;
    };
  }, [projectId, store]);

  if (!draft) return null;

  function recover(): void {
    const parsed = safeParseDoc(draft?.doc);
    if (!parsed.success) {
      setProblem("Bacha hua draft padha nahi ja saka — wo kharab ho chuka hai.");
      void clearLocalDraft(projectId);
      return;
    }
    /*
     * `replaceDoc` op — poora doc badalne ka wahi raasta jo version se reload
     * karne par chalta hai. Seedha `set({ doc })` karna galat hota: tab ye badlav
     * history ke bahar reh jaata aur Ctrl+Z user ko us haalat me le jaata jise
     * wo abhi abhi chhod chuka tha, bina kisi tarike ke wapas aane ke.
     */
    store.getState().applyOp("replaceDoc", { doc: parsed.data }, { label: "Draft wapas laaya" });
    void clearLocalDraft(projectId);
    setDraft(null);
  }

  function dismiss(): void {
    void clearLocalDraft(projectId);
    setDraft(null);
  }

  return (
    <div className="flex items-center gap-3 border-b border-amber/40 bg-amber/10 px-4 py-1.5 text-[12px] text-amber">
      <span className="min-w-0 flex-1">
        {problem ??
          `Is project ka bina save kiya kaam mila (${draftAge(draft.at, Date.now())}). Wapas laayein?`}
      </span>

      {problem ? null : (
        <button
          type="button"
          onClick={recover}
          className="flex items-center gap-1 rounded border border-amber/50 px-1.5 py-0.5 hover:bg-amber/20"
        >
          <RotateCcw size={11} />
          Wapas lao
        </button>
      )}
      <button
        type="button"
        aria-label="Rehne do"
        onClick={dismiss}
        className="rounded p-0.5 hover:bg-amber/20"
      >
        <X size={12} />
      </button>
    </div>
  );
}
