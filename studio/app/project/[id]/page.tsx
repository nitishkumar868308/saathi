import { notFound } from "next/navigation";

import { Editor } from "@/components/editor/Editor";
import { loadProject } from "@/lib/projects";

/**
 * Editor page — doc server par load hota hai (migrate hokar) aur pehle hi render
 * me store me chala jaata hai. Isliye editor kabhi "loading…" dikhakar phir doc
 * ke aane ka intezaar nahi karta.
 */

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: { id: string } }) {
  const project = await loadProject(params.id);
  if (!project) notFound();

  return (
    <Editor
      // Project badalne par editor poora naya — purane project ki history,
      // selection ya adhoori autosave nayi jagah nahi ghisatni chahiye.
      key={project.id}
      project={{
        id: project.id,
        name: project.name,
        docVersion: project.docVersion,
        updatedAt: project.updatedAt,
        doc: project.doc,
      }}
    />
  );
}
