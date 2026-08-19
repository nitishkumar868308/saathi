"use client";

import { EASINGS, cubicBezier, getEasingFunction, type Item } from "@reel/core";
import clsx from "clsx";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useEditorStore } from "@/lib/store";

/**
 * Chhota curve editor (13.9) — ek keyframe ke liye.
 *
 * **Simple rakho par asli ho** — checklist ka yahi shabd hai, aur "asli" ka
 * matlab yahan ye hai: jo curve yahan dikhta hai wo **wahi function** hai jo
 * render chalata hai (`cubicBezier` / `getEasingFunction` core se). Apna alag
 * preview banane par wo do din me asli curve se alag ho jaata aur uspar bharosa
 * khatam ho jaata.
 *
 * ⚠️ Handle 0..1 me band **nahi** hain — CSS ki tarah y ko 0 se neeche aur 1 se
 * upar jaane diya jaata hai, kyunki wahi overshoot/"bounce" wale curve banata
 * hai. x zaroor band hai: uske bahar bezier ka koi matlab hi nahi bachta (curve
 * apne aap par mud jaata hai).
 */
export function CurveEditor({
  item,
  path,
  frame,
  onClose,
}: {
  item: Item;
  path: string;
  frame: number;
  onClose(): void;
}) {
  const applyOp = useEditorStore((state) => state.applyOp);
  const keyframe = (item.keyframes[path] ?? []).find((entry) => entry.frame === frame);

  const [bezier, setBezier] = useState<[number, number, number, number]>(
    keyframe?.bezier ?? [0.42, 0, 0.58, 1],
  );
  const [custom, setCustom] = useState(Boolean(keyframe?.bezier));

  const svgRef = useRef<SVGSVGElement>(null);
  const SIZE = 220;

  if (!keyframe) return null;

  const curve = custom
    ? cubicBezier(bezier[0], bezier[1], bezier[2], bezier[3])
    : getEasingFunction(keyframe.easing);

  // Curve ki lakeer — 40 tukdon me kaafi seedhi dikhti hai.
  const points: string[] = [];
  for (let i = 0; i <= 40; i += 1) {
    const t = i / 40;
    points.push(`${t * SIZE},${SIZE - curve(t) * SIZE}`);
  }

  function dragHandle(index: 0 | 1, event: React.PointerEvent): void {
    if (!custom) return;
    event.preventDefault();
    const element = event.currentTarget as Element;
    element.setPointerCapture(event.pointerId);

    function onMove(move: PointerEvent) {
      const box = svgRef.current?.getBoundingClientRect();
      if (!box) return;
      const x = Math.min(1, Math.max(0, (move.clientX - box.left) / box.width));
      // y ulti hai (SVG me neeche zyada) aur jaan-boojhkar band nahi —
      // overshoot wale curve isi se bante hain.
      const y = 1 - (move.clientY - box.top) / box.height;

      setBezier((current) => {
        const next: [number, number, number, number] = [...current];
        next[index * 2] = Number(x.toFixed(3));
        next[index * 2 + 1] = Number(Math.min(2, Math.max(-1, y)).toFixed(3));
        return next;
      });
    }
    function onUp() {
      element.removeEventListener("pointermove", onMove as EventListener);
      element.removeEventListener("pointerup", onUp);
    }
    element.addEventListener("pointermove", onMove as EventListener);
    element.addEventListener("pointerup", onUp);
  }

  function save(): void {
    applyOp(
      "setKeyframeEasing",
      {
        itemId: item.id,
        path,
        frame,
        ...(custom ? { bezier } : { bezier: null }),
      },
      { label: "Keyframe ka curve" },
    );
    onClose();
  }

  const handleX = (index: 0 | 1): number => (bezier[index * 2] as number) * SIZE;
  const handleY = (index: 0 | 1): number => SIZE - (bezier[index * 2 + 1] as number) * SIZE;

  return (
    <Modal open title={`Curve — ${path} @ ${frame}`} onClose={onClose}>
      <div className="space-y-3">
        <svg
          ref={svgRef}
          viewBox={`-10 -30 ${SIZE + 20} ${SIZE + 60}`}
          className="w-full rounded border border-ink-600 bg-ink-900"
          style={{ touchAction: "none" }}
        >
          {/* Dabba */}
          <rect x={0} y={0} width={SIZE} height={SIZE} fill="none" stroke="#2a2a32" />
          <line x1={0} y1={SIZE} x2={SIZE} y2={0} stroke="#2a2a32" strokeDasharray="4 4" />

          {custom ? (
            <>
              <line x1={0} y1={SIZE} x2={handleX(0)} y2={handleY(0)} stroke="#84817c" />
              <line x1={SIZE} y1={0} x2={handleX(1)} y2={handleY(1)} stroke="#84817c" />
            </>
          ) : null}

          <polyline points={points.join(" ")} fill="none" stroke="#c25a37" strokeWidth={2} />

          {custom ? (
            <>
              <circle
                cx={handleX(0)}
                cy={handleY(0)}
                r={7}
                fill="#e0a458"
                className="cursor-grab"
                onPointerDown={(event) => dragHandle(0, event)}
              />
              <circle
                cx={handleX(1)}
                cy={handleY(1)}
                r={7}
                fill="#e0a458"
                className="cursor-grab"
                onPointerDown={(event) => dragHandle(1, event)}
              />
            </>
          ) : null}
        </svg>

        <div className="flex flex-wrap gap-1">
          {EASINGS.map((easing) => (
            <button
              key={easing.id}
              type="button"
              onClick={() => {
                setCustom(false);
                applyOp(
                  "setKeyframeEasing",
                  { itemId: item.id, path, frame, easing: easing.id, bezier: null },
                  { label: `Easing: ${easing.id}` },
                );
              }}
              className={clsx(
                "rounded border px-1.5 py-0.5 text-[11px] transition-colors",
                !custom && keyframe.easing === easing.id
                  ? "border-terracotta bg-terracotta/20 text-chalk-100"
                  : "border-ink-600 text-chalk-500 hover:bg-ink-700",
              )}
            >
              {easing.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-2 text-[11px] text-chalk-500">
          <input
            type="checkbox"
            checked={custom}
            onChange={(event) => setCustom(event.target.checked)}
            className="accent-terracotta"
          />
          Apna curve (handles ghaseeto)
        </label>

        {custom ? (
          <p className="font-mono text-[10px] text-chalk-500">
            cubic-bezier({bezier.join(", ")})
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <Button variant="primary" onClick={save}>
            Lagao
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Rehne do
          </Button>
        </div>
      </div>
    </Modal>
  );
}
