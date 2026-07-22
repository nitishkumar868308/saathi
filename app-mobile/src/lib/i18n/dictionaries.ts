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
    today: string;
    tomorrow: string;
    done: string;
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
    nameLabel: string;
    namePlaceholder: string;
  };
  tabs: { home: string; saathi: string; docs: string; alerts: string; you: string };
  notif: {
    reminderTitle: string;
    expiryTitle: string;
    /** {name} */
    expiryToday: string;
    /** {name} {n} */
    expiryInDays: string;
    alertReminder: string;
    alertExpiry: string;
    alertOk: string;
    alertDid: string;
    alertDone: string;
    alertLater: string;
  };
  voice: {
    /** BCP-47 tag for speech recognition, e.g. "en-IN" / "hi-IN" */
    recogLang: string;
    unclear: string;
    micPermission: string;
    unavailable: string;
  };
  phoneField: {
    placeholder: string;
    searchPlaceholder: string;
    close: string;
  };
  reliability: {
    promptTitle: string;
    promptBody: string;
    promptButton: string;
    promptLater: string;
    settingsRow: string;
    settingsRowSub: string;
  };
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
    nameRequired: string;
    badEmail: string;
    shortPassword: string;
    confirmSent: string;
    welcomeNew: string;
    welcomeBackToast: string;
    somethingWrong: string;
    googleFailed: string;
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
    todayTitle: string;
    todayNone: string;
    markDone: string;
    doneToast: string;
    /** {d} */
    referCard: string;
    referCardSub: string;
    loadFailed: string;
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
    expiryExpired: string;
    expiryTodayLabel: string;
    expiryTomorrowLabel: string;
    /** {n} */
    expiryInDaysLabel: string;
    noFileSaved: string;
    share: string;
    viewAction: string;
    shareFailed: string;
    /** {n} */
    sharedN: string;
    selectAll: string;
    /** {n} */
    selectCount: string;
    /** {n} */
    shareSelected: string;
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
    cameraPermission: string;
    ocrExpiryFound: string;
    /** {bits} */
    ocrReadTpl: string;
    ocrUnclear: string;
    ocrFailed: string;
    imageFailed: string;
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
    askWhat: string;
    askWhatPlaceholder: string;
    understanding: string;
    askDay: string;
    dayAfter: string;
    pickDate: string;
    pickTime: string;
    pastError: string;
    askAmPm: string;
    otherTime: string;
  };
  review: {
    title: string;
    sub: string;
    placeholder: string;
    consent: string;
    submit: string;
    later: string;
    thanksTitle: string;
    thanksSub: string;
    rateBtn: string;
  };
  network: {
    offline: string;
    slow: string;
    retry: string;
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
    /** {ip} {profile} */
    mismatchTitle: string;
    mismatchBody: string;
    mismatchUseIp: string;
    mismatchUseProfile: string;
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
    loginFirst: string;
    noPlan: string;
    paymentFailed: string;
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
    /** {n} din/days — days ki localized unit */
    daysTpl: string;
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
  profileDetails: {
    title: string;
    photoHint: string;
    fullName: string;
    fullNamePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    phone: string;
    phoneError: string;
    address: string;
    addressPlaceholder: string;
    gender: string;
    male: string;
    female: string;
    other: string;
    country: string;
    countryPick: string;
    countryNoData: string;
    countrySearch: string;
    state: string;
    statePick: string;
    stateFirst: string;
    stateSearch: string;
    city: string;
    cityPick: string;
    cityFirst: string;
    citySearch: string;
    searchEmpty: string;
    save: string;
    loadError: string;
    photoUpdated: string;
    photoTooLarge: string;
    photoFailed: string;
    fillAll: string;
    saved: string;
    saveFailed: string;
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
    linkFailed: string;
    exportContact: string;
    settingsFailed: string;
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
    today: "Aaj",
    tomorrow: "Kal",
    done: "Ho gaya",
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
    nameLabel: "Aap Saathi ko kya bulaoge?",
    namePlaceholder: "Saathi",
  },
  tabs: { home: "Home", saathi: "Saathi", docs: "Docs", alerts: "Alerts", you: "You" },
  notif: {
    reminderTitle: "Saathi 🔔",
    expiryTitle: "Saathi 📄",
    expiryToday: "{name} aaj expire ho raha hai.",
    expiryInDays: "{name} {n} din me expire ho raha hai.",
    alertReminder: "Reminder",
    alertExpiry: "Document expiry",
    alertOk: "Theek hai, samajh gaya",
    alertDid: "Kya aapne yeh kar liya?",
    alertDone: "Haan, ho gaya",
    alertLater: "Abhi nahi",
  },
  voice: {
    recogLang: "en-IN",
    unclear: "Awaaz saaf nahi aayi, dobara boliye",
    micPermission: "Mic permission chahiye",
    unavailable: "Voice available nahi hai is device pe",
  },
  phoneField: {
    placeholder: "Phone number",
    searchPlaceholder: "Country ya code search karo",
    close: "Band karo",
  },
  reliability: {
    promptTitle: "Reminder time pe aaye — ek chhota step",
    promptBody:
      "Kai phone (Xiaomi, Realme, Oppo, Vivo, Samsung) app band hone pe reminders rok dete hain. Battery settings me Saathi ko \"Unrestricted\" kar do — phir app band ho tab bhi reminder + sound aayega.",
    promptButton: "Battery settings kholo",
    promptLater: "Baad me",
    settingsRow: "Reminders reliable banao",
    settingsRowSub: "Battery optimization off — app band ho tab bhi reminder aaye",
  },
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
      "Reward tab milega jab aap apna pehla document add karo aur ek reminder set karo.",
    loginBtn: "Login karo",
    signupBtn: "Account banao",
    or: "ya",
    google: "Google se continue karo",
    noAccount: "Naya ho?",
    createAccount: "Account banao",
    haveAccount: "Pehle se account hai?",
    loginInstead: "Login karo",
    referralPlaceholderTpl: "Dost ka code — dono ko {d} din ka Plus plan free",
    nameRequired: "Apna naam daalo",
    badEmail: "Sahi email daalo",
    shortPassword: "Password kam se kam 6 characters",
    confirmSent: "Email pe confirmation link bheja — check karo",
    welcomeNew: "Welcome to Apka Saathi! 🎉",
    welcomeBackToast: "Wapas aa gaye! 🙂",
    somethingWrong: "Kuch gadbad ho gayi",
    googleFailed: "Google login nahi hua",
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
    todayTitle: "Aaj ke reminders",
    todayNone: "Aaj koi reminder nahi 🌿",
    markDone: "Kiya",
    doneToast: "Shabaash! ✓",
    referCard: "Refer & Earn — dono ko {d} din Plus free",
    referCardSub: "Dost ko invite karo, dono ko Saathi Plus plan",
    loadFailed: "Data load nahi ho paya",
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
    expiryExpired: "Expire ho gaya",
    expiryTodayLabel: "Aaj expire",
    expiryTomorrowLabel: "Kal expire",
    expiryInDaysLabel: "{n} din mein expire",
    noFileSaved: "Is document ki file save nahi hai.",
    share: "Share",
    viewAction: "Dekho",
    shareFailed: "Share nahi ho paaya",
    sharedN: "{n} document share hue",
    selectAll: "Sabhi chuno",
    selectCount: "{n} chune",
    shareSelected: "Share ({n})",
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
    cameraPermission: "Camera permission chahiye",
    ocrExpiryFound: "expiry mil gayi",
    ocrReadTpl: "Padh liya: {bits} ✨",
    ocrUnclear: "Padha, par saaf nahi — details khud daal do",
    ocrFailed: "Photo padhne mein dikkat — details khud daal do",
    imageFailed: "Image select nahi hui",
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
    askWhat: "Ye reminder kis cheez ke liye hai?",
    askWhatPlaceholder: "Jaise: dawai lena, bijli bill bharna",
    understanding: "Samajh raha hoon…",
    askDay: "Kis din yaad dilau?",
    dayAfter: "Parso",
    pickDate: "Date chuno",
    pickTime: "Time chuno",
    pastError: "Ye time nikal chuka — aage ka time chuno",
    askAmPm: "Subah ya shaam?",
    otherTime: "Koi aur time",
  },
  review: {
    title: "Saathi ko kitne star doge?",
    sub: "Aapki raay se Saathi aur behtar banega.",
    placeholder: "Kuch kehna chaho? (optional)",
    consent: "Main Apka Saathi ko ye review website pe dikhane ki anumati deta hoon",
    submit: "Bhejo",
    later: "Abhi nahi",
    thanksTitle: "Dhanyavaad! ❤️",
    thanksSub:
      "Bahut maayne rakhta hai. Ek aakhri baat — Play Store pe ek chhoti rating se aur parivaar Saathi tak pahunchte hain. Bas 10 second. 🙏",
    rateBtn: "Play Store pe rate karo",
  },
  network: {
    offline: "Internet nahi hai — kaam offline save ho raha hai",
    slow: "Internet dheema hai…",
    retry: "Dobara try karo",
  },
  chat: {
    online: "aapka dost · online",
    greeting:
      "Namaste{name}! Main aapka Saathi. Apne reminders, tasks aur documents ke baare me pooch lo — main madad kar dunga. 🙂",
    stubReply:
      "Aap apne reminder, task ya document se judi cheezein pooch sakte ho. 🙂 Abhi main baaki sab kuch nahi bata sakta, par wo bahut jald aa raha hai — tab tak Documents aur Reminders tabs use karo!",
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
    payBtn: "{price} — Securely pay",
    payNote: "Google Play se secure · UPI, card, netbanking",
    mismatchTitle: "Aapka desh confirm karo",
    mismatchBody: "Aap abhi {ip} me lag rahe ho, par aapka profile {profile} ka hai. Kaunse desh ka price dikhaayein?",
    mismatchUseIp: "{ip} ka price",
    mismatchUseProfile: "{profile} ka price",
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
    loginFirst: "Pehle login karo",
    noPlan: "Koi plan available nahi",
    paymentFailed: "Payment shuru nahi hua",
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
    daysTpl: "{n} din",
    yourReferrals: "Aapke referrals",
    invite: "Invite karo",
    noReferrals: "Abhi kisi ne aapke code se join nahi kiya.",
    referNote:
      "Din tabhi milte hain jab dost apna pehla document daale AUR ek reminder set kare.",
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
      "Aapka dost aapke code se join kare, apna pehla document daale aur ek reminder set kare — dono ko {d} din ka Saathi Plus plan mil jaayega.",
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
    pending: "{x} dost join to hue, par abhi unhone document add + reminder poora nahi kiya.",
    shareMessage:
      "Main Apka Saathi use karta hoon — documents ki expiry aur zaroori kaam khud yaad dila deta hai. 🙂\n\nMere code se join karo, dono ko {d} din ka Saathi Plus plan FREE:\n{link}",
    loadError: "Referral info load nahi hui",
  },
  profileDetails: {
    title: "Meri details",
    photoHint: "Photo add karo (2 MB tak)",
    fullName: "Poora naam",
    fullNamePlaceholder: "Aapka naam",
    email: "Email",
    emailPlaceholder: "you@email.com",
    phone: "Phone number",
    phoneError: "Sahi phone number daalo",
    address: "Address",
    addressPlaceholder: "Ghar / office ka pata",
    gender: "Gender",
    male: "Male",
    female: "Female",
    other: "Other",
    country: "Country",
    countryPick: "Country chuno",
    countryNoData: "Data import karo",
    countrySearch: "Country search karo…",
    state: "State",
    statePick: "State chuno",
    stateFirst: "Pehle country",
    stateSearch: "State search karo…",
    city: "City",
    cityPick: "City chuno",
    cityFirst: "Pehle state",
    citySearch: "City search karo…",
    searchEmpty: "Kuch nahi mila",
    save: "Save karo",
    loadError: "Details load nahi hui",
    photoUpdated: "Photo update ho gayi",
    photoTooLarge: "Photo 2 MB se chhoti honi chahiye",
    photoFailed: "Photo upload nahi hui",
    fillAll: "Saare fields sahi se bharo",
    saved: "Details save ho gayi ✅",
    saveFailed: "Save nahi hua",
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
    linkFailed: "Link nahi khula",
    exportContact: "Data export ke liye help se contact karo",
    settingsFailed: "Settings nahi khuli",
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
    today: "आज",
    tomorrow: "कल",
    done: "हो गया",
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
    nameLabel: "साथी को क्या बुलाएँगे?",
    namePlaceholder: "साथी",
  },
  tabs: { home: "होम", saathi: "साथी", docs: "डॉक्स", alerts: "अलर्ट", you: "आप" },
  notif: {
    reminderTitle: "साथी 🔔",
    expiryTitle: "साथी 📄",
    expiryToday: "{name} आज एक्सपायर हो रहा है।",
    expiryInDays: "{name} {n} दिन में एक्सपायर हो रहा है।",
    alertReminder: "रिमाइंडर",
    alertExpiry: "डॉक्युमेंट एक्सपायरी",
    alertOk: "ठीक है, समझ गया",
    alertDid: "क्या आपने यह कर लिया?",
    alertDone: "हाँ, हो गया",
    alertLater: "अभी नहीं",
  },
  voice: {
    recogLang: "hi-IN",
    unclear: "आवाज़ साफ़ नहीं आई, दोबारा बोलिए",
    micPermission: "माइक permission चाहिए",
    unavailable: "इस डिवाइस पर voice available नहीं है",
  },
  phoneField: {
    placeholder: "फ़ोन नंबर",
    searchPlaceholder: "देश या कोड search करें",
    close: "बंद करें",
  },
  reliability: {
    promptTitle: "रिमाइंडर समय पर आए — एक छोटा स्टेप",
    promptBody:
      "कई फ़ोन (Xiaomi, Realme, Oppo, Vivo, Samsung) ऐप बंद होने पर reminders रोक देते हैं। बैटरी सेटिंग्स में साथी को \"Unrestricted\" कर दें — फिर ऐप बंद हो तब भी reminder + आवाज़ आएगी।",
    promptButton: "बैटरी सेटिंग्स खोलें",
    promptLater: "बाद में",
    settingsRow: "रिमाइंडर भरोसेमंद बनाएँ",
    settingsRowSub: "बैटरी ऑप्टिमाइज़ेशन ऑफ़ — ऐप बंद हो तब भी reminder आए",
  },
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
      "रिवॉर्ड तब मिलेगा जब आप अपना पहला डॉक्युमेंट डालें और एक reminder सेट करें।",
    loginBtn: "लॉगिन करें",
    signupBtn: "अकाउंट बनाएँ",
    or: "या",
    google: "Google से जारी रखें",
    noAccount: "नए हैं?",
    createAccount: "अकाउंट बनाएँ",
    haveAccount: "पहले से अकाउंट है?",
    loginInstead: "लॉगिन करें",
    referralPlaceholderTpl: "दोस्त का कोड — दोनों को {d} दिन का प्लस प्लान फ्री",
    nameRequired: "अपना नाम डालें",
    badEmail: "सही ईमेल डालें",
    shortPassword: "पासवर्ड कम से कम 6 अक्षर का हो",
    confirmSent: "ईमेल पर confirmation link भेजा — चेक करें",
    welcomeNew: "आपके साथी में स्वागत है! 🎉",
    welcomeBackToast: "वापस आ गए! 🙂",
    somethingWrong: "कुछ गड़बड़ हो गई",
    googleFailed: "Google लॉगिन नहीं हुआ",
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
    todayTitle: "आज के रिमाइंडर",
    todayNone: "आज कोई रिमाइंडर नहीं 🌿",
    markDone: "हो गया",
    doneToast: "शाबाश! ✓",
    referCard: "Refer & Earn — दोनों को {d} दिन प्लस फ्री",
    referCardSub: "दोस्त को इनवाइट करें, दोनों को साथी प्लस प्लान",
    loadFailed: "डेटा लोड नहीं हो पाया",
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
    expiryExpired: "एक्सपायर हो गया",
    expiryTodayLabel: "आज एक्सपायर",
    expiryTomorrowLabel: "कल एक्सपायर",
    expiryInDaysLabel: "{n} दिन में एक्सपायर",
    noFileSaved: "इस डॉक्युमेंट की फ़ाइल सेव नहीं है।",
    share: "शेयर",
    viewAction: "देखें",
    shareFailed: "शेयर नहीं हो पाया",
    sharedN: "{n} डॉक्युमेंट शेयर हुए",
    selectAll: "सभी चुनें",
    selectCount: "{n} चुने",
    shareSelected: "शेयर ({n})",
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
    cameraPermission: "कैमरा permission चाहिए",
    ocrExpiryFound: "एक्सपायरी मिल गई",
    ocrReadTpl: "पढ़ लिया: {bits} ✨",
    ocrUnclear: "पढ़ा, पर साफ़ नहीं — details खुद डाल दें",
    ocrFailed: "फ़ोटो पढ़ने में दिक्कत — details खुद डाल दें",
    imageFailed: "इमेज सेलेक्ट नहीं हुई",
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
    askWhat: "यह रिमाइंडर किस चीज़ के लिए है?",
    askWhatPlaceholder: "जैसे: दवाई लेना, बिजली बिल भरना",
    understanding: "समझ रहा हूँ…",
    askDay: "किस दिन याद दिलाऊँ?",
    dayAfter: "परसों",
    pickDate: "तारीख़ चुनें",
    pickTime: "समय चुनें",
    pastError: "यह समय निकल चुका — आगे का समय चुनें",
    askAmPm: "सुबह या शाम?",
    otherTime: "कोई और समय",
  },
  review: {
    title: "साथी को कितने स्टार दोगे?",
    sub: "आपकी राय से साथी और बेहतर बनेगा।",
    placeholder: "कुछ कहना चाहेंगे? (ज़रूरी नहीं)",
    consent: "मैं Apka Saathi को यह रिव्यू वेबसाइट पर दिखाने की अनुमति देता हूँ",
    submit: "भेजें",
    later: "अभी नहीं",
    thanksTitle: "धन्यवाद! ❤️",
    thanksSub:
      "बहुत मायने रखता है। एक आख़िरी बात — Play Store पर एक छोटी रेटिंग से और परिवार साथी तक पहुँचते हैं। बस 10 सेकंड। 🙏",
    rateBtn: "Play Store पर रेट करें",
  },
  network: {
    offline: "इंटरनेट नहीं है — काम ऑफ़लाइन सेव हो रहा है",
    slow: "इंटरनेट धीमा है…",
    retry: "दोबारा कोशिश करें",
  },
  chat: {
    online: "आपका दोस्त · ऑनलाइन",
    greeting:
      "नमस्ते{name}! मैं आपका साथी। अपने reminders, tasks और documents के बारे में पूछ लें — मैं मदद कर दूँगा। 🙂",
    stubReply:
      "आप अपने reminder, task या document से जुड़ी चीज़ें पूछ सकते हैं। 🙂 अभी मैं बाकी सब कुछ नहीं बता सकता, पर वो बहुत जल्द आ रहा है — तब तक Documents और Reminders टैब इस्तेमाल करें!",
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
    payBtn: "{price} — सुरक्षित pay करें",
    payNote: "Google Play से सुरक्षित · UPI, card, netbanking",
    mismatchTitle: "अपना देश कन्फ़र्म करें",
    mismatchBody: "आप अभी {ip} में दिख रहे हैं, पर आपकी प्रोफ़ाइल {profile} की है। किस देश का प्राइस दिखाएँ?",
    mismatchUseIp: "{ip} का प्राइस",
    mismatchUseProfile: "{profile} का प्राइस",
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
    loginFirst: "पहले लॉगिन करें",
    noPlan: "कोई प्लान available नहीं",
    paymentFailed: "पेमेंट शुरू नहीं हुई",
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
    daysTpl: "{n} दिन",
    yourReferrals: "आपके रेफ़रल",
    invite: "इनवाइट करें",
    noReferrals: "अभी किसी ने आपके कोड से जॉइन नहीं किया।",
    referNote:
      "दिन तभी मिलते हैं जब दोस्त अपना पहला डॉक्युमेंट डाले और एक reminder सेट करे।",
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
      "आपका दोस्त आपके कोड से जॉइन करे, अपना पहला डॉक्युमेंट डाले और एक reminder सेट करे — दोनों को {d} दिन का साथी प्लस प्लान मिल जाएगा।",
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
    pending: "{x} दोस्त जॉइन तो हुए, पर अभी उन्होंने डॉक्युमेंट + reminder पूरा नहीं किया।",
    shareMessage:
      "मैं Apka Saathi इस्तेमाल करता हूँ — डॉक्युमेंट्स की एक्सपायरी और ज़रूरी काम खुद याद दिला देता है। 🙂\n\nमेरे कोड से जॉइन करें, दोनों को {d} दिन का साथी प्लस प्लान FREE:\n{link}",
    loadError: "रेफ़रल जानकारी लोड नहीं हुई",
  },
  profileDetails: {
    title: "मेरी details",
    photoHint: "फ़ोटो जोड़ें (2 MB तक)",
    fullName: "पूरा नाम",
    fullNamePlaceholder: "आपका नाम",
    email: "ईमेल",
    emailPlaceholder: "you@email.com",
    phone: "फ़ोन नंबर",
    phoneError: "सही फ़ोन नंबर डालें",
    address: "पता",
    addressPlaceholder: "घर / ऑफ़िस का पता",
    gender: "लिंग",
    male: "पुरुष",
    female: "महिला",
    other: "अन्य",
    country: "देश",
    countryPick: "देश चुनें",
    countryNoData: "डेटा इम्पोर्ट करें",
    countrySearch: "देश search करें…",
    state: "राज्य",
    statePick: "राज्य चुनें",
    stateFirst: "पहले देश",
    stateSearch: "राज्य search करें…",
    city: "शहर",
    cityPick: "शहर चुनें",
    cityFirst: "पहले राज्य",
    citySearch: "शहर search करें…",
    searchEmpty: "कुछ नहीं मिला",
    save: "सेव करें",
    loadError: "details लोड नहीं हुई",
    photoUpdated: "फ़ोटो अपडेट हो गई",
    photoTooLarge: "फ़ोटो 2 MB से छोटी होनी चाहिए",
    photoFailed: "फ़ोटो अपलोड नहीं हुई",
    fillAll: "सारे fields सही से भरें",
    saved: "details सेव हो गई ✅",
    saveFailed: "सेव नहीं हुआ",
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
    linkFailed: "लिंक नहीं खुला",
    exportContact: "डेटा एक्सपोर्ट के लिए help से संपर्क करें",
    settingsFailed: "सेटिंग्स नहीं खुलीं",
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
    today: "Today",
    tomorrow: "Tomorrow",
    done: "Done",
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
    nameLabel: "What will you call your Saathi?",
    namePlaceholder: "Saathi",
  },
  tabs: { home: "Home", saathi: "Saathi", docs: "Docs", alerts: "Alerts", you: "You" },
  notif: {
    reminderTitle: "Saathi 🔔",
    expiryTitle: "Saathi 📄",
    expiryToday: "{name} expires today.",
    expiryInDays: "{name} expires in {n} days.",
    alertReminder: "Reminder",
    alertExpiry: "Document expiry",
    alertOk: "Okay, got it",
    alertDid: "Did you do this?",
    alertDone: "Yes, done",
    alertLater: "Not yet",
  },
  voice: {
    recogLang: "en-IN",
    unclear: "Didn't catch that, please say it again",
    micPermission: "Mic permission needed",
    unavailable: "Voice isn't available on this device",
  },
  phoneField: {
    placeholder: "Phone number",
    searchPlaceholder: "Search country or code",
    close: "Close",
  },
  reliability: {
    promptTitle: "Get reminders on time — one quick step",
    promptBody:
      "Many phones (Xiaomi, Realme, Oppo, Vivo, Samsung) stop reminders when the app is closed. Set Saathi to \"Unrestricted\" in battery settings — then reminders and sound arrive even when the app is closed.",
    promptButton: "Open battery settings",
    promptLater: "Later",
    settingsRow: "Make reminders reliable",
    settingsRowSub: "Turn off battery optimization so reminders fire even when closed",
  },
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
      "You'll get the reward once you add your first document and set one reminder.",
    loginBtn: "Sign in",
    signupBtn: "Create account",
    or: "or",
    google: "Continue with Google",
    noAccount: "New here?",
    createAccount: "Create account",
    haveAccount: "Already have an account?",
    loginInstead: "Sign in",
    referralPlaceholderTpl: "Friend's code — you both get {d} days of the Plus plan free",
    nameRequired: "Enter your name",
    badEmail: "Enter a valid email",
    shortPassword: "Password must be at least 6 characters",
    confirmSent: "Sent a confirmation link to your email — please check",
    welcomeNew: "Welcome to Apka Saathi! 🎉",
    welcomeBackToast: "Welcome back! 🙂",
    somethingWrong: "Something went wrong",
    googleFailed: "Google sign-in failed",
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
    todayTitle: "Today's reminders",
    todayNone: "No reminders today 🌿",
    markDone: "Done",
    doneToast: "Well done! ✓",
    referCard: "Refer & Earn — you both get {d} days of Plus free",
    referCardSub: "Invite a friend, you both get the Saathi Plus plan",
    loadFailed: "Couldn't load your data",
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
    expiryExpired: "Expired",
    expiryTodayLabel: "Expires today",
    expiryTomorrowLabel: "Expires tomorrow",
    expiryInDaysLabel: "Expires in {n} days",
    noFileSaved: "No file saved for this document.",
    share: "Share",
    viewAction: "View",
    shareFailed: "Couldn't share",
    sharedN: "{n} document(s) shared",
    selectAll: "Select all",
    selectCount: "{n} selected",
    shareSelected: "Share ({n})",
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
    cameraPermission: "Camera permission needed",
    ocrExpiryFound: "found the expiry",
    ocrReadTpl: "Read it: {bits} ✨",
    ocrUnclear: "Read it, but it wasn't clear — please fill in the details",
    ocrFailed: "Trouble reading the photo — please fill in the details",
    imageFailed: "Couldn't select the image",
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
    askWhat: "What is this reminder for?",
    askWhatPlaceholder: "e.g. take medicine, pay electricity bill",
    understanding: "Understanding…",
    askDay: "Which day should I remind you?",
    dayAfter: "Day after",
    pickDate: "Pick a date",
    pickTime: "Pick a time",
    pastError: "That time has passed — pick a future time",
    askAmPm: "Morning or evening?",
    otherTime: "Another time",
  },
  review: {
    title: "How many stars for Saathi?",
    sub: "Your feedback helps Saathi get better.",
    placeholder: "Want to say something? (optional)",
    consent: "I allow Apka Saathi to display this review on its website",
    submit: "Send",
    later: "Not now",
    thanksTitle: "Thank you! ❤️",
    thanksSub:
      "It means a lot. One last thing — a quick rating on the Play Store helps other families find Saathi. Takes 10 seconds. 🙏",
    rateBtn: "Rate on Play Store",
  },
  network: {
    offline: "No internet — your work is saved offline",
    slow: "Slow internet…",
    retry: "Try again",
  },
  chat: {
    online: "your friend · online",
    greeting:
      "Namaste{name}! I'm your Saathi. Ask me about your reminders, tasks and documents — I'll help. 🙂",
    stubReply:
      "You can ask me about your reminders, tasks or documents. 🙂 I can't answer everything else just yet, but that's coming very soon — until then, use the Documents and Reminders tabs!",
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
    payBtn: "{price} — Pay securely",
    payNote: "Secure via Google Play · UPI, card, netbanking",
    mismatchTitle: "Confirm your country",
    mismatchBody: "You appear to be in {ip}, but your profile is set to {profile}. Which country's price should we show?",
    mismatchUseIp: "{ip} price",
    mismatchUseProfile: "{profile} price",
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
    loginFirst: "Please sign in first",
    noPlan: "No plan available",
    paymentFailed: "Couldn't start the payment",
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
    daysTpl: "{n} days",
    yourReferrals: "Your referrals",
    invite: "Invite",
    noReferrals: "Nobody has joined with your code yet.",
    referNote:
      "Days are earned only when your friend adds their first document AND sets one reminder.",
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
      "Your friend joins with your code, adds their first document and sets one reminder — you both get {d} days of the Saathi Plus plan.",
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
    pending: "{x} friend(s) joined, but haven't added a document and set a reminder yet.",
    shareMessage:
      "I use Apka Saathi — it remembers my document expiries and everything that matters. 🙂\n\nJoin with my code and we both get {d} days of the Saathi Plus plan FREE:\n{link}",
    loadError: "Couldn't load referral info",
  },
  profileDetails: {
    title: "My details",
    photoHint: "Add a photo (up to 2 MB)",
    fullName: "Full name",
    fullNamePlaceholder: "Your name",
    email: "Email",
    emailPlaceholder: "you@email.com",
    phone: "Phone number",
    phoneError: "Enter a valid phone number",
    address: "Address",
    addressPlaceholder: "Home / office address",
    gender: "Gender",
    male: "Male",
    female: "Female",
    other: "Other",
    country: "Country",
    countryPick: "Choose country",
    countryNoData: "Import data",
    countrySearch: "Search country…",
    state: "State",
    statePick: "Choose state",
    stateFirst: "Country first",
    stateSearch: "Search state…",
    city: "City",
    cityPick: "Choose city",
    cityFirst: "State first",
    citySearch: "Search city…",
    searchEmpty: "Nothing found",
    save: "Save",
    loadError: "Couldn't load details",
    photoUpdated: "Photo updated",
    photoTooLarge: "Photo must be under 2 MB",
    photoFailed: "Photo upload failed",
    fillAll: "Please fill all fields correctly",
    saved: "Details saved ✅",
    saveFailed: "Couldn't save",
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
    linkFailed: "Couldn't open the link",
    exportContact: "For a data export, please reach out via Help",
    settingsFailed: "Couldn't open settings",
  },
};

export const dictionaries: Record<Locale, Dict> = { hinglish, hi, en };
