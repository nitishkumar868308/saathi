import { ProjectList } from "@/components/projects/ProjectList";
import { listProjects } from "@/lib/projects";
import { supabaseConfigured } from "@/lib/supabase";

/**
 * Project list — server component.
 *
 * List seedha DB se aati hai (client se ek fetch kam, aur pehli paint par khaali
 * screen bhi nahi). Create / rename / delete phir bhi API routes se hote hain,
 * kyunki wahi ek jagah hai jahan optimistic check aur validation lagti hai.
 */

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (!supabaseConfigured()) return <SetupNotice />;

  try {
    const projects = await listProjects();
    return <ProjectList projects={projects} />;
  } catch (error) {
    // Chupchaap khaali list dikhana sabse bura jawab hota — "mere saare project
    // gayab ho gaye" jaisa lagta hai, jabki asal me DB tak baat hi nahi pahunchi.
    return (
      <main className="mx-auto w-full max-w-2xl p-6">
        <h1 className="text-xl font-semibold tracking-tight">Projects</h1>
        <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">
          Database se list nahi aayi: {error instanceof Error ? error.message : String(error)}
        </p>
      </main>
    );
  }
}

function SetupNotice() {
  return (
    <main className="mx-auto w-full max-w-2xl p-6">
      <h1 className="text-xl font-semibold tracking-tight">AI Reel Studio</h1>
      <div className="mt-4 rounded-md border border-amber/40 bg-amber/10 p-4 text-sm text-amber">
        <p className="font-medium">Supabase ka env set nahi hai.</p>
        <p className="mt-1">
          <code className="font-mono">studio/.env.local</code> me{" "}
          <code className="font-mono">SUPABASE_URL</code> aur{" "}
          <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> daalo
          (<code className="font-mono">studio/.env.local.example</code> dekho), phir dev server
          dobara chalao.
        </p>
      </div>
    </main>
  );
}
