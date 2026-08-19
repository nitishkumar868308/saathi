"use client";

import type { ProjectSettings } from "@reel/core";
import { aspectRatioLabel } from "@reel/core";
import { Copy, Film, Pencil, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { NewProjectDialog } from "@/components/projects/NewProjectDialog";
import { Button, IconButton } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { clipLength, sizeLabel, timeAgo } from "@/lib/format";

/**
 * Project list — cards, aur create / rename / duplicate / delete.
 *
 * Sab kuch API se hota hai aur uske baad `router.refresh()` — list ka sach hamesha
 * server se aata hai. Client par apni ek "copy" rakhne se do tab ke beech list
 * hamesha jhooth bolne lagti hai, aur wahi bug is phase me sabse mehnga hai.
 */

export interface ProjectCardData {
  id: string;
  name: string;
  docVersion: number;
  updatedAt: string;
  project: ProjectSettings;
}

export function ProjectList({ projects }: { projects: ProjectCardData[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<ProjectCardData | null>(null);
  const [deleting, setDeleting] = useState<ProjectCardData | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(id: string, path: string, init: RequestInit): Promise<boolean> {
    setBusyId(id);
    setError(null);
    try {
      const response = await fetch(path, init);
      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          error?: string;
          reason?: string;
        };
        setError(data.reason ?? data.error ?? `${response.status}`);
        return false;
      }
      router.refresh();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      return false;
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-6xl p-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-chalk-500">
            {projects.length === 0
              ? "abhi ek bhi nahi"
              : `${projects.length} project${projects.length > 1 ? "s" : ""}`}
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => setCreating(true)}>
          Naya project
        </Button>
      </header>

      {error ? (
        <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          {error}
        </p>
      ) : null}

      {projects.length === 0 ? (
        <div className="mt-10 rounded-xl border border-dashed border-ink-600 p-10 text-center">
          <Film size={28} className="mx-auto text-chalk-500" />
          <p className="mt-3 text-sm text-chalk-300">Pehla project banao.</p>
          <p className="text-xs text-chalk-500">
            Default size Reel (1080×1920) hai — badal bhi sakte ho.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {projects.map((project) => (
            <li
              key={project.id}
              className="group rounded-xl border border-ink-600 bg-ink-800 p-3 transition-colors hover:border-ink-500"
            >
              <Link href={`/project/${project.id}`} className="block">
                {/* Thumbnail abhi placeholder hai — asli frame Phase 11 (export) me
                    aayegi. Shakal project ki asli aspect se banti hai. */}
                <span className="flex items-center justify-center rounded-lg bg-ink-950 p-2">
                  <span
                    className="flex max-h-32 items-center justify-center rounded border border-ink-600 bg-ink-900 text-[10px] text-chalk-500"
                    style={{
                      aspectRatio: `${project.project.width} / ${project.project.height}`,
                      ...(project.project.width >= project.project.height
                        ? { width: "100%" }
                        : { height: "8rem" }),
                    }}
                  >
                    {aspectRatioLabel(project.project.width, project.project.height)}
                  </span>
                </span>
                <span className="mt-2 block truncate text-sm text-chalk-100">
                  {project.name}
                </span>
              </Link>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-chalk-500">
                <span className="rounded bg-ink-700 px-1.5 py-0.5">
                  {sizeLabel(project.project.width, project.project.height)}
                </span>
                <span>{clipLength(project.project.durationInFrames, project.project.fps)}</span>
                <span>{project.project.fps}fps</span>
              </div>
              <div className="mt-0.5 text-[11px] text-chalk-500">
                {timeAgo(project.updatedAt)} · v{project.docVersion}
              </div>

              <div className="mt-2 flex gap-1 opacity-60 transition-opacity group-hover:opacity-100">
                <IconButton
                  title="Naam badlo"
                  aria-label="Naam badlo"
                  disabled={busyId === project.id}
                  onClick={() => setRenaming(project)}
                >
                  <Pencil size={14} />
                </IconButton>
                <IconButton
                  title="Copy banao"
                  aria-label="Copy banao"
                  disabled={busyId === project.id}
                  onClick={() =>
                    call(project.id, `/api/projects/${project.id}/duplicate`, { method: "POST" })
                  }
                >
                  <Copy size={14} />
                </IconButton>
                <IconButton
                  title="Mitao"
                  aria-label="Mitao"
                  variant="danger"
                  disabled={busyId === project.id}
                  onClick={() => setDeleting(project)}
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </li>
          ))}
        </ul>
      )}

      <NewProjectDialog
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={(id) => {
          setCreating(false);
          router.push(`/project/${id}`);
        }}
      />

      <RenameDialog
        key={renaming?.id ?? "rename-none"}
        project={renaming}
        onClose={() => setRenaming(null)}
        onSubmit={async (name) => {
          const project = renaming;
          if (!project) return;
          const done = await call(project.id, `/api/projects/${project.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name }),
          });
          if (done) setRenaming(null);
        }}
      />

      <Modal
        open={deleting !== null}
        title="Project mitao?"
        onClose={() => setDeleting(null)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Rehne do
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                const project = deleting;
                if (!project) return;
                const done = await call(project.id, `/api/projects/${project.id}`, {
                  method: "DELETE",
                });
                if (done) setDeleting(null);
              }}
            >
              Haan, mitao
            </Button>
          </>
        }
      >
        <p className="text-sm text-chalk-300">
          <span className="text-chalk-100">{deleting?.name}</span> aur uske saare version
          snapshots hamesha ke liye chale jaayenge. Ye wapas nahi aata.
        </p>
      </Modal>
    </main>
  );
}

/**
 * `key` se remount hota hai (upar dekho) — isliye state seedha project ke naam se
 * shuru hoti hai. Bina remount ke `useState` purana naam pakde rehta aur dialog
 * dobara kholne par pichhle project ka naam dikhata.
 */
function RenameDialog({
  project,
  onClose,
  onSubmit,
}: {
  project: ProjectCardData | null;
  onClose(): void;
  onSubmit(name: string): void | Promise<void>;
}) {
  const [name, setName] = useState(project?.name ?? "");

  return (
    <Modal
      open={project !== null}
      title="Naam badlo"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Rehne do
          </Button>
          <Button
            variant="primary"
            disabled={!name.trim()}
            onClick={() => void onSubmit(name.trim())}
          >
            Rakh do
          </Button>
        </>
      }
    >
      <input
        autoFocus
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && name.trim()) void onSubmit(name.trim());
        }}
        className="w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-terracotta"
      />
    </Modal>
  );
}
