/**
 * Apka Saathi — app i18n dictionaries.
 *
 * Default = "hinglish" (jaisa app abhi hai). Baaki: "hi" (Devanagari), "en".
 * Naya string: teeno locales me add karo, key same rakho.
 *
 * Template strings me {name}/{n} jaise placeholders — `tpl()` se bharo.
 */

export const LOCALES = ["hinglish", "hi", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "hinglish";

export const LOCALE_META: Record<Locale, { label: string; native: string; sub: string }> = {
  hinglish: { label: "Hinglish", native: "Hinglish", sub: "Hindi + English mix" },
  hi: { label: "Hindi", native: "हिंदी", sub: "Shudh Hindi" },
  en: { label: "English", native: "English", sub: "English" },
};

export function tpl(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

export type Dict = {
  common: {
    save: string;
    cancel: string;
    delete: string;
    back: string;
    next: string;
    close: string;
    ok: string;
    yes: string;
    no: string;
    loading: string;
    upgrade: string;
    plusBadge: string;
  };
  langSelect: {
    welcome: string;
    tagline: string;
    choose: string;
    continue: string;
    changeLater: string;
  };
  onboarding: {
    title: string;
    sub: string;
    points: string[];
    start: string;
  };
  tabs: { home: string; saathi: string; docs: string; alerts: string; you: string };
  login: {
    welcomeBack: string;
    loginSub: string;
    signupTitle: string;
    signupSub: string;
    name: string;
    namePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    password: string;
    passwordPlaceholder: string;
    referralCode: string;
    referralOptional: string;
    referralPlaceholder: string;
    referralHint: string;
    loginBtn: string;
    signupBtn: string;
    or: string;
    google: string;
    noAccount: string;
    createAccount: string;
    haveAccount: string;
    loginInstead: string;
    /** {d} = referral din */
    referralPlaceholderTpl: string;
  };
  home: {
    /** {name} */
    greeting: string;
    briefLabel: string;
    briefLoading: string;
    /** {name} {n} */
    briefAttention: string;
    /** {name} */
    briefStart: string;
    /** {name} */
    briefAllSet: string;
    quickDoc: string;
    quickChat: string;
    attention: string;
    seeAll: string;
    nothingUrgent: string;
    /** {d} */
    referCard: string;
    referCardSub: string;
  };
  documents: {
    title: string;
    /** {n} */
    savedSub: string;
    filterAll: string;
    filterSoon: string;
    filterExpired: string;
    emptyTitle: string;
    emptyInCategory: string;
    emptyBodyFirst: string;
    emptyBodyFilter: string;
    addBtn: string;
    longPressHint: string;
    lockedSub: string;
    expiryNotSet: string;
    deleted: string;
    deleteConfirmTitle: string;
    /** {name} */
    deleteConfirmBody: string;
  };
  addDocument: {
    title: string;
    photoTitle: string;
    photoSub: string;
    scanning: string;
    doneTitle: string;
    doneSub: string;
    detectedLabel: string;
    editHint: string;
    camera: string;
    gallery: string;
    name: string;
    namePlaceholder: string;
    expiry: string;
    expiryPlaceholder: string;
    save: string;
    added: string;
    addedNoNotif: string;
    limitReached: string;
    nameRequired: string;
    badDate: string;
    saveFailed: string;
  };
  reminders: {
    title: string;
    sub: string;
    emptyTitle: string;
    emptyBody: string;
    today: string;
    upcoming: string;
    longPressHint: string;
    pausedTag: string;
    deleteConfirmTitle: string;
    /** {title} */
    deleteConfirmBody: string;
  };
  addReminder: {
    title: string;
    whatLabel: string;
    whatPlaceholder: string;
    micHint: string;
    understood: string;
    whenLabel: string;
    pickDateTime: string;
    change: string;
    noTimeHint: string;
    save: string;
    askTime: string;
    setOk: string;
    savedNoNotif: string;
    savedNeedPerm: string;
    limitReached: string;
  };
  chat: {
    online: string;
    greeting: string;
    stubReply: string;
    inputPlaceholder: string;
    suggestions: string[];
  };
  upgrade: {
    title: string;
    activeTitle: string;
    activeSub: string;
    monthly: string;
    yearlyTab: string;
    planName: string;
    perMonth: string;
    perYear: string;
    /** {price} */
    payBtn: string;
    payNote: string;
    freeName: string;
    freePrice: string;
    /** {d} */
    referTitle: string;
    /** {d} */
    referSub: string;
    plusFeatures: string[];
    /** {rem} {docs} */
    freeFeatures: string[];
    needDetails: string;
    notAvailable: string;
    purchaseFailed: string;
    activated: string;
  };
  membership: {
    title: string;
    planFree: string;
    planPlus: string;
    /** {n} */
    daysLeft: string;
    lineForever: string;
    /** {date} */
    lineUntil: string;
    /** {date} */
    lineExpired: string;
    lineFree: string;
    plusLo: string;
    journey: string;
    joined: string;
    referredByCode: string;
    referralEarned: string;
    yourReferrals: string;
    invite: string;
    noReferrals: string;
    referNote: string;
    pending: string;
    unlimited: string;
    sourceReferral: string;
    sourcePaid: string;
    sourceAdmin: string;
    sourceReward: string;
  };
  referral: {
    title: string;
    /** {d} */
    heroTitle: string;
    /** {d} */
    heroSub: string;
    lockedTitle: string;
    lockedSub: string;
    condDocument: string;
    condReminder: string;
    condProfile: string;
    goDo: string;
    yourCode: string;
    shareBtn: string;
    statReferrals: string;
    statDays: string;
    /** {d} */
    noLimit: string;
    /** {x} */
    pending: string;
    /** {d} {link} */
    shareMessage: string;
    loadError: string;
  };
  settings: {
    account: string;
    backendOk: string;
    backendMissing: string;
    membership: string;
    myDetails: string;
    completeTitle: string;
    completeSub: string;
    /** {d} */
    referRow: string;
    plusActive: string;
    plusLo: string;
    plusActiveSub: string;
    plusSub: string;
    groupSaathi: string;
    groupPrivacy: string;
    groupMore: string;
    saathiName: string;
    notifications: string;
    language: string;
    privacy: string;
    exportData: string;
    deleteAll: string;
    help: string;
    about: string;
    logout: string;
    version: string;
    langAlertTitle: string;
    langAlertBody: string;
    deleteTitle: string;
    deleteBody: string;
    deleteYes: string;
    deleted: string;
  };
};

/* ============================== HINGLISH ============================== */

const hinglish: Dict = {
  common: {
    save: "Save karo",
    cancel: "Cancel",
    delete: "Delete",
    back: "Wapas",
    next: "Aage",
    close: "Band karo",
    ok: "Theek hai",
    yes: "Haan",
    no: "Nahi",
    loading: "Load ho raha hai…",
    upgrade: "Upgrade",
    plusBadge: "Plus",
  },
  langSelect: {
    welcome: "Welcome to Apka Saathi",
    tagline: "Ek dost jo aapki zaroori cheezein yaad rakhta hai.",
    choose: "Apni bhasha chuno",
    continue: "Aage badho",
    changeLater: "Baad me Settings se badal sakte ho.",
  },
  onboarding: {
    title: "Milo apne Saathi se",
    sub: "Ek dost jo aapki life ka khayal rakhta hai — bina pooche.",
    points: [
      "Documents ki expiry kabhi na bhoole",
      "Har subah ek saaf daily brief",
      "100% private — sab aapke control mein",
    ],
    start: "Chalo shuru karein",
  },
  tabs: { home: "Home", saathi: "Saathi", docs: "Docs", alerts: "Alerts", you: "You" },
  login: {
    welcomeBack: "Wapas aa gaye",
    loginSub: "Login karo aur apni life sambhalo",
    signupTitle: "Milo apne Saathi se",
    signupSub: "Naya account banao — free hai",
    name: "Aapka naam",
    namePlaceholder: "Jaise: Rahul",
    email: "Email",
    emailPlaceholder: "aapka@email.com",
    password: "Password",
    passwordPlaceholder: "Kam se kam 6 characters",
    referralCode: "Referral code",
    referralOptional: "optional",
    referralPlaceholder: "Dost ka code",
    referralHint:
      "Reward tab milega jab aap apna pehla document add karo aur Saathi se ek baar baat karo.",
    loginBtn: "Login karo",
    signupBtn: "Account banao",
    or: "ya",
    google: "Google se continue karo",
    noAccount: "Naya ho?",
    createAccount: "Account banao",
    haveAccount: "Pehle se account hai?",
    loginInstead: "Login karo",
    referralPlaceholderTpl: "Dost ka code — dono ko {d} din ka Plus plan free",
  },
  home: {
    greeting: "Namaste{name}",
    briefLabel: "Aaj ka brief",
    briefLoading: "Dekh raha hoon aapke documents…",
    briefAttention:
      "Dhyan do{name} — {n} document jald expire ho rahe hain. Neeche dekho, main yaad rakh raha hoon.",
    briefStart:
      "Chalo shuru karein{name}! Pehla document add karo, main uski expiry sambhal lunga.",
    briefAllSet:
      "Sab set hai{name}! Koi document jald expire nahi ho raha. Relax karo.",
    quickDoc: "Document add",
    quickChat: "Saathi se baat",
    attention: "Dhyan dena hai",
    seeAll: "Sab dekho",
    nothingUrgent: "Abhi kuch urgent nahi",
    referCard: "Refer & Earn — dono ko {d} din Plus free",
    referCardSub: "Dost ko invite karo, dono ko Saathi Plus plan",
  },
  documents: {
    title: "Documents",
    savedSub: "{n} saved · expiry auto-tracked",
    filterAll: "Sab",
    filterSoon: "Jald expire",
    filterExpired: "Expired",
    emptyTitle: "Abhi koi document nahi",
    emptyInCategory: "Is category mein kuch nahi",
    emptyBodyFirst: "Apna pehla document add karo — Saathi expiry yaad rakhega.",
    emptyBodyFilter: "Filter badal ke dekho, ya naya document add karo.",
    addBtn: "Document add karo",
    longPressHint: "Delete karne ke liye card ko dabaye rakho",
    lockedSub: "Saathi Plus me dekh sakte ho",
    expiryNotSet: "Expiry set nahi",
    deleted: "Document delete ho gaya",
    deleteConfirmTitle: "Delete karein?",
    deleteConfirmBody: "\"{name}\" hata denge?",
  },
  addDocument: {
    title: "Document add karo",
    photoTitle: "Photo daalo",
    photoSub: "Document ki photo daalo — kaunsa hai aur kab expire hai, Saathi khud samajh lega",
    scanning: "Samajh raha hoon…",
    doneTitle: "Ho gaya! Neeche check karo ✨",
    doneSub: "Saathi ne document khud samajh liya",
    detectedLabel: "Saathi ke hisaab se",
    editHint: "(theek kar sakte ho)",
    camera: "Camera",
    gallery: "Gallery",
    name: "Naam",
    namePlaceholder: "Photo scan karo, ya naam khud daalo",
    expiry: "Expiry date",
    expiryPlaceholder: "YYYY-MM-DD",
    save: "Save karo",
    added: "Document add ho gaya 🎉",
    addedNoNotif: "Document add ho gaya — notification permission do to expiry yaad dila dunga",
    limitReached: "Free me itne hi documents — unlimited ke liye Saathi Plus dekhein",
    nameRequired: "Naam daalo (ya photo scan karo)",
    badDate: "Date format: YYYY-MM-DD",
    saveFailed: "Save nahi ho paya",
  },
  reminders: {
    title: "Reminders",
    sub: "Saathi sahi time pe yaad dilayega",
    emptyTitle: "Abhi koi reminder nahi",
    emptyBody: "Neeche + dabake naya reminder banao — bol ke ya type karke.",
    today: "Aaj",
    upcoming: "Aane wale",
    longPressHint: "Delete karne ke liye card ko dabaye rakho",
    pausedTag: "Plus khatam hone pe paused — dekhne ke liye tap karein",
    deleteConfirmTitle: "Delete karein?",
    deleteConfirmBody: "\"{title}\" hata denge?",
  },
  addReminder: {
    title: "Naya reminder",
    whatLabel: "Kya yaad dilaun?",
    whatPlaceholder: "Jaise: kal subah 8 baje mummy ko call karna",
    micHint: "Mic dabake bolo — time bhi bol do, main samajh lunga",
    understood: "Samajh gaya",
    whenLabel: "Kab yaad dilaun?",
    pickDateTime: "Date & time chuno",
    change: "Badlo",
    noTimeHint: "Time text me nahi mila — upar button se date aur time chuno.",
    save: "Reminder set karo",
    askTime: "Kab yaad dilaun? Date & time chuno",
    setOk: "Reminder set ✓ Time pe yaad dila dunga",
    savedNoNotif: "Save ho gaya, par notification set nahi hui",
    savedNeedPerm: "Save ho gaya (notification permission do)",
    limitReached: "Free me 5 active reminders — unlimited ke liye Saathi Plus dekhein",
  },
  chat: {
    online: "aapka dost · online",
    greeting:
      "Namaste{name}! Main aapka Saathi. Kuch bhi bolo ya likho — reminder, document, ya bas baat. Main yaad rakhunga.",
    stubReply:
      "Samajh gaya. Isse yaad rakhne aur karne wala smart AI jald aa raha hai. Tab tak Documents aur Reminders tabs use karo!",
    inputPlaceholder: "Kuch likho…",
    suggestions: ["Kal 8 baje uthana", "Insurance kab expire hai?", "Aaj kya karna hai?"],
  },
  upgrade: {
    title: "Saathi Plus",
    activeTitle: "Aap Saathi Plus par ho",
    activeSub:
      "Unlimited reminders, documents aur AI — sab unlocked. \"Meri membership\" me expiry aur din dekho.",
    monthly: "Mahina",
    yearlyTab: "Saal · 2 mahine free",
    planName: "Saathi Plus",
    perMonth: "/mahina",
    perYear: "/saal",
    payBtn: "₹{price} — Securely pay",
    payNote: "Google Play se secure · UPI, card, netbanking",
    freeName: "Free",
    freePrice: "₹0 / hamesha",
    referTitle: "Ya {d} din ka Plus plan FREE kamao",
    referSub: "Refer & Earn — dono ko {d} din ka Saathi Plus plan",
    plusFeatures: [
      "Unlimited reminders",
      "Unlimited documents",
      "AI Saathi (smart chat + brief)",
      "Email + WhatsApp reminders",
      "Aane wale saare premium features",
    ],
    freeFeatures: ["{rem} active reminders", "{docs} documents", "Expiry reminders", "Voice + text reminders"],
    needDetails: "Pehle apni details bharo",
    notAvailable: "Payment abhi is build me available nahi (dev build chahiye)",
    purchaseFailed: "Purchase complete nahi hua",
    activated: "Saathi Plus active ho gaya!",
  },
  membership: {
    title: "Meri membership",
    planFree: "Free plan",
    planPlus: "Saathi Plus",
    daysLeft: "{n} din bache",
    lineForever: "Aapka Plus chalu hai — koi expiry nahi.",
    lineUntil: "Plus {date} tak active hai.",
    lineExpired: "Plus {date} ko khatam ho gaya.",
    lineFree: "Free plan pe ho.",
    plusLo: "Saathi Plus dekhein",
    journey: "Aapka safar",
    joined: "Saathi se jude",
    referredByCode: "Kis code se aaye",
    referralEarned: "Referral se kamaaye",
    yourReferrals: "Aapke referrals",
    invite: "Invite karo",
    noReferrals: "Abhi kisi ne aapke code se join nahi kiya.",
    referNote:
      "Din tabhi milte hain jab dost apna pehla document daale AUR Saathi se ek baar baat kare.",
    pending: "abhi pending",
    unlimited: "Unlimited",
    sourceReferral: "Referral se",
    sourcePaid: "Aapne kharida hai",
    sourceAdmin: "Team ne diya",
    sourceReward: "Reward se",
  },
  referral: {
    title: "Refer & Earn",
    heroTitle: "Dono ko {d} din ka Plus plan FREE",
    heroSub:
      "Aapka dost aapke code se join kare, apna pehla document daale aur Saathi se baat kare — dono ko {d} din ka Saathi Plus plan mil jaayega.",
    lockedTitle: "Pehle ye poora karo",
    lockedSub: "Uske baad aapka referral code aur share unlock ho jayega.",
    condDocument: "Ek document add karo",
    condReminder: "Ek reminder set karo",
    condProfile: "Profile complete karo",
    goDo: "Karo",
    yourCode: "Aapka referral code",
    shareBtn: "Dost ko bhejo",
    statReferrals: "Successful referrals",
    statDays: "Plus din kamaaye",
    noLimit:
      "Jitne dost invite karo — har successful referral pe {d} din ka Plus plan. Koi limit nahi.",
    pending: "{x} dost join to hue, par abhi unhone document add + chat poora nahi kiya.",
    shareMessage:
      "Main Apka Saathi use karta hoon — documents ki expiry aur zaroori kaam khud yaad dila deta hai. 🙂\n\nMere code se join karo, dono ko {d} din ka Saathi Plus plan FREE:\n{link}",
    loadError: "Referral info load nahi hui",
  },
  settings: {
    account: "Aapka account",
    backendOk: "Backend juda hai",
    backendMissing: "Backend set nahi (.env bharo)",
    membership: "Meri membership",
    myDetails: "Meri details (name, phone, address…)",
    completeTitle: "Profile poori karein",
    completeSub: "Naam, phone, address — referral aur Plus ke liye zaroori",
    referRow: "Refer & Earn — dono ko {d} din ka Plus plan free",
    plusActive: "Saathi Plus — active",
    plusLo: "Saathi Plus",
    plusActiveSub: "Unlimited reminders, documents aur AI",
    plusSub: "Unlimited reminders, documents aur AI",
    groupSaathi: "Saathi",
    groupPrivacy: "Privacy",
    groupMore: "Aur",
    saathiName: "Saathi ka naam",
    notifications: "Notifications",
    language: "Bhasha",
    privacy: "Privacy & data",
    exportData: "Mera data export karo",
    deleteAll: "Sab data delete",
    help: "Help & support",
    about: "About Apka Saathi",
    logout: "Logout",
    version: "Apka Saathi · v0.1.0 · Made in India",
    langAlertTitle: "Bhasha",
    langAlertBody: "Neeche se apni bhasha chuno — poora app usi me badal jayega.",
    deleteTitle: "Sab data delete karein?",
    deleteBody:
      "Aapke saare documents aur reminders hamesha ke liye hat jaayenge. Account nahi hatega. Ye wapas nahi aayega.",
    deleteYes: "Haan, delete karo",
    deleted: "Aapka data delete ho gaya",
  },
};

/* ================================ HINDI ============================== */

const hi: Dict = {
  common: {
    save: "सेव करें",
    cancel: "रद्द करें",
    delete: "डिलीट",
    back: "वापस",
    next: "आगे",
    close: "बंद करें",
    ok: "ठीक है",
    yes: "हाँ",
    no: "नहीं",
    loading: "लोड हो रहा है…",
    upgrade: "अपग्रेड",
    plusBadge: "प्लस",
  },
  langSelect: {
    welcome: "Apka Saathi में आपका स्वागत है",
    tagline: "एक दोस्त जो आपकी ज़रूरी चीज़ें याद रखता है।",
    choose: "अपनी भाषा चुनें",
    continue: "आगे बढ़ें",
    changeLater: "बाद में Settings से बदल सकते हैं।",
  },
  onboarding: {
    title: "मिलिए अपने साथी से",
    sub: "एक दोस्त जो आपकी ज़िंदगी का ख़याल रखता है — बिना पूछे।",
    points: [
      "डॉक्युमेंट्स की एक्सपायरी कभी न भूलें",
      "हर सुबह एक साफ़ डेली ब्रीफ़",
      "100% प्राइवेट — सब आपके कंट्रोल में",
    ],
    start: "चलिए शुरू करें",
  },
  tabs: { home: "होम", saathi: "साथी", docs: "डॉक्स", alerts: "अलर्ट", you: "आप" },
  login: {
    welcomeBack: "वापस आ गए",
    loginSub: "लॉगिन करें और अपनी ज़िंदगी सँभालें",
    signupTitle: "मिलिए अपने साथी से",
    signupSub: "नया अकाउंट बनाएँ — फ्री है",
    name: "आपका नाम",
    namePlaceholder: "जैसे: राहुल",
    email: "ईमेल",
    emailPlaceholder: "aapka@email.com",
    password: "पासवर्ड",
    passwordPlaceholder: "कम से कम 6 अक्षर",
    referralCode: "रेफ़रल कोड",
    referralOptional: "optional",
    referralPlaceholder: "दोस्त का कोड",
    referralHint:
      "रिवॉर्ड तब मिलेगा जब आप अपना पहला डॉक्युमेंट डालें और साथी से एक बार बात करें।",
    loginBtn: "लॉगिन करें",
    signupBtn: "अकाउंट बनाएँ",
    or: "या",
    google: "Google से जारी रखें",
    noAccount: "नए हैं?",
    createAccount: "अकाउंट बनाएँ",
    haveAccount: "पहले से अकाउंट है?",
    loginInstead: "लॉगिन करें",
    referralPlaceholderTpl: "दोस्त का कोड — दोनों को {d} दिन का प्लस प्लान फ्री",
  },
  home: {
    greeting: "नमस्ते{name}",
    briefLabel: "आज का ब्रीफ़",
    briefLoading: "आपके डॉक्युमेंट्स देख रहा हूँ…",
    briefAttention:
      "ध्यान दें{name} — {n} डॉक्युमेंट जल्द एक्सपायर हो रहे हैं। नीचे देखिए, मैं याद रख रहा हूँ।",
    briefStart:
      "चलिए शुरू करें{name}! पहला डॉक्युमेंट डालिए, मैं उसकी एक्सपायरी सँभाल लूँगा।",
    briefAllSet: "सब सेट है{name}! कोई डॉक्युमेंट जल्द एक्सपायर नहीं हो रहा। रिलैक्स करें।",
    quickDoc: "डॉक्युमेंट जोड़ें",
    quickChat: "साथी से बात",
    attention: "ध्यान देना है",
    seeAll: "सब देखें",
    nothingUrgent: "अभी कुछ ज़रूरी नहीं",
    referCard: "Refer & Earn — दोनों को {d} दिन प्लस फ्री",
    referCardSub: "दोस्त को इनवाइट करें, दोनों को साथी प्लस प्लान",
  },
  documents: {
    title: "डॉक्युमेंट्स",
    savedSub: "{n} सेव · एक्सपायरी auto-tracked",
    filterAll: "सब",
    filterSoon: "जल्द एक्सपायर",
    filterExpired: "एक्सपायर्ड",
    emptyTitle: "अभी कोई डॉक्युमेंट नहीं",
    emptyInCategory: "इस कैटेगरी में कुछ नहीं",
    emptyBodyFirst: "अपना पहला डॉक्युमेंट डालें — साथी एक्सपायरी याद रखेगा।",
    emptyBodyFilter: "फ़िल्टर बदल के देखें, या नया डॉक्युमेंट डालें।",
    addBtn: "डॉक्युमेंट जोड़ें",
    longPressHint: "डिलीट करने के लिए कार्ड को दबाए रखें",
    lockedSub: "साथी प्लस में देख सकते हैं",
    expiryNotSet: "एक्सपायरी सेट नहीं",
    deleted: "डॉक्युमेंट डिलीट हो गया",
    deleteConfirmTitle: "डिलीट करें?",
    deleteConfirmBody: "\"{name}\" हटा दें?",
  },
  addDocument: {
    title: "डॉक्युमेंट जोड़ें",
    photoTitle: "फ़ोटो डालें",
    photoSub: "डॉक्युमेंट की फ़ोटो डालें — कौन-सा है और कब एक्सपायर है, साथी खुद समझ लेगा",
    scanning: "समझ रहा हूँ…",
    doneTitle: "हो गया! नीचे देखें ✨",
    doneSub: "साथी ने डॉक्युमेंट खुद समझ लिया",
    detectedLabel: "साथी के हिसाब से",
    editHint: "(ठीक कर सकते हैं)",
    camera: "कैमरा",
    gallery: "गैलरी",
    name: "नाम",
    namePlaceholder: "फ़ोटो स्कैन करें, या नाम खुद डालें",
    expiry: "एक्सपायरी डेट",
    expiryPlaceholder: "YYYY-MM-DD",
    save: "सेव करें",
    added: "डॉक्युमेंट जुड़ गया 🎉",
    addedNoNotif: "डॉक्युमेंट जुड़ गया — notification permission दें तो एक्सपायरी याद दिला दूँगा",
    limitReached: "फ्री में इतने ही डॉक्युमेंट — अनलिमिटेड के लिए साथी प्लस देखें",
    nameRequired: "नाम डालें (या फ़ोटो स्कैन करें)",
    badDate: "डेट फ़ॉर्मैट: YYYY-MM-DD",
    saveFailed: "सेव नहीं हो पाया",
  },
  reminders: {
    title: "रिमाइंडर्स",
    sub: "साथी सही समय पर याद दिलाएगा",
    emptyTitle: "अभी कोई रिमाइंडर नहीं",
    emptyBody: "नीचे + दबाकर नया रिमाइंडर बनाएँ — बोलकर या टाइप करके।",
    today: "आज",
    upcoming: "आने वाले",
    longPressHint: "डिलीट करने के लिए कार्ड को दबाए रखें",
    pausedTag: "प्लस खत्म होने पर रुका — देखने के लिए टैप करें",
    deleteConfirmTitle: "डिलीट करें?",
    deleteConfirmBody: "\"{title}\" हटा दें?",
  },
  addReminder: {
    title: "नया रिमाइंडर",
    whatLabel: "क्या याद दिलाऊँ?",
    whatPlaceholder: "जैसे: कल सुबह 8 बजे मम्मी को कॉल करना",
    micHint: "माइक दबाकर बोलें — टाइम भी बोल दें, मैं समझ लूँगा",
    understood: "समझ गया",
    whenLabel: "कब याद दिलाऊँ?",
    pickDateTime: "डेट & टाइम चुनें",
    change: "बदलें",
    noTimeHint: "टाइम टेक्स्ट में नहीं मिला — ऊपर बटन से डेट और टाइम चुनें।",
    save: "रिमाइंडर सेट करें",
    askTime: "कब याद दिलाऊँ? डेट & टाइम चुनें",
    setOk: "रिमाइंडर सेट ✓ समय पर याद दिला दूँगा",
    savedNoNotif: "सेव हो गया, पर notification सेट नहीं हुई",
    savedNeedPerm: "सेव हो गया (notification permission दें)",
    limitReached: "फ्री में 5 active रिमाइंडर — अनलिमिटेड के लिए साथी प्लस देखें",
  },
  chat: {
    online: "आपका दोस्त · ऑनलाइन",
    greeting:
      "नमस्ते{name}! मैं आपका साथी। कुछ भी बोलें या लिखें — रिमाइंडर, डॉक्युमेंट, या बस बात। मैं याद रखूँगा।",
    stubReply:
      "समझ गया। इसे याद रखने और करने वाला smart AI जल्द आ रहा है। तब तक Documents और Reminders टैब इस्तेमाल करें!",
    inputPlaceholder: "कुछ लिखें…",
    suggestions: ["कल 8 बजे उठाना", "इंश्योरेंस कब एक्सपायर है?", "आज क्या करना है?"],
  },
  upgrade: {
    title: "साथी प्लस",
    activeTitle: "आप साथी प्लस पर हैं",
    activeSub:
      "अनलिमिटेड रिमाइंडर, डॉक्युमेंट और AI — सब अनलॉक। \"मेरी membership\" में एक्सपायरी और दिन देखें।",
    monthly: "महीना",
    yearlyTab: "साल · 2 महीने फ्री",
    planName: "साथी प्लस",
    perMonth: "/महीना",
    perYear: "/साल",
    payBtn: "₹{price} — सुरक्षित pay करें",
    payNote: "Google Play से सुरक्षित · UPI, card, netbanking",
    freeName: "फ्री",
    freePrice: "₹0 / हमेशा",
    referTitle: "या {d} दिन का प्लस प्लान FREE कमाएँ",
    referSub: "Refer & Earn — दोनों को {d} दिन का साथी प्लस प्लान",
    plusFeatures: [
      "अनलिमिटेड रिमाइंडर",
      "अनलिमिटेड डॉक्युमेंट",
      "AI साथी (smart chat + brief)",
      "Email + WhatsApp रिमाइंडर",
      "आने वाले सारे premium features",
    ],
    freeFeatures: ["{rem} active रिमाइंडर", "{docs} डॉक्युमेंट", "एक्सपायरी रिमाइंडर", "वॉइस + टेक्स्ट रिमाइंडर"],
    needDetails: "पहले अपनी details भरें",
    notAvailable: "पेमेंट अभी इस build में available नहीं (dev build चाहिए)",
    purchaseFailed: "परचेज़ पूरा नहीं हुआ",
    activated: "साथी प्लस active हो गया!",
  },
  membership: {
    title: "मेरी membership",
    planFree: "फ्री प्लान",
    planPlus: "साथी प्लस",
    daysLeft: "{n} दिन बचे",
    lineForever: "आपका प्लस चालू है — कोई एक्सपायरी नहीं।",
    lineUntil: "प्लस {date} तक active है।",
    lineExpired: "प्लस {date} को खत्म हो गया।",
    lineFree: "फ्री प्लान पर हैं।",
    plusLo: "साथी प्लस देखें",
    journey: "आपका सफ़र",
    joined: "साथी से जुड़े",
    referredByCode: "किस कोड से आए",
    referralEarned: "रेफ़रल से कमाए",
    yourReferrals: "आपके रेफ़रल",
    invite: "इनवाइट करें",
    noReferrals: "अभी किसी ने आपके कोड से जॉइन नहीं किया।",
    referNote:
      "दिन तभी मिलते हैं जब दोस्त अपना पहला डॉक्युमेंट डाले और साथी से एक बार बात करे।",
    pending: "अभी pending",
    unlimited: "अनलिमिटेड",
    sourceReferral: "रेफ़रल से",
    sourcePaid: "आपने खरीदा है",
    sourceAdmin: "टीम ने दिया",
    sourceReward: "रिवॉर्ड से",
  },
  referral: {
    title: "Refer & Earn",
    heroTitle: "दोनों को {d} दिन का प्लस प्लान FREE",
    heroSub:
      "आपका दोस्त आपके कोड से जॉइन करे, अपना पहला डॉक्युमेंट डाले और साथी से बात करे — दोनों को {d} दिन का साथी प्लस प्लान मिल जाएगा।",
    lockedTitle: "पहले ये पूरा करें",
    lockedSub: "उसके बाद आपका रेफ़रल कोड और शेयर अनलॉक हो जाएगा।",
    condDocument: "एक डॉक्युमेंट जोड़ें",
    condReminder: "एक रिमाइंडर सेट करें",
    condProfile: "प्रोफ़ाइल पूरी करें",
    goDo: "करें",
    yourCode: "आपका रेफ़रल कोड",
    shareBtn: "दोस्त को भेजें",
    statReferrals: "सफल रेफ़रल",
    statDays: "प्लस दिन कमाए",
    noLimit:
      "जितने दोस्त इनवाइट करें — हर सफल रेफ़रल पर {d} दिन का प्लस प्लान। कोई सीमा नहीं।",
    pending: "{x} दोस्त जॉइन तो हुए, पर अभी उन्होंने डॉक्युमेंट + चैट पूरा नहीं किया।",
    shareMessage:
      "मैं Apka Saathi इस्तेमाल करता हूँ — डॉक्युमेंट्स की एक्सपायरी और ज़रूरी काम खुद याद दिला देता है। 🙂\n\nमेरे कोड से जॉइन करें, दोनों को {d} दिन का साथी प्लस प्लान FREE:\n{link}",
    loadError: "रेफ़रल जानकारी लोड नहीं हुई",
  },
  settings: {
    account: "आपका अकाउंट",
    backendOk: "बैकएंड जुड़ा है",
    backendMissing: "बैकएंड सेट नहीं (.env भरें)",
    membership: "मेरी membership",
    myDetails: "मेरी details (name, phone, address…)",
    completeTitle: "प्रोफ़ाइल पूरी करें",
    completeSub: "नाम, फ़ोन, पता — रेफ़रल और प्लस के लिए ज़रूरी",
    referRow: "Refer & Earn — दोनों को {d} दिन का प्लस प्लान फ्री",
    plusActive: "साथी प्लस — active",
    plusLo: "साथी प्लस",
    plusActiveSub: "अनलिमिटेड रिमाइंडर, डॉक्युमेंट और AI",
    plusSub: "अनलिमिटेड रिमाइंडर, डॉक्युमेंट और AI",
    groupSaathi: "साथी",
    groupPrivacy: "प्राइवेसी",
    groupMore: "और",
    saathiName: "साथी का नाम",
    notifications: "नोटिफ़िकेशन",
    language: "भाषा",
    privacy: "प्राइवेसी & डेटा",
    exportData: "मेरा डेटा export करें",
    deleteAll: "सब डेटा डिलीट",
    help: "हेल्प & support",
    about: "About Apka Saathi",
    logout: "लॉगआउट",
    version: "Apka Saathi · v0.1.0 · Made in India",
    langAlertTitle: "भाषा",
    langAlertBody: "नीचे से अपनी भाषा चुनें — पूरा app उसी में बदल जाएगा।",
    deleteTitle: "सब डेटा डिलीट करें?",
    deleteBody:
      "आपके सारे डॉक्युमेंट और रिमाइंडर हमेशा के लिए हट जाएँगे। अकाउंट नहीं हटेगा। यह वापस नहीं आएगा।",
    deleteYes: "हाँ, डिलीट करें",
    deleted: "आपका डेटा डिलीट हो गया",
  },
};

/* =============================== ENGLISH ============================= */

const en: Dict = {
  common: {
    save: "Save",
    cancel: "Cancel",
    delete: "Delete",
    back: "Back",
    next: "Next",
    close: "Close",
    ok: "OK",
    yes: "Yes",
    no: "No",
    loading: "Loading…",
    upgrade: "Upgrade",
    plusBadge: "Plus",
  },
  langSelect: {
    welcome: "Welcome to Apka Saathi",
    tagline: "A companion that remembers what matters to you.",
    choose: "Choose your language",
    continue: "Continue",
    changeLater: "You can change this later in Settings.",
  },
  onboarding: {
    title: "Meet your Saathi",
    sub: "A friend who looks after your life — without being asked.",
    points: [
      "Never forget a document's expiry",
      "A clean daily brief every morning",
      "100% private — all in your control",
    ],
    start: "Let's get started",
  },
  tabs: { home: "Home", saathi: "Saathi", docs: "Docs", alerts: "Alerts", you: "You" },
  login: {
    welcomeBack: "Welcome back",
    loginSub: "Sign in and let Saathi handle the rest",
    signupTitle: "Meet your Saathi",
    signupSub: "Create a new account — it's free",
    name: "Your name",
    namePlaceholder: "e.g. Rahul",
    email: "Email",
    emailPlaceholder: "you@email.com",
    password: "Password",
    passwordPlaceholder: "At least 6 characters",
    referralCode: "Referral code",
    referralOptional: "optional",
    referralPlaceholder: "Friend's code",
    referralHint:
      "You'll get the reward once you add your first document and chat with Saathi once.",
    loginBtn: "Sign in",
    signupBtn: "Create account",
    or: "or",
    google: "Continue with Google",
    noAccount: "New here?",
    createAccount: "Create account",
    haveAccount: "Already have an account?",
    loginInstead: "Sign in",
    referralPlaceholderTpl: "Friend's code — you both get {d} days of the Plus plan free",
  },
  home: {
    greeting: "Namaste{name}",
    briefLabel: "Today's brief",
    briefLoading: "Looking through your documents…",
    briefAttention:
      "Heads up{name} — {n} document(s) expiring soon. Take a look below, I'm keeping track.",
    briefStart: "Let's begin{name}! Add your first document and I'll handle its expiry.",
    briefAllSet: "All set{name}! Nothing expiring soon. Relax.",
    quickDoc: "Add document",
    quickChat: "Chat with Saathi",
    attention: "Needs attention",
    seeAll: "See all",
    nothingUrgent: "Nothing urgent right now",
    referCard: "Refer & Earn — you both get {d} days of Plus free",
    referCardSub: "Invite a friend, you both get the Saathi Plus plan",
  },
  documents: {
    title: "Documents",
    savedSub: "{n} saved · expiry auto-tracked",
    filterAll: "All",
    filterSoon: "Expiring soon",
    filterExpired: "Expired",
    emptyTitle: "No documents yet",
    emptyInCategory: "Nothing in this category",
    emptyBodyFirst: "Add your first document — Saathi will remember its expiry.",
    emptyBodyFilter: "Try another filter, or add a new document.",
    addBtn: "Add document",
    longPressHint: "Press and hold a card to delete",
    lockedSub: "Available on Saathi Plus",
    expiryNotSet: "No expiry set",
    deleted: "Document deleted",
    deleteConfirmTitle: "Delete?",
    deleteConfirmBody: "Remove \"{name}\"?",
  },
  addDocument: {
    title: "Add document",
    photoTitle: "Add a photo",
    photoSub: "Add a photo of the document — Saathi figures out what it is and when it expires",
    scanning: "Reading…",
    doneTitle: "Done! Check below ✨",
    doneSub: "Saathi read the document automatically",
    detectedLabel: "According to Saathi",
    editHint: "(you can fix it)",
    camera: "Camera",
    gallery: "Gallery",
    name: "Name",
    namePlaceholder: "Scan a photo, or type the name",
    expiry: "Expiry date",
    expiryPlaceholder: "YYYY-MM-DD",
    save: "Save",
    added: "Document added 🎉",
    addedNoNotif: "Document added — allow notifications and I'll remind you of the expiry",
    limitReached: "You've reached the Free limit — Saathi Plus for unlimited",
    nameRequired: "Enter a name (or scan a photo)",
    badDate: "Date format: YYYY-MM-DD",
    saveFailed: "Couldn't save",
  },
  reminders: {
    title: "Reminders",
    sub: "Saathi will remind you at the right time",
    emptyTitle: "No reminders yet",
    emptyBody: "Tap + below to create one — by voice or typing.",
    today: "Today",
    upcoming: "Upcoming",
    longPressHint: "Press and hold a card to delete",
    pausedTag: "Paused after Plus ended — tap to view",
    deleteConfirmTitle: "Delete?",
    deleteConfirmBody: "Remove \"{title}\"?",
  },
  addReminder: {
    title: "New reminder",
    whatLabel: "What should I remind you about?",
    whatPlaceholder: "e.g. call mom tomorrow at 8am",
    micHint: "Tap the mic and speak — say the time too, I'll understand",
    understood: "Got it",
    whenLabel: "When should I remind you?",
    pickDateTime: "Pick date & time",
    change: "Change",
    noTimeHint: "No time found in the text — pick date and time above.",
    save: "Set reminder",
    askTime: "When should I remind you? Pick date & time",
    setOk: "Reminder set ✓ I'll remind you on time",
    savedNoNotif: "Saved, but the notification wasn't set",
    savedNeedPerm: "Saved (please allow notifications)",
    limitReached: "5 active reminders on Free — Saathi Plus for unlimited",
  },
  chat: {
    online: "your friend · online",
    greeting:
      "Namaste{name}! I'm your Saathi. Say or type anything — a reminder, a document, or just chat. I'll remember.",
    stubReply:
      "Got it. A smarter AI that acts on this is coming soon. Until then, use the Documents and Reminders tabs!",
    inputPlaceholder: "Type something…",
    suggestions: ["Wake me at 8am", "When does my insurance expire?", "What's on today?"],
  },
  upgrade: {
    title: "Saathi Plus",
    activeTitle: "You're on Saathi Plus",
    activeSub:
      "Unlimited reminders, documents and AI — all unlocked. See expiry and days in \"My membership\".",
    monthly: "Monthly",
    yearlyTab: "Yearly · 2 months free",
    planName: "Saathi Plus",
    perMonth: "/month",
    perYear: "/year",
    payBtn: "₹{price} — Pay securely",
    payNote: "Secure via Google Play · UPI, card, netbanking",
    freeName: "Free",
    freePrice: "₹0 / forever",
    referTitle: "Or earn {d} days of the Plus plan FREE",
    referSub: "Refer & Earn — you both get {d} days of Saathi Plus",
    plusFeatures: [
      "Unlimited reminders",
      "Unlimited documents",
      "AI Saathi (smart chat + brief)",
      "Email + WhatsApp reminders",
      "All upcoming premium features",
    ],
    freeFeatures: ["{rem} active reminders", "{docs} documents", "Expiry reminders", "Voice + text reminders"],
    needDetails: "Fill in your details first",
    notAvailable: "Payments aren't available in this build yet (needs a dev build)",
    purchaseFailed: "Purchase didn't complete",
    activated: "Saathi Plus is active!",
  },
  membership: {
    title: "My membership",
    planFree: "Free plan",
    planPlus: "Saathi Plus",
    daysLeft: "{n} days left",
    lineForever: "Your Plus is active — no expiry.",
    lineUntil: "Plus is active until {date}.",
    lineExpired: "Plus ended on {date}.",
    lineFree: "You're on the Free plan.",
    plusLo: "Explore Saathi Plus",
    journey: "Your journey",
    joined: "Joined Saathi",
    referredByCode: "Joined with code",
    referralEarned: "Earned from referrals",
    yourReferrals: "Your referrals",
    invite: "Invite",
    noReferrals: "Nobody has joined with your code yet.",
    referNote:
      "Days are earned only when your friend adds their first document AND chats with Saathi once.",
    pending: "pending",
    unlimited: "Unlimited",
    sourceReferral: "From referral",
    sourcePaid: "You purchased it",
    sourceAdmin: "Given by the team",
    sourceReward: "From a reward",
  },
  referral: {
    title: "Refer & Earn",
    heroTitle: "You both get {d} days of the Plus plan FREE",
    heroSub:
      "Your friend joins with your code, adds their first document and chats with Saathi — you both get {d} days of the Saathi Plus plan.",
    lockedTitle: "First, finish these",
    lockedSub: "Then your referral code and sharing unlock.",
    condDocument: "Add one document",
    condReminder: "Set one reminder",
    condProfile: "Complete your profile",
    goDo: "Do it",
    yourCode: "Your referral code",
    shareBtn: "Send to a friend",
    statReferrals: "Successful referrals",
    statDays: "Plus days earned",
    noLimit:
      "Invite as many friends as you like — {d} days of the Plus plan per successful referral. No limit.",
    pending: "{x} friend(s) joined, but haven't added a document and chatted yet.",
    shareMessage:
      "I use Apka Saathi — it remembers my document expiries and everything that matters. 🙂\n\nJoin with my code and we both get {d} days of the Saathi Plus plan FREE:\n{link}",
    loadError: "Couldn't load referral info",
  },
  settings: {
    account: "Your account",
    backendOk: "Backend connected",
    backendMissing: "Backend not set (fill .env)",
    membership: "My membership",
    myDetails: "My details (name, phone, address…)",
    completeTitle: "Complete your profile",
    completeSub: "Name, phone, address — needed for referrals and Plus",
    referRow: "Refer & Earn — you both get {d} days of Plus free",
    plusActive: "Saathi Plus — active",
    plusLo: "Saathi Plus",
    plusActiveSub: "Unlimited reminders, documents and AI",
    plusSub: "Unlimited reminders, documents and AI",
    groupSaathi: "Saathi",
    groupPrivacy: "Privacy",
    groupMore: "More",
    saathiName: "Saathi's name",
    notifications: "Notifications",
    language: "Language",
    privacy: "Privacy & data",
    exportData: "Export my data",
    deleteAll: "Delete all data",
    help: "Help & support",
    about: "About Apka Saathi",
    logout: "Log out",
    version: "Apka Saathi · v0.1.0 · Made in India",
    langAlertTitle: "Language",
    langAlertBody: "Pick your language below — the whole app switches to it.",
    deleteTitle: "Delete all data?",
    deleteBody:
      "All your documents and reminders will be gone forever. Your account stays. This can't be undone.",
    deleteYes: "Yes, delete",
    deleted: "Your data has been deleted",
  },
};

export const dictionaries: Record<Locale, Dict> = { hinglish, hi, en };
