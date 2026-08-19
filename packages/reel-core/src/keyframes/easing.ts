/**
 * Easing curves — **ek hi implementation**, preview aur render dono ke liye (10.3).
 *
 * Ye alag file isliye hai ki curve ab do jagah se maange jaate hain: keyframes
 * (`interpolate.ts`) aur animations (`registry/animations.ts`). Dono ke liye do
 * copy rakhne par ek din CSS wala `ease-out` aur video wala `ease-out` alag ho
 * jaate — aur wo farak sirf side-by-side dekh kar pakda jaata hai.
 *
 * ⚠️ Bezier ka math browser wale hi tarike se hai (Newton-Raphson, phir
 * bisection), isliye editor ki CSS animation aur MP4 ki animation ek jaisi
 * lagti hain.
 */

import { DEFAULT_EASING } from "../config/easing";

/** Ek easing curve: 0..1 andar, 0..1 bahar. */
export type EasingFunction = (t: number) => number;

/**
 * Cubic-bezier solver (CSS jaisa hi).
 *
 * Newton-Raphson se x ke liye t dhoondhte hain, phir us t par y. Ye wahi tarika
 * hai jo browser use karte hain — isliye preview aur render me curve bilkul ek
 * jaisa lagta hai, aur "CSS me aur video me animation alag lag rahi hai" wali
 * pareshani hoti hi nahi.
 */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): EasingFunction {
  const curve = (a: number, b: number, t: number): number => {
    const c = 3 * a;
    const bTerm = 3 * (b - a) - c;
    const aTerm = 1 - c - bTerm;
    return ((aTerm * t + bTerm) * t + c) * t;
  };
  const slope = (a: number, b: number, t: number): number => {
    const c = 3 * a;
    const bTerm = 3 * (b - a) - c;
    const aTerm = 1 - c - bTerm;
    return (3 * aTerm * t + 2 * bTerm) * t + c;
  };

  return (x: number): number => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;

    let t = x;
    for (let i = 0; i < 8; i += 1) {
      const error = curve(x1, x2, t) - x;
      if (Math.abs(error) < 1e-6) return curve(y1, y2, t);
      const d = slope(x1, x2, t);
      // Derivative 0 ke aas-paas Newton bhaag jaata hai — tab bisection par gir jao.
      if (Math.abs(d) < 1e-6) break;
      t -= error / d;
    }

    let low = 0;
    let high = 1;
    t = x;
    for (let i = 0; i < 20; i += 1) {
      const value = curve(x1, x2, t);
      if (Math.abs(value - x) < 1e-6) break;
      if (value > x) high = t;
      else low = t;
      t = (low + high) / 2;
    }
    return curve(y1, y2, t);
  };
}

/**
 * Spring — damped harmonic oscillator, band roop me.
 *
 * ⚠️ Remotion ka apna `spring()` yahan **use nahi** kiya, aur ye jaan-boojhkar
 * hai: wo `@remotion/core` se aata hai aur `@reel/core` me Remotion ka import
 * nahi aa sakta (wahi package worker aur browser dono me chalta hai, aur
 * `check.ts` bina Remotion ke chalta hai). Yahan wahi klassik math hai jise
 * Remotion bhi use karta hai, par 0..1 ke andar band — taaki curve `t=1` par
 * theek 1 par khatam ho aur clip ke ant me ek adhoora bounce na chhoote.
 *
 * `overshoot` 0 par ye ek narm ease-out hai; badhane par uchhaal aata hai.
 */
export function spring(options: { stiffness?: number; damping?: number } = {}): EasingFunction {
  const stiffness = options.stiffness ?? 100;
  const damping = options.damping ?? 10;
  const mass = 1;

  const w0 = Math.sqrt(stiffness / mass);
  const zeta = damping / (2 * Math.sqrt(stiffness * mass));

  return (t: number): number => {
    if (t <= 0) return 0;
    if (t >= 1) return 1;

    // Curve ko ek "asli" second me sochte hain, taaki stiffness/damping ke
    // number wahi matlab rakhein jo har animation library me rakhte hain.
    const time = t;
    let value: number;

    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      value =
        1 -
        Math.exp(-zeta * w0 * time) *
          (Math.cos(wd * time) + ((zeta * w0) / wd) * Math.sin(wd * time));
    } else {
      // Critically / over-damped — koi uchhaal nahi, seedha pahunchta hai.
      value = 1 - Math.exp(-w0 * time) * (1 + w0 * time);
    }
    return value;
  };
}

/** CSS ke wahi curve, wahi numbers. */
export const EASING_FUNCTIONS: Record<string, EasingFunction> = {
  linear: (t) => t,
  ease: cubicBezier(0.25, 0.1, 0.25, 1),
  "ease-in": cubicBezier(0.42, 0, 1, 1),
  "ease-out": cubicBezier(0, 0, 0.58, 1),
  "ease-in-out": cubicBezier(0.42, 0, 0.58, 1),
  // Step: beech me kuch nahi badalta, agle keyframe par ek jhatke me badal jaata hai.
  step: () => 0,
  spring: spring(),
};

/**
 * Id se curve.
 *
 * `"cubic-bezier(0.2, 0, 0.1, 1)"` jaisa custom bhi chalta hai — CSS ki wahi
 * likhawat, taaki koi bhi curve jo web par mila ho seedha chipkaya ja sake.
 */
export function getEasingFunction(id: string): EasingFunction {
  const known = EASING_FUNCTIONS[id];
  if (known) return known;

  const custom = parseCubicBezier(id);
  if (custom) return custom;

  return EASING_FUNCTIONS[DEFAULT_EASING] ?? ((t: number) => t);
}

/** `"cubic-bezier(a,b,c,d)"` -> curve. Galat likhawat par `null`. */
export function parseCubicBezier(value: string): EasingFunction | null {
  const match = /^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/.exec(
    value.trim(),
  );
  if (!match) return null;

  const numbers = match.slice(1, 5).map(Number);
  if (numbers.some((n) => !Number.isFinite(n))) return null;
  return cubicBezier(numbers[0] as number, numbers[1] as number, numbers[2] as number, numbers[3] as number);
}

/** 0..1 me baandh do — har jagah pehli line yahi hoti hai. */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
