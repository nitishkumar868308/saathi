/**
 * Twilio WhatsApp helper (server-side).
 *
 * .env.local (aur production env):
 *   TWILIO_ACCOUNT_SID=ACxxxxxxxx
 *   TWILIO_AUTH_TOKEN=xxxxxxxx           (SECRET — kabhi commit mat karna)
 *   TWILIO_WHATSAPP_FROM=whatsapp:+14155238886   (sandbox number; live me apna)
 *
 * Env na ho to sendWhatsApp silently skip karta hai (caller fail nahi hota).
 */

import { logServiceUsage } from "@/lib/usage-server";

const SID = process.env.TWILIO_ACCOUNT_SID;
const TOKEN = process.env.TWILIO_AUTH_TOKEN;
const FROM = process.env.TWILIO_WHATSAPP_FROM;

/** Meta se approved template SIDs (production ke liye). Sandbox me khaali. */
const TEMPLATE_REMINDER = process.env.TWILIO_TEMPLATE_REMINDER_SID;
const TEMPLATE_DOCUMENT = process.env.TWILIO_TEMPLATE_DOCUMENT_SID;

export function twilioConfigured(): boolean {
  return Boolean(SID && TOKEN && FROM);
}

/**
 * WhatsApp message bhejo. `to` = E.164 (jaise +919876543210).
 *
 * ⚠️ WhatsApp ka niyam: business khud se (24h window ke bahar) SIRF approved
 * TEMPLATE bhej sakta hai — free-form text reject ho jaata hai. Isliye:
 *   - templateSid diya ho  -> Content API se template bhejta hai (production)
 *   - nahi diya            -> plain Body (Twilio Sandbox / testing)
 *
 * Env na ho to chup-chaap skip — caller kabhi fail nahi hota.
 */
export async function sendWhatsApp(
  to: string,
  body: string,
  opts: {
    templateSid?: string;
    variables?: Record<string, string>;
    /** Admin ke hisaab ke liye — 'reminder' | 'document' (item 3). */
    kind?: string;
    userId?: string | null;
  } = {},
): Promise<{ sent: boolean; skipped?: boolean }> {
  const kind = opts.kind ?? "other";
  if (!twilioConfigured()) {
    console.warn("[twilio] env not set — WhatsApp skipped");
    return { sent: false, skipped: true };
  }
  const toWa = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const form = new URLSearchParams({ From: FROM as string, To: toWa });

  if (opts.templateSid) {
    form.set("ContentSid", opts.templateSid);
    if (opts.variables) form.set("ContentVariables", JSON.stringify(opts.variables));
  } else {
    form.set("Body", body);
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${SID}:${TOKEN}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form.toString(),
      cache: "no-store",
    },
  );

  if (!res.ok) {
    const txt = await res.text();
    // Fail bhi ginte hain — Twilio ka number block ho jaye ya template reject ho
    // to admin ko yahi sabse pehle dikhta hai (item 3).
    logServiceUsage("twilio", kind, {
      ok: false,
      userId: opts.userId,
      meta: { status: res.status },
    });
    throw new Error(`twilio send failed: ${res.status} ${txt}`);
  }
  logServiceUsage("twilio", kind, {
    userId: opts.userId,
    meta: { template: opts.templateSid ? true : false },
  });
  return { sent: true };
}

/**
 * Reminder bhejo — template ho to template se, warna plain text.
 *
 * `note` = user ke apne shabd. Sirf plain-text message me jaata hai; Twilio
 * template ke variables Twilio console me pehle se tay hote hain, isliye wahan
 * ek naya variable chupke se nahi ghusaya ja sakta.
 */
export function sendReminderWhatsApp(
  to: string,
  title: string,
  whenLabel: string,
  note?: string | null,
  userId?: string | null,
  locale: WaLocale = "hinglish",
) {
  return sendWhatsApp(to, reminderWhatsAppText(title, whenLabel, note, locale), {
    templateSid: TEMPLATE_REMINDER,
    variables: { "1": title, "2": whenLabel },
    kind: "reminder",
    userId,
  });
}

/** Document expiry bhejo — template ho to template se, warna plain text. */
export function sendDocumentWhatsApp(
  to: string,
  name: string,
  whenLabel: string,
  userId?: string | null,
  locale: WaLocale = "hinglish",
) {
  return sendWhatsApp(to, documentWhatsAppText(name, whenLabel, locale), {
    templateSid: TEMPLATE_DOCUMENT,
    variables: { "1": name, "2": whenLabel },
    kind: "document",
    userId,
  });
}

/**
 * WhatsApp ka text — user ki chuni hui bhasha me.
 *
 * ⚠️ Ye dono message pehle sirf Hinglish me jaate the, jabki email usi waqt
 * user ki bhasha me nikalta tha. Ek hi reminder do alag bhashaon me pahunchta
 * tha — email Hindi me, WhatsApp Hinglish me.
 *
 * ⚠️ Ye sirf PLAIN-TEXT raaste par lagta hai (sandbox / jab tak template set
 * na ho). Production me Meta-approved template jaata hai, aur uska text Twilio
 * console me pada hota hai — code se badla hi nahi ja sakta. Har bhasha ka
 * apna template Twilio par approve karana padega, phir `TEMPLATE_REMINDER` /
 * `TEMPLATE_DOCUMENT` ko locale ke hisaab se chunna hoga.
 */
type WaLocale = "hinglish" | "hi" | "en";

const WA: Record<WaLocale, {
  reminderKicker: string;
  docKicker: string;
  /** {name} {when} */
  docLine: (name: string, when: string) => string;
  docNudge: string;
  footer: string;
}> = {
  hinglish: {
    reminderKicker: "reminder",
    docKicker: "document reminder",
    docLine: (n, w) => `*${n}* ${w} expire ho raha hai.`,
    docNudge: "Time pe renew karwa lena. 🙂",
    footer: "Apka Saathi · jo kuch nahi bhoolta",
  },
  hi: {
    reminderKicker: "रिमाइंडर",
    docKicker: "डॉक्युमेंट रिमाइंडर",
    docLine: (n, w) => `*${n}* ${w} एक्सपायर हो रहा है।`,
    docNudge: "समय पर रिन्यू करा लीजिए। 🙂",
    footer: "Apka Saathi · जो कुछ नहीं भूलता",
  },
  en: {
    reminderKicker: "reminder",
    docKicker: "document reminder",
    docLine: (n, w) => `Your *${n}* expires ${w}.`,
    docNudge: "Renew it in time. 🙂",
    footer: "Apka Saathi · never forgets what matters",
  },
};

/** Branded WhatsApp reminder text (logo emoji + brand). */
export function reminderWhatsAppText(
  title: string,
  whenLabel: string,
  note?: string | null,
  locale: WaLocale = "hinglish",
): string {
  const c = WA[locale] ?? WA.hinglish;
  // Note tabhi jodo jab wo title se alag ho — warna ek hi baat do baar dikhti hai.
  const extra =
    note && note.trim() && note.trim().toLowerCase() !== title.trim().toLowerCase()
      ? `_${note.trim()}_\n\n`
      : "";
  return (
    `🔔 *Apka Saathi* — ${c.reminderKicker}\n\n` +
    `${title}\n\n` +
    extra +
    `🕐 ${whenLabel}\n\n` +
    `_${c.footer}_ 🙂`
  );
}

/** Document expiry ka WhatsApp text — {whenLabel} jaise "aaj" / "3 din me". */
export function documentWhatsAppText(
  name: string,
  whenLabel: string,
  locale: WaLocale = "hinglish",
): string {
  const c = WA[locale] ?? WA.hinglish;
  return (
    `📄 *Apka Saathi* — ${c.docKicker}\n\n` +
    `${c.docLine(name, whenLabel)}\n` +
    `${c.docNudge}\n\n` +
    `_${c.footer}_`
  );
}
