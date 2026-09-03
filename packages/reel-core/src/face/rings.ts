/**
 * Connections se points ki qatar — chehre ke hisse pehchanne ka tarika.
 *
 * ⚠️ **Yahan koi index hardcode nahi hai, aur wo is file ka poora maqsad hai.**
 * MediaPipe 478 point deta hai; unme se kaunsa honth hai aur kaunsa bhaunh, ye
 * yaad se likh dena sabse aasan raasta tha aur sabse khatarnak: ek galat number
 * par mesh chehre ke kisi aur hisse par baith jaata hai, aur wo galti sirf bani
 * hui reel dekh kar pakdi jaati.
 *
 * Isliye wo jaankari **library se hi** aati hai (`FACE_LANDMARKS_LIPS` waghairah
 * — wo apne connections khud batati hai), aur ye file un connections ko ek
 * chalne layak qatar me badalti hai. Model badle to numbers apne aap badal
 * jaayenge; yahan kuch nahi badalna padega.
 *
 * Ye pure TypeScript hai — na MediaPipe ka import, na browser ka. Isliye ise ek
 * script se jaancha ja sakta hai.
 */

export interface RingConnection {
  start: number;
  end: number;
}

/**
 * Ek jude hue guchhe ko qatar me lagao.
 *
 * Ghere (jaise honth) aur lakeer (jaise bhaunh) dono chalte hain: lakeer ke sire
 * par sirf ek padosi hota hai, isliye wahin se shuru kiya jaata hai — beech se
 * shuru karne par aadhi lakeer chhoot jaati.
 */
function walk(start: number, neighbours: Map<number, number[]>, seen: Set<number>): number[] {
  const order: number[] = [];
  let at: number | undefined = start;

  while (at !== undefined && !seen.has(at)) {
    seen.add(at);
    order.push(at);
    at = (neighbours.get(at) ?? []).find((next) => !seen.has(next));
  }
  return order;
}

/**
 * Connections ke guchhe — har guchha ek hissa (bahari honth, andaruni honth…).
 *
 * Lauti hui list **bade se chhote** kram me hai (points ki ginti se), kyunki
 * bulane wale ko aksar "sabse bada wala" chahiye hota hai — bahari honth
 * andaruni se bada hota hai.
 */
export function ringsFromConnections(connections: readonly RingConnection[]): number[][] {
  const neighbours = new Map<number, number[]>();

  const link = (from: number, to: number): void => {
    const list = neighbours.get(from);
    if (list) {
      if (!list.includes(to)) list.push(to);
      return;
    }
    neighbours.set(from, [to]);
  };

  for (const edge of connections) {
    if (!Number.isInteger(edge.start) || !Number.isInteger(edge.end)) continue;
    if (edge.start === edge.end) continue;
    link(edge.start, edge.end);
    link(edge.end, edge.start);
  }

  /*
   * Lakeer ke sire pehle. Ghere me har point ke do padosi hote hain, lakeer ke
   * sire par ek — aur wahin se shuru karna zaroori hai, warna beech se chal kar
   * aadhi lakeer chhoot jaati hai.
   */
  const ends = [...neighbours.keys()]
    .filter((point) => (neighbours.get(point) ?? []).length === 1)
    .sort((a, b) => a - b);
  const rest = [...neighbours.keys()].sort((a, b) => a - b);

  const seen = new Set<number>();
  const rings: number[][] = [];

  for (const start of [...ends, ...rest]) {
    if (seen.has(start)) continue;
    const ring = walk(start, neighbours, seen);
    if (ring.length > 0) rings.push(ring);
  }

  return rings.sort((a, b) => b.length - a.length);
}

/** Sab points ek hi list me — jahan qatar ka kram maayne nahi rakhta. */
export function pointsFromConnections(connections: readonly RingConnection[]): number[] {
  return ringsFromConnections(connections).flat();
}
