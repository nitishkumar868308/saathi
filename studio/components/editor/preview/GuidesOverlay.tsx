"use client";

import { GRID_DIVISIONS, requireSafeAreaGuide } from "@reel/core";

/**
 * Safe-area + grid + center lines — frame ke bilkul upar (checklist 6.10).
 *
 * Sab kuch **percent** me hai, pixel me nahi. Isliye zoom badalne, panel
 * kheenchne ya draft mode par jaane se lakeerein wahin ki wahin rehti hain —
 * scale ka hisaab dobara karne ki zaroorat hi nahi padti.
 *
 * ⚠️ `pointer-events: none` sabse zaroori line hai: iske bina overlay preview par
 * hone wale har click aur drag ko kha jaata hai, aur scrub kaam karna band kar
 * deta hai. Ye galti karke wapas dhoondhne me sabse zyada waqt jaata hai.
 */
export function GuidesOverlay({ guideId }: { guideId: string }) {
  const guide = requireSafeAreaGuide(guideId);
  const { top, right, bottom, left } = guide.insets;

  const thirds = Array.from({ length: GRID_DIVISIONS - 1 }, (_, index) =>
    ((index + 1) / GRID_DIVISIONS) * 100,
  );

  return (
    /*
     * `overflow-hidden` ke bina neeche wala `boxShadow: 0 0 0 9999px` frame ke
     * bahar nikal kar poore editor par kaali chaadar daal deta hai. Shadow hi
     * safe area ke bahar ka hissa dhundhla karta hai, isliye use hataya nahi ja
     * sakta — usko yahin kaatna padta hai.
     */
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Safe area — andar ka hissa saaf, bahar ka halka dhundhla. */}
      <div
        className="absolute border border-dashed border-terracotta/70"
        style={{
          top: `${top * 100}%`,
          left: `${left * 100}%`,
          right: `${right * 100}%`,
          bottom: `${bottom * 100}%`,
          // Bahar ka hissa is ek shadow se hi dhundhla hota hai — alag se chaar
          // div banane par har zoom par unke kinare aapas me nahi milte the.
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.28)",
        }}
      />

      {/* Rule of thirds. */}
      {thirds.map((percent) => (
        <div
          key={`v-${percent}`}
          className="absolute top-0 bottom-0 w-px bg-white/10"
          style={{ left: `${percent}%` }}
        />
      ))}
      {thirds.map((percent) => (
        <div
          key={`h-${percent}`}
          className="absolute left-0 right-0 h-px bg-white/10"
          style={{ top: `${percent}%` }}
        />
      ))}

      {/* Center lines — thodi tez, taaki thirds se alag pehchani jaayein. */}
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/25" />
      <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/25" />

      <span className="absolute left-1 top-1 rounded bg-ink-950/80 px-1 py-0.5 text-[10px] text-chalk-400">
        {guide.label}
      </span>
    </div>
  );
}
