import { fail, handle, ok } from "@/lib/api";
import { loadProjectVersionDoc } from "@/lib/projects";

/**
 * `GET /api/projects/[id]/versions/[versionId]` — us snapshot ka doc.
 *
 * Restore **server par nahi hota**. Client is doc ko `replaceDoc` op se lagata
 * hai, taaki galat version restore karne par Ctrl+Z se wapas aaya ja sake (4.10).
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string; versionId: string };
}

export async function GET(_request: Request, context: RouteContext): Promise<Response> {
  return handle(async () => {
    const doc = await loadProjectVersionDoc(context.params.id, context.params.versionId);
    if (!doc) return fail("not found", 404, "ye version is project ka nahi hai");
    return ok({ doc });
  });
}
