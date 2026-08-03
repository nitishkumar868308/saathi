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
    /**
     * Document expiry follow-up ki default lines (item 18).
     * Net ho to Saathi apne shabd bhejta hai; ye tab chalti hain jab AI na aaye.
     */
    docAsk: string;
    docDone: string;
    docLater: string;
    docAddNew: string;
    docAddBtn: string;
  };
  voice: {
    /** BCP-47 tag for speech recognition, e.g. "en-IN" / "hi-IN" */
    recogLang: string;
    unclear: string;
    micPermission: string;
    unavailable: string;
    /** Aas-paas ka shor awaaz me dab gaya. */
    tooNoisy: string;
    /** Awaaz pahunchi hi nahi — bahut door se bola. */
    tooQuiet: string;
    /**
     * Button kaise chalta hai — dono tareeke ek line me.
     *
     * Ye likhna zaroori hai: hold-to-talk dikhta nahi hai, aur jo user use
     * jaanta hi nahi wo kabhi try nahi karega.
     */
    micHint: string;
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
    /* Permission modal — har step ki apni line */
    /**
     * ⚠️ `stepAllow` ("Allow") aur `stepAlarm` ("Alarms & reminders") teeno
     * bhasha me JAAN-BOOJH KE English hain — ye anuvaad ka chhoota hua kaam
     * nahi hai.
     *
     * Ye do Android ki APNI settings screen ke labels hain, jo user ko wahan
     * jaake dhoondhne hote hain. App ki bhasha phone ki bhasha se alag hoti
     * hai (bahut log app Hindi me rakhte hain aur phone English me). Inhe
     * Hindi kar dene par instruction ulta bekaar ho jaata: screen par "Allow"
     * likha hoga aur app kahegi "अनुमति दें" — user dhoondhta hi reh jayega.
     */
    stepAllow: string;
    stepDone: string;
    stepNotif: string;
    stepNotifSub: string;
    stepAlarm: string;
    stepAlarmSub: string;
    /** Android 14+ "Full screen notifications" — bade popup ki asli chaabi. */
    stepFsi: string;
    stepFsiSub: string;
    fsiSpotlight: string;
    stepBattery: string;
    stepBatterySub: string;
    stepOem: string;
    stepOemSub: string;
    allSetTitle: string;
    allSetBody: string;
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
    /** Eye icon ka accessibility label — password chhupa hua hai. */
    showPassword: string;
    /** Eye icon ka accessibility label — password dikh raha hai. */
    hidePassword: string;
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
    /**
     * Free plan wale ke brief card ka upsell.
     *
     * Card gayab nahi karte — usme aaj ki asli baat (kitne documents ko dhyan
     * chahiye) tab bhi dikhti hai. Neeche ek chhoti line batati hai ki Saathi
     * ye khud likh ke de sakta hai, agar Plus ho.
     */
    briefPlusHook: string;
    briefPlusCta: string;
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
    summaryLabel: string;
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
    /** Card ke actions — dekho / hatao / on-off. */
    viewAction: string;
    deleteAction: string;
    activeLabel: string;
    inactiveLabel: string;
    detailTitle: string;
    detailWhen: string;
    detailNote: string;
    detailStatus: string;
    deleted: string;
    /** Roz wala reminder — list card + detail sheet ki lines. */
    repeatLabel: string;
    repeatDaily: string;
    repeatWeekly: string;
    repeatMonthly: string;
    /** {n} */
    repeatEvery: string;
    /** {date} */
    repeatUntil: string;
    repeatForever: string;
    repeatOff: string;
    /** "Ho gaya" ke baad ka jawab. */
    doneToday: string;
    /**
     * Offline banaya reminder abhi server par jaana baaki hai — tab tak use
     * on/off ya "ho gaya" nahi kiya ja sakta (uski row hi nahi bani).
     */
    pendingBusy: string;
    doneAll: string;
    doneBtn: string;
    doneBtnRepeat: string;
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
    /**
     * Offline banaya reminder — alarm lag gaya, server par jaana baaki hai.
     *  se alag isliye hai ki wo "sab ho gaya" kehta hai; yahan ek kaam
     * abhi baaki hai, aur user ko wo pata hona chahiye.
     */
    setOkOffline: string;
    savedNoNotif: string;
    savedNeedPerm: string;
    limitReached: string;
    askWhat: string;
    askWhatPlaceholder: string;
    titleLabel: string;
    titleEditHint: string;
    understanding: string;
    askDay: string;
    dayAfter: string;
    pickDate: string;
    pickTime: string;
    pastError: string;
    askAmPm: string;
    otherTime: string;
    /** Roz wala reminder — Saathi ne kya samjha (item: "gym roz 6 baje 90 din tak"). */
    repeatLabel: string;
    repeatDaily: string;
    repeatWeekly: string;
    repeatMonthly: string;
    /** {n} */
    repeatEvery: string;
    /** {date} */
    repeatUntil: string;
    repeatForever: string;
    repeatOff: string;
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
    /** Net ki wajah se kaam ruka — poore app ka popup. */
    failTitle: string;
    failLoad: string;
    failSave: string;
    failAi: string;
    failHint: string;
    tryAgain: string;
    later: string;
  };
  /** App ke andar se "hume likho" form. */
  contact: {
    title: string;
    sub: string;
    nameLabel: string;
    namePlaceholder: string;
    emailLabel: string;
    emailPlaceholder: string;
    messageLabel: string;
    messagePlaceholder: string;
    send: string;
    sending: string;
    sentTitle: string;
    sentBody: string;
    needMessage: string;
    needEmail: string;
    failed: string;
    row: string;
  };
  chat: {
    online: string;
    greeting: string;
    stubReply: string;
    inputPlaceholder: string;
    suggestions: string[];
    /** Net fail hua — wahi message dobara bhejne ka button. */
    retrySend: string;
    /** AI tak baat nahi pahunchi, par local samajh se reminder ban gaya. */
    offlineReminderSet: string;
    reminderFailed: string;
    /**
     * AI ne baat to samajh li par time galat/beeta hua nikla — Add-reminder
     * screen khul rahi hai, title pehle se bhara hua.
     */
    reminderNeedsTime: string;
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
    /** Code/link ke saath copy button — tap pe clipboard me chala jaata hai. */
    copyCode: string;
    copiedCode: string;
    yourLink: string;
    copyLink: string;
    copiedLink: string;
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
    emailLocked: string;
    phone: string;
    phoneError: string;
    phoneCountryUnknown: string;
    /**
     * Phone ka SMS OTP.
     *
     * ⚠️ Verified aur non-verified me farak saaf dikhna chahiye. Number sirf
     * LIKHA hone par reminder ka WhatsApp ek digit ki galti se kisi ajnabi ke
     * paas chala jaata hai, aur asli user ko kabhi kuch nahi milta — dono me se
     * kisi ko wajah pata nahi chalti.
     */
    verifyCta: string;
    verified: string;
    verifyWhy: string;
    /** {phone} */
    otpTitle: string;
    otpSub: string;
    otpPh: string;
    otpSubmit: string;
    otpResend: string;
    /** {s} — kitne second baad dobara bhej sakte hain. */
    otpResendIn: string;
    otpSending: string;
    otpSent: string;
    otpOk: string;
    errBadNumber: string;
    errRateLimited: string;
    errTaken: string;
    errWrongCode: string;
    errExpired: string;
    errNotConfigured: string;
    errFailed: string;
    errNetwork: string;
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
    referralCodeRow: string;
    plusActive: string;
    plusLo: string;
    plusActiveSub: string;
    plusSub: string;
    groupAccount: string;
    groupSaathi: string;
    groupPrivacy: string;
    groupMore: string;
    /** Profile card par — "tap karke details badlo". */
    editProfile: string;
    saathiName: string;
    notifications: string;
    /** Alert kaise sunayi de — ring / vibrate / silent (item 6). */
    alertMode: string;
    alertModeSub: string;
    alertRing: string;
    alertRingSub: string;
    alertVibrate: string;
    alertVibrateSub: string;
    alertSilent: string;
    alertSilentSub: string;
    alertTest: string;
    language: string;
    privacy: string;
    exportData: string;
    deleteAll: string;
    /**
     * Template — `{v}` me app ka ASLI version bharta hai (expo-application se).
     *
     * ⚠️ Pehle yahan "v0.1.0" seedha likha hua tha, jabki app kab ki 1.0.0 ho
     * chuki thi. Settings me har user ko galat version dikhta tha — aur support
     * me "aapke paas kaunsa version hai?" poochhne ka koi matlab hi nahi bachta
     * tha. Hardcode karne par har release me ye dobara purana ho jaata; ab wo
     * `app.json` se khud aata hai.
     */
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
  /**
   * Support tickets — app se sawaal, admin se jawab, ek hi baatcheet me.
   *
   * ⚠️ "Contact" se alag hai: wo ek taraf ka message tha (bhej diya, aur bas).
   * Yahan har sawaal ka apna number hai, jawab app me wapas aata hai, aur
   * baatcheet chalti rehti hai.
   */
  support: {
    title: string;
    sub: string;
    newBtn: string;
    empty: string;
    emptyHint: string;
    newTitle: string;
    subjectLabel: string;
    subjectPh: string;
    messageLabel: string;
    messagePh: string;
    send: string;
    sending: string;
    /** {no} — ticket number */
    created: string;
    createdHint: string;
    stOpen: string;
    stAnswered: string;
    stClosed: string;
    replyPh: string;
    you: string;
    team: string;
    failed: string;
    setupMissing: string;
    tooShort: string;
    loading: string;
    waiting: string;
  };
  /**
   * "Ye phone kisi aur ke naam par set hai" — chetavni.
   *
   * ⚠️ Ye rok nahi hai, samjhaana hai. Login chalta rahega. Baat sirf itni hai
   * ki ek phone par Saathi ki poori taakat ek hi account ke saath chalti hai
   * (notification ka token, alarm, referral) — aur pehle ye kahin likha hi nahi
   * tha. Do log mahino tak samajh nahi paate the ki ek ke reminder kyun aana
   * band ho gaye.
   */
  deviceOwner: {
    title: string;
    /** {name} {email} */
    intro: string;
    /** {email} — jab naam pata na ho */
    introNoName: string;
    notifTitle: string;
    notifBody: string;
    aiTitle: string;
    aiBody: string;
    rewardTitle: string;
    rewardBody: string;
    advice: string;
    ok: string;
    logout: string;
    /** Login screen par chhoti si patti — login se PEHLE hi pata chal jaye. */
    bannerTitle: string;
    /** {who} — naam ya mask kiya hua email */
    bannerBody: string;
  };

  /**
   * "Aapka account aur bhi phones par login hai" — `deviceOwner` ka ULTA.
   *
   * ⚠️ `deviceOwner` ek phone par do log ki baat karta hai. Ye ek account ke
   * kai phone ki. Do alag sawaal hain, aur doosra kabhi poocha hi nahi jaata
   * tha — isliye ek hi ID se kitne bhi phone par login karo, kuch dikhta hi
   * nahi tha, jabki alarm har phone me alag lagte hain.
   */
  multiDevice: {
    title: string;
    /** {count} */
    intro: string;
    /** {count} === 1 wala roop — "ek aur phone" me ginti likhna bura lagta hai. */
    introOne: string;
    alarmTitle: string;
    alarmBody: string;
    notifTitle: string;
    notifBody: string;
    privacyTitle: string;
    privacyBody: string;
    advice: string;
    ok: string;
    /** Baaki sab phones se logout — sirf yahi phone chalu rahega. */
    logoutOthers: string;
    logoutOthersDone: string;
    logoutOthersFailed: string;
  };

  /**
   * Notes — jo baat yaad rakhni hai par jiska koi WAQT nahi.
   *
   * Reminder se fark saaf rakhna zaroori hai, warna do cheezein ek jaisi lagne
   * lagti hain: reminder ka matlab "iska ek waqt hai", note ka matlab "ye baat
   * bas bachi rehni chahiye". Pehle log bina waqt wali baat bhi ek jhoote
   * reminder me daal dete the aur wo bina matlab ke bajta rehta tha.
   */
  notes: {
    title: string;
    /** Khaali list. */
    empty: string;
    emptyHint: string;
    /** Naya note. */
    add: string;
    titlePh: string;
    bodyPh: string;
    /** Title na diya ho aur body bhi khaali ho — card par yahi dikhta hai. */
    untitled: string;
    pin: string;
    unpin: string;
    /** Note ko reminder me bhejo — Add-reminder screen khulti hai. */
    toReminder: string;
    /** Reminder me bhejne se pehle note me kuch likha hona chahiye. */
    toReminderEmpty: string;
    deleteAsk: string;
    deleted: string;
    saved: string;
    saveFailed: string;
    loadFailed: string;
    /** {n} — kitne note hain. */
    count: string;
    countOne: string;
    searchPh: string;
    searchEmpty: string;
    /**
     * Is note ka reminder ban chuka hai.
     *
     * ⚠️ Bina iske user ko kabhi pata nahi chalta tha ki reminder LAG chuka hai,
     * isliye wo aksar dobara laga deta tha aur ek hi baat ka alarm do baar
     * bajta tha.
     */
    reminderOn: string;
    /** Reminder bana to tha, par user ne use band kar diya. */
    reminderOff: string;
  };

  /**
   * App lock — biometric (fingerprint/face) + ek PIN uske peeche.
   *
   * ⚠️ PIN hamesha PEHLE set hota hai, biometric uske UPAR ek shortcut hai.
   * Sirf biometric wala lock us din bekaar ho jaata hai jab ungli na padhe ya
   * phone khud PIN maang le — aur tab user apne hi documents se bahar khada
   * reh jaata hai.
   */
  lock: {
    /** Settings me feature ka naam. */
    title: string;
    subtitle: string;
    /** Lock screen par. */
    unlockTitle: string;
    unlockSub: string;
    enterPin: string;
    wrongPin: string;
    useBiometric: string;
    biometricPrompt: string;
    /** Set/change karte waqt. */
    setTitle: string;
    setSub: string;
    confirmTitle: string;
    confirmSub: string;
    mismatch: string;
    changePin: string;
    turnOff: string;
    turnOffAsk: string;
    turnOffBody: string;
    /** Toggle rows. */
    biometricRow: string;
    biometricHint: string;
    biometricNone: string;
    savedOn: string;
    savedOff: string;
    saveFailed: string;
    /** Signup ke turant baad ek baar poochte hain. */
    offerTitle: string;
    offerBody: string;
    offerYes: string;
    offerNo: string;
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
  tabs: { home: "Home", saathi: "Saathi", docs: "Docs", alerts: "Reminders", you: "You" },
  notif: {
    reminderTitle: "🔔 Saathi ka reminder",
    expiryTitle: "📄 Saathi ka alert",
    expiryToday: "{name} aaj expire ho raha hai — abhi dekh lo. 🙂",
    expiryInDays: "{name} {n} din me expire ho raha hai. Main yaad dila raha hoon 🙂",
    alertReminder: "Reminder",
    alertExpiry: "Document expiry",
    alertOk: "Theek hai, samajh gaya",
    alertDid: "Kya aapne yeh kar liya?",
    alertDone: "Haan, ho gaya",
    alertLater: "Abhi nahi",
    docAsk: "Ye kaam ho gaya kya?",
    docDone: "Badhiya! 🎉 Ab is document ke reminder band kar diye.",
    docLater: "Koi baat nahi — main phir yaad dila dunga. 🙂",
    docAddNew: "Naye document ki photo daal do — nayi expiry main sambhal lunga.",
    docAddBtn: "Naya document daalo",
  },
  voice: {
    recogLang: "en-IN",
    unclear: "Awaaz saaf nahi aayi, dobara boliye",
    micPermission: "Mic permission chahiye",
    unavailable: "Voice available nahi hai is device pe",
    tooNoisy: "Aas-paas shor bahut hai — phone muh ke paas laakar dobara boliye",
    tooQuiet: "Awaaz nahi pahunchi — thoda paas se aur zor se boliye",
    micHint: "Mic dabaye rakho aur bolo — ya ek tap karo, phir tap se band",
  },
  phoneField: {
    placeholder: "Phone number",
    searchPlaceholder: "Country ya code search karo",
    close: "Band karo",
  },
  reliability: {
    promptTitle: "Reminder theek time pe aaye",
    promptBody:
      "In cheezon ke bina Android reminder ko der se bhejta hai — kabhi 5-10 minute baad. Ek-ek karke Allow dabao, bas ek baar ka kaam hai.",
    promptButton: "Setup karo",
    promptLater: "Baad me",
    settingsRow: "Reminders reliable banao",
    settingsRowSub: "Notification, exact alarm aur battery — sab ek jagah",
    stepAllow: "Allow",
    stepDone: "Ho gaya",
    stepNotif: "Notification allow karo",
    stepNotifSub: "Iske bina reminder dikhega hi nahi",
    stepAlarm: "Alarms & reminders",
    stepAlarmSub: "Iske bina Android reminder ko der se, dusre alarms ke saath bhejta hai",
    stepFsi: "Poori screen par alert",
    stepFsiSub:
      "Iske bina sirf upar patli si notification aayegi — screen ke beech me bada alert nahi",
    fsiSpotlight:
      "Reminder ka BADA popup poori screen par aane ke liye yahi ek cheez sabse zaroori hai. Android 14 se ye default me BAND aata hai — isliye baaki sab allow karne par bhi bada alert nahi aata.",
    stepBattery: "Background me chalne do",
    stepBatterySub: "Battery optimization off — app band ho tab bhi reminder aaye",
    stepOem: "Auto-start on karo",
    stepOemSub: "Phone ki apni setting — Saathi ko background me rehne do",
    allSetTitle: "Sab set hai 🎉",
    allSetBody: "Ab har reminder theek apne time pe aayega — app band ho ya phone lock.",
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
    showPassword: "Password dikhao",
    hidePassword: "Password chhupao",
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
    briefPlusHook: "Saathi Plus me har subah aapka apna brief — Saathi khud likh ke deta hai.",
    briefPlusCta: "Plus dekho",
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
    summaryLabel: "Saathi ne yeh padha",
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
    deleteConfirmBody: "\"{title}\" hata denge? Ye wapas nahi aayega.",
    viewAction: "Dekho",
    deleteAction: "Hatao",
    activeLabel: "Chalu",
    inactiveLabel: "Band",
    detailTitle: "Reminder",
    detailWhen: "Kab",
    detailNote: "Aapne kaha tha",
    detailStatus: "Haalat",
    deleted: "Reminder hata diya",
    repeatLabel: "Kitni baar",
    repeatDaily: "Roz",
    repeatWeekly: "Har hafte",
    repeatMonthly: "Har mahine",
    repeatEvery: "Har {n} din",
    repeatUntil: "{date} tak",
    repeatForever: "Jab tak band na karo",
    repeatOff: "Sirf ek baar",
    doneToday: "Shabaash! Aaj ka ho gaya ✅ Kal phir yaad dila dunga.",
    pendingBusy: "Ye reminder net aane par save hoga — tab tak badla nahi ja sakta. Alarm lag chuka hai.",
    doneAll: "Ho gaya! Ye reminder ab band kar diya ✅",
    doneBtn: "Ho gaya",
    doneBtnRepeat: "Aaj ka ho gaya",
  },
  addReminder: {
    title: "Naya reminder",
    whatLabel: "Kya yaad dilaun?",
    whatPlaceholder: "Jaise: kal subah 8 baje mummy ko call karna",
    micHint: "Mic dabaye rakho aur bolo (ya ek tap) — time bhi bol do, main samajh lunga",
    understood: "Samajh gaya",
    whenLabel: "Kab yaad dilaun?",
    pickDateTime: "Date & time chuno",
    change: "Badlo",
    noTimeHint: "Time text me nahi mila — upar button se date aur time chuno.",
    save: "Reminder set karo",
    askTime: "Kab yaad dilaun? Date & time chuno",
    setOk: "Reminder set ✓ Time pe yaad dila dunga",
    setOkOffline: "Reminder set ✓ Net aate hi save ho jayega",
    savedNoNotif: "Save ho gaya, par notification set nahi hui",
    savedNeedPerm: "Save ho gaya (notification permission do)",
    limitReached: "Free me 5 active reminders — unlimited ke liye Saathi Plus dekhein",
    askWhat: "Ye reminder kis cheez ke liye hai?",
    askWhatPlaceholder: "Jaise: dawai lena, bijli bill bharna",
    titleLabel: "Title",
    titleEditHint: "(edit kar sakte ho)",
    understanding: "Samajh raha hoon…",
    askDay: "Kis din yaad dilau?",
    dayAfter: "Parso",
    pickDate: "Date chuno",
    pickTime: "Time chuno",
    pastError: "Ye time nikal chuka — aage ka time chuno",
    askAmPm: "Subah ya shaam?",
    otherTime: "Koi aur time",
    repeatLabel: "Kitni baar",
    repeatDaily: "Roz",
    repeatWeekly: "Har hafte",
    repeatMonthly: "Har mahine",
    repeatEvery: "Har {n} din",
    repeatUntil: "{date} tak",
    repeatForever: "Jab tak band na karo",
    repeatOff: "Sirf ek baar",
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
    failTitle: "Internet ne saath nahi diya",
    failLoad: "Aapka data laaya nahi ja saka.",
    failSave: "Aapka kaam save nahi ho paaya.",
    failAi: "Saathi aapki baat padh nahi paaya.",
    failHint: "Ye app ki galti nahi hai — net wapas aate hi ye chal jayega.",
    tryAgain: "Dobara koshish karo",
    later: "Theek hai",
  },
  contact: {
    title: "Humein likho",
    sub: "Koi dikkat, sawaal ya sujhav — seedha humein bhejo. Hum jawab dete hain. 🤍",
    nameLabel: "Aapka naam",
    namePlaceholder: "Naam",
    emailLabel: "Email",
    emailPlaceholder: "aapka@email.com",
    messageLabel: "Baat kya hai?",
    messagePlaceholder: "Jo bhi kehna ho, yahan likho…",
    send: "Bhejo",
    sending: "Bheja ja raha hai…",
    sentTitle: "Mil gaya 🤍",
    sentBody: "Aapka message hum tak pahunch gaya. Jald jawab denge.",
    needMessage: "Pehle message likho",
    needEmail: "Sahi email daalo",
    failed: "Message bhej nahi paaye",
    row: "Humein likho",
  },
  chat: {
    online: "aapka dost · online",
    greeting:
      "Namaste{name}! Main aapka Saathi. Apne reminders, tasks aur documents ke baare me pooch lo — main madad kar dunga. 🙂",
    stubReply:
      "Aap apne reminder, task ya document se judi cheezein pooch sakte ho. 🙂 Abhi main baaki sab kuch nahi bata sakta, par wo bahut jald aa raha hai — tab tak Documents aur Reminders tabs use karo!",
    inputPlaceholder: "Kuch likho…",
    suggestions: ["Kal 8 baje uthana", "Insurance kab expire hai?", "Aaj kya karna hai?"],
    retrySend: "Dobara bhejo",
    offlineReminderSet: "Net nahi tha, par maine reminder laga diya",
    reminderFailed: "Reminder ban nahi paaya",
    reminderNeedsTime: "Time thoda check kar lo — bas ek tap me set ho jayega",
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
    mismatchBody: "Aapka internet {ip} ka lag raha hai, par aapka phone {profile} ka. Kaunse desh ka price dikhaayein?\n\nDhyan rahe: paisa hamesha aapke Google Play account wale desh se hi katta hai.",
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
    copyCode: "Code copy karo",
    copiedCode: "Code copy ho gaya 👍",
    yourLink: "Aapka invite link",
    copyLink: "Link copy karo",
    copiedLink: "Link copy ho gaya 👍",
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
    emailLocked: "Ye aapke login ka email hai — badla nahi ja sakta.",
    phone: "Phone number",
    phoneError: "Sahi phone number daalo",
    phoneCountryUnknown: "Is desh ka code nahi mila — code khud chun lo.",
    verifyCta: "Verify karo",
    verified: "Verified",
    verifyWhy:
      "Number verify karne par hi reminder ka WhatsApp aap tak pahunchega. Ek digit ki galti se wo kisi aur ke paas chala jaata hai.",
    otpTitle: "{phone} par code bheja hai",
    otpSub: "SMS me 6 ank ka code aaya hoga. Wahi yahan daal do.",
    otpPh: "6 ank ka code",
    otpSubmit: "Confirm karo",
    otpResend: "Dobara bhejo",
    otpResendIn: "Dobara bhejo ({s}s)",
    otpSending: "Bhej rahe hain…",
    otpSent: "Code bhej diya",
    otpOk: "Number verify ho gaya ✓",
    errBadNumber: "Ye number sahi nahi lag raha. Ek baar dekh lo.",
    errRateLimited: "Bahut baar koshish ho chuki. Thodi der baad dobara.",
    errTaken: "Ye number pehle se kisi aur account me verified hai.",
    errWrongCode: "Code galat hai. Dobara dekho.",
    errExpired: "Code purana ho gaya. Naya bhejo.",
    errNotConfigured: "SMS abhi chalu nahi hua hai. Thodi der baad koshish karo.",
    errFailed: "Nahi ho paya. Thodi der baad dobara koshish karo.",
    errNetwork: "Net nahi mila. Connection check karke dobara koshish karo.",
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
    referralCodeRow: "Referral code daalein",
    plusActive: "Saathi Plus — active",
    plusLo: "Saathi Plus",
    plusActiveSub: "Unlimited reminders, documents aur AI",
    plusSub: "Unlimited reminders, documents aur AI",
    groupAccount: "Account",
    groupSaathi: "Saathi",
    groupPrivacy: "Privacy",
    groupMore: "Aur",
    editProfile: "Details badlo",
    saathiName: "Saathi ka naam",
    notifications: "Notifications",
    alertMode: "Alert ki awaaz",
    alertModeSub: "Saathi ka popup kaise sunayi de",
    alertRing: "Awaaz + vibrate",
    alertRingSub: "Saathi aapka naam le ke bolega, saath me vibrate bhi",
    alertVibrate: "Sirf vibrate",
    alertVibrateSub: "Koi awaaz nahi — bas halka sa vibrate",
    alertSilent: "Chup",
    alertSilentSub: "Na awaaz, na vibrate — sirf screen par dikhega",
    alertTest: "Sun ke dekho",
    language: "Bhasha",
    privacy: "Privacy & data",
    exportData: "Mera data export karo",
    deleteAll: "Sab data delete",
    help: "Help & support",
    about: "About Us",
    logout: "Logout",
    version: "Apka Saathi · v{v} · Made in India",
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
  support: {
    title: "Support",
    sub: "Koi dikkat ya sawaal? Yahan likho — har baat ka apna number milta hai aur jawab isi jagah aata hai.",
    newBtn: "Naya sawaal",
    empty: "Abhi koi ticket nahi",
    emptyHint: "Kuch bhi poochho — dikkat, sujhav, ya bas ek sawaal. Hum jawab denge.",
    newTitle: "Apni baat likhiye",
    subjectLabel: "Kis baare me",
    subjectPh: "Jaise: Reminder time par nahi aa raha",
    messageLabel: "Poori baat",
    messagePh: "Jitna detail me likhoge, utna jaldi hal nikalega.",
    send: "Bhejo",
    sending: "Bhej rahe hain…",
    created: "Ticket ban gaya — {no}",
    createdHint: "Ye number yaad rakhiye. Jawab yahan bhi aayega, email par bhi, aur phone par notification bhi.",
    stOpen: "Jawab ka intezaar",
    stAnswered: "Jawab aa gaya",
    stClosed: "Band",
    replyPh: "Aur kuch kehna hai?",
    you: "Aap",
    team: "Saathi team",
    failed: "Bheja nahi ja saka. Net check karke dobara koshish karo.",
    setupMissing: "Support abhi chalu nahi hua hai. Thodi der baad koshish kijiye.",
    tooShort: "Thoda aur likhiye — kam se kam kuch shabd.",
    loading: "Aa raha hai…",
    waiting: "Hum aapki baat padh rahe hain — jawab jald aayega.",
  },
  deviceOwner: {
    title: "Ye phone kisi aur ke naam par set hai",
    intro:
      "Saathi me ye phone {name} ({email}) ke liye set hai. Aap apni ID se login kar sakte ho — koi rok nahi. Par ek baat pehle jaan lo, kyunki baad me pata chalne par dono ka nuksaan hota hai.",
    introNoName:
      "Saathi me ye phone {email} ke liye set hai. Aap apni ID se login kar sakte ho — koi rok nahi. Par ek baat pehle jaan lo, kyunki baad me pata chalne par dono ka nuksaan hota hai.",
    notifTitle: "Notification ek waqt me ek hi ID ki",
    notifBody:
      "Phone ka pata (token) ek samay me ek hi account se juda rehta hai. Aap login karoge to unke reminder ki notification is phone par aani band ho jayegi — aur aap logout karoge to aapki. Dono ek saath kabhi nahi chal sakti.",
    aiTitle: "AI sirf usi ka data dekhta hai jo abhi login hai",
    aiBody:
      "Chat, document scan aur reminder samajhne wala Saathi aapke apne documents aur reminders par chalta hai. Is phone par jo pehle se rakha hai wo aapko nahi dikhega, aur aapka unhe nahi.",
    rewardTitle: "Referral ka inaam ek phone par ek hi baar",
    rewardBody:
      "Ek device se refer ka reward sirf ek baar milta hai. Is phone par wo pehle hi liya ja chuka ho sakta hai — us soorat me aapko wo nahi milega, chahe code sahi ho.",
    advice:
      "Sabse achha yahi hai: apne phone par apni ID se login karo. Tabhi notification, AI aur baaki sab poori tarah aapke liye chalega.",
    ok: "Samajh gaya, phir bhi chalu rakho",
    logout: "Logout karo",
    bannerTitle: "Ye phone pehle se set hai",
    bannerBody:
      "{who} ke liye. Doosri ID se login karoge to notification aur AI unke liye band ho jayenge — tap karke poori baat padho.",
  },
  multiDevice: {
    title: "Aapki ID aur phones par bhi login hai",
    intro:
      "Aapka account is phone ke alawa {count} aur phones par login hai. Koi rok nahi hai — par ek baat jaan lena zaroori hai, warna aage chal ke lagega ki app kharab hai.",
    introOne:
      "Aapka account is phone ke alawa ek aur phone par bhi login hai. Koi rok nahi hai — par ek baat jaan lena zaroori hai, warna aage chal ke lagega ki app kharab hai.",
    alarmTitle: "Reminder ka alarm har phone me alag lagta hai",
    alarmBody:
      "Alarm phone ke andar set hota hai, server par nahi. Aapne yahan reminder ka time badla, to doosre phone par purana alarm tab tak wahi rahega jab tak wahan app khol nahi lete. Isi wajah se ek hi reminder do alag waqt par baj sakta hai.",
    notifTitle: "Ek hi message har phone par jaayega",
    notifBody:
      "Reminder aur Saathi ke message aapke har logged-in phone par pahunchte hain. Do phone hain to do baar aayega — ye galti nahi hai, bas dono phone aapke naam par darj hain.",
    privacyTitle: "Aapke documents har us phone par khule hain",
    privacyBody:
      "Jo phone login hai, uspar aapke saare documents aur reminders dikhte hain. Koi phone aapke paas nahi hai (ghar ka purana phone, bech diya hua phone) to use abhi hata dena behtar hai.",
    advice:
      "Jo phone ab aap use nahi karte, unhe yahin se logout kar do. Yahi phone chalta rahega — aapko dobara login nahi karna padega.",
    ok: "Theek hai, rehne do",
    logoutOthers: "Baaki sab phones se logout karo",
    logoutOthersDone: "Ho gaya — ab sirf yahi phone login hai.",
    logoutOthersFailed: "Nahi ho paya. Net check karke dobara koshish karo.",
  },
  notes: {
    title: "Notes",
    empty: "Abhi koi note nahi",
    emptyHint:
      "Bazaar ka saamaan, koi idea, gaadi ka number — jo baat yaad rakhni hai par jiska koi time nahi, wo yahan likh lo.",
    add: "Naya note",
    titlePh: "Title (chaho to)",
    bodyPh: "Jo likhna hai likho…",
    untitled: "Bina naam ka note",
    pin: "Upar rakho",
    unpin: "Upar se hatao",
    toReminder: "Reminder me daalo",
    toReminderEmpty: "Pehle kuch likho, phir reminder me daal sakte ho.",
    deleteAsk: "Ye note delete kar dein?",
    deleted: "Note delete ho gaya",
    saved: "Note save ho gaya ✓",
    saveFailed: "Note save nahi ho paaya",
    loadFailed: "Notes aa nahi paaye",
    count: "{n} notes",
    countOne: "1 note",
    searchPh: "Notes me dhoondho",
    searchEmpty: "Is naam ka koi note nahi mila",
    reminderOn: "Reminder laga hai",
    reminderOff: "Reminder band hai",
  },
  lock: {
    title: "App lock",
    subtitle: "Fingerprint/face ya PIN ke bina Saathi na khule",
    unlockTitle: "Saathi lock hai",
    unlockSub: "Kholne ke liye apna PIN daalo",
    enterPin: "PIN daalo",
    wrongPin: "PIN galat hai",
    useBiometric: "Fingerprint/face se kholo",
    biometricPrompt: "Saathi kholne ke liye",
    setTitle: "Naya PIN banao",
    setSub: "4 ank ka PIN. Yahi Saathi kholne ke kaam aayega.",
    confirmTitle: "Wahi PIN dobara",
    confirmSub: "Pakka karne ke liye ek baar aur daal do.",
    mismatch: "Dono PIN alag hain. Dobara koshish karo.",
    changePin: "PIN badlo",
    turnOff: "App lock band karo",
    turnOffAsk: "App lock band kar dein?",
    turnOffBody: "Uske baad Saathi bina PIN ke khulega — is phone par jo bhi hai, aapke documents dekh sakta hai.",
    biometricRow: "Fingerprint / face se kholo",
    biometricHint: "PIN phir bhi rahega — jab ungli na padhe tab wahi kaam aayega.",
    biometricNone: "Is phone me fingerprint/face set nahi hai.",
    savedOn: "App lock chalu ✓",
    savedOff: "App lock band",
    saveFailed: "Nahi ho paya. Dobara koshish karo.",
    offerTitle: "Saathi ko lock kar lo?",
    offerBody:
      "Aapke documents is phone me rakhe hain. Ek PIN laga do — phone kisi aur ke haath lage to bhi wo unhe nahi khol payega. Fingerprint/face bhi laga sakte ho.",
    offerYes: "Haan, lock lagao",
    offerNo: "Abhi nahi",
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
  tabs: { home: "होम", saathi: "साथी", docs: "डॉक्स", alerts: "रिमाइंडर", you: "आप" },
  notif: {
    reminderTitle: "🔔 साथी का रिमाइंडर",
    expiryTitle: "📄 साथी का अलर्ट",
    expiryToday: "{name} आज एक्सपायर हो रहा है — अभी देख लो। 🙂",
    expiryInDays: "{name} {n} दिन में एक्सपायर हो रहा है। मैं याद दिला रहा हूँ 🙂",
    alertReminder: "रिमाइंडर",
    alertExpiry: "डॉक्युमेंट एक्सपायरी",
    alertOk: "ठीक है, समझ गया",
    alertDid: "क्या आपने यह कर लिया?",
    alertDone: "हाँ, हो गया",
    alertLater: "अभी नहीं",
    docAsk: "यह काम हो गया क्या?",
    docDone: "बढ़िया! 🎉 अब इस डॉक्युमेंट के रिमाइंडर बंद कर दिए।",
    docLater: "कोई बात नहीं — मैं फिर याद दिला दूँगा। 🙂",
    docAddNew: "नए डॉक्युमेंट की फ़ोटो डाल दें — नई एक्सपायरी मैं सँभाल लूँगा।",
    docAddBtn: "नया डॉक्युमेंट डालें",
  },
  voice: {
    recogLang: "hi-IN",
    unclear: "आवाज़ साफ़ नहीं आई, दोबारा बोलिए",
    micPermission: "माइक permission चाहिए",
    unavailable: "इस डिवाइस पर voice available नहीं है",
    tooNoisy: "आस-पास बहुत शोर है — फ़ोन मुँह के पास लाकर दोबारा बोलिए",
    tooQuiet: "आवाज़ नहीं पहुँची — थोड़ा पास से और ज़ोर से बोलिए",
    micHint: "माइक दबाए रखें और बोलें — या एक टैप करें, फिर टैप से बंद",
  },
  phoneField: {
    placeholder: "फ़ोन नंबर",
    searchPlaceholder: "देश या कोड search करें",
    close: "बंद करें",
  },
  reliability: {
    promptTitle: "रिमाइंडर ठीक समय पर आए",
    promptBody:
      "इनके बिना Android रिमाइंडर देर से भेजता है — कभी 5-10 मिनट बाद। एक-एक करके Allow दबाएँ, बस एक बार का काम है।",
    promptButton: "सेटअप करें",
    promptLater: "बाद में",
    settingsRow: "रिमाइंडर भरोसेमंद बनाएँ",
    settingsRowSub: "नोटिफ़िकेशन, exact alarm और बैटरी — सब एक जगह",
    stepAllow: "Allow",
    stepDone: "हो गया",
    stepNotif: "नोटिफ़िकेशन allow करें",
    stepNotifSub: "इसके बिना रिमाइंडर दिखेगा ही नहीं",
    stepAlarm: "Alarms & reminders",
    stepAlarmSub: "इसके बिना Android रिमाइंडर को देर से, दूसरे alarms के साथ भेजता है",
    stepFsi: "पूरी स्क्रीन पर अलर्ट",
    stepFsiSub:
      "इसके बिना सिर्फ़ ऊपर पतली सी नोटिफ़िकेशन आएगी — स्क्रीन के बीच में बड़ा अलर्ट नहीं",
    fsiSpotlight:
      "रिमाइंडर का बड़ा पॉपअप पूरी स्क्रीन पर आने के लिए यही एक चीज़ सबसे ज़रूरी है। Android 14 से यह डिफ़ॉल्ट में बंद आता है — इसलिए बाकी सब allow करने पर भी बड़ा अलर्ट नहीं आता।",
    stepBattery: "बैकग्राउंड में चलने दें",
    stepBatterySub: "बैटरी ऑप्टिमाइज़ेशन ऑफ़ — ऐप बंद हो तब भी रिमाइंडर आए",
    stepOem: "ऑटो-स्टार्ट ऑन करें",
    stepOemSub: "फ़ोन की अपनी सेटिंग — साथी को बैकग्राउंड में रहने दें",
    allSetTitle: "सब सेट है 🎉",
    allSetBody: "अब हर रिमाइंडर ठीक अपने समय पर आएगा — ऐप बंद हो या फ़ोन लॉक।",
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
    showPassword: "पासवर्ड दिखाएँ",
    hidePassword: "पासवर्ड छुपाएँ",
    referralCode: "रेफ़रल कोड",
    referralOptional: "वैकल्पिक",
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
    briefPlusHook: "साथी प्लस में हर सुबह आपका अपना ब्रीफ़ — साथी खुद लिखकर देता है।",
    briefPlusCta: "प्लस देखें",
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
    summaryLabel: "साथी ने यह पढ़ा",
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
    deleteConfirmBody: "\"{title}\" हटा दें? यह वापस नहीं आएगा।",
    viewAction: "देखें",
    deleteAction: "हटाएँ",
    activeLabel: "चालू",
    inactiveLabel: "बंद",
    detailTitle: "रिमाइंडर",
    detailWhen: "कब",
    detailNote: "आपने कहा था",
    detailStatus: "हालत",
    deleted: "रिमाइंडर हटा दिया",
    repeatLabel: "कितनी बार",
    repeatDaily: "रोज़",
    repeatWeekly: "हर हफ़्ते",
    repeatMonthly: "हर महीने",
    repeatEvery: "हर {n} दिन",
    repeatUntil: "{date} तक",
    repeatForever: "जब तक बंद न करें",
    repeatOff: "सिर्फ़ एक बार",
    doneToday: "शाबाश! आज का हो गया ✅ कल फिर याद दिला दूँगा।",
    pendingBusy: "यह रिमाइंडर नेट आने पर सेव होगा — तब तक बदला नहीं जा सकता। अलार्म लग चुका है।",
    doneAll: "हो गया! ये रिमाइंडर अब बंद कर दिया ✅",
    doneBtn: "हो गया",
    doneBtnRepeat: "आज का हो गया",
  },
  addReminder: {
    title: "नया रिमाइंडर",
    whatLabel: "क्या याद दिलाऊँ?",
    whatPlaceholder: "जैसे: कल सुबह 8 बजे मम्मी को कॉल करना",
    micHint: "माइक दबाए रखें और बोलें (या एक टैप) — टाइम भी बोल दें, मैं समझ लूँगा",
    understood: "समझ गया",
    whenLabel: "कब याद दिलाऊँ?",
    pickDateTime: "डेट & टाइम चुनें",
    change: "बदलें",
    noTimeHint: "टाइम टेक्स्ट में नहीं मिला — ऊपर बटन से डेट और टाइम चुनें।",
    save: "रिमाइंडर सेट करें",
    askTime: "कब याद दिलाऊँ? डेट & टाइम चुनें",
    setOk: "रिमाइंडर सेट ✓ समय पर याद दिला दूँगा",
    setOkOffline: "रिमाइंडर सेट ✓ नेट आते ही सेव हो जाएगा",
    savedNoNotif: "सेव हो गया, पर notification सेट नहीं हुई",
    savedNeedPerm: "सेव हो गया (notification permission दें)",
    limitReached: "फ्री में 5 active रिमाइंडर — अनलिमिटेड के लिए साथी प्लस देखें",
    askWhat: "यह रिमाइंडर किस चीज़ के लिए है?",
    askWhatPlaceholder: "जैसे: दवाई लेना, बिजली बिल भरना",
    titleLabel: "टाइटल",
    titleEditHint: "(बदल सकते हैं)",
    understanding: "समझ रहा हूँ…",
    askDay: "किस दिन याद दिलाऊँ?",
    dayAfter: "परसों",
    pickDate: "तारीख़ चुनें",
    pickTime: "समय चुनें",
    pastError: "यह समय निकल चुका — आगे का समय चुनें",
    askAmPm: "सुबह या शाम?",
    otherTime: "कोई और समय",
    repeatLabel: "कितनी बार",
    repeatDaily: "रोज़",
    repeatWeekly: "हर हफ़्ते",
    repeatMonthly: "हर महीने",
    repeatEvery: "हर {n} दिन",
    repeatUntil: "{date} तक",
    repeatForever: "जब तक बंद न करें",
    repeatOff: "सिर्फ़ एक बार",
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
    failTitle: "इंटरनेट ने साथ नहीं दिया",
    failLoad: "आपका डेटा लाया नहीं जा सका।",
    failSave: "आपका काम सेव नहीं हो पाया।",
    failAi: "साथी आपकी बात पढ़ नहीं पाया।",
    failHint: "यह ऐप की ग़लती नहीं है — नेट वापस आते ही यह चल जाएगा।",
    tryAgain: "दोबारा कोशिश करें",
    later: "ठीक है",
  },
  contact: {
    title: "हमें लिखें",
    sub: "कोई दिक्कत, सवाल या सुझाव — सीधे हमें भेजें। हम जवाब देते हैं। 🤍",
    nameLabel: "आपका नाम",
    namePlaceholder: "नाम",
    emailLabel: "ईमेल",
    emailPlaceholder: "aapka@email.com",
    messageLabel: "बात क्या है?",
    messagePlaceholder: "जो भी कहना हो, यहाँ लिखें…",
    send: "भेजें",
    sending: "भेजा जा रहा है…",
    sentTitle: "मिल गया 🤍",
    sentBody: "आपका मैसेज हम तक पहुँच गया। जल्द जवाब देंगे।",
    needMessage: "पहले मैसेज लिखें",
    needEmail: "सही ईमेल डालें",
    failed: "मैसेज भेज नहीं पाए",
    row: "हमें लिखें",
  },
  chat: {
    online: "आपका दोस्त · ऑनलाइन",
    greeting:
      "नमस्ते{name}! मैं आपका साथी। अपने reminders, tasks और documents के बारे में पूछ लें — मैं मदद कर दूँगा। 🙂",
    stubReply:
      "आप अपने reminder, task या document से जुड़ी चीज़ें पूछ सकते हैं। 🙂 अभी मैं बाकी सब कुछ नहीं बता सकता, पर वो बहुत जल्द आ रहा है — तब तक Documents और Reminders टैब इस्तेमाल करें!",
    inputPlaceholder: "कुछ लिखें…",
    suggestions: ["कल 8 बजे उठाना", "इंश्योरेंस कब एक्सपायर है?", "आज क्या करना है?"],
    retrySend: "दोबारा भेजें",
    offlineReminderSet: "नेट नहीं था, फिर भी मैंने रिमाइंडर लगा दिया",
    reminderFailed: "रिमाइंडर बन नहीं पाया",
    reminderNeedsTime: "समय एक बार देख लीजिए — बस एक टैप में सेट हो जाएगा",
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
    mismatchBody: "आपका इंटरनेट {ip} का लग रहा है, पर आपका फ़ोन {profile} का। किस देश का प्राइस दिखाएँ?\n\nध्यान रहे: पैसा हमेशा आपके Google Play अकाउंट वाले देश से ही कटता है।",
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
    title: "रेफ़र करें और पाएँ",
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
    copyCode: "कोड कॉपी करें",
    copiedCode: "कोड कॉपी हो गया 👍",
    yourLink: "आपका इनवाइट लिंक",
    copyLink: "लिंक कॉपी करें",
    copiedLink: "लिंक कॉपी हो गया 👍",
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
    emailLocked: "यह आपके लॉगिन का ईमेल है — इसे बदला नहीं जा सकता।",
    phone: "फ़ोन नंबर",
    phoneError: "सही फ़ोन नंबर डालें",
    phoneCountryUnknown: "इस देश का कोड नहीं मिला — कोड खुद चुन लें।",
    verifyCta: "वेरिफ़ाई करें",
    verified: "वेरिफ़ाइड",
    verifyWhy:
      "नंबर वेरिफ़ाई होने पर ही रिमाइंडर का WhatsApp आप तक पहुँचेगा। एक अंक की ग़लती से वह किसी और के पास चला जाता है।",
    otpTitle: "{phone} पर कोड भेजा है",
    otpSub: "SMS में 6 अंक का कोड आया होगा। वही यहाँ डाल दीजिए।",
    otpPh: "6 अंक का कोड",
    otpSubmit: "कन्फ़र्म करें",
    otpResend: "दोबारा भेजें",
    otpResendIn: "दोबारा भेजें ({s}s)",
    otpSending: "भेज रहे हैं…",
    otpSent: "कोड भेज दिया",
    otpOk: "नंबर वेरिफ़ाई हो गया ✓",
    errBadNumber: "यह नंबर सही नहीं लग रहा। एक बार देख लीजिए।",
    errRateLimited: "बहुत बार कोशिश हो चुकी है। थोड़ी देर बाद दोबारा।",
    errTaken: "यह नंबर पहले से किसी और अकाउंट में वेरिफ़ाइड है।",
    errWrongCode: "कोड ग़लत है। दोबारा देखिए।",
    errExpired: "कोड पुराना हो गया। नया भेजिए।",
    errNotConfigured: "SMS अभी चालू नहीं हुआ है। थोड़ी देर बाद कोशिश कीजिए।",
    errFailed: "नहीं हो पाया। थोड़ी देर बाद दोबारा कोशिश कीजिए।",
    errNetwork: "नेट नहीं मिला। कनेक्शन देखकर दोबारा कोशिश कीजिए।",
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
    referralCodeRow: "रेफरल कोड डालें",
    plusActive: "साथी प्लस — active",
    plusLo: "साथी प्लस",
    plusActiveSub: "अनलिमिटेड रिमाइंडर, डॉक्युमेंट और AI",
    plusSub: "अनलिमिटेड रिमाइंडर, डॉक्युमेंट और AI",
    groupAccount: "अकाउंट",
    editProfile: "डिटेल्स बदलें",
    groupSaathi: "साथी",
    groupPrivacy: "प्राइवेसी",
    groupMore: "और",
    saathiName: "साथी का नाम",
    notifications: "नोटिफ़िकेशन",
    alertMode: "अलर्ट की आवाज़",
    alertModeSub: "साथी का पॉपअप कैसे सुनाई दे",
    alertRing: "आवाज़ + वाइब्रेट",
    alertRingSub: "साथी आपका नाम लेकर बोलेगा, साथ में वाइब्रेट भी",
    alertVibrate: "सिर्फ़ वाइब्रेट",
    alertVibrateSub: "कोई आवाज़ नहीं — बस हल्का सा वाइब्रेट",
    alertSilent: "चुप",
    alertSilentSub: "न आवाज़, न वाइब्रेट — सिर्फ़ स्क्रीन पर दिखेगा",
    alertTest: "सुनकर देखें",
    language: "भाषा",
    privacy: "प्राइवेसी & डेटा",
    exportData: "मेरा डेटा export करें",
    deleteAll: "सब डेटा डिलीट",
    help: "हेल्प & support",
    about: "हमारे बारे में",
    logout: "लॉगआउट",
    version: "Apka Saathi · v{v} · Made in India",
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
  support: {
    title: "सपोर्ट",
    sub: "कोई दिक़्क़त या सवाल? यहाँ लिखिए — हर बात का अपना नंबर मिलता है और जवाब इसी जगह आता है।",
    newBtn: "नया सवाल",
    empty: "अभी कोई टिकट नहीं",
    emptyHint: "कुछ भी पूछिए — दिक़्क़त, सुझाव, या बस एक सवाल। हम जवाब देंगे।",
    newTitle: "अपनी बात लिखिए",
    subjectLabel: "किस बारे में",
    subjectPh: "जैसे: रिमाइंडर समय पर नहीं आ रहा",
    messageLabel: "पूरी बात",
    messagePh: "जितना विस्तार से लिखेंगे, उतनी जल्दी हल निकलेगा।",
    send: "भेजें",
    sending: "भेज रहे हैं…",
    created: "टिकट बन गया — {no}",
    createdHint: "यह नंबर याद रखिए। जवाब यहाँ भी आएगा, ईमेल पर भी, और फ़ोन पर नोटिफ़िकेशन भी।",
    stOpen: "जवाब का इंतज़ार",
    stAnswered: "जवाब आ गया",
    stClosed: "बंद",
    replyPh: "और कुछ कहना है?",
    you: "आप",
    team: "साथी टीम",
    failed: "भेजा नहीं जा सका। नेट देखकर दोबारा कोशिश करें।",
    setupMissing: "सपोर्ट अभी चालू नहीं हुआ है। थोड़ी देर बाद कोशिश कीजिए।",
    tooShort: "थोड़ा और लिखिए — कम से कम कुछ शब्द।",
    loading: "आ रहा है…",
    waiting: "हम आपकी बात पढ़ रहे हैं — जवाब जल्द आएगा।",
  },
  deviceOwner: {
    title: "यह फ़ोन किसी और के नाम पर सेट है",
    intro:
      "साथी में यह फ़ोन {name} ({email}) के लिए सेट है। आप अपनी ID से लॉगिन कर सकते हैं — कोई रोक नहीं। पर एक बात पहले जान लीजिए, क्योंकि बाद में पता चलने पर नुक़सान दोनों का होता है।",
    introNoName:
      "साथी में यह फ़ोन {email} के लिए सेट है। आप अपनी ID से लॉगिन कर सकते हैं — कोई रोक नहीं। पर एक बात पहले जान लीजिए, क्योंकि बाद में पता चलने पर नुक़सान दोनों का होता है।",
    notifTitle: "नोटिफ़िकेशन एक समय में एक ही ID की",
    notifBody:
      "फ़ोन का पता (टोकन) एक समय में एक ही अकाउंट से जुड़ा रहता है। आप लॉगिन करेंगे तो उनके रिमाइंडर की नोटिफ़िकेशन इस फ़ोन पर आनी बंद हो जाएगी — और आप लॉगआउट करेंगे तो आपकी। दोनों एक साथ कभी नहीं चल सकतीं।",
    aiTitle: "AI सिर्फ़ उसी का डेटा देखता है जो अभी लॉगिन है",
    aiBody:
      "चैट, डॉक्यूमेंट स्कैन और रिमाइंडर समझने वाला साथी आपके अपने डॉक्यूमेंट और रिमाइंडर पर चलता है। इस फ़ोन में जो पहले से रखा है वह आपको नहीं दिखेगा, और आपका उन्हें नहीं।",
    rewardTitle: "रेफ़रल का इनाम एक फ़ोन पर एक ही बार",
    rewardBody:
      "एक डिवाइस से रेफ़र का इनाम सिर्फ़ एक बार मिलता है। इस फ़ोन पर वह पहले ही लिया जा चुका हो सकता है — तब आपको वह नहीं मिलेगा, चाहे कोड सही हो।",
    advice:
      "सबसे अच्छा यही है: अपने फ़ोन पर अपनी ID से लॉगिन कीजिए। तभी नोटिफ़िकेशन, AI और बाक़ी सब पूरी तरह आपके लिए चलेगा।",
    ok: "समझ गया, फिर भी चालू रखें",
    logout: "लॉगआउट करें",
    bannerTitle: "यह फ़ोन पहले से सेट है",
    bannerBody:
      "{who} के लिए। दूसरी ID से लॉगिन करेंगे तो नोटिफ़िकेशन और AI उनके लिए बंद हो जाएँगे — टैप करके पूरी बात पढ़िए।",
  },
  multiDevice: {
    title: "आपकी ID और फ़ोनों पर भी लॉगिन है",
    intro:
      "आपका अकाउंट इस फ़ोन के अलावा {count} और फ़ोनों पर लॉगिन है। कोई रोक नहीं है — पर एक बात जान लेना ज़रूरी है, वरना आगे चलकर लगेगा कि ऐप ख़राब है।",
    introOne:
      "आपका अकाउंट इस फ़ोन के अलावा एक और फ़ोन पर भी लॉगिन है। कोई रोक नहीं है — पर एक बात जान लेना ज़रूरी है, वरना आगे चलकर लगेगा कि ऐप ख़राब है।",
    alarmTitle: "रिमाइंडर का अलार्म हर फ़ोन में अलग लगता है",
    alarmBody:
      "अलार्म फ़ोन के अंदर सेट होता है, सर्वर पर नहीं। आपने यहाँ रिमाइंडर का समय बदला, तो दूसरे फ़ोन पर पुराना अलार्म तब तक वैसा ही रहेगा जब तक वहाँ ऐप खोल न लें। इसी वजह से एक ही रिमाइंडर दो अलग समय पर बज सकता है।",
    notifTitle: "एक ही मैसेज हर फ़ोन पर जाएगा",
    notifBody:
      "रिमाइंडर और साथी के मैसेज आपके हर लॉगिन फ़ोन पर पहुँचते हैं। दो फ़ोन हैं तो दो बार आएगा — यह ग़लती नहीं है, बस दोनों फ़ोन आपके नाम पर दर्ज हैं।",
    privacyTitle: "आपके डॉक्यूमेंट हर उस फ़ोन पर खुले हैं",
    privacyBody:
      "जो फ़ोन लॉगिन है, उस पर आपके सारे डॉक्यूमेंट और रिमाइंडर दिखते हैं। कोई फ़ोन आपके पास नहीं है (घर का पुराना फ़ोन, बेचा हुआ फ़ोन) तो उसे अभी हटा देना बेहतर है।",
    advice:
      "जो फ़ोन अब आप इस्तेमाल नहीं करते, उन्हें यहीं से लॉगआउट कर दीजिए। यही फ़ोन चलता रहेगा — आपको दोबारा लॉगिन नहीं करना पड़ेगा।",
    ok: "ठीक है, रहने दीजिए",
    logoutOthers: "बाक़ी सब फ़ोनों से लॉगआउट करें",
    logoutOthersDone: "हो गया — अब सिर्फ़ यही फ़ोन लॉगिन है।",
    logoutOthersFailed: "नहीं हो पाया। नेट देखकर दोबारा कोशिश कीजिए।",
  },
  notes: {
    title: "नोट्स",
    empty: "अभी कोई नोट नहीं",
    emptyHint:
      "बाज़ार का सामान, कोई आइडिया, गाड़ी का नंबर — जो बात याद रखनी है पर जिसका कोई समय नहीं, वह यहाँ लिख लीजिए।",
    add: "नया नोट",
    titlePh: "टाइटल (चाहें तो)",
    bodyPh: "जो लिखना है लिखिए…",
    untitled: "बिना नाम का नोट",
    pin: "ऊपर रखें",
    unpin: "ऊपर से हटाएँ",
    toReminder: "रिमाइंडर में डालें",
    toReminderEmpty: "पहले कुछ लिखिए, फिर रिमाइंडर में डाल सकते हैं।",
    deleteAsk: "यह नोट डिलीट कर दें?",
    deleted: "नोट डिलीट हो गया",
    saved: "नोट सेव हो गया ✓",
    saveFailed: "नोट सेव नहीं हो पाया",
    loadFailed: "नोट्स आ नहीं पाए",
    count: "{n} नोट्स",
    countOne: "1 नोट",
    searchPh: "नोट्स में ढूँढिए",
    searchEmpty: "इस नाम का कोई नोट नहीं मिला",
    reminderOn: "रिमाइंडर लगा है",
    reminderOff: "रिमाइंडर बंद है",
  },
  lock: {
    title: "ऐप लॉक",
    subtitle: "फ़िंगरप्रिंट/फ़ेस या PIN के बिना साथी न खुले",
    unlockTitle: "साथी लॉक है",
    unlockSub: "खोलने के लिए अपना PIN डालिए",
    enterPin: "PIN डालिए",
    wrongPin: "PIN ग़लत है",
    useBiometric: "फ़िंगरप्रिंट/फ़ेस से खोलें",
    biometricPrompt: "साथी खोलने के लिए",
    setTitle: "नया PIN बनाइए",
    setSub: "4 अंक का PIN. यही साथी खोलने के काम आएगा।",
    confirmTitle: "वही PIN दोबारा",
    confirmSub: "पक्का करने के लिए एक बार और डाल दीजिए।",
    mismatch: "दोनों PIN अलग हैं। दोबारा कोशिश कीजिए।",
    changePin: "PIN बदलें",
    turnOff: "ऐप लॉक बंद करें",
    turnOffAsk: "ऐप लॉक बंद कर दें?",
    turnOffBody: "उसके बाद साथी बिना PIN के खुलेगा — इस फ़ोन पर जो भी है, आपके डॉक्यूमेंट देख सकता है।",
    biometricRow: "फ़िंगरप्रिंट / फ़ेस से खोलें",
    biometricHint: "PIN फिर भी रहेगा — जब उँगली न पढ़े तब वही काम आएगा।",
    biometricNone: "इस फ़ोन में फ़िंगरप्रिंट/फ़ेस सेट नहीं है।",
    savedOn: "ऐप लॉक चालू ✓",
    savedOff: "ऐप लॉक बंद",
    saveFailed: "नहीं हो पाया। दोबारा कोशिश कीजिए।",
    offerTitle: "साथी को लॉक कर लें?",
    offerBody:
      "आपके डॉक्यूमेंट इसी फ़ोन में रखे हैं। एक PIN लगा दीजिए — फ़ोन किसी और के हाथ लगे तो भी वह उन्हें नहीं खोल पाएगा। फ़िंगरप्रिंट/फ़ेस भी लगा सकते हैं।",
    offerYes: "हाँ, लॉक लगाइए",
    offerNo: "अभी नहीं",
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
  tabs: { home: "Home", saathi: "Saathi", docs: "Docs", alerts: "Reminders", you: "You" },
  notif: {
    reminderTitle: "🔔 Reminder from Saathi",
    expiryTitle: "📄 Alert from Saathi",
    expiryToday: "{name} expires today — take a look now. 🙂",
    expiryInDays: "{name} expires in {n} days. Just a heads-up 🙂",
    alertReminder: "Reminder",
    alertExpiry: "Document expiry",
    alertOk: "Okay, got it",
    alertDid: "Did you do this?",
    alertDone: "Yes, done",
    alertLater: "Not yet",
    docAsk: "Is this sorted now?",
    docDone: "Lovely! 🎉 I've switched off the reminders for this document.",
    docLater: "No problem — I'll remind you again. 🙂",
    docAddNew: "Add a photo of the new one and I'll track the new expiry for you.",
    docAddBtn: "Add the new document",
  },
  voice: {
    recogLang: "en-IN",
    unclear: "Didn't catch that, please say it again",
    micPermission: "Mic permission needed",
    unavailable: "Voice isn't available on this device",
    tooNoisy: "It's noisy around you — hold the phone closer and try again",
    tooQuiet: "We couldn't hear you — speak a bit closer and louder",
    micHint: "Hold the mic and speak — or tap once, then tap to stop",
  },
  phoneField: {
    placeholder: "Phone number",
    searchPlaceholder: "Search country or code",
    close: "Close",
  },
  reliability: {
    promptTitle: "Get reminders exactly on time",
    promptBody:
      "Without these, Android delivers reminders late — sometimes 5-10 minutes off. Tap Allow on each one. It's a one-time setup.",
    promptButton: "Set up",
    promptLater: "Later",
    settingsRow: "Make reminders reliable",
    settingsRowSub: "Notifications, exact alarms and battery — all in one place",
    stepAllow: "Allow",
    stepDone: "Done",
    stepNotif: "Allow notifications",
    stepNotifSub: "Without this, reminders never show up",
    stepAlarm: "Alarms & reminders",
    stepAlarmSub: "Without this, Android batches your reminder with other alarms and delivers it late",
    stepFsi: "Full-screen alert",
    stepFsiSub:
      "Without this you only get a thin notification at the top — no big alert in the middle of the screen",
    fsiSpotlight:
      "This is the one setting that makes the reminder show as a BIG full-screen popup. Android 14 turns it off by default — which is why the big alert never appears even when everything else is allowed.",
    stepBattery: "Allow background activity",
    stepBatterySub: "Battery optimization off — reminders fire even when the app is closed",
    stepOem: "Turn on auto-start",
    stepOemSub: "Your phone's own setting — let Saathi stay in the background",
    allSetTitle: "All set 🎉",
    allSetBody: "Every reminder will now arrive right on time — app closed or phone locked.",
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
    showPassword: "Show password",
    hidePassword: "Hide password",
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
    greeting: "Hello{name}",
    briefLabel: "Today's brief",
    briefLoading: "Looking through your documents…",
    briefAttention:
      "Heads up{name} — {n} document(s) expiring soon. Take a look below, I'm keeping track.",
    briefStart: "Let's begin{name}! Add your first document and I'll handle its expiry.",
    briefAllSet: "All set{name}! Nothing expiring soon. Relax.",
    briefPlusHook: "With Saathi Plus you get your own brief every morning — written by Saathi.",
    briefPlusCta: "See Plus",
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
    summaryLabel: "What Saathi read",
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
    deleteConfirmBody: "Remove \"{title}\"? This can't be undone.",
    viewAction: "View",
    deleteAction: "Remove",
    activeLabel: "On",
    inactiveLabel: "Off",
    detailTitle: "Reminder",
    detailWhen: "When",
    detailNote: "You said",
    detailStatus: "Status",
    deleted: "Reminder removed",
    repeatLabel: "How often",
    repeatDaily: "Every day",
    repeatWeekly: "Every week",
    repeatMonthly: "Every month",
    repeatEvery: "Every {n} days",
    repeatUntil: "until {date}",
    repeatForever: "until you turn it off",
    repeatOff: "Just once",
    doneToday: "Nice one! Today's done ✅ I'll remind you again tomorrow.",
    pendingBusy: "This reminder saves once you're back online — it can't be changed until then. The alarm is already set.",
    doneAll: "Done! I've switched this reminder off ✅",
    doneBtn: "Mark done",
    doneBtnRepeat: "Done for today",
  },
  addReminder: {
    title: "New reminder",
    whatLabel: "What should I remind you about?",
    whatPlaceholder: "e.g. call mom tomorrow at 8am",
    micHint: "Hold the mic and speak (or tap once) — say the time too, I'll understand",
    understood: "Got it",
    whenLabel: "When should I remind you?",
    pickDateTime: "Pick date & time",
    change: "Change",
    noTimeHint: "No time found in the text — pick date and time above.",
    save: "Set reminder",
    askTime: "When should I remind you? Pick date & time",
    setOk: "Reminder set ✓ I'll remind you on time",
    setOkOffline: "Reminder set ✓ It will save once you're back online",
    savedNoNotif: "Saved, but the notification wasn't set",
    savedNeedPerm: "Saved (please allow notifications)",
    limitReached: "5 active reminders on Free — Saathi Plus for unlimited",
    askWhat: "What is this reminder for?",
    askWhatPlaceholder: "e.g. take medicine, pay electricity bill",
    titleLabel: "Title",
    titleEditHint: "(you can edit)",
    understanding: "Understanding…",
    askDay: "Which day should I remind you?",
    dayAfter: "Day after",
    pickDate: "Pick a date",
    pickTime: "Pick a time",
    pastError: "That time has passed — pick a future time",
    askAmPm: "Morning or evening?",
    otherTime: "Another time",
    repeatLabel: "How often",
    repeatDaily: "Every day",
    repeatWeekly: "Every week",
    repeatMonthly: "Every month",
    repeatEvery: "Every {n} days",
    repeatUntil: "until {date}",
    repeatForever: "until you turn it off",
    repeatOff: "Just once",
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
    failTitle: "The internet gave up",
    failLoad: "We couldn't load your data.",
    failSave: "We couldn't save your work.",
    failAi: "Saathi couldn't read what you said.",
    failHint: "This isn't the app's fault — it'll work as soon as the network is back.",
    tryAgain: "Try again",
    later: "OK",
  },
  contact: {
    title: "Write to us",
    sub: "A problem, a question or an idea — send it straight to us. We do reply. 🤍",
    nameLabel: "Your name",
    namePlaceholder: "Name",
    emailLabel: "Email",
    emailPlaceholder: "you@email.com",
    messageLabel: "What's on your mind?",
    messagePlaceholder: "Whatever you want to say, write it here…",
    send: "Send",
    sending: "Sending…",
    sentTitle: "Got it 🤍",
    sentBody: "Your message reached us. We'll reply soon.",
    needMessage: "Write a message first",
    needEmail: "Enter a valid email",
    failed: "Couldn't send the message",
    row: "Write to us",
  },
  chat: {
    online: "your friend · online",
    greeting:
      "Hello{name}! I'm your Saathi. Ask me about your reminders, tasks and documents — I'll help. 🙂",
    stubReply:
      "You can ask me about your reminders, tasks or documents. 🙂 I can't answer everything else just yet, but that's coming very soon — until then, use the Documents and Reminders tabs!",
    inputPlaceholder: "Type something…",
    suggestions: ["Wake me at 8am", "When does my insurance expire?", "What's on today?"],
    retrySend: "Send again",
    offlineReminderSet: "No internet, but I've set the reminder",
    reminderFailed: "Couldn't create the reminder",
    reminderNeedsTime: "Just check the time — one tap and it's set",
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
    mismatchBody: "Your internet looks like {ip}, but your phone looks like {profile}. Which country's price should we show?\n\nNote: you're always charged in your Google Play account's country.",
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
    copyCode: "Copy code",
    copiedCode: "Code copied 👍",
    yourLink: "Your invite link",
    copyLink: "Copy link",
    copiedLink: "Link copied 👍",
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
    emailLocked: "This is your login email — it can't be changed.",
    phone: "Phone number",
    phoneError: "Enter a valid phone number",
    phoneCountryUnknown: "No dial code found for this country — pick one yourself.",
    verifyCta: "Verify",
    verified: "Verified",
    verifyWhy:
      "WhatsApp reminders only reach you once the number is verified. One wrong digit and they go to a stranger instead.",
    otpTitle: "Code sent to {phone}",
    otpSub: "A 6-digit code should arrive by SMS. Type it here.",
    otpPh: "6-digit code",
    otpSubmit: "Confirm",
    otpResend: "Send again",
    otpResendIn: "Send again ({s}s)",
    otpSending: "Sending…",
    otpSent: "Code sent",
    otpOk: "Number verified ✓",
    errBadNumber: "That number doesn't look right. Please check it.",
    errRateLimited: "Too many attempts. Please try again in a while.",
    errTaken: "This number is already verified on another account.",
    errWrongCode: "That code isn't right. Please check.",
    errExpired: "That code has expired. Send a new one.",
    errNotConfigured: "SMS isn't switched on yet. Please try again later.",
    errFailed: "Couldn't do it. Please try again in a moment.",
    errNetwork: "No connection. Check your network and try again.",
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
    referralCodeRow: "Enter a referral code",
    plusActive: "Saathi Plus — active",
    plusLo: "Saathi Plus",
    plusActiveSub: "Unlimited reminders, documents and AI",
    plusSub: "Unlimited reminders, documents and AI",
    groupAccount: "Account",
    groupSaathi: "Saathi",
    groupPrivacy: "Privacy",
    groupMore: "More",
    editProfile: "Edit details",
    saathiName: "Saathi's name",
    notifications: "Notifications",
    alertMode: "Alert sound",
    alertModeSub: "How Saathi's popup should sound",
    alertRing: "Sound + vibrate",
    alertRingSub: "Saathi says your name out loud, and vibrates too",
    alertVibrate: "Vibrate only",
    alertVibrateSub: "No sound — just a gentle buzz",
    alertSilent: "Silent",
    alertSilentSub: "No sound, no vibration — it only shows on screen",
    alertTest: "Hear it",
    language: "Language",
    privacy: "Privacy & data",
    exportData: "Export my data",
    deleteAll: "Delete all data",
    help: "Help & support",
    about: "About Us",
    logout: "Log out",
    version: "Apka Saathi · v{v} · Made in India",
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
  support: {
    title: "Support",
    sub: "Something not working, or just a question? Write here — every request gets its own number and the reply comes back to this same place.",
    newBtn: "New request",
    empty: "No tickets yet",
    emptyHint: "Ask anything — a problem, a suggestion, or just a question. We'll reply.",
    newTitle: "Tell us what's up",
    subjectLabel: "What's it about",
    subjectPh: "e.g. Reminders aren't arriving on time",
    messageLabel: "The full story",
    messagePh: "The more detail you give, the faster we can fix it.",
    send: "Send",
    sending: "Sending…",
    created: "Ticket created — {no}",
    createdHint: "Keep this number handy. The reply comes here, by email, and as a notification on your phone.",
    stOpen: "Waiting for reply",
    stAnswered: "Replied",
    stClosed: "Closed",
    replyPh: "Anything else?",
    you: "You",
    team: "Saathi team",
    failed: "Couldn't send. Check your connection and try again.",
    setupMissing: "Support isn't switched on yet. Please try again a little later.",
    tooShort: "A few more words, please.",
    loading: "Loading…",
    waiting: "We're reading your message — a reply is on the way.",
  },
  deviceOwner: {
    title: "This phone is set up for someone else",
    intro:
      "In Saathi, this phone is set up for {name} ({email}). You can still sign in with your own ID — nothing is blocked. But please read this first, because finding out later costs both of you.",
    introNoName:
      "In Saathi, this phone is set up for {email}. You can still sign in with your own ID — nothing is blocked. But please read this first, because finding out later costs both of you.",
    notifTitle: "Notifications belong to one ID at a time",
    notifBody:
      "A phone's delivery address (its token) can belong to only one account at a time. Sign in here and their reminder notifications stop arriving on this phone — sign out and yours stop. The two can never run together.",
    aiTitle: "The AI only sees whoever is signed in",
    aiBody:
      "Chat, document scanning and reminder understanding all work on your own documents and reminders. Whatever is already stored on this phone won't be visible to you, and yours won't be visible to them.",
    rewardTitle: "One referral reward per phone",
    rewardBody:
      "A device can earn the referral reward only once. It may already have been claimed on this phone — in that case you won't get it, however valid your code is.",
    advice:
      "The best thing is simple: sign in with your own ID on your own phone. That's the only way notifications, the AI and everything else work fully for you.",
    ok: "I understand, continue anyway",
    logout: "Sign out",
    bannerTitle: "This phone is already set up",
    bannerBody:
      "For {who}. Signing in with a different ID turns off their notifications and AI — tap to read why.",
  },
  multiDevice: {
    title: "Your ID is signed in on other phones too",
    intro:
      "Besides this phone, your account is signed in on {count} others. Nothing is blocked — but it's worth knowing this, otherwise the app will start looking broken.",
    introOne:
      "Besides this phone, your account is signed in on one other phone. Nothing is blocked — but it's worth knowing this, otherwise the app will start looking broken.",
    alarmTitle: "Reminder alarms are set on each phone separately",
    alarmBody:
      "Alarms live inside the phone, not on the server. Change a reminder's time here and the other phone keeps the old alarm until you open the app there. That's why one reminder can ring at two different times.",
    notifTitle: "The same message goes to every phone",
    notifBody:
      "Reminders and messages from Saathi reach every phone you're signed in on. Two phones means it arrives twice — that isn't a fault, both phones are registered to you.",
    privacyTitle: "Your documents are open on every one of those phones",
    privacyBody:
      "Any signed-in phone shows all your documents and reminders. If a phone isn't with you any more — an old family handset, one you sold — it's better to remove it now.",
    advice:
      "Sign out the phones you no longer use, right here. This phone stays signed in — you won't have to log in again.",
    ok: "That's fine, leave it",
    logoutOthers: "Sign out all other phones",
    logoutOthersDone: "Done — only this phone is signed in now.",
    logoutOthersFailed: "Couldn't do it. Check your connection and try again.",
  },
  notes: {
    title: "Notes",
    empty: "No notes yet",
    emptyHint:
      "A shopping list, an idea, a car number — anything worth keeping that doesn't need a time. Write it here.",
    add: "New note",
    titlePh: "Title (optional)",
    bodyPh: "Write whatever you need…",
    untitled: "Untitled note",
    pin: "Pin to top",
    unpin: "Unpin",
    toReminder: "Turn into a reminder",
    toReminderEmpty: "Write something first, then you can turn it into a reminder.",
    deleteAsk: "Delete this note?",
    deleted: "Note deleted",
    saved: "Note saved ✓",
    saveFailed: "Couldn't save the note",
    loadFailed: "Couldn't load your notes",
    count: "{n} notes",
    countOne: "1 note",
    searchPh: "Search notes",
    searchEmpty: "No note matches that",
    reminderOn: "Reminder is set",
    reminderOff: "Reminder is off",
  },
  lock: {
    title: "App lock",
    subtitle: "Saathi won't open without your fingerprint, face or PIN",
    unlockTitle: "Saathi is locked",
    unlockSub: "Enter your PIN to open it",
    enterPin: "Enter PIN",
    wrongPin: "That PIN isn't right",
    useBiometric: "Use fingerprint / face",
    biometricPrompt: "Unlock Saathi",
    setTitle: "Create a PIN",
    setSub: "A 4-digit PIN. This is what opens Saathi.",
    confirmTitle: "Type it again",
    confirmSub: "Once more, to be sure.",
    mismatch: "Those two PINs don't match. Try again.",
    changePin: "Change PIN",
    turnOff: "Turn off app lock",
    turnOffAsk: "Turn off app lock?",
    turnOffBody: "After this Saathi opens without a PIN — anyone holding this phone can read your documents.",
    biometricRow: "Unlock with fingerprint / face",
    biometricHint: "Your PIN stays too — it's what you'll use when the sensor won't read.",
    biometricNone: "No fingerprint or face is set up on this phone.",
    savedOn: "App lock is on ✓",
    savedOff: "App lock is off",
    saveFailed: "Couldn't do it. Please try again.",
    offerTitle: "Lock Saathi?",
    offerBody:
      "Your documents live on this phone. Set a PIN and nobody else can open them, even holding your phone. You can add fingerprint or face too.",
    offerYes: "Yes, lock it",
    offerNo: "Not now",
  },
};

export const dictionaries: Record<Locale, Dict> = { hinglish, hi, en };
