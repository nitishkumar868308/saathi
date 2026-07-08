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
  nav: {
    earlyAccess: string;
    home: string;
    about: string;
    contact: string;
    backHome: string;
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
    trust: string[];
  };
  insight: { pre: string; accent: string };
  features: {
    heading: string;
    sub: string;
    items: { title: string; body: string }[];
    cta: { title: string; body: string; button: string };
  };
  demo: { badge: string; heading: string; sub: string };
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
    /** Template — {n} = users, {m} = mahine. `tpl()` se bharo. */
    reward: string;
    /** Template — {d} = din, {cap} = cap mahine. */
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
    };
    social: string;
    playstore: string;
    rights: string;
    madeIn: string;
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
};

const hinglish: Dict = {
  nav: {
    earlyAccess: "Early access",
    home: "Home",
    about: "About",
    contact: "Contact",
    backHome: "Home pe wapas",
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
    invalid: "Naam, sahi email aur message zaroori hai 🙂",
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
    trust: ["100% private", "Voice + text", "Hindi + English", "Android first"],
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
        body: "Har subah ek chhota, pyaara message — aaj ke kaam, is hafte kya expire ho raha hai, aur aaj ka gym/reminder. Poora din ek nazar mein.",
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
      body: "Gym, goals, aur bahut kuch — sab isi mein add hota jayega.",
      button: "Mujhe chahiye",
    },
  },
  demo: {
    badge: "Live demo",
    heading: "Photo se reminder tak — 3 second mein",
    sub: "Dekho Saathi kaise ek document ko samajhke khud reminder bana deta hai.",
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
    sub: "Early access users ki asli baat.",
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
    sub: "Shuruaat free. Early access walon ke liye hamesha best deal.",
    billMonthly: "Mahina",
    billYearly: "Saal",
    saveBadge: "2 mahine free",
    gstNote: "+ 18% GST",
    reward: "🎁 Pehle {n} users ko Saathi Plus — poore {m} mahine bilkul FREE!",
    referralHow: "Dost bulao: woh aapke code se join kare, apna pehla document daale aur Saathi se ek baar baat kare — dono ko {d} din Plus free (max {cap} mahine).",
    plans: [
      {
        name: "Free",
        price: "₹0",
        period: "/hamesha",
        priceYearly: "₹0",
        periodYearly: "/hamesha",
        tagline: "Shuru karne ke liye kaafi.",
        features: [
          "10 documents tak",
          "Expiry reminders",
          "Voice & text reminders",
          "Hindi + English",
        ],
        cta: "Free mein shuru karo",
      },
      {
        name: "Saathi Plus",
        price: "₹99",
        period: "/mahina",
        priceYearly: "₹999",
        periodYearly: "/saal",
        tagline: "Poore parivaar ka khayal.",
        features: [
          "Unlimited documents",
          "Family sharing (parivaar ke docs)",
          "Subah ka daily brief",
          "Priority + WhatsApp reminders",
          "Sab kuch Free wala",
        ],
        cta: "Saathi Plus lo",
        highlight: true,
        gst: true,
      },
    ],
    note: "Pehle {n} users ko {m} mahine Saathi Plus free. Dost bulao — dono ko {d} din extra Plus.",
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
        q: "Family sharing kaise kaam karega?",
        a: "Saathi Plus mein aap parivaar ke members ke documents aur reminders share kar sakte ho — sabki expiry ek jagah, sabko time pe yaad. Mummy-papa ke documents bhi miss nahi honge.",
      },
      {
        q: "Saathi free hai?",
        a: "Shuruaat mein free. Early access wale logon ko launch pe sabse pehle aur best deal milegi. Core kaam hamesha free rahega.",
      },
    ],
  },
  finalCta: {
    heading: "Sabse pehle Saathi try karo",
    sub: "Early access list mein jud jao. Launch hote hi aapko batayenge — koi spam nahi, bas khabar.",
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
      referral: "Dost bulao 🎁",
      contact: "Contact",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
    },
    social: "Follow karo",
    playstore: "Play Store — jald aa raha hai",
    rights: "Sabhi adhikaar surakshit.",
    madeIn: "Made with ❤️ for you",
  },
  download: {
    button: "Play Store se download karo",
    offerLine: "Pehle {n} users ko Saathi Plus {m} mahine free",
    modalTitle: "Saathi ab app pe hai 📱",
    modalBody:
      "Plus subscription aur saare features Saathi app ke andar milte hain. Play Store se app download karo aur seedhe app se hi upgrade karo — bilkul secure, Google Play ke through.",
    modalCta: "Play Store se download karo",
    modalDismiss: "Abhi nahi",
  },
};

const hi: Dict = {
  nav: {
    earlyAccess: "अर्ली एक्सेस",
    home: "होम",
    about: "हमारे बारे में",
    contact: "संपर्क",
    backHome: "होम पर वापस",
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
    invalid: "नाम, सही ईमेल और मैसेज ज़रूरी है 🙂",
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
    trust: ["100% प्राइवेट", "वॉइस + टेक्स्ट", "हिंदी + अंग्रेज़ी", "Android पहले"],
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
        body: "हर सुबह एक छोटा, प्यारा संदेश — आज के काम, इस हफ़्ते क्या एक्सपायर हो रहा है, और आज का reminder। पूरा दिन एक नज़र में।",
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
      button: "मुझे चाहिए",
    },
  },
  demo: {
    badge: "लाइव डेमो",
    heading: "फोटो से reminder तक — 3 सेकंड में",
    sub: "देखिए साथी कैसे एक डॉक्युमेंट को समझकर खुद reminder बना देता है।",
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
    sub: "अर्ली एक्सेस यूज़र्स की असली बात।",
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
    sub: "शुरुआत फ्री। अर्ली एक्सेस वालों के लिए हमेशा बेस्ट डील।",
    billMonthly: "महीना",
    billYearly: "साल",
    saveBadge: "2 महीने फ्री",
    gstNote: "+ 18% GST",
    reward: "🎁 पहले {n} यूज़र्स को साथी प्लस — पूरे {m} महीने बिल्कुल फ्री!",
    referralHow: "दोस्त बुलाइए: वो आपके कोड से जॉइन करे, अपना पहला डॉक्यूमेंट डाले और साथी से एक बार बात करे — दोनों को {d} दिन प्लस फ्री (अधिकतम {cap} महीने)।",
    plans: [
      {
        name: "फ्री",
        price: "₹0",
        period: "/हमेशा",
        priceYearly: "₹0",
        periodYearly: "/हमेशा",
        tagline: "शुरू करने के लिए काफ़ी।",
        features: [
          "10 डॉक्युमेंट्स तक",
          "एक्सपायरी reminders",
          "वॉइस & टेक्स्ट reminders",
          "हिंदी + अंग्रेज़ी",
        ],
        cta: "फ्री में शुरू करें",
      },
      {
        name: "साथी प्लस",
        price: "₹99",
        period: "/महीना",
        priceYearly: "₹999",
        periodYearly: "/साल",
        tagline: "पूरे परिवार का ख़याल।",
        features: [
          "अनलिमिटेड डॉक्युमेंट्स",
          "फैमिली शेयरिंग (परिवार के docs)",
          "सुबह का डेली ब्रीफ़",
          "प्रायोरिटी + WhatsApp reminders",
          "फ्री वाला सब कुछ",
        ],
        cta: "साथी प्लस लें",
        highlight: true,
        gst: true,
      },
    ],
    note: "पहले {n} यूज़र्स को {m} महीने साथी प्लस फ्री। दोस्त बुलाइए — दोनों को {d} दिन एक्स्ट्रा प्लस।",
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
        q: "फैमिली शेयरिंग कैसे काम करेगी?",
        a: "साथी प्लस में आप परिवार के सदस्यों के डॉक्युमेंट्स और reminders शेयर कर सकते हैं — सबकी एक्सपायरी एक जगह, सबको समय पर याद।",
      },
      {
        q: "साथी फ्री है?",
        a: "शुरुआत में फ्री। अर्ली एक्सेस वालों को लॉन्च पर सबसे पहले और बेस्ट डील मिलेगी। कोर काम हमेशा फ्री रहेगा।",
      },
    ],
  },
  finalCta: {
    heading: "सबसे पहले साथी ट्राई करें",
    sub: "अर्ली एक्सेस लिस्ट में जुड़ जाइए। लॉन्च होते ही आपको बताएँगे — कोई स्पैम नहीं, बस ख़बर।",
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
      referral: "दोस्त बुलाइए 🎁",
      contact: "संपर्क",
      privacy: "प्राइवेसी पॉलिसी",
      terms: "सेवा की शर्तें",
    },
    social: "फ़ॉलो करें",
    playstore: "Play Store — जल्द आ रहा है",
    rights: "सभी अधिकार सुरक्षित।",
    madeIn: "आपके लिए ❤️ से बना",
  },
  download: {
    button: "Play Store से डाउनलोड करें",
    offerLine: "पहले {n} यूज़र्स को साथी प्लस {m} महीने फ्री",
    modalTitle: "साथी अब ऐप पर है 📱",
    modalBody:
      "प्लस सब्सक्रिप्शन और सारे फ़ीचर्स साथी ऐप के अंदर मिलते हैं। Play Store से ऐप डाउनलोड करें और सीधे ऐप से ही अपग्रेड करें — बिल्कुल सुरक्षित, Google Play के ज़रिए।",
    modalCta: "Play Store से डाउनलोड करें",
    modalDismiss: "अभी नहीं",
  },
};

const en: Dict = {
  nav: {
    earlyAccess: "Early access",
    home: "Home",
    about: "About",
    contact: "Contact",
    backHome: "Back to home",
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
    invalid: "Name, a valid email and a message are required 🙂",
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
    trust: ["100% private", "Voice + text", "Hindi + English", "Android first"],
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
        body: "A short, warm message every morning — today's tasks, what's expiring this week, and today's reminders. Your whole day at a glance.",
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
      button: "I want this",
    },
  },
  demo: {
    badge: "Live demo",
    heading: "From photo to reminder — in 3 seconds",
    sub: "Watch Saathi understand a document and create the reminder itself.",
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
    sub: "Real words from our early access users.",
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
    sub: "Free to start. Early access users always get the best deal.",
    billMonthly: "Monthly",
    billYearly: "Yearly",
    saveBadge: "2 months free",
    gstNote: "+ 18% GST",
    reward: "🎁 First {n} users get Saathi Plus — {m} full months absolutely FREE!",
    referralHow: "Refer a friend: they join with your code, add their first document and chat with Saathi once — you both get {d} days of Plus free (up to {cap} months).",
    plans: [
      {
        name: "Free",
        price: "₹0",
        period: "/forever",
        priceYearly: "₹0",
        periodYearly: "/forever",
        tagline: "Plenty to get started.",
        features: [
          "Up to 10 documents",
          "Expiry reminders",
          "Voice & text reminders",
          "Hindi + English",
        ],
        cta: "Start for free",
      },
      {
        name: "Saathi Plus",
        price: "₹99",
        period: "/month",
        priceYearly: "₹999",
        periodYearly: "/year",
        tagline: "Care for the whole family.",
        features: [
          "Unlimited documents",
          "Family sharing",
          "Daily morning brief",
          "Priority + WhatsApp reminders",
          "Everything in Free",
        ],
        cta: "Get Saathi Plus",
        highlight: true,
        gst: true,
      },
    ],
    note: "First {n} users get {m} months of Saathi Plus free. Refer a friend — both get {d} extra days.",
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
        q: "How does family sharing work?",
        a: "With Saathi Plus you can share family members' documents and reminders — everyone's expiries in one place, everyone reminded on time.",
      },
      {
        q: "Is Saathi free?",
        a: "Free to start. Early access users get the first and best deal at launch. The core features stay free forever.",
      },
    ],
  },
  finalCta: {
    heading: "Be the first to try Saathi",
    sub: "Join the early access list. We'll tell you the moment we launch — no spam, just news.",
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
      referral: "Refer a friend 🎁",
      contact: "Contact",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
    },
    social: "Follow us",
    playstore: "Play Store — coming soon",
    rights: "All rights reserved.",
    madeIn: "Made with ❤️ for you",
  },
  download: {
    button: "Download on Play Store",
    offerLine: "First {n} users get {m} months of Saathi Plus free",
    modalTitle: "Saathi lives in the app 📱",
    modalBody:
      "Plus and every feature live inside the Saathi app. Download it from the Play Store and upgrade right there — secure, through Google Play.",
    modalCta: "Download on Play Store",
    modalDismiss: "Not now",
  },
};

export const dictionaries: Record<Locale, Dict> = { hinglish, hi, en };
export type { Dict };
