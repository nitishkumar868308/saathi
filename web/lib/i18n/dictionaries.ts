/**
 * Saathi i18n dictionaries.
 *
 * Default locale = "hinglish" (aapki current bhasha — bilkul waisa hi jaisa abhi hai).
 * Baaki: "hi" (shudh Hindi / Devanagari) aur "en" (English).
 *
 * Naya string add karna ho: teeno locales mein add karo, key same rakho.
 */

export const LOCALES = ["hinglish", "hi", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "hinglish";

export const LOCALE_META: Record<
  Locale,
  { label: string; short: string; flag: string }
> = {
  hinglish: { label: "Hinglish", short: "HN", flag: "🇮🇳" },
  hi: { label: "हिंदी", short: "हि", flag: "🇮🇳" },
  en: { label: "English", short: "EN", flag: "🇬🇧" },
};

type Dict = {
  /**
   * Screen-reader ke liye labels — jo aankh se nahi dikhte.
   *
   * ⚠️ Ye jaan-boojh ke alag rakhe hain. Aise label sabse aasani se hardcoded
   *    reh jaate hain (screen par kuch dikhta hi nahi, to review me pakde bhi
   *    nahi jaate) — aur jo log inhi ke sahare app chalate hain, unke liye ye
   *    poore page jitne zaroori hain. Bhasha badle to ye bhi badalne chahiye.
   */
  a11y: { close: string; changeLanguage: string };
  /** Light / dark / system ka toggle. */
  theme: { label: string; light: string; dark: string; system: string };
  nav: {
    earlyAccess: string;
    home: string;
    blog: string;
    about: string;
    contact: string;
    backHome: string;
    invite: string;
    menu: string;
  };
  about: {
    badge: string;
    heading: string;
    lead: string;
    body: string[];
    valuesHeading: string;
    values: { title: string; body: string }[];
  };
  contact: {
    badge: string;
    heading: string;
    sub: string;
    name: string;
    namePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    message: string;
    messagePlaceholder: string;
    submit: string;
    sending: string;
    successToast: string;
    errorToast: string;
    invalid: string;
    orEmail: string;
    back: string;
  };
  hero: {
    badge: string;
    tagline: string;
    titleA: string;
    titleB: string;
    titleAccent: string;
    desc: { pre: string; strong: string; post: string };
    examplesLabel: string;
    examples: { label: string; sub: string }[];
    /**
     * Hero ka phone mockup — floating chips aur andar chalta hua chat demo.
     *
     * ⚠️ Ye sab pehle component me HARDCODED Hinglish tha. Bhasha badalne par
     *    poora page badal jaata tha aur ye ek hissa Hinglish hi pada rehta —
     *    aur wo hissa page ka sabse bada, sabse pehle dikhne wala visual hai.
     *    Screenshot me sabse pehle yahi aankh me chubhta tha.
     */
    visual: {
      docTitle: string;
      docSub: string;
      remTitle: string;
      remSub: string;
      /** Upar-daayen ka chip. */
      briefChip: string;
      /** Phone ke andar ka chat demo. */
      demo: {
        /** Header me naam ke neeche — "online · yaad rakh raha hai". */
        status: string;
        /** Neeche input bar ka placeholder. */
        inputPlaceholder: string;
        /** Voice message ka chhota label. */
        voice: string;
        /** Bhejai gayi file ka naam — ye TARJUMA nahi hota, filename hai. */
        docFile: string;
        docSent: string;
        docReply: string;
        voiceMsg: string;
        voiceReply: string;
        briefTitle: string;
        briefSub: string;
      };
    };
    trust: string[];
  };
  /**
   * Home ka SEO content block.
   *
   * Ye asli, padhne layak text hai — keyword stuffing nahi. Jo shabd log
   * search karte hain ("document reminder", "medicine reminder", "bill
   * reminder", "passport expiry") wo poore vaakyon me apni swabhavik jagah
   * par aaye hain. Google ko isse pata chalta hai ki page kis baare me hai,
   * aur user ko bhi ek line me samajh aa jaata hai.
   */
  seo: {
    heading: string;
    intro: string;
    blocks: { h: string; p: string }[];
    blogLink: string;
  };
  insight: { pre: string; accent: string };
  features: {
    heading: string;
    sub: string;
    items: { title: string; body: string }[];
    cta: { title: string; body: string; button: string };
  };
  demo: {
    badge: string;
    heading: string;
    sub: string;
    steps: { title: string; caption: string }[];
    alerts: string[];
  };
  how: {
    heading: string;
    sub: string;
    steps: { title: string; body: string }[];
  };
  day: {
    badge: string;
    heading: string;
    sub: string;
    items: { time: string; text: string }[];
  };
  trust: {
    badge: string;
    heading: string;
    body: string;
    delete: string;
    items: { title: string; body: string }[];
  };
  docs: { heading: string; sub: string; more: string; items: string[] };
  india: {
    badge: string;
    heading: string;
    body: string;
    items: string[];
  };
  testimonials: {
    heading: string;
    sub: string;
    items: { name: string; role: string; quote: string }[];
  };
  pricing: {
    heading: string;
    sub: string;
    billMonthly: string;
    billYearly: string;
    saveBadge: string;
    gstNote: string;
    /** (Purana launch-offer text — ab use nahi hota.) */
    reward: string;
    /** Template — {d} = referral din. `tpl()` se bharo. */
    referralHow: string;
    plans: {
      name: string;
      price: string;
      period: string;
      priceYearly?: string;
      periodYearly?: string;
      tagline: string;
      features: string[];
      cta: string;
      highlight?: boolean;
      gst?: boolean;
    }[];
    note: string;
  };
  faq: { heading: string; items: { q: string; a: string }[] };
  finalCta: { heading: string; sub: string };
  footer: {
    tagline: string;
    product: string;
    company: string;
    legal: string;
    links: {
      features: string;
      demo: string;
      pricing: string;
      faq: string;
      about: string;
      referral: string;
      contact: string;
      privacy: string;
      terms: string;
      blog: string;
      support: string;
      deleteAccount: string;
    };
    social: string;
    playstore: string;
    rights: string;
    madeIn: string;
  };
  /** /delete-account — Play Store ki data-deletion policy wala page. */
  deleteAccount: {
    badge: string;
    heading: string;
    sub: string;
    inAppTitle: string;
    inAppSub: string;
    inAppSteps: string[];
    webTitle: string;
    webSub: string;
    webTime: string;
    deletedTitle: string;
    deleted: string[];
    keptTitle: string;
    kept: string[];
    formTitle: string;
    formSub: string;
    name: string;
    namePlaceholder: string;
    email: string;
    emailPlaceholder: string;
    reason: string;
    reasonOptional: string;
    reasonPlaceholder: string;
    confirm: string;
    submit: string;
    sending: string;
    doneTitle: string;
    /** Template — {email} */
    doneBody: string;
    invalid: string;
    needConfirm: string;
    successToast: string;
    errorToast: string;
    orEmail: string;
  };
  referral: {
    badge: string;
    heading: string;
    /** Template — {d} din */
    sub: string;
    steps: string[];
    cta: string;
    /** Template — {d} referral din */
    capNote: string;
    loginTitle: string;
    loginSub: string;
    email: string;
    password: string;
    loginBtn: string;
    or: string;
    google: string;
    noAccount: string;
    downloadApp: string;
    manageOnWeb: string;
    /** Template — {d} */
    cardTitle: string;
    /** Template — {d} */
    cardSub: string;
    yourCode: string;
    copy: string;
    copied: string;
    whatsapp: string;
    share: string;
    statReferrals: string;
    statDays: string;
    /** Template — {earned} din */
    capLine: string;
    /** Template — {x} */
    pending: string;
    openApp: string;
    logout: string;
    disabled: string;
    notConfigured: string;
    /** Template — {d} {link} */
    shareMessage: string;
    /** Landing popup — reward ke 2 kaam */
    tasksTitle: string;
    taskDocument: string;
    taskReminder: string;
  };
  download: {
    button: string;
    /** Template — {n} users, {m} mahine */
    offerLine: string;
    modalTitle: string;
    modalBody: string;
    modalCta: string;
    modalDismiss: string;
  };
  /**
   * Privacy aur Terms ka poora text.
   *
   * ⚠️ Ye pehle `app/privacy/page.tsx` aur `app/terms/page.tsx` me hardcoded
   * Hinglish tha. App me yehi do page kab se teeno bhasha me hain — website
   * par nahi the. Yaani jis user ne Hindi chuni hoti thi, use app me Hindi
   * privacy policy dikhti thi aur website par Hinglish. Sabse bura wahi hai
   * jahan bharose ki baat ho rahi ho.
   */
  legal: {
    /** "Aakhri update: <month year>" ka label. */
    lastUpdated: string;
    privacyTitle: string;
    privacy: { h: string; p: string }[];
    termsTitle: string;
    terms: { h: string; p: string }[];
  };
  /** Refer link se aaye naye user ka swagat page (/r/<code>). */
  invite: {
    heading: string;
    /** Template — {d} din */
    sub: string;
    /** Template — {d} din — bold hissa `sub` ke andar. */
    subStrong: string;
    codeLabel: string;
    copy: string;
    copied: string;
    download: string;
    /** Template — {d} */
    howTitle: string;
    steps: string[];
    /** Template — {d} */
    footer: string;
  };
  /** Landing ki chalti hui document-patti. */
  marquee: string[];
  /** Landing ka blog teaser. */
  blogTeaser: { kicker: string; heading: string; sub: string; seeAll: string };
  /** "Inside the app" — screenshot strip. */
  screenshots: { heading: string; sub: string };
};

const hinglish: Dict = {
  a11y: { close: "Band karo", changeLanguage: "Bhasha badlo" },
  theme: { label: "Theme", light: "Light", dark: "Dark", system: "Phone ke hisaab se" },
  nav: {
    earlyAccess: "Early access",
    home: "Home",
    blog: "Blog",
    about: "About",
    contact: "Contact",
    backHome: "Home pe wapas",
    invite: "Dost ko bulao",
    menu: "Menu",
  },
  about: {
    badge: "Hamari kahani",
    heading: "Saathi kis liye bana",
    lead: "Hum sab kuch na kuch bhool jaate hain — koi zaroori date, koi document, koi kaam. Saathi isi liye bana: ek aisa saathi jo yaad rakhne ka bojh apne upar le le.",
    body: [
      "Idea simple tha — technology sirf tez nahi, samajhdaar bhi honi chahiye. Aaj ke apps aapse kaam karwate hain; Saathi aapke liye kaam karta hai, bina baar-baar pooche.",
      "Hum ek chhoti si team hain jo maanti hai ki AI ko insaan jaisa saathi hona chahiye — jo aapko jaanta ho, aapki bhasha bolta ho, aur aapke zaroori kaam khud yaad rakhta ho.",
    ],
    valuesHeading: "Jin cheezon pe hum atal hain",
    values: [
      {
        title: "Aapki privacy pehle",
        body: "Aapka data aapka hai. Na bikta hai, na share hota hai — kabhi nahi.",
      },
      {
        title: "Insaan jaisi simplicity",
        body: "Koi form nahi, koi jhanjhat nahi. Bas baat karo, kaam ho jaata hai.",
      },
      {
        title: "Sach mein madadgar",
        body: "Hum feature nahi, bharosa banate hain. Jo waada karte hain, wahi dete hain.",
      },
    ],
  },
  contact: {
    badge: "Baat karo",
    heading: "Hum sun rahe hain",
    sub: "Sawaal, feedback ya bas hello — jo bhi ho, likh do. Hum jaldi jawab denge.",
    name: "Aapka naam",
    namePlaceholder: "Aapka naam",
    email: "Email",
    emailPlaceholder: "aapka@email.com",
    message: "Aapka message",
    messagePlaceholder: "Kya kehna hai...",
    submit: "Message bhejo",
    sending: "Bhej rahe hain...",
    successToast: "Message mil gaya! Hum jaldi jawab denge. 🎉",
    errorToast: "Kuch gadbad ho gayi. Thodi der baad try karo.",
    invalid: "Naam, sahi email aur message zaroori hai.",
    orEmail: "Ya seedhe email karo:",
    back: "Wapas",
  },
  hero: {
    badge: "Aapka personal AI saathi",
    tagline: "Never Forget What Matters.",
    titleA: "Aapka saathi,",
    titleB: "jo kuch nahi",
    titleAccent: "bhoolta.",
    desc: {
      pre: "Zindagi ki bhaag-daud mein hum sab kuch na kuch bhool jaate hain — koi expiry, koi birthday, koi zaroori kaam. Saathi wo dost hai jo sab yaad rakhta hai aur ",
      strong: "bina pooche",
      post: " sahi waqt pe yaad dila deta hai. Bas baat karo, ya bol do — baaki Saathi pe chhod do.",
    },
    examplesLabel: "Jaise ki —",
    examples: [
      { label: "Passport", sub: "Renew karvana hai" },
      { label: "Insurance", sub: "Expiry se pehle" },
      { label: "Birthday", sub: "Kisi ki bhoolo mat" },
      { label: "EMI", sub: "Time pe yaad" },
    ],
    visual: {
      docTitle: "Car Insurance", docSub: "3 din mein expire",
      remTitle: "Gym · 7:00 AM", remSub: "Reminder set",
      briefChip: "Morning brief bheja",
      demo: {
        status: "online · yaad rakh raha hai",
        inputPlaceholder: "Kuch bhi bolo...",
        voice: "Voice",
        docFile: "insurance.jpg",
        docSent: "Car insurance ka photo 📄",
        docReply: "Mil gaya 👍 Expiry 12 March hai. 1 hafta pehle yaad dila dunga.",
        voiceMsg: "Kal gym jana hai 7 baje",
        voiceReply: "Set! Roz 7 baje reminder. 💪",
        briefTitle: "Good morning! ☀️",
        briefSub: "Car insurance is hafte expire · Gym 7 baje",
      },
    },
    trust: ["100% private", "Voice + text", "Hindi + English", "Android first"],
  },
  seo: {
    heading: "Saathi kis-kis cheez ka reminder deta hai",
    intro:
      "Ek hi app me documents, dawai, bill aur roz ke kaam â sab ka reminder. Hindi, English ya dono mila ke, jaise aap bolte ho.",
    blocks: [
      {
        h: "Document expiry reminder",
        p: "Passport, Aadhaar, driving licence, insurance, FASTag â document ki photo daalo, Saathi expiry date khud padh leta hai aur 14 din, 3 din aur usi din yaad dila deta hai. Renewal ke liye poora time mil jaata hai.",
      },
      {
        h: "Medicine reminder",
        p: "Dawai ka time bhoolna aam baat hai â khaaskar jab ghar me kisi bade ki dawai aapko yaad rakhni ho. Bol ke ya likh ke set karo, aur reminder me poora naam dikhta hai, taaki confusion na ho ki kaunsi dawai thi.",
      },
      {
        h: "Bill aur EMI reminder",
        p: "Bijli, rent, EMI, subscription â late fee paise ki kami se nahi, date nikal jaane se lagti hai. Saathi due date se pehle yaad dila deta hai, aur Plus me WhatsApp + email par bhi.",
      },
      {
        h: "Roz ke chhote kaam",
        p: "“kal subah 8 baje paani ka bill” jaisa likh do â Saathi time samajh ke reminder laga deta hai. Lock screen par poora alert aata hai, isliye notification me dab ke gum nahi hota.",
      },
    ],
    blogLink: "Reminders aur documents par guides padho",
  },
  insight: {
    pre: "Aap yaad rakhne ki koshish karte reh jaate ho.",
    accent: "Saathi bina pooche khud yaad dila deta hai.",
  },
  features: {
    heading: "Ek dost jo sach mein khayal rakhe",
    sub: "Yaad rakhne ki tension khatam. Saathi sambhal leta hai.",
    items: [
      {
        title: "Documents ki zimmedari",
        body: "Passport, license, car insurance, FASTag, warranty — ek photo daalo. Saathi expiry yaad rakhta hai aur 1 mahina, 1 hafta pehle, aur expire hone pe khud yaad dilata hai.",
      },
      {
        title: "Subah ka Brief",
        body: "Har subah ek chhota, saaf summary — aaj ke kaam, is hafte kya expire ho raha hai, aur aaj ke reminders. Poora din ek nazar mein.",
      },
      {
        title: "Bas bol do.",
        body: "Dost jaise baat karo — type karo ya mic dabake bolo. “Kal 8 baje uthana”, “mummy ko call karna yaad dilana” — bas keh do, ho gaya.",
      },
      {
        title: "Aapko yaad rakhta hai",
        body: "Jo aap ek baar batate ho woh yaad rehta hai — har baar dohrana nahi padta. Sach mein ek saathi jo aapko jaanta hai.",
      },
      {
        title: "Pura private, aapke control mein",
        body: "Documents aapke apne encrypted storage mein. Kisi AI ke memory server pe kuch nahi. Aap chaho toh ek tap mein sab delete.",
      },
    ],
    cta: {
      title: "Aur dheere-dheere, poori life ka saathi.",
      body: "Gym, goals, aur bahut kuch — sab isi mein judta jayega.",
      button: "App download karo",
    },
  },
  demo: {
    badge: "Live demo",
    heading: "Photo se reminder tak — 3 second mein",
    sub: "Dekho Saathi kaise ek document ko samajhke khud reminder bana deta hai.",
    steps: [
      { title: "Upload", caption: "Document ki photo daali" },
      { title: "AI Read", caption: "Saathi ne padha & samjha" },
      { title: "Reminder Created", caption: "Expiry se pehle yaad dila denge" },
    ],
    alerts: ["1 mahina pehle", "1 hafta pehle", "Expiry ke din"],
  },
  how: {
    heading: "Kaise kaam karta hai",
    sub: "Teen aasan kadam. Form bharne ki zaroorat nahi.",
    steps: [
      {
        title: "Batao ya dikhao",
        body: "Document ki photo daalo, ya bas Saathi se bol do ki kya yaad rakhna hai.",
      },
      {
        title: "Saathi samajh leta hai",
        body: "AI document padhke expiry aur zaroori dates apne aap nikal leta hai.",
      },
      {
        title: "Woh khud yaad dilata hai",
        body: "Sahi time pe notification — bina aapke pooche. Aap tension-free.",
      },
    ],
  },
  day: {
    badge: "Ek din Saathi ke saath",
    heading: "Subah se raat tak, bina pooche.",
    sub: "Aapko kuch yaad rakhne ki zaroorat nahi. Saathi sahi time pe, sahi cheez, khud bata deta hai — jaise ek samajhdaar dost.",
    items: [
      {
        time: "Subah 8:00",
        text: "“Good morning! Aaj 2 kaam hain. Car insurance is hafte (12 ko) expire ho raha hai — renew kara doon?”",
      },
      {
        time: "Dopahar 2:30",
        text: "“FASTag recharge khatam hone wala hai. Abhi karwa lo, warna kal toll pe dikkat ho sakti hai.”",
      },
      {
        time: "Raat 10:00",
        text: "Aapne bola: “Kal subah 7 baje gym yaad dilana” — Saathi: “Set! 💪 Subah milte hain.”",
      },
    ],
  },
  trust: {
    badge: "Your Data, Your Control",
    heading: "Aapka data, aapke haath mein.",
    body: "Hum aapke documents kisi AI ke memory server pe save nahi karte. Sab kuch encrypted aur private. Aur jab chaho —",
    delete: "Ek tap mein sab kuch delete.",
    items: [
      {
        title: "End-to-End Encryption",
        body: "Aapke documents encrypted — sirf aap padh sakte ho.",
      },
      {
        title: "Aapki bhasha",
        body: "Hindi, English ya Hinglish — jaise aap bolo, waise baat.",
      },
      {
        title: "AI Powered",
        body: "Latest AI jo document padhke khud samajh leta hai.",
      },
      {
        title: "Secure Cloud",
        body: "Bharosemand cloud storage — kabhi data khoyega nahi.",
      },
    ],
  },
  docs: {
    heading: "Har zaroori document, ek jagah",
    sub: "Photo daalo — Saathi baaki sambhal leta hai.",
    more: "+50 supported documents — aur badhte ja rahe hain",
    items: [
      "PAN Card",
      "Aadhaar Card",
      "Voter ID",
      "Birth Certificate",
      "Education Certificates",
      "Bank Documents",
      "Driving License / RC",
      "Insurance / FASTag",
      "Passport / Visa",
      "Bills / Warranty",
    ],
  },
  india: {
    badge: "Aapke liye bana",
    heading: "Aapki bhasha, aapke documents.",
    body: "Insurance, license, FASTag, RC, gas connection, warranty — wahi zaroori cheezein jo roz kaam aati hain. Apni bhasha mein baat karo. Bilkul apne dost jaisa.",
    items: [
      "Passport",
      "Driving License",
      "Car Insurance",
      "FASTag",
      "RC / PUC",
      "Warranty / AMC",
    ],
  },
  testimonials: {
    heading: "Log kya keh rahe hain",
    sub: "Asli Saathi users ki asli baat.",
    items: [
      {
        name: "Rohit S.",
        role: "Delhi",
        quote:
          "Car insurance har saal last minute pe yaad aata tha. Ab Saathi ek mahina pehle bata deta hai. Zindagi aasaan ho gayi.",
      },
      {
        name: "Priya M.",
        role: "Bengaluru",
        quote:
          "Mummy-papa ke documents bhi isme daal diye. Ab kisi ki expiry miss nahi hoti. Bilkul family ka saathi.",
      },
      {
        name: "Aakash V.",
        role: "Pune",
        quote:
          "Hindi mein bol ke reminder set karna — mazza aa gaya. Jaise kisi dost se baat kar raha hoon.",
      },
    ],
  },
  pricing: {
    heading: "Simple pricing, koi jhanjhat nahi",
    sub: "Shuruaat bilkul free. Jab chaaho Saathi Plus le lo.",
    billMonthly: "Mahina",
    billYearly: "Saal",
    saveBadge: "2 mahine free",
    gstNote: "+ 18% GST",
    reward: "🎁 Pehle {n} users ko Saathi Plus — poore {m} mahine bilkul FREE!",
    referralHow: "Refer & Earn: dost aapke code se join kare, apna pehla document daale aur ek reminder set kare — dono ko {d} din ka Saathi Plus plan free. Jitne chaaho, koi limit nahi.",
    plans: [
      {
        name: "Free",
        price: "₹0",
        period: "/hamesha",
        priceYearly: "₹0",
        periodYearly: "/hamesha",
        tagline: "Shuru karne ke liye kaafi.",
        features: [
          "{docs} documents",
          "{rem} active reminders",
          "Expiry reminders",
          "Voice & text reminders",
        ],
        cta: "Free mein shuru karo",
      },
      {
        name: "Saathi Plus",
        price: "₹99",
        period: "/mahina",
        priceYearly: "₹999",
        periodYearly: "/saal",
        tagline: "Bina limit ke, poora Saathi.",
        features: [
          "Unlimited documents",
          "Unlimited reminders",
          "Email + WhatsApp pe reminders",
          "Subah ka daily brief",
          "Sab kuch Free wala",
        ],
        cta: "Saathi Plus chunein",
        highlight: true,
        gst: true,
      },
    ],
    note: "Refer & Earn — dono ko {d} din ka Saathi Plus plan free. ",
  },
  faq: {
    heading: "Sawaal hain? Bilkul natural hai.",
    items: [
      {
        q: "Mera data encrypted hai?",
        a: "Haan, bilkul. Aapke documents end-to-end encrypted hain — sirf aap padh sakte ho. Hum unhe kisi AI ke memory server pe save nahi karte, aur aap chaho toh ek tap mein sab delete kar sakte ho.",
      },
      {
        q: "Offline support hoga?",
        a: "Aapke reminders aur zaroori info offline bhi dikhega. Naya document padhne (AI scan) ke liye internet chahiye, par purane reminders bina net ke bhi milte rahenge.",
      },
      {
        q: "AI kaunsa use hota hai?",
        a: "Latest, top-quality AI models jo document padhke expiry aur dates samajh lete hain. Aapka data training ke liye use nahi hota — sirf aapki madad ke liye.",
      },
      {
        q: "iPhone app kab aayega?",
        a: "App abhi Android pe hai — Play Store se download karo. iPhone version jald aa raha hai.",
      },
      {
        q: "Saathi Plus mein kya extra milta hai?",
        a: "Plus mein unlimited documents aur unlimited reminders — koi limit nahi. Aur reminders sirf app mein nahi, aapke email aur WhatsApp pe bhi aate hain, taaki koi zaroori date miss na ho.",
      },
      {
        q: "Saathi free hai?",
        a: "Haan, shuruaat bilkul free hai. Core kaam hamesha free rahega — unlimited documents/reminders ke liye Saathi Plus hai.",
      },
    ],
  },
  finalCta: {
    heading: "Aaj hi Saathi try karo",
    sub: "Play Store se free download karo — 2 minute me set, aur Saathi aapke zaroori documents aur kaam yaad rakhega.",
  },
  footer: {
    tagline: "Aapka personal saathi jo kuch nahi bhoolta. Never forget what matters.",
    product: "Product",
    company: "Company",
    legal: "Legal",
    links: {
      features: "Features",
      demo: "Live demo",
      pricing: "Pricing",
      faq: "FAQ",
      about: "About",
      referral: "Refer & Earn",
      contact: "Contact",
      privacy: "Privacy Policy",
      terms: "Terms & Conditions",
      blog: "Blog",
      support: "Support",
      deleteAccount: "Account delete",
    },
    social: "Follow karo",
    playstore: "Play Store pe uplabdh",
    rights: "Sabhi adhikaar surakshit.",
    madeIn: "Made with ❤️ for you",
  },
  deleteAccount: {
    badge: "Account & data",
    heading: "Apna account delete karein",
    sub: "Ye page Apka Saathi (Android app) ke liye hai. Aap apna account aur uska saara data hamesha ke liye hata sakte ho — do raste hain, dono neeche likhe hain.",
    inAppTitle: "1. App ke andar se",
    inAppSub: "Sirf apna data (documents + reminders) hatana ho, account rehne dena ho:",
    inAppSteps: [
      "App khol ke sabse neeche 'You' tab par jao",
      "Neeche 'More' section tak scroll karo",
      "'Sab data delete' dabao aur confirm karo",
    ],
    webTitle: "2. Yahin se, poora account",
    webSub: "Account khud bhi hatana ho to neeche wala form bharo. Hum aapke email par confirmation bhejenge aur 7 din ke andar sab kuch delete kar denge.",
    webTime: "Zyada se zyada 7 din",
    deletedTitle: "Kya delete hoga",
    deleted: [
      "Aapka account aur login (email/Google)",
      "Profile — naam, photo, phone, address",
      "Saare documents aur unki uploaded files",
      "Saare reminders aur unka history",
      "Saathi ke saath ki gayi chat",
      "Referral data aur notification tokens",
    ],
    keptTitle: "Kya rakha jayega",
    kept: [
      "Payment / invoice records — tax aur accounting kanoon ke tehat rakhne padte hain. Inme aapke documents ya reminders ka content nahi hota, sirf payment ka record.",
      "Anonymous usage counts jinme aapko pehchana nahi ja sakta.",
    ],
    formTitle: "Delete request bhejo",
    formSub: "Wahi email daalo jisse aapka Saathi account bana hai — usi par hum confirmation bhejenge.",
    name: "Aapka naam",
    namePlaceholder: "Jaise: Nitish Kumar",
    email: "Account ka email",
    emailPlaceholder: "aap@example.com",
    reason: "Wajah",
    reasonOptional: "(optional)",
    reasonPlaceholder: "Batana chaho to bata do — isse Saathi behtar banta hai.",
    confirm: "Main samajhta/samajhti hoon ki mera account, documents aur reminders hamesha ke liye hat jaayenge — ye wapas nahi aayega.",
    submit: "Delete request bhejo",
    sending: "Request bhej rahe hain…",
    doneTitle: "Request mil gayi 🙏",
    doneBody: "Confirmation email {email} par bhej diya hai. Aapka account aur data 7 din ke andar hata diya jayega. Iraada badal jaye to usi email ka jawab de dena.",
    invalid: "Naam aur sahi email dono chahiye.",
    needConfirm: "Pehle neeche wala box tick karo.",
    successToast: "Request mil gayi — confirmation email bhej diya hai.",
    errorToast: "Request nahi gayi. Thodi der baad try karo.",
    orEmail: "Form na chale to seedha likho:",
  },
  referral: {
    badge: "Refer & Earn",
    heading: "Dost ko invite karo, dono ko Plus plan",
    sub: "Aapka dost aapke code se join kare aur Saathi use karna shuru kare — dono ko {d} din ka Saathi Plus plan bilkul free.",
    steps: [
      "Apna referral link share karo",
      "Dost app download karke account banaye",
      "Woh apna pehla document daale aur ek reminder set kare",
    ],
    cta: "Apna referral link lo",
    capNote: "Har successful referral pe {d} din ka Plus plan — jitne chaaho, koi limit nahi.",
    loginTitle: "Apna referral link lo",
    loginSub: "Wahi account jo app me use karte ho — usi se login karo.",
    email: "Email",
    password: "Password",
    loginBtn: "Login karo",
    or: "ya",
    google: "Google se continue karo",
    noAccount: "Account nahi hai?",
    downloadApp: "App download karo",
    manageOnWeb: "Web pe manage karo",
    cardTitle: "Dono ko {d} din ka Plus plan free",
    cardSub: "Apna link bhejo. Dost join kare, apna pehla document daale aur ek reminder set kare — dono ko {d} din ka Saathi Plus plan.",
    yourCode: "Aapka code",
    copy: "Copy",
    copied: "Copied",
    whatsapp: "WhatsApp",
    share: "Share",
    statReferrals: "Successful referrals",
    statDays: "Plus din kamaaye",
    capLine: "Ab tak {earned} din ka Plus plan kamaaye.",
    pending: "{x} dost join to hue, par abhi unhone document add + chat poora nahi kiya.",
    openApp: "App kholo",
    logout: "Logout",
    disabled: "Referral program abhi band hai. Baad me dobara dekhein.",
    notConfigured: "Referral abhi web pe set nahi hai. Tab tak app se share karo.",
    shareMessage: "Main Apka Saathi use karta hoon — documents ki expiry aur zaroori kaam khud yaad dila deta hai. 🙂\n\nMere code se join karo, dono ko {d} din ka Saathi Plus plan FREE:\n{link}",
    tasksTitle: "Reward ke liye bas 2 chhote kaam",
    taskDocument: "Ek document upload karo",
    taskReminder: "Ek reminder set karo",
  },
  download: {
    button: "Play Store se download karo",
    offerLine: "Refer & Earn — dono ko {d} din ka Saathi Plus plan free",
    modalTitle: "Saathi ab app pe hai 📱",
    modalBody:
      "Plus subscription aur saare features Saathi app ke andar milte hain. Play Store se app download karo aur seedhe app se hi upgrade karo — bilkul secure, Google Play ke through.",
    modalCta: "Play Store se download karo",
    modalDismiss: "Abhi nahi",
  },
  legal: {
    lastUpdated: "Aakhri update",
    privacyTitle: "Privacy Policy",
    privacy: [
      {
        h: "1. Hum kya collect karte hain",
        p: "Sirf wahi jo Saathi ko kaam karne ke liye chahiye: aapka email (account ke liye), aur woh documents/reminders jo aap khud add karte ho. Bas itna hi.",
      },
      {
        h: "2. Aapke documents",
        p: "Aapke documents encrypted storage mein rakhe jaate hain. Hum unhe kisi third-party AI ke memory server par save nahi karte. Document padhne ke baad zaroori info (jaise expiry date) nikaal li jaati hai — baaki aapke control mein rehta hai.",
      },
      {
        h: "3. Data kabhi bik-ta nahi",
        p: "Hum aapka data kabhi kisi ko bechte ya rent par dete nahi. Koi ad-tracking nahi. Aapka data sirf aapki madad ke liye use hota hai.",
      },
      {
        /*
         * ⚠️ Ye section tab joda gaya jab admin panel me notes ka poora matn
         * dikhne laga. Isse chhupa ke rakhna do wajah se galat hota: user ne
         * apna note is bharose par likha tha ki wo uska apna hai, aur DPDP/GDPR
         * dono me "kaun aapka data dekh sakta hai" batana zaroori hai.
         */
        h: "4. Hamari team kya dekh sakti hai",
        p: "Saathi ki team ke kuch log support aur dikkat theek karne ke liye aapka account data dekh sakte hain — isme aapke notes aur reminders ka matn bhi shamil hai. Ye sirf zaroorat padne par hota hai, aur sirf un logon ke paas hai jinhe ye permission di gayi ho. Aapke documents ki files iske alawa hain: unhe kholne ka alag record rakha jaata hai.",
      },
      {
        h: "5. Aapka control",
        p: "Aap jab chaho apna data dekh, export ya delete kar sakte ho — ek tap mein. Account delete karne par aapka saara data hata diya jaata hai.",
      },
      {
        h: "6. Email",
        p: "Aapka email sirf account aur zaroori reminders/updates ke liye. Koi spam nahi — har email mein unsubscribe ka option hoga.",
      },
      {
        h: "7. Sampark",
        p: "Koi sawaal? info@apkasaathi.com par likho — hum khushi se madad karenge.",
      },
    ],
    termsTitle: "Terms of Service",
    terms: [
      {
        h: "1. Saathi kya hai",
        p: "Saathi ek personal AI companion hai jo aapke documents, dates aur kaam yaad rakhta hai aur reminders bhejta hai. Service Android par uplabdh hai.",
      },
      {
        h: "2. Aapki zimmedari",
        p: "Aap sahi jaankari denge aur service ka istemaal kanooni tarike se karenge. Aapka account aur password aapki zimmedari hai.",
      },
      {
        h: "3. Reminders",
        p: "Saathi poori koshish karta hai ki reminders sahi time par pahunchein, par technical dikkat (network, device settings) ke kaaran kabhi delay ho sakta hai. Zaroori kaam ke liye Saathi ko ek madadgar samjho, akhri bharosa nahi.",
      },
      {
        h: "4. Pricing",
        p: "Core features hamesha free rahenge. Unlimited documents/reminders aur email + WhatsApp reminders ke liye Saathi Plus (paid) hai. Koi bhi charge pehle saaf bataya jayega.",
      },
      {
        h: "5. Data aur privacy",
        p: "Aapka data hamari Privacy Policy ke mutabik handle hota hai. Aap jab chaho apna data delete kar sakte ho.",
      },
      {
        h: "6. Badlaav",
        p: "In terms mein badlaav ho sakta hai. Bada badlaav hone par hum aapko email ya app ke through bata denge.",
      },
      {
        h: "7. Sampark",
        p: "Koi sawaal ya shikayat? info@apkasaathi.com par likho.",
      },
    ],
  },
  invite: {
    heading: "Aapko Apka Saathi ka invite mila 🎉",
    sub: "Is code se join karo — aapko aur aapke dost,",
    subStrong: "dono ko {d} din ka Saathi Plus plan free",
    codeLabel: "Referral code",
    copy: "Code copy karo",
    copied: "Copy ho gaya",
    download: "App download karo",
    howTitle: "{d} din kaise milenge",
    steps: [
      "App download karo — code apne aap bhar jaayega",
      "Account banao",
      "Apna pehla document add karo",
      "Saathi se ek baar baat karo",
    ],
    footer: "Chaaron ho gaye — dono ko {d} din ka Saathi Plus plan. 🎉",
  },
  marquee: [
    "Passport",
    "Driving License",
    "Car Insurance",
    "FASTag",
    "RC / PUC",
    "LIC Premium",
    "Aadhaar update",
    "Gas connection",
    "Warranty / AMC",
    "Visa",
    "Health Insurance",
    "Subscription",
  ],
  blogTeaser: {
    kicker: "Blog",
    heading: "Padhne layak, kaam ki baatein",
    sub: "Documents, renewals, dawai aur bills — jo cheezein chupchaap expire ho jaati hain, unke chhote practical guides.",
    seeAll: "Sab dekho",
  },
  screenshots: {
    heading: "App ke andar",
    sub: "Documents, reminders aur roz ka brief — Hindi, English ya dono mila ke.",
  },
};

const hi: Dict = {
  a11y: { close: "बंद करें", changeLanguage: "भाषा बदलें" },
  theme: { label: "थीम", light: "लाइट", dark: "डार्क", system: "फ़ोन के हिसाब से" },
  nav: {
    earlyAccess: "अर्ली एक्सेस",
    home: "होम",
    blog: "ब्लॉग",
    about: "हमारे बारे में",
    contact: "संपर्क",
    backHome: "होम पर वापस",
    invite: "दोस्त को बुलाएँ",
    menu: "मेन्यू",
  },
  about: {
    badge: "हमारी कहानी",
    heading: "साथी क्यों बना",
    lead: "हम सब कुछ न कुछ भूल ही जाते हैं — कोई ज़रूरी तारीख़, कोई डॉक्युमेंट, कोई काम। साथी इसीलिए बना: एक ऐसा साथी जो याद रखने का बोझ खुद उठा ले।",
    body: [
      "आइडिया आसान था — टेक्नोलॉजी सिर्फ़ तेज़ नहीं, समझदार भी होनी चाहिए। आज के ऐप्स आपसे काम करवाते हैं; साथी आपके लिए काम करता है, बिना बार-बार पूछे।",
      "हम एक छोटी सी टीम हैं जो मानती है कि AI को इंसान जैसा साथी होना चाहिए — जो आपको जानता हो, आपकी भाषा बोलता हो, और आपके ज़रूरी काम खुद याद रखता हो।",
    ],
    valuesHeading: "जिन बातों पर हम अटल हैं",
    values: [
      {
        title: "आपकी प्राइवेसी पहले",
        body: "आपका डेटा आपका है। न बिकता है, न शेयर होता है — कभी नहीं।",
      },
      {
        title: "इंसान जैसी सादगी",
        body: "कोई फ़ॉर्म नहीं, कोई झंझट नहीं। बस बात कीजिए, काम हो जाता है।",
      },
      {
        title: "सच में मददगार",
        body: "हम फ़ीचर नहीं, भरोसा बनाते हैं। जो वादा करते हैं, वही देते हैं।",
      },
    ],
  },
  contact: {
    badge: "बात कीजिए",
    heading: "हम सुन रहे हैं",
    sub: "सवाल, फ़ीडबैक या बस हेलो — जो भी हो, लिख दीजिए। हम जल्दी जवाब देंगे।",
    name: "आपका नाम",
    namePlaceholder: "आपका नाम",
    email: "ईमेल",
    emailPlaceholder: "aapka@email.com",
    message: "आपका मैसेज",
    messagePlaceholder: "क्या कहना है...",
    submit: "मैसेज भेजें",
    sending: "भेज रहे हैं...",
    successToast: "मैसेज मिल गया! हम जल्दी जवाब देंगे। 🎉",
    errorToast: "कुछ गड़बड़ हो गई। थोड़ी देर बाद ट्राई करें।",
    invalid: "नाम, सही ईमेल और मैसेज ज़रूरी है।",
    orEmail: "या सीधे ईमेल करें:",
    back: "वापस",
  },
  hero: {
    badge: "आपका पर्सनल AI साथी",
    tagline: "जो ज़रूरी है, कभी मत भूलिए।",
    titleA: "आपका साथी,",
    titleB: "जो कुछ नहीं",
    titleAccent: "भूलता।",
    desc: {
      pre: "ज़िंदगी की भागदौड़ में हम कुछ न कुछ भूल ही जाते हैं — कोई एक्सपायरी, कोई जन्मदिन, कोई ज़रूरी काम। साथी वह दोस्त है जो सब याद रखता है और ",
      strong: "बिना पूछे",
      post: " सही समय पर याद दिला देता है। बस बात कीजिए, या बोल दीजिए — बाकी साथी पर छोड़ दीजिए।",
    },
    examplesLabel: "जैसे कि —",
    examples: [
      { label: "पासपोर्ट", sub: "रिन्यू करवाना है" },
      { label: "इंश्योरेंस", sub: "एक्सपायरी से पहले" },
      { label: "जन्मदिन", sub: "किसी का मत भूलिए" },
      { label: "EMI", sub: "समय पर याद" },
    ],
    visual: {
      docTitle: "कार इंश्योरेंस", docSub: "3 दिन में एक्सपायर",
      remTitle: "जिम · 7:00 AM", remSub: "रिमाइंडर सेट",
      briefChip: "मॉर्निंग ब्रीफ़ भेजा",
      demo: {
        status: "ऑनलाइन · याद रख रहा है",
        inputPlaceholder: "कुछ भी बोलिए...",
        voice: "वॉइस",
        docFile: "insurance.jpg",
        docSent: "कार इंश्योरेंस की फ़ोटो 📄",
        docReply: "मिल गया 👍 एक्सपायरी 12 मार्च है। 1 हफ़्ता पहले याद दिला दूँगा।",
        voiceMsg: "कल जिम जाना है 7 बजे",
        voiceReply: "सेट! रोज़ 7 बजे रिमाइंडर। 💪",
        briefTitle: "गुड मॉर्निंग! ☀️",
        briefSub: "कार इंश्योरेंस इस हफ़्ते एक्सपायर · जिम 7 बजे",
      },
    },
    trust: ["100% प्राइवेट", "वॉइस + टेक्स्ट", "हिंदी + अंग्रेज़ी", "Android पहले"],
  },
  seo: {
    heading: "साथी किन-किन चीज़ों का रिमाइंडर देता है",
    intro:
      "एक ही ऐप में डॉक्युमेंट, दवाई, बिल और रोज़ के काम — सबका रिमाइंडर। हिंदी, अंग्रेज़ी या दोनों मिलाकर, जैसे आप बोलते हैं।",
    blocks: [
      {
        h: "डॉक्युमेंट एक्सपायरी रिमाइंडर",
        p: "पासपोर्ट, आधार, ड्राइविंग लाइसेंस, बीमा, FASTag — डॉक्युमेंट की फ़ोटो डालें, साथी एक्सपायरी डेट खुद पढ़ लेता है और 14 दिन, 3 दिन और उसी दिन याद दिला देता है। रिन्युअल के लिए पूरा समय मिल जाता है।",
      },
      {
        h: "दवाई का रिमाइंडर",
        p: "दवाई का समय भूलना आम बात है — ख़ासकर जब घर के किसी बड़े की दवाई आपको याद रखनी हो। बोलकर या लिखकर सेट करें, और रिमाइंडर में पूरा नाम दिखता है ताकि उलझन न हो कि कौन-सी दवाई थी।",
      },
      {
        h: "बिल और EMI रिमाइंडर",
        p: "बिजली, किराया, EMI, सब्सक्रिप्शन — लेट फ़ीस पैसे की कमी से नहीं, तारीख़ निकल जाने से लगती है। साथी ड्यू डेट से पहले याद दिला देता है, और प्लस में WhatsApp + ईमेल पर भी।",
      },
      {
        h: "रोज़ के छोटे काम",
        p: "“कल सुबह 8 बजे पानी का बिल” जैसा लिख दें — साथी समय समझकर रिमाइंडर लगा देता है। लॉक स्क्रीन पर पूरा अलर्ट आता है, इसलिए नोटिफ़िकेशन में दबकर खो नहीं जाता।",
      },
    ],
    blogLink: "रिमाइंडर और डॉक्युमेंट पर गाइड पढ़ें",
  },
  insight: {
    pre: "आप याद रखने की कोशिश करते रह जाते हैं।",
    accent: "साथी बिना पूछे खुद याद दिला देता है।",
  },
  features: {
    heading: "एक दोस्त जो सच में ख़याल रखे",
    sub: "याद रखने की टेंशन ख़त्म। साथी संभाल लेता है।",
    items: [
      {
        title: "डॉक्युमेंट्स की ज़िम्मेदारी",
        body: "पासपोर्ट, लाइसेंस, कार इंश्योरेंस, FASTag, वारंटी — एक फोटो डालिए। साथी एक्सपायरी याद रखता है और 1 महीना, 1 हफ़्ता पहले, और एक्सपायर होने पर खुद याद दिलाता है।",
      },
      {
        title: "सुबह का ब्रीफ़",
        body: "हर सुबह एक छोटा, साफ़ सारांश — आज के काम, इस हफ़्ते क्या एक्सपायर हो रहा है, और आज के reminders। पूरा दिन एक नज़र में।",
      },
      {
        title: "बस बोल दीजिए।",
        body: "दोस्त जैसे बात कीजिए — टाइप कीजिए या माइक दबाकर बोलिए। “कल 8 बजे उठाना”, “मम्मी को कॉल करना याद दिलाना” — बस कह दीजिए, हो गया।",
      },
      {
        title: "आपको याद रखता है",
        body: "जो आप एक बार बताते हैं वह याद रहता है — हर बार दोहराना नहीं पड़ता। सच में एक साथी जो आपको जानता है।",
      },
      {
        title: "पूरा प्राइवेट, आपके कंट्रोल में",
        body: "डॉक्युमेंट्स आपके अपने एन्क्रिप्टेड स्टोरेज में। किसी AI के मेमोरी सर्वर पर कुछ नहीं। चाहें तो एक टैप में सब डिलीट।",
      },
    ],
    cta: {
      title: "और धीरे-धीरे, पूरी ज़िंदगी का साथी।",
      body: "जिम, गोल्स, और बहुत कुछ — सब इसी में जुड़ता जाएगा।",
      button: "ऐप डाउनलोड करें",
    },
  },
  demo: {
    badge: "लाइव डेमो",
    heading: "फोटो से reminder तक — 3 सेकंड में",
    sub: "देखिए साथी कैसे एक डॉक्युमेंट को समझकर खुद reminder बना देता है।",
    steps: [
      { title: "अपलोड", caption: "डॉक्यूमेंट की फ़ोटो डाली" },
      { title: "AI ने पढ़ा", caption: "साथी ने पढ़ा और समझा" },
      { title: "रिमाइंडर बना", caption: "एक्सपायरी से पहले याद दिला देंगे" },
    ],
    alerts: ["1 महीना पहले", "1 हफ़्ता पहले", "एक्सपायरी के दिन"],
  },
  how: {
    heading: "कैसे काम करता है",
    sub: "तीन आसान क़दम। फॉर्म भरने की ज़रूरत नहीं।",
    steps: [
      {
        title: "बताइए या दिखाइए",
        body: "डॉक्युमेंट की फोटो डालिए, या बस साथी से बोल दीजिए कि क्या याद रखना है।",
      },
      {
        title: "साथी समझ लेता है",
        body: "AI डॉक्युमेंट पढ़कर एक्सपायरी और ज़रूरी तारीख़ें खुद निकाल लेता है।",
      },
      {
        title: "वह खुद याद दिलाता है",
        body: "सही समय पर नोटिफिकेशन — बिना आपके पूछे। आप टेंशन-फ्री।",
      },
    ],
  },
  day: {
    badge: "साथी के साथ एक दिन",
    heading: "सुबह से रात तक, बिना पूछे।",
    sub: "आपको कुछ याद रखने की ज़रूरत नहीं। साथी सही समय पर, सही चीज़, खुद बता देता है — जैसे एक समझदार दोस्त।",
    items: [
      {
        time: "सुबह 8:00",
        text: "“गुड मॉर्निंग! आज 2 काम हैं। कार इंश्योरेंस इस हफ़्ते (12 को) एक्सपायर हो रहा है — रिन्यू करा दूँ?”",
      },
      {
        time: "दोपहर 2:30",
        text: "“FASTag रिचार्ज ख़त्म होने वाला है। अभी करवा लीजिए, वरना कल टोल पर दिक़्क़त हो सकती है।”",
      },
      {
        time: "रात 10:00",
        text: "आपने बोला: “कल सुबह 7 बजे जिम याद दिलाना” — साथी: “सेट! 💪 सुबह मिलते हैं।”",
      },
    ],
  },
  trust: {
    badge: "आपका डेटा, आपका कंट्रोल",
    heading: "आपका डेटा, आपके हाथ में।",
    body: "हम आपके डॉक्युमेंट्स किसी AI के मेमोरी सर्वर पर सेव नहीं करते। सब कुछ एन्क्रिप्टेड और प्राइवेट। और जब चाहें —",
    delete: "एक टैप में सब कुछ डिलीट।",
    items: [
      {
        title: "एंड-टू-एंड एन्क्रिप्शन",
        body: "आपके डॉक्युमेंट्स एन्क्रिप्टेड — सिर्फ़ आप पढ़ सकते हैं।",
      },
      {
        title: "आपकी भाषा",
        body: "हिंदी, अंग्रेज़ी या हिंग्लिश — जैसे आप बोलें, वैसे बात।",
      },
      {
        title: "AI पावर्ड",
        body: "लेटेस्ट AI जो डॉक्युमेंट पढ़कर खुद समझ लेता है।",
      },
      {
        title: "सिक्योर क्लाउड",
        body: "भरोसेमंद क्लाउड स्टोरेज — डेटा कभी नहीं खोएगा।",
      },
    ],
  },
  docs: {
    heading: "हर ज़रूरी डॉक्युमेंट, एक जगह",
    sub: "फोटो डालिए — साथी बाकी संभाल लेता है।",
    more: "+50 सपोर्टेड डॉक्युमेंट्स — और बढ़ते जा रहे हैं",
    items: [
      "PAN कार्ड",
      "आधार कार्ड",
      "वोटर ID",
      "जन्म प्रमाणपत्र",
      "शिक्षा प्रमाणपत्र",
      "बैंक डॉक्युमेंट्स",
      "ड्राइविंग लाइसेंस / RC",
      "इंश्योरेंस / FASTag",
      "पासपोर्ट / वीज़ा",
      "बिल / वारंटी",
    ],
  },
  india: {
    badge: "आपके लिए बना",
    heading: "आपकी भाषा, आपके डॉक्युमेंट्स।",
    body: "इंश्योरेंस, लाइसेंस, FASTag, RC, गैस कनेक्शन, वारंटी — वही ज़रूरी चीज़ें जो रोज़ काम आती हैं। अपनी भाषा में बात कीजिए। बिल्कुल अपने दोस्त जैसा।",
    items: [
      "पासपोर्ट",
      "ड्राइविंग लाइसेंस",
      "कार इंश्योरेंस",
      "FASTag",
      "RC / PUC",
      "वारंटी / AMC",
    ],
  },
  testimonials: {
    heading: "लोग क्या कह रहे हैं",
    sub: "असली साथी यूज़र्स की असली बात।",
    items: [
      {
        name: "रोहित S.",
        role: "दिल्ली",
        quote:
          "कार इंश्योरेंस हर साल लास्ट मिनट पर याद आता था। अब साथी एक महीना पहले बता देता है। ज़िंदगी आसान हो गई।",
      },
      {
        name: "प्रिया M.",
        role: "बेंगलुरु",
        quote:
          "मम्मी-पापा के डॉक्युमेंट्स भी इसमें डाल दिए। अब किसी की एक्सपायरी मिस नहीं होती। बिल्कुल फैमिली का साथी।",
      },
      {
        name: "आकाश V.",
        role: "पुणे",
        quote:
          "हिंदी में बोलकर reminder सेट करना — मज़ा आ गया। जैसे किसी दोस्त से बात कर रहा हूँ।",
      },
    ],
  },
  pricing: {
    heading: "सिंपल प्राइसिंग, कोई झंझट नहीं",
    sub: "शुरुआत बिलकुल फ्री। जब चाहें साथी प्लस ले लें।",
    billMonthly: "महीना",
    billYearly: "साल",
    saveBadge: "2 महीने फ्री",
    gstNote: "+ 18% GST",
    reward: "🎁 पहले {n} यूज़र्स को साथी प्लस — पूरे {m} महीने बिल्कुल फ्री!",
    referralHow: "रेफ़र करें और पाएँ: दोस्त आपके कोड से जॉइन करे, अपना पहला डॉक्यूमेंट डाले और एक reminder सेट करे — दोनों को {d} दिन का साथी प्लस प्लान फ्री। जितने चाहें, कोई सीमा नहीं।",
    plans: [
      {
        name: "फ्री",
        price: "₹0",
        period: "/हमेशा",
        priceYearly: "₹0",
        periodYearly: "/हमेशा",
        tagline: "शुरू करने के लिए काफ़ी।",
        features: [
          "{docs} डॉक्युमेंट्स",
          "{rem} एक्टिव reminders",
          "एक्सपायरी reminders",
          "वॉइस & टेक्स्ट reminders",
        ],
        cta: "फ्री में शुरू करें",
      },
      {
        name: "साथी प्लस",
        price: "₹99",
        period: "/महीना",
        priceYearly: "₹999",
        periodYearly: "/साल",
        tagline: "बिना लिमिट, पूरा साथी।",
        features: [
          "अनलिमिटेड डॉक्युमेंट्स",
          "अनलिमिटेड reminders",
          "Email + WhatsApp पर reminders",
          "सुबह का डेली ब्रीफ़",
          "फ्री वाला सब कुछ",
        ],
        cta: "साथी प्लस चुनें",
        highlight: true,
        gst: true,
      },
    ],
    note: "रेफ़र करें और पाएँ — दोनों को {d} दिन का साथी प्लस प्लान फ्री। सब्सक्रिप्शन कभी भी कैंसल करें।",
  },
  faq: {
    heading: "सवाल हैं? बिल्कुल स्वाभाविक है।",
    items: [
      {
        q: "मेरा डेटा एन्क्रिप्टेड है?",
        a: "हाँ, बिल्कुल। आपके डॉक्युमेंट्स एंड-टू-एंड एन्क्रिप्टेड हैं — सिर्फ़ आप पढ़ सकते हैं। हम उन्हें किसी AI के मेमोरी सर्वर पर सेव नहीं करते, और चाहें तो एक टैप में सब डिलीट।",
      },
      {
        q: "ऑफ़लाइन सपोर्ट होगा?",
        a: "आपके reminders और ज़रूरी जानकारी ऑफ़लाइन भी दिखेगी। नया डॉक्युमेंट पढ़ने (AI स्कैन) के लिए इंटरनेट चाहिए, पर पुराने reminders बिना नेट के भी मिलते रहेंगे।",
      },
      {
        q: "कौन सा AI इस्तेमाल होता है?",
        a: "लेटेस्ट, टॉप-क्वालिटी AI मॉडल जो डॉक्युमेंट पढ़कर एक्सपायरी और तारीख़ें समझ लेते हैं। आपका डेटा ट्रेनिंग के लिए इस्तेमाल नहीं होता — सिर्फ़ आपकी मदद के लिए।",
      },
      {
        q: "iPhone ऐप कब आएगा?",
        a: "ऐप अभी Android पर है — Play Store से डाउनलोड करें। iPhone वर्ज़न जल्द आ रहा है।",
      },
      {
        q: "साथी प्लस में क्या एक्स्ट्रा मिलता है?",
        a: "प्लस में अनलिमिटेड डॉक्युमेंट्स और अनलिमिटेड reminders — कोई लिमिट नहीं। और reminders सिर्फ़ ऐप में नहीं, आपके ईमेल और WhatsApp पर भी आते हैं, ताकि कोई ज़रूरी डेट मिस न हो।",
      },
      {
        q: "साथी फ्री है?",
        a: "हाँ, शुरुआत बिलकुल फ्री है। कोर काम हमेशा फ्री रहेगा — अनलिमिटेड डॉक्युमेंट्स/reminders के लिए साथी प्लस है।",
      },
    ],
  },
  finalCta: {
    heading: "आज ही साथी ट्राई करें",
    sub: "Play Store से फ्री डाउनलोड करें — 2 मिनट में सेट, और साथी आपके ज़रूरी डॉक्युमेंट्स और काम याद रखेगा।",
  },
  footer: {
    tagline: "आपका पर्सनल साथी जो कुछ नहीं भूलता। Never forget what matters.",
    product: "प्रोडक्ट",
    company: "कंपनी",
    legal: "क़ानूनी",
    links: {
      features: "फ़ीचर्स",
      demo: "लाइव डेमो",
      pricing: "प्राइसिंग",
      faq: "FAQ",
      about: "हमारे बारे में",
      referral: "रेफ़र करें और पाएँ",
      contact: "संपर्क",
      privacy: "प्राइवेसी पॉलिसी",
      terms: "नियम व शर्तें",
      blog: "ब्लॉग",
      support: "सपोर्ट",
      deleteAccount: "अकाउंट डिलीट",
    },
    social: "फ़ॉलो करें",
    playstore: "Play Store पर उपलब्ध",
    rights: "सभी अधिकार सुरक्षित।",
    madeIn: "आपके लिए ❤️ से बना",
  },
  deleteAccount: {
    badge: "अकाउंट और डेटा",
    heading: "अपना अकाउंट डिलीट करें",
    sub: "यह पेज Apka Saathi (Android ऐप) के लिए है। आप अपना अकाउंट और उसका सारा डेटा हमेशा के लिए हटा सकते हैं — दो रास्ते हैं, दोनों नीचे लिखे हैं।",
    inAppTitle: "1. ऐप के अंदर से",
    inAppSub: "सिर्फ़ अपना डेटा (डॉक्युमेंट + रिमाइंडर) हटाना हो, अकाउंट रहने देना हो:",
    inAppSteps: [
      "ऐप खोलकर सबसे नीचे 'You' टैब पर जाएँ",
      "नीचे 'More' सेक्शन तक स्क्रॉल करें",
      "'सब डेटा डिलीट' दबाएँ और कन्फ़र्म करें",
    ],
    webTitle: "2. यहीं से, पूरा अकाउंट",
    webSub: "अकाउंट भी हटाना हो तो नीचे वाला फ़ॉर्म भरें। हम आपके ईमेल पर कन्फ़र्मेशन भेजेंगे और 7 दिन के अंदर सब कुछ डिलीट कर देंगे।",
    webTime: "ज़्यादा से ज़्यादा 7 दिन",
    deletedTitle: "क्या डिलीट होगा",
    deleted: [
      "आपका अकाउंट और लॉगिन (ईमेल/Google)",
      "प्रोफ़ाइल — नाम, फ़ोटो, फ़ोन, पता",
      "सारे डॉक्युमेंट और उनकी अपलोड की गई फ़ाइलें",
      "सारे रिमाइंडर और उनका हिस्ट्री",
      "साथी के साथ की गई चैट",
      "रेफ़रल डेटा और नोटिफ़िकेशन टोकन",
    ],
    keptTitle: "क्या रखा जाएगा",
    kept: [
      "पेमेंट / इनवॉइस रिकॉर्ड — टैक्स और अकाउंटिंग क़ानून के तहत रखने पड़ते हैं। इनमें आपके डॉक्युमेंट या रिमाइंडर का कंटेंट नहीं होता, सिर्फ़ पेमेंट का रिकॉर्ड।",
      "ऐसे anonymous usage counts जिनसे आपको पहचाना नहीं जा सकता।",
    ],
    formTitle: "डिलीट रिक्वेस्ट भेजें",
    formSub: "वही ईमेल डालें जिससे आपका साथी अकाउंट बना है — उसी पर हम कन्फ़र्मेशन भेजेंगे।",
    name: "आपका नाम",
    namePlaceholder: "जैसे: नितीश कुमार",
    email: "अकाउंट का ईमेल",
    emailPlaceholder: "aap@example.com",
    reason: "वजह",
    reasonOptional: "(वैकल्पिक)",
    reasonPlaceholder: "बताना चाहें तो बता दें — इससे साथी बेहतर बनता है।",
    confirm: "मैं समझता/समझती हूँ कि मेरा अकाउंट, डॉक्युमेंट और रिमाइंडर हमेशा के लिए हट जाएँगे — यह वापस नहीं आएगा।",
    submit: "डिलीट रिक्वेस्ट भेजें",
    sending: "रिक्वेस्ट भेज रहे हैं…",
    doneTitle: "रिक्वेस्ट मिल गई 🙏",
    doneBody: "कन्फ़र्मेशन ईमेल {email} पर भेज दिया है। आपका अकाउंट और डेटा 7 दिन के अंदर हटा दिया जाएगा। इरादा बदल जाए तो उसी ईमेल का जवाब दे दें।",
    invalid: "नाम और सही ईमेल दोनों चाहिए।",
    needConfirm: "पहले नीचे वाला बॉक्स टिक करें।",
    successToast: "रिक्वेस्ट मिल गई — कन्फ़र्मेशन ईमेल भेज दिया है।",
    errorToast: "रिक्वेस्ट नहीं गई। थोड़ी देर बाद कोशिश करें।",
    orEmail: "फ़ॉर्म न चले तो सीधा लिखें:",
  },
  referral: {
    badge: "रेफ़र करें और पाएँ",
    heading: "दोस्त को इनवाइट करें, दोनों को प्लस प्लान",
    sub: "आपका दोस्त आपके कोड से जॉइन करे और साथी इस्तेमाल करना शुरू करे — दोनों को {d} दिन का साथी प्लस प्लान बिल्कुल फ्री।",
    steps: [
      "अपना रेफ़रल लिंक शेयर करें",
      "दोस्त ऐप डाउनलोड करके अकाउंट बनाए",
      "वो अपना पहला डॉक्यूमेंट डाले और एक reminder सेट करे",
    ],
    cta: "अपना रेफ़रल लिंक लें",
    capNote: "हर सफल रेफ़रल पर {d} दिन का प्लस प्लान — जितने चाहें, कोई सीमा नहीं।",
    loginTitle: "अपना रेफ़रल लिंक लें",
    loginSub: "वही अकाउंट जो ऐप में इस्तेमाल करते हैं — उसी से लॉगिन करें।",
    email: "ईमेल",
    password: "पासवर्ड",
    loginBtn: "लॉगिन करें",
    or: "या",
    google: "Google से जारी रखें",
    noAccount: "अकाउंट नहीं है?",
    downloadApp: "ऐप डाउनलोड करें",
    manageOnWeb: "वेब पर मैनेज करें",
    cardTitle: "दोनों को {d} दिन का प्लस प्लान फ्री",
    cardSub: "अपना लिंक भेजिए। दोस्त जॉइन करे, अपना पहला डॉक्यूमेंट डाले और एक reminder सेट करे — दोनों को {d} दिन का साथी प्लस प्लान।",
    yourCode: "आपका कोड",
    copy: "कॉपी",
    copied: "कॉपी हो गया",
    whatsapp: "WhatsApp",
    share: "शेयर",
    statReferrals: "सफल रेफ़रल",
    statDays: "प्लस दिन कमाए",
    capLine: "अब तक {earned} दिन का प्लस प्लान कमाया।",
    pending: "{x} दोस्त जॉइन तो हुए, पर अभी उन्होंने डॉक्यूमेंट + चैट पूरा नहीं किया।",
    openApp: "ऐप खोलें",
    logout: "लॉगआउट",
    disabled: "रेफ़रल प्रोग्राम अभी बंद है। बाद में दोबारा देखें।",
    notConfigured: "रेफ़रल अभी वेब पर सेट नहीं है। तब तक ऐप से शेयर करें।",
    shareMessage: "मैं Apka Saathi इस्तेमाल करता हूँ — डॉक्यूमेंट्स की एक्सपायरी और ज़रूरी काम खुद याद दिला देता है। 🙂\n\nमेरे कोड से जॉइन करें, दोनों को {d} दिन का साथी प्लस प्लान फ्री:\n{link}",
    tasksTitle: "रिवॉर्ड के लिए बस 2 छोटे काम",
    taskDocument: "एक डॉक्युमेंट अपलोड करें",
    taskReminder: "एक reminder सेट करें",
  },
  download: {
    button: "Play Store से डाउनलोड करें",
    offerLine: "रेफ़र करें और पाएँ — दोनों को {d} दिन का साथी प्लस प्लान फ्री",
    modalTitle: "साथी अब ऐप पर है 📱",
    modalBody:
      "प्लस सब्सक्रिप्शन और सारे फ़ीचर्स साथी ऐप के अंदर मिलते हैं। Play Store से ऐप डाउनलोड करें और सीधे ऐप से ही अपग्रेड करें — बिल्कुल सुरक्षित, Google Play के ज़रिए।",
    modalCta: "Play Store से डाउनलोड करें",
    modalDismiss: "अभी नहीं",
  },
  legal: {
    lastUpdated: "आख़िरी अपडेट",
    privacyTitle: "प्राइवेसी पॉलिसी",
    privacy: [
      {
        h: "1. हम क्या इकट्ठा करते हैं",
        p: "सिर्फ़ वही जो साथी को काम करने के लिए चाहिए: आपका ईमेल (अकाउंट के लिए), और वो डॉक्युमेंट्स/रिमाइंडर जो आप खुद जोड़ते हैं। बस इतना ही।",
      },
      {
        h: "2. आपके डॉक्युमेंट्स",
        p: "आपके डॉक्युमेंट्स एन्क्रिप्टेड स्टोरेज में रखे जाते हैं। हम उन्हें किसी थर्ड-पार्टी AI के मेमोरी सर्वर पर सेव नहीं करते। डॉक्युमेंट पढ़ने के बाद ज़रूरी जानकारी (जैसे एक्सपायरी डेट) निकाल ली जाती है — बाक़ी आपके कंट्रोल में रहता है।",
      },
      {
        h: "3. डेटा कभी नहीं बिकता",
        p: "हम आपका डेटा कभी किसी को बेचते या किराए पर नहीं देते। कोई ऐड-ट्रैकिंग नहीं। आपका डेटा सिर्फ़ आपकी मदद के लिए इस्तेमाल होता है।",
      },
      {
        h: "4. हमारी टीम क्या देख सकती है",
        p: "साथी की टीम के कुछ लोग सपोर्ट और दिक़्क़त ठीक करने के लिए आपका अकाउंट डेटा देख सकते हैं — इसमें आपके नोट्स और रिमाइंडर का मतन भी शामिल है। यह सिर्फ़ ज़रूरत पड़ने पर होता है, और सिर्फ़ उन लोगों के पास है जिन्हें यह अनुमति दी गई हो। आपके डॉक्युमेंट की फ़ाइलें इससे अलग हैं: उन्हें खोलने का अलग रिकॉर्ड रखा जाता है।",
      },
      {
        h: "5. आपका कंट्रोल",
        p: "आप जब चाहें अपना डेटा देख, एक्सपोर्ट या डिलीट कर सकते हैं — एक टैप में। अकाउंट डिलीट करने पर आपका सारा डेटा हटा दिया जाता है।",
      },
      {
        h: "6. ईमेल",
        p: "आपका ईमेल सिर्फ़ अकाउंट और ज़रूरी रिमाइंडर/अपडेट के लिए। कोई स्पैम नहीं — हर ईमेल में अनसब्सक्राइब का विकल्प होगा।",
      },
      {
        h: "7. संपर्क",
        p: "कोई सवाल? info@apkasaathi.com पर लिखें — हम ख़ुशी से मदद करेंगे।",
      },
    ],
    termsTitle: "सेवा की शर्तें",
    terms: [
      {
        h: "1. साथी क्या है",
        p: "साथी एक पर्सनल AI साथी है जो आपके डॉक्युमेंट्स, तारीख़ें और काम याद रखता है और रिमाइंडर भेजता है। यह सेवा Android पर उपलब्ध है।",
      },
      {
        h: "2. आपकी ज़िम्मेदारी",
        p: "आप सही जानकारी देंगे और सेवा का इस्तेमाल क़ानूनी तरीक़े से करेंगे। आपका अकाउंट और पासवर्ड आपकी ज़िम्मेदारी है।",
      },
      {
        h: "3. रिमाइंडर",
        p: "साथी पूरी कोशिश करता है कि रिमाइंडर सही समय पर पहुँचें, पर तकनीकी दिक़्क़त (नेटवर्क, डिवाइस सेटिंग्स) की वजह से कभी देर हो सकती है। ज़रूरी काम के लिए साथी को एक मददगार समझें, आख़िरी भरोसा नहीं।",
      },
      {
        h: "4. क़ीमत",
        p: "मुख्य फ़ीचर्स हमेशा फ्री रहेंगे। अनलिमिटेड डॉक्युमेंट्स/रिमाइंडर और ईमेल + WhatsApp रिमाइंडर के लिए साथी प्लस (पेड) है। कोई भी चार्ज पहले साफ़ बताया जाएगा।",
      },
      {
        h: "5. डेटा और प्राइवेसी",
        p: "आपका डेटा हमारी प्राइवेसी पॉलिसी के मुताबिक़ संभाला जाता है। आप जब चाहें अपना डेटा डिलीट कर सकते हैं।",
      },
      {
        h: "6. बदलाव",
        p: "इन शर्तों में बदलाव हो सकता है। बड़ा बदलाव होने पर हम आपको ईमेल या ऐप के ज़रिए बता देंगे।",
      },
      {
        h: "7. संपर्क",
        p: "कोई सवाल या शिकायत? info@apkasaathi.com पर लिखें।",
      },
    ],
  },
  invite: {
    heading: "आपको Apka Saathi का इनवाइट मिला 🎉",
    sub: "इस कोड से जुड़िए — आपको और आपके दोस्त,",
    subStrong: "दोनों को {d} दिन का साथी प्लस प्लान फ्री",
    codeLabel: "रेफरल कोड",
    copy: "कोड कॉपी करें",
    copied: "कॉपी हो गया",
    download: "ऐप डाउनलोड करें",
    howTitle: "{d} दिन कैसे मिलेंगे",
    steps: [
      "ऐप डाउनलोड करें — कोड अपने आप भर जाएगा",
      "अकाउंट बनाएँ",
      "अपना पहला डॉक्युमेंट जोड़ें",
      "साथी से एक बार बात करें",
    ],
    footer: "चारों हो गए — दोनों को {d} दिन का साथी प्लस प्लान। 🎉",
  },
  marquee: [
    "पासपोर्ट",
    "ड्राइविंग लाइसेंस",
    "कार इंश्योरेंस",
    "FASTag",
    "RC / PUC",
    "LIC प्रीमियम",
    "आधार अपडेट",
    "गैस कनेक्शन",
    "वारंटी / AMC",
    "वीज़ा",
    "हेल्थ इंश्योरेंस",
    "सब्सक्रिप्शन",
  ],
  blogTeaser: {
    kicker: "ब्लॉग",
    heading: "पढ़ने लायक, काम की बातें",
    sub: "डॉक्युमेंट्स, रिन्युअल, दवाई और बिल — जो चीज़ें चुपचाप एक्सपायर हो जाती हैं, उनकी छोटी प्रैक्टिकल गाइड।",
    seeAll: "सब देखें",
  },
  screenshots: {
    heading: "ऐप के अंदर",
    sub: "डॉक्युमेंट्स, रिमाइंडर और रोज़ का ब्रीफ़ — हिंदी, अंग्रेज़ी या दोनों मिलाकर।",
  },
};

const en: Dict = {
  a11y: { close: "Close", changeLanguage: "Change language" },
  theme: { label: "Theme", light: "Light", dark: "Dark", system: "Match my device" },
  nav: {
    earlyAccess: "Early access",
    home: "Home",
    blog: "Blog",
    about: "About",
    contact: "Contact",
    backHome: "Back to home",
    invite: "Invite a friend",
    menu: "Menu",
  },
  about: {
    badge: "Our story",
    heading: "Why Saathi exists",
    lead: "We all forget things — an important date, a document, a task. Saathi exists for exactly this: a companion that carries the burden of remembering, so you don't have to.",
    body: [
      "The idea was simple — technology should be thoughtful, not just fast. Today's apps make you do the work; Saathi does the work for you, without asking again and again.",
      "We're a small team who believe AI should feel like a human companion — one that knows you, speaks your language, and remembers what matters on its own.",
    ],
    valuesHeading: "What we won't compromise on",
    values: [
      {
        title: "Your privacy first",
        body: "Your data is yours. Never sold, never shared — ever.",
      },
      {
        title: "Human-like simplicity",
        body: "No forms, no fuss. Just talk, and it's done.",
      },
      {
        title: "Genuinely helpful",
        body: "We build trust, not features. We deliver exactly what we promise.",
      },
    ],
  },
  contact: {
    badge: "Say hello",
    heading: "We're listening",
    sub: "Questions, feedback, or just a hello — whatever it is, write to us. We'll reply soon.",
    name: "Your name",
    namePlaceholder: "Your name",
    email: "Email",
    emailPlaceholder: "you@email.com",
    message: "Your message",
    messagePlaceholder: "What's on your mind...",
    submit: "Send message",
    sending: "Sending...",
    successToast: "Got your message! We'll reply soon. 🎉",
    errorToast: "Something went wrong. Please try again shortly.",
    invalid: "Name, a valid email and a message are required.",
    orEmail: "Or email us directly:",
    back: "Back",
  },
  hero: {
    badge: "Your personal AI companion",
    tagline: "Never Forget What Matters.",
    titleA: "The companion",
    titleB: "that never",
    titleAccent: "forgets.",
    desc: {
      pre: "Life gets busy and we all forget things — an expiry, a birthday, an important task. Saathi is the friend who remembers everything and, ",
      strong: "without being asked",
      post: ", reminds you at the right time. Just chat, or speak — leave the rest to Saathi.",
    },
    examplesLabel: "Like —",
    examples: [
      { label: "Passport", sub: "Time to renew" },
      { label: "Insurance", sub: "Before it expires" },
      { label: "Birthday", sub: "Never miss one" },
      { label: "EMI", sub: "Right on time" },
    ],
    visual: {
      docTitle: "Car Insurance", docSub: "Expires in 3 days",
      remTitle: "Gym · 7:00 AM", remSub: "Reminder set",
      briefChip: "Morning brief sent",
      demo: {
        status: "online · remembering for you",
        inputPlaceholder: "Just say anything...",
        voice: "Voice",
        docFile: "insurance.jpg",
        docSent: "Photo of my car insurance 📄",
        docReply: "Got it 👍 It expires on 12 March. I'll remind you a week before.",
        voiceMsg: "I need to go to the gym at 7 tomorrow",
        voiceReply: "Done! Reminder every day at 7. 💪",
        briefTitle: "Good morning! ☀️",
        briefSub: "Car insurance expires this week · Gym at 7",
      },
    },
    trust: ["100% private", "Voice + text", "Hindi + English", "Android first"],
  },
  seo: {
    heading: "What Saathi reminds you about",
    intro:
      "Documents, medicines, bills and everyday tasks â all in one app, in Hindi, English or a mix of both.",
    blocks: [
      {
        h: "Document expiry reminders",
        p: "Passport, Aadhaar, driving licence, insurance, FASTag â add a photo and Saathi reads the expiry date itself, then reminds you 14 days before, 3 days before, and on the day. That is enough time to actually renew.",
      },
      {
        h: "Medicine reminders",
        p: "Forgetting a dose is rarely about the medicine â it is about the moment. Set it by voice or text, and the reminder shows the full name, so there is never any doubt about which tablet it meant.",
      },
      {
        h: "Bill and EMI reminders",
        p: "Electricity, rent, EMI, subscriptions â late fees are a timing problem, not a money problem. Saathi nudges you before the due date, and on Plus it reaches you on WhatsApp and email too.",
      },
      {
        h: "Everyday tasks",
        p: "Type something like “water bill tomorrow at 8 am” and Saathi works out the time for you. The alert opens full-screen on the lock screen, so it does not get buried under other notifications.",
      },
    ],
    blogLink: "Read our guides on reminders and documents",
  },
  insight: {
    pre: "You keep trying to remember everything.",
    accent: "Saathi reminds you first — without being asked.",
  },
  features: {
    heading: "A friend that truly looks out for you",
    sub: "No more stress about remembering. Saathi handles it.",
    items: [
      {
        title: "Document responsibility",
        body: "Passport, license, car insurance, FASTag, warranty — just add a photo. Saathi remembers the expiry and reminds you a month before, a week before, and on the day.",
      },
      {
        title: "Your Morning Brief",
        body: "A short, clear summary every morning — today's tasks, what's expiring this week, and today's reminders. Your whole day at a glance.",
      },
      {
        title: "Just say it.",
        body: "Talk like you would to a friend — type or tap the mic. “Wake me at 8 tomorrow”, “remind me to call mom” — just say it, done.",
      },
      {
        title: "It remembers you",
        body: "Tell it once and it remembers — no repeating yourself. A companion that actually knows you.",
      },
      {
        title: "Fully private, in your control",
        body: "Documents stay in your own encrypted storage. Nothing on any AI's memory server. Delete everything in one tap whenever you want.",
      },
    ],
    cta: {
      title: "And over time, a companion for all of life.",
      body: "Gym, goals, and much more — it all gets added here.",
      button: "Download the app",
    },
  },
  demo: {
    badge: "Live demo",
    heading: "From photo to reminder — in 3 seconds",
    sub: "Watch Saathi understand a document and create the reminder itself.",
    steps: [
      { title: "Upload", caption: "You add a photo of the document" },
      { title: "AI Read", caption: "Saathi reads and understands it" },
      { title: "Reminder Created", caption: "We'll remind you before it expires" },
    ],
    alerts: ["1 month before", "1 week before", "On expiry day"],
  },
  how: {
    heading: "How it works",
    sub: "Three easy steps. No forms to fill.",
    steps: [
      {
        title: "Tell or show",
        body: "Add a photo of a document, or just tell Saathi what to remember.",
      },
      {
        title: "Saathi understands",
        body: "The AI reads the document and pulls out expiry and important dates on its own.",
      },
      {
        title: "It reminds you itself",
        body: "Notifications at the right time — without you asking. You stay stress-free.",
      },
    ],
  },
  day: {
    badge: "A day with Saathi",
    heading: "From morning to night, without being asked.",
    sub: "You don't need to remember a thing. Saathi tells you the right thing at the right time — like a thoughtful friend.",
    items: [
      {
        time: "8:00 AM",
        text: "“Good morning! 2 things today. Your car insurance expires this week (on the 12th) — shall I get it renewed?”",
      },
      {
        time: "2:30 PM",
        text: "“Your FASTag balance is running low. Recharge now, or you might face trouble at the toll tomorrow.”",
      },
      {
        time: "10:00 PM",
        text: "You said: “Remind me for gym at 7 tomorrow” — Saathi: “Set! 💪 See you in the morning.”",
      },
    ],
  },
  trust: {
    badge: "Your Data, Your Control",
    heading: "Your data, in your hands.",
    body: "We never store your documents on any AI's memory server. Everything is encrypted and private. And whenever you want —",
    delete: "Delete everything in one tap.",
    items: [
      {
        title: "End-to-End Encryption",
        body: "Your documents are encrypted — only you can read them.",
      },
      {
        title: "Your language",
        body: "Hindi, English or Hinglish — talk however you're comfortable.",
      },
      {
        title: "AI Powered",
        body: "The latest AI that reads and understands documents on its own.",
      },
      {
        title: "Secure Cloud",
        body: "Reliable cloud storage — your data is never lost.",
      },
    ],
  },
  docs: {
    heading: "Every important document, in one place",
    sub: "Add a photo — Saathi handles the rest.",
    more: "+50 supported documents — and growing",
    items: [
      "PAN Card",
      "Aadhaar Card",
      "Voter ID",
      "Birth Certificate",
      "Education Certificates",
      "Bank Documents",
      "Driving License / RC",
      "Insurance / FASTag",
      "Passport / Visa",
      "Bills / Warranty",
    ],
  },
  india: {
    badge: "Built for you",
    heading: "Your language, your documents.",
    body: "Insurance, license, FASTag, RC, gas connection, warranty — the everyday essentials that actually matter to you. Chat in your own language. Just like a friend.",
    items: [
      "Passport",
      "Driving License",
      "Car Insurance",
      "FASTag",
      "RC / PUC",
      "Warranty / AMC",
    ],
  },
  testimonials: {
    heading: "What people are saying",
    sub: "Real words from real Saathi users.",
    items: [
      {
        name: "Rohit S.",
        role: "Delhi",
        quote:
          "Car insurance always slipped my mind till the last minute. Now Saathi tells me a month ahead. Life got easier.",
      },
      {
        name: "Priya M.",
        role: "Bengaluru",
        quote:
          "I added my parents' documents too. Now no one's expiry gets missed. A true family companion.",
      },
      {
        name: "Aakash V.",
        role: "Pune",
        quote:
          "Setting reminders by speaking in Hindi — loved it. Feels like talking to a friend.",
      },
    ],
  },
  pricing: {
    heading: "Simple pricing, no fuss",
    sub: "Free to start. Grab Saathi Plus whenever you want.",
    billMonthly: "Monthly",
    billYearly: "Yearly",
    saveBadge: "2 months free",
    gstNote: "+ 18% GST",
    reward: "🎁 First {n} users get Saathi Plus — {m} full months absolutely FREE!",
    referralHow: "Refer & Earn: your friend joins with your code, adds their first document and sets one reminder — you both get {d} days of the Saathi Plus plan free. No limit.",
    plans: [
      {
        name: "Free",
        price: "₹0",
        period: "/forever",
        priceYearly: "₹0",
        periodYearly: "/forever",
        tagline: "Plenty to get started.",
        features: [
          "{docs} documents",
          "{rem} active reminders",
          "Expiry reminders",
          "Voice & text reminders",
        ],
        cta: "Start for free",
      },
      {
        name: "Saathi Plus",
        price: "₹99",
        period: "/month",
        priceYearly: "₹999",
        periodYearly: "/year",
        tagline: "No limits, the full Saathi.",
        features: [
          "Unlimited documents",
          "Unlimited reminders",
          "Email + WhatsApp reminders",
          "Daily morning brief",
          "Everything in Free",
        ],
        cta: "Get Saathi Plus",
        highlight: true,
        gst: true,
      },
    ],
    note: "Refer & Earn — both get {d} days of the Saathi Plus plan free. Cancel your subscription anytime.",
  },
  faq: {
    heading: "Got questions? Totally natural.",
    items: [
      {
        q: "Is my data encrypted?",
        a: "Yes, absolutely. Your documents are end-to-end encrypted — only you can read them. We never store them on any AI's memory server, and you can delete everything in one tap.",
      },
      {
        q: "Will there be offline support?",
        a: "Your reminders and key info show up offline too. Reading a new document (AI scan) needs internet, but existing reminders keep working without a connection.",
      },
      {
        q: "Which AI does it use?",
        a: "The latest, top-quality AI models that read documents and understand expiry and dates. Your data is never used for training — only to help you.",
      },
      {
        q: "When is the iPhone app coming?",
        a: "The app is on Android today — grab it from the Play Store. iPhone is coming soon.",
      },
      {
        q: "What extra do I get with Saathi Plus?",
        a: "Plus gives you unlimited documents and unlimited reminders — no limits. And reminders reach you not just in the app but on your email and WhatsApp too, so no important date is ever missed.",
      },
      {
        q: "Is Saathi free?",
        a: "Yes, it's free to start. Core features stay free forever — Saathi Plus is there for unlimited documents/reminders.",
      },
    ],
  },
  finalCta: {
    heading: "Try Saathi today",
    sub: "Download free from the Play Store — set up in 2 minutes, and Saathi keeps track of your important documents and tasks.",
  },
  footer: {
    tagline: "Your personal companion that never forgets. Never forget what matters.",
    product: "Product",
    company: "Company",
    legal: "Legal",
    links: {
      features: "Features",
      demo: "Live demo",
      pricing: "Pricing",
      faq: "FAQ",
      about: "About",
      referral: "Refer & Earn",
      contact: "Contact",
      privacy: "Privacy Policy",
      terms: "Terms & Conditions",
      blog: "Blog",
      support: "Support",
      deleteAccount: "Delete account",
    },
    social: "Follow us",
    playstore: "Available on Play Store",
    rights: "All rights reserved.",
    madeIn: "Made with ❤️ for you",
  },
  deleteAccount: {
    badge: "Account & data",
    heading: "Delete your account",
    sub: "This page is for Apka Saathi (Android app). You can permanently remove your account and all of its data — there are two ways, both are explained below.",
    inAppTitle: "1. From inside the app",
    inAppSub: "If you only want to remove your data (documents + reminders) and keep the account:",
    inAppSteps: [
      "Open the app and go to the 'You' tab at the bottom",
      "Scroll down to the 'More' section",
      "Tap 'Delete all data' and confirm",
    ],
    webTitle: "2. Right here, the whole account",
    webSub: "To remove the account itself, fill in the form below. We will send a confirmation to your email and delete everything within 7 days.",
    webTime: "7 days at most",
    deletedTitle: "What gets deleted",
    deleted: [
      "Your account and login (email/Google)",
      "Profile — name, photo, phone, address",
      "All documents and their uploaded files",
      "All reminders and their history",
      "Your chats with Saathi",
      "Referral data and notification tokens",
    ],
    keptTitle: "What we must keep",
    kept: [
      "Payment / invoice records — tax and accounting law requires us to keep these. They contain no document or reminder content, only the payment record.",
      "Anonymous usage counts that cannot identify you.",
    ],
    formTitle: "Send a delete request",
    formSub: "Use the same email your Saathi account was created with — that is where the confirmation goes.",
    name: "Your name",
    namePlaceholder: "e.g. Nitish Kumar",
    email: "Account email",
    emailPlaceholder: "you@example.com",
    reason: "Reason",
    reasonOptional: "(optional)",
    reasonPlaceholder: "Tell us if you like — it helps make Saathi better.",
    confirm: "I understand that my account, documents and reminders will be permanently removed — this cannot be undone.",
    submit: "Send delete request",
    sending: "Sending your request…",
    doneTitle: "Request received 🙏",
    doneBody: "A confirmation email has been sent to {email}. Your account and data will be removed within 7 days. Changed your mind? Just reply to that email.",
    invalid: "We need your name and a valid email.",
    needConfirm: "Please tick the box below first.",
    successToast: "Request received — confirmation email sent.",
    errorToast: "Could not send the request. Please try again shortly.",
    orEmail: "If the form does not work, write to us directly:",
  },
  referral: {
    badge: "Refer & Earn",
    heading: "Invite a friend, both get the Plus plan",
    sub: "Your friend joins with your code and starts using Saathi — you both get {d} days of the Saathi Plus plan, free.",
    steps: [
      "Share your referral link",
      "Your friend downloads the app and creates an account",
      "They add their first document and set one reminder",
    ],
    cta: "Get your referral link",
    capNote: "{d} days of the Plus plan for every successful referral — no limit.",
    loginTitle: "Get your referral link",
    loginSub: "Same account you use in the app — sign in with it here.",
    email: "Email",
    password: "Password",
    loginBtn: "Sign in",
    or: "or",
    google: "Continue with Google",
    noAccount: "No account yet?",
    downloadApp: "Download the app",
    manageOnWeb: "Manage on the web",
    cardTitle: "You both get {d} days of the Plus plan",
    cardSub: "Send your link. Your friend joins, adds their first document and sets one reminder — you both get {d} days of the Saathi Plus plan.",
    yourCode: "Your code",
    copy: "Copy",
    copied: "Copied",
    whatsapp: "WhatsApp",
    share: "Share",
    statReferrals: "Successful referrals",
    statDays: "Plus days earned",
    capLine: "You've earned {earned} days of the Plus plan so far.",
    pending: "{x} friend(s) joined, but haven't added a document and chatted yet.",
    openApp: "Open the app",
    logout: "Sign out",
    disabled: "The referral program is paused right now. Please check back soon.",
    notConfigured: "Referrals aren't set up on the web yet. Share from the app for now.",
    shareMessage: "I use Apka Saathi — it remembers my document expiries and everything that matters. 🙂\n\nJoin with my code and we both get {d} days of the Saathi Plus plan free:\n{link}",
    tasksTitle: "Just 2 quick things for the reward",
    taskDocument: "Upload one document",
    taskReminder: "Set one reminder",
  },
  download: {
    button: "Download on Play Store",
    offerLine: "Refer & Earn — both get {d} days of the Saathi Plus plan free",
    modalTitle: "Saathi lives in the app 📱",
    modalBody:
      "Plus and every feature live inside the Saathi app. Download it from the Play Store and upgrade right there — secure, through Google Play.",
    modalCta: "Download on Play Store",
    modalDismiss: "Not now",
  },
  legal: {
    lastUpdated: "Last updated",
    privacyTitle: "Privacy Policy",
    privacy: [
      {
        h: "1. What we collect",
        p: "Only what Saathi needs to work: your email (for the account), and the documents/reminders you add yourself. That's all.",
      },
      {
        h: "2. Your documents",
        p: "Your documents are kept in encrypted storage. We don't save them on any third-party AI's memory server. After reading a document we extract only what's needed (like the expiry date) — the rest stays under your control.",
      },
      {
        h: "3. Your data is never sold",
        p: "We never sell or rent your data to anyone. No ad tracking. Your data is used only to help you.",
      },
      {
        h: "4. What our team can see",
        p: "Some people on the Saathi team can see your account data to provide support and fix problems — this includes the text of your notes and reminders. It happens only when needed, and only for staff who have been given that permission. Your document files are separate: opening one is recorded.",
      },
      {
        h: "5. Your control",
        p: "You can view, export or delete your data whenever you want — in one tap. Deleting your account removes all of it.",
      },
      {
        h: "6. Email",
        p: "Your email is used only for your account and the reminders/updates that matter. No spam — every email has an unsubscribe option.",
      },
      {
        h: "7. Contact",
        p: "Any questions? Write to info@apkasaathi.com — we're happy to help.",
      },
    ],
    termsTitle: "Terms of Service",
    terms: [
      {
        h: "1. What Saathi is",
        p: "Saathi is a personal AI companion that remembers your documents, dates and tasks, and sends you reminders. The service is available on Android.",
      },
      {
        h: "2. Your responsibility",
        p: "You'll give accurate information and use the service lawfully. Your account and password are your responsibility.",
      },
      {
        h: "3. Reminders",
        p: "Saathi tries its best to deliver reminders on time, but technical issues (network, device settings) can sometimes delay them. For critical tasks, treat Saathi as a helper — not your last line of defence.",
      },
      {
        h: "4. Pricing",
        p: "Core features will always be free. Saathi Plus (paid) adds unlimited documents/reminders and email + WhatsApp reminders. Any charge is always made clear upfront.",
      },
      {
        h: "5. Data and privacy",
        p: "Your data is handled as described in our Privacy Policy. You can delete your data whenever you want.",
      },
      {
        h: "6. Changes",
        p: "These terms may change. If something important changes, we'll let you know by email or in the app.",
      },
      {
        h: "7. Contact",
        p: "Questions or complaints? Write to info@apkasaathi.com.",
      },
    ],
  },
  invite: {
    heading: "You've been invited to Apka Saathi 🎉",
    sub: "Join with this code — you and your friend",
    subStrong: "both get {d} days of the Saathi Plus plan free",
    codeLabel: "Referral code",
    copy: "Copy code",
    copied: "Copied",
    download: "Download the app",
    howTitle: "How to get your {d} days",
    steps: [
      "Download the app — the code fills in automatically",
      "Create your account",
      "Add your first document",
      "Have one chat with Saathi",
    ],
    footer: "All four done — {d} days of Saathi Plus for both of you. 🎉",
  },
  marquee: [
    "Passport",
    "Driving licence",
    "Car insurance",
    "FASTag",
    "RC / PUC",
    "LIC premium",
    "Aadhaar update",
    "Gas connection",
    "Warranty / AMC",
    "Visa",
    "Health insurance",
    "Subscription",
  ],
  blogTeaser: {
    kicker: "Blog",
    heading: "Short reads that actually help",
    sub: "Documents, renewals, medicines and bills — small practical guides to the things that quietly expire on you.",
    seeAll: "See all",
  },
  screenshots: {
    heading: "Inside the app",
    sub: "Documents, reminders and a daily brief — in Hindi, English or a mix of both.",
  },
};

export const dictionaries: Record<Locale, Dict> = { hinglish, hi, en };
export type { Dict };
