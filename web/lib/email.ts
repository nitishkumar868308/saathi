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
 * Branded email shell — table-based (purane email clients ke liye bhi chale),
 * mobile pe responsive, logo ke saath.
 *
 * @param preheader Inbox preview me dikhne wali chhoti line. Na do to client
 *                  body ka pehla text utha lega — aksar bhadda lagta hai.
 */
export function renderEmail(title: string, inner: string, preheader = ""): string {
  return `<!DOCTYPE html>
<html lang="hi">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <meta name="color-scheme" content="light"/>
  <meta name="supported-color-schemes" content="light"/>
  <title>${title}</title>
  <style>
    /* Mobile: gutters chhote, text thoda bada — button poori chaudai me */
    @media only screen and (max-width:600px) {
      .es-card    { padding:26px 20px !important; border-radius:0 0 20px 20px !important; }
      .es-outer   { padding:18px 12px !important; }
      .es-title   { font-size:22px !important; }
      .es-btn a   { display:block !important; text-align:center !important; }
      .es-wordmark{ font-size:19px !important; }
    }
    /* Gmail/Outlook link auto-styling se bachao */
    a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; }
  </style>
</head>
<body style="margin:0;padding:0;background:${CREAM};-webkit-font-smoothing:antialiased;">
  <!-- Preview text (inbox me dikhta hai, email me nahi) -->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">
    ${escapeHtml(preheader)}
    ${"&#8199;&#65279;&#847;".repeat(60)}
  </div>

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${CREAM};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr>
      <td align="center" class="es-outer" style="padding:30px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">

          <!-- Brand -->
          <tr>
            <td align="center" style="padding-bottom:20px;">
              <a href="${SITE_URL}" style="text-decoration:none;">
                <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align:middle;">
                      <img src="${SITE_URL}/logo.png" width="42" height="42" alt="Apka Saathi"
                           style="display:block;width:42px;height:42px;border:0;border-radius:13px;background:${BRAND};"/>
                    </td>
                    <td class="es-wordmark" style="vertical-align:middle;padding-left:11px;font-size:21px;font-weight:700;color:${INK};letter-spacing:-0.4px;">Apka Saathi</td>
                  </tr>
                </table>
              </a>
            </td>
          </tr>

          <!-- Accent bar -->
          <tr><td style="height:4px;background:${BRAND};border-radius:5px 5px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>

          <!-- Card -->
          <tr>
            <td class="es-card" style="background:#FFFCF6;border:1px solid ${LINE};border-top:none;border-radius:0 0 24px 24px;padding:34px 32px;">
              <h1 class="es-title" style="margin:0 0 16px;font-size:25px;line-height:1.25;color:${INK};letter-spacing:-0.5px;font-weight:700;">${title}</h1>
              ${inner}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td align="center" style="padding:24px 12px 0;color:${SOFT};font-size:12.5px;line-height:1.75;">
              <strong style="color:${INK};">Apka Saathi</strong> — jo kuch nahi bhoolta.<br/>
              <a href="${SITE_URL}" style="color:${SOFT};text-decoration:underline;">apkasaathi.com</a>
              &nbsp;·&nbsp; Koi spam nahi. Sirf zaroori baat. 🤍
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
  return `<table role="presentation" class="es-btn" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:8px;">
    <tr><td style="border-radius:14px;background:${BRAND};">
      <a href="${href}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;line-height:1.2;padding:15px 28px;border-radius:14px;border:1px solid ${BRAND_DARK};">${label}</a>
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
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;">
       <tr><td style="padding:18px 20px;border:1px solid ${LINE};border-left:4px solid ${BRAND};border-radius:14px;background:${CREAM};">
         <div style="font-size:18px;font-weight:700;color:${INK};line-height:1.4;">${escapeHtml(title)}</div>
         <div style="margin-top:8px;font-size:14px;font-weight:600;color:${BRAND};">🕐 ${escapeHtml(whenLabel)}</div>
       </td></tr>
     </table>` +
    emailParagraph("Ho gaya to badhiya — warna abhi kar lo. Main yahin hoon. 🤍");

  return sendMail({
    to,
    subject: `🔔 Reminder: ${title}`,
    html: renderEmail(
      "Aapka reminder ⏰",
      inner,
      `${title} · ${whenLabel}`, // inbox preview
    ),
    fromName: "Apka Saathi",
  });
}

/* ------------------------------------------------------------------ */
/*  Welcome email — naye user ko (email + Google dono)                 */
/* ------------------------------------------------------------------ */

type WelcomeCopy = {
  subject: string;
  title: string;
  preheader: string;
  intro: string;
  featuresLabel: string;
  features: [string, string][]; // [emoji, text]
  cta: string;
  outro: string;
};

const WELCOME: Record<"hinglish" | "hi" | "en", WelcomeCopy> = {
  hinglish: {
    subject: "Welcome to Apka Saathi 🎉",
    title: "Aa gaye aap! Chalo shuru karein 🎉",
    preheader: "Ab kuch yaad rakhne ki tension nahi — Saathi sambhal lega.",
    intro:
      "Namaste{name}! Main hoon aapka <b>Saathi</b> — ab documents ki expiry, zaroori dates aur roz ke kaam yaad rakhne ki tension khatam. Aap bas batao, baaki main sambhal lunga. 🤍",
    featuresLabel: "Ye kar sakte ho:",
    features: [
      ["📄", "Document ki photo daalo — expiry khud yaad rakhunga"],
      ["⏰", "Bol ke ya likh ke reminder set karo — sahi time pe yaad dila dunga"],
      ["🔔", "Notification, WhatsApp aur email — sab pe yaad"],
    ],
    cta: "App kholo aur pehla document add karo",
    outro: "Koi dikkat ho to bas reply kar do. Main yahin hoon. 🙂",
  },
  hi: {
    subject: "Apka Saathi में आपका स्वागत है 🎉",
    title: "आप आ गए! चलिए शुरू करें 🎉",
    preheader: "अब कुछ याद रखने की टेंशन नहीं — साथी सँभाल लेगा।",
    intro:
      "नमस्ते{name}! मैं हूँ आपका <b>साथी</b> — अब डॉक्युमेंट्स की एक्सपायरी, ज़रूरी तारीख़ें और रोज़ के काम याद रखने की टेंशन खत्म। आप बस बताइए, बाकी मैं सँभाल लूँगा। 🤍",
    featuresLabel: "आप ये कर सकते हैं:",
    features: [
      ["📄", "डॉक्युमेंट की फ़ोटो डालें — एक्सपायरी खुद याद रखूँगा"],
      ["⏰", "बोलकर या लिखकर रिमाइंडर सेट करें — सही समय पर याद दिला दूँगा"],
      ["🔔", "नोटिफ़िकेशन, WhatsApp और ईमेल — सब पर याद"],
    ],
    cta: "ऐप खोलें और पहला डॉक्युमेंट जोड़ें",
    outro: "कोई दिक्कत हो तो बस reply कर दें। मैं यहीं हूँ। 🙂",
  },
  en: {
    subject: "Welcome to Apka Saathi 🎉",
    title: "You're in! Let's get started 🎉",
    preheader: "No more remembering things yourself — Saathi's got it.",
    intro:
      "Namaste{name}! I'm your <b>Saathi</b> — no more stressing over document expiries, important dates and everyday tasks. Just tell me, and I'll handle the rest. 🤍",
    featuresLabel: "Here's what you can do:",
    features: [
      ["📄", "Add a photo of a document — I'll remember its expiry"],
      ["⏰", "Set reminders by voice or text — I'll nudge you at the right time"],
      ["🔔", "Notifications, WhatsApp and email — reminders everywhere"],
    ],
    cta: "Open the app and add your first document",
    outro: "If you ever need anything, just reply. I'm right here. 🙂",
  },
};

/** Welcome email naye user ko — user ki chuni bhasha me. */
export async function sendWelcomeEmail(
  to: string,
  name: string,
  locale: "hinglish" | "hi" | "en" = "hinglish",
): Promise<{ sent: boolean; skipped?: boolean }> {
  const w = WELCOME[locale] ?? WELCOME.hinglish;
  const firstName = (name || "").trim().split(" ")[0];
  const namePart = firstName ? ` ${escapeHtml(firstName)}` : "";

  const featureRows = w.features
    .map(
      ([emoji, text]) =>
        `<tr>
           <td style="vertical-align:top;padding:0 12px 14px 0;font-size:22px;line-height:1.3;">${emoji}</td>
           <td style="vertical-align:top;padding:0 0 14px;font-size:15.5px;line-height:1.55;color:${SOFT};">${text}</td>
         </tr>`,
    )
    .join("");

  const inner =
    emailParagraph(w.intro.replace("{name}", namePart)) +
    `<p style="margin:22px 0 10px;font-size:13px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:${INK};">${w.featuresLabel}</p>
     <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom:20px;">${featureRows}</table>` +
    emailButton(`${SITE_URL}`, w.cta) +
    `<div style="height:18px;line-height:18px;font-size:0;">&nbsp;</div>` +
    emailParagraph(w.outro);

  return sendMail({
    to,
    subject: w.subject,
    html: renderEmail(w.title, inner, w.preheader),
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
      <div style="margin-top:16px;padding:16px;background:${CREAM};border-radius:14px;font-size:15px;line-height:1.6;color:${INK};white-space:pre-wrap;word-break:break-word;">${escapeHtml(message)}</div>`,
    `${name} — ${message.slice(0, 90)}`,
  );

  const userHtml = renderEmail(
    "Message mil gaya! 🙏",
    `${emailParagraph(
      `Namaste ${escapeHtml(name)}, aapka message hum tak pahunch gaya hai. Hum jaldi hi jawab denge.`,
    )}
     <p style="margin:0;font-size:15px;line-height:1.6;color:${SOFT};">— Team Apka Saathi</p>`,
    "Hum jaldi hi jawab denge 🙏",
  );

  return Promise.all([
    sendMail({
      to: CONTACT_TO ?? email,
      replyTo: email,
      fromName: "Apka Saathi Contact",
      subject: `📩 Naya message — ${name}`,
      html: adminHtml,
    }),
    sendMail({
      to: email,
      subject: "Aapka message mil gaya — Apka Saathi",
      html: userHtml,
      fromName: "Apka Saathi",
    }),
  ]);
}
