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
  opts: { templateSid?: string; variables?: Record<string, string> } = {},
): Promise<{ sent: boolean; skipped?: boolean }> {
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
    throw new Error(`twilio send failed: ${res.status} ${txt}`);
  }
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
) {
  return sendWhatsApp(to, reminderWhatsAppText(title, whenLabel, note), {
    templateSid: TEMPLATE_REMINDER,
    variables: { "1": title, "2": whenLabel },
  });
}

/** Document expiry bhejo — template ho to template se, warna plain text. */
export function sendDocumentWhatsApp(to: string, name: string, whenLabel: string) {
  return sendWhatsApp(to, documentWhatsAppText(name, whenLabel), {
    templateSid: TEMPLATE_DOCUMENT,
    variables: { "1": name, "2": whenLabel },
  });
}

/** Branded WhatsApp reminder text (logo emoji + brand). */
export function reminderWhatsAppText(
  title: string,
  whenLabel: string,
  note?: string | null,
): string {
  // Note tabhi jodo jab wo title se alag ho — warna ek hi baat do baar dikhti hai.
  const extra =
    note && note.trim() && note.trim().toLowerCase() !== title.trim().toLowerCase()
      ? `_${note.trim()}_\n\n`
      : "";
  return (
    `🔔 *Apka Saathi* — reminder\n\n` +
    `${title}\n\n` +
    extra +
    `🕐 ${whenLabel}\n\n` +
    `_Apka Saathi · jo kuch nahi bhoolta_ 🙂`
  );
}

/** Document expiry ka WhatsApp text — {whenLabel} jaise "aaj" / "3 din me". */
export function documentWhatsAppText(name: string, whenLabel: string): string {
  return (
    `📄 *Apka Saathi* — document reminder\n\n` +
    `*${name}* ${whenLabel} expire ho raha hai.\n` +
    `Time pe renew karwa lena. 🙂\n\n` +
    `_Apka Saathi · jo kuch nahi bhoolta_`
  );
}
