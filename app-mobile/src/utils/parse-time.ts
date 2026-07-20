// Reminder text se time AUR subject (title) samajhta hai (bina AI, rules se).
// "1 minute baad", "2 ghante baad", "kal subah", "aaj raat", "8 baje", "parso"...
//
// Naya behaviour: ye ab kabhi poori tarah fail nahi hota — jo samajh aaya wahi
// lauta deta hai. `date` null = time samajh nahi aaya; `title` "" = subject
// samajh nahi aaya. Screen inhi dono ke aadhaar pe user se wapas poochta hai.

export type ParsedTime = {
  /** null = koi time samajh nahi aaya (user se poochho). */
  date: Date | null;
  /** Reminder kis cheez ke liye. "" = samajh nahi aaya (user se poochho). */
  title: string;
  /** Jo time-phrase match hui (title cleanup ke liye). */
  matched: string | null;
};

/** Kya-kya samajh nahi aaya. Screen isse decide karti hai ki kya poochhna hai. */
export function reminderNeeds(p: ParsedTime | null): {
  needsTime: boolean;
  needsTitle: boolean;
} {
  return { needsTime: !p?.date, needsTitle: !p?.title?.trim() };
}

// Sirf time/filler shabd — inhe title se hata dete hain. Action words (lena,
// banana, call, dawai...) NAHI hatate, warna subject hi gayab ho jaata.
const FILLER =
  /\b(mujhe|muje|please|plz|pls|yaad|dila|dilado|dilana|dilaana|rakhna|reminder|remind|set|kardo|karke|laga|lagado|lagana|ka|ki|ke|ko|liye|par|pe|mein|me|baad|wala|hai|ho|krna|karna|karo|kro|a|an|the|to|for|of|at|on)\b/gi;

/** Title se time-phrase + filler hatao. Kuch bacha to subject, warna "". */
function cleanTitle(text: string, matched: string | null): string {
  let title = text;
  if (matched) {
    const esc = matched.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    title = title.replace(new RegExp(esc, "i"), " ");
  }
  // Din/samay ke akele shabd bhi hatao (jo matched me nahi aaye).
  title = title
    .replace(
      /\b(aaj|aj|kal|cal|parso|subah|morning|shaam|sham|evening|raat|night|dopahar|afternoon|baje|bje|am|pm)\b/gi,
      " ",
    )
    .replace(FILLER, " ")
    .replace(/\s+/g, " ")
    .trim();
  return title;
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * Reminder ka time user ki chuni bhasha me: "Aaj 9:30 PM" / "आज 9:30 PM" /
 * "Today 9:30 PM". `today`/`tomorrow` shabd caller dict se deta hai; date/time
 * ka number-format locale se. Isi liye bhasha badalne pe purane reminders bhi
 * sahi bhasha me dikhte hain — hum stored label pe nahi, `remind_at` pe formatte
 * karte hain.
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

export function parseReminderTime(
  input: string,
  now: Date = new Date(),
): ParsedTime | null {
  const text = input.trim();
  if (!text) return null;
  const t = text.toLowerCase();

  let found: { date: Date; matched: string } | null = null;

  // X minute baad ("minut"/"minit" jaisi common spellings bhi)
  const min = t.match(/(\d+)\s*(minutes?|mins?|min[aui]t|मिनट)/);
  if (min) {
    const n = +min[1];
    found = { date: new Date(now.getTime() + n * 60000), matched: min[0] };
  }

  // X ghante baad
  if (!found) {
    const hr = t.match(/(\d+)\s*(ghante|ghanta|hour|hours|hr|hrs|घंटे|घंटा)/);
    if (hr) {
      const n = +hr[1];
      found = { date: new Date(now.getTime() + n * 3600000), matched: hr[0] };
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
      found = { date: d, matched: dy[0] };
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
      const mn = bj[3] ? Math.min(59, +bj[3]) : 0;
      const part = bj[1] || "";
      const ap = bj[4];
      if (ap === "pm" && hour < 12) hour += 12;
      if (ap === "am" && hour === 12) hour = 0;
      if (/subah|morning/.test(part) && hour === 12) hour = 0;
      if (/shaam|sham|evening/.test(part) && hour < 12) hour += 12;
      // "raat 12 baje" = aadhi raat (0), "raat 9 baje" = 21.
      if (/raat|night/.test(part)) {
        if (hour === 12) hour = 0;
        else if (hour < 12) hour += 12;
      }
      if (/dopahar|afternoon/.test(part) && hour < 12) hour += 12;
      const d = new Date(now);
      d.setHours(hour, mn, 0, 0);
      // "parso 6 baje" = +2 din, "kal 6 baje" = +1. Time branch pehle match hota
      // hai isliye din yahin adjust karo, warna parso/kal miss ho jaata.
      if (/parso/.test(t)) d.setDate(d.getDate() + 2);
      else if (/\bkal\b|\bcal\b/.test(t)) d.setDate(d.getDate() + 1);
      else if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
      found = { date: d, matched: bj[0] };
    }
  }

  // kal subah/shaam/raat, parso, aaj shaam/raat
  if (!found) {
    const day = (add: number, h: number, matched: string) => {
      const d = new Date(now);
      d.setDate(d.getDate() + add);
      d.setHours(h, 0, 0, 0);
      if (add === 0 && d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
      return { date: d, matched };
    };
    if (/kal\s*(subah|morning)/.test(t)) found = day(1, 8, "kal subah");
    else if (/kal\s*(shaam|sham|evening)/.test(t)) found = day(1, 18, "kal shaam");
    else if (/kal\s*(raat|night)/.test(t)) found = day(1, 21, "kal raat");
    else if (/parso/.test(t)) found = day(2, 9, "parso");
    else if (/aaj\s*(raat|night)/.test(t)) found = day(0, 21, "aaj raat");
    else if (/aaj\s*(shaam|sham|evening)/.test(t)) found = day(0, 18, "aaj shaam");
    else if (/\bkal\b|\bcal\b/.test(t)) found = day(1, 9, "kal");
  }

  // Time na mila to bhi title nikaalte hain — screen user se time poochh legi.
  const title = cleanTitle(text, found?.matched ?? null);
  return { date: found?.date ?? null, title, matched: found?.matched ?? null };
}
