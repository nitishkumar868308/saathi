"use client";

import { acceptAttribute, formatBytes, getLibraryTab, LIBRARY_TABS } from "@reel/core";
import clsx from "clsx";
import { LayoutGrid, List, Search, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { AssetCard } from "@/components/media/AssetCard";
import { AssetDetailDialog } from "@/components/media/AssetDetailDialog";
import { Button, IconButton } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import type { Asset } from "@/lib/assets";
import { useEditorStore } from "@/lib/store";
import { useUploader, type UploadTask } from "@/lib/upload/uploader";

/**
 * Media library — LeftSidebar ka panel.
 *
 * Tabs `LIBRARY_TABS` registry se bante hain, aur filter bhi wahin se jaata hai
 * (`?tab=music`) — yahan na koi kind likhi hai, na koi tag. Naya tab jodna
 * `packages/reel-core/src/registry/assetKinds.ts` me ek entry hai.
 *
 * Andar aane ke teen raaste, teeno chalu: **drag-drop**, **file picker**, aur
 * **clipboard paste** (screenshot seedha chipka do).
 */

type View = "grid" | "list";

export function MediaPanel() {
  const project = useEditorStore((state) => state.doc.project);

  const [tabId, setTabId] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"recent" | "name" | "size">("recent");
  const [view, setView] = useState<View>("grid");

  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Asset | null>(null);
  const [dragging, setDragging] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const tab = getLibraryTab(tabId) ?? LIBRARY_TABS[0];

  const load = useCallback(async () => {
    setError(null);
    try {
      const params = new URLSearchParams({ tab: tabId, sort });
      if (search.trim()) params.set("q", search.trim());
      const response = await fetch(`/api/assets?${params.toString()}`);
      const data = (await response.json().catch(() => ({}))) as {
        assets?: Asset[];
        reason?: string;
      };
      if (!response.ok) {
        setError(data.reason ?? `${response.status}`);
        return;
      }
      setAssets(data.assets ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, [tabId, sort, search]);

  // Search par har akshar ke saath query bhejne se DB par bekaar bojh padta hai.
  useEffect(() => {
    const timer = setTimeout(() => void load(), search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [load, search]);

  const uploader = useUploader({
    // Tab se upload karne par uska tag apne aap lag jaata hai — "Music" tab me
    // daali hui file agli baar wahin milni chahiye.
    ...(tab?.tag && tab.appliesTagOnUpload ? { tags: [tab.tag] } : {}),
    onFinished: () => void load(),
  });
  const { addFiles } = uploader;

  /*
   * Clipboard paste — screenshot ke liye sabse tez raasta.
   *
   * Listener poore document par hai par sirf tab chalta hai jab focus kisi
   * input me na ho; warna naam type karte waqt paste karna file upload kar deta.
   */
  useEffect(() => {
    function onPaste(event: ClipboardEvent) {
      const target = event.target;
      if (target instanceof HTMLElement) {
        const tag = target.tagName.toLowerCase();
        if (tag === "input" || tag === "textarea" || target.isContentEditable) return;
      }
      const files = [...(event.clipboardData?.files ?? [])];
      if (files.length === 0) return;
      event.preventDefault();
      addFiles(files);
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
    // `addFiles` `useCallback` se sthir hai; poore `uploader` par depend karne se
    // ye listener har render par utarta-chadhta rehta.
  }, [addFiles]);

  return (
    <div
      ref={rootRef}
      // Drop zone ka nishaan — end-to-end test isi par file girata hai.
      data-dropzone="media"
      className="flex h-full min-h-0 flex-col"
      onDragOver={(event) => {
        // preventDefault na karo to browser file ko naye tab me khol deta hai.
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (!rootRef.current?.contains(event.relatedTarget as Node | null)) setDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        const files = [...event.dataTransfer.files];
        if (files.length > 0) uploader.addFiles(files);
      }}
    >
      <nav className="flex shrink-0 flex-wrap gap-1 border-b border-ink-600 px-2 py-1.5">
        {LIBRARY_TABS.map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setTabId(entry.id)}
            title={entry.label}
            className={clsx(
              "flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] transition-colors",
              entry.id === tabId
                ? "bg-terracotta/15 text-chalk-100"
                : "text-chalk-500 hover:bg-ink-700 hover:text-chalk-300",
            )}
          >
            <Icon name={entry.icon} size={12} />
            {entry.label}
          </button>
        ))}
      </nav>

      <div className="flex shrink-0 items-center gap-1 border-b border-ink-600 px-2 py-1.5">
        <span className="relative min-w-0 flex-1">
          <Search
            size={12}
            className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-chalk-500"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="dhoondho"
            className="w-full rounded-md border border-ink-600 bg-ink-900 py-1 pl-6 pr-2 text-xs outline-none focus:border-terracotta"
          />
        </span>
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as typeof sort)}
          title="Kram"
          className="rounded-md border border-ink-600 bg-ink-900 px-1 py-1 text-xs outline-none"
        >
          <option value="recent">Naya pehle</option>
          <option value="name">Naam</option>
          <option value="size">Size</option>
        </select>
        <IconButton
          onClick={() => setView(view === "grid" ? "list" : "grid")}
          title={view === "grid" ? "List me dikhao" : "Grid me dikhao"}
          aria-label="View badlo"
          className="h-7 w-7"
        >
          {view === "grid" ? <List size={13} /> : <LayoutGrid size={13} />}
        </IconButton>
      </div>

      <div className="shrink-0 border-b border-ink-600 p-2">
        <input
          ref={inputRef}
          type="file"
          multiple
          // `accept` bhi registry se banti hai — nayi kism apne aap chun'ne
          // layak ho jaati hai.
          accept={acceptAttribute()}
          className="hidden"
          onChange={(event) => {
            const files = [...(event.target.files ?? [])];
            if (files.length > 0) uploader.addFiles(files);
            event.target.value = "";
          }}
        />
        <Button
          icon={<Upload size={13} />}
          onClick={() => inputRef.current?.click()}
          className={clsx(
            "w-full justify-center border-dashed text-xs",
            dragging && "border-terracotta bg-terracotta/10",
          )}
        >
          {dragging ? "Yahan chhod do" : "Upload / drag / paste"}
        </Button>
      </div>

      {uploader.tasks.length > 0 ? (
        <UploadQueue uploader={uploader} />
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto p-2">
        {error ? (
          <p className="rounded-md border border-red-500/40 bg-red-500/10 p-2 text-xs text-red-300">
            {error}
          </p>
        ) : loading ? (
          <p className="text-xs text-chalk-500">load ho raha hai…</p>
        ) : assets.length === 0 ? (
          <p className="text-xs text-chalk-500">
            {search ? "kuch nahi mila" : "yahan abhi kuch nahi — upload karo"}
          </p>
        ) : view === "grid" ? (
          <div className="grid grid-cols-2 gap-2">
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                view="grid"
                target={project}
                selected={open?.id === asset.id}
                onOpen={setOpen}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-0.5">
            {assets.map((asset) => (
              <AssetCard
                key={asset.id}
                asset={asset}
                view="list"
                target={project}
                selected={open?.id === asset.id}
                onOpen={setOpen}
              />
            ))}
          </div>
        )}
      </div>

      <AssetDetailDialog
        asset={open}
        target={project}
        onClose={() => setOpen(null)}
        onChanged={(asset) => {
          setOpen(asset);
          setAssets((list) => list.map((entry) => (entry.id === asset.id ? asset : entry)));
        }}
        onDeleted={(assetId) => {
          setOpen(null);
          setAssets((list) => list.filter((entry) => entry.id !== assetId));
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------ upload queue */

const PHASE_LABEL: Record<UploadTask["phase"], string> = {
  waiting: "line me",
  hashing: "checksum",
  uploading: "chadh raha hai",
  finishing: "probe",
  done: "ho gaya",
  duplicate: "pehle se hai",
  error: "fail",
  cancelled: "cancel",
};

function UploadQueue({ uploader }: { uploader: ReturnType<typeof useUploader> }) {
  return (
    <div className="max-h-40 shrink-0 overflow-auto border-b border-ink-600 p-2">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wide text-chalk-500">Uploads</span>
        {!uploader.busy ? (
          <button
            type="button"
            onClick={uploader.clearFinished}
            className="text-[11px] text-chalk-500 underline"
          >
            saaf karo
          </button>
        ) : null}
      </div>

      <ul className="space-y-1">
        {uploader.tasks.map((task) => (
          <li key={task.id} className="rounded-md bg-ink-900 px-2 py-1">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-[11px] text-chalk-300">
                {task.file.name}
              </span>
              <span className="shrink-0 text-[10px] text-chalk-500">
                {PHASE_LABEL[task.phase]}
              </span>
              {task.phase === "error" ? (
                <button
                  type="button"
                  onClick={() => uploader.retry(task.id)}
                  className="shrink-0 text-[10px] text-amber underline"
                >
                  phir se
                </button>
              ) : null}
              {["waiting", "hashing", "uploading", "finishing"].includes(task.phase) ? (
                <button
                  type="button"
                  onClick={() => uploader.cancel(task.id)}
                  title="Cancel"
                  className="shrink-0 text-chalk-500 hover:text-red-300"
                >
                  <X size={12} />
                </button>
              ) : null}
            </div>

            <div className="mt-1 flex items-center gap-2">
              <span className="h-1 flex-1 overflow-hidden rounded bg-ink-700">
                <span
                  className={clsx(
                    "block h-full transition-[width]",
                    task.phase === "error"
                      ? "bg-red-400"
                      : task.phase === "duplicate"
                        ? "bg-amber"
                        : "bg-terracotta",
                  )}
                  style={{ width: `${Math.round(task.progress * 100)}%` }}
                />
              </span>
              <span className="shrink-0 text-[10px] text-chalk-500">
                {formatBytes(task.file.size)}
              </span>
            </div>

            {task.error ? (
              <p className="mt-0.5 text-[10px] text-red-300">{task.error}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
