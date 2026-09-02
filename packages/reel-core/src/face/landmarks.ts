/**
 * Chehre ka wo hissa jo bolti tasveer ko chahiye.
 *
 * ⚠️ **Sirf zaroori points**, poore 468 nahi. MediaPipe 468 deta hai; unme se hum
 * 400 se zyada kabhi chhuenge hi nahi, aur wo sab har asset row me jama karna use
 * bina wajah bhaari karta hai (ek tasveer par ~15KB, aur library me hazaar
 * tasveerein hoti hain).
 *
 * ⚠️ Naap **anupaat me** hai (0-1), pixel me nahi. Wahi tasveer alag naap me fit
 * ho kar aati hai (`planFit` uski frame ke hisaab se nayi copy banata hai); pixel
 * likh dene par fit ki hui copy par poora mesh khisak jaata aur muh chehre se
 * bahar chala jaata.
 */

export interface FacePoint {
  /** 0-1 — tasveer ki chaudai ka anupaat. */
  x: number;
  /** 0-1 — tasveer ki oonchai ka anupaat. */
  y: number;
}

export interface FaceData {
  version: 1;
  /** Honth ka bahari kinara. */
  lipsOuter: FacePoint[];
  /** Honth ka andaruni kinara — muh ka khulna yahin dikhta hai. */
  lipsInner: FacePoint[];
  /** Jabde ki lakeer — thodi kahan tak hai, ye isse pata chalta hai. */
  jaw: FacePoint[];
  leftEye: FacePoint[];
  rightEye: FacePoint[];
  leftBrow: FacePoint[];
  rightBrow: FacePoint[];
}

export const FACE_DATA_VERSION = 1;

/** Har khaana jo `FaceData` me hota hai — padhne aur jaanchne, dono ke liye. */
const POINT_LISTS = [
  "lipsOuter",
  "lipsInner",
  "jaw",
  "leftEye",
  "rightEye",
  "leftBrow",
  "rightBrow",
] as const;

function readPoints(value: unknown): FacePoint[] | null {
  if (!Array.isArray(value)) return null;
  const points: FacePoint[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") return null;
    const { x, y } = entry as { x?: unknown; y?: unknown };
    if (typeof x !== "number" || typeof y !== "number") return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    points.push({ x, y });
  }
  return points;
}

/**
 * Asset ke `meta` me se chehra padho — **samajh na aaye to `null`**.
 *
 * ⚠️ Ye `readWizardMemory` wali hi soch hai aur usi wajah se: ye data asset ki
 * row me pada rehta hai, aur uska shape aage badal sakta hai. Sakht parse karke
 * phat jaane par ek purani tasveer poori library ko kholna band kar deti.
 *
 * ⚠️ Par yahan ek farak hai: `null` lautne ka matlab "ye tasveer bol nahi sakti"
 * hai, aur wo UI me **saaf dikhna** chahiye — chup-chaap aadha chehra maan kar
 * aage badhna wo galti hai jo render me ek hilte hue dhabbe ki tarah nikalti hai.
 */
export function readFaceData(value: unknown): FaceData | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  if (raw.version !== FACE_DATA_VERSION) return null;

  const out = { version: FACE_DATA_VERSION } as FaceData;
  for (const key of POINT_LISTS) {
    const points = readPoints(raw[key]);
    if (!points) return null;
    out[key] = points;
  }

  /*
   * Honth ke bina ye data kisi kaam ka nahi — aur wahi is poore feature ka
   * aadhaar hai. Baaki hisse (aankh, bhaunh) khaali ho sakte hain: unke bina
   * chehra thoda kam zinda lagta hai, par bolta phir bhi hai.
   */
  if (out.lipsOuter.length < 3) return null;

  return out;
}

/** Ek list ka ghera — mesh ka region isi se banta hai. */
export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function boundsOf(points: readonly FacePoint[]): Bounds | null {
  if (points.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
}
