"use client";

import { aspectRatioLabel, framesToTimecode, getSizePreset } from "@reel/core";

import { useEditorStore } from "@/lib/store";

/**
 * Project ki asli settings — sirf padhne ke liye.
 *
 * Size / fps badalna abhi **nahi** hai, aur isliye yahan uska koi button bhi
 * nahi hai. Size badalne ka matlab hai saare items ko naye frame me re-fit karna
 * (README 3B) — wo apna kaam hai, aur aadha bana hua wo poori reel tod deta.
 */
export function ProjectPanel() {
  const doc = useEditorStore((state) => state.doc);

  const { project } = doc;
  const preset = getSizePreset(project.sizePresetId);

  const rows: [string, string][] = [
    ["Size", `${project.width}×${project.height}`],
    ["Aspect", aspectRatioLabel(project.width, project.height)],
    ["Preset", preset?.label ?? project.sizePresetId],
    ["fps", String(project.fps)],
    ["Lambai", framesToTimecode(project.durationInFrames, project.fps, { compact: true })],
    ["Frames", String(project.durationInFrames)],
    ["Tracks", String(doc.tracks.length)],
    ["Items", String(doc.items.length)],
  ];

  return (
    <div className="space-y-4 p-3">
      <dl className="space-y-1.5">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-baseline justify-between gap-2 text-sm">
            <dt className="text-chalk-500">{label}</dt>
            <dd className="font-mono text-chalk-100">{value}</dd>
          </div>
        ))}
      </dl>

      <p className="text-xs leading-relaxed text-chalk-500">
        Size aur fps project banate waqt tay hote hain. Inhe baad me badalne par saare items
        naye frame me fit karne padte hain — wo alag kaam hai, isliye abhi yahan uska button
        nahi hai.
      </p>
    </div>
  );
}
