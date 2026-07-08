import nodemailer from "nodemailer";

/**
 * Reusable email layer.
 *
 * Gmail se email bhejne ke liye (2-step verification + App Password wala tareeka).
 *   .env.local:
 *     GMAIL_USER=tumhara@gmail.com
 *     GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx   (Google Account > Security > App passwords)
 *     CONTACT_TO=jahan-contact-aaye@gmail.com  (optional, default GMAIL_USER)
 *
 * Kahin bhi email bhejna ho:
 *   import { sendMail, renderEmail, emailButton } from "@/lib/email";
 *   await sendMail({ to, subject, html: renderEmail("Title", "<p>...</p>") });
 *
 * Env set nahi hai to sendMail silently skip karta hai (caller fail nahi hota).
 */

const GMAIL_USER = process.env.GMAIL_USER;
// App passwords Gmail spaces ke saath dikhata hai — spaces hata do.
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
const CONTACT_TO = process.env.CONTACT_TO ?? GMAIL_USER;
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://apkasaathi.com";

export function emailConfigured(): boolean {
  return Boolean(GMAIL_USER && GMAIL_APP_PASSWORD);
}

function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });
}

/* ------------------------------------------------------------------ */
/*  Generic mailer — yahi baar-baar reuse hoga                         */
/* ------------------------------------------------------------------ */

export type MailOptions = {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  fromName?: string;
};

/** Ek email bhejo. Env na ho to { skipped: true }. */
export async function sendMail(
  opts: MailOptions,
): Promise<{ sent: boolean; skipped?: boolean }> {
  if (!emailConfigured()) {
    console.warn("[email] GMAIL env not set — email skipped");
    return { sent: false, skipped: true };
  }
  await getTransporter().sendMail({
    from: `"${opts.fromName ?? "Saathi"}" <${GMAIL_USER}>`,
    to: opts.to,
    replyTo: opts.replyTo,
    subject: opts.subject,
    html: opts.html,
  });
  return { sent: true };
}

/* ------------------------------------------------------------------ */
/*  Template helpers — koi bhi content is shell mein daal ke bhej do   */
/* ------------------------------------------------------------------ */

const BRAND = "#C25A37";
const BRAND_DARK = "#A8492B";
const INK = "#2E2823";
const SOFT = "#6B5F54";
const CREAM = "#F7F2E9";
const LINE = "#E5DBC9";

/**
 * Branded email shell — table-based (email clients ke liye), responsive,
 * premium look. `inner` = raw HTML body.
 */
export function renderEmail(title: string, inner: string): string {
  return `
  <!DOCTYPE html>
  <html lang="hi">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <meta name="color-scheme" content="light"/>
  </head>
  <body style="margin:0;padding:0;background:${CREAM};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CREAM};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
      <tr>
        <td align="center" style="padding:28px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
            <!-- Brand header -->
            <tr>
              <td align="center" style="padding-bottom:22px;">
                <table role="presentation" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${SITE_URL}/logo.png" width="40" height="40" alt="Apka Saathi" style="display:block;width:40px;height:40px;border-radius:13px;background:${BRAND};"/>
                    </td>
                    <td style="vertical-align:middle;padding-left:10px;font-size:22px;font-weight:700;color:${INK};letter-spacing:-0.5px;">Apka Saathi</td>
                  </tr>
                </table>
              </td>
            </tr>
            <!-- Accent bar -->
            <tr><td style="height:4px;background:${BRAND};border-radius:4px 4px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>
            <!-- Card -->
            <tr>
              <td style="background:#FFFCF6;border:1px solid ${LINE};border-top:none;border-radius:0 0 24px 24px;padding:34px 30px;">
                <h1 style="margin:0 0 14px;font-size:25px;line-height:1.25;color:${INK};letter-spacing:-0.5px;font-weight:700;">${title}</h1>
                ${inner}
              </td>
            </tr>
            <!-- Footer -->
            <tr>
              <td align="center" style="padding:22px 10px 0;color:${SOFT};font-size:12px;line-height:1.7;">
                <strong style="color:${INK};">Apka Saathi</strong> — jo kuch nahi bhoolta.<br/>
                Koi spam nahi. Sirf zaroori baat. 🤍
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
}

export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:6px;">
    <tr><td style="border-radius:14px;background:${BRAND};">
      <a href="${href}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:14px;border:1px solid ${BRAND_DARK};">${label}</a>
    </td></tr>
  </table>`;
}

export function emailParagraph(text: string): string {
  return `<p style="margin:0 0 16px;font-size:16px;line-height:1.65;color:${SOFT};">${text}</p>`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Reminder email — due reminder pe user ko (branded). */
export async function sendReminderEmail(
  to: string,
  title: string,
  whenLabel: string,
): Promise<{ sent: boolean; skipped?: boolean }> {
  const inner =
    emailParagraph("Bas yaad dila raha hoon 🙂 — aapne ye set kiya tha:") +
    `<div style="margin:6px 0 18px;padding:18px 20px;border:1px solid ${LINE};border-radius:16px;background:${CREAM};">
       <div style="font-size:18px;font-weight:700;color:${INK};line-height:1.4;">${escapeHtml(title)}</div>
       <div style="margin-top:8px;font-size:14px;font-weight:600;color:${BRAND};">🕐 ${escapeHtml(whenLabel)}</div>
     </div>` +
    emailParagraph("Ho gaya to badhiya — warna abhi kar lo. Main yahin hoon. 🤍");
  return sendMail({
    to,
    subject: `🔔 Reminder: ${title}`,
    html: renderEmail("Aapka reminder ⏰", inner),
    fromName: "Apka Saathi",
  });
}

/* ------------------------------------------------------------------ */
/*  Specific emails — bas templates, sendMail ke thin wrappers         */
/* ------------------------------------------------------------------ */

/** Contact — admin ko notification + user ko confirmation. */
export async function sendContactEmails(
  name: string,
  email: string,
  message: string,
) {
  const adminHtml = renderEmail(
    "Naya contact message 📩",
    `<table style="width:100%;font-size:15px;color:${INK};border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:${SOFT};width:80px;">Naam</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:6px 0;color:${SOFT};">Email</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(email)}</td></tr>
      </table>
      <div style="margin-top:16px;padding:16px;background:${CREAM};border-radius:14px;font-size:15px;line-height:1.6;color:${INK};white-space:pre-wrap;">${escapeHtml(message)}</div>`,
  );

  const userHtml = renderEmail(
    "Message mil gaya! 🙏",
    `${emailParagraph(
      `Namaste ${escapeHtml(name)}, aapka message hum tak pahunch gaya hai. Hum jaldi hi jawab denge.`,
    )}
     <p style="margin:0;font-size:15px;line-height:1.6;color:${SOFT};">— Team Saathi</p>`,
  );

  return Promise.all([
    sendMail({
      to: CONTACT_TO ?? email,
      replyTo: email,
      fromName: "Saathi Contact",
      subject: `📩 Naya message — ${name}`,
      html: adminHtml,
    }),
    sendMail({
      to: email,
      subject: "Aapka message mil gaya — Saathi",
      html: userHtml,
    }),
  ]);
}
