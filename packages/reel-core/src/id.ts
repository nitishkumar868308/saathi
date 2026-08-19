/**
 * Id generation.
 *
 * Ids `prefix_xxxx` shape ke hote hain (`it_`, `tr_`, `sc_`, `p_`) — doc padhte
 * waqt turant pata chalta hai kis cheez ka id hai.
 *
 * Factory inject ho sakti hai taaki test/check script me ids deterministic ho
 * jaayein — warna har run ka JSON alag dikhta aur diff bekaar ho jaata.
 */

export type IdFactory = (prefix: string) => string;

let counter = 0;

const defaultFactory: IdFactory = (prefix) => {
  counter += 1;
  // time base36 + counter + thoda random: ek hi millisecond me bane do ids bhi
  // alag rehte hain, aur do alag machines ke docs merge karne par bhi.
  const time = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${time}${counter.toString(36)}${rand}`;
};

let factory: IdFactory = defaultFactory;

export function createId(prefix: string): string {
  return factory(prefix);
}

/** Test/check script isse ids ko predictable bana leta hai. */
export function setIdFactory(next: IdFactory | null): void {
  factory = next ?? defaultFactory;
}

/** Deterministic factory — `it_1`, `it_2`, … Sirf tests ke liye. */
export function createCountingIdFactory(): IdFactory {
  const counts = new Map<string, number>();
  return (prefix) => {
    const n = (counts.get(prefix) ?? 0) + 1;
    counts.set(prefix, n);
    return `${prefix}_${n}`;
  };
}
