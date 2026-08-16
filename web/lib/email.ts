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
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://apkasaathi.com";

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
/*  Plus khatam — "aapka data safe hai, bas ab free plan par hai"       */
/* ------------------------------------------------------------------ */

/**
 * Plus khatam hone par jo bilkul chup tha — aur usi chuppi se support bharta tha.
 *
 * ⚠️ Downgrade ab apne aap hota hai (`supabase/cron-plan-expiry.sql`): Plus ki
 * expiry nikalte hi free hadd se AAGE ke documents lock ho jaate hain aur aage
 * ke reminders pause. Ye theek hai — par user ko kahin se ye bataya hi nahi
 * jaata tha.
 *
 * Uske liye wo bilkul aisa dikhta hai jaise app kharab ho gayi ho: "mere
 * documents kahan gaye", "reminder aana band kyun ho gaya". Aur ye sabse bura
 * kism ka bharosa-todne wala pal hai, kyunki hua kuch galat nahi tha — bas plan
 * khatam ho gaya, aur wo ek line kisi ne kahi hi nahi.
 *
 * ⚠️ Is mail ka poora lehja jaan-boojh ke "sab surakshit hai" wala hai, "aapne
 * kho diya" wala nahi. Do wajah: pehli, ye SACH hai — kuch delete nahi hota,
 * sirf lock hota hai, aur Plus wapas lete hi sab khud khul jaata hai
 * (`grant_plus_days`). Doosri, dara ke bechna is app ke poore mizaaj se ulta
 * hai. Ginti (kitne lock hue) isliye di jaati hai ki user ko apni haalat SAAF
 * dikhe — dabaav ke liye nahi.
 */
type PlanExpiredCopy = {
  subject: string;
  heading: string;
  preheader: string;
  intro: string;
  /** "Abhi aapke paas" wale box ka sar-naam. */
  statusLabel: string;
  docsLine: (locked: number, free: number) => string;
  remindersLine: (paused: number, free: number) => string;
  /** Kuch lock hi nahi hua (free hadd ke andar tha) — tab ye line. */
  nothingLocked: string;
  safe: string;
  cta: string;
  outro: string;
};

const PLAN_EXPIRED: Record<EmailLocale, PlanExpiredCopy> = {
  hinglish: {
    subject: "Apka Saathi — aapka Plus khatam ho gaya",
    heading: "Aapka Plus khatam ho gaya 🤍",
    preheader: "Kuch delete nahi hua — sab kuch surakshit hai, bas free plan par hai.",
    intro:
      "Namaste{name}! Aapka <b>Saathi Plus</b> khatam ho gaya hai, isliye account ab free plan par aa gaya hai. <b>Kuch bhi delete nahi hua</b> — aapka har document aur har reminder waise ka waisa surakshit hai.",
    statusLabel: "Abhi aapke paas",
    docsLine: (locked, free) =>
      `<b>${free} documents</b> khule hain. Baaki <b>${locked}</b> abhi lock hain — dikhte hain, khulte nahi.`,
    remindersLine: (paused, free) =>
      `<b>${free} reminders</b> chalu hain. Baaki <b>${paused}</b> abhi pause hain — inka alert nahi aayega.`,
    nothingLocked: "Aapka saara data free plan ki hadd ke andar hai — kuch bhi lock nahi hua.",
    safe: "Plus dobara lete hi sab kuch usi pal wapas khul jaata hai — kuch dobara daalna nahi padta.",
    cta: "Plus wapas lo",
    outro: "Koi sawaal ho to bas is mail ka reply kar do. Main yahin hoon. 🙂",
  },
  hi: {
    subject: "Apka Saathi — आपका Plus खत्म हो गया",
    heading: "आपका Plus खत्म हो गया 🤍",
    preheader: "कुछ डिलीट नहीं हुआ — सब कुछ सुरक्षित है, बस फ्री प्लान पर है।",
    intro:
      "नमस्ते{name}! आपका <b>Saathi Plus</b> खत्म हो गया है, इसलिए अकाउंट अब फ्री प्लान पर आ गया है। <b>कुछ भी डिलीट नहीं हुआ</b> — आपका हर डॉक्युमेंट और हर रिमाइंडर वैसे का वैसा सुरक्षित है।",
    statusLabel: "अभी आपके पास",
    docsLine: (locked, free) =>
      `<b>${free} डॉक्युमेंट</b> खुले हैं। बाकी <b>${locked}</b> अभी लॉक हैं — दिखते हैं, खुलते नहीं।`,
    remindersLine: (paused, free) =>
      `<b>${free} रिमाइंडर</b> चालू हैं। बाकी <b>${paused}</b> अभी पॉज़ हैं — इनका अलर्ट नहीं आएगा।`,
    nothingLocked: "आपका सारा डेटा फ्री प्लान की हद के अंदर है — कुछ भी लॉक नहीं हुआ।",
    safe: "Plus दोबारा लेते ही सब कुछ उसी पल वापस खुल जाता है — कुछ दोबारा डालना नहीं पड़ता।",
    cta: "Plus वापस लें",
    outro: "कोई सवाल हो तो बस इस मेल का reply कर दीजिए। मैं यहीं हूँ। 🙂",
  },
  en: {
    subject: "Apka Saathi — your Plus has ended",
    heading: "Your Plus has ended 🤍",
    preheader: "Nothing was deleted — everything is safe, just on the free plan now.",
    intro:
      "Hello{name}! Your <b>Saathi Plus</b> has ended, so your account is back on the free plan. <b>Nothing has been deleted</b> — every document and every reminder is exactly where you left it.",
    statusLabel: "Right now you have",
    docsLine: (locked, free) =>
      `<b>${free} documents</b> open. The other <b>${locked}</b> are locked for now — you can see them, but not open them.`,
    remindersLine: (paused, free) =>
      `<b>${free} reminders</b> active. The other <b>${paused}</b> are paused for now — they won't alert you.`,
    nothingLocked: "Everything you have fits within the free plan — nothing has been locked.",
    safe: "The moment you take Plus again, all of it unlocks — you never have to add anything twice.",
    cta: "Get Plus back",
    outro: "Any questions, just reply to this email. I'm right here. 🙂",
  },
};

export type PlanExpiredCounts = {
  /** Free plan par kitne documents khule rehte hain (admin ka `app_config`). */
  freeDocuments: number;
  freeReminders: number;
  /** Free hadd se aage kitne lock/pause hue. 0 = kuch bhi nahi. */
  lockedDocuments: number;
  pausedReminders: number;
};

export async function sendPlanExpiredEmail(
  to: string,
  name: string,
  counts: PlanExpiredCounts,
  locale: EmailLocale = "hinglish",
  userId?: string | null,
): Promise<{ sent: boolean; skipped?: boolean }> {
  const c = PLAN_EXPIRED[locale] ?? PLAN_EXPIRED.hinglish;
  const nameBit = name.trim() ? ` ${escapeHtml(name.trim().split(" ")[0])}` : "";

  const anyLocked = counts.lockedDocuments > 0 || counts.pausedReminders > 0;
  const rows = anyLocked
    ? [
        counts.lockedDocuments > 0
          ? `<li style="margin:0 0 8px;">${c.docsLine(counts.lockedDocuments, counts.freeDocuments)}</li>`
          : "",
        counts.pausedReminders > 0
          ? `<li style="margin:0;">${c.remindersLine(counts.pausedReminders, counts.freeReminders)}</li>`
          : "",
      ].join("")
    : `<li style="margin:0;">${c.nothingLocked}</li>`;

  const inner =
    emailParagraph(c.intro.replace("{name}", nameBit)) +
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px;">
       <tr><td style="padding:18px 20px;border:1px solid ${LINE};border-left:4px solid ${BRAND};border-radius:14px;background:${CREAM};">
         <div style="font-size:11.5px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:${SOFT};">${escapeHtml(c.statusLabel)}</div>
         <ul style="margin:10px 0 0;padding-left:18px;font-size:14.5px;line-height:1.65;color:${INK};">${rows}</ul>
       </td></tr>
     </table>` +
    emailParagraph(c.safe) +
    emailButton(`${SITE_URL}/#pricing`, c.cta) +
    emailParagraph(c.outro);

  return sendMail({
    to,
    subject: c.subject,
    html: renderEmail(c.heading, inner, c.preheader, locale),
    fromName: "Apka Saathi",
    kind: "plan_expired",
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
/**
 * Account deletion request — Play Store ki data-deletion policy ke liye.
 * Admin ko turant pata chale (7 din ke andar poora karna hota hai) aur user ko
 * likhit confirmation mile ki request aa gayi hai.
 */
/**
 * Account delete request — user wali email ki copy, teeno bhasha me.
 *
 * ⚠️ Pehle ye poori email sirf Hinglish me thi. Jis user ne app me Hindi ya
 * English chuni hoti thi, uske paas apne account ke delete hone ki sabse
 * zaroori khabar ek aisi bhasha me pahunchti thi jo usne chuni hi nahi thi.
 */
const DELETE_REQ: Record<EmailLocale, {
  title: string;
  subject: string;
  preheader: string;
  /** {name} */
  body: (name: string) => string;
  changedMind: string;
  team: string;
}> = {
  hinglish: {
    title: "Delete request mil gayi 🗑️",
    subject: "Aapki delete request mil gayi — Apka Saathi",
    preheader: "Aapka account 7 din ke andar delete ho jayega",
    body: (n) =>
      `Namaste ${n}, aapki account delete karne ki request hum tak pahunch gayi hai. 7 din ke andar aapka account aur uska saara data — documents, reminders, profile — hamesha ke liye hata diya jayega.`,
    changedMind:
      "Agar ye request aapne nahi bheji, ya aap iraada badal chuke ho, to is email ka jawab de do — hum delete rok denge.",
    team: "— Team Apka Saathi",
  },
  hi: {
    title: "डिलीट रिक्वेस्ट मिल गई 🗑️",
    subject: "आपकी डिलीट रिक्वेस्ट मिल गई — Apka Saathi",
    preheader: "आपका अकाउंट 7 दिन के अंदर डिलीट हो जाएगा",
    body: (n) =>
      `नमस्ते ${n}, आपकी अकाउंट डिलीट करने की रिक्वेस्ट हम तक पहुँच गई है। 7 दिन के अंदर आपका अकाउंट और उसका सारा डेटा — डॉक्युमेंट्स, रिमाइंडर, प्रोफ़ाइल — हमेशा के लिए हटा दिया जाएगा।`,
    changedMind:
      "अगर यह रिक्वेस्ट आपने नहीं भेजी, या आपका इरादा बदल गया है, तो इस ईमेल का जवाब दे दीजिए — हम डिलीट रोक देंगे।",
    team: "— टीम Apka Saathi",
  },
  en: {
    title: "Delete request received 🗑️",
    subject: "We received your delete request — Apka Saathi",
    preheader: "Your account will be deleted within 7 days",
    body: (n) =>
      `Hi ${n}, we've received your request to delete your account. Within 7 days your account and all its data — documents, reminders, profile — will be permanently removed.`,
    changedMind:
      "If you didn't send this request, or you've changed your mind, just reply to this email — we'll stop the deletion.",
    team: "— Team Apka Saathi",
  },
};

export async function sendAccountDeletionEmails(
  name: string,
  email: string,
  reason: string,
  locale: EmailLocale = "hinglish",
) {
  const d = DELETE_REQ[locale] ?? DELETE_REQ.hinglish;
  const adminHtml = renderEmail(
    "Account delete karne ki request 🗑️",
    `<table style="width:100%;font-size:15px;color:${INK};border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:${SOFT};width:80px;">Naam</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(name)}</td></tr>
        <tr><td style="padding:6px 0;color:${SOFT};">Email</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(email)}</td></tr>
      </table>
      ${
        reason
          ? `<div style="margin-top:16px;padding:16px;background:${CREAM};border-radius:14px;font-size:15px;line-height:1.6;color:${INK};white-space:pre-wrap;word-break:break-word;">${escapeHtml(reason)}</div>`
          : ""
      }
      ${emailParagraph("⏳ Ise 7 din ke andar poora karna hai — account, documents, reminders sab hatane hain.")}`,
    `${name} — account delete request`,
  );

  const userHtml = renderEmail(
    d.title,
    `${emailParagraph(d.body(escapeHtml(name)))}
     ${emailParagraph(d.changedMind)}
     <p style="margin:0;font-size:15px;line-height:1.6;color:${SOFT};">${escapeHtml(d.team)}</p>`,
    d.preheader,
    locale,
  );

  return Promise.all([
    sendMail({
      to: CONTACT_TO ?? email,
      replyTo: email,
      fromName: "Apka Saathi Delete Request",
      subject: `🗑️ Account delete request — ${name} <${email}>`,
      html: adminHtml,
    }),
    sendMail({
      to: email,
      subject: d.subject,
      html: userHtml,
      fromName: "Apka Saathi",
    }),
  ]);
}

/* --------------------------- support tickets --------------------------- */

/** Ticket ka number — email me sabse upar, bade akshar me. */
function ticketBadge(no: string): string {
  return (
    `<div style="display:inline-block;margin-bottom:14px;padding:7px 14px;border-radius:999px;` +
    `background:${CREAM};border:1px solid #E5DBC9;font-size:13px;font-weight:700;` +
    `letter-spacing:0.5px;color:${BRAND_DARK};font-family:monospace;">${escapeHtml(no)}</div>`
  );
}

/** Quote block — jo likha gaya wo jaisa ka taisa. */
function quote(text: string): string {
  return (
    `<div style="margin-top:14px;padding:16px;background:${CREAM};border-radius:14px;` +
    `font-size:15px;line-height:1.6;color:${INK};white-space:pre-wrap;word-break:break-word;">` +
    `${escapeHtml(text)}</div>`
  );
}

/**
 * Naya ticket — admin ko khabar, user ko rasid.
 *
 * User wale mail me ticket number sabse upar hai. Wahi ek cheez hai jo wo baad
 * me phone par ya kisi aur mail me bata sakta hai; uske bina "maine kal ek
 * message bheja tha" se aage baat hi nahi badhti.
 */
/**
 * Support wali teeno email (rasid, jawab) — user ki apni bhasha me.
 *
 * ⚠️ Ye sab pehle sirf Hinglish me jaati thi. Support wahi jagah hai jahan user
 * pehle se pareshaan hota hai — wahan uski chuni hui bhasha chhod dena sabse
 * bura waqt hai chhodne ka. Admin wali copy jaan-boojh ke Hinglish hi rehti
 * hai: wo humare liye hai, user ke liye nahi.
 */
const TICKET: Record<EmailLocale, {
  createdTitle: string;
  /** {no} */
  createdSubject: (no: string) => string;
  /** {no} */
  createdPreheader: (no: string) => string;
  /** {who} */
  createdBody: (who: string) => string;
  createdOutro: string;
  answerTitle: string;
  /** {no} */
  answerSubject: (no: string) => string;
  /** {no} */
  answerPreheader: (no: string) => string;
  /** {name} — naam khaali bhi ho sakta hai */
  answerIntro: (name: string) => string;
  answerOutro: string;
}> = {
  hinglish: {
    createdTitle: "Aapka ticket ban gaya 🎫",
    createdSubject: (no) => `Ticket ${no} — aapka sawaal mil gaya`,
    createdPreheader: (no) => `${no} — hum jaldi jawab denge`,
    createdBody: (who) =>
      `Namaste ${who}, aapka sawaal hum tak pahunch gaya hai. Isse yaad rakhne ke liye upar wala number hai — baat karte waqt yahi bata dijiyega.`,
    createdOutro:
      "Jawab aate hi aapko email milega, aur app ke Support me bhi wahi baatcheet khul jaayegi.",
    answerTitle: "Aapke ticket ka jawab 💬",
    answerSubject: (no) => `Ticket ${no} — jawab aa gaya`,
    answerPreheader: (no) => `${no} — jawab aa gaya`,
    answerIntro: (n) => (n ? `Namaste ${n}, aapke sawaal ka jawab:` : "Aapke sawaal ka jawab:"),
    answerOutro:
      "Aur kuch poochhna ho to app ke Support me isi baatcheet me likh dijiye — number wahi rahega.",
  },
  hi: {
    createdTitle: "आपका टिकट बन गया 🎫",
    createdSubject: (no) => `टिकट ${no} — आपका सवाल मिल गया`,
    createdPreheader: (no) => `${no} — हम जल्दी जवाब देंगे`,
    createdBody: (who) =>
      `नमस्ते ${who}, आपका सवाल हम तक पहुँच गया है। इसे याद रखने के लिए ऊपर वाला नंबर है — बात करते वक़्त यही बता दीजिएगा।`,
    createdOutro:
      "जवाब आते ही आपको ईमेल मिलेगा, और ऐप के Support में भी वही बातचीत खुल जाएगी।",
    answerTitle: "आपके टिकट का जवाब 💬",
    answerSubject: (no) => `टिकट ${no} — जवाब आ गया`,
    answerPreheader: (no) => `${no} — जवाब आ गया`,
    answerIntro: (n) => (n ? `नमस्ते ${n}, आपके सवाल का जवाब:` : "आपके सवाल का जवाब:"),
    answerOutro:
      "और कुछ पूछना हो तो ऐप के Support में इसी बातचीत में लिख दीजिए — नंबर वही रहेगा।",
  },
  en: {
    createdTitle: "Your ticket is open 🎫",
    createdSubject: (no) => `Ticket ${no} — we got your question`,
    createdPreheader: (no) => `${no} — we'll reply soon`,
    createdBody: (who) =>
      `Hi ${who}, your question has reached us. The number above is how we'll track it — please quote it whenever you write to us.`,
    createdOutro:
      "You'll get an email as soon as we reply, and the same conversation will be waiting in the app under Support.",
    answerTitle: "A reply to your ticket 💬",
    answerSubject: (no) => `Ticket ${no} — we've replied`,
    answerPreheader: (no) => `${no} — we've replied`,
    answerIntro: (n) => (n ? `Hi ${n}, here's our reply:` : "Here's our reply:"),
    answerOutro:
      "Anything else? Just write in the same conversation under Support in the app — the number stays the same.",
  },
};

export async function sendNewTicketEmails(t: {
  ticketNo: string;
  subject: string;
  message: string;
  name: string | null;
  email: string | null;
  locale?: EmailLocale;
}) {
  const who = t.name || t.email || "User";
  const c = TICKET[t.locale ?? "hinglish"] ?? TICKET.hinglish;

  const adminHtml = renderEmail(
    "Naya support ticket 🎫",
    ticketBadge(t.ticketNo) +
      `<table style="width:100%;font-size:15px;color:${INK};border-collapse:collapse;">
        <tr><td style="padding:6px 0;color:${SOFT};width:80px;">Naam</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(who)}</td></tr>
        <tr><td style="padding:6px 0;color:${SOFT};">Email</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(t.email ?? "—")}</td></tr>
        <tr><td style="padding:6px 0;color:${SOFT};">Vishay</td><td style="padding:6px 0;font-weight:600;">${escapeHtml(t.subject)}</td></tr>
      </table>` +
      quote(t.message),
    `${t.ticketNo} — ${t.subject.slice(0, 80)}`,
  );

  const userHtml = renderEmail(
    c.createdTitle,
    ticketBadge(t.ticketNo) +
      emailParagraph(c.createdBody(escapeHtml(who))) +
      quote(t.message) +
      emailParagraph(c.createdOutro),
    c.createdPreheader(t.ticketNo),
    t.locale ?? "hinglish",
  );

  const jobs = [
    sendMail({
      to: CONTACT_TO,
      replyTo: t.email ?? undefined,
      fromName: "Apka Saathi Support",
      subject: `🎫 ${t.ticketNo} — ${t.subject}`,
      html: adminHtml,
    }),
  ];
  // Email na ho (virle, par possible) to user wala mail chhod dete hain — admin
  // ko khabar phir bhi jaani chahiye.
  if (t.email) {
    jobs.push(
      sendMail({
        to: t.email,
        fromName: "Apka Saathi",
        subject: c.createdSubject(t.ticketNo),
        html: userHtml,
      }),
    );
  }
  return Promise.all(jobs);
}

/** User ne usi ticket par kuch aur likha — sirf admin ko. */
export async function sendTicketReplyToAdmin(t: {
  ticketNo: string;
  subject: string;
  message: string;
  name: string | null;
  email: string | null;
}) {
  const html = renderEmail(
    "Ticket par naya message 💬",
    ticketBadge(t.ticketNo) +
      emailParagraph(`${escapeHtml(t.name || t.email || "User")} ne likha:`) +
      quote(t.message),
    `${t.ticketNo} — naya message`,
  );
  return sendMail({
    to: CONTACT_TO,
    replyTo: t.email ?? undefined,
    fromName: "Apka Saathi Support",
    subject: `💬 ${t.ticketNo} — ${t.subject}`,
    html,
  });
}

/** Admin ne jawab diya — user ko email. */
export async function sendTicketAnswerEmail(t: {
  ticketNo: string;
  subject: string;
  answer: string;
  name: string | null;
  email: string;
  locale?: EmailLocale;
}) {
  const locale = t.locale ?? "hinglish";
  const c = TICKET[locale] ?? TICKET.hinglish;
  const html = renderEmail(
    c.answerTitle,
    ticketBadge(t.ticketNo) +
      emailParagraph(c.answerIntro(escapeHtml(t.name || ""))) +
      quote(t.answer) +
      emailParagraph(c.answerOutro),
    c.answerPreheader(t.ticketNo),
    locale,
  );
  return sendMail({
    to: t.email,
    fromName: "Apka Saathi Support",
    subject: c.answerSubject(t.ticketNo),
    html,
  });
}

/** Contact form ki rasid — website par chuni gayi bhasha me. */
const CONTACT: Record<EmailLocale, {
  title: string;
  subject: string;
  preheader: string;
  /** {name} */
  body: (name: string) => string;
  team: string;
}> = {
  hinglish: {
    title: "Message mil gaya! 🙏",
    subject: "Aapka message mil gaya — Apka Saathi",
    preheader: "Hum jaldi hi jawab denge 🙏",
    body: (n) => `Namaste ${n}, aapka message hum tak pahunch gaya hai. Hum jaldi hi jawab denge.`,
    team: "— Team Apka Saathi",
  },
  hi: {
    title: "मैसेज मिल गया! 🙏",
    subject: "आपका मैसेज मिल गया — Apka Saathi",
    preheader: "हम जल्दी ही जवाब देंगे 🙏",
    body: (n) => `नमस्ते ${n}, आपका मैसेज हम तक पहुँच गया है। हम जल्दी ही जवाब देंगे।`,
    team: "— टीम Apka Saathi",
  },
  en: {
    title: "Message received! 🙏",
    subject: "We got your message — Apka Saathi",
    preheader: "We'll reply soon 🙏",
    body: (n) => `Hi ${n}, your message has reached us. We'll get back to you shortly.`,
    team: "— Team Apka Saathi",
  },
};

export async function sendContactEmails(
  name: string,
  email: string,
  message: string,
  locale: EmailLocale = "hinglish",
) {
  const c = CONTACT[locale] ?? CONTACT.hinglish;
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
    c.title,
    `${emailParagraph(c.body(escapeHtml(name)))}
     <p style="margin:0;font-size:15px;line-height:1.6;color:${SOFT};">${escapeHtml(c.team)}</p>`,
    c.preheader,
    locale,
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
      subject: c.subject,
      html: userHtml,
      fromName: "Apka Saathi",
    }),
  ]);
}

/* -------------------- Contact ka jawab (admin > Contacts) ------------------- */

const CONTACT_REPLY: Record<EmailLocale, {
  title: string;
  subject: string;
  preheader: string;
  /** {name} */
  intro: (name: string) => string;
  yourMessage: string;
  outro: string;
}> = {
  hinglish: {
    title: "Aapke message ka jawab 💬",
    subject: "Aapke message ka jawab — Apka Saathi",
    preheader: "Team Apka Saathi ne jawab diya hai",
    intro: (n) => `Namaste ${n}, aapne jo poochha tha uska jawab ye raha:`,
    yourMessage: "Aapne likha tha",
    outro: "Aur kuch poochhna ho to isi email ka reply kar dijiye — seedha hum tak aa jayega.",
  },
  hi: {
    title: "आपके मैसेज का जवाब 💬",
    subject: "आपके मैसेज का जवाब — Apka Saathi",
    preheader: "टीम Apka Saathi ने जवाब दिया है",
    intro: (n) => `नमस्ते ${n}, आपने जो पूछा था उसका जवाब ये रहा:`,
    yourMessage: "आपने लिखा था",
    outro: "और कुछ पूछना हो तो इसी ईमेल का reply कर दीजिए — सीधा हम तक आ जाएगा।",
  },
  en: {
    title: "Reply to your message 💬",
    subject: "Reply to your message — Apka Saathi",
    preheader: "Team Apka Saathi has replied",
    intro: (n) => `Hi ${n}, here's the answer to what you asked:`,
    yourMessage: "You wrote",
    outro: "If you have more questions, just reply to this email — it comes straight to us.",
  },
};

/**
 * Admin ne Contacts se jawab diya — user ko email.
 *
 * `replyTo` support inbox par hai, `from` par nahi: user "Reply" dabaye to uska
 * jawab wapas hum tak aaye, kisi admin ke niji pate par nahi.
 *
 * Purana message bhi saath jaata hai. Message aur jawab ke beech kai din nikal
 * jaate hain — bina us hisse ke user ko yaad hi nahi aata ki baat kis baare me
 * thi, aur wo dobara wahi sawaal likh deta hai.
 */
export async function sendContactReplyEmail(t: {
  name: string;
  email: string;
  original: string;
  reply: string;
  locale?: EmailLocale;
}) {
  const locale = t.locale ?? "hinglish";
  const c = CONTACT_REPLY[locale] ?? CONTACT_REPLY.hinglish;

  const html = renderEmail(
    c.title,
    emailParagraph(c.intro(escapeHtml(t.name || ""))) +
      quote(t.reply) +
      `<p style="margin:22px 0 0;font-size:13px;font-weight:600;color:${SOFT};">${escapeHtml(c.yourMessage)}</p>` +
      quote(t.original) +
      emailParagraph(c.outro),
    c.preheader,
    locale,
  );

  return sendMail({
    to: t.email,
    replyTo: CONTACT_TO,
    fromName: "Apka Saathi",
    subject: c.subject,
    html,
    kind: "contact_reply",
  });
}

/* ------------------------- Admin team ka invite mail ------------------------ */

/**
 * Naye admin ko uska login bheja jaata hai.
 *
 * Ye mail hamesha English/Hinglish me hi hai — ye team ke andar ki baat hai,
 * user-facing nahi, isliye is par bhasha ka chunaav nahi lagta.
 *
 * ⚠️ Password sirf YAHIN, ek baar dikhta hai. DB me uska scrypt hash hi jaata
 * hai — na hum use dobara padh sakte hain, na koi aur. Kho jaye to naya banana
 * padta hai (admin > Team > "Naya password").
 */
export async function sendAdminInviteEmail(t: {
  name: string;
  email: string;
  password: string;
  adminUrl: string;
  roleName: string | null;
  pending: boolean;
}) {
  const rows = `<table style="width:100%;font-size:15px;color:${INK};border-collapse:collapse;">
      <tr><td style="padding:7px 0;color:${SOFT};width:96px;">Panel</td><td style="padding:7px 0;"><a href="${escapeHtml(t.adminUrl)}" style="color:${BRAND_DARK};font-weight:600;">${escapeHtml(t.adminUrl)}</a></td></tr>
      <tr><td style="padding:7px 0;color:${SOFT};">Email</td><td style="padding:7px 0;font-weight:600;">${escapeHtml(t.email)}</td></tr>
      <tr><td style="padding:7px 0;color:${SOFT};">Password</td><td style="padding:7px 0;font-weight:700;font-family:monospace;font-size:16px;letter-spacing:0.5px;">${escapeHtml(t.password)}</td></tr>
      ${t.roleName ? `<tr><td style="padding:7px 0;color:${SOFT};">Role</td><td style="padding:7px 0;font-weight:600;">${escapeHtml(t.roleName)}</td></tr>` : ""}
    </table>`;

  const note = t.pending
    ? emailParagraph(
        "Abhi aapka account approve hona baaki hai — tab tak login nahi chalega. " +
          "Master admin ke approve karte hi ye password kaam karne lagega.",
      )
    : emailParagraph("Aap abhi login kar sakte hain.");

  const html = renderEmail(
    "Apka Saathi admin — aapka login 🔑",
    emailParagraph(`Namaste ${escapeHtml(t.name || "")}, aapko Apka Saathi ke admin panel me joda gaya hai.`) +
      `<div style="margin-top:14px;padding:18px;background:${CREAM};border-radius:14px;">${rows}</div>` +
      note +
      emailButton(t.adminUrl, "Admin panel kholo") +
      `<p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:${SOFT};">
         Ye password sirf is email me hai — ise kisi ke saath share mat kijiye.
         Aapko sidebar me sirf wahi menu dikhenge jo aapke role me diye gaye hain.
       </p>`,
    "Aapka admin login andar hai 🔑",
  );

  return sendMail({
    to: t.email,
    fromName: "Apka Saathi Admin",
    subject: "Apka Saathi admin — aapka login",
    html,
    kind: "admin_invite",
  });
}

/** Password reset kiya gaya — naya password bhejo. */
export async function sendAdminPasswordEmail(t: {
  name: string;
  email: string;
  password: string;
  adminUrl: string;
}) {
  const html = renderEmail(
    "Naya admin password 🔑",
    emailParagraph(`Namaste ${escapeHtml(t.name || "")}, aapka admin password badal diya gaya hai.`) +
      `<div style="margin-top:14px;padding:18px;background:${CREAM};border-radius:14px;">
         <table style="width:100%;font-size:15px;color:${INK};border-collapse:collapse;">
           <tr><td style="padding:7px 0;color:${SOFT};width:96px;">Email</td><td style="padding:7px 0;font-weight:600;">${escapeHtml(t.email)}</td></tr>
           <tr><td style="padding:7px 0;color:${SOFT};">Password</td><td style="padding:7px 0;font-weight:700;font-family:monospace;font-size:16px;letter-spacing:0.5px;">${escapeHtml(t.password)}</td></tr>
         </table>
       </div>` +
      emailButton(t.adminUrl, "Admin panel kholo"),
    "Aapka naya admin password",
  );

  return sendMail({
    to: t.email,
    fromName: "Apka Saathi Admin",
    subject: "Apka Saathi admin — naya password",
    html,
    kind: "admin_password",
  });
}

/* ─────────────────────── App lock: PIN bhool gaye ─────────────────────── */

/**
 * App lock ka PIN reset karne ka code.
 *
 * ⚠️ Ye email us user ko jaati hai jo IS WAQT apne hi app se bahar khada hai —
 * wo lock screen par hai aur PIN yaad nahi aa raha. Isliye yahan har extra
 * shabd nuksaan karta hai: use sirf code chahiye, aur wo pehli nazar me dikhna
 * chahiye. Koi button nahi (kahin jaana hi nahi hai), koi lambi bhoomika nahi.
 *
 * ⚠️ "Kisi ko mat batao" wali line har OTP me honi chahiye. PIN reset me wo aur
 * bhi zaroori hai: yahi ek code kisi ke bhi haath me poore app ki chaabi hai.
 */
const LOCK_RESET: Record<
  EmailLocale,
  { title: string; hello: string; intro: string; expires: string; warn: string; ignore: string; subject: string }
> = {
  hinglish: {
    title: "App lock ka code 🔐",
    hello: "Namaste",
    intro: "Naya PIN banane ke liye ye code Saathi me daalo:",
    expires: "Ye code {m} minute me expire ho jayega.",
    warn: "Ye code kisi ko mat batao — isse aapka App lock khul jaata hai.",
    ignore: "Aapne ye nahi manga tha? Tab kuch mat kariye — aapka PIN waisa hi rahega.",
    subject: "Apka Saathi — App lock ka code",
  },
  hi: {
    title: "ऐप लॉक का कोड 🔐",
    hello: "नमस्ते",
    intro: "नया PIN बनाने के लिए यह कोड साथी में डालिए:",
    expires: "यह कोड {m} मिनट में एक्सपायर हो जाएगा।",
    warn: "यह कोड किसी को न बताएँ — इससे आपका ऐप लॉक खुल जाता है।",
    ignore: "आपने यह नहीं माँगा था? तब कुछ मत कीजिए — आपका PIN वैसा ही रहेगा।",
    subject: "आपका साथी — ऐप लॉक का कोड",
  },
  en: {
    title: "Your app lock code 🔐",
    hello: "Hi",
    intro: "Enter this code in Saathi to set a new PIN:",
    expires: "This code expires in {m} minutes.",
    warn: "Don't share this code with anyone — it unlocks your app.",
    ignore: "Didn't ask for this? Then do nothing — your PIN stays as it is.",
    subject: "Apka Saathi — your app lock code",
  },
};

export async function sendAppLockResetEmail(t: {
  to: string;
  name?: string | null;
  code: string;
  minutes: number;
  locale?: EmailLocale;
  userId?: string | null;
}) {
  const l = LOCK_RESET[t.locale ?? "hinglish"] ?? LOCK_RESET.hinglish;
  const greet = t.name ? `${l.hello} ${escapeHtml(t.name)},` : `${l.hello},`;

  const html = renderEmail(
    l.title,
    emailParagraph(greet) +
      emailParagraph(l.intro) +
      // Code sabse bada aur sabse saaf — monospace + letter-spacing se 6 ank
      // ek-ek karke padhe jaate hain (0/O aur 1/l ka bhram bhi kam hota hai).
      `<div style="margin:6px 0 18px;padding:20px;background:${CREAM};border:1px solid ${LINE};border-radius:16px;text-align:center;">
         <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:9px;color:${INK};">${escapeHtml(t.code)}</div>
         <div style="margin-top:10px;font-size:13px;color:${SOFT};">${escapeHtml(l.expires.replace("{m}", String(t.minutes)))}</div>
       </div>` +
      `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${INK};font-weight:600;">${escapeHtml(l.warn)}</p>` +
      `<p style="margin:0;font-size:13.5px;line-height:1.6;color:${SOFT};">${escapeHtml(l.ignore)}</p>`,
    `${t.code} — ${l.title}`,
    t.locale ?? "hinglish",
  );

  return sendMail({
    to: t.to,
    subject: l.subject,
    html,
    kind: "app_lock_reset",
    userId: t.userId,
  });
}

/* ---------------------- naya phone chaalu karne ka code ---------------------- */

/**
 * "Naya phone" ka code.
 *
 * ⚠️ Is email ka sabse zaroori hissa `warn` wali line hai, aur wo PIN reset wali
 * se ALAG honi chahiye. Yahan khatra alag hai: is code se koi doosra phone
 * "aapka" ban jaata hai — yaani aapke reminder aur alert USKE phone par jaane
 * lagte hain aur aapke phone par aana BAND ho jaate hain. Aam OTP wali "kisi ko
 * mat batao" line ye baat nahi kehti.
 *
 * ⚠️ `ignore` wali line bhi jaan-boojh ke saaf hai. Jisne ye code manga hi nahi,
 * uske liye ye email ek chetavni hai — kisi ne uske account me login kiya hai.
 * Us soorat me "kuch mat kariye" kaafi nahi, isliye password badalne ko bhi kaha
 * jaata hai.
 */
const DEVICE_APPROVAL: Record<
  EmailLocale,
  { title: string; hello: string; intro: string; expires: string; warn: string; ignore: string; subject: string }
> = {
  hinglish: {
    title: "Naye phone ka code 📱",
    hello: "Namaste",
    intro: "Is naye phone par apne reminder aur alert chaalu karne ke liye ye code Saathi me daalo:",
    expires: "Ye code {m} minute me expire ho jayega.",
    warn: "Ye code kisi ko mat batao — isse aapke saare reminder us phone par chale jaate hain, aur purane phone par aana band ho jaate hain.",
    ignore: "Aapne ye nahi manga tha? Tab kisi ne aapke account me login kiya hai — apna password turant badal lijiye.",
    subject: "Apka Saathi — naye phone ka code",
  },
  hi: {
    title: "नए फ़ोन का कोड 📱",
    hello: "नमस्ते",
    intro: "इस नए फ़ोन पर अपने रिमाइंडर और अलर्ट चालू करने के लिए यह कोड साथी में डालिए:",
    expires: "यह कोड {m} मिनट में एक्सपायर हो जाएगा।",
    warn: "यह कोड किसी को न बताएँ — इससे आपके सारे रिमाइंडर उस फ़ोन पर चले जाते हैं, और पुराने फ़ोन पर आना बंद हो जाते हैं।",
    ignore: "आपने यह नहीं माँगा था? तब किसी ने आपके अकाउंट में लॉगिन किया है — अपना पासवर्ड तुरंत बदल लीजिए।",
    subject: "आपका साथी — नए फ़ोन का कोड",
  },
  en: {
    title: "Code for your new phone 📱",
    hello: "Hi",
    intro: "Enter this code in Saathi to turn on your reminders and alerts on this new phone:",
    expires: "This code expires in {m} minutes.",
    warn: "Don't share this code with anyone — it moves all your reminders to that phone, and stops them on your old one.",
    ignore: "Didn't ask for this? Then someone has signed in to your account — change your password right away.",
    subject: "Apka Saathi — code for your new phone",
  },
};

export async function sendDeviceApprovalEmail(t: {
  to: string;
  name?: string | null;
  code: string;
  minutes: number;
  locale?: EmailLocale;
  userId?: string | null;
}) {
  const l = DEVICE_APPROVAL[t.locale ?? "hinglish"] ?? DEVICE_APPROVAL.hinglish;
  const greet = t.name ? `${l.hello} ${escapeHtml(t.name)},` : `${l.hello},`;

  const html = renderEmail(
    l.title,
    emailParagraph(greet) +
      emailParagraph(l.intro) +
      // Code sabse bada aur sabse saaf — monospace + letter-spacing se 6 ank
      // ek-ek karke padhe jaate hain (0/O aur 1/l ka bhram bhi kam hota hai).
      `<div style="margin:6px 0 18px;padding:20px;background:${CREAM};border:1px solid ${LINE};border-radius:16px;text-align:center;">
         <div style="font-family:'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:34px;font-weight:700;letter-spacing:9px;color:${INK};">${escapeHtml(t.code)}</div>
         <div style="margin-top:10px;font-size:13px;color:${SOFT};">${escapeHtml(l.expires.replace("{m}", String(t.minutes)))}</div>
       </div>` +
      `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:${INK};font-weight:600;">${escapeHtml(l.warn)}</p>` +
      `<p style="margin:0;font-size:13.5px;line-height:1.6;color:${SOFT};">${escapeHtml(l.ignore)}</p>`,
    `${t.code} — ${l.title}`,
    t.locale ?? "hinglish",
  );

  return sendMail({
    to: t.to,
    subject: l.subject,
    html,
    kind: "device_approval",
    userId: t.userId,
  });
}
