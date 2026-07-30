import nodemailer from "nodemailer";
import fs from "fs";
import path from "path";

import { logServiceUsage } from "@/lib/usage-server";

/**
 * Reusable email layer — Hostinger SMTP se (info@apkasaathi.com).
 *
 *   .env.local / Vercel env:
 *     SMTP_HOST=smtp.hostinger.com
 *     SMTP_PORT=465
 *     SMTP_USER=info@apkasaathi.com
 *     SMTP_PASS=********
 *     CONTACT_TO=...              (optional — contact form kahan aaye)
 *     ERROR_ALERT_TO=...          (optional — app errors kahan aayein)
 *
 * Kahin bhi email bhejna ho:
 *   import { sendMail, renderEmail, emailButton } from "@/lib/email";
 *   await sendMail({ to, subject, html: renderEmail("Title", "<p>...</p>") });
 *
 * Env set nahi hai to sendMail silently skip karta hai (caller fail nahi hota).
 * Purana GMAIL_* env ab bhi fallback ke taur pe chalta hai.
 */

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 465);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;

// Purana Gmail setup — agar SMTP env na ho to isse chal jaata hai.
const GMAIL_USER = process.env.GMAIL_USER;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");

/** Jis address se sab email jaate hain. */
export const FROM_EMAIL = SMTP_USER ?? GMAIL_USER ?? "info@apkasaathi.com";
const CONTACT_TO = process.env.CONTACT_TO ?? FROM_EMAIL;
/** App/web ke errors yahan aate hain. */
export const ERROR_ALERT_TO = process.env.ERROR_ALERT_TO ?? "saathi8683@gmail.com";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.apkasaathi.com";

/**
 * Logo ko email ke saath hi bhejo (CID inline attachment) — remote URL slow
 * load hota tha / mail clients block kar dete the. Ek baar module load pe padh
 * lo. Na padh paaye (kuch hosts) to remote URL par gir jao.
 */
const LOGO_CID = "saathilogo";
let LOGO_BUFFER: Buffer | null = null;
try {
  LOGO_BUFFER = fs.readFileSync(path.join(process.cwd(), "public", "logo.png"));
} catch {
  LOGO_BUFFER = null;
}
function logoSrc(): string {
  return LOGO_BUFFER ? `cid:${LOGO_CID}` : `${SITE_URL}/logo.png`;
}

export function emailConfigured(): boolean {
  return Boolean((SMTP_HOST && SMTP_USER && SMTP_PASS) || (GMAIL_USER && GMAIL_APP_PASSWORD));
}

function getTransporter() {
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    return nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465, // 465 = implicit TLS, 587 = STARTTLS
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
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
  /** Admin ke hisaab ke liye — 'reminder' | 'document' | 'welcome' … (item 3). */
  kind?: string;
  userId?: string | null;
};

/** Ek email bhejo. Env na ho to { skipped: true }. */
export async function sendMail(
  opts: MailOptions,
): Promise<{ sent: boolean; skipped?: boolean }> {
  const kind = opts.kind ?? "other";
  if (!emailConfigured()) {
    console.warn("[email] SMTP env not set — email skipped");
    return { sent: false, skipped: true };
  }
  // Logo inline (CID) — tabhi jab html usse reference karta ho aur buffer mila ho.
  const attachments =
    LOGO_BUFFER && opts.html.includes(`cid:${LOGO_CID}`)
      ? [{ filename: "logo.png", content: LOGO_BUFFER, cid: LOGO_CID, contentType: "image/png" }]
      : undefined;
  try {
    await getTransporter().sendMail({
      from: `"${opts.fromName ?? "Apka Saathi"}" <${FROM_EMAIL}>`,
      to: opts.to,
      replyTo: opts.replyTo,
      subject: opts.subject,
      html: opts.html,
      attachments,
    });
  } catch (err) {
    // Fail bhi ginte hain — SMTP ka quota khatam ho ya password badal jaye to
    // admin ko sabse pehle yahi dikhta hai (item 3).
    logServiceUsage("email", kind, {
      ok: false,
      userId: opts.userId,
      meta: { error: String(err).slice(0, 200) },
    });
    throw err;
  }
  logServiceUsage("email", kind, { userId: opts.userId });
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
export type EmailLocale = "hinglish" | "hi" | "en";

/**
 * Email footer ki do lines — user ki bhasha me.
 *
 * ⚠️ Brand ka naam **"Apka Saathi"** har bhasha me waisa hi rehta hai. Naam
 * translate nahi hota; wo pehchaan hai.
 *
 * Uske neeche wali line (slogan) zaroor badalti hai. English me "jo kuch nahi
 * bhoolta" ka koi matlab nahi banta — wahan hamara asli English slogan chalta
 * hai: "never forgets what matters".
 *
 * Doosri line pehle "Koi spam nahi. Sirf zaroori baat." thi — wo defensive
 * lagti thi, jaise safai de rahe hon. Ab wo jagah kaam ki baat kehti hai: ye
 * email aaya kyun.
 */
const FOOTER: Record<EmailLocale, { slogan: string; why: string }> = {
  hinglish: {
    slogan: "jo kuch nahi bhoolta.",
    why: "Ye email isliye aaya kyunki aapne Saathi me ye yaad rakhne ko kaha tha.",
  },
  hi: {
    slogan: "जो कुछ नहीं भूलता।",
    why: "यह ईमेल इसलिए आया क्योंकि आपने साथी से यह याद रखने को कहा था।",
  },
  en: {
    slogan: "never forgets what matters.",
    why: "You're getting this because you asked Saathi to remember it for you.",
  },
};

export function renderEmail(
  title: string,
  inner: string,
  preheader = "",
  locale: EmailLocale = "hinglish",
): string {
  const f = FOOTER[locale] ?? FOOTER.hinglish;
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
                      <img src="${logoSrc()}" width="42" height="42" alt="Apka Saathi"
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
              <strong style="color:${INK};">Apka Saathi</strong> — ${f.slogan}<br/>
              <a href="${SITE_URL}" style="color:${SOFT};text-decoration:underline;">apkasaathi.com</a><br/>
              <span style="color:${SOFT};">${f.why} 🤍</span>
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

/**
 * Gmail ko email me se "event" na dikhe — iske liye time todo (item 10).
 *
 * Dikkat: Gmail ka "Events from Gmail" khud-ba-khud email padh ke calendar me
 * event bana deta hai. Reminder mail me "Reminder: Calling" jaisa subject aur
 * "Today 8:03 pm" jaisa waqt milte hi wo maan leta hai ki ye koi appointment
 * hai — aur inbox me Google Calendar ka card, "Invite others" button, sab aa
 * jaata hai. User ka email hamara dikhta hi nahi.
 *
 * Bhejne wale ke liye ise band karne ka koi official header ya flag nahi hai
 * (Google ye setting sirf paane wale ko deta hai). Isliye ek hi raasta bachta
 * hai: waqt ko aise likho ki insaan padh le par parser na pakde.
 *
 * U+2060 (WORD JOINER) bilkul invisible hai, jagah nahi leta, line bhi nahi
 * todta — bas "8:03" ko ek time token ke roop me tootne se rok deta hai.
 * Screen reader isse chhod deta hai, copy-paste me bhi kuch dikhta nahi.
 */
const WORD_JOINER = "⁠";

export function unparseableTime(s: string): string {
  // Ginti aur ":" ke beech joiner daalo — baaki text waisa ka waisa.
  // Ek hi ank ho ("8 AM") to beech me daalne ki jagah hi nahi bachti, isliye
  // uske dono taraf lagate hain — warna wo akela number time ban jaata hai.
  return s.replace(/\d[\d:]*\d|\d/g, (num) =>
    num.length === 1 ? WORD_JOINER + num + WORD_JOINER : num.split("").join(WORD_JOINER),
  );
}

type ReminderCopy = {
  subject: (t: string) => string;
  heading: string;
  intro: string;
  outro: string;
  /** "Aapne kaha tha:" — user ke apne shabdon ke upar ka label. */
  yourWords: string;
};

/**
 * ⚠️ Subject me "Reminder:" jaan-boojh ke hataya gaya hai (item 10).
 *
 * "Reminder: Calling" Gmail ke liye ek appointment ka sabse pehchana hua shakl
 * hai — usi se wo calendar card aur "Invite others" button bana deta tha. Brand
 * ka naam aage rakhne se inbox me hamari pehchaan bhi banti hai aur Gmail ise
 * event nahi samajhta.
 */
const REMINDER: Record<EmailLocale, ReminderCopy> = {
  hinglish: {
    subject: (t) => `Apka Saathi ⏰ — ${t}`,
    heading: "Aapka reminder ⏰",
    intro: "Bas yaad dila raha hoon 🙂 — aapne ye set kiya tha:",
    outro: "Ho gaya to badhiya — warna abhi kar lo. Main yahin hoon. 🤍",
    yourWords: "Aapne kaha tha",
  },
  hi: {
    subject: (t) => `Apka Saathi ⏰ — ${t}`,
    heading: "आपका रिमाइंडर ⏰",
    intro: "बस याद दिला रहा हूँ 🙂 — आपने यह सेट किया था:",
    outro: "हो गया तो बढ़िया — वरना अभी कर लो। मैं यहीं हूँ। 🤍",
    yourWords: "आपने कहा था",
  },
  en: {
    subject: (t) => `Apka Saathi ⏰ — ${t}`,
    heading: "Your reminder ⏰",
    intro: "Just a gentle nudge 🙂 — you had set this:",
    outro: "Done already? Great — if not, do it now. I'm right here. 🤍",
    yourWords: "You said",
  },
};

/**
 * Reminder email — due reminder pe user ko, uski chuni bhasha me.
 *
 * `note` = user ne apne shabdon me jo likha/bola tha. Pehle email me sirf title
 * jaata tha; title AI ka saaf kiya hua chhota version hota hai ("Test"), isliye
 * mail padh ke user ko yaad hi nahi aata tha ki baat kis baare me thi. Note
 * hone par wo title ke neeche dikh jaata hai.
 */
export async function sendReminderEmail(
  to: string,
  title: string,
  whenLabel: string,
  locale: EmailLocale = "hinglish",
  note?: string | null,
  userId?: string | null,
): Promise<{ sent: boolean; skipped?: boolean }> {
  const r = REMINDER[locale] ?? REMINDER.hinglish;

  const noteBlock =
    note && note.trim() && note.trim().toLowerCase() !== title.trim().toLowerCase()
      ? `<div style="margin-top:12px;padding-top:12px;border-top:1px dashed ${LINE};">
           <div style="font-size:11.5px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:${SOFT};">${escapeHtml(r.yourWords)}</div>
           <div style="margin-top:5px;font-size:14.5px;line-height:1.6;color:${SOFT};white-space:pre-wrap;word-break:break-word;">${escapeHtml(note.trim())}</div>
         </div>`
      : "";

  const inner =
    emailParagraph(r.intro) +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;">
       <tr><td style="padding:18px 20px;border:1px solid ${LINE};border-left:4px solid ${BRAND};border-radius:14px;background:${CREAM};">
         <div style="font-size:18px;font-weight:700;color:${INK};line-height:1.4;">${escapeHtml(title)}</div>
         <div style="margin-top:8px;font-size:14px;font-weight:600;color:${BRAND};">🕐 ${unparseableTime(escapeHtml(whenLabel))}</div>
         ${noteBlock}
       </td></tr>
     </table>` +
    emailParagraph(r.outro);

  return sendMail({
    to,
    subject: r.subject(title),
    // Preheader me note bhi — inbox ki preview line se hi kaam yaad aa jaata hai.
    // Waqt yahan bhi toda hua: preview line Gmail ke scanner ko utni hi dikhti
    // hai jitni body (item 10).
    html: renderEmail(
      r.heading,
      inner,
      [title, unparseableTime(whenLabel), note?.trim()].filter(Boolean).join(" · "),
      locale,
    ),
    fromName: "Apka Saathi",
    kind: "reminder",
    userId,
  });
}

/* ------------------------------------------------------------------ */
/*  Document expiry email — 7 din / 1 din pehle, aur us din (item 18)   */
/* ------------------------------------------------------------------ */

type DocExpiryCopy = {
  subject: (name: string, when: string) => string;
  heading: string;
  /** {name} {when} */
  intro: (name: string, when: string) => string;
  outro: string;
  whenLabel: (lead: number) => string;
  cta: string;
};

const DOC_EXPIRY: Record<EmailLocale, DocExpiryCopy> = {
  hinglish: {
    subject: (name, when) => `Apka Saathi — ${name} ${when}`,
    heading: "Document ki yaad dila raha hoon 📄",
    intro: (name, when) =>
      `Aapka <b>${name}</b> ${when} expire ho raha hai. Time rehte kar lo — baad me bhaag-daud na ho.`,
    outro: "Ho gaya ho to app me bata dena — main aage ke reminder band kar dunga. 🤍",
    whenLabel: (lead) =>
      lead === 0 ? "aaj" : lead === 1 ? "kal" : `${lead} din me`,
    cta: "App me dekho",
  },
  hi: {
    subject: (name, when) => `Apka Saathi — ${name} ${when}`,
    heading: "डॉक्युमेंट की याद दिला रहा हूँ 📄",
    intro: (name, when) =>
      `आपका <b>${name}</b> ${when} एक्सपायर हो रहा है। समय रहते कर लीजिए — बाद में भाग-दौड़ न हो।`,
    outro: "हो गया हो तो ऐप में बता दीजिए — मैं आगे के रिमाइंडर बंद कर दूँगा। 🤍",
    whenLabel: (lead) => (lead === 0 ? "आज" : lead === 1 ? "कल" : `${lead} दिन में`),
    cta: "ऐप में देखें",
  },
  en: {
    subject: (name, when) => `Apka Saathi — ${name} expires ${when}`,
    heading: "A quick nudge about a document 📄",
    intro: (name, when) =>
      `Your <b>${name}</b> expires ${when}. Worth sorting now rather than in a rush later.`,
    outro: "Already done? Tell me in the app and I'll switch off the rest of the reminders. 🤍",
    whenLabel: (lead) =>
      lead === 0 ? "today" : lead === 1 ? "tomorrow" : `in ${lead} days`,
    cta: "Open the app",
  },
};

/**
 * Document expiry email — ladder ke teenon padav par (7 din, 1 din, us din).
 *
 * ⚠️ Ye WhatsApp aur phone ki notification ke SAATH jaata hai, teenon ek hi
 * moment par. Pehle sirf notification aur (der se) WhatsApp jaata tha; email
 * kabhi nahi. Isliye jo log app kam kholte hain unhe expiry ka pata hi nahi
 * chalta tha (item 18).
 */
export async function sendDocumentExpiryEmail(
  to: string,
  name: string,
  lead: number,
  locale: EmailLocale = "hinglish",
  userId?: string | null,
): Promise<{ sent: boolean; skipped?: boolean }> {
  const c = DOC_EXPIRY[locale] ?? DOC_EXPIRY.hinglish;
  const when = c.whenLabel(lead);
  // Aaj wala sabse zaroori — usse alag rang deta hai.
  const accent = lead === 0 ? BRAND : lead === 1 ? "#E0A458" : LINE;

  const inner =
    emailParagraph(c.intro(escapeHtml(name), when)) +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;">
       <tr><td style="padding:18px 20px;border:1px solid ${LINE};border-left:4px solid ${accent};border-radius:14px;background:${CREAM};">
         <div style="font-size:18px;font-weight:700;color:${INK};line-height:1.4;">${escapeHtml(name)}</div>
         <div style="margin-top:8px;font-size:14px;font-weight:600;color:${BRAND};">${escapeHtml(when)}</div>
       </td></tr>
     </table>` +
    emailButton(SITE_URL, c.cta) +
    emailParagraph(c.outro);

  return sendMail({
    to,
    subject: c.subject(name, when),
    html: renderEmail(c.heading, inner, `${name} · ${when}`, locale),
    fromName: "Apka Saathi",
    kind: "document",
    userId,
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

const WELCOME: Record<EmailLocale, WelcomeCopy> = {
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
      "Hello{name}! I'm your <b>Saathi</b> — no more stressing over document expiries, important dates and everyday tasks. Just tell me, and I'll handle the rest. 🤍",
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
  locale: EmailLocale = "hinglish",
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
    html: renderEmail(w.title, inner, w.preheader, locale),
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
