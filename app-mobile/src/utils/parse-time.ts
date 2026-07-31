/**
 * Reminder ke time se judi do chhoti cheezein — jodna aur dikhana.
 *
 * ⚠️ Is file me pehle ek poora rule-based NLU tha (`parseReminder`): user ke
 * likhe wakya me se title/din/time nikaalne wale sau se zyada regex niyam. Wo
 * poora hissa hata diya gaya hai. Ab user ki baat samajhna SIRF AI ka kaam hai
 * (`lib/ai.ts` → `parseReminderAI`, aur chat me agentic reminder).
 *
 * Wajah: do samajhne wale ek saath rakhna hi galti thi. Rule wala parser
 * "roz 6 baje 90 din tak" ko ek baar ka 6 baje samajh leta tha aur "shaam 6" ko
 * subah 6 bana deta tha — aur user ko wo bilkul AI ke jawab jaisa hi dikhta tha.
 * Galat time par laga reminder na lage hue reminder se kahin zyada mehnga hai.
 *
 * Jo yahan bacha hai wo samajhna nahi, sirf hisaab aur dikhawa hai:
 *   combine    — chuni hui date + chuna hua time jod ke poora Date
 *   formatWhen — us Date ko user ki bhasha me padhne laayak line
 */

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
