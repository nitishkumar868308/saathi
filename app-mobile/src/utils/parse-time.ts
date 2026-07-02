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

  // X minute baad
  const min = t.match(/(\d+)\s*(minute|minutes|min|mins|minat|minat|मिनट)/);
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

  // "8 baje" / "subah 8 baje" / "8 pm"
  if (!found) {
    const bj = t.match(
      /(subah|shaam|sham|dopahar|raat|morning|evening|night|afternoon)?\s*(\d{1,2})\s*(baje|bje|am|pm|o'clock|बजे)/,
    );
    if (bj) {
      let hour = +bj[2];
      const part = bj[1] || "";
      const ap = bj[3];
      if (ap === "pm" && hour < 12) hour += 12;
      if (ap === "am" && hour === 12) hour = 0;
      if (/shaam|sham|evening/.test(part) && hour < 12) hour += 12;
      if (/raat|night/.test(part) && hour < 12) hour += 12;
      if (/dopahar|afternoon/.test(part) && hour < 12) hour += 12;
      const d = new Date(now);
      d.setHours(hour, 0, 0, 0);
      if (/kal/.test(t)) d.setDate(d.getDate() + 1);
      else if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
      found = { date: d, label: bj[0].trim(), matched: bj[0] };
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
