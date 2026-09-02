/**
 * Teen point se affine matrix — mesh warp ka poora ganit (bolti tasveer).
 *
 * ⚠️ SVG me tasveer ka ek tukda kheenchne ka tarika ye hai: destination wale
 * triangle ka `clip-path` lagao, aur poori tasveer ko ek `matrix(...)` ke saath
 * uske andar rakho. Wo matrix source triangle ko destination triangle par le
 * jaati hai. Har triangle ke liye ek aisi matrix — yahi "mesh warp" hai, aur
 * isi se asli chehre ke apne honth kheenche jaate hain (chipkaya hua muh nahi).
 *
 * ⚠️ Ye hisaab yahan hai (core me), component me nahi, kyunki iska sahi hona
 * aankh se pakda hi nahi jaata: thoda galat matrix par tasveer bas "halki si
 * ajeeb" lagti hai — koi error nahi, koi khaali frame nahi. Yahan hone se ise ek
 * script se naapa ja sakta hai, browser khole bina.
 */

export interface Point {
  x: number;
  y: number;
}

/**
 * SVG ka `matrix(a b c d e f)` — wahi kram jo SVG maangta hai.
 *
 * Lagta aise hai:
 *   x' = a*x + c*y + e
 *   y' = b*x + d*y + f
 *
 * ⚠️ `b` aur `c` ka kram dhokha deta hai: matrix ki tarah likhne par lagta hai
 * `a b` ek qatar hai, jabki SVG me `a b` ek **column** hai. Isi ek galti se
 * tasveer palat kar ya tirchi ho kar baithti hai.
 */
export interface Affine {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
}

export const IDENTITY: Affine = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };

/** Isse chhota determinant matlab teeno point ek hi lakeer par hain. */
const DEGENERATE = 1e-9;

/**
 * `from` ke teen point ko `to` ke teen point par le jaane wali matrix.
 *
 * `null` = **source** ke teeno point ek hi lakeer par hain, yaani wahan triangle
 * hai hi nahi. Aisi halat me matrix ban hi nahi sakti, aur zabardasti banane par
 * (det ko 0 se bhaag kar) `Infinity` nikalta hai — jispar tasveer poore frame par
 * kheench jaati hai.
 *
 * ⚠️ **Destination ka chapta hona bilkul jaayaz hai** aur uspar `null` nahi
 * lautta. Muh poora band hone par upar aur neeche ke honth mil jaate hain —
 * yaani destination triangle ki jagah bilkul 0 ho jaati hai. Wahi to "honth band"
 * hai. Us halat ko galti maan lene par `म`/`ब`/`प` par muh kabhi poora band hota
 * hi nahi, aur wo wahi ek galti hai jo har dekhne wala turant pakad leta hai.
 */
export function affineFromTriangles(
  from: readonly [Point, Point, Point],
  to: readonly [Point, Point, Point],
): Affine | null {
  const [s0, s1, s2] = from;
  const [d0, d1, d2] = to;

  /* Source ke do kinare — inhi par poora hisaab khada hai. */
  const ux = s1.x - s0.x;
  const uy = s1.y - s0.y;
  const vx = s2.x - s0.x;
  const vy = s2.y - s0.y;

  const det = ux * vy - vx * uy;
  if (!Number.isFinite(det) || Math.abs(det) < DEGENERATE) return null;

  /* Destination ke wahi do kinare. */
  const px = d1.x - d0.x;
  const py = d1.y - d0.y;
  const qx = d2.x - d0.x;
  const qy = d2.y - d0.y;

  const a = (px * vy - qx * uy) / det;
  const c = (qx * ux - px * vx) / det;
  const b = (py * vy - qy * uy) / det;
  const d = (qy * ux - py * vx) / det;

  if (![a, b, c, d].every(Number.isFinite)) return null;

  /*
   * Sthaanantar aakhir me: pehla point sahi jagah baith jaaye, uske baad baaki
   * do apne aap baith jaate hain (kyunki linear hissa unhi se nikla hai).
   */
  return {
    a,
    b,
    c,
    d,
    e: d0.x - a * s0.x - c * s0.y,
    f: d0.y - b * s0.x - d * s0.y,
  };
}

/** `matrix(a b c d e f)` — seedha SVG ke `transform` me jaane layak. */
export function affineToSvg(m: Affine): string {
  return `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;
}

/** Matrix ko ek point par lagao — jaanch aur hisaab dono ke liye. */
export function applyAffine(m: Affine, p: Point): Point {
  return {
    x: m.a * p.x + m.c * p.y + m.e,
    y: m.b * p.x + m.d * p.y + m.f,
  };
}

/** Teen point ka polygon — SVG ke `clip-path` me jaane layak. */
export function trianglePoints(t: readonly [Point, Point, Point]): string {
  return t.map((p) => `${p.x},${p.y}`).join(" ");
}

/*
 * ⚠️ Yahan pehle ek `inflateTriangle()` tha — har triangle ko aadha pixel phula
 * kar "jod ki lakeer" mitane ke liye. **Wo zaroori nahi nikla, isliye hata diya
 * gaya.**
 *
 * Wajah likh kar chhodi ja rahi hai taaki koi dobara wahi prayog na kare:
 * `worker/scripts/render-warp.ts` do bagal wale triangle ko alag-alag matrix se
 * kheench kar naapta hai (theek waisi halat jaisi asli muh me har frame par hoti
 * hai), aur peeche bhoora rang rakh kar ginta hai ki kitne pixel na kaale hain
 * na safed. Phulao ke saath bhi ginti 0 aati hai, aur bina phulaye bhi 0 —
 * yaani Chromium bagal wale clip ke beech koi gap chhodta hi nahi.
 *
 * Wo lakeer jo pehle "dikhi" thi, wo bani hui file me thi hi nahi — sirf use
 * dekhne wale raaste ka asar tha. Isiliye ye faisla naap se hua, aankh se nahi.
 *
 * Agar kabhi asli mesh me sach me lakeer dikhe, to pehle usi seam-ginti se
 * saabit karo — tabhi phulao wapas laao.
 */
