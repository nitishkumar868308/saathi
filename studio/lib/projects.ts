import {
  createEmptyProject,
  migrateDoc,
  parseDoc,
  setProjectProperty,
  type CreateEmptyProjectInput,
  type Doc,
  type ProjectSettings,
} from "@reel/core";

import { PROJECT_LIST_LIMIT, VERSION_LIST_LIMIT } from "@/lib/config";
import { rest, restJson, restOne, SupabaseError } from "@/lib/supabase";

/**
 * `reel_projects` / `reel_project_versions` ka poora data layer — server side.
 *
 * Do niyam is file me sabse zaroori hain:
 *
 *  1. **Load par hamesha `migrateDoc()`** — purana doc bina migrate kiye editor
 *     me pahunch gaya to save ke waqt schema fail hoti hai, ya usse bura, chup-chaap
 *     naye fields ke bina save ho jaati hai.
 *  2. **Save par optimistic check** — `where doc_version = <jo client ke paas tha>`.
 *     Ek hi query me check aur update dono hote hain, isliye do tab ke beech ka
 *     race sach me pakda jaata hai. Pehle padho-phir-likho karne se wo race
 *     do query ke beech me chhupa reh jaata.
 */

/** DB row jaisa hai waisa. */
interface ProjectRow {
  id: string;
  name: string;
  doc: unknown;
  doc_version: number;
  created_at: string;
  updated_at: string;
}

/** List page ke liye — poora doc bheje bina. */
export interface ProjectSummary {
  id: string;
  name: string;
  docVersion: number;
  createdAt: string;
  updatedAt: string;
  /** `doc->project` seedha DB se — 100KB ka doc list ke liye kheenchna bekaar hai. */
  project: ProjectSettings;
}

export interface LoadedProject {
  id: string;
  name: string;
  docVersion: number;
  createdAt: string;
  updatedAt: string;
  doc: Doc;
}

export interface ProjectVersionSummary {
  id: string;
  label: string | null;
  createdAt: string;
}

const TABLE = "reel_projects";
const VERSIONS_TABLE = "reel_project_versions";

/**
 * List ke liye sirf `doc->project` maangte hain, poora doc nahi. PostgREST khud
 * jsonb ke andar se nikaal deta hai — 20 projects ke liye ~4MB kam data.
 */
const SUMMARY_SELECT = "id,name,doc_version,created_at,updated_at,project:doc->project";

export async function listProjects(): Promise<ProjectSummary[]> {
  const rows = await restJson<{
    id: string;
    name: string;
    doc_version: number;
    created_at: string;
    updated_at: string;
    project: ProjectSettings;
  }>(`${TABLE}?select=${SUMMARY_SELECT}&order=updated_at.desc&limit=${PROJECT_LIST_LIMIT}`);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    docVersion: row.doc_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    project: row.project,
  }));
}

function toLoaded(row: ProjectRow): LoadedProject {
  return {
    id: row.id,
    name: row.name,
    // ⚠️ Yahi ek jagah hai jahan purana doc aaj ke shape me aata hai (4.5).
    doc: migrateDoc(row.doc),
    docVersion: row.doc_version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function loadProject(id: string): Promise<LoadedProject | null> {
  const row = await restOne<ProjectRow>(`${TABLE}?id=eq.${encodeURIComponent(id)}&select=*`);
  return row ? toLoaded(row) : null;
}

export type CreateProjectInput = CreateEmptyProjectInput;

/**
 * Naya project.
 *
 * `doc.project.id` aur DB row ka `id` ek hi rakhe jaate hain — do alag id rakhne
 * se har debugging me "ye kaunsa waala id hai" wala sawaal aata hai. Isliye uuid
 * pehle yahan banti hai, phir doc me bhi wahi jaati hai.
 */
export async function createProject(input: CreateProjectInput): Promise<LoadedProject> {
  const id = crypto.randomUUID();
  const empty = createEmptyProject(input);
  const doc = parseDoc({ ...empty, project: { ...empty.project, id } });

  const row = await restOne<ProjectRow>(TABLE, {
    method: "POST",
    prefer: "return=representation",
    body: { id, name: doc.project.name, doc, doc_version: 1 },
  });
  if (!row) throw new SupabaseError("Project insert se koi row wapas nahi aayi", 500, "");
  return toLoaded(row);
}

export type SaveResult =
  | { ok: true; project: LoadedProject }
  | { ok: false; conflict: true; serverVersion: number; serverUpdatedAt: string }
  | { ok: false; conflict: false; missing: true };

export interface SaveOptions {
  /**
   * Conflict jaan-boojhkar overwrite karna hai (user ne "mera version rakho" chuna).
   * Overwrite se pehle DB ka maujooda doc snapshot me chala jaata hai — isliye
   * kisi ka kaam chupchaap mitta nahi, sirf peeche chala jaata hai.
   */
  overwrite?: boolean;
}

export async function saveProjectDoc(
  id: string,
  doc: Doc,
  expectedVersion: number,
  options: SaveOptions = {},
): Promise<SaveResult> {
  const safeId = encodeURIComponent(id);

  if (options.overwrite) {
    const current = await restOne<ProjectRow>(`${TABLE}?id=eq.${safeId}&select=*`);
    if (!current) return { ok: false, conflict: false, missing: true };
    await snapshotDoc(id, current.doc, "conflict — overwrite se pehle");
    expectedVersion = current.doc_version;
  }

  const rows = await restJson<ProjectRow>(
    `${TABLE}?id=eq.${safeId}&doc_version=eq.${expectedVersion}&select=*`,
    {
      method: "PATCH",
      prefer: "return=representation",
      body: {
        doc,
        // `name` column doc se hi aata hai — do jagah naam rakhne par ek din wo
        // alag ho jaate hain aur list kuch aur dikhati hai, editor kuch aur.
        name: doc.project.name,
        doc_version: expectedVersion + 1,
      },
    },
  );

  if (rows.length > 0) return { ok: true, project: toLoaded(rows[0] as ProjectRow) };

  // Ek bhi row nahi badli — ya to project hai hi nahi, ya version aage nikal gaya.
  const current = await restOne<ProjectRow>(
    `${TABLE}?id=eq.${safeId}&select=id,doc_version,updated_at`,
  );
  if (!current) return { ok: false, conflict: false, missing: true };
  return {
    ok: false,
    conflict: true,
    serverVersion: current.doc_version,
    serverUpdatedAt: current.updated_at,
  };
}

/**
 * Rename — doc ke andar bhi, `name` column me bhi, ek hi op se (Dynamic rule 12).
 *
 * List page ke paas poora doc nahi hota, isliye ye padho → op chalao → optimistic
 * likho karta hai. Version wahi hai jo abhi padha, isliye editor ka autosave beech
 * me aa jaaye to ye rename fail hota hai (409) — chupchaap uska save nahi khaata.
 */
export async function renameProject(id: string, name: string): Promise<SaveResult> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Naam khaali nahi ho sakta");

  const current = await loadProject(id);
  if (!current) return { ok: false, conflict: false, missing: true };

  const doc = setProjectProperty(current.doc, { path: "name", value: trimmed });
  return saveProjectDoc(id, doc, current.docVersion);
}

export async function duplicateProject(id: string): Promise<LoadedProject | null> {
  const source = await loadProject(id);
  if (!source) return null;

  const newId = crypto.randomUUID();
  const name = `${source.doc.project.name} (copy)`;
  // replaceDoc/parseDoc ke bajaye seedha object banate to schema check chhoot
  // jaata; parseDoc yahan copy ko bhi utni hi sakhti se dekhta hai.
  const doc = parseDoc({ ...source.doc, project: { ...source.doc.project, id: newId, name } });

  const row = await restOne<ProjectRow>(TABLE, {
    method: "POST",
    prefer: "return=representation",
    body: { id: newId, name, doc, doc_version: 1 },
  });
  return row ? toLoaded(row) : null;
}

export async function deleteProject(id: string): Promise<boolean> {
  const rows = await restJson<{ id: string }>(
    `${TABLE}?id=eq.${encodeURIComponent(id)}&select=id`,
    { method: "DELETE", prefer: "return=representation" },
  );
  return rows.length > 0;
}

/* ------------------------------------------------------------------ versions */

/**
 * Snapshot hamesha **DB ka doc** leta hai, client ka bheja hua nahi.
 *
 * Warna "snapshot" us cheez ka banta jo shayad kabhi save hi nahi hui — aur
 * restore karne par wo aisi haalat wapas laata jo kabhi thi hi nahi.
 */
async function snapshotDoc(projectId: string, doc: unknown, label: string): Promise<void> {
  const response = await rest(VERSIONS_TABLE, {
    method: "POST",
    body: { project_id: projectId, doc, label },
  });
  if (!response.ok) {
    throw new SupabaseError(
      `Version snapshot fail (${response.status})`,
      response.status,
      await response.text(),
    );
  }
}

export async function createProjectVersion(
  projectId: string,
  label: string,
): Promise<ProjectVersionSummary | null> {
  const current = await restOne<ProjectRow>(
    `${TABLE}?id=eq.${encodeURIComponent(projectId)}&select=*`,
  );
  if (!current) return null;

  const row = await restOne<{ id: string; label: string | null; created_at: string }>(
    VERSIONS_TABLE,
    {
      method: "POST",
      prefer: "return=representation",
      body: { project_id: projectId, doc: current.doc, label },
    },
  );
  return row ? { id: row.id, label: row.label, createdAt: row.created_at } : null;
}

export async function listProjectVersions(
  projectId: string,
): Promise<ProjectVersionSummary[]> {
  const rows = await restJson<{ id: string; label: string | null; created_at: string }>(
    `${VERSIONS_TABLE}?project_id=eq.${encodeURIComponent(projectId)}` +
      `&select=id,label,created_at&order=created_at.desc&limit=${VERSION_LIST_LIMIT}`,
  );
  return rows.map((row) => ({ id: row.id, label: row.label, createdAt: row.created_at }));
}

/** Ek version ka doc — restore ke liye. Ye bhi migrate hokar aata hai. */
export async function loadProjectVersionDoc(
  projectId: string,
  versionId: string,
): Promise<Doc | null> {
  const row = await restOne<{ doc: unknown }>(
    `${VERSIONS_TABLE}?id=eq.${encodeURIComponent(versionId)}` +
      `&project_id=eq.${encodeURIComponent(projectId)}&select=doc`,
  );
  return row ? migrateDoc(row.doc) : null;
}
