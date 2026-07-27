"use client";

import { useLanguage } from "@/lib/i18n/LanguageProvider";
import type { Locale } from "@/lib/i18n/dictionaries";

/**
 * Admin panel i18n — public site dictionary se alag (admin ke apne strings bahut
 * hain). Same locale (useLanguage) par chalta hai — language switcher se turant
 * badalta hai.
 *
 * Use: `const t = useAdminT();  t.nav.users`
 */

export type AdminDict = {
  common: {
    admin: string;
    dashboard: string;
    refresh: string;
    logout: string;
    menu: string;
    close: string;
    loading: string;
    save: string;
    saving: string;
    cancel: string;
    delete: string;
    search: string;
    export: string;
    none: string;
    yes: string;
    no: string;
  };
  time: { now: string; m: string; h: string; d: string };
  login: {
    title: string;
    sub: string;
    placeholder: string;
    button: string;
    wrong: string;
    error: string;
  };
  nav: {
    users: string;
    message: string;
    usage: string;
    documents: string;
    reviews: string;
    logs: string;
    contacts: string;
    pricing: string;
    rewards: string;
  };
  headings: Record<
    "rewards" | "pricing" | "users" | "usage" | "documents" | "reviews" | "logs" | "contacts" | "message",
    { title: string; sub: string }
  >;
  broadcast: {
    whoTitle: string;
    inactive: string;
    all: string;
    inactiveHint: string;
    allHint: string;
    subject: string;
    subjectPh: string;
    message: string;
    messagePh: string;
    note: string;
    send: string;
    sending: string;
    doneN: string; // {sent} {skipped} {total}
    noMatch: string;
    errGeneric: string;
    network: string;
  };
  contacts: {
    countMsg: string; // {n}
    empty: string;
    searchPh: string;
    reply: string;
  };
};

const en: AdminDict = {
  common: {
    admin: "Admin",
    dashboard: "Admin dashboard",
    refresh: "Refresh",
    logout: "Logout",
    menu: "Menu",
    close: "Close",
    loading: "Loading…",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    delete: "Delete",
    search: "Search",
    export: "Export",
    none: "None",
    yes: "Yes",
    no: "No",
  },
  time: { now: "just now", m: "m ago", h: "h ago", d: "d ago" },
  login: {
    title: "Admin dashboard",
    sub: "Enter the password to view the dashboard.",
    placeholder: "Admin password",
    button: "Login",
    wrong: "Wrong password 🙈",
    error: "Something went wrong.",
  },
  nav: {
    users: "Users",
    message: "Message",
    usage: "Usage",
    documents: "Documents",
    reviews: "Reviews",
    logs: "Logs",
    contacts: "Contacts",
    pricing: "Pricing",
    rewards: "Rewards",
  },
  headings: {
    rewards: { title: "Rewards & Referrals", sub: "Change offer and referral numbers here — they go live instantly." },
    pricing: { title: "Country pricing", sub: "Base × multiplier × conversion rate. Users see their country's price + currency by IP." },
    users: { title: "Users", sub: "Who's on which plan, when they joined, and how active they are." },
    usage: { title: "Usage", sub: "Who uses how much — documents, reminders, chats. And who not at all." },
    documents: { title: "Documents", sub: "Who uploaded which document and when — with the path. Click View to see." },
    reviews: { title: "Reviews & Ratings", sub: "Reviews from the app — rating, text, and permission to show on the website." },
    logs: { title: "Logs & Issues", sub: "What broke in app/web — full stack + context. New errors also go to email." },
    contacts: { title: "Contact messages", sub: "" },
    message: { title: "Message users", sub: "Email registered users — everyone or just inactive ones (who never used the app)." },
  },
  broadcast: {
    whoTitle: "Who to send to?",
    inactive: "Inactive users",
    all: "All users",
    inactiveHint: "Those who registered but never created a reminder/document.",
    allHint: "All registered users who have an email.",
    subject: "Subject",
    subjectPh: "e.g. Apka Saathi is thinking of you 🙂",
    message: "Message",
    messagePh: "Hello!\n\nCome back to Apka Saathi — your documents and reminders are waiting for you.",
    note: "Sent inside the branded email template (logo + footer). A blank line starts a new paragraph.",
    send: "Send email",
    sending: "Sending…",
    doneN: "Done! {sent} emails sent{skipped} (target: {total}).",
    noMatch: " No matching users found.",
    errGeneric: "Something went wrong while sending.",
    network: "Network error — try again.",
  },
  contacts: {
    countMsg: "{n} messages",
    empty: "No messages yet.",
    searchPh: "Search messages…",
    reply: "Reply",
  },
};

const hi: AdminDict = {
  common: {
    admin: "एडमिन",
    dashboard: "एडमिन डैशबोर्ड",
    refresh: "रिफ्रेश",
    logout: "लॉगआउट",
    menu: "मेन्यू",
    close: "बंद करें",
    loading: "लोड हो रहा है…",
    save: "सेव",
    saving: "सेव हो रहा है…",
    cancel: "रद्द करें",
    delete: "डिलीट",
    search: "खोजें",
    export: "एक्सपोर्ट",
    none: "कोई नहीं",
    yes: "हाँ",
    no: "नहीं",
  },
  time: { now: "अभी", m: "मि पहले", h: "घं पहले", d: "दिन पहले" },
  login: {
    title: "एडमिन डैशबोर्ड",
    sub: "डैशबोर्ड देखने के लिए पासवर्ड डालें।",
    placeholder: "एडमिन पासवर्ड",
    button: "लॉगिन",
    wrong: "गलत पासवर्ड 🙈",
    error: "कुछ गड़बड़ हो गई।",
  },
  nav: {
    users: "यूज़र्स",
    message: "मैसेज",
    usage: "उपयोग",
    documents: "डॉक्युमेंट्स",
    reviews: "रिव्यूज़",
    logs: "लॉग्स",
    contacts: "कॉन्टैक्ट",
    pricing: "प्राइसिंग",
    rewards: "रिवॉर्ड्स",
  },
  headings: {
    rewards: { title: "रिवॉर्ड्स और रेफरल", sub: "ऑफर और रेफरल के नंबर यहीं से बदलें — तुरंत लाइव हो जाते हैं।" },
    pricing: { title: "देश अनुसार प्राइसिंग", sub: "Base × multiplier × conversion rate. IP से यूज़र को उसके देश का प्राइस + करेंसी दिखता है।" },
    users: { title: "यूज़र्स", sub: "कौन किस प्लान पर है, कब जुड़ा, और कितना एक्टिव है।" },
    usage: { title: "उपयोग", sub: "कौन कितना उपयोग करता है — डॉक्युमेंट्स, रिमाइंडर, चैट। और कौन बिलकुल नहीं।" },
    documents: { title: "डॉक्युमेंट्स", sub: "किसने कौन सा डॉक्युमेंट, कब अपलोड किया — path के साथ। View पर क्लिक करके देखें।" },
    reviews: { title: "रिव्यूज़ और रेटिंग", sub: "ऐप में आए रिव्यूज़ — रेटिंग, टेक्स्ट, और वेबसाइट पर दिखाने की अनुमति।" },
    logs: { title: "लॉग्स और इशू", sub: "ऐप/वेब में क्या टूटा — पूरा stack + context. नए errors ईमेल पर भी जाते हैं।" },
    contacts: { title: "कॉन्टैक्ट मैसेज", sub: "" },
    message: { title: "यूज़र्स को मैसेज", sub: "रजिस्टर्ड यूज़र्स को ईमेल भेजें — सभी को या सिर्फ़ inactive (जिन्होंने कभी उपयोग नहीं किया)।" },
  },
  broadcast: {
    whoTitle: "किसे भेजें?",
    inactive: "Inactive यूज़र्स",
    all: "सभी यूज़र्स",
    inactiveHint: "जिन्होंने रजिस्टर तो किया पर कभी रिमाइंडर/डॉक्युमेंट नहीं बनाया।",
    allHint: "सभी रजिस्टर्ड यूज़र्स जिनके पास ईमेल है।",
    subject: "सब्जेक्ट",
    subjectPh: "जैसे: Apka Saathi आपको याद कर रहा है 🙂",
    message: "मैसेज",
    messagePh: "नमस्ते!\n\nApka Saathi में वापस आइए — आपके डॉक्युमेंट्स और रिमाइंडर यहीं इंतज़ार कर रहे हैं।",
    note: "ब्रांडेड ईमेल टेम्पलेट में जाएगा (लोगो + फुटर)। खाली लाइन से नया पैराग्राफ बनता है।",
    send: "ईमेल भेजें",
    sending: "भेज रहा हूँ…",
    doneN: "हो गया! {sent} ईमेल गए{skipped} (target: {total})।",
    noMatch: " कोई मैचिंग यूज़र नहीं मिला।",
    errGeneric: "भेजते समय दिक्कत आई।",
    network: "नेटवर्क एरर — दोबारा ट्राई करें।",
  },
  contacts: {
    countMsg: "{n} मैसेज",
    empty: "अभी कोई मैसेज नहीं।",
    searchPh: "मैसेज खोजें…",
    reply: "जवाब दें",
  },
};

const hinglish: AdminDict = {
  common: {
    admin: "Admin",
    dashboard: "Admin dashboard",
    refresh: "Refresh",
    logout: "Logout",
    menu: "Menu",
    close: "Band karo",
    loading: "Load ho raha hai…",
    save: "Save",
    saving: "Save ho raha hai…",
    cancel: "Cancel",
    delete: "Delete",
    search: "Search",
    export: "Export",
    none: "Koi nahi",
    yes: "Haan",
    no: "Nahi",
  },
  time: { now: "abhi", m: "m pehle", h: "h pehle", d: "d pehle" },
  login: {
    title: "Admin dashboard",
    sub: "Password daalo dashboard dekhne ke liye.",
    placeholder: "Admin password",
    button: "Login",
    wrong: "Galat password 🙈",
    error: "Kuch gadbad ho gayi.",
  },
  nav: {
    users: "Users",
    message: "Message",
    usage: "Usage",
    documents: "Documents",
    reviews: "Reviews",
    logs: "Logs",
    contacts: "Contacts",
    pricing: "Pricing",
    rewards: "Rewards",
  },
  headings: {
    rewards: { title: "Rewards & Referrals", sub: "Offer aur referral ke numbers yahin se badlo — turant live ho jaate hain." },
    pricing: { title: "Country pricing", sub: "Base × multiplier × conversion rate. IP se user ko uske desh ka price + currency dikhta hai." },
    users: { title: "Users", sub: "Kaun kis plan pe hai, kab juda, aur kab tak active hai." },
    usage: { title: "Usage", sub: "Kaun kitna use karta hai — documents, reminders, chats. Aur kaun bilkul nahi." },
    documents: { title: "Documents", sub: "Kisne kaun sa document, kab upload kiya — path ke saath. View pe click karke dekho." },
    reviews: { title: "Reviews & Ratings", sub: "App me aaye reviews — rating, text, aur website pe dikhane ki anumati." },
    logs: { title: "Logs & Issues", sub: "App/web me kya toota — poora stack + context. Naye errors email pe bhi jaate hain." },
    contacts: { title: "Contact messages", sub: "" },
    message: { title: "Message users", sub: "Registered users ko email bhejo — sabhi ko ya sirf inactive (jinhone kabhi use nahi kiya)." },
  },
  broadcast: {
    whoTitle: "Kise bhejein?",
    inactive: "Inactive users",
    all: "Sabhi users",
    inactiveHint: "Jinhone register to kiya par kabhi reminder/document nahi banaya.",
    allHint: "Sabhi registered users jinke paas email hai.",
    subject: "Subject",
    subjectPh: "Jaise: Aapka Saathi aapko yaad kar raha hai 🙂",
    message: "Message",
    messagePh: "Namaste!\n\nApka Saathi me wapas aayiye — aapke documents aur reminders yahin intezaar kar rahe hain.",
    note: "Branded email template me jaayega (logo + footer). Blank line se naya paragraph banta hai.",
    send: "Email bhejo",
    sending: "Bhej raha hoon…",
    doneN: "Ho gaya! {sent} email gaye{skipped} (target: {total}).",
    noMatch: " Koi matching user nahi mila.",
    errGeneric: "Bhejne me dikkat aayi.",
    network: "Network error — dobara try karo.",
  },
  contacts: {
    countMsg: "{n} message",
    empty: "Abhi koi message nahi.",
    searchPh: "Message khojo…",
    reply: "Reply",
  },
};

const ADMIN: Record<Locale, AdminDict> = { hinglish, hi, en };

export function useAdminT(): AdminDict {
  const { locale } = useLanguage();
  return ADMIN[locale] ?? ADMIN.hinglish;
}

/** {key} placeholders bharo. */
export function atpl(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
