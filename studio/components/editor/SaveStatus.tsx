"use client";

import clsx from "clsx";
import { AlertTriangle, Check, CloudOff, Loader2, Pencil } from "lucide-react";

import type { SaveStatus as Status } from "@/lib/autosave";
import { useEditorStore } from "@/lib/store";

/**
 * Save ka haal — saaf shabdon me.
 *
 * "Saving…" aur "Saved" me farak dikhna zaroori hai, par usse zyada zaroori
 * "Save failed — retrying" dikhna hai. Chupchaap retry karte rehna sabse khatarnak
 * haalat hai: screen par sab theek dikhta hai aur DB me kuch nahi ja raha.
 */

const LOOK: Record<Status, { text: string; className: string; spin?: boolean }> = {
  saved: { text: "Saved", className: "text-chalk-500" },
  dirty: { text: "Save hone wala hai…", className: "text-chalk-500" },
  saving: { text: "Saving…", className: "text-chalk-300", spin: true },
  retrying: { text: "Save fail — dobara koshish", className: "text-amber" },
  conflict: { text: "Conflict — faisla chahiye", className: "text-amber" },
  error: { text: "Save nahi hua", className: "text-red-300" },
};

function Icon({ status }: { status: Status }) {
  const size = 13;
  if (status === "saving") return <Loader2 size={size} className="animate-spin" />;
  if (status === "saved") return <Check size={size} />;
  if (status === "dirty") return <Pencil size={size} />;
  if (status === "error") return <CloudOff size={size} />;
  return <AlertTriangle size={size} />;
}

export function SaveStatus() {
  const status = useEditorStore((state) => state.saveStatus);
  const message = useEditorStore((state) => state.saveMessage);
  const look = LOOK[status];

  return (
    <span
      className={clsx("inline-flex items-center gap-1.5 text-xs", look.className)}
      title={message ?? undefined}
    >
      <Icon status={status} />
      {look.text}
    </span>
  );
}
