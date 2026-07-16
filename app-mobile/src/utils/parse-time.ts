// Reminder text se time samajhta hai (bina AI, rules se).
// "1 minute baad", "2 ghante baad", "kal subah", "aaj raat", "8 baje", "parso"...

export type ParsedTime = { date: Date; label: string; title: string };

export function parseReminderTime(
  input: string,
  now: Date = new Date(),
): ParsedTime | null {
  const text = input.trim();
  if (!text) return null;
  const t = text.toLowerCase();

  let found: { date: Date; label: string; matched: string } | null = null;

  // X minute baad ("minut"/"minit" jaisi common spellings bhi)
  const min = t.match(/(\d+)\s*(minutes?|mins?|min[aui]t|मिनट)/);
  if (min) {
    const n = +min[1];
    found = { date: new Date(now.getTime() + n * 60000), label: `${n} minute baad`, matched: min[0] };
  }

  // X ghante baad
  if (!found) {
    const hr = t.match(/(\d+)\s*(ghante|ghanta|hour|hours|hr|hrs|घंटे|घंटा)/);
    if (hr) {
      const n = +hr[1];
      found = { date: new Date(now.getTime() + n * 3600000), label: `${n} ghante baad`, matched: hr[0] };
    }
  }

  // X din baad
  if (!found) {
    const dy = t.match(/(\d+)\s*(din|day|days|दिन)/);
    if (dy) {
      const n = +dy[1];
      const d = new Date(now);
      d.setDate(d.getDate() + n);
      d.setHours(9, 0, 0, 0);
      found = { date: d, label: `${n} din baad`, matched: dy[0] };
    }
  }

  // "8 baje" / "subah 8 baje" / "6:00 baje" / "8:30 pm"
  if (!found) {
    // ⚠️ Pehle minutes (`:MM`) handle nahi hote the — "6:00 baje" me se parser
    // "00 baje" (=12 AM) pakad leta tha. Ab `(\d{1,2})(?::(\d{2}))?` se ghanta
    // aur minute dono lete hain.
    const bj = t.match(
      /(subah|shaam|sham|dopahar|raat|morning|evening|night|afternoon)?\s*(\d{1,2})(?::(\d{2}))?\s*(baje|bje|am|pm|o'clock|बजे)/,
    );
    if (bj) {
      let hour = +bj[2];
      const min = bj[3] ? Math.min(59, +bj[3]) : 0;
      const part = bj[1] || "";
      const ap = bj[4];
      if (ap === "pm" && hour < 12) hour += 12;
      if (ap === "am" && hour === 12) hour = 0;
      if (/subah|morning/.test(part) && hour === 12) hour = 0;
      if (/shaam|sham|evening/.test(part) && hour < 12) hour += 12;
      if (/raat|night/.test(part) && hour < 12) hour += 12;
      if (/dopahar|afternoon/.test(part) && hour < 12) hour += 12;
      const d = new Date(now);
      d.setHours(hour, min, 0, 0);
      if (/\bkal\b|\bcal\b/.test(t)) d.setDate(d.getDate() + 1);
      else if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
      const hr12 = hour % 12 === 0 ? 12 : hour % 12;
      const ampm = hour < 12 ? "AM" : "PM";
      const mm = String(min).padStart(2, "0");
      found = { date: d, label: `${hr12}:${mm} ${ampm}`, matched: bj[0] };
    }
  }

  // kal subah/shaam/raat, parso, aaj shaam/raat
  if (!found) {
    const day = (add: number, h: number, label: string, matched: string) => {
      const d = new Date(now);
      d.setDate(d.getDate() + add);
      d.setHours(h, 0, 0, 0);
      if (add === 0 && d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
      return { date: d, label, matched };
    };
    if (/kal\s*(subah|morning)/.test(t)) found = day(1, 8, "Kal subah 8 baje", "kal subah");
    else if (/kal\s*(shaam|sham|evening)/.test(t)) found = day(1, 18, "Kal shaam 6 baje", "kal shaam");
    else if (/kal\s*(raat|night)/.test(t)) found = day(1, 21, "Kal raat 9 baje", "kal raat");
    else if (/parso/.test(t)) found = day(2, 9, "Parso", "parso");
    else if (/aaj\s*(raat|night)/.test(t)) found = day(0, 21, "Aaj raat 9 baje", "aaj raat");
    else if (/aaj\s*(shaam|sham|evening)/.test(t)) found = day(0, 18, "Aaj shaam 6 baje", "aaj shaam");
    else if (/\bkal\b/.test(t)) found = day(1, 9, "Kal subah", "kal");
  }

  if (!found) return null;

  // title se time-phrase aur filler words hatao
  let title = text;
  const esc = found.matched.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  title = title.replace(new RegExp(esc, "i"), " ");
  title = title
    .replace(/\b(baad|mein|me|ko|par|pe|yaad\s*dila\s*do|yaad\s*dilana|reminder|remind)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!title) title = text;

  return { date: found.date, label: found.label, title };
}
