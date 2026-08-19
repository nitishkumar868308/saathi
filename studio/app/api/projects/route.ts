import { fail, handle, ok, readBody } from "@/lib/api";
import { NewProjectInputSchema } from "@/lib/project-input";
import { createProject, listProjects } from "@/lib/projects";

/**
 * `GET /api/projects`  — list (card ke liye sirf `doc->project`, poora doc nahi)
 * `POST /api/projects` — naya project (size + fps README section 3B ki list se)
 *
 * Auth `middleware.ts` me hai, yahan dobara nahi — do jagah pehra rakhne se ek
 * din wo do alag pehre ban jaate hain.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return handle(async () => ok({ projects: await listProjects() }));
}

export async function POST(request: Request): Promise<Response> {
  return handle(async () => {
    const body = await readBody(request, NewProjectInputSchema);
    if (!body.ok) return body.response;

    const { name, presetId, width, height, fps, durationInSeconds } = body.data;
    try {
      const project = await createProject({
        ...(name ? { name } : {}),
        presetId,
        ...(width === undefined ? {} : { width }),
        ...(height === undefined ? {} : { height }),
        fps,
        durationInSeconds,
      });
      return ok({ project }, 201);
    } catch (error) {
      // `resolveSize`/`parseDoc` ki apni shikayat client ke liye seedhi samajhne
      // layak hoti hai — usko 500 me badalna sirf debugging mushkil karta hai.
      if (error instanceof Error && /size|dimension|width|height/i.test(error.message)) {
        return fail("bad request", 400, error.message);
      }
      throw error;
    }
  });
}
