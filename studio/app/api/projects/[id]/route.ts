import { parseDoc } from "@reel/core";
import { z } from "zod";

import { fail, handle, ok, readBody } from "@/lib/api";
import { RenameProjectSchema } from "@/lib/project-input";
import { deleteProject, loadProject, renameProject, saveProjectDoc } from "@/lib/projects";

/**
 * `GET    /api/projects/[id]` — doc `migrateDoc()` se guzarkar (4.5)
 * `PATCH  /api/projects/[id]` — doc save (optimistic, 4.6) ya sirf rename
 * `DELETE /api/projects/[id]` — project mitao
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

/**
 * Do tarah ki PATCH: poora doc (editor ka autosave) ya sirf naam (list page).
 *
 * List page ke paas poora doc hota hi nahi — usse rename ke liye pehle 100KB
 * download karwana bekaar hai. Dono raaste andar ek hi `saveProjectDoc` par
 * milte hain, isliye optimistic check dono par lagta hai.
 */
const SaveDocSchema = z.object({
  // `z.unknown()` yahan jaan-boojhkar nahi: usse property optional ho jaati hai
  // aur `"doc" in body` se union narrow karna band ho jaata hai. Doc object hai,
  // to schema me bhi object hi likha hai — asli jaanch `parseDoc` karta hai.
  doc: z.record(z.string(), z.unknown()),
  doc_version: z.number().int().min(1),
  /** User ne conflict banner me "mera version rakho" chuna. */
  overwrite: z.boolean().optional(),
});

const PatchSchema = z.union([SaveDocSchema, RenameProjectSchema]);

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  return handle(async () => {
    const project = await loadProject(context.params.id);
    if (!project) return fail("not found", 404, "aisa koi project nahi hai");
    return ok({ project });
  });
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  return handle(async () => {
    const body = await readBody(request, PatchSchema);
    if (!body.ok) return body.response;

    const result =
      "doc" in body.data
        ? await saveDoc(context.params.id, body.data)
        : await renameProject(context.params.id, body.data.name);

    if (result instanceof Response) return result;

    if (result.ok) {
      return ok({
        doc_version: result.project.docVersion,
        updated_at: result.project.updatedAt,
        name: result.project.name,
      });
    }
    if (!result.conflict) return fail("not found", 404, "aisa koi project nahi hai");

    /*
     * 409 — aur yahi is poore phase ki sabse zaroori line hai.
     *
     * Doosri tab (ya list page ka rename) beech me save kar chuki hai. Chupchaap
     * overwrite karna sabse aasan hota aur sabse mehnga bhi: kisi ko pata bhi
     * nahi chalta ki 20 minute ka kaam kahan gaya. Client ko asli version
     * bhejte hain taaki wo saaf poochh sake — kiska version rakhna hai.
     */
    return Response.json(
      {
        error: "conflict",
        reason: "ye project kahin aur save ho chuka hai",
        serverVersion: result.serverVersion,
        serverUpdatedAt: result.serverUpdatedAt,
      },
      { status: 409 },
    );
  });
}

async function saveDoc(
  id: string,
  body: z.infer<typeof SaveDocSchema>,
): Promise<Awaited<ReturnType<typeof saveProjectDoc>> | Response> {
  // Galat doc DB me jaana sabse buri failure hai — wo agli baar khulta hi nahi.
  const parsed = parseDocSafely(body.doc);
  if ("error" in parsed) return fail("bad doc", 400, parsed.error);

  return saveProjectDoc(id, parsed.doc, body.doc_version, {
    ...(body.overwrite ? { overwrite: true } : {}),
  });
}

function parseDocSafely(input: unknown): { doc: ReturnType<typeof parseDoc> } | { error: string } {
  try {
    return { doc: parseDoc(input) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<Response> {
  return handle(async () => {
    const deleted = await deleteProject(context.params.id);
    if (!deleted) return fail("not found", 404, "aisa koi project nahi hai");
    return ok({ deleted: true });
  });
}
