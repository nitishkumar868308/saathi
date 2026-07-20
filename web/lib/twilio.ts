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

export function twilioConfigured(): boolean {
  return Boolean(SID && TOKEN && FROM);
}

/**
 * WhatsApp message bhejo. `to` = E.164 number (jaise +919876543210).
 * Returns { sent } / { skipped } / throw on hard error.
 */
export async function sendWhatsApp(
  to: string,
  body: string,
): Promise<{ sent: boolean; skipped?: boolean }> {
  if (!twilioConfigured()) {
    console.warn("[twilio] env not set — WhatsApp skipped");
    return { sent: false, skipped: true };
  }
  const toWa = to.startsWith("whatsapp:") ? to : `whatsapp:${to}`;
  const form = new URLSearchParams({ From: FROM as string, To: toWa, Body: body });

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

/** Branded WhatsApp reminder text (logo emoji + brand). */
export function reminderWhatsAppText(title: string, whenLabel: string): string {
  return (
    `🔔 *Apka Saathi* — reminder\n\n` +
    `${title}\n\n` +
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
