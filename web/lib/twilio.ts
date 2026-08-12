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

/**
 * Meta se approved template SIDs — HAR BHASHA KA APNA.
 *
 * ⚠️ Ye pehle ek-ek hi tha (`TWILIO_TEMPLATE_REMINDER_SID`), aur wahi ek sabko
 * jaata tha. Natija ye tha ki ek hi reminder do alag bhashaon me pahunchta tha:
 * email user ki chuni hui bhasha me nikalta tha aur WhatsApp hamesha Hinglish
 * me. Code se text badla bhi nahi ja sakta — Meta-approved template ka poora
 * text Twilio ke console me pada hota hai, sirf `{{1}}`/`{{2}}` bharte hain.
 *
 * Isliye Twilio par har kind ka har bhasha me alag template banta hai, aur uski
 * SID yahan aati hai. Bina suffix wala (Hinglish) hi default hai — app ka
 * default locale bhi wahi hai. Kisi bhasha ka SID na ho to wo Hinglish par gir
 * jaata hai: galat bhasha me pahunchna bilkul na pahunchne se behtar hai.
 *
 * .env.local:
 *   TWILIO_TEMPLATE_REMINDER_SID=HX...      # hinglish (default)
 *   TWILIO_TEMPLATE_REMINDER_SID_HI=HX...
 *   TWILIO_TEMPLATE_REMINDER_SID_EN=HX...
 *   TWILIO_TEMPLATE_DOCUMENT_SID=HX...      # hinglish (default)
 *   TWILIO_TEMPLATE_DOCUMENT_SID_HI=HX...
 *   TWILIO_TEMPLATE_DOCUMENT_SID_EN=HX...
 */
const TEMPLATES = {
  reminder: {
    hinglish: process.env.TWILIO_TEMPLATE_REMINDER_SID,
    hi: process.env.TWILIO_TEMPLATE_REMINDER_SID_HI,
    en: process.env.TWILIO_TEMPLATE_REMINDER_SID_EN,
  },
  document: {
    hinglish: process.env.TWILIO_TEMPLATE_DOCUMENT_SID,
    hi: process.env.TWILIO_TEMPLATE_DOCUMENT_SID_HI,
    en: process.env.TWILIO_TEMPLATE_DOCUMENT_SID_EN,
  },
} as const;

function templateSid(kind: "reminder" | "document", locale: WaLocale): string | undefined {
  const row = TEMPLATES[kind];
  return row[locale] || row.hinglish;
}

export function twilioConfigured(): boolean {
  return Boolean(SID && TOKEN && FROM);
}

/**
 * Kis bhasha ka template asli me maujood hai — admin ko dikhane ke liye.
 *
 * `exact`    = us bhasha ka apna template hai.
 * `fallback` = us bhasha ka nahi hai, Hinglish wala jayega (pahunchega, par
 *              galat bhasha me — yahi wo halat hai jo chup-chaap nikal jaati hai).
 * `none`     = koi template hi nahi. Production me Meta free-form text REJECT
 *              karta hai, yaani us raaste par message bilkul nahi jaata.
 */
export type WaTemplateState = "exact" | "fallback" | "none";

export function waTemplateState(
  kind: "reminder" | "document",
  locale: WaLocale,
): WaTemplateState {
  const row = TEMPLATES[kind];
  if (row[locale]) return "exact";
  if (row.hinglish) return "fallback";
  return "none";
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
  /** User ka pehla naam — greeting me. Na ho to bhasha ka aam shabd lagta hai. */
  userName?: string | null,
) {
  const who = greetingName(userName, locale);
  return sendWhatsApp(to, reminderWhatsAppText(title, whenLabel, note, locale, who), {
    templateSid: templateSid("reminder", locale),
    variables: { "1": who, "2": title, "3": whenLabel },
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
  userName?: string | null,
) {
  const who = greetingName(userName, locale);
  return sendWhatsApp(to, documentWhatsAppText(name, whenLabel, locale, who), {
    templateSid: templateSid("document", locale),
    variables: { "1": who, "2": name, "3": whenLabel },
    kind: "document",
    userId,
  });
}

/**
 * Greeting me kaunsa naam jaayega.
 *
 * ⚠️ Yahan kabhi khaali string nahi lautti, aur ye baat zaroori hai. Meta ka
 * niyam saaf hai: template ka koi bhi variable khaali nahi ja sakta — khaali
 * bhejte hi poori request reject ho jaati hai. Yaani jis user ne apna naam nahi
 * bhara, uska reminder BILKUL hi nahi jaata (aur error kahin dikhta bhi nahi,
 * kyunki Twilio use ek aam 400 me lauta deta hai).
 *
 * Isliye naam na hone par bhasha ka apna aam sambodhan lagta hai —
 * "Namaste ji", "नमस्ते जी", "Hello there". Teeno bilkul swabhavik lagte hain.
 */
function greetingName(name: string | null | undefined, locale: WaLocale): string {
  const clean = name?.trim();
  // Pehla shabd hi kaafi — "Nitish Kumar" greeting me bhadda lagta hai. Cron
  // pehle hi kaat ke bhejta hai; ye doosri jagah se aane wale callers ke liye.
  if (clean) return clean.split(/\s+/)[0];
  return (WA[locale] ?? WA.hinglish).fallbackName;
}

/**
 * WhatsApp ka text — user ki chuni hui bhasha me.
 *
 * ⚠️ Ye dono message pehle sirf Hinglish me jaate the, jabki email usi waqt
 * user ki bhasha me nikalta tha. Ek hi reminder do alag bhashaon me pahunchta
 * tha — email Hindi me, WhatsApp Hinglish me.
 *
 * ⚠️ Ye sirf PLAIN-TEXT raaste par lagta hai (sandbox / jab tak us bhasha ka
 * template set na ho). Production me Meta-approved template jaata hai, aur uska
 * text Twilio console me pada hota hai — code se badla hi nahi ja sakta. Har
 * bhasha ka apna template Twilio par approve hota hai; `templateSid()` upar
 * locale ke hisaab se sahi SID chunta hai.
 */
type WaLocale = "hinglish" | "hi" | "en";

const WA: Record<WaLocale, {
  /** "Namaste" / "नमस्ते" / "Hello" — naam se pehle. */
  greeting: string;
  /** Naam pata na ho to yahi lagta hai (khaali kabhi nahi ja sakta). */
  fallbackName: string;
  reminderKicker: string;
  docKicker: string;
  /** {name} {when} */
  docLine: (name: string, when: string) => string;
  docNudge: string;
  footer: string;
}> = {
  hinglish: {
    greeting: "Namaste",
    fallbackName: "ji",
    reminderKicker: "reminder",
    docKicker: "document reminder",
    docLine: (n, w) => `*${n}* ${w} expire ho raha hai.`,
    docNudge: "Time pe renew karwa lena. 🙂",
    footer: "Apka Saathi · jo kuch nahi bhoolta",
  },
  hi: {
    greeting: "नमस्ते",
    fallbackName: "जी",
    reminderKicker: "रिमाइंडर",
    docKicker: "डॉक्युमेंट रिमाइंडर",
    docLine: (n, w) => `*${n}* ${w} एक्सपायर हो रहा है।`,
    docNudge: "समय पर रिन्यू करा लीजिए। 🙂",
    footer: "Apka Saathi · जो कुछ नहीं भूलता",
  },
  en: {
    greeting: "Hello",
    fallbackName: "there",
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
  /** Greeting me lagne wala naam — `greetingName()` se aata hai. */
  who?: string,
): string {
  const c = WA[locale] ?? WA.hinglish;
  // Note tabhi jodo jab wo title se alag ho — warna ek hi baat do baar dikhti hai.
  const extra =
    note && note.trim() && note.trim().toLowerCase() !== title.trim().toLowerCase()
      ? `_${note.trim()}_\n\n`
      : "";
  return (
    `🔔 *Apka Saathi* — ${c.reminderKicker}\n\n` +
    `${c.greeting} ${who || c.fallbackName},\n\n` +
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
  who?: string,
): string {
  const c = WA[locale] ?? WA.hinglish;
  return (
    `📄 *Apka Saathi* — ${c.docKicker}\n\n` +
    `${c.greeting} ${who || c.fallbackName},\n\n` +
    `${c.docLine(name, whenLabel)}\n` +
    `${c.docNudge}\n\n` +
    `_${c.footer}_`
  );
}
