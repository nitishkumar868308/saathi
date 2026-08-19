"use client";

import {
  selectSingle,
  validateProjectQuality,
  type ValidationIssue,
  type ValidationReport,
} from "@reel/core";
import clsx from "clsx";
import { AlertTriangle, CheckCircle2, Info, Wrench, XCircle } from "lucide-react";

import { useAssetDurations } from "@/lib/assetMeta";
import { useEditorStore } from "@/lib/store";

/**
 * Validation panel (20.8).
 *
 * ⚠️ Har issue ke saath **"Dikhao"** hota hai — wo item chunta hai aur playhead
 * uspar le jaata hai. Iske bina 40-second ki reel me "koi ek clip dhundhla hai"
 * padh kar user ko poori timeline khangalni padti hai, aur wo aksar chhod deta
 * hai.
 *
 * Auto-fix sirf wahan hai jahan **ek hi sahi jawab** ho. Jahan do jawab ho
 * sakte hain (jaise "asset gayab hai" — dobara upload karo ya clip hatao),
 * wahan button nahi hai: galat auto-fix se koi fix na hona behtar hai.
 */
export function ValidationPanel() {
  const doc = useEditorStore((state) => state.doc);
  const applyOp = useEditorStore((state) => state.applyOp);
  const setSelection = useEditorStore((state) => state.setSelection);
  const setPlayhead = useEditorStore((state) => state.setPlayhead);
  const meta = useAssetDurations(doc.project.fps);

  const assets: Record<string, { width: number | null; height: number | null; durationMs: number | null } | undefined> = {};
  for (const item of doc.items) {
    if (!item.assetId) continue;
    const size = meta.sourceSize(item.assetId);
    const frames = meta.sourceFrames(item.assetId);
    if (size === null && frames === null && !meta.loaded) continue;
    assets[item.assetId] = {
      width: size?.width ?? null,
      height: size?.height ?? null,
      durationMs: frames === null ? null : (frames / doc.project.fps) * 1000,
    };
  }

  const report: ValidationReport = validateProjectQuality({ doc, assets });

  function show(issue: ValidationIssue): void {
    if (!issue.itemId) return;
    const item = doc.items.find((entry) => entry.id === issue.itemId);
    if (!item) return;
    setSelection(selectSingle(item.id));
    setPlayhead(item.startFrame);
  }

  /**
   * Auto-fix — sirf un rules ke liye jinka ek hi sahi jawab hai.
   *
   * `null` matlab is issue ka koi safe auto-fix nahi hai, aur tab button dikhta
   * bhi nahi.
   */
  function fixFor(issue: ValidationIssue): (() => void) | null {
    const item = issue.itemId ? doc.items.find((entry) => entry.id === issue.itemId) : null;

    if (issue.ruleId === "upscale" && item && typeof issue.data?.totalScale === "number") {
      /*
       * Scale itni kam karo ki blur na aaye. `UPSCALE_WARN_FACTOR` (1.15) tak
       * theek maana jaata hai, isliye wahi target hai — 1.0 par le aana zyada
       * bada badlav hota aur user ka look bina wajah badal jaata.
       */
      const factor = 1.15 / (issue.data.totalScale as number);
      const next = Math.max(0.05, item.transform.scale * factor);
      return () =>
        applyOp(
          "setItemProperty",
          { itemId: item.id, path: "transform.scale", value: Math.round(next * 1000) / 1000 },
          { label: "Scale kam kiya" },
        );
    }

    if (issue.ruleId === "source-shorter" && item && typeof issue.data?.extraFrames === "number") {
      const extra = issue.data.extraFrames as number;
      return () =>
        applyOp(
          "trimItemEnd",
          { itemId: item.id, deltaFrames: -extra },
          { label: "Clip source jitni ki" },
        );
    }

    if (issue.ruleId === "beyond-duration" && item) {
      // Item ko project ke andar wapas le aao — uski lambai badle bina.
      const target = Math.max(0, doc.project.durationInFrames - item.durationInFrames);
      return () =>
        applyOp(
          "moveItems",
          { itemIds: [item.id], deltaFrames: target - item.startFrame },
          { label: "Clip andar laayi" },
        );
    }

    if (issue.ruleId === "zero-duration" && item) {
      return () =>
        applyOp(
          "trimItemEnd",
          { itemId: item.id, deltaFrames: doc.project.fps - item.durationInFrames },
          { label: "Lambai theek ki" },
        );
    }

    if (issue.ruleId === "clipping-risk" && typeof issue.data?.suggestedMaster === "number") {
      const volume = issue.data.suggestedMaster as number;
      return () => applyOp("setMasterAudio", { volume }, { label: "Master auto-gain" });
    }

    return null;
  }

  const groups: { label: string; issues: ValidationIssue[]; level: "error" | "warning" | "info" }[] = [
    { label: "Rok denge", issues: report.errors, level: "error" },
    { label: "Dhyan do", issues: report.warnings, level: "warning" },
    { label: "Jaankari", issues: report.recommendations, level: "info" },
  ];

  return (
    <div className="space-y-3 p-3 text-[11px]">
      {report.issues.length === 0 ? (
        <p className="flex items-center gap-1.5 text-chalk-400">
          <CheckCircle2 size={12} className="text-sage" />
          Koi dikkat nahi mili.
        </p>
      ) : null}

      {groups.map((group) =>
        group.issues.length === 0 ? null : (
          <section key={group.level} className="space-y-1">
            <h3 className="text-[10px] uppercase tracking-wide text-chalk-500">
              {group.label} ({group.issues.length})
            </h3>

            {group.issues.map((issue, index) => {
              const fix = fixFor(issue);
              return (
                <div
                  key={`${issue.ruleId}-${index}`}
                  className={clsx(
                    "rounded border px-2 py-1.5",
                    group.level === "error"
                      ? "border-red-500/40 bg-red-500/10 text-red-300"
                      : group.level === "warning"
                        ? "border-amber/40 bg-amber/10 text-amber"
                        : "border-ink-600 bg-ink-900 text-chalk-400",
                  )}
                >
                  <div className="flex items-start gap-1.5">
                    {group.level === "error" ? (
                      <XCircle size={12} className="mt-0.5 shrink-0" />
                    ) : group.level === "warning" ? (
                      <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    ) : (
                      <Info size={12} className="mt-0.5 shrink-0" />
                    )}
                    <span className="min-w-0 flex-1">{issue.message}</span>
                  </div>

                  {issue.itemId || fix ? (
                    <div className="mt-1 flex gap-1">
                      {issue.itemId ? (
                        <button
                          type="button"
                          onClick={() => show(issue)}
                          className="rounded border border-current/40 px-1.5 py-0.5 opacity-80 hover:opacity-100"
                        >
                          Dikhao
                        </button>
                      ) : null}
                      {fix ? (
                        <button
                          type="button"
                          onClick={fix}
                          title="Ye ek aam edit hai — Ctrl+Z se wapas aa jaata hai"
                          className="flex items-center gap-1 rounded border border-current/40 px-1.5 py-0.5 opacity-80 hover:opacity-100"
                        >
                          <Wrench size={10} />
                          Theek karo
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </section>
        ),
      )}

      <p className="border-t border-ink-800 pt-2 text-chalk-500">
        Yahi jaanch export ke waqt bhi chalti hai — wahan preset ka tier bhi ginti me aata hai
        (Strict me chetavni bhi rokti hai).
      </p>
    </div>
  );
}
