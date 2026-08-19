"use client";

import { AlertTriangle } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/Button";
import { timeAgo } from "@/lib/format";
import { useEditorStore } from "@/lib/store";

/**
 * Conflict — do tab, ek project.
 *
 * ⚠️ Ye is poore phase ka sabse zaroori UI hai. Server ne 409 diya matlab kisi
 * aur ne beech me save kar diya. Yahan teen raaste ho sakte the:
 *
 *   1. chupchaap overwrite — kisi ka kaam bina bataye mit jaata (sabse bura)
 *   2. chupchaap reload — *tumhara* abhi ka kaam bina bataye mit jaata
 *   3. **poochh lo** — dono raaste saaf-saaf, aur nuksaan kya hoga wo likha hua
 *
 * Teesra chuna gaya. Aur "mera version rakho" par bhi doosre ka doc pehle
 * snapshot me chala jaata hai (`saveProjectDoc` ka overwrite), isliye kuch bhi
 * hamesha ke liye nahi jaata.
 */
export function ConflictBanner() {
  const conflict = useEditorStore((state) => state.conflict);
  const docVersion = useEditorStore((state) => state.docVersion);
  const reload = useEditorStore((state) => state.reloadFromServer);
  const keepMine = useEditorStore((state) => state.keepMineOnConflict);
  const [busy, setBusy] = useState(false);

  if (!conflict) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-amber/40 bg-amber/10 px-4 py-2 text-sm text-amber">
      <AlertTriangle size={16} className="shrink-0" />
      <p className="min-w-0 flex-1">
        Ye project kahin aur save ho chuka hai (server par v{conflict.serverVersion}, tumhare
        paas v{docVersion}
        {conflict.serverUpdatedAt ? ` — ${timeAgo(conflict.serverUpdatedAt)}` : ""}). Tumhara
        autosave rok diya gaya hai. Faisla tumhara:
      </p>
      <Button
        variant="ghost"
        disabled={busy}
        title="Server ka version load hoga — tumhare abhi ke badlav chale jaayenge"
        onClick={async () => {
          setBusy(true);
          await reload();
          setBusy(false);
        }}
      >
        Unka version lo
      </Button>
      <Button
        variant="primary"
        disabled={busy}
        title="Tumhara doc save hoga; server ka maujooda doc pehle version snapshot me chala jaayega"
        onClick={async () => {
          setBusy(true);
          await keepMine();
          setBusy(false);
        }}
      >
        Mera version rakho
      </Button>
    </div>
  );
}
