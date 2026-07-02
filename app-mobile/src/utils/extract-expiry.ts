// Text mein se expiry date dhoondne ke rules (bina AI ke).
// Perfect nahi — saaf documents pe zyadatar sahi. User theek kar sakta hai.

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");
const normYear = (y: number) => (y < 100 ? 2000 + y : y);
const valid = (d: number, m: number) => d >= 1 && d <= 31 && m >= 1 && m <= 12;

type Found = { date: string; index: number };

function findDates(text: string): Found[] {
  const out: Found[] = [];
  let m: RegExpExecArray | null;

  // YYYY-MM-DD / YYYY.MM.DD (pehle, taaki DD/MM/YYYY se conflict na ho)
  const re0 = /\b(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})\b/g;
  while ((m = re0.exec(text))) {
    const y = +m[1], mo = +m[2], d = +m[3];
    if (valid(d, mo)) out.push({ date: `${y}-${pad(mo)}-${pad(d)}`, index: m.index });
  }

  // DD/MM/YYYY, DD-MM-YY, DD.MM.YYYY
  const re1 = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/g;
  while ((m = re1.exec(text))) {
    const d = +m[1], mo = +m[2], y = normYear(+m[3]);
    if (valid(d, mo)) out.push({ date: `${y}-${pad(mo)}-${pad(d)}`, index: m.index });
  }

  // DD Mon YYYY  (12 Mar 2027, 12 March 27)
  const re2 = /\b(\d{1,2})\s*([A-Za-z]{3,9})\s*['`]?(\d{2,4})\b/g;
  while ((m = re2.exec(text))) {
    const mo = MONTHS[m[2].slice(0, 3).toLowerCase()];
    const d = +m[1], y = normYear(+m[3]);
    if (mo && d >= 1 && d <= 31) out.push({ date: `${y}-${pad(mo)}-${pad(d)}`, index: m.index });
  }

  return out;
}

const KEYWORDS =
  /(valid\s*(?:till|upto|up\s*to|until|thru|through)|date\s*of\s*expiry|expiry|expires|expire|validity|valid\s*to)/gi;

export function extractExpiry(text: string, now: Date = new Date()): string | null {
  if (!text) return null;
  const dates = findDates(text);
  if (dates.length === 0) return null;

  // keyword positions
  const kw: number[] = [];
  let m: RegExpExecArray | null;
  const re = new RegExp(KEYWORDS.source, "gi");
  while ((m = re.exec(text))) kw.push(m.index);

  // 1. keyword ke sabse paas wali date (usually keyword ke thodा baad)
  if (kw.length > 0) {
    let best: { date: string; dist: number } | null = null;
    for (const d of dates) {
      for (const k of kw) {
        const dist = Math.abs(d.index - k);
        if (dist <= 60 && (!best || dist < best.dist)) {
          best = { date: d.date, dist };
        }
      }
    }
    if (best) return best.date;
  }

  // 2. fallback: sabse door future date (expiry aksar future mein hoti hai)
  const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const future = dates.map((d) => d.date).filter((d) => d >= today).sort();
  if (future.length) return future[future.length - 1];

  // 3. warna sabse latest date
  return dates.map((d) => d.date).sort().pop() ?? null;
}
