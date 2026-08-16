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
    /** Test alarm ka text — `scheduleTestAlarm()`. */
    testTitle: string;
    testBody: string;
    /** {name} */
    expiryToday: string;
    /** {name} {n} */
    expiryInDays: string;
    alertReminder: string;
    alertExpiry: string;
    alertOk: string;
    alertDid: string;
    alertDone: string;
    /**
     * "Abhi nahi" ab ek ASLI kaam karta hai — 5 minute baad dobara bajta hai.
     *
     * ⚠️ Pehle ye button sirf dikhta tha. `flushNotificationActions()` me
     * `if (a.action !== "done") continue;` likha tha, yaani "later" chup-chaap
     * gir jaata tha: notification hat jaati thi aur reminder poori tarah gayab.
     * Isliye naam bhi ab wahi kehta hai jo hota hai.
     */
    alertLater: string;
    /** Snooze lag gaya — toast. */
    alertSnoozed: string;
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
     * Phone me voice service hai hi nahi (ya band hai).
     *
     * `unavailable` se alag: wo "abhi chal nahi paaya" hai, ye "is phone par
     * setup hi nahi hai" hai. Dono ka ilaaj alag hai, isliye line bhi alag —
     * warna user baar-baar wahi button dabata rehta hai jo kabhi chalega hi
     * nahi.
     */
    noService: string;
    /** Recognizer ko internet chahiye tha aur wo nahi mila. */
    needsNet: string;
    /** Doosri app (ya Assistant) mic pakde baithi hai. */
    micBusy: string;
    /** Ye bhasha is phone ke recognizer me nahi hai. */
    langMissing: string;
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
    /**
     * "Ho gaya?" — sirf un do steps par (full-screen intent, OEM auto-start)
     * jinka status Android kisi API se batata hi nahi.
     *
     * ⚠️ Pehle wahan kuch poochha hi nahi jaata tha: settings screen KHULTE HI
     * step green ho jaata tha. Jo user toggle dabana bhool gaya uska bada popup
     * hamesha ke liye band reh jaata tha — aur app use "sab set hai" kehti thi.
     */
    stepConfirmYes: string;
    stepOpenAgain: string;
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
    /** Asli alarm, 1 minute baad — yahi ek tareeka hai pakka jaanne ka. */
    testCta: string;
    testScheduled: string;
    testFailed: string;
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
    /**
     * Password 72 se lamba nahi ho sakta.
     *
     * ⚠️ Ye rok dikhawa nahi hai. Supabase bcrypt use karta hai, aur bcrypt 72
     * BYTE ke baad sab kuch CHUP-CHAAP kaat deta hai. Yaani 80 character ka
     * password banane wala baad me apne pehle 72 character se bhi login kar
     * pata tha — aur use kabhi pata hi nahi chalta ki uske aakhri 8 character
     * kabhi gine hi nahi gaye.
     */
    longPassword: string;
    /** Password ki takat — teen darje. */
    pwWeak: string;
    pwOk: string;
    pwStrong: string;
    /** Kaise majboot karein — bar ke neeche wali salah. */
    pwHint: string;
    confirmSent: string;
    welcomeNew: string;
    welcomeBackToast: string;
    somethingWrong: string;
    googleFailed: string;

    /* ── Password bhool gaye ─────────────────────────────────────────
     *
     * ⚠️ Ye poora raasta pehle tha hi nahi. Email+password wala user apna
     * password bhool jaye to app me kahin koi rasta nahi tha — wo hamesha ke
     * liye apne hi documents se bahar. Support bhi kuch nahi kar sakta tha
     * (password Supabase ke paas hashed hai).
     */
    forgot: string;
    forgotTitle: string;
    forgotSub: string;
    forgotSend: string;
    /** Jawab hamesha ek jaisa — chahe email register ho ya na ho. */
    forgotSent: string;
    forgotBack: string;
    /**
     * ── Reset ka doosra raasta: 6-ank ka code ───────────────────────────
     *
     * ⚠️ Ye poora hissa isliye hai ki LINK ka raasta un jagah tootta hai jahan
     * hamara koi bas nahi chalta — Gmail/Outlook ka scanner link ko user se
     * PEHLE khol ke ek-baar-chalne wala token kha jaata hai, mail laptop par
     * khula ho to `saathi://` ko wahan koi nahi jaanta, aur link ki apni umar
     * ek ghante ki hai. Teenon soorat me user ko bas "app login maang rahi hai"
     * dikhta tha. Poori list `lib/auth.ts` ke `verifyPasswordResetCode()` par.
     *
     * ⚠️ Iske chalne ke liye Supabase ke "Reset Password" email template me
     * `{{ .Token }}` hona zaroori hai — warna code email me aata hi nahi.
     */
    /** Link par tap karke wapas aa gaye, par wo link nahi chala. */
    resetLinkDead: string;
    resetCodeTitle: string;
    resetCodeSub: string;
    resetCodePlaceholder: string;
    resetCodeSubmit: string;
    /** Code to bhara par email khaali/galat hai — `verifyOtp` dono maangta hai. */
    resetCodeNeedsEmail: string;
    /** Code galat ya beet chuka. */
    resetCodeBad: string;
    /** Naya link + naya code bhejo. */
    resetSendAgain: string;
    /** Recovery link se aane ke baad ka screen. */
    newPassTitle: string;
    newPassSub: string;
    newPassLabel: string;
    newPassPlaceholder: string;
    newPassConfirm: string;
    newPassMismatch: string;
    newPassSave: string;
    newPassOk: string;
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
    /** Document ko phone ki Gallery me save karna. */
    download: string;
    savedToDevice: string;
    saveNeedsPermission: string;
    /**
     * Save fail — aksar iska matlab purana build hai (media-library native
     * module usme hai hi nahi). Isliye message Share ka raasta bhi batata hai,
     * jo bina kisi native module ke chalta hai.
     */
    saveFailedUseShare: string;
    /** "Renew kaise karein" — expiry ke baad ka asli sawaal. */
    renewOpenSite: string;
    /**
     * Is document type ka renewal guide abhi bana hi nahi.
     *
     * ⚠️ Pehle aisi soorat me renewal ka poora hissa CHUP-CHAAP gayab ho jaata
     * tha. User ko expiry ka alert milta, wo document kholta, aur "ab karun
     * kya?" ka koi jawab hi nahi milta — na guide, na ye baat ki jawab banaya
     * ja raha hai. Chup rehne se saaf keh dena hamesha behtar hai.
     */
    renewSoonTitle: string;
    renewSoonBody: string;
    renewShowSteps: string;
    renewHideSteps: string;
    /**
     * Tab dikhta hai jab guide AI ka banaya ho (unreviewed) YA "har desh" wala
     * aam jawab ho. Dono me jaankari kaam ki hai par aakhri sach nahi — aur
     * sarkari process me galat salah mehngi padti hai.
     */
    renewVerifyNote: string;
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
    /**
     * Document par "renew ho gaya, nayi date daal do" wala button.
     *
     * ⚠️ Iska naam "Edit" JAAN-BOOJH KE nahi hai. "Edit" ka matlab hota hai "sab
     * kuch badal sakte ho", aur wahi sabse bada khatra tha: Passport add karke
     * use Driving Licence bana dena. Ye button sirf EK kaam karta hai — expiry
     * (aur chaho to photo) badalna — aur uska naam bhi wahi kehna chahiye.
     */
    renewUpdate: string;
    /** Jis document par expiry hai hi nahi — wahan wahi screen, alag naam se. */
    addExpiry: string;
    /**
     * Renew se PEHLE wale document — photo + us waqt ki expiry.
     *
     * ⚠️ Ye hissa isliye hai kyunki purana document renew ke baad bekaar nahi ho
     * jaata: purana passport visa ke record ke liye maanga jaata hai, purani
     * policy claim ke waqt chahiye hoti hai, aur purana DL transfer/challan me
     * kaam aata hai. Pehle renew purani photo ko mita deta tha, isliye ye sab
     * kahin bachta hi nahi tha.
     */
    versionsTitle: string;
    /** "{n} purane version" — ginti ke saath. */
    versionsCount: string;
    /** Ek purane version ka label — "Version {n}". */
    versionLabel: string;
    /** Us version ki expiry ke aage — "Expiry: 12 Jan 2025". */
    versionExpiry: string;
    /** Jis purane version par expiry thi hi nahi. */
    versionNoExpiry: string;
    /** "{date} tak chala" — ye version kab tak current tha. */
    versionUntil: string;
    /** Purani photo khul nahi payi (net nahi, ya file hi nahi bachi). */
    versionNoFile: string;
    /**
     * Photo ke kone par ki chhoti patti — "tap karo, poori screen par khulegi".
     *
     * ⚠️ Ye patti zaroori hai. Sirf tap chalne se kuch nahi hota agar user ko
     * pata hi na ho ki photo tappable hai, aur is app ke user photo par tap
     * karne ki koshish karte hi nahi.
     */
    zoomHint: string;
  };
  /**
   * Document renew — expiry (aur chaho to nayi photo) badalne wali screen.
   *
   * Naam aur type yahan kabhi nahi badalte; wo `lib/documents.ts` ke
   * `updateDocument()` me type-level par hi rok diye gaye hain. Wajah wahan
   * poori likhi hai.
   */
  renewDoc: {
    title: string;
    sub: string;
    /** Naam/type wale locked card ka footer — kyun badal nahi sakte. */
    lockedNote: string;
    photoLabel: string;
    photoKeep: string;
    photoNew: string;
    photoUndo: string;
    newPhoto: string;
    /** Nayi photo se sirf expiry padhi jaati hai — naam/type nahi. */
    scanExpiryOnly: string;
    /**
     * "Pehle ye tha, ab ye hai" — purana aur naya, saath-saath.
     *
     * ⚠️ Ye card is screen ka sabse zaroori hissa hai. Renew me user ek CHEEZ
     * badal raha hai (date, aur kabhi photo) — par bina saamne dekhe use kabhi
     * pakka nahi hota ki wo sach me badli ya nahi, aur na hi ye ki purana kya
     * tha. Expiry wale aur bina-expiry wale, dono documents par dikhta hai.
     */
    compareTitle: string;
    beforeLabel: string;
    afterLabel: string;
    /** Nayi photo nahi li — wahi purani chalti rahegi. */
    samePhoto: string;
    /** Is document par expiry thi hi nahi (Aadhaar/PAN jaisa). */
    noExpiryShort: string;
    /** Document ki koi photo hai hi nahi. */
    noPhoto: string;
    expiryLabel: string;
    /** Expiry poori tarah hata dene ka rasta (galti se lag gayi ho). */
    clearExpiry: string;
    save: string;
    saved: string;
    savedNoNotif: string;
    savedExpired: string;
    savedNoExpiry: string;
    saveFailed: string;
    nothingChanged: string;
    notFound: string;
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
    /**
     * Shakl theek hai par wo din hai hi nahi (jaise 29 Feb 2027).
     *
     * ⚠️ Ye `badDate` se ALAG hona zaroori hai. Pehle dono par "Date format:
     * YYYY-MM-DD" dikhta tha — jo is soorat me ulta galat raasta dikhata hai,
     * kyunki format to bilkul sahi likha gaya tha.
     *
     * {m} = mahine ka naam, {y} = saal, {d} = us mahine me kitne din hote hain.
     */
    badDateDay: string;
    /** Expiry beet chuki — field ke neeche wali chetavni. */
    expiryPast: string;
    /** Save ho gaya, par expiry beeti hui thi — koi reminder nahi laga. */
    addedExpired: string;
    /**
     * Expiry khaali chhodi hai — card ka sar-naam.
     *
     * ⚠️ Ye ROK nahi hai aur kabhi nahi honi chahiye: Aadhaar aur PAN ki koi
     * expiry hoti hi nahi, aur unhe rok dena poore feature ka matlab hi khatam
     * kar deta. Ye sirf saaf-saaf batata hai ki khaali chhodne par kya NAHI
     * hoga, taaki user jaan-boojh ke faisla kare.
     */
    noExpiryTitle: string;
    noExpiryBody: string;
    /** Save ho gaya par expiry nahi thi — is document par koi khabar nahi aayegi. */
    addedNoExpiry: string;
    /** Expiry bhari hai — "hum aapko kab-kab yaad dilayenge" wala sar-naam. */
    notifyPlanTitle: string;
    /** "{n} din pehle" */
    notifyPlanLead: string;
    /** Expiry wale din khud. */
    notifyPlanOnDay: string;
    /**
     * Ye qadam beet chuka hai — is par kuch nahi aayega.
     *
     * ⚠️ Beete hue qadam ko chhupa dena aasan tha, par wo jhooth banta: 3 din
     * baad expire hone wale document par "7 din pehle" kabhi nahi aa sakta, aur
     * use list se gayab kar dene par user maan leta hai ki teenon lag gaye.
     */
    notifyPlanPassed: string;
    /** Khabar din ke kis waqt aayegi — "subah 9 baje". */
    notifyPlanAtTime: string;
    /**
     * Teenon qadam beet chuke hain par document AAJ HI expire ho raha hai —
     * Saathi phir bhi bataayega, bas thodi der me.
     *
     * ⚠️ Ye jodi (`Now` + `NowSub`) is card ki sabse zaroori line hai jab
     * document dopahar ko daala jaye. Pehle wahan sirf teen kati hui lines
     * dikhti thi, jinka matlab user ke liye "kuch nahi aayega" hai — aur wo sach
     * bhi tha. Ab alert lagta hai (`utils/expiry.ts` ka `expiryCatchUp`).
     */
    notifyPlanNow: string;
    notifyPlanNowSub: string;
    /**
     * Photo ke bina document save nahi hota.
     *
     * ⚠️ Ye rok pehle thi hi nahi. Sirf naam aur date wala "document" dekhne ke
     * kaam ka hai hi nahi — na offline screen par, na share/download par, na
     * renew par — aur backup me bhejne ko bhi kuch nahi hota. Poori wajah
     * `add-document.tsx` ke `save()` par likhi hai.
     */
    photoRequired: string;
    saveFailed: string;
    cameraPermission: string;
    ocrExpiryFound: string;
    /** {bits} */
    ocrReadTpl: string;
    ocrUnclear: string;
    ocrFailed: string;
    /** Net hi nahi tha — AI chala hi nahi. */
    ocrOffline: string;
    /** Net dheema / Gemini bhara hua — dobara koshish karne layak. */
    ocrBusy: string;
    imageFailed: string;
  };
  reminders: {
    title: string;
    sub: string;
    emptyTitle: string;
    emptyBody: string;
    today: string;
    upcoming: string;
    /**
     * Beet chuke reminder — apna alag khaana.
     *
     * ⚠️ Ye pehle THA HI NAHI, aur uski kami seedhi dikhti thi: bucket sirf
     * do the ("aaj" aur "baaki sab"), isliye 5 August ka beeta hua reminder
     * "Aane wale" me baith jaata tha. User ke liye wo app ka saaf-saaf jhooth
     * tha.
     */
    missed: string;
    missedHint: string;
    /**
     * Beet chuke aur BAND/nipte hue reminder â apna alag khaana.
     *
     * ⚠️ Ye pehle tha hi nahi, aur uski kami user ne seedha pakdi: "jo ho
     * gaya h wo aane wale me aata h". `missed` sirf CHALU reminder ke liye
     * hai; jo reminder nipat chuka hai (ya user ne khud band kar diya hai) wo
     * `upcoming` me gir jaata tha, kyunki upcoming ki poori shart sirf "aaj ka
     * nahi + chhoota hua nahi" thi. 11 August ka nipta hua reminder 14 August
     * ko bhi "Aane wale" me baitha rehta tha â app ka saaf-saaf jhooth.
     */
    past: string;
    pastHint: string;
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

    /* ── Saathi khud poochhe (ask-modal) ───────────────────────────────
     *
     * Jo baat text/awaaz me nahi mili, use Saathi popup me ek-ek karke
     * poochta hai. Pehle wo baatein sirf khaali khaano ki tarah padi rehti
     * thi aur user ko khud dhoondhni padti thi.
     */
    /** Popup ka sirnaam — "{n}" me kitni baatein baaki hain. */
    askTitleOne: string;
    askTitleMany: string;
    /** Har sawaal ke upar: "Saathi ne itna samajha" */
    askGotIt: string;
    askNext: string;
    askFinish: string;
    /** "Rehne do, main khud bhar lunga" */
    askManual: string;
    /** Time ke jhat-pat wale chips. */
    timeMorning: string;
    timeNoon: string;
    timeEvening: string;
    timeNight: string;
    /**
     * AI text samajh hi nahi paaya (net/server) — user ko wajah pata chale.
     * Pehle ye chup-chaap fail hota tha aur lagta tha AI kuch karta hi nahi.
     */
    aiOffline: string;
    aiBusy: string;
    aiFailed: string;
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

    /* ── Poori app band, sirf documents (offline screen) ──────────────
     *
     * Net na hone par app ka baaki kuch bhi kaam nahi karta — reminder save
     * nahi hota, AI jawab nahi deta, list refresh nahi hoti. Aadhi-adhoori
     * chalti hui app dikhane se behtar hai ek saaf screen jo wahi ek cheez
     * deti hai jo sach me offline chalti hai: save kiye hue documents.
     */
    offTitle: string;
    offBody: string;
    offDocsTitle: string;
    offEmpty: string;
    offEmptyBody: string;
    offRetry: string;
    offChecking: string;
    /** Ek document par ke teen kaam. */
    offView: string;
    offDownload: string;
    offShare: string;
    /** File is phone par cache hi nahi hui — offline nahi khul sakti. */
    offNoFile: string;
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
    /** Jawab nahi aaya — wahi message dobara bhejne ka button. */
    retrySend: string;
    /** 6 second se soch raha hai. */
    thinking: string;
    /** 15 second se soch raha hai. */
    thinkingLong: string;
    /**
     * Jawab kyun nahi aaya.
     *
     * ⚠️ Teenon me se KISI me bhi internet ka zikr nahi hai — aur ye jaan-boojh
     * ke hai. Ye lines tabhi dikhti hain jab probe keh chuka ho ki net theek
     * hai. Internet wali baat sirf full-screen popup me hai (`network.fail*`),
     * jo ab sirf sach me offline hone par khulta hai.
     */
    failBusy: string;
    failSlow: string;
    failServer: string;
    /** AI tak baat nahi pahunchi, par local samajh se reminder ban gaya. */
    offlineReminderSet: string;
    reminderFailed: string;
    /**
     * AI ne baat to samajh li par time galat/beeta hua nikla — Add-reminder
     * screen khul rahi hai, title pehle se bhara hua.
     */
    reminderNeedsTime: string;
    /**
     * Saathi ne app ki koi setting badal di (theme / bhasha / alert ki awaaz).
     *
     * ⚠️ Ye toast zaroori hai. Bhasha badalne par to poori screen badal jaati
     * hai, aur bina kisi khabar ke wo chaunka deta hai — user ko lagta hai kuch
     * galat ho gaya.
     */
    settingChanged: string;
    /**
     * Bol ke chhoda — message apne aap ja raha hai, par abhi roka ja sakta hai.
     *
     * ⚠️ Ye do line isliye hain kyunki bola hua message SEEDHA bhej dena
     * khatarnak hai: recognizer aadha ya galat likh de to wo galat baat AI ko
     * chali jaati hai aur chat me hamesha ke liye dikhti rehti hai. Aur seedha
     * na bhejna bhi galat tha — user bolta tha, text dikhta tha, aur usse phir
     * bhi send dabana padta tha (yaani voice ka aadha faayda hi mila).
     *
     * Beech ka raasta: bhej to apne aap rahe hain, par do second ka mauka
     * rahega.
     */
    voiceSending: string;
    voiceStop: string;
  };
  /**
   * Plus khatam ho gaya — poori screen wala samjhane wala page.
   *
   * ⚠️ Ye section isliye hai ki downgrade ab apne aap hota hai
   * (`supabase/cron-plan-expiry.sql`): Plus khatam hote hi free hadd se AAGE ke
   * documents lock ho jaate hain aur aage ke reminders pause. Ye theek hai — par
   * user ko iski khabar kahin se milti hi nahi thi, aur uske liye wo bilkul aisa
   * dikhta tha jaise app kharab ho gayi ho ("mere documents kahan gaye",
   * "reminder aana band kyun ho gaya").
   *
   * ⚠️ Poora lehja "sab surakshit hai" wala hai, "aapne kho diya" wala nahi —
   * aur ye SACH hai: kuch delete nahi hota, sirf lock hota hai, aur Plus wapas
   * lete hi sab khud khul jaata hai. Dara ke bechna is app ke mizaaj se ulta
   * hai; ginti sirf isliye di jaati hai ki user ko apni haalat saaf dikhe.
   */
  planExpired: {
    title: string;
    /** Sabse zaroori line — sabse upar, sabse mota. */
    safe: string;
    body: string;
    /** {docs} — kitne documents lock hain. */
    lockedDocs: string;
    /** {reminders} — kitne reminders pause hain. */
    pausedReminders: string;
    /** Free hadd ke andar hai — kuch lock hi nahi hua. */
    nothingLocked: string;
    back: string;
    later: string;
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
    /**
     * Kharidari ho gayi, par server ne abhi tak Plus nahi likha.
     *
     * Plan sirf Play/RevenueCat ke webhook se chalu hota hai (app khud plan
     * nahi likh sakti — dekho supabase/column-grants.sql). Wo aksar kuch
     * second me aata hai, par kabhi der bhi kar deta hai. Us soorat me
     * "purchase fail" kehna jhooth hoga — paisa kat chuka hai.
     */
    activating: string;
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
    /**
     * "Ye WhatsApp wala number hona chahiye."
     *
     * ⚠️ Ye kahin likha hi nahi tha, aur wo ek asli, chup-chaap fail hone wali
     * kami thi. Plus me reminder aur document expiry ka message WhatsApp par
     * jaata hai — usi number par jo yahan verify hua ho. Log apna doosra (bina
     * WhatsApp wala) number verify kar dete the, screen "Verified ✓" dikhati
     * thi, aur ek bhi message kabhi nahi pahunchta tha. Kahin koi error bhi nahi
     * aata tha.
     */
    whatsappNote: string;
    /** {phone} */
    otpTitle: string;
    /**
     * Code ja hi nahi paaya — title tab yahi kehta hai.
     *
     * ⚠️ Iske bina modal fail hone par bhi "code bheja hai" likh deta tha aur
     * neeche laal me "nahi bheja ja saka" — ek hi screen do ulti baatein.
     */
    otpTitleFailed: string;
    /** {phone} — fail wali soorat me, sirf ye batane ke liye ki baat kis number ki hai. */
    otpForPhone: string;
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
    /** 30 second ka thehraav — button khud khul jayega. */
    errCooldown: string;
    /**
     * Aaj/is ghante ki hadd poori. `errRateLimited` se ALAG hai jaan-boojh ke:
     * wahan intezaar kaam aata hai, yahan nahi — user ko sach me madad chahiye,
     * aur ye line use bataati hai ki maangni kahan hai.
     */
    errTooMany: string;
    /** Us soorat me phone field ke neeche dikhne wala note. */
    otpBlockedNote: string;
    /** Us note ka button — support ticket screen kholta hai. */
    otpBlockedCta: string;
    /** Support form me pehle se bhara hua subject. */
    otpBlockedSubject: string;
    /** Us number par bheja hua desh — SMS kis desh me nahi ja sakta. */
    errBlockedCountry: string;
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
    /** Offline documents kitni jagah le rahe hain + khaali karne ka raasta. */
    /** Light / dark / phone ke hisaab se. */
    theme: string;
    themeSub: string;
    themeLight: string;
    themeLightSub: string;
    themeDark: string;
    themeDarkSub: string;
    themeSystem: string;
    themeSystemSub: string;
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
    /** Request darj ho gayi. */
    deleted: string;
    /** Pehle se pending thi — "fail" nahi, wahi tasalli. */
    deletePending: string;
    /** Request bheji hi nahi ja saki — dobara koshish karni hai. */
    deleteFailed: string;
    /** Row ke daayin chhota nishaan jab request ja chuki ho. */
    deleteAsked: string;
    /**
     * Admin ne account band kar diya — poori app ki jagah yahi screen.
     *
     * ⚠️ Ye teen line kisi "error" ki nahi hain. Band account me har table RLS
     * se ruk jaati hai, yaani user ko har screen khaali dikhti hai aur kahin koi
     * wajah nahi likhi hoti. Wo sabse buri soorat hai — app tooti hui lagti hai.
     */
    closedTitle: string;
    closedBody: string;
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
    /** Patti ke neeche ka link — tap par poori baat khulti hai. */
    bannerMore: string;
    /**
     * Home par pehle din ka chhota toast. {who} = naam ya email.
     *
     * ⚠️ Poora modal ab document + reminder ke baad aata hai. Ye line us beech
     * ki khamoshi bharti hai — theek us soorat me user ke reminder is phone par
     * aate hi nahi, aur bina kisi khabar ke wo "app kharab hai" samajh leta hai.
     */
    toast: string;
  };

  /**
   * "Ye naya phone hai" — is phone par reminder/alert chaalu karne ka raasta.
   *
   * ⚠️ `deviceOwner` aur `multiDevice` se ALAG. Wo dono CHETAVNI hain — baat
   * keh ke band ho jaate hain. Ye ek HAALAT hai jo abhi chal rahi hai: is phone
   * par sach me alarm nahi lag rahe (dekho supabase/device-approval.sql).
   */
  deviceApproval: {
    /** Patti — hat-ti nahi, kyunki haalat abhi chal rahi hai. */
    bannerText: string;
    bannerCta: string;
    title: string;
    intro: string;
    alarmTitle: string;
    alarmBody: string;
    notifTitle: string;
    notifBody: string;
    dataTitle: string;
    dataBody: string;
    sendCode: string;
    sending: string;
    /** {email} — mask kiya hua */
    sentTo: string;
    verify: string;
    verifying: string;
    resend: string;
    /** {s} — bache hue second */
    resendIn: string;
    support: string;
    later: string;
    errNoEmail: string;
    errNotConfigured: string;
    errTooMany: string;
    errWrongCode: string;
    errExpired: string;
    errLocked: string;
    errNetwork: string;
    errFailed: string;
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
   * "WhatsApp par message chahiye? Pehle number verify karo." — Plus users.
   *
   * ⚠️ Ye shart kahin likhi hi nahi thi, aur wo poori tarah chup-chaap fail
   * hoti thi: user Plus kharidta, reminder lagata, aur WhatsApp par kabhi kuch
   * nahi aata — bina kisi error ke. Cron bilkul theek chal raha tha; wo bina
   * verify kiye number par jaan-boojh ke nahi bhejta (ek digit ki galti reminder
   * kisi ajnabi ke paas bhej deti hai). Kami sirf batane ki thi.
   */
  whatsappSetup: {
    title: string;
    body: string;
    /** Sabse zaroori baat — number WHATSAPP wala hona chahiye. */
    note: string;
    cta: string;
  };

  /**
   * Note se reminder — ek hi sawaal wali screen.
   *
   * ⚠️ Pehle note ka "Reminder set karo" poori Add-reminder screen kholta tha
   * aur note ka saara text uske text-box me daal deta tha. Wahan se AI use
   * padhta tha — aur do cheezein hamesha toot-ti thi: note ka poora paragraph
   * reminder ka title ban jaata (notification me chaar line, jo koi padhta hi
   * nahi), aur note me waqt hota hi nahi to AI poochhta rehta, jabki user ne
   * sirf itna kaha tha ki "iska reminder laga do".
   */
  noteReminder: {
    title: string;
    whenLabel: string;
    /** Calendar wali pankti ka chhota label. */
    dateLabel: string;
    /** Ghadi wali pankti ka chhota label. */
    timeLabel: string;
    repeatLabel: string;
    repeatOnce: string;
    repeatDaily: string;
    repeatWeekly: string;
    /** Chuna hua waqt beet chuka hai. */
    pastTime: string;
    /**
     * Aaj ka beeta hua waqt chunne par reminder kal par sarka diya gaya.
     *
     * ⚠️ Ye chetavni nahi, soochna hai — hum user ko roka nahi, uska iraada
     * (wahi ghanta) rakh kar din badal diya. Chup-chaap badalna sabse bura
     * hota, isliye toast zaroori hai.
     */
    movedToTomorrow: string;
    saved: string;
    saveFailed: string;
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
    /**
     * Bahut galat koshish — thodi der ke liye rok. {s} = kitne second.
     *
     * ⚠️ Ye rok pehle thi hi nahi: 4-ank ka PIN, local check, aur unlimited
     * koshish — yaani jiske haath phone lag jaye wo baith ke saare 10,000
     * combination try kar sakta tha.
     */
    tooManyPin: string;
    /**
     * PIN bhool gaye — email par 6 ank ka code.
     *
     * ⚠️ Pehle yahan sirf "Logout karke dobara login karo" tha. Wo us waqt sach
     * tha (PIN sirf phone par hota tha), par ab PIN account ka hissa hai —
     * logout se wo hatta hi nahi. Us badlaav ke saath ye raasta zaroori ho gaya,
     * warna PIN bhoolne wala apne hi documents se hamesha ke liye bahar.
     */
    forgotPin: string;
    resetSending: string;
    resetTitle: string;
    /** {email} — mask kiya hua (ni•••@gmail.com) */
    resetSentTo: string;
    resetNewPin: string;
    resetNewSub: string;
    resetResend: string;
    /** {s} */
    resetResendIn: string;
    /** Account par email hi nahi hai — support hi raasta hai. */
    resetErrNoEmail: string;
    resetErrNotConfigured: string;
    resetErrTooMany: string;
    resetErrWrongCode: string;
    resetErrExpired: string;
    resetErrLocked: string;
    resetErrFailed: string;
    resetErrNoNet: string;
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
    testTitle: "⏰ Test alarm",
    testBody: "Ye dikh aur sunai de raha hai, to aapke reminder kaam karenge.",
    expiryToday: "{name} aaj expire ho raha hai — abhi dekh lo. 🙂",
    expiryInDays: "{name} {n} din me expire ho raha hai. Main yaad dila raha hoon 🙂",
    alertReminder: "Reminder",
    alertExpiry: "Document expiry",
    alertOk: "Theek hai, samajh gaya",
    alertDid: "Kya aapne yeh kar liya?",
    alertDone: "Haan, ho gaya",
    alertLater: "5 min baad",
    alertSnoozed: "Theek hai — 5 minute baad phir yaad dila dunga ⏰",
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
    noService: "Is phone me voice typing band hai — Google app update/enable karke dobara try karo",
    needsNet: "Voice ke liye internet chahiye — net on karke dobara boliye",
    micBusy: "Mic abhi kisi aur app ke paas hai — use band karke dobara boliye",
    langMissing: "Ye bhasha is phone ke voice me nahi hai — Settings me language pack install karo",
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
      "Inke bina Android reminder 5-10 minute late bhejta hai. Ek-ek karke Allow dabao — ek baar ka kaam.",
    promptButton: "Setup karo",
    promptLater: "Baad me",
    settingsRow: "Reminders reliable banao",
    settingsRowSub: "Notification, exact alarm aur battery — sab ek jagah",
    stepAllow: "Allow",
    stepConfirmYes: "On kar diya",
    stepOpenAgain: "Phir se kholo",
    stepDone: "Ho gaya",
    stepNotif: "Notification allow karo",
    stepNotifSub: "Iske bina reminder dikhega hi nahi",
    stepAlarm: "Alarms & reminders",
    stepAlarmSub: "Iske bina Android reminder ko der se, dusre alarms ke saath bhejta hai",
    stepFsi: "Poori screen par alert",
    stepFsiSub:
      "Iske bina sirf upar patli si notification aayegi — screen ke beech me bada alert nahi",
    fsiSpotlight:
      "Poori screen wala BADA alert isi se aata hai. Android 14 me ye default se BAND rehta hai.",
    stepBattery: "Background me chalne do",
    stepBatterySub: "Battery optimization off — app band ho tab bhi reminder aaye",
    stepOem: "Auto-start on karo",
    stepOemSub: "Phone ki apni setting — Saathi ko background me rehne do",
    allSetTitle: "Sab set hai 🎉",
    testCta: "Test alarm bajaao (1 minute)",
    testScheduled: "Ho gaya — ab phone lock kar do. 1 minute me alarm bajega.",
    testFailed: "Test alarm set nahi ho paya — upar ke steps poore karo.",
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
    longPassword: "Password 72 character se zyada nahi ho sakta",
    pwWeak: "Kamzor",
    pwOk: "Theek hai",
    pwStrong: "Majboot",
    pwHint: "Chhote-bade letter, ek number aur ek symbol milane se password kaafi majboot ho jaata hai",
    confirmSent: "Email pe confirmation link bheja — check karo",
    welcomeNew: "Welcome to Apka Saathi! 🎉",
    welcomeBackToast: "Wapas aa gaye! 🙂",
    somethingWrong: "Kuch gadbad ho gayi",
    googleFailed: "Google login nahi hua",
    forgot: "Password bhool gaye?",
    forgotTitle: "Password reset karo",
    forgotSub: "Apna email daalo — reset ka link bhej denge. Link par tap karke naya password bana lena.",
    forgotSend: "Reset link bhejo",
    forgotSent: "Agar ye email register hai to link bhej diya hai. Inbox (aur spam) dekh lo.",
    forgotBack: "Login par wapas",
    resetLinkDead:
      "Wo link ab nahi chalega — reset ke link ek hi baar chalte hain, aur email app khud unhe pehle khol leti hai. Neeche wala code seedha kaam karega.",
    resetCodeTitle: "Ya email me aaya code daalo",
    resetCodeSub:
      "Usi email me 6 ank ka ek code bhi hai. Link na chale to wahi code yahan daal do — laptop par khula email bhi chalega.",
    resetCodePlaceholder: "6 ank ka code",
    resetCodeSubmit: "Code se aage badho",
    resetCodeNeedsEmail: "Pehle apna email daalo",
    resetCodeBad: "Ye code sahi nahi hai (ya beet chuka hai). Naya bhej ke dobara koshish karo.",
    resetSendAgain: "Naya link aur code bhejo",
    newPassTitle: "Naya password banao",
    newPassSub: "Kam se kam 6 akshar. Yaad rakhne laayak rakhna.",
    newPassLabel: "Naya password",
    newPassPlaceholder: "Naya password",
    newPassConfirm: "Dobara likho",
    newPassMismatch: "Dono password ek jaise nahi hain",
    newPassSave: "Password save karo",
    newPassOk: "Password badal gaya ✓",
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
    download: "Download",
    savedToDevice: "Gallery me save ho gaya",
    saveNeedsPermission: "Save karne ke liye photos ki permission chahiye",
    saveFailedUseShare: "Save nahi ho paaya — Share se try karo",
    renewOpenSite: "Official site kholo",
    renewSoonTitle: "Renew ka tareeka — jald aa raha hai",
    renewSoonBody:
      "Guide taiyar ho rahi hai. Tab tak document par likhi sanstha ki official site dekh lo.",
    renewShowSteps: "Renew kaise karein",
    renewHideSteps: "Chhupa do",
    renewVerifyNote:
      "Ye aam tareeka hai. Official site par ek baar jaanch lo — process aur fees badalti rehti hain.",
    sharedN: "{n} document share hue",
    selectAll: "Sabhi chuno",
    selectCount: "{n} chune",
    shareSelected: "Share ({n})",
    deleted: "Document delete ho gaya",
    deleteConfirmTitle: "Delete karein?",
    deleteConfirmBody: "\"{name}\" hata denge?",
    renewUpdate: "Renew ho gaya? Nayi expiry daalo",
    addExpiry: "Expiry date add karo",
    versionsTitle: "Purane versions",
    versionsCount: "{n} purane version",
    versionLabel: "Version {n}",
    versionExpiry: "Expiry: {date}",
    versionNoExpiry: "Expiry nahi thi",
    versionUntil: "{date} tak chala",
    versionNoFile: "Purani photo abhi nahi khul payi",
    zoomHint: "Bada karke dekho",
  },
  renewDoc: {
    title: "Expiry update karo",
    sub: "Document renew ho gaya ho to bas nayi date daal do — baaki sab waisa hi rahega.",
    lockedNote:
      "Naam aur type nahi badalte — ye wahi document rehna chahiye. Sach me koi doosra document hai to use alag se add karo.",
    photoLabel: "Photo",
    photoKeep: "Purani photo waisi hi rahegi",
    photoNew: "Nayi photo lagegi",
    photoUndo: "Hatao",
    newPhoto: "Nayi photo",
    scanExpiryOnly:
      "Nayi photo lete hi Saathi use khud padh lega aur nayi expiry bhar dega. Na mile to koi baat nahi — bina expiry ke bhi save ho jayega. Naam aur type waise hi rahenge.",
    compareTitle: "Pehle aur ab",
    beforeLabel: "Pehle",
    afterLabel: "Renew ke baad",
    samePhoto: "wahi photo",
    noExpiryShort: "Expiry nahi",
    noPhoto: "Photo nahi",
    expiryLabel: "Nayi expiry date",
    clearExpiry: "Expiry hata do",
    save: "Save karo",
    saved: "Expiry update ho gayi 🎉",
    savedNoNotif: "Expiry update ho gayi — notification permission do to yaad dila dunga",
    savedExpired: "Expiry update ho gayi — par ye date bhi beet chuki hai, reminder nahi lagega",
    savedNoExpiry: "Expiry hata di — ab is document par koi reminder nahi aayega",
    saveFailed: "Save nahi ho paya",
    nothingChanged: "Kuch badla hi nahi",
    notFound: "Ye document mila nahi",
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
    expiryPlaceholder: "Tap karke date chuno",
    save: "Save karo",
    added: "Document add ho gaya 🎉",
    addedNoNotif: "Document add ho gaya — notification permission do to expiry yaad dila dunga",
    limitReached: "Free me itne hi documents — unlimited ke liye Saathi Plus dekhein",
    nameRequired: "Naam daalo (ya photo scan karo)",
    badDate: "Date format: YYYY-MM-DD",
    badDateDay: "Ye taarikh hai hi nahi — {m} {y} me sirf {d} din hote hain",
    expiryPast: "Ye date beet chuki hai — is document ka koi reminder nahi lagega",
    addedExpired: "Document add ho gaya — par expiry beet chuki hai, reminder nahi lagega",
    noExpiryTitle: "Expiry nahi di",
    noExpiryBody:
      "Aadhaar ya PAN jaise documents ki expiry hoti hi nahi — unke liye ye bilkul theek hai. Bas itna jaan lo ki is document par Saathi kabhi yaad nahi dilayega. Expiry ho to upar likh do, baaki aise hi save kar do.",
    addedNoExpiry: "Document add ho gaya — expiry nahi di, isliye koi reminder nahi aayega",
    notifyPlanTitle: "Saathi kab yaad dilayega",
    notifyPlanLead: "{n} din pehle",
    notifyPlanOnDay: "Expiry wale din",
    notifyPlanPassed: "ye din beet chuka hai",
    notifyPlanAtTime: "subah 9 baje",
    notifyPlanNow: "Abhi",
    notifyPlanNowSub: "subah wala waqt nikal chuka hai — Saathi kuch hi der me yaad dila dega",
    photoRequired: "Pehle document ki photo lo ya gallery se chuno — bina photo ke document save nahi hota",
    saveFailed: "Save nahi ho paya",
    cameraPermission: "Camera permission chahiye",
    ocrExpiryFound: "expiry mil gayi",
    ocrReadTpl: "Padh liya: {bits} ✨",
    ocrUnclear: "Padha, par saaf nahi — details khud daal do",
    ocrFailed: "Photo padhne mein dikkat — details khud daal do",
    ocrOffline: "Net nahi hai — photo padhi nahi ja saki. Details khud daal do, ya net aane par dobara scan karo.",
    ocrBusy: "Net dheema hai ya Saathi busy hai — photo padhi nahi ja saki. Thodi der me dobara, ya details khud daal do.",
    imageFailed: "Image select nahi hui",
  },
  reminders: {
    title: "Reminders",
    sub: "Saathi sahi time pe yaad dilayega",
    emptyTitle: "Abhi koi reminder nahi",
    emptyBody: "Neeche + dabake naya reminder banao — bol ke ya type karke.",
    today: "Aaj",
    upcoming: "Aane wale",
    missed: "Chhoot gaye",
    missedHint: "Inka waqt beet chuka hai",
    past: "Ho chuke",
    pastHint: "Inka waqt nikal chuka hai — ya aapne inhe band kar diya tha",
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
    askTitleOne: "Bas ek baat aur",
    askTitleMany: "Bas {n} baatein aur",
    askGotIt: "Saathi ne samjha",
    askNext: "Aage",
    askFinish: "Ho gaya",
    askManual: "Rehne do, khud bhar lunga",
    timeMorning: "Subah 8",
    timeNoon: "Dopahar 1",
    timeEvening: "Shaam 6",
    timeNight: "Raat 9",
    aiOffline: "Net nahi hai — Saathi samajh nahi paaya. Neeche khud chun lo.",
    aiBusy: "Saathi abhi bahut busy hai — thodi der me dobara, ya neeche khud chun lo.",
    aiFailed: "Saathi is baar samajh nahi paaya — neeche khud chun lo.",
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
      "Play Store pe ek chhoti rating se aur parivaar Saathi tak pahunchte hain. Bas 10 second. 🙏",
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
    /**
     * ⚠️ Offline screen ki teenon line chhoti kar di gayi hain.
     *
     * Pehle yahan teen-teen line ke paragraph the. Wo poori screen ka sabse bura
     * waqt hai — user ka kaam ruka hua hai, wo padhne ke mood me hai hi nahi.
     * Ab sirf wahi jo kaam ka hai: kya hua, aur abhi kya kar sakte ho.
     */
    offTitle: "Internet nahi hai",
    offBody: "Save kiye hue documents abhi bhi khul jayenge.",
    offDocsTitle: "Aapke documents",
    offEmpty: "Koi document save nahi hai",
    offEmptyBody: "Net aane par Documents tab ek baar khol lo — sab yahan aa jayenge.",
    offRetry: "Dobara jaancho",
    offChecking: "Jaanch rahe hain…",
    offView: "Dekho",
    offDownload: "Download",
    offShare: "Share",
    offNoFile: "Ye file is phone par save nahi hai — net aane par khol lo",
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
      "Namaste{name}! Main aapka Saathi. Reminder, task ya document ke baare me pooch lo. 🙂",
    stubReply:
      "Filhaal main reminder, task aur document ke sawaal samajhta hoon. 🙂 Baaki bahut jald aa raha hai.",
    inputPlaceholder: "Kuch likho…",
    suggestions: ["Kal 8 baje uthana", "Insurance kab expire hai?", "Aaj kya karna hai?"],
    retrySend: "Dobara bhejo",
    thinking: "Saathi soch raha hai…",
    thinkingLong: "Thoda waqt lag raha hai — jawab bana raha hoon",
    failBusy: "Saathi abhi bahut busy hai. Thodi der me dobara bhejo.",
    failSlow: "Saathi ne is baar der kar di. Dobara bhejo.",
    failServer: "Saathi abhi jawab nahi de paaya. Dobara bhejo.",
    offlineReminderSet: "Net nahi tha, par maine reminder laga diya",
    reminderFailed: "Reminder ban nahi paaya",
    reminderNeedsTime: "Time thoda check kar lo — bas ek tap me set ho jayega",
    settingChanged: "Setting badal di ✓",
    voiceSending: "Bhej raha hoon…",
    voiceStop: "Roko",
  },
  planExpired: {
    title: "Aapka Plus khatam ho gaya",
    safe: "Kuch bhi delete nahi hua",
    body: "Aapka har document aur har reminder waise ka waisa surakshit hai. Account ab free plan par hai, isliye free hadd se aage wale abhi lock hain. Plus wapas lete hi sab usi pal khul jaayega.",
    lockedDocs: "{docs} documents abhi lock hain",
    pausedReminders: "{reminders} reminders abhi pause hain",
    nothingLocked: "Aapka saara data free plan ki hadd me aa jaata hai — kuch bhi lock nahi hua",
    back: "Plus wapas lo",
    later: "Baad me",
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
    mismatchBody:
      "Internet {ip} ka lag raha hai, phone {profile} ka. Kaunse desh ka price dikhayein?\n\nPaisa hamesha aapke Google Play account wale desh se katta hai.",
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
    activating: "Payment ho gaya — Plus thodi der me chalu ho jayega",
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
      "Dost aapke code se join kare, pehla document daale aur ek reminder set kare — dono ko {d} din Plus.",
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
      "Verify hone par hi WhatsApp reminder aap tak pahunchega. Ek digit galat, wo kisi aur ke paas.",
    whatsappNote: "Wahi number daalo jispar WhatsApp chalta hai — message wahin aayega.",
    otpTitle: "{phone} par code bheja hai",
    otpTitleFailed: "Code nahi bheja ja saka",
    otpForPhone: "Number: {phone}",
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
    errCooldown: "Abhi-abhi code bheja hai. Thoda ruk ke dobara bhejo.",
    errTooMany: "Aaj ki SMS limit poori ho gayi. Support se limit reset karwa lo.",
    otpBlockedNote:
      "OTP limit poori ho gayi, abhi naya code nahi ja sakta. Ticket raise karo — hum reset kar denge.",
    otpBlockedCta: "Support me ticket raise karo",
    otpBlockedSubject: "OTP limit reset karo",
    errBlockedCountry: "Is desh me abhi SMS nahi ja sakta.",
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
    theme: "Theme",
    themeSub: "App kaisi dikhe — ujli ya gehri.",
    themeLight: "Light",
    themeLightSub: "Din ki roshni me saaf padhne ke liye",
    themeDark: "Dark",
    themeDarkSub: "Raat me aankhon par naram",
    themeSystem: "Phone ke hisaab se",
    themeSystemSub: "Phone dark hote hi app bhi dark",
    privacy: "Privacy & data",
    exportData: "Mera data export karo",
    deleteAll: "Account delete karwao",
    help: "Help & support",
    about: "About Us",
    logout: "Logout",
    version: "Apka Saathi · v{v} · Made in India",
    langAlertTitle: "Bhasha",
    langAlertBody: "Neeche se apni bhasha chuno — poora app usi me badal jayega.",
    deleteTitle: "Account delete karwana hai?",
    /**
     * ⚠️ Chhota rakha gaya hai, aur wajah seedhi hai: modal ka lamba paragraph
     * koi nahi padhta. Pehle yahan chaar line thi (request, jaanch, kya-kya
     * hatega, tab tak app chalegi) — user uske beech me hi confirm daba deta
     * tha. Sabse zaroori do baatein hi bachi hain: ye wapas nahi aata, aur tab
     * tak app chalti rahegi.
     */
    deleteBody:
      "Jaanch ke baad aapka account aur saara data hamesha ke liye hat jayega. Tab tak app chalti rahegi.",
    deleteYes: "Haan",
    deleted: "Request bhej di — team jald dekhegi",
    deletePending: "Aapki request pehle se darj hai",
    deleteFailed: "Request nahi ja saki — dobara koshish karo",
    deleteAsked: "Request bheji hui hai",
    closedTitle: "Ye account band kar diya gaya hai",
    closedBody:
      "Aapki request par ye account band kar diya gaya. Galti se hua ho to support se baat karo.",
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
    intro: "Ye phone {name} ({email}) ke liye set hai. Login kar sakte ho — pehle itna jaan lo.",
    introNoName: "Ye phone {email} ke liye set hai. Login kar sakte ho — pehle itna jaan lo.",
    notifTitle: "Notification ek waqt me ek hi ID ki",
    notifBody:
      "Aap login karoge to unke reminder is phone par aana band. Dono ek saath nahi chal sakti.",
    aiTitle: "AI sirf usi ka data dekhta hai jo abhi login hai",
    aiBody:
      "Saathi sirf usi ke documents aur reminder padhta hai jo login hai. Unka aapko nahi dikhega.",
    rewardTitle: "Referral ka inaam ek phone par ek hi baar",
    rewardBody:
      "Ek phone par inaam ek hi baar. Yahan pehle liya ja chuka ho to sahi code par bhi nahi milega.",
    advice: "Behtar yahi — apne phone par apni ID. Tabhi sab poori tarah aapke liye chalega.",
    ok: "Samajh gaya, phir bhi chalu rakho",
    logout: "Logout karo",
    bannerTitle: "Ye phone pehle se set hai",
    // ⚠️ "tap karke poori baat padho" yahan se hata diya gaya. Wo line patti ke
    // andar thi, aur patti tap hoti hi nahi thi — user dabata tha, kuch nahi
    // hota tha. Ab wo baat apne alag link me hai (`bannerMore`), jo sach me
    // khulta hai.
    bannerBody:
      "{who} ke liye. Doosri ID se login karoge to notification aur AI unke liye band ho jayenge.",
    bannerMore: "Poori baat padho",
    toast: "Ye phone {who} ke naam par set hai — aapke reminder yahan nahi aayenge.",
  },

  deviceApproval: {
    bannerText: "Is phone par reminder aur alert abhi band hain",
    bannerCta: "Chaalu karo",
    title: "Ye naya phone hai",
    intro:
      "Aapka account pehle se ek doosre phone par chalu hai. Ek waqt me sirf EK phone par hi reminder aate hain — warna ek hi reminder do phone par do alag waqt par bajta hai. Is phone par laane ke liye email par bheja code daal do.",
    alarmTitle: "Reminder ke alarm",
    alarmBody: "Abhi is phone par koi alarm nahi lag raha. Chaalu karte hi sab yahan aa jayenge.",
    notifTitle: "Notification",
    notifBody: "Document expiry aur baaki khabar abhi purane phone par ja rahi hai.",
    dataTitle: "Aapka data surakshit hai",
    dataBody: "Documents aur notes yahan pehle se dikh rahe hain — sirf alarm aur notification ruke hain.",
    sendCode: "Email par code bhejo",
    sending: "Bhej rahe hain…",
    sentTo: "{email} par 6 ank ka code bhej diya hai",
    verify: "Chaalu karo",
    verifying: "Ho raha hai…",
    resend: "Code dobara bhejo",
    resendIn: "Dobara bhejne me {s}s",
    support: "Code nahi aa raha? Support se baat karo",
    later: "Baad me",
    errNoEmail: "Is account par email nahi hai — support se baat karo, wo aapka phone chaalu kar denge.",
    errNotConfigured: "Email bhejne ka setup abhi nahi hai — support se baat karo.",
    errTooMany: "Bahut zyada koshish ho gayi — thodi der baad dobara.",
    errWrongCode: "Code galat hai. Dobara dekh ke daalo.",
    errExpired: "Ye code expire ho gaya — naya mangwa lo.",
    errLocked: "Is code par bahut galat koshish ho gayi — naya code mangwao.",
    errNetwork: "Internet nahi hai — net aane par dobara koshish karo.",
    errFailed: "Kuch gadbad ho gayi — thodi der baad dobara.",
  },
  multiDevice: {
    title: "Aapki ID aur phones par bhi login hai",
    intro: "Is phone ke alawa aapki ID {count} aur phones par login hai. Bas itna jaan lo.",
    introOne: "Is phone ke alawa aapki ID ek aur phone par bhi login hai. Bas itna jaan lo.",
    alarmTitle: "Reminder ka alarm har phone me alag lagta hai",
    alarmBody:
      "Alarm phone ke andar lagta hai, server par nahi. Time yahan badla to doosre phone par purana hi bajega.",
    notifTitle: "Ek hi message har phone par jaayega",
    notifBody:
      "Har logged-in phone par message jaata hai. Do phone hain to do baar aayega — ye galti nahi.",
    privacyTitle: "Aapke documents har us phone par khule hain",
    privacyBody:
      "Jo phone login hai, uspar aapke saare documents khule hain. Phone aapke paas nahi to abhi hata do.",
    advice: "Jo phone use nahi karte, unhe yahin se logout kar do. Yahi phone chalta rahega.",
    ok: "Theek hai, rehne do",
    logoutOthers: "Baaki sab phones se logout karo",
    logoutOthersDone: "Ho gaya — ab sirf yahi phone login hai.",
    logoutOthersFailed: "Nahi ho paya. Net check karke dobara koshish karo.",
  },
  notes: {
    title: "Notes",
    empty: "Abhi koi note nahi",
    emptyHint:
      "Bazaar ka saamaan, koi idea, gaadi ka number — jo yaad rakhna hai par jiska time nahi.",
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
  whatsappSetup: {
    title: "WhatsApp par bhi yaad dila dun?",
    body: "Plus me reminder aur expiry ka message WhatsApp par bhi jaata hai. Number ek baar verify karo.",
    note: "Wahi number daalo jispar WhatsApp chalta hai.",
    cta: "Number verify karo",
  },
  noteReminder: {
    title: "Kab yaad dilaun?",
    whenLabel: "Kab",
    dateLabel: "Taarikh",
    timeLabel: "Waqt",
    repeatLabel: "Dohrao",
    repeatOnce: "Ek baar",
    repeatDaily: "Roz",
    repeatWeekly: "Har hafte",
    pastTime: "Ye waqt beet chuka hai",
    movedToTomorrow: "Aaj ka ye waqt nikal gaya — kal ke liye laga diya",
    saved: "Reminder lag gaya ✓",
    saveFailed: "Reminder set nahi ho paya",
  },
  lock: {
    title: "App lock",
    subtitle: "Fingerprint/face ya PIN ke bina Saathi na khule",
    unlockTitle: "Saathi lock hai",
    unlockSub: "Kholne ke liye apna PIN daalo",
    enterPin: "PIN daalo",
    wrongPin: "PIN galat hai",
    tooManyPin: "Bahut baar galat PIN. {s} second baad dobara koshish karo.",
    forgotPin: "PIN bhool gaye? Email se badlo",
    resetSending: "Code bhej rahe hain…",
    resetTitle: "Email par code aaya hai",
    resetSentTo: "{email} par 6 ank ka code bheja hai",
    resetNewPin: "Naya PIN banao",
    resetNewSub: "4 ank ka naya PIN daalo.",
    resetResend: "Dobara bhejo",
    resetResendIn: "Dobara bhejo ({s}s)",
    resetErrNoEmail: "Is account par email nahi hai. Support se baat karo.",
    resetErrNotConfigured: "Abhi email nahi ja pa rahi. Thodi der baad koshish karo.",
    resetErrTooMany: "Bahut baar code manga. Ek ghante baad koshish karo.",
    resetErrWrongCode: "Code galat hai",
    resetErrExpired: "Code expire ho gaya. Naya mangwao.",
    resetErrLocked: "Is code par bahut koshish ho gayi. Naya mangwao.",
    resetErrFailed: "Nahi ho paya. Dobara koshish karo.",
    resetErrNoNet: "Internet nahi hai",
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
      "Documents is phone me hain. Ek PIN laga do — phone kisi aur ke haath lage to bhi na khule.",
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
    testTitle: "⏰ टेस्ट अलार्म",
    testBody: "यह दिख और सुनाई दे रहा है, तो आपके रिमाइंडर काम करेंगे।",
    expiryToday: "{name} आज एक्सपायर हो रहा है — अभी देख लो। 🙂",
    expiryInDays: "{name} {n} दिन में एक्सपायर हो रहा है। मैं याद दिला रहा हूँ 🙂",
    alertReminder: "रिमाइंडर",
    alertExpiry: "डॉक्युमेंट एक्सपायरी",
    alertOk: "ठीक है, समझ गया",
    alertDid: "क्या आपने यह कर लिया?",
    alertDone: "हाँ, हो गया",
    alertLater: "5 मिनट बाद",
    alertSnoozed: "ठीक है — 5 मिनट बाद फिर याद दिला दूँगा ⏰",
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
    noService: "इस फ़ोन में voice typing बंद है — Google app update/enable करके दोबारा कोशिश करें",
    needsNet: "Voice के लिए इंटरनेट चाहिए — नेट चालू करके दोबारा बोलिए",
    micBusy: "माइक अभी किसी और app के पास है — उसे बंद करके दोबारा बोलिए",
    langMissing: "यह भाषा इस फ़ोन की voice में नहीं है — Settings में language pack इंस्टॉल करें",
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
      "इनके बिना Android रिमाइंडर 5-10 मिनट देर से भेजता है। एक-एक करके Allow दबाएँ — एक बार का काम।",
    promptButton: "सेटअप करें",
    promptLater: "बाद में",
    settingsRow: "रिमाइंडर भरोसेमंद बनाएँ",
    settingsRowSub: "नोटिफ़िकेशन, exact alarm और बैटरी — सब एक जगह",
    stepAllow: "Allow",
    stepConfirmYes: "On कर दिया",
    stepOpenAgain: "फिर से खोलें",
    stepDone: "हो गया",
    stepNotif: "नोटिफ़िकेशन allow करें",
    stepNotifSub: "इसके बिना रिमाइंडर दिखेगा ही नहीं",
    stepAlarm: "Alarms & reminders",
    stepAlarmSub: "इसके बिना Android रिमाइंडर को देर से, दूसरे alarms के साथ भेजता है",
    stepFsi: "पूरी स्क्रीन पर अलर्ट",
    stepFsiSub:
      "इसके बिना सिर्फ़ ऊपर पतली सी नोटिफ़िकेशन आएगी — स्क्रीन के बीच में बड़ा अलर्ट नहीं",
    fsiSpotlight:
      "पूरी स्क्रीन वाला बड़ा अलर्ट इसी से आता है। Android 14 में यह डिफ़ॉल्ट से बंद रहता है।",
    stepBattery: "बैकग्राउंड में चलने दें",
    stepBatterySub: "बैटरी ऑप्टिमाइज़ेशन ऑफ़ — ऐप बंद हो तब भी रिमाइंडर आए",
    stepOem: "ऑटो-स्टार्ट ऑन करें",
    stepOemSub: "फ़ोन की अपनी सेटिंग — साथी को बैकग्राउंड में रहने दें",
    allSetTitle: "सब सेट है 🎉",
    testCta: "टेस्ट अलार्म बजाएँ (1 मिनट)",
    testScheduled: "हो गया — अब फ़ोन लॉक कर दीजिए। 1 मिनट में अलार्म बजेगा।",
    testFailed: "टेस्ट अलार्म सेट नहीं हो पाया — ऊपर के steps पूरे कीजिए।",
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
    longPassword: "पासवर्ड 72 कैरेक्टर से ज़्यादा नहीं हो सकता",
    pwWeak: "कमज़ोर",
    pwOk: "ठीक है",
    pwStrong: "मज़बूत",
    pwHint: "छोटे-बड़े लेटर, एक नंबर और एक सिंबल मिलाने से पासवर्ड काफ़ी मज़बूत हो जाता है",
    confirmSent: "ईमेल पर confirmation link भेजा — चेक करें",
    welcomeNew: "आपके साथी में स्वागत है! 🎉",
    welcomeBackToast: "वापस आ गए! 🙂",
    somethingWrong: "कुछ गड़बड़ हो गई",
    googleFailed: "Google लॉगिन नहीं हुआ",
    forgot: "पासवर्ड भूल गए?",
    forgotTitle: "पासवर्ड रीसेट करें",
    forgotSub: "अपना ईमेल डालिए — रीसेट का लिंक भेज देंगे। लिंक पर टैप करके नया पासवर्ड बना लीजिए।",
    forgotSend: "रीसेट लिंक भेजें",
    forgotSent: "अगर यह ईमेल रजिस्टर है तो लिंक भेज दिया है। इनबॉक्स (और स्पैम) देख लीजिए।",
    forgotBack: "लॉगिन पर वापस",
    resetLinkDead:
      "वह लिंक अब नहीं चलेगा — रीसेट के लिंक एक ही बार चलते हैं, और ईमेल ऐप खुद उन्हें पहले खोल लेती है। नीचे वाला कोड सीधे काम करेगा।",
    resetCodeTitle: "या ईमेल में आया कोड डालिए",
    resetCodeSub:
      "उसी ईमेल में 6 अंकों का एक कोड भी है। लिंक न चले तो वही कोड यहाँ डाल दीजिए — लैपटॉप पर खुला ईमेल भी चलेगा।",
    resetCodePlaceholder: "6 अंकों का कोड",
    resetCodeSubmit: "कोड से आगे बढ़िए",
    resetCodeNeedsEmail: "पहले अपना ईमेल डालिए",
    resetCodeBad: "यह कोड सही नहीं है (या बीत चुका है)। नया भेजकर दोबारा कोशिश कीजिए।",
    resetSendAgain: "नया लिंक और कोड भेजिए",
    newPassTitle: "नया पासवर्ड बनाएँ",
    newPassSub: "कम से कम 6 अक्षर। याद रखने लायक रखिए।",
    newPassLabel: "नया पासवर्ड",
    newPassPlaceholder: "नया पासवर्ड",
    newPassConfirm: "दोबारा लिखिए",
    newPassMismatch: "दोनों पासवर्ड एक जैसे नहीं हैं",
    newPassSave: "पासवर्ड सेव करें",
    newPassOk: "पासवर्ड बदल गया ✓",
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
    download: "डाउनलोड",
    savedToDevice: "गैलरी में सेव हो गया",
    saveNeedsPermission: "सेव करने के लिए फ़ोटो की अनुमति चाहिए",
    saveFailedUseShare: "सेव नहीं हो पाया — शेयर से कोशिश करें",
    renewOpenSite: "आधिकारिक साइट खोलें",
    renewSoonTitle: "रिन्यू का तरीका — जल्द आ रहा है",
    renewSoonBody:
      "गाइड तैयार हो रही है। तब तक डॉक्युमेंट पर लिखी संस्था की आधिकारिक साइट देख लीजिए।",
    renewShowSteps: "रिन्यू कैसे करें",
    renewHideSteps: "छुपा दें",
    renewVerifyNote:
      "यह आम तरीक़ा है। आधिकारिक साइट पर एक बार जाँच लें — प्रक्रिया और फ़ीस बदलती रहती है।",
    sharedN: "{n} डॉक्युमेंट शेयर हुए",
    selectAll: "सभी चुनें",
    selectCount: "{n} चुने",
    shareSelected: "शेयर ({n})",
    deleted: "डॉक्युमेंट डिलीट हो गया",
    deleteConfirmTitle: "डिलीट करें?",
    deleteConfirmBody: "\"{name}\" हटा दें?",
    renewUpdate: "रिन्यू हो गया? नई एक्सपायरी डालें",
    addExpiry: "एक्सपायरी डेट जोड़ें",
    versionsTitle: "पुराने वर्जन",
    versionsCount: "{n} पुराने वर्जन",
    versionLabel: "वर्जन {n}",
    versionExpiry: "एक्सपायरी: {date}",
    versionNoExpiry: "एक्सपायरी नहीं थी",
    versionUntil: "{date} तक चला",
    versionNoFile: "पुरानी फ़ोटो अभी खुल नहीं पाई",
    zoomHint: "बड़ा करके देखें",
  },
  renewDoc: {
    title: "एक्सपायरी अपडेट करें",
    sub: "डॉक्युमेंट रिन्यू हो गया हो तो बस नई डेट डाल दें — बाक़ी सब वैसा ही रहेगा।",
    lockedNote:
      "नाम और टाइप नहीं बदलते — यह वही डॉक्युमेंट रहना चाहिए। सच में कोई दूसरा डॉक्युमेंट है तो उसे अलग से जोड़ें।",
    photoLabel: "फ़ोटो",
    photoKeep: "पुरानी फ़ोटो वैसी ही रहेगी",
    photoNew: "नई फ़ोटो लगेगी",
    photoUndo: "हटाएँ",
    newPhoto: "नई फ़ोटो",
    scanExpiryOnly:
      "नई फ़ोटो लेते ही साथी उसे खुद पढ़ लेगा और नई एक्सपायरी भर देगा। न मिले तो कोई बात नहीं — बिना एक्सपायरी के भी सेव हो जाएगा। नाम और टाइप वैसे ही रहेंगे।",
    compareTitle: "पहले और अब",
    beforeLabel: "पहले",
    afterLabel: "रिन्यू के बाद",
    samePhoto: "वही फ़ोटो",
    noExpiryShort: "एक्सपायरी नहीं",
    noPhoto: "फ़ोटो नहीं",
    expiryLabel: "नई एक्सपायरी डेट",
    clearExpiry: "एक्सपायरी हटा दें",
    save: "सेव करें",
    saved: "एक्सपायरी अपडेट हो गई 🎉",
    savedNoNotif: "एक्सपायरी अपडेट हो गई — notification permission दें तो याद दिला दूँगा",
    savedExpired: "एक्सपायरी अपडेट हो गई — पर यह डेट भी बीत चुकी है, रिमाइंडर नहीं लगेगा",
    savedNoExpiry: "एक्सपायरी हटा दी — अब इस डॉक्युमेंट पर कोई रिमाइंडर नहीं आएगा",
    saveFailed: "सेव नहीं हो पाया",
    nothingChanged: "कुछ बदला ही नहीं",
    notFound: "यह डॉक्युमेंट मिला नहीं",
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
    expiryPlaceholder: "टैप करके डेट चुनें",
    save: "सेव करें",
    added: "डॉक्युमेंट जुड़ गया 🎉",
    addedNoNotif: "डॉक्युमेंट जुड़ गया — notification permission दें तो एक्सपायरी याद दिला दूँगा",
    limitReached: "फ्री में इतने ही डॉक्युमेंट — अनलिमिटेड के लिए साथी प्लस देखें",
    nameRequired: "नाम डालें (या फ़ोटो स्कैन करें)",
    badDate: "डेट फ़ॉर्मैट: YYYY-MM-DD",
    badDateDay: "यह तारीख़ है ही नहीं — {m} {y} में सिर्फ़ {d} दिन होते हैं",
    expiryPast: "यह डेट बीत चुकी है — इस डॉक्यूमेंट का कोई रिमाइंडर नहीं लगेगा",
    addedExpired: "डॉक्यूमेंट जुड़ गया — पर एक्सपायरी बीत चुकी है, रिमाइंडर नहीं लगेगा",
    noExpiryTitle: "एक्सपायरी नहीं दी",
    noExpiryBody:
      "आधार या PAN जैसे डॉक्यूमेंट की एक्सपायरी होती ही नहीं — उनके लिए यह बिल्कुल ठीक है। बस इतना जान लें कि इस डॉक्यूमेंट पर साथी कभी याद नहीं दिलाएगा। एक्सपायरी हो तो ऊपर लिख दें, वरना ऐसे ही सेव कर दें।",
    addedNoExpiry: "डॉक्यूमेंट जुड़ गया — एक्सपायरी नहीं दी, इसलिए कोई रिमाइंडर नहीं आएगा",
    notifyPlanTitle: "साथी कब याद दिलाएगा",
    notifyPlanLead: "{n} दिन पहले",
    notifyPlanOnDay: "एक्सपायरी वाले दिन",
    notifyPlanPassed: "यह दिन बीत चुका है",
    notifyPlanAtTime: "सुबह 9 बजे",
    notifyPlanNow: "अभी",
    notifyPlanNowSub: "सुबह का समय निकल चुका है — साथी थोड़ी ही देर में याद दिला देगा",
    photoRequired: "पहले डॉक्यूमेंट की फ़ोटो लीजिए या गैलरी से चुनिए — बिना फ़ोटो के डॉक्यूमेंट सेव नहीं होता",
    saveFailed: "सेव नहीं हो पाया",
    cameraPermission: "कैमरा permission चाहिए",
    ocrExpiryFound: "एक्सपायरी मिल गई",
    ocrReadTpl: "पढ़ लिया: {bits} ✨",
    ocrUnclear: "पढ़ा, पर साफ़ नहीं — details खुद डाल दें",
    ocrFailed: "फ़ोटो पढ़ने में दिक्कत — details खुद डाल दें",
    ocrOffline: "नेट नहीं है — फ़ोटो पढ़ी नहीं जा सकी। Details खुद डाल दें, या नेट आने पर दोबारा scan करें।",
    ocrBusy: "नेट धीमा है या साथी व्यस्त है — फ़ोटो पढ़ी नहीं जा सकी। थोड़ी देर में दोबारा, या details खुद डाल दें।",
    imageFailed: "इमेज सेलेक्ट नहीं हुई",
  },
  reminders: {
    title: "रिमाइंडर्स",
    sub: "साथी सही समय पर याद दिलाएगा",
    emptyTitle: "अभी कोई रिमाइंडर नहीं",
    emptyBody: "नीचे + दबाकर नया रिमाइंडर बनाएँ — बोलकर या टाइप करके।",
    today: "आज",
    upcoming: "आने वाले",
    missed: "छूट गए",
    missedHint: "इनका समय बीत चुका है",
    past: "हो चुके",
    pastHint: "इनका समय निकल चुका है — या आपने इन्हें बंद कर दिया था",
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
    askTitleOne: "बस एक बात और",
    askTitleMany: "बस {n} बातें और",
    askGotIt: "साथी ने समझा",
    askNext: "आगे",
    askFinish: "हो गया",
    askManual: "रहने दें, मैं खुद भर लूँगा",
    timeMorning: "सुबह 8",
    timeNoon: "दोपहर 1",
    timeEvening: "शाम 6",
    timeNight: "रात 9",
    aiOffline: "नेट नहीं है — साथी समझ नहीं पाया। नीचे खुद चुन लें।",
    aiBusy: "साथी अभी बहुत व्यस्त है — थोड़ी देर में दोबारा, या नीचे खुद चुन लें।",
    aiFailed: "साथी इस बार समझ नहीं पाया — नीचे खुद चुन लें।",
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
      "Play Store पर एक छोटी रेटिंग से और परिवार साथी तक पहुँचते हैं। बस 10 सेकंड। 🙏",
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
    offTitle: "इंटरनेट नहीं है",
    offBody: "सेव किए हुए डॉक्युमेंट अभी भी खुल जाएँगे।",
    offDocsTitle: "आपके डॉक्युमेंट",
    offEmpty: "कोई डॉक्युमेंट सेव नहीं है",
    offEmptyBody: "नेट आने पर Documents टैब एक बार खोल लीजिए — सब यहाँ आ जाएँगे।",
    offRetry: "दोबारा जाँचें",
    offChecking: "जाँच रहे हैं…",
    offView: "देखें",
    offDownload: "डाउनलोड",
    offShare: "शेयर",
    offNoFile: "यह फ़ाइल इस फ़ोन पर सेव नहीं है — नेट आने पर खोल लीजिए",
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
      "नमस्ते{name}! मैं आपका साथी। रिमाइंडर, task या document के बारे में पूछ लें। 🙂",
    stubReply:
      "फ़िलहाल मैं reminder, task और document के सवाल समझता हूँ। 🙂 बाकी बहुत जल्द आ रहा है।",
    inputPlaceholder: "कुछ लिखें…",
    suggestions: ["कल 8 बजे उठाना", "इंश्योरेंस कब एक्सपायर है?", "आज क्या करना है?"],
    retrySend: "दोबारा भेजें",
    thinking: "साथी सोच रहा है…",
    thinkingLong: "थोड़ा वक़्त लग रहा है — जवाब बना रहा हूँ",
    failBusy: "साथी अभी बहुत व्यस्त है। थोड़ी देर में दोबारा भेजें।",
    failSlow: "साथी ने इस बार देर कर दी। दोबारा भेजें।",
    failServer: "साथी अभी जवाब नहीं दे पाया। दोबारा भेजें।",
    offlineReminderSet: "नेट नहीं था, फिर भी मैंने रिमाइंडर लगा दिया",
    reminderFailed: "रिमाइंडर बन नहीं पाया",
    reminderNeedsTime: "समय एक बार देख लीजिए — बस एक टैप में सेट हो जाएगा",
    settingChanged: "सेटिंग बदल दी ✓",
    voiceSending: "भेज रहा हूँ…",
    voiceStop: "रोकें",
  },
  planExpired: {
    title: "आपका Plus खत्म हो गया",
    safe: "कुछ भी डिलीट नहीं हुआ",
    body: "आपका हर डॉक्युमेंट और हर रिमाइंडर वैसे का वैसा सुरक्षित है। अकाउंट अब फ्री प्लान पर है, इसलिए फ्री हद से आगे वाले अभी लॉक हैं। Plus वापस लेते ही सब उसी पल खुल जाएगा।",
    lockedDocs: "{docs} डॉक्युमेंट अभी लॉक हैं",
    pausedReminders: "{reminders} रिमाइंडर अभी पॉज़ हैं",
    nothingLocked: "आपका सारा डेटा फ्री प्लान की हद में आ जाता है — कुछ भी लॉक नहीं हुआ",
    back: "Plus वापस लें",
    later: "बाद में",
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
    mismatchBody:
      "इंटरनेट {ip} का लग रहा है, फ़ोन {profile} का। किस देश का प्राइस दिखाएँ?\n\nपैसा हमेशा आपके Google Play अकाउंट वाले देश से कटता है।",
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
    activating: "पेमेंट हो गया — प्लस थोड़ी देर में चालू हो जाएगा",
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
      "दोस्त आपके कोड से जॉइन करे, पहला डॉक्युमेंट डाले और एक reminder सेट करे — दोनों को {d} दिन प्लस।",
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
      "वेरिफ़ाई होने पर ही WhatsApp रिमाइंडर आप तक पहुँचेगा। एक अंक ग़लत, वह किसी और के पास।",
    whatsappNote: "वही नंबर डालिए जिस पर WhatsApp चलता है — मैसेज वहीं आएगा।",
    otpTitle: "{phone} पर कोड भेजा है",
    otpTitleFailed: "कोड नहीं भेजा जा सका",
    otpForPhone: "नंबर: {phone}",
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
    errCooldown: "अभी-अभी कोड भेजा है। थोड़ा रुककर दोबारा भेजिए।",
    errTooMany: "आज की SMS लिमिट पूरी हो गई। सपोर्ट से लिमिट रीसेट करवा लीजिए।",
    otpBlockedNote:
      "OTP लिमिट पूरी हो गई, अभी नया कोड नहीं जा सकता। टिकट राइज़ कीजिए — हम रीसेट कर देंगे।",
    otpBlockedCta: "सपोर्ट में टिकट राइज़ करें",
    otpBlockedSubject: "OTP लिमिट रीसेट करें",
    errBlockedCountry: "इस देश में अभी SMS नहीं जा सकता।",
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
    theme: "थीम",
    themeSub: "ऐप कैसी दिखे — उजली या गहरी।",
    themeLight: "लाइट",
    themeLightSub: "दिन की रोशनी में साफ़ पढ़ने के लिए",
    themeDark: "डार्क",
    themeDarkSub: "रात में आँखों पर नरम",
    themeSystem: "फ़ोन के हिसाब से",
    themeSystemSub: "फ़ोन डार्क होते ही ऐप भी डार्क",
    privacy: "प्राइवेसी & डेटा",
    exportData: "मेरा डेटा export करें",
    deleteAll: "अकाउंट डिलीट करवाएँ",
    help: "हेल्प & support",
    about: "हमारे बारे में",
    logout: "लॉगआउट",
    version: "Apka Saathi · v{v} · Made in India",
    langAlertTitle: "भाषा",
    langAlertBody: "नीचे से अपनी भाषा चुनें — पूरा app उसी में बदल जाएगा।",
    deleteTitle: "अकाउंट डिलीट करवाना है?",
    deleteBody:
      "जाँच के बाद आपका अकाउंट और सारा डेटा हमेशा के लिए हट जाएगा। तब तक ऐप चलती रहेगी।",
    deleteYes: "हाँ",
    deleted: "Request भेज दी — team जल्द देखेगी",
    deletePending: "आपकी request पहले से दर्ज है",
    deleteFailed: "Request नहीं जा सकी — दोबारा कोशिश करें",
    deleteAsked: "Request भेजी हुई है",
    closedTitle: "यह अकाउंट बंद कर दिया गया है",
    closedBody:
      "आपकी request पर यह अकाउंट बंद कर दिया गया। ग़लती से हुआ हो तो support से बात करें।",
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
    intro: "यह फ़ोन {name} ({email}) के लिए सेट है। लॉगिन कर सकते हैं — पहले इतना जान लीजिए।",
    introNoName: "यह फ़ोन {email} के लिए सेट है। लॉगिन कर सकते हैं — पहले इतना जान लीजिए।",
    notifTitle: "नोटिफ़िकेशन एक समय में एक ही ID की",
    notifBody:
      "आप लॉगिन करेंगे तो उनके रिमाइंडर इस फ़ोन पर आना बंद। दोनों एक साथ नहीं चल सकतीं।",
    aiTitle: "AI सिर्फ़ उसी का डेटा देखता है जो अभी लॉगिन है",
    aiBody:
      "साथी सिर्फ़ उसी के डॉक्यूमेंट और रिमाइंडर पढ़ता है जो लॉगिन है। उनका आपको नहीं दिखेगा।",
    rewardTitle: "रेफ़रल का इनाम एक फ़ोन पर एक ही बार",
    rewardBody:
      "एक फ़ोन पर इनाम एक ही बार। यहाँ पहले लिया जा चुका हो तो सही कोड पर भी नहीं मिलेगा।",
    advice: "बेहतर यही — अपने फ़ोन पर अपनी ID। तभी सब पूरी तरह आपके लिए चलेगा।",
    ok: "समझ गया, फिर भी चालू रखें",
    logout: "लॉगआउट करें",
    bannerTitle: "यह फ़ोन पहले से सेट है",
    bannerBody:
      "{who} के लिए। दूसरी ID से लॉगिन करेंगे तो नोटिफ़िकेशन और AI उनके लिए बंद हो जाएँगे।",
    bannerMore: "पूरी बात पढ़िए",
    toast: "यह फ़ोन {who} के नाम पर सेट है — आपके रिमाइंडर यहाँ नहीं आएँगे।",
  },

  deviceApproval: {
    bannerText: "इस फ़ोन पर रिमाइंडर और अलर्ट अभी बंद हैं",
    bannerCta: "चालू करें",
    title: "यह नया फ़ोन है",
    intro:
      "आपका अकाउंट पहले से एक दूसरे फ़ोन पर चालू है। एक समय में सिर्फ़ एक ही फ़ोन पर रिमाइंडर आते हैं — वरना एक ही रिमाइंडर दो फ़ोन पर दो अलग समय पर बजता है। इस फ़ोन पर लाने के लिए email पर भेजा कोड डालिए।",
    alarmTitle: "रिमाइंडर के अलार्म",
    alarmBody: "अभी इस फ़ोन पर कोई अलार्म नहीं लग रहा। चालू करते ही सब यहाँ आ जाएँगे।",
    notifTitle: "नोटिफ़िकेशन",
    notifBody: "डॉक्युमेंट एक्सपायरी और बाक़ी ख़बर अभी पुराने फ़ोन पर जा रही है।",
    dataTitle: "आपका डेटा सुरक्षित है",
    dataBody: "डॉक्युमेंट और नोट्स यहाँ पहले से दिख रहे हैं — सिर्फ़ अलार्म और नोटिफ़िकेशन रुके हैं।",
    sendCode: "Email पर कोड भेजें",
    sending: "भेज रहे हैं…",
    sentTo: "{email} पर 6 अंक का कोड भेज दिया है",
    verify: "चालू करें",
    verifying: "हो रहा है…",
    resend: "कोड दोबारा भेजें",
    resendIn: "दोबारा भेजने में {s}s",
    support: "कोड नहीं आ रहा? सपोर्ट से बात करें",
    later: "बाद में",
    errNoEmail: "इस अकाउंट पर email नहीं है — सपोर्ट से बात करें, वे आपका फ़ोन चालू कर देंगे।",
    errNotConfigured: "Email भेजने का सेटअप अभी नहीं है — सपोर्ट से बात करें।",
    errTooMany: "बहुत ज़्यादा कोशिश हो गई — थोड़ी देर बाद दोबारा।",
    errWrongCode: "कोड ग़लत है। दोबारा देख कर डालिए।",
    errExpired: "यह कोड एक्सपायर हो गया — नया मँगवा लीजिए।",
    errLocked: "इस कोड पर बहुत ग़लत कोशिश हो गई — नया कोड मँगवाइए।",
    errNetwork: "इंटरनेट नहीं है — नेट आने पर दोबारा कोशिश करें।",
    errFailed: "कुछ गड़बड़ हो गई — थोड़ी देर बाद दोबारा।",
  },
  multiDevice: {
    title: "आपकी ID और फ़ोनों पर भी लॉगिन है",
    intro: "इस फ़ोन के अलावा आपकी ID {count} और फ़ोनों पर लॉगिन है। बस इतना जान लीजिए।",
    introOne: "इस फ़ोन के अलावा आपकी ID एक और फ़ोन पर भी लॉगिन है। बस इतना जान लीजिए।",
    alarmTitle: "रिमाइंडर का अलार्म हर फ़ोन में अलग लगता है",
    alarmBody:
      "अलार्म फ़ोन के अंदर लगता है, सर्वर पर नहीं। समय यहाँ बदला तो दूसरे फ़ोन पर पुराना ही बजेगा।",
    notifTitle: "एक ही मैसेज हर फ़ोन पर जाएगा",
    notifBody:
      "हर लॉगिन फ़ोन पर मैसेज जाता है। दो फ़ोन हैं तो दो बार आएगा — यह ग़लती नहीं।",
    privacyTitle: "आपके डॉक्यूमेंट हर उस फ़ोन पर खुले हैं",
    privacyBody:
      "जो फ़ोन लॉगिन है, उस पर आपके सारे डॉक्यूमेंट खुले हैं। फ़ोन आपके पास नहीं तो अभी हटा दीजिए।",
    advice: "जो फ़ोन इस्तेमाल नहीं करते, उन्हें यहीं से लॉगआउट कर दीजिए। यही फ़ोन चलता रहेगा।",
    ok: "ठीक है, रहने दीजिए",
    logoutOthers: "बाक़ी सब फ़ोनों से लॉगआउट करें",
    logoutOthersDone: "हो गया — अब सिर्फ़ यही फ़ोन लॉगिन है।",
    logoutOthersFailed: "नहीं हो पाया। नेट देखकर दोबारा कोशिश कीजिए।",
  },
  notes: {
    title: "नोट्स",
    empty: "अभी कोई नोट नहीं",
    emptyHint:
      "बाज़ार का सामान, कोई आइडिया, गाड़ी का नंबर — जो याद रखना है पर जिसका समय नहीं।",
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
  whatsappSetup: {
    title: "WhatsApp पर भी याद दिला दूँ?",
    body: "प्लस में रिमाइंडर और एक्सपायरी का मैसेज WhatsApp पर भी जाता है। नंबर एक बार वेरिफ़ाई करें।",
    note: "वही नंबर डालिए जिस पर WhatsApp चलता है।",
    cta: "नंबर वेरिफ़ाई करें",
  },
  noteReminder: {
    title: "कब याद दिलाऊँ?",
    whenLabel: "कब",
    dateLabel: "तारीख़",
    timeLabel: "समय",
    repeatLabel: "दोहराएँ",
    repeatOnce: "एक बार",
    repeatDaily: "रोज़",
    repeatWeekly: "हर हफ़्ते",
    pastTime: "यह समय बीत चुका है",
    movedToTomorrow: "आज का यह समय निकल गया — कल के लिए लगा दिया",
    saved: "रिमाइंडर लग गया ✓",
    saveFailed: "रिमाइंडर सेट नहीं हो पाया",
  },
  lock: {
    title: "ऐप लॉक",
    subtitle: "फ़िंगरप्रिंट/फ़ेस या PIN के बिना साथी न खुले",
    unlockTitle: "साथी लॉक है",
    unlockSub: "खोलने के लिए अपना PIN डालिए",
    enterPin: "PIN डालिए",
    wrongPin: "PIN ग़लत है",
    tooManyPin: "बहुत बार ग़लत PIN। {s} सेकंड बाद दोबारा कोशिश कीजिए।",
    forgotPin: "PIN भूल गए? ईमेल से बदलिए",
    resetSending: "कोड भेज रहे हैं…",
    resetTitle: "ईमेल पर कोड आया है",
    resetSentTo: "{email} पर 6 अंक का कोड भेजा है",
    resetNewPin: "नया PIN बनाइए",
    resetNewSub: "4 अंक का नया PIN डालिए।",
    resetResend: "दोबारा भेजें",
    resetResendIn: "दोबारा भेजें ({s}s)",
    resetErrNoEmail: "इस अकाउंट पर ईमेल नहीं है। सपोर्ट से बात कीजिए।",
    resetErrNotConfigured: "अभी ईमेल नहीं जा पा रही। थोड़ी देर बाद कोशिश कीजिए।",
    resetErrTooMany: "बहुत बार कोड माँगा। एक घंटे बाद कोशिश कीजिए।",
    resetErrWrongCode: "कोड ग़लत है",
    resetErrExpired: "कोड एक्सपायर हो गया। नया मँगवाइए।",
    resetErrLocked: "इस कोड पर बहुत कोशिश हो गई। नया मँगवाइए।",
    resetErrFailed: "नहीं हो पाया। दोबारा कोशिश कीजिए।",
    resetErrNoNet: "इंटरनेट नहीं है",
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
      "डॉक्यूमेंट इसी फ़ोन में हैं। एक PIN लगा दीजिए — फ़ोन किसी और के हाथ लगे तो भी न खुले।",
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
    testTitle: "⏰ Test alarm",
    testBody: "If you can see and hear this, your reminders will work.",
    expiryToday: "{name} expires today — take a look now. 🙂",
    expiryInDays: "{name} expires in {n} days. Just a heads-up 🙂",
    alertReminder: "Reminder",
    alertExpiry: "Document expiry",
    alertOk: "Okay, got it",
    alertDid: "Did you do this?",
    alertDone: "Yes, done",
    alertLater: "In 5 min",
    alertSnoozed: "Okay — I'll remind you again in 5 minutes ⏰",
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
    noService: "Voice typing is off on this phone — update or enable the Google app and try again",
    needsNet: "Voice needs the internet — turn it on and speak again",
    micBusy: "Another app is using the mic — close it and speak again",
    langMissing: "This language isn't in your phone's voice — install the language pack in Settings",
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
      "Without these, Android delivers reminders 5-10 minutes late. Tap Allow on each — a one-time setup.",
    promptButton: "Set up",
    promptLater: "Later",
    settingsRow: "Make reminders reliable",
    settingsRowSub: "Notifications, exact alarms and battery — all in one place",
    stepAllow: "Allow",
    stepConfirmYes: "I turned it on",
    stepOpenAgain: "Open again",
    stepDone: "Done",
    stepNotif: "Allow notifications",
    stepNotifSub: "Without this, reminders never show up",
    stepAlarm: "Alarms & reminders",
    stepAlarmSub: "Without this, Android batches your reminder with other alarms and delivers it late",
    stepFsi: "Full-screen alert",
    stepFsiSub:
      "Without this you only get a thin notification at the top — no big alert in the middle of the screen",
    fsiSpotlight:
      "This is what makes the alert fill the screen. Android 14 turns it OFF by default.",
    stepBattery: "Allow background activity",
    stepBatterySub: "Battery optimization off — reminders fire even when the app is closed",
    stepOem: "Turn on auto-start",
    stepOemSub: "Your phone's own setting — let Saathi stay in the background",
    allSetTitle: "All set 🎉",
    testCta: "Ring a test alarm (1 minute)",
    testScheduled: "Done — now lock your phone. The alarm rings in 1 minute.",
    testFailed: "Couldn't set the test alarm — finish the steps above.",
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
    longPassword: "A password can't be longer than 72 characters",
    pwWeak: "Weak",
    pwOk: "Okay",
    pwStrong: "Strong",
    pwHint: "Mixing upper and lower case, a number and a symbol makes a password much stronger",
    confirmSent: "Sent a confirmation link to your email — please check",
    welcomeNew: "Welcome to Apka Saathi! 🎉",
    welcomeBackToast: "Welcome back! 🙂",
    somethingWrong: "Something went wrong",
    googleFailed: "Google sign-in failed",
    forgot: "Forgot your password?",
    forgotTitle: "Reset your password",
    forgotSub: "Enter your email and we'll send a reset link. Tap it to set a new password.",
    forgotSend: "Send reset link",
    forgotSent: "If that email is registered, the link is on its way. Check your inbox (and spam).",
    forgotBack: "Back to login",
    resetLinkDead:
      "That link won't work any more — reset links are single-use, and mail apps often open them before you do. The code below will work instead.",
    resetCodeTitle: "Or enter the code from the email",
    resetCodeSub:
      "The same email also has a 6-digit code. If the link doesn't work, type that code here — it works even if the email is open on a laptop.",
    resetCodePlaceholder: "6-digit code",
    resetCodeSubmit: "Continue with code",
    resetCodeNeedsEmail: "Enter your email first",
    resetCodeBad: "That code isn't right (or has expired). Send a new one and try again.",
    resetSendAgain: "Send a new link and code",
    newPassTitle: "Set a new password",
    newPassSub: "At least 6 characters. Pick something you'll remember.",
    newPassLabel: "New password",
    newPassPlaceholder: "New password",
    newPassConfirm: "Type it again",
    newPassMismatch: "The two passwords don't match",
    newPassSave: "Save password",
    newPassOk: "Password changed ✓",
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
    download: "Download",
    savedToDevice: "Saved to your gallery",
    saveNeedsPermission: "Saving needs photo permission",
    saveFailedUseShare: "Couldn't save — try Share instead",
    renewOpenSite: "Open official site",
    renewSoonTitle: "How to renew — coming soon",
    renewSoonBody:
      "A step-by-step guide is on the way. Until then, check the issuing authority's official site.",
    renewShowSteps: "How to renew",
    renewHideSteps: "Hide",
    renewVerifyNote:
      "This is the general process. Check the official site once — steps and fees change.",
    sharedN: "{n} document(s) shared",
    selectAll: "Select all",
    selectCount: "{n} selected",
    shareSelected: "Share ({n})",
    deleted: "Document deleted",
    deleteConfirmTitle: "Delete?",
    deleteConfirmBody: "Remove \"{name}\"?",
    renewUpdate: "Renewed? Add the new expiry",
    addExpiry: "Add an expiry date",
    versionsTitle: "Older versions",
    versionsCount: "{n} older versions",
    versionLabel: "Version {n}",
    versionExpiry: "Expiry: {date}",
    versionNoExpiry: "No expiry date",
    versionUntil: "Used until {date}",
    versionNoFile: "Couldn't open the old photo",
    zoomHint: "Tap to enlarge",
  },
  renewDoc: {
    title: "Update expiry",
    sub: "If the document has been renewed, just put in the new date — everything else stays as it is.",
    lockedNote:
      "The name and type don't change — this has to stay the same document. If it really is a different one, add it separately.",
    photoLabel: "Photo",
    photoKeep: "The old photo stays",
    photoNew: "The new photo will be used",
    photoUndo: "Remove",
    newPhoto: "New photo",
    scanExpiryOnly:
      "As soon as you add a new photo Saathi reads it and fills in the new expiry. If there isn't one that's fine — it saves without an expiry too. The name and type stay as they are.",
    compareTitle: "Before and after",
    beforeLabel: "Before",
    afterLabel: "After renewal",
    samePhoto: "same photo",
    noExpiryShort: "No expiry",
    noPhoto: "No photo",
    expiryLabel: "New expiry date",
    clearExpiry: "Remove the expiry",
    save: "Save",
    saved: "Expiry updated 🎉",
    savedNoNotif: "Expiry updated — allow notifications and I'll remind you",
    savedExpired: "Expiry updated — but this date has passed too, so no reminder will be set",
    savedNoExpiry: "Expiry removed — no reminder will come for this document now",
    saveFailed: "Couldn't save",
    nothingChanged: "Nothing changed",
    notFound: "Couldn't find this document",
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
    expiryPlaceholder: "Tap to pick a date",
    save: "Save",
    added: "Document added 🎉",
    addedNoNotif: "Document added — allow notifications and I'll remind you of the expiry",
    limitReached: "You've reached the Free limit — Saathi Plus for unlimited",
    nameRequired: "Enter a name (or scan a photo)",
    badDate: "Date format: YYYY-MM-DD",
    badDateDay: "That date doesn't exist — {m} {y} only has {d} days",
    expiryPast: "This date has already passed — no reminder will be set for this document",
    addedExpired: "Document added — but the expiry has passed, so no reminder will be set",
    noExpiryTitle: "No expiry date",
    noExpiryBody:
      "Documents like Aadhaar and PAN never expire — for those this is exactly right. Just know that Saathi will never remind you about this one. If it does have an expiry, add it above; otherwise save it as it is.",
    addedNoExpiry: "Document added — no expiry date, so no reminder will come",
    notifyPlanTitle: "When Saathi will remind you",
    notifyPlanLead: "{n} days before",
    notifyPlanOnDay: "On the expiry day",
    notifyPlanPassed: "this day has already passed",
    notifyPlanAtTime: "at 9 in the morning",
    notifyPlanNow: "Right away",
    notifyPlanNowSub: "the morning slot has passed — Saathi will remind you in a few minutes",
    photoRequired: "Take a photo of the document or pick one from the gallery — a document can't be saved without it",
    saveFailed: "Couldn't save",
    cameraPermission: "Camera permission needed",
    ocrExpiryFound: "found the expiry",
    ocrReadTpl: "Read it: {bits} ✨",
    ocrUnclear: "Read it, but it wasn't clear — please fill in the details",
    ocrFailed: "Trouble reading the photo — please fill in the details",
    ocrOffline: "No internet — couldn't read the photo. Fill in the details yourself, or scan again once you're back online.",
    ocrBusy: "Slow connection or Saathi is busy — couldn't read the photo. Try again shortly, or fill in the details yourself.",
    imageFailed: "Couldn't select the image",
  },
  reminders: {
    title: "Reminders",
    sub: "Saathi will remind you at the right time",
    emptyTitle: "No reminders yet",
    emptyBody: "Tap + below to create one — by voice or typing.",
    today: "Today",
    upcoming: "Upcoming",
    missed: "Missed",
    missedHint: "These are already past their time",
    past: "Done & past",
    pastHint: "Their time has passed — or you switched them off",
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
    askTitleOne: "Just one more thing",
    askTitleMany: "Just {n} more things",
    askGotIt: "Saathi understood",
    askNext: "Next",
    askFinish: "Done",
    askManual: "Skip, I'll fill it in",
    timeMorning: "8 AM",
    timeNoon: "1 PM",
    timeEvening: "6 PM",
    timeNight: "9 PM",
    aiOffline: "No internet — Saathi couldn't read that. Pick it below yourself.",
    aiBusy: "Saathi is very busy right now — try again shortly, or pick it below.",
    aiFailed: "Saathi couldn't read that this time — pick it below yourself.",
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
      "A quick rating on the Play Store helps other families find Saathi. Takes 10 seconds. 🙏",
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
    offTitle: "No internet",
    offBody: "Your saved documents still open.",
    offDocsTitle: "Your documents",
    offEmpty: "No documents saved yet",
    offEmptyBody: "Open the Documents tab once you're online — they'll all show up here.",
    offRetry: "Check again",
    offChecking: "Checking…",
    offView: "View",
    offDownload: "Download",
    offShare: "Share",
    offNoFile: "This file isn't saved on this phone — open it when you're online",
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
      "Hello{name}! I'm your Saathi. Ask me about a reminder, task or document. 🙂",
    stubReply:
      "For now I understand questions about your reminders, tasks and documents. 🙂 More is coming soon.",
    inputPlaceholder: "Type something…",
    suggestions: ["Wake me at 8am", "When does my insurance expire?", "What's on today?"],
    retrySend: "Send again",
    thinking: "Saathi is thinking…",
    thinkingLong: "This is taking a little longer — still working on it",
    failBusy: "Saathi is very busy right now. Try again in a moment.",
    failSlow: "Saathi took too long this time. Send it again.",
    failServer: "Saathi couldn't answer just now. Send it again.",
    offlineReminderSet: "No internet, but I've set the reminder",
    reminderFailed: "Couldn't create the reminder",
    reminderNeedsTime: "Just check the time — one tap and it's set",
    settingChanged: "Setting changed ✓",
    voiceSending: "Sending…",
    voiceStop: "Stop",
  },
  planExpired: {
    title: "Your Plus has ended",
    safe: "Nothing has been deleted",
    body: "Every document and every reminder is exactly where you left it. Your account is on the free plan now, so anything beyond the free limit is locked for the moment. Take Plus again and all of it unlocks instantly.",
    lockedDocs: "{docs} documents are locked for now",
    pausedReminders: "{reminders} reminders are paused for now",
    nothingLocked: "Everything you have fits within the free plan — nothing is locked",
    back: "Get Plus back",
    later: "Later",
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
    mismatchBody:
      "Your internet looks like {ip}, your phone like {profile}. Which country's price?\n\nYou're always charged in your Google Play account's country.",
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
    activating: "Payment received — Plus will switch on shortly",
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
      "Your friend joins with your code, adds a document and sets one reminder — you both get {d} days of Plus.",
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
      "WhatsApp reminders only reach you once the number is verified. One wrong digit sends them elsewhere.",
    whatsappNote: "Use the number your WhatsApp is on — that's where messages go.",
    otpTitle: "Code sent to {phone}",
    otpTitleFailed: "Couldn't send the code",
    otpForPhone: "Number: {phone}",
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
    errCooldown: "A code just went out. Wait a moment and send again.",
    errTooMany: "You've hit today's SMS limit. Ask support to reset it.",
    otpBlockedNote:
      "You've hit the OTP limit, so no new code can go out. Raise a ticket — we'll reset it.",
    otpBlockedCta: "Raise a support ticket",
    otpBlockedSubject: "Reset my OTP limit",
    errBlockedCountry: "We can't send SMS to this country yet.",
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
    theme: "Theme",
    themeSub: "How the app looks — light or dark.",
    themeLight: "Light",
    themeLightSub: "Easier to read in daylight",
    themeDark: "Dark",
    themeDarkSub: "Gentler on the eyes at night",
    themeSystem: "Match my phone",
    themeSystemSub: "Goes dark when your phone does",
    privacy: "Privacy & data",
    exportData: "Export my data",
    deleteAll: "Request account deletion",
    help: "Help & support",
    about: "About Us",
    logout: "Log out",
    version: "Apka Saathi · v{v} · Made in India",
    langAlertTitle: "Language",
    langAlertBody: "Pick your language below — the whole app switches to it.",
    deleteTitle: "Request account deletion?",
    deleteBody:
      "After a review, your account and all its data are gone for good. You can use the app until then.",
    deleteYes: "Yes",
    deleted: "Request sent — our team will review it soon",
    deletePending: "Your request is already with us",
    deleteFailed: "Couldn't send the request — please try again",
    deleteAsked: "Request sent",
    closedTitle: "This account has been closed",
    closedBody:
      "We closed this account at your request. If that was a mistake, talk to support.",
    linkFailed: "Couldn't open the link",
    exportContact: "For a data export, please reach out via Help",
    settingsFailed: "Couldn't open settings",
  },
  support: {
    title: "Support",
    sub: "Not working, or just a question? Write here — each request gets a number, and the reply lands here.",
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
    intro: "This phone is set up for {name} ({email}). You can still sign in — just read this first.",
    introNoName: "This phone is set up for {email}. You can still sign in — just read this first.",
    notifTitle: "Notifications belong to one ID at a time",
    notifBody:
      "Sign in here and their reminders stop arriving on this phone. The two can't run together.",
    aiTitle: "The AI only sees whoever is signed in",
    aiBody:
      "Saathi only reads the signed-in person's documents and reminders. Theirs stay hidden from you.",
    rewardTitle: "One referral reward per phone",
    rewardBody:
      "One reward per phone. If it's already been claimed here, even a valid code won't pay out.",
    advice: "Best is simple: your own ID on your own phone. Then everything works fully for you.",
    ok: "I understand, continue anyway",
    logout: "Sign out",
    bannerTitle: "This phone is already set up",
    bannerBody:
      "For {who}. Signing in with a different ID turns off their notifications and AI.",
    bannerMore: "Read what changes",
    toast: "This phone is set up for {who} — your reminders won't arrive here.",
  },

  deviceApproval: {
    bannerText: "Reminders and alerts are off on this phone",
    bannerCta: "Turn on",
    title: "This is a new phone",
    intro:
      "Your account is already active on another phone. Reminders only ever go to ONE phone at a time — otherwise the same reminder rings at two different times on two phones. Enter the code we email you to move them here.",
    alarmTitle: "Reminder alarms",
    alarmBody: "No alarms are being set on this phone right now. Turn it on and they all move here.",
    notifTitle: "Notifications",
    notifBody: "Document expiry and other alerts are still going to your old phone.",
    dataTitle: "Your data is safe",
    dataBody: "Documents and notes already show here — only alarms and notifications are paused.",
    sendCode: "Email me a code",
    sending: "Sending…",
    sentTo: "We sent a 6-digit code to {email}",
    verify: "Turn on",
    verifying: "Working…",
    resend: "Send the code again",
    resendIn: "Resend in {s}s",
    support: "Code not arriving? Talk to support",
    later: "Later",
    errNoEmail: "There's no email on this account — talk to support and they'll turn your phone on.",
    errNotConfigured: "Email isn't set up yet — please talk to support.",
    errTooMany: "Too many attempts — please try again in a little while.",
    errWrongCode: "That code is wrong. Please check and try again.",
    errExpired: "That code has expired — ask for a new one.",
    errLocked: "Too many wrong attempts on that code — ask for a new one.",
    errNetwork: "No internet — try again once you're back online.",
    errFailed: "Something went wrong — please try again shortly.",
  },
  multiDevice: {
    title: "Your ID is signed in on other phones too",
    intro: "Besides this phone, your ID is signed in on {count} others. Just worth knowing.",
    introOne: "Besides this phone, your ID is signed in on one other phone. Just worth knowing.",
    alarmTitle: "Reminder alarms are set on each phone separately",
    alarmBody:
      "Alarms live on the phone, not the server. Change the time here and the other phone rings the old one.",
    notifTitle: "The same message goes to every phone",
    notifBody:
      "Every signed-in phone gets the message. Two phones means it arrives twice — not a fault.",
    privacyTitle: "Your documents are open on every one of those phones",
    privacyBody:
      "Any signed-in phone shows all your documents. If a phone isn't with you, remove it now.",
    advice: "Sign out the phones you no longer use, right here. This phone stays signed in.",
    ok: "That's fine, leave it",
    logoutOthers: "Sign out all other phones",
    logoutOthersDone: "Done — only this phone is signed in now.",
    logoutOthersFailed: "Couldn't do it. Check your connection and try again.",
  },
  notes: {
    title: "Notes",
    empty: "No notes yet",
    emptyHint:
      "A shopping list, an idea, a car number — worth keeping, but with no time attached.",
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
  whatsappSetup: {
    title: "Want these on WhatsApp too?",
    body: "With Plus, reminders and expiry alerts also go to WhatsApp. Just verify your number once.",
    note: "Use the number your WhatsApp is on.",
    cta: "Verify my number",
  },
  noteReminder: {
    title: "When should I remind you?",
    whenLabel: "When",
    dateLabel: "Date",
    timeLabel: "Time",
    repeatLabel: "Repeat",
    repeatOnce: "Once",
    repeatDaily: "Daily",
    repeatWeekly: "Weekly",
    pastTime: "That time has already passed",
    movedToTomorrow: "That time has passed today — set for tomorrow",
    saved: "Reminder set ✓",
    saveFailed: "Couldn't set the reminder",
  },
  lock: {
    title: "App lock",
    subtitle: "Saathi won't open without your fingerprint, face or PIN",
    unlockTitle: "Saathi is locked",
    unlockSub: "Enter your PIN to open it",
    enterPin: "Enter PIN",
    wrongPin: "That PIN isn't right",
    tooManyPin: "Too many wrong tries. Try again in {s} seconds.",
    forgotPin: "Forgot your PIN? Change it by email",
    resetSending: "Sending code…",
    resetTitle: "Check your email",
    resetSentTo: "We sent a 6-digit code to {email}",
    resetNewPin: "Create a new PIN",
    resetNewSub: "Enter a new 4-digit PIN.",
    resetResend: "Send again",
    resetResendIn: "Send again ({s}s)",
    resetErrNoEmail: "This account has no email. Please contact support.",
    resetErrNotConfigured: "Email isn't going out right now. Try again shortly.",
    resetErrTooMany: "Too many codes requested. Try again in an hour.",
    resetErrWrongCode: "That code isn't right",
    resetErrExpired: "That code expired. Ask for a new one.",
    resetErrLocked: "Too many tries on that code. Ask for a new one.",
    resetErrFailed: "Couldn't do it. Please try again.",
    resetErrNoNet: "No internet",
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
      "Your documents live on this phone. Set a PIN so nobody else can open them, even holding it.",
    offerYes: "Yes, lock it",
    offerNo: "Not now",
  },
};

export const dictionaries: Record<Locale, Dict> = { hinglish, hi, en };
