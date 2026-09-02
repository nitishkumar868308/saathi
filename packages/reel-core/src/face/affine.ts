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

/**
 * Triangle ko apne beech se bahar ki taraf thoda phulao — **jod ki lakeer mitane
 * ke liye**.
 *
 * ⚠️ Do bagal wale triangle jab bilkul ek hi kinare par khatam hote hain, to
 * Chromium dono ko alag-alag antialias karta hai aur beech me aadhe pixel ki
 * lakeer chhod deta hai. Us lakeer me peeche wali (bina kheenchi hui) tasveer
 * jhaankti hai — chehre par wo muh ke aar-paar baariक safed dhaariyon ki tarah
 * dikhti hai.
 *
 * ⚠️ **Iska ek poora chakkar ho chuka hai, aur wo yahan likha hai taaki dobara na
 * ho.** Pehle ise ek *dekhi hui* lakeer par jodha gaya tha; naapne par wo lakeer
 * bani hui file me thi hi nahi, isliye hata diya gaya. Phir asli mesh par (jahan
 * 160 chhote triangle hain aur har ek ka apna kheenchav) lakeerein sach me
 * aayin, aur naap se pakdi gayin — `worker/scripts/render-talking.ts` un
 * columns ko ginta hai jinme kaale hisse ke beech chhed hai.
 *
 * Seekh: pehla spike sirf **do bade** triangle par tha, aur wo is halat ko test
 * hi nahi karta tha. Ek jaanch jo asli halat na banaye, wo bharosa deti hai,
 * saboot nahi.
 *
 * ⚠️ Phulao sirf **clip-path** par lagta hai, `affineFromTriangles` ke `to` par
 * nahi. Matrix ko asli triangle par hi baithna chahiye, warna har tukda thoda
 * bada ho kar khinch jaata aur poora mesh apni jagah se hat jaata. Yahan sirf
 * itna hota hai ki har tukda apni seema se zara bahar tak chhapta hai, aur uska
 * padosi us zyada hisse ko dhak leta hai — dono ke paas wahi tasveer hai, isliye
 * dhakne me kuch badalta nahi.
 */
export function inflateTriangle(
  t: readonly [Point, Point, Point],
  amount: number,
): [Point, Point, Point] {
  const cx = (t[0].x + t[1].x + t[2].x) / 3;
  const cy = (t[0].y + t[1].y + t[2].y) / 3;

  const push = (p: Point): Point => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const len = Math.hypot(dx, dy);
    /* Beech par hi pada point — usse bahar ki koi disha hai hi nahi. */
    if (len < DEGENERATE) return { x: p.x, y: p.y };
    return { x: p.x + (dx / len) * amount, y: p.y + (dy / len) * amount };
  };

  return [push(t[0]), push(t[1]), push(t[2])];
}

/**
 * Kitna phulana hai — tasveer ke pixel me.
 *
 * ⚠️ Isse zyada rakhne par tukda apne padosi ke upar saaf dikhne layak chadh
 * jaata hai, aur kheenchav ke waqt (jab dono tukde alag-alag hil rahe hote hain)
 * wo chadhav ek kaanpti hui kinari bankar dikhta hai — jod ki lakeer se bhi bura.
 */
export const SEAM_INFLATE = 0.75;