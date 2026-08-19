"use client";

import { RotateCcw, Save } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/Button";
import { timeAgo } from "@/lib/format";
import { useEditorStore } from "@/lib/store";

/**
 * Version snapshots — list, "Save version", aur restore.
 *
 * Restore ek **op** hai (`replaceDoc`), isliye galat version uthane par Ctrl+Z
 * bacha leta hai. Restore ke baad autosave apne aap chalti hai, matlab restore
 * DB me tabhi jaata hai jab wo sach me apply ho — aadha restore kabhi save nahi hota.
 */

interface VersionRow {
  id: string;
  label: string | null;
  createdAt: string;
}

export function VersionsPanel() {
  const projectId = useEditorStore((state) => state.projectId);
  const docVersion = useEditorStore((state) => state.docVersion);
  const saveVersion = useEditorStore((state) => state.saveVersion);
  const restoreVersion = useEditorStore((state) => state.restoreVersion);

  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await fetch(`/api/projects/${projectId}/versions`);
      const data = (await response.json().catch(() => ({}))) as {
        versions?: VersionRow[];
        reason?: string;
      };
      if (!response.ok) {
        setError(data.reason ?? `${response.status}`);
        return;
      }
      setError(null);
      setVersions(data.versions ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }, [projectId]);

  // `docVersion` badalne par dobara — autosave ne beech me snapshot banaya ho to
  // list purani nahi dikhni chahiye.
  useEffect(() => {
    void load();
  }, [load, docVersion]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-ink-600 p-3">
        <Button
          icon={<Save size={14} />}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const result = await saveVersion("manual");
            setBusy(false);
            if (!result.ok) setError(result.message ?? "snapshot nahi bana");
            else await load();
          }}
          className="w-full justify-center"
        >
          Save version
        </Button>
        {error ? <p className="mt-2 text-xs text-red-300">{error}</p> : null}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {versions.length === 0 ? (
          <p className="p-3 text-xs text-chalk-500">
            Abhi koi snapshot nahi. Autosave har 10 save ya 5 minute me ek banata hai.
          </p>
        ) : (
          <ul className="divide-y divide-ink-700">
            {versions.map((version) => (
              <li key={version.id} className="flex items-center gap-2 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-chalk-100">
                    {version.label ?? "bina naam"}
                  </div>
                  <div className="text-[11px] text-chalk-500">{timeAgo(version.createdAt)}</div>
                </div>
                <Button
                  variant="ghost"
                  icon={<RotateCcw size={13} />}
                  disabled={busy}
                  title="Ye version wapas laao (undo se hat bhi sakta hai)"
                  onClick={async () => {
                    setBusy(true);
                    const result = await restoreVersion(version.id);
                    setBusy(false);
                    if (!result.ok) setError(result.message ?? "restore nahi hua");
                  }}
                >
                  Restore
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
