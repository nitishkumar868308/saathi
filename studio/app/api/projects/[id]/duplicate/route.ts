import { fail, handle, ok } from "@/lib/api";
import { duplicateProject } from "@/lib/projects";

/** `POST /api/projects/[id]/duplicate` — waisa hi project, naya id, "(copy)" naam. */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface RouteContext {
  params: { id: string };
}

export async function POST(_request: Request, context: RouteContext): Promise<Response> {
  return handle(async () => {
    const project = await duplicateProject(context.params.id);
    if (!project) return fail("not found", 404, "aisa koi project nahi hai");
    return ok({ project }, 201);
  });
}
