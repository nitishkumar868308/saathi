import { z } from "zod";

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

export const FacePointSchema = z.object({
  /** 0-1 — tasveer ki chaudai ka anupaat. */
  x: z.number().finite(),
  /** 0-1 — tasveer ki oonchai ka anupaat. */
  y: z.number().finite(),
});

export const FACE_DATA_VERSION = 1;

/**
 * ⚠️ Schema **yahan** hai, `schema/project.ts` me nahi, aur wo jaan-boojhkar hai.
 * Ye data do jagah chahiye — item ke andar (render ke liye) aur asset ke `meta`
 * me (dobara na naapna pade). Do jagah alag-alag likhne par wo ek din alag ho
 * jaate hain, aur tab ek jagah ka bana hua data doosri jagah parse hona band kar
 * deta hai — bina kisi saaf wajah ke.
 *
 * ⚠️ `lipsOuter` par kam se kam teen point ki shart schema me hai. Honth ke bina
 * ye data kisi kaam ka nahi, aur use aage jaane dena matlab render me ek khaali
 * mesh — yaani ek bilkul sthir chehra, bina kisi error ke.
 */
export const FaceDataSchema = z.object({
  version: z.literal(FACE_DATA_VERSION),
  /** Honth ka bahari kinara. */
  lipsOuter: z.array(FacePointSchema).min(3),
  /** Honth ka andaruni kinara — muh ka khulna yahin dikhta hai. */
  lipsInner: z.array(FacePointSchema),
  /** Jabde ki lakeer — thodi kahan tak hai, ye isse pata chalta hai. */
  jaw: z.array(FacePointSchema),
  /*
   * ⚠️ Ye chaaron khaali ho sakte hain. Inke bina chehra kam zinda lagta hai
   * (palak nahi jhapakti, bhaunh nahi hilti) par bolta phir bhi hai — aur "kam
   * zinda" ko "bilkul nahi" bana dena galat sauda hai.
   */
  leftEye: z.array(FacePointSchema),
  rightEye: z.array(FacePointSchema),
  leftBrow: z.array(FacePointSchema),
  rightBrow: z.array(FacePointSchema),
});

export type FacePoint = z.infer<typeof FacePointSchema>;
export type FaceData = z.infer<typeof FaceDataSchema>;

/**
 * Asset ke `meta` me se chehra padho — **samajh na aaye to `null`**.
 *
 * ⚠️ `null` ka matlab "ye tasveer bol nahi sakti" hai, aur wo UI me **saaf
 * dikhna** chahiye — chup-chaap aadha chehra maan kar aage badhna wo galti hai
 * jo render me ek hilte hue dhabbe ki tarah nikalti hai.
 */
export function readFaceData(value: unknown): FaceData | null {
  const parsed = FaceDataSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
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
