// Reminder NLU — bina AI, rules se. User jo bhi bole/likhe usme se 3 slot
// nikaalta hai: title (kya), date (kaunsa din), time (kaunsa waqt). Jo na mile
// wo screen wapas poochti hai. Kabhi poori tarah fail nahi hota.

export type ReminderParse = {
  /** Reminder kis cheez ke liye. "" = samajh nahi aaya. */
  title: string;
  /** date + time dono pata ho to poora datetime. Warna null. */
  when: Date | null;
  /** Samjha hua din (us din 00:00) — hasDate true ho to. */
  date: Date | null;
  /** Samjha hua time (minutes-of-day, 0-1439) — hasTime true ho to. */
  minutes: number | null;
  /**
   * Bare "N baje" jaisa time mila par AM/PM pata nahi (na subah/shaam, na am/pm).
   * AM interpretation ke minutes-of-day (0-719). Screen do chip dikhaati hai:
   * "N:MM AM" (= ambiguousMinutes) aur "N:MM PM" (= +720) — assume NAHI karti.
   * minutes null rehta hai jab tak user chun na le.
   */
  ambiguousMinutes: number | null;
  hasDate: boolean;
  hasTime: boolean;
};

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function atMidnight(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** date (din) + minutes (time) ko jodo → poora Date. */
export function combine(date: Date, minutes: number): Date {
  const d = atMidnight(date);
  d.setMinutes(minutes);
  return d;
}

/* ------------------------------- lookups ------------------------------- */

// 0 = Sunday ... 6 = Saturday
const WEEKDAYS: [RegExp, number][] = [
  [/\b(sunday|ravivar|raviwar|itwar|itvaar|ravi)\b/, 0],
  [/\b(monday|somvar|somwar|som)\b/, 1],
  [/\b(tuesday|mangalvar|mangalwar|mangal)\b/, 2],
  [/\b(wednesday|budhvar|budhwar|budh)\b/, 3],
  [/\b(thursday|guruvar|guruwar|brihaspativar|guru)\b/, 4],
  [/\b(friday|shukravar|shukrawar|shukra)\b/, 5],
  [/\b(saturday|shanivar|shaniwar|shani)\b/, 6],
];

const MONTHS: [RegExp, number][] = [
  [/\b(january|jan|janvari)\b/, 0],
  [/\b(february|feb|farvari|farwari)\b/, 1],
  [/\b(march|mar)\b/, 2],
  [/\b(april|apr|aprail)\b/, 3],
  [/\b(may|mai)\b/, 4],
  [/\b(june|jun)\b/, 5],
  [/\b(july|jul)\b/, 6],
  [/\b(august|aug|agast)\b/, 7],
  [/\b(september|sept|sep|sitambar)\b/, 8],
  [/\b(october|oct|aktubar)\b/, 9],
  [/\b(november|nov|navambar)\b/, 10],
  [/\b(december|dec|disambar)\b/, 11],
];

// Sirf time/filler shabd — title se hata dete hain. Action words (lena, banana,
// call, dawai...) NAHI hatate, warna subject hi gayab ho jaata.
const FILLER =
  /\b(mujhe|muje|please|plz|pls|yaad|dila|dilado|dilana|dilaana|dena|dedo|dedena|dijiye|deni|rakhna|reminder|remind|set|kardo|karke|laga|lagado|lagana|ka|ki|ke|ko|liye|par|pe|mein|me|baad|bad|wala|hai|ho|krna|karna|karo|kro|tarikh|tareekh|a|an|the|to|for|of|at|on)\b/gi;

/* ------------------------------- date ------------------------------- */

/** Din nikaalo. Returns us din ka midnight Date + matched phrase(s). */
function parseDate(t: string, now: Date): { date: Date; matched: string[] } | null {
  const base = atMidnight(now);

  // "N din/hafte/mahine baad"
  let m = t.match(/(\d+)\s*(din|day|days)\s*(baad|bad|me|mein|later)?/);
  if (m) {
    const d = new Date(base);
    d.setDate(d.getDate() + +m[1]);
    return { date: d, matched: [m[0]] };
  }
  m = t.match(/(\d+)\s*(hafte|hafta|hafto|week|weeks)\s*(baad|bad|me|mein|later)?/);
  if (m) {
    const d = new Date(base);
    d.setDate(d.getDate() + 7 * +m[1]);
    return { date: d, matched: [m[0]] };
  }
  m = t.match(/(\d+)\s*(mahine|mahina|month|months)\s*(baad|bad|me|mein|later)?/);
  if (m) {
    const d = new Date(base);
    d.setMonth(d.getMonth() + +m[1]);
    return { date: d, matched: [m[0]] };
  }

  // "DD/MM(/YYYY)" ya "DD-MM"
  m = t.match(/\b(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?\b/);
  if (m) {
    const day = +m[1];
    const mon = +m[2] - 1;
    let year = m[3] ? +m[3] : now.getFullYear();
    if (year < 100) year += 2000;
    if (day >= 1 && day <= 31 && mon >= 0 && mon <= 11) {
      let d = new Date(year, mon, day, 0, 0, 0, 0);
      // Saal na diya ho aur date nikal chuki ho to agla saal.
      if (!m[3] && d.getTime() < base.getTime()) d = new Date(year + 1, mon, day);
      return { date: d, matched: [m[0]] };
    }
  }

  // "15 August" / "August 15" / "15 agast"
  for (const [re, mon] of MONTHS) {
    if (re.test(t)) {
      const dm = t.match(/(\d{1,2})/);
      const day = dm ? +dm[1] : 1;
      if (day >= 1 && day <= 31) {
        let d = new Date(now.getFullYear(), mon, day, 0, 0, 0, 0);
        if (d.getTime() < base.getTime()) d = new Date(now.getFullYear() + 1, mon, day);
        const matched = [re.exec(t)![0]];
        if (dm) matched.push(dm[0]);
        return { date: d, matched };
      }
    }
  }

  // "N tarikh" / "N ko" (is mahine ki N, nikal gayi to agle mahine)
  m = t.match(/\b(\d{1,2})\s*(tarikh|tareekh|ko)\b/);
  if (m) {
    const day = +m[1];
    if (day >= 1 && day <= 31) {
      let d = new Date(now.getFullYear(), now.getMonth(), day, 0, 0, 0, 0);
      if (d.getTime() < base.getTime()) d = new Date(now.getFullYear(), now.getMonth() + 1, day);
      return { date: d, matched: [m[0]] };
    }
  }

  // parso / narso
  if (/\bparso\b/.test(t)) {
    const d = new Date(base);
    d.setDate(d.getDate() + 2);
    return { date: d, matched: ["parso"] };
  }
  if (/\bnarso\b/.test(t)) {
    const d = new Date(base);
    d.setDate(d.getDate() + 3);
    return { date: d, matched: ["narso"] };
  }

  // kal / cal / kl / kaal (reminder = hamesha aage, isliye +1)
  const kalRe = /\b(kal|cal|kl|kaal|tomorrow)\b/;
  if (kalRe.test(t)) {
    const d = new Date(base);
    d.setDate(d.getDate() + 1);
    return { date: d, matched: [(t.match(kalRe) as RegExpMatchArray)[0]] };
  }

  // Weekday → agla us din (aaj wahi din ho to +7)
  for (const [re, dow] of WEEKDAYS) {
    const w = re.exec(t);
    if (w) {
      const d = new Date(base);
      let diff = (dow - d.getDay() + 7) % 7;
      if (diff === 0) diff = 7;
      d.setDate(d.getDate() + diff);
      return { date: d, matched: [w[0]] };
    }
  }

  // "agle hafte" / "agle mahine"
  if (/\bagle\s*(hafte|hafta|week)\b/.test(t)) {
    const d = new Date(base);
    d.setDate(d.getDate() + 7);
    return { date: d, matched: [(t.match(/\bagle\s*(hafte|hafta|week)\b/) as RegExpMatchArray)[0]] };
  }
  if (/\bagle\s*(mahine|mahina|month)\b/.test(t)) {
    const d = new Date(base);
    d.setMonth(d.getMonth() + 1);
    return { date: d, matched: [(t.match(/\bagle\s*(mahine|mahina|month)\b/) as RegExpMatchArray)[0]] };
  }

  // aaj / today
  const aajRe = /\b(aaj|aj|aaz|today)\b/;
  if (aajRe.test(t)) {
    return { date: base, matched: [(t.match(aajRe) as RegExpMatchArray)[0]] };
  }

  return null;
}

/* ------------------------------- time ------------------------------- */

// Common spelling variants bhi (bina AI, safe shabd). Ye "har galti" fix nahi
// karega — sirf aam variants. Anokhi galtiyan AI hi handle kar sakta hai.
const RE_SUBAH = "subah|suba|subha|savere|sawere|morning";
const RE_DOPAHAR = "dopahar|dopeher|dupahar|afternoon|noon";
const RE_SHAAM = "shaam|sham|shyam|evening";
const RE_RAAT = "raat|raata|night";

const PART_DEFAULT: [RegExp, number][] = [
  [new RegExp(`\\b(${RE_SUBAH})\\b`), 8 * 60],
  [new RegExp(`\\b(${RE_DOPAHAR})\\b`), 13 * 60],
  [new RegExp(`\\b(${RE_SHAAM})\\b`), 18 * 60],
  [new RegExp(`\\b(${RE_RAAT})\\b`), 21 * 60],
];

/**
 * Time nikaalo. Do tarah ka result:
 *  - minutes set → time pakka (am/pm ya subah/shaam se).
 *  - ambiguousHour set (minutes null) → "N baje" mila par AM/PM pata nahi →
 *    screen poochhegi, assume NAHI karte.
 */
function parseTime(
  t: string,
): { minutes: number | null; ambiguousMinutes: number | null; matched: string[] } | null {
  // "(subah)? N(:MM)? (baje|am|pm)" — marker (baje/am/pm) ya part-of-day + number.
  const bj = t.match(
    new RegExp(
      `(${RE_SUBAH}|${RE_DOPAHAR}|${RE_SHAAM}|${RE_RAAT})?\\s*(\\d{1,2})(?::(\\d{2}))?\\s*(baje|bje|bajey|baja|am|a\\.m|pm|p\\.m|o'clock|बजे)?`,
    ),
  );
  if (bj && (bj[4] || bj[1])) {
    // number-only bina marker aur bina part-of-day ko time NAHI maante (wo date
    // ka number ho sakta hai). Marker (baje/am/pm) ya part-of-day chahiye.
    let hour = +bj[2];
    const min = bj[3] ? Math.min(59, +bj[3]) : 0;
    const part = bj[1] || "";
    const marker = (bj[4] || "").toLowerCase();
    const isAm = marker === "am" || marker === "a.m";
    const isPm = marker === "pm" || marker === "p.m";
    if (isPm) {
      if (hour < 12) hour += 12;
    } else if (isAm) {
      if (hour === 12) hour = 0;
    } else if (new RegExp(RE_SUBAH).test(part)) {
      if (hour === 12) hour = 0;
    } else if (new RegExp(RE_DOPAHAR).test(part)) {
      if (hour < 12) hour += 12;
    } else if (new RegExp(RE_SHAAM).test(part)) {
      if (hour < 12) hour += 12;
    } else if (new RegExp(RE_RAAT).test(part)) {
      if (hour === 12) hour = 0;
      else if (hour < 12) hour += 12;
    } else if (hour >= 1 && hour <= 11) {
      // ⚠️ Bare "N baje" — AM/PM pata nahi. ASSUME MAT KARO. minutes = null,
      // ambiguousMinutes = AM interpretation — screen "N:MM AM / N:MM PM"
      // poochhegi. ("6:30 baje" pe :30 bhi preserve hota hai.)
      return { minutes: null, ambiguousMinutes: hour * 60 + min, matched: [bj[0].trim()] };
    }
    if (hour > 23) hour = 23;
    return { minutes: hour * 60 + min, ambiguousMinutes: null, matched: [bj[0].trim()] };
  }

  // Sirf part-of-day (bina number) → default time.
  for (const [re, mins] of PART_DEFAULT) {
    const w = re.exec(t);
    if (w) return { minutes: mins, ambiguousMinutes: null, matched: [w[0]] };
  }

  return null;
}

/* ---------------------------- relative time ---------------------------- */

/** "N minute/ghanta baad" → poora datetime (date+time dono). Warna null. */
function parseRelativeTime(t: string, now: Date): { when: Date; matched: string[] } | null {
  const min = t.match(/(\d+)\s*(minutes?|mins?|min[aui]t|मिनट)/);
  if (min) {
    return { when: new Date(now.getTime() + +min[1] * 60000), matched: [min[0]] };
  }
  const hr = t.match(/(\d+)\s*(ghante|ghanta|hour|hours|hr|hrs|घंटे|घंटा)/);
  if (hr) {
    return { when: new Date(now.getTime() + +hr[1] * 3600000), matched: [hr[0]] };
  }
  return null;
}

/* ------------------------------- title ------------------------------- */

function cleanTitle(text: string, matched: string[]): string {
  let title = text;
  for (const mstr of matched) {
    if (!mstr) continue;
    const esc = mstr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    title = title.replace(new RegExp(esc, "i"), " ");
  }
  title = title
    .replace(
      /\b(aaj|aj|aaz|kal|cal|kl|kaal|parso|narso|today|tomorrow|subah|suba|subha|savere|sawere|morning|shaam|sham|shyam|evening|raat|raata|night|dopahar|dopeher|dupahar|afternoon|noon|baje|bje|bajey|baja|am|pm|agle)\b/gi,
      " ",
    )
    .replace(FILLER, " ")
    .replace(/\s+/g, " ")
    .trim();
  return title;
}

/* ------------------------------- main ------------------------------- */

export function parseReminder(input: string, now: Date = new Date()): ReminderParse | null {
  const text = input.trim();
  if (!text) return null;
  const t = text.toLowerCase();

  const matched: string[] = [];

  // 1. Relative time (N min/ghanta baad) → date+time dono mil jaate hain.
  const rel = parseRelativeTime(t, now);
  if (rel) {
    matched.push(...rel.matched);
    const title = cleanTitle(text, matched);
    return {
      title,
      when: rel.when,
      date: atMidnight(rel.when),
      minutes: rel.when.getHours() * 60 + rel.when.getMinutes(),
      ambiguousMinutes: null,
      hasDate: true,
      hasTime: true,
    };
  }

  // 2. Date + time alag-alag.
  const dateRes = parseDate(t, now);
  const timeRes = parseTime(t);
  if (dateRes) matched.push(...dateRes.matched);
  if (timeRes) matched.push(...timeRes.matched);

  const date = dateRes?.date ?? null;
  const minutes = timeRes?.minutes ?? null;
  const ambiguousMinutes = timeRes?.ambiguousMinutes ?? null;
  const hasDate = !!dateRes;
  const hasTime = minutes != null; // ambiguous ko "time mil gaya" nahi maante

  // 3. Combine — date + pakka time dono ho to poora when.
  let when: Date | null = null;
  if (date && minutes != null) when = combine(date, minutes);

  const title = cleanTitle(text, matched);
  return { title, when, date, minutes, ambiguousMinutes, hasDate, hasTime };
}

/** Kya-kya samajh nahi aaya — screen isse decide karti hai kya poochhna hai. */
export function reminderNeeds(p: ReminderParse | null): {
  needsTitle: boolean;
  needsDate: boolean;
  needsTime: boolean;
} {
  return {
    needsTitle: !p?.title?.trim(),
    needsDate: !p?.hasDate,
    needsTime: !p?.hasTime,
  };
}

/**
 * Reminder ka time user ki chuni bhasha me: "Aaj 9:30 PM" / "आज 9:30 PM" /
 * "Today 9:30 PM". Bhasha badalne pe purane reminders bhi sahi bhasha me dikhein
 * isliye stored label pe nahi, remind_at pe format karte hain.
 */
export function formatWhen(
  d: Date,
  words: { today: string; tomorrow: string },
  locale?: string,
  now: Date = new Date(),
): string {
  const bcp = locale === "hi" ? "hi-IN" : "en-IN";
  const time = d.toLocaleTimeString(bcp, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const tmrw = new Date(now);
  tmrw.setDate(now.getDate() + 1);
  if (sameDay(d, now)) return `${words.today} ${time}`;
  if (sameDay(d, tmrw)) return `${words.tomorrow} ${time}`;
  const date = d.toLocaleDateString(bcp, { day: "numeric", month: "short" });
  return `${date}, ${time}`;
}
