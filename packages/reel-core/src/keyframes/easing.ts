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

/* ------------------------------------------------------- curve ko todna */

/** Named easing ke peeche ke bezier control points. */
const NAMED_BEZIER: Record<string, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  ease: [0.25, 0.1, 0.25, 1],
  "ease-in": [0.42, 0, 1, 1],
  "ease-out": [0, 0, 0.58, 1],
  "ease-in-out": [0.42, 0, 0.58, 1],
};

/** Easing id ya custom bezier se control points. Spring/step ka bezier nahi hota. */
export function bezierOf(
  easing: string,
  custom?: readonly number[] | null,
): [number, number, number, number] | null {
  if (custom && custom.length === 4) {
    return [custom[0] as number, custom[1] as number, custom[2] as number, custom[3] as number];
  }
  return NAMED_BEZIER[easing] ?? parseNamedBezier(easing);
}

function parseNamedBezier(value: string): [number, number, number, number] | null {
  const match = /^cubic-bezier\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)$/.exec(
    value.trim(),
  );
  if (!match) return null;
  const numbers = match.slice(1, 5).map(Number);
  if (numbers.some((n) => !Number.isFinite(n))) return null;
  return [numbers[0] as number, numbers[1] as number, numbers[2] as number, numbers[3] as number];
}

/** Bezier ka x, parameter t par. */
function bezierAxis(p1: number, p2: number, t: number): number {
  const mt = 1 - t;
  return 3 * mt * mt * t * p1 + 3 * mt * t * t * p2 + t * t * t;
}

/** `x` ke liye `t` — Newton, phir bisection (wahi tarika jo browser use karta hai). */
function solveT(x1: number, x2: number, x: number): number {
  let t = x;
  for (let i = 0; i < 8; i += 1) {
    const error = bezierAxis(x1, x2, t) - x;
    if (Math.abs(error) < 1e-7) return t;
    const mt = 1 - t;
    const d = 3 * mt * mt * x1 + 6 * mt * t * (x2 - x1) + 3 * t * t * (1 - x2);
    if (Math.abs(d) < 1e-7) break;
    t -= error / d;
  }
  let low = 0;
  let high = 1;
  t = x;
  for (let i = 0; i < 30; i += 1) {
    const value = bezierAxis(x1, x2, t);
    if (Math.abs(value - x) < 1e-7) break;
    if (value > x) high = t;
    else low = t;
    t = (low + high) / 2;
  }
  return t;
}

export interface SplitEasing {
  left: [number, number, number, number];
  right: [number, number, number, number];
}

/**
 * Ek easing curve ko `u` (0..1 waqt) par **do curve me todo**.
 *
 * ⚠️ Ye jaan-boojhkar poora ganit hai, aur uski wajah ek asli galti hai jo test
 * se pakdi gayi. Clip ko beech se kaatne par dono aadhon me wahi easing dobara
 * laga dena aasan lagta hai — par tab curve ki **shakl badal jaati hai**. Ek
 * ease-in-out ke do aadhe, dono ease-in-out nahi hote: pehla aadha ease-in hota
 * hai aur doosra ease-out. Dobara laga dene se cut ke aas-paas animation ki
 * raftaar badal jaati hai, aur wo dekh kar "kuch to ajeeb hai" lagta hai par
 * wajah kabhi pakad me nahi aati.
 *
 * De Casteljau se curve sach me tut'ta hai, phir dono tukde apne-apne dabbe me
 * dobara naape jaate hain (0..1 me). Uske baad split se pehle aur baad ki
 * animation bilkul ek jaisi chalti hai.
 *
 * `null` tab jab todna ho hi na sake — kinare par (u=0 ya 1), ya jis easing ka
 * bezier hota hi nahi (spring, step).
 */
export function splitEasing(
  easing: string,
  custom: readonly number[] | null | undefined,
  u: number,
): SplitEasing | null {
  if (u <= 1e-6 || u >= 1 - 1e-6) return null;

  const bezier = bezierOf(easing, custom);
  if (!bezier) return null;

  const [x1, y1, x2, y2] = bezier;
  const t = solveT(x1, x2, u);

  // De Casteljau — dono axis par alag-alag, control points (0,0) (x1,y1) (x2,y2) (1,1).
  const split = (a0: number, a1: number, a2: number, a3: number) => {
    const b0 = a0 + (a1 - a0) * t;
    const b1 = a1 + (a2 - a1) * t;
    const b2 = a2 + (a3 - a2) * t;
    const c0 = b0 + (b1 - b0) * t;
    const c1 = b1 + (b2 - b1) * t;
    const mid = c0 + (c1 - c0) * t;
    return { b0, c0, mid, c1, b2 };
  };

  const xs = split(0, x1, x2, 1);
  const ys = split(0, y1, y2, 1);

  const midX = xs.mid;
  const midY = ys.mid;
  if (midX <= 1e-6 || midX >= 1 - 1e-6) return null;
  // Value bilkul nahi badli (do keyframes ki value ek jaisi) — tab y ka dabba
  // hi khatam ho jaata hai aur normalize karne ka koi matlab nahi.
  if (Math.abs(midY) <= 1e-9 || Math.abs(1 - midY) <= 1e-9) return null;

  return {
    left: [xs.b0 / midX, ys.b0 / midY, xs.c0 / midX, ys.c0 / midY],
    right: [
      (xs.c1 - midX) / (1 - midX),
      (ys.c1 - midY) / (1 - midY),
      (xs.b2 - midX) / (1 - midX),
      (ys.b2 - midY) / (1 - midY),
    ],
  };
}
