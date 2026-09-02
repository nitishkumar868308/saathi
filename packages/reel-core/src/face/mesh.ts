import type { EmotionDef } from "../visemes/emotions";
import type { VisemeShape } from "../visemes/shapes";
import type { Point } from "./affine";
import { boundsOf, type FaceData, type FacePoint } from "./landmarks";

/**
 * Muh ka kheencha hua mesh — bolti tasveer ka dil.
 *
 * ⚠️ Muh **asli tasveer ke apne honth se** banta hai, chipkaye hue muh se nahi.
 * Isliye rang, roshni aur texture hamesha milte hain — chipkaya hua muh chahe
 * kitna bhi achha bana ho, wo har tasveer par ek sticker jaisa hi dikhta hai,
 * aur wo dekhte hi pakda jaata hai.
 *
 * ⚠️ **Mesh ka kinara kabhi nahi hilta**, aur ye is poori file ka sabse zaroori
 * niyam hai. Har kheenchav ko kinare par 0 hona padta hai, warna kheenche hue
 * hisse aur uske aas-paas ki (bina chhui hui) tasveer ke beech ek saaf lakeer
 * ban jaati hai — muh ke chaaron taraf ek chaukor ka nishaan. Isi wajah se har
 * jagah `hFall` aur `jawProfile` guna hote hain: wo dono kinare par 0 ho jaate
 * hain.
 *
 * ⚠️ Aadhaar **tasveer ka apna muh** hai. `open` uspar jodta hai, ghatata nahi —
 * yaani `MBP` ka matlab "aur band" nahi, "jitna tasveer me hai utna" hai. Photo
 * me aam taur par honth band ya lagbhag band hote hain, isliye ye theek baithta
 * hai; aur jo cheez ho hi nahi sakti (band honth ko aur band karna) uska vaada
 * bhi nahi kiya jaata.
 */

export interface MeshTriangle {
  /** Asli tasveer me ye teen point (pixel). */
  from: [Point, Point, Point];
  /** Kheenchne ke baad wahi teen point (pixel). */
  to: [Point, Point, Point];
}

/**
 * Mesh kitna baareek.
 *
 * ⚠️ Pehle 6x5 tha aur wo kam nikla — render me muh ka neeche wala kinara ek
 * "V" jaisa polygon dikhta tha, kyunki beech sabse zyada kheenchta hai aur
 * kinare kam, aur itne kam khaanon me wo dhalaan seedhi lakeeron me toot jaati
 * thi. Aankh us tootne ko turant pakad leti hai.
 *
 * ⚠️ Isse aur badhana sasta lagta hai par muft nahi: har khaane par do triangle
 * bante hain, aur har triangle ka apna `<image>` DOM me jaata hai. 10x8 par 160
 * triangle hote hain — Chromium ke liye kuch bhi nahi, par 40x40 par wo 3200 ho
 * jaate aur har frame ka screenshot dheema pad jaata.
 */
const COLS = 10;
const ROWS = 8;

/** Muh poora khulne par neeche wala honth kitna neeche jaata hai (muh ki oonchai ke guna me). */
const JAW_TRAVEL = 1.1;

/** Gol (`round`) honth kitna simte — `wide` ke saath hi lagta hai. */
const ROUND_PINCH = 0.22;

/** Region muh se kitna bada — kinare tak kheenchav 0 ho jaata hai. */
const SIDE_PAD = 0.95;
const TOP_PAD = 1.2;
const BOTTOM_PAD = 2.2;

/** Thodi kitni der jabde ke saath poora chalti hai, uske baad dheere-dheere rukti hai. */
const CHIN_HOLD = 0.6;

function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value;
}

/** Narm dhalaan — 0 aur 1 par bilkul chapti, taaki kinare par jhatka na lage. */
function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

export interface MouthRegion {
  /** Kheenchne wala poora ilaaka (pixel). */
  left: number;
  right: number;
  top: number;
  bottom: number;
  centerX: number;
  lipTop: number;
  lipBottom: number;
  mouthWidth: number;
  mouthHeight: number;
}

/**
 * Muh ke aas-paas ka ilaaka — mesh isi par banta hai.
 *
 * ⚠️ Ilaake me **thodi bhi aati hai**, sirf honth nahi. Jabda khulne par thodi
 * honth ke saath neeche jaati hai; use bahar rakhne par honth to khulte hain par
 * thodi apni jagah jami rehti hai — aur chehra rabar jaisa dikhne lagta hai.
 */
export function mouthRegion(
  face: FaceData,
  size: { width: number; height: number },
): MouthRegion | null {
  const lips = boundsOf(face.lipsOuter);
  if (!lips) return null;

  const lipTop = lips.minY * size.height;
  const lipBottom = lips.maxY * size.height;
  const mouthWidth = (lips.maxX - lips.minX) * size.width;
  const mouthHeight = Math.max(1, lipBottom - lipTop);
  if (mouthWidth <= 0) return null;

  const centerX = ((lips.minX + lips.maxX) / 2) * size.width;

  /*
   * Neeche ki hadd jabde tak — par jabde se aage kabhi nahi. Jabda maujood na ho
   * to muh ki oonchai se andaaza, kyunki ilaaka to chahiye hi.
   */
  const jaw = boundsOf(face.jaw);
  const guessedBottom = lipBottom + mouthHeight * BOTTOM_PAD;
  const bottom = jaw ? Math.min(guessedBottom, jaw.maxY * size.height) : guessedBottom;

  return {
    left: Math.max(0, centerX - mouthWidth * SIDE_PAD),
    right: Math.min(size.width, centerX + mouthWidth * SIDE_PAD),
    top: Math.max(0, lipTop - mouthHeight * TOP_PAD),
    bottom: Math.min(size.height, Math.max(bottom, lipBottom + mouthHeight * 0.5)),
    centerX,
    lipTop,
    lipBottom,
    mouthWidth,
    mouthHeight,
  };
}

/**
 * Jabde ka asar — kaunsa point kitna neeche jaata hai.
 *
 * Upar wale honth se upar: 0 (upar ka honth jabde ke saath nahi hilta).
 * Upar se neeche wale honth tak: 0 se 1.
 * Neeche wale honth se thodi tak: poora 1 — dono ek saath chalte hain.
 * Uske baad ilaake ke kinare tak: 1 se 0.
 */
function jawProfile(y: number, region: MouthRegion): number {
  if (y <= region.lipTop) return 0;
  if (y <= region.lipBottom) {
    return smoothstep((y - region.lipTop) / Math.max(1e-6, region.lipBottom - region.lipTop));
  }
  const span = Math.max(1e-6, region.bottom - region.lipBottom);
  const t = (y - region.lipBottom) / span;
  if (t <= CHIN_HOLD) return 1;
  return 1 - smoothstep((t - CHIN_HOLD) / (1 - CHIN_HOLD));
}

/** Honth ke level par sabse zyada, ilaake ke upar-neeche kinare par 0. */
function lipProfile(y: number, region: MouthRegion): number {
  const mid = (region.lipTop + region.lipBottom) / 2;
  if (y <= mid) return smoothstep((y - region.top) / Math.max(1e-6, mid - region.top));
  return smoothstep((region.bottom - y) / Math.max(1e-6, region.bottom - mid));
}

/** Beech me poora, daayen-baayen kinare par 0. */
function sideFalloff(x: number, region: MouthRegion): number {
  const half = Math.max(1e-6, (region.right - region.left) / 2);
  return 1 - smoothstep(Math.abs(x - region.centerX) / half);
}

/** Beech me 0, muh ke kone par 1 — muskaan/udaasi wahin dikhti hai. */
function cornerness(x: number, region: MouthRegion): number {
  return smoothstep(Math.abs(x - region.centerX) / Math.max(1e-6, region.mouthWidth / 2));
}

/**
 * Ek point kahan chala jaayega.
 *
 * ⚠️ Teeno kheenchav ka nateeja kinare par 0 hai — `jawProfile`, `lipProfile` aur
 * `sideFalloff` teeno wahan 0 ho jaate hain. Ye ittefaq nahi, shart hai: kinara
 * hila to muh ke chaaron taraf ek chaukor ka nishaan dikhne lagta hai.
 */
export function displacePoint(
  point: Point,
  args: {
    region: MouthRegion;
    shape: VisemeShape;
    intensity: number;
    emotion: EmotionDef;
  },
): Point {
  const { region, shape, emotion } = args;
  const strength = clamp01(args.intensity);

  const side = sideFalloff(point.x, region);
  const lip = lipProfile(point.y, region);

  /* Muh khulna — jabda neeche. */
  const openBy = shape.open * strength * region.mouthHeight * JAW_TRAVEL;
  const dy = openBy * jawProfile(point.y, region) * side;

  /* Chaudai aur golai — dono honth ke level par sabse zyada. */
  const widthScale = 1 + (shape.wide - 1) * strength - shape.round * ROUND_PINCH * strength;
  const dx = (point.x - region.centerX) * (widthScale - 1) * lip * side;

  /*
   * Muskaan/udaasi — sirf kono par, aur `intensity` se **swatantra**.
   *
   * ⚠️ Ise `strength` se guna karna galat hoga: emotion chup rehne par bhi chehre
   * par rehta hai. Zor se baandh dene par aadmi sannate me bilkul saada dikhta
   * hai aur bolte hi khush ho jaata — jo bahut ajeeb lagta hai.
   */
  const dyCorner =
    -emotion.mouthCorner * region.mouthHeight * cornerness(point.x, region) * lip * side;

  return { x: point.x + dx, y: point.y + dy + dyCorner };
}

/**
 * Poora mesh — jaali ke har khaane se do triangle.
 *
 * Khaali list ka matlab hai "is chehre par muh banaya hi nahi ja sakta", aur wo
 * halat UI ko saaf dikhni chahiye.
 */
export function buildMouthMesh(args: {
  face: FaceData;
  /** Tasveer ka apna naap (pixel). */
  size: { width: number; height: number };
  shape: VisemeShape;
  intensity: number;
  emotion: EmotionDef;
}): MeshTriangle[] {
  if (args.size.width <= 0 || args.size.height <= 0) return [];

  const region = mouthRegion(args.face, args.size);
  if (!region) return [];
  if (region.right - region.left <= 0 || region.bottom - region.top <= 0) return [];

  /* Jaali ke saare kone — pehle asli jagah, phir kheenchi hui. */
  const grid: { from: Point; to: Point }[][] = [];
  for (let row = 0; row <= ROWS; row += 1) {
    const line: { from: Point; to: Point }[] = [];
    const y = region.top + ((region.bottom - region.top) * row) / ROWS;
    for (let col = 0; col <= COLS; col += 1) {
      const x = region.left + ((region.right - region.left) * col) / COLS;
      const from: Point = { x, y };
      line.push({ from, to: displacePoint(from, { ...args, region }) });
    }
    grid.push(line);
  }

  const triangles: MeshTriangle[] = [];
  for (let row = 0; row < ROWS; row += 1) {
    for (let col = 0; col < COLS; col += 1) {
      const a = grid[row]![col]!;
      const b = grid[row]![col + 1]!;
      const c = grid[row + 1]![col + 1]!;
      const d = grid[row + 1]![col]!;
      triangles.push({ from: [a.from, b.from, d.from], to: [a.to, b.to, d.to] });
      triangles.push({ from: [b.from, c.from, d.from], to: [b.to, c.to, d.to] });
    }
  }
  return triangles;
}

/** Ek banaya hua chehra — jaanch aur UI ke preview, dono ke liye. */
export function sampleFace(): FaceData {
  const ellipse = (cx: number, cy: number, rx: number, ry: number, count: number): FacePoint[] =>
    Array.from({ length: count }, (_, at) => {
      const angle = (at / count) * Math.PI * 2;
      return { x: cx + rx * Math.cos(angle), y: cy + ry * Math.sin(angle) };
    });

  return {
    version: 1,
    lipsOuter: ellipse(0.5, 0.7, 0.12, 0.045, 12),
    lipsInner: ellipse(0.5, 0.7, 0.09, 0.02, 12),
    jaw: ellipse(0.5, 0.62, 0.26, 0.28, 12),
    leftEye: ellipse(0.38, 0.45, 0.045, 0.02, 8),
    rightEye: ellipse(0.62, 0.45, 0.045, 0.02, 8),
    leftBrow: ellipse(0.38, 0.4, 0.055, 0.012, 6),
    rightBrow: ellipse(0.62, 0.4, 0.055, 0.012, 6),
  };
}
