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
    support: string;
    seo: string;
    blog: string;
    analytics: string;
    message: string;
    usage: string;
    spend: string;
    documents: string;
    reviews: string;
    logs: string;
    contacts: string;
    pricing: string;
    rewards: string;
  };
  headings: Record<
    | "rewards"
    | "pricing"
    | "users"
    | "usage"
    | "spend"
    | "documents"
    | "reviews"
    | "logs"
    | "contacts"
    | "message"
    | "support"
    | "analytics"
    | "seo"
    | "blog",
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
    /** Bhejne se pehle kis-kis ko — list + selection (item 8). */
    picked: string;
    pickedHint: string;
    listTitle: string;
    searchPh: string;
    selectAll: string;
    clearAll: string;
    onlyInactive: string;
    activeTag: string;
    inactiveTag: string;
    selectedN: string; // {n}
    noneSelected: string;
    listFailed: string;
    users: string;
    /** Email / phone notification / dono (item 8). */
    channelTitle: string;
    chEmail: string;
    chPush: string;
    chBoth: string;
    pushOff: string;
    /** {sent} {devices} */
    pushDone: string;
    pushNone: string;
    /** Us user ke phone par app hai — push ja sakti hai. */
    hasApp: string;
    /** App nahi mili — sirf email jayega. */
    noApp: string;
    /** {withApp} {total} — bhejne se pehle saaf dikhe ki push kitno tak jayegi. */
    devicesSummary: string;
    /** Push chuna par ek bhi device nahi — pehle hi bata do. */
    pushNoDevices: string;
  };
  /**
   * Bhejne ke BAAD ka hisaab — "Message users" ka doosra tab.
   *
   * Pehle bhejne ke baad kuch bacha hi nahi rehta tha: ek ginti dikhti thi aur
   * screen band hote hi gayab. Ab har message ka nishaan rehta hai.
   */
  report: {
    tabSend: string;
    tabReport: string;
    loading: string;
    failed: string;
    /** `supabase/message-tracking.sql` chalana baaki hai. */
    needsMigration: string;
    /** {n} — itni purani rows ke baad ka data report me nahi hai. */
    truncated: string;
    refresh: string;

    /* summary cards */
    cardEmail: string;
    cardPush: string;
    cardOpened: string;
    cardClicked: string;
    cardApp: string;
    cardWeb: string;
    cardIgnored: string;
    /** Pixel/open ki seema — jhooth se bachne ke liye saaf likha jaata hai. */
    accuracyNote: string;

    /* per-user table */
    usersTitle: string;
    searchPh: string;
    empty: string;
    colUser: string;
    colEmail: string;
    colPush: string;
    colOpened: string;
    colClicked: string;
    colWhere: string;
    colLast: string;
    /** {n} — "3 baar" */
    timesN: string;
    app: string;
    web: string;
    ignored: string;
    never: string;
    onlySent: string;
    onlyOpened: string;
    onlyIgnored: string;
    allUsers: string;

    /* batches */
    batchesTitle: string;
    colSubject: string;
    colWhen: string;
    colAudience: string;
    colReach: string;
    /** {opened} {sent} */
    openedOfSent: string;

    /* drill-down */
    detailTitle: string;
    detailLoading: string;
    detailEmpty: string;
    timeline: string;
    evOpen: string;
    evClick: string;
    evPushOpen: string;
    close: string;
    stSent: string;
    stSkipped: string;
    stFailed: string;
    chEmail: string;
    chPush: string;
  };
  /** App se aaye support tickets aur unke jawab. */
  support: {
    loadFailed: string;
    needsMigration: string;
    empty: string;
    pickOne: string;
    searchPh: string;
    tickets: string;
    fAll: string;
    stOpen: string;
    stAnswered: string;
    stClosed: string;
    you: string;
    them: string;
    seen: string;
    notSeen: string;
    replyPh: string;
    replyNote: string;
    sendReply: string;
    sending: string;
    closeTicket: string;
    /** {email} {push} */
    sentNote: string;
    sendFailed: string;
    yes: string;
    no: string;
  };
  contacts: {
    countMsg: string; // {n}
    empty: string;
    searchPh: string;
    reply: string;
  };
  /**
   * Data components (Users, Usage, Documents, Reviews, Logs, Pricing, Rewards).
   * Pehle in saat screens ke saare labels hardcoded the, isliye language switcher
   * se sirf aadha admin panel badalta tha. Ab poora.
   */
  data: {
    /** Har screen me repeat hone wale chhote labels. */
    shared: {
      name: string;
      email: string;
      user: string;
      plan: string;
      source: string;
      joined: string;
      date: string;
      status: string;
      detail: string;
      documents: string;
      reminders: string;
      chats: string;
      unlimited: string;
      never: string;
      seeAll: string;
      loadFailed: string;
      emptyFilter: string;
      empty: string;
      /** Har lambi list ke upar search box. */
      searchPh: string;
      /* Pagination ke "X–Y / Z ___" wale nouns. */
      countries: string;
      posts: string;
      pages: string;
      rows: string;
      events: string;
      total: string;
      free: string;
      plus: string;
      expired: string;
    };
    rewards: {
      totalUsers: string;
      referrals: string;
      rewarded: string;
      limitsTitle: string;
      limitsSub: string;
      freeReminders: string;
      freeDocuments: string;
      referralsTitle: string;
      referralDays: string;
      referralsOn: string;
      grantTitle: string;
      grantSub: string;
      grantDaysPh: string;
      grantBtn: string;
      /** {days} */
      granted: string;
      saved: string;
      saveFailed: string;
      grantFailed: string;
      failedPrefix: string;
    };
    reviews: {
      rating: string;
      review: string;
      websiteAllowed: string;
      totalReviews: string;
      average: string;
      websiteOk: string;
      filterAll: string;
      filterWebsite: string;
    };
    logs: {
      today: string;
      sinceYesterday: string;
      totalErrors: string;
      distinct: string;
      fromApp: string;
      noneTitle: string;
      noneSub: string;
    };
    users: {
      sourceFirstN: string;
      sourceReferral: string;
      sourceReward: string;
      sourceGooglePlay: string;
      sourceAdmin: string;
      activeTill: string;
      referralDays: string;
      code: string;
      plusActive: string;
      searchPh: string;
      details: string;
      referralCode: string;
      cameFromCode: string;
      noReferrer: string;
      earnedFromReferral: string;
      planEnds: string;
      detailFailed: string;
    };
    usage: {
      today: string;
      yesterday: string;
      all: string;
      noActivity: string;
      items: string;
      lastActive: string;
      activeUsers: string;
      whatHappened: string;
      searchPh: string;
      docsShort: string;
      loadingDetail: string;
      nothingHere: string;
    };
    /**
     * "AI & WhatsApp" tab.
     *
     * ⚠️ Ye poora tab akela reh gaya tha — baaki har admin screen language
     * switcher ke saath badalti thi aur yahi ek angrezi me chipki rehti thi.
     */
    spend: {
      today: string;
      days7: string;
      days30: string;
      all: string;
      aiLabel: string;
      whatsappLabel: string;
      emailLabel: string;
      tokens: string;
      messages: string;
      emails: string;
      calls: string;
      failed: string;
      breakdown: string;
      /** {file} — SQL file ka naam. */
      nothingYet: string;
      service: string;
      what: string;
      units: string;
      last: string;
      rows: string;
    };
    documents: {
      viewAll: string;
      byUser: string;
      inStorage: string;
      uploaders: string;
      totalSize: string;
      searchPh: string;
      allTypes: string;
      document: string;
      uploadedWhen: string;
      size: string;
      storage: string;
      view: string;
      noneYet: string;
      type: string;
      expiry: string;
      aiUnderstood: string;
      loadingPreview: string;
      previewFailed: string;
    };
    seo: {
      addPath: string;
      addBtn: string;
      title: string;
      description: string;
      ogTitle: string;
      ogDescription: string;
      keywords: string;
      keywordsHint: string;
      noindex: string;
    };
    blog: {
      postsLabel: string;
      newPost: string;
      noPosts: string;
      published: string;
      draft: string;
      title: string;
      slug: string;
      slugHint: string;
      description: string;
      descriptionHint: string;
      heading: string;
      intro: string;
      tags: string;
      readingMinutes: string;
      publishedAt: string;
      sections: string;
      sectionHeading: string;
      sectionBody: string;
      addSection: string;
      publish: string;
    };
    analytics: {
      events: string;
      sessions: string;
      peakUsers: string;
      fromWeb: string;
      daily: string;
      topScreens: string;
      journeyTitle: string;
      journeySub: string;
      userIdPh: string;
      showJourney: string;
      noJourney: string;
      /** Rozana chart (App vs Web stacked columns). */
      chartApp: string;
      chartWeb: string;
      chartTotal: string;
      chartDay: string;
      tableView: string;
      chartView: string;
    };
    pricing: {
      basePrice: string;
      monthly: string;
      yearly: string;
      addCountry: string;
      choose: string;
      multiplier: string;
      country: string;
      currency: string;
      symbol: string;
      display: string;
      remove: string;
      applyToAll: string;
    };
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
    support: "Support",
    users: "Users",
    seo: "SEO",
    blog: "Blog",
    analytics: "Analytics",
    message: "Message",
    usage: "Usage",
    spend: "AI & WhatsApp",
    documents: "Documents",
    reviews: "Reviews",
    logs: "Logs",
    contacts: "Contacts",
    pricing: "Pricing",
    rewards: "Rewards",
  },
  headings: {
    support: { title: "Support", sub: "Questions raised from the app — read the whole thread and reply. Your reply reaches them in the app, by email and as a notification." },
    seo: { title: "SEO", sub: "Title, description and keywords for every page. Saving here updates the live site — no deploy needed." },
    blog: { title: "Blog", sub: "Write and edit posts. Published posts appear on the website and in the sitemap right away." },
    analytics: { title: "Analytics", sub: "Where people go on the website and in the app — and what one user actually did." },
    rewards: { title: "Rewards & Referrals", sub: "Change offer and referral numbers here — they go live instantly." },
    pricing: { title: "Country pricing", sub: "Base × multiplier × conversion rate. Users see their country's price + currency by IP." },
    users: { title: "Users", sub: "Who's on which plan, when they joined, and how active they are." },
    usage: { title: "Usage", sub: "Who uses how much — documents, reminders, chats. And who not at all." },
    spend: { title: "AI & WhatsApp", sub: "How much we are actually consuming — Gemini tokens, WhatsApp messages and emails." },
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
    picked: "Pick people",
    pickedHint: "Choose exactly who gets this email — nobody else does.",
    listTitle: "Who gets it",
    searchPh: "Search by name or email…",
    selectAll: "Select all shown",
    clearAll: "Clear",
    onlyInactive: "Inactive only",
    activeTag: "Active",
    inactiveTag: "Inactive",
    selectedN: "{n} selected",
    noneSelected: "Pick at least one person.",
    listFailed: "Could not load the user list.",
    users: "users",
    channelTitle: "How should it reach them?",
    chEmail: "Email",
    chPush: "Phone notification",
    chBoth: "Both",
    pushOff: "Firebase isn't set up yet — see FIREBASE-SETUP.md.",
    pushDone: "{sent} notifications delivered to {devices} devices.",
    pushNone: "Nobody in this list has the app installed yet.",
    hasApp: "App",
    noApp: "No app",
    devicesSummary: "{withApp} of {total} users have the app — only they can get a notification.",
    pushNoDevices:
      "None of the selected users has the app registered — the notification will reach nobody. Email will still go.",
  },
  report: {
    tabSend: "Send",
    tabReport: "Report",
    loading: "Loading the report…",
    failed: "Could not load the report.",
    needsMigration:
      "Tracking isn't set up yet. Run supabase/message-tracking.sql in the Supabase SQL editor — after that every message sent from here is tracked.",
    truncated:
      "Showing the most recent {n} deliveries only. Older ones are in the database but not on this screen.",
    refresh: "Refresh",

    cardEmail: "Emails sent",
    cardPush: "Notifications sent",
    cardOpened: "Opened",
    cardClicked: "Clicked",
    cardApp: "Went to the app",
    cardWeb: "Went to the website",
    cardIgnored: "Never opened",
    accuracyNote:
      "“Opened” comes from a tiny invisible image in the email, so it undercounts people who block images (common in Gmail) — a click always counts as an open too. Notifications only count as opened when the person taps them.",

    usersTitle: "Person by person",
    searchPh: "Search by name or email…",
    empty: "Nothing sent yet — send a message from the Send tab.",
    colUser: "Person",
    colEmail: "Email",
    colPush: "Notification",
    colOpened: "Opened",
    colClicked: "Clicked",
    colWhere: "Went to",
    colLast: "Last sent",
    timesN: "{n}×",
    app: "App",
    web: "Web",
    ignored: "Ignored",
    never: "—",
    onlySent: "Everyone",
    onlyOpened: "Opened only",
    onlyIgnored: "Ignored only",
    allUsers: "people",

    batchesTitle: "Every message you sent",
    colSubject: "Subject",
    colWhen: "When",
    colAudience: "Audience",
    colReach: "Reach",
    openedOfSent: "{opened} of {sent} opened",

    detailTitle: "Full history",
    detailLoading: "Loading…",
    detailEmpty: "Nothing sent to this person yet.",
    timeline: "What they did",
    evOpen: "Opened the email",
    evClick: "Clicked a link",
    evPushOpen: "Tapped the notification",
    close: "Close",
    stSent: "Sent",
    stSkipped: "Not sent",
    stFailed: "Failed",
    chEmail: "Email",
    chPush: "Notification",
  },
  support: {
    loadFailed: "Could not load the tickets.",
    needsMigration:
      "Support isn't set up yet. Run supabase/support-tickets.sql in the Supabase SQL editor — after that every question raised in the app lands here.",
    empty: "No tickets here.",
    pickOne: "Pick a ticket on the left to read the whole conversation.",
    searchPh: "Ticket no, subject, name or email…",
    tickets: "tickets",
    fAll: "All",
    stOpen: "Open",
    stAnswered: "Answered",
    stClosed: "Closed",
    you: "You",
    them: "Them",
    seen: "read",
    notSeen: "not read yet",
    replyPh: "Write your reply — it reaches them in the app, by email and as a notification.",
    replyNote:
      "Sending does three things: the reply appears in their app, an email goes out, and their phone gets a notification.",
    sendReply: "Send reply",
    sending: "Sending…",
    closeTicket: "Close ticket",
    sentNote: "Email sent: {email} · notification delivered to {push} devices.",
    sendFailed: "Could not send the reply.",
    yes: "yes",
    no: "no",
  },
  contacts: {
    countMsg: "{n} messages",
    empty: "No messages yet.",
    searchPh: "Search messages…",
    reply: "Reply",
  },
  data: {
    shared: {
      name: "Name", email: "Email", user: "User", plan: "Plan", source: "Source",
      joined: "Joined", date: "Date", status: "Status", detail: "Detail",
      documents: "Documents", reminders: "Reminders", chats: "Chats",
      unlimited: "Unlimited", never: "Never", seeAll: "See all",
      loadFailed: "Could not load", emptyFilter: "Nothing matches this filter.",
      empty: "Nothing here yet.", total: "Total", free: "Free", plus: "Plus",
      expired: "Expired",
      searchPh: "Search…",
      countries: "countries", posts: "posts", pages: "pages",
      rows: "rows", events: "events",
    },
    rewards: {
      totalUsers: "Total users", referrals: "Referrals", rewarded: "Rewarded",
      limitsTitle: "Free plan limits",
      limitsSub: "Change the free plan limits here. Plus pricing lives in the Pricing section (per country).",
      freeReminders: "Free reminders", freeDocuments: "Free documents",
      referralsTitle: "Referrals", referralDays: "Referral days (for both)",
      referralsOn: "Referrals on",
      grantTitle: "Grant Plus days manually",
      grantSub: "Days are added to the user's current plan (a paid plan gets extended too).",
      grantDaysPh: "Days", grantBtn: "Grant",
      granted: "{days} days granted ✓",
      saved: "Saved ✓", saveFailed: "Could not save",
      grantFailed: "Could not grant", failedPrefix: "Failed:",
    },
    reviews: {
      rating: "Rating", review: "Review", websiteAllowed: "Website allowed",
      totalReviews: "Total reviews", average: "Average", websiteOk: "Website OK",
      filterAll: "All", filterWebsite: "Website-allowed",
    },
    logs: {
      today: "Today", sinceYesterday: "Since yesterday", totalErrors: "Total errors",
      distinct: "Distinct kinds", fromApp: "From app",
      noneTitle: "No errors 🎉", noneSub: "Everything ran fine in this range.",
    },
    users: {
      sourceFirstN: "First-N offer", sourceReferral: "Referral", sourceReward: "Reward",
      sourceGooglePlay: "Google Play", sourceAdmin: "Admin grant",
      activeTill: "Active till", referralDays: "Referral days", code: "Code",
      plusActive: "Plus (active)",
      searchPh: "Email, name or referral code…",
      details: "Details", referralCode: "Referral code",
      cameFromCode: "Came from code", noReferrer: "Nobody referred them",
      earnedFromReferral: "Earned from referrals", planEnds: "Plan ends",
      detailFailed: "Could not load details",
    },
    usage: {
      today: "Today", yesterday: "Yesterday", all: "All",
      noActivity: "No activity in this range.", items: "items",
      lastActive: "Last active", activeUsers: "Active users",
      whatHappened: "What happened", searchPh: "Email or name…",
      docsShort: "Docs", loadingDetail: "Loading full detail…",
      nothingHere: "Nothing matches this filter.",
    },
    spend: {
      today: "Today", days7: "7 days", days30: "30 days", all: "All",
      aiLabel: "AI (Gemini)", whatsappLabel: "WhatsApp (Twilio)", emailLabel: "Email (SMTP)",
      tokens: "tokens", messages: "messages", emails: "emails",
      calls: "calls", failed: "failed", breakdown: "Breakdown",
      nothingYet:
        "No usage recorded yet. If you're sure AI/WhatsApp is running, you still need to run {file} in Supabase.",
      service: "Service", what: "What", units: "Units", last: "Last", rows: "rows",
    },
    documents: {
      viewAll: "All", byUser: "By user", inStorage: "In storage",
      uploaders: "Uploaders", totalSize: "Total size",
      searchPh: "Document, name or email…", allTypes: "All types",
      document: "Document", uploadedWhen: "Uploaded", size: "Size",
      storage: "Storage", view: "View",
      noneYet: "Nobody has uploaded a document yet.",
      type: "Type", expiry: "Expiry", aiUnderstood: "What the AI understood",
      loadingPreview: "Loading preview…", previewFailed: "Preview could not load.",
    },
    seo: {
      addPath: "Add a page path",
      addBtn: "Add",
      title: "Title",
      description: "Meta description",
      ogTitle: "Social title (OG)",
      ogDescription: "Social description (OG)",
      keywords: "Keywords",
      keywordsHint:
        "Comma separated. Use words people actually search for — a long list does not help.",
      noindex: "Hide from search",
    },
    blog: {
      postsLabel: "posts",
      newPost: "New post",
      noPosts: "No posts yet. Write the first one.",
      published: "Published",
      draft: "Draft",
      title: "Title",
      slug: "URL slug",
      slugHint: "left blank = made from the title",
      description: "Meta description",
      descriptionHint: "This is the line people see in Google results. Around 155 characters.",
      heading: "Heading on the page (H1)",
      intro: "Opening paragraph",
      tags: "Tags",
      readingMinutes: "Reading minutes",
      publishedAt: "Published on",
      sections: "Sections",
      sectionHeading: "Section heading (H2)",
      sectionBody: "Paragraphs — leave a blank line to start a new one",
      addSection: "Add section",
      publish: "Publish on the website",
    },
    analytics: {
      events: "Events", sessions: "Sessions", peakUsers: "Peak daily users",
      fromWeb: "From website", daily: "Per day",
      topScreens: "Most visited screens & pages",
      journeyTitle: "One user's journey",
      journeySub:
        "Paste a user ID from the Users tab to see every screen and button, in order — website and app together.",
      userIdPh: "User ID (UUID)", showJourney: "Show journey",
      noJourney: "No events recorded for this user yet.",
      chartApp: "App",
      chartWeb: "Website",
      chartTotal: "Total",
      chartDay: "Day",
      tableView: "Table",
      chartView: "Chart",
    },
    pricing: {
      basePrice: "Base price (INR)", monthly: "Monthly", yearly: "Yearly",
      addCountry: "Add a country", choose: "Choose…",
      multiplier: "Multiplier (outside India)", country: "Country",
      currency: "Currency", symbol: "Symbol", display: "display",
      remove: "Remove", applyToAll: "Apply to all",
    },
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
    support: "सपोर्ट",
    users: "यूज़र्स",
    seo: "SEO",
    blog: "ब्लॉग",
    analytics: "एनालिटिक्स",
    message: "मैसेज",
    usage: "उपयोग",
    spend: "AI और WhatsApp",
    documents: "डॉक्युमेंट्स",
    reviews: "रिव्यूज़",
    logs: "लॉग्स",
    contacts: "कॉन्टैक्ट",
    pricing: "प्राइसिंग",
    rewards: "रिवॉर्ड्स",
  },
  headings: {
    support: { title: "सपोर्ट", sub: "ऐप से आए सवाल — पूरी बातचीत पढ़िए और जवाब दीजिए। जवाब ऐप, ईमेल और नोटिफ़िकेशन तीनों जगह पहुँचता है।" },
    seo: { title: "SEO", sub: "हर पेज का टाइटल, डिस्क्रिप्शन और कीवर्ड। यहाँ सेव करते ही लाइव साइट पर लग जाता है — डिप्लॉय नहीं करना पड़ता।" },
    blog: { title: "ब्लॉग", sub: "पोस्ट लिखें और बदलें। पब्लिश्ड पोस्ट तुरंत वेबसाइट और sitemap दोनों में आ जाती है।" },
    analytics: { title: "एनालिटिक्स", sub: "लोग वेबसाइट और ऐप में कहाँ जाते हैं — और एक यूज़र ने क्या किया।" },
    rewards: { title: "रिवॉर्ड्स और रेफरल", sub: "ऑफर और रेफरल के नंबर यहीं से बदलें — तुरंत लाइव हो जाते हैं।" },
    pricing: { title: "देश अनुसार प्राइसिंग", sub: "Base × multiplier × conversion rate. IP से यूज़र को उसके देश का प्राइस + करेंसी दिखता है।" },
    users: { title: "यूज़र्स", sub: "कौन किस प्लान पर है, कब जुड़ा, और कितना एक्टिव है।" },
    usage: { title: "उपयोग", sub: "कौन कितना उपयोग करता है — डॉक्युमेंट्स, रिमाइंडर, चैट। और कौन बिलकुल नहीं।" },
    spend: { title: "AI और WhatsApp", sub: "हमारा कितना इस्तेमाल हो रहा है — Gemini टोकन, WhatsApp मैसेज और ईमेल।" },
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
    picked: "खुद चुनें",
    pickedHint: "जिन्हें चुनेंगे सिर्फ़ उन्हीं को ईमेल जाएगा — और किसी को नहीं।",
    listTitle: "किसे जाएगा",
    searchPh: "नाम या ईमेल से खोजें…",
    selectAll: "दिख रहे सब चुनें",
    clearAll: "हटाएँ",
    onlyInactive: "सिर्फ़ inactive",
    activeTag: "एक्टिव",
    inactiveTag: "Inactive",
    selectedN: "{n} चुने गए",
    noneSelected: "कम से कम एक यूज़र चुनें।",
    listFailed: "यूज़र लिस्ट लोड नहीं हुई।",
    users: "यूज़र्स",
    channelTitle: "कैसे पहुँचे?",
    chEmail: "ईमेल",
    chPush: "फ़ोन नोटिफ़िकेशन",
    chBoth: "दोनों",
    pushOff: "Firebase अभी सेट नहीं है — FIREBASE-SETUP.md देखें।",
    pushDone: "{devices} डिवाइस में से {sent} पर नोटिफ़िकेशन पहुँची।",
    pushNone: "इस लिस्ट में अभी किसी ने ऐप इंस्टॉल नहीं की।",
    hasApp: "ऐप है",
    noApp: "ऐप नहीं",
    devicesSummary: "{total} में से {withApp} यूज़र के पास ऐप है — नोटिफ़िकेशन सिर्फ़ उन्हीं तक जाएगी।",
    pushNoDevices:
      "चुने हुए किसी भी यूज़र का फ़ोन रजिस्टर नहीं है — नोटिफ़िकेशन किसी तक नहीं पहुँचेगी। ईमेल फिर भी जाएगा।",
  },
  report: {
    tabSend: "भेजें",
    tabReport: "रिपोर्ट",
    loading: "रिपोर्ट आ रही है…",
    failed: "रिपोर्ट नहीं आ पाई।",
    needsMigration:
      "ट्रैकिंग अभी चालू नहीं है। Supabase के SQL editor में supabase/message-tracking.sql चला दें — उसके बाद यहाँ से भेजा हर मैसेज ट्रैक होगा।",
    truncated:
      "सिर्फ़ पिछले {n} भेजे हुए मैसेज दिख रहे हैं। उससे पुराने डेटाबेस में हैं, पर इस स्क्रीन पर नहीं।",
    refresh: "फिर से देखें",

    cardEmail: "ईमेल भेजे",
    cardPush: "नोटिफ़िकेशन भेजीं",
    cardOpened: "खोले गए",
    cardClicked: "क्लिक हुए",
    cardApp: "ऐप पर गए",
    cardWeb: "वेबसाइट पर गए",
    cardIgnored: "कभी नहीं खोला",

    accuracyNote:
      "“खोला” ईमेल में लगी एक छोटी-सी अदृश्य तस्वीर से पता चलता है, इसलिए जो लोग तस्वीरें बंद रखते हैं (Gmail में आम है) उनकी गिनती कम रहती है — क्लिक को हमेशा खोलना भी माना जाता है। नोटिफ़िकेशन तभी “खुली” गिनी जाती है जब उस पर टैप हो।",

    usersTitle: "एक-एक व्यक्ति",
    searchPh: "नाम या ईमेल से खोजें…",
    empty: "अभी तक कुछ नहीं भेजा — “भेजें” टैब से मैसेज भेजिए।",
    colUser: "व्यक्ति",
    colEmail: "ईमेल",
    colPush: "नोटिफ़िकेशन",
    colOpened: "खोला",
    colClicked: "क्लिक",
    colWhere: "कहाँ गए",
    colLast: "आख़िरी बार",
    timesN: "{n} बार",
    app: "ऐप",
    web: "वेब",
    ignored: "अनदेखा",
    never: "—",
    onlySent: "सभी",
    onlyOpened: "जिन्होंने खोला",
    onlyIgnored: "जिन्होंने अनदेखा किया",
    allUsers: "लोग",

    batchesTitle: "आपके भेजे हुए सारे मैसेज",
    colSubject: "विषय",
    colWhen: "कब",
    colAudience: "किसको",
    colReach: "पहुँच",
    openedOfSent: "{sent} में से {opened} ने खोला",

    detailTitle: "पूरा इतिहास",
    detailLoading: "आ रहा है…",
    detailEmpty: "इस व्यक्ति को अभी तक कुछ नहीं भेजा गया।",
    timeline: "इन्होंने क्या किया",
    evOpen: "ईमेल खोला",
    evClick: "लिंक पर क्लिक किया",
    evPushOpen: "नोटिफ़िकेशन पर टैप किया",
    close: "बंद करें",
    stSent: "गया",
    stSkipped: "नहीं गया",
    stFailed: "फ़ेल",
    chEmail: "ईमेल",
    chPush: "नोटिफ़िकेशन",
  },
  support: {
    loadFailed: "टिकट लोड नहीं हो पाए।",
    needsMigration:
      "सपोर्ट अभी चालू नहीं है। Supabase के SQL editor में supabase/support-tickets.sql चला दें — उसके बाद ऐप में पूछा गया हर सवाल यहाँ आएगा।",
    empty: "यहाँ कोई टिकट नहीं।",
    pickOne: "बाईं ओर से कोई टिकट चुनिए — पूरी बातचीत यहाँ खुलेगी।",
    searchPh: "टिकट नंबर, विषय, नाम या ईमेल…",
    tickets: "टिकट",
    fAll: "सभी",
    stOpen: "खुला",
    stAnswered: "जवाब दिया",
    stClosed: "बंद",
    you: "आप",
    them: "वे",
    seen: "पढ़ लिया",
    notSeen: "अभी पढ़ा नहीं",
    replyPh: "अपना जवाब लिखिए — यह ऐप में, ईमेल पर और नोटिफ़िकेशन तीनों जगह पहुँचेगा।",
    replyNote:
      "भेजते ही तीन काम होते हैं: जवाब उनके ऐप में दिखता है, ईमेल जाता है, और फ़ोन पर नोटिफ़िकेशन आती है।",
    sendReply: "जवाब भेजें",
    sending: "भेज रहे हैं…",
    closeTicket: "टिकट बंद करें",
    sentNote: "ईमेल गया: {email} · नोटिफ़िकेशन {push} डिवाइस पर पहुँची।",
    sendFailed: "जवाब नहीं भेजा जा सका।",
    yes: "हाँ",
    no: "नहीं",
  },
  contacts: {
    countMsg: "{n} मैसेज",
    empty: "अभी कोई मैसेज नहीं।",
    searchPh: "मैसेज खोजें…",
    reply: "जवाब दें",
  },
  data: {
    shared: {
      name: "नाम", email: "ईमेल", user: "यूज़र", plan: "प्लान", source: "स्रोत",
      joined: "कब जुड़े", date: "तारीख़", status: "स्थिति", detail: "डिटेल",
      documents: "डॉक्युमेंट्स", reminders: "रिमाइंडर", chats: "चैट",
      unlimited: "असीमित", never: "कभी नहीं", seeAll: "सब देखें",
      loadFailed: "लोड नहीं हुआ", emptyFilter: "इस फ़िल्टर में कुछ नहीं।",
      empty: "अभी कुछ नहीं।", total: "कुल", free: "फ्री", plus: "प्लस",
      expired: "खत्म",
      searchPh: "खोजें…",
      countries: "देश", posts: "पोस्ट", pages: "पेज",
      rows: "पंक्तियाँ", events: "इवेंट",
    },
    rewards: {
      totalUsers: "कुल यूज़र", referrals: "रेफरल", rewarded: "रिवॉर्ड मिला",
      limitsTitle: "फ्री प्लान लिमिट",
      limitsSub: "फ्री प्लान की लिमिट यहीं से बदलें। प्लस का दाम Pricing section में (देश अनुसार) है।",
      freeReminders: "फ्री रिमाइंडर", freeDocuments: "फ्री डॉक्युमेंट",
      referralsTitle: "रेफरल", referralDays: "रेफरल दिन (दोनों को)",
      referralsOn: "रेफरल चालू",
      grantTitle: "मैन्युअली प्लस दिन दें",
      grantSub: "दिन यूज़र के मौजूदा प्लान में जुड़ेंगे (पेड प्लान भी बढ़ेगा)।",
      grantDaysPh: "दिन", grantBtn: "दें",
      granted: "{days} दिन दे दिए ✓",
      saved: "सेव हो गया ✓", saveFailed: "सेव नहीं हुआ",
      grantFailed: "ग्रांट नहीं हुआ", failedPrefix: "नहीं हो पाया:",
    },
    reviews: {
      rating: "रेटिंग", review: "रिव्यू", websiteAllowed: "वेबसाइट पर अनुमति",
      totalReviews: "कुल रिव्यू", average: "औसत", websiteOk: "वेबसाइट OK",
      filterAll: "सारे", filterWebsite: "वेबसाइट-अनुमति वाले",
    },
    logs: {
      today: "आज", sinceYesterday: "कल से", totalErrors: "कुल एरर",
      distinct: "अलग तरह के", fromApp: "ऐप से",
      noneTitle: "कोई एरर नहीं 🎉", noneSub: "इस रेंज में सब ठीक चला।",
    },
    users: {
      sourceFirstN: "First-N offer", sourceReferral: "रेफरल", sourceReward: "रिवॉर्ड",
      sourceGooglePlay: "Google Play", sourceAdmin: "एडमिन ग्रांट",
      activeTill: "कब तक एक्टिव", referralDays: "रेफरल दिन", code: "कोड",
      plusActive: "प्लस (एक्टिव)",
      searchPh: "ईमेल, नाम या रेफरल कोड…",
      details: "डिटेल", referralCode: "रेफरल कोड",
      cameFromCode: "किस कोड से आया", noReferrer: "किसी ने रेफर नहीं किया",
      earnedFromReferral: "रेफरल से कमाए", planEnds: "प्लान खत्म",
      detailFailed: "डिटेल लोड नहीं हुई",
    },
    usage: {
      today: "आज", yesterday: "कल", all: "सब",
      noActivity: "इस रेंज में कोई गतिविधि नहीं।", items: "आइटम",
      lastActive: "आख़री बार एक्टिव", activeUsers: "एक्टिव यूज़र",
      whatHappened: "क्या-क्या हुआ", searchPh: "ईमेल या नाम…",
      docsShort: "डॉक्स", loadingDetail: "पूरा डिटेल ला रहे हैं…",
      nothingHere: "इस फ़िल्टर में कुछ नहीं।",
    },
    spend: {
      today: "आज", days7: "7 दिन", days30: "30 दिन", all: "सब",
      aiLabel: "AI (Gemini)", whatsappLabel: "WhatsApp (Twilio)", emailLabel: "ईमेल (SMTP)",
      tokens: "टोकन", messages: "मैसेज", emails: "ईमेल",
      calls: "कॉल", failed: "फ़ेल", breakdown: "ब्रेकडाउन",
      nothingYet:
        "अभी तक कोई उपयोग रिकॉर्ड नहीं हुआ। अगर आपको यक़ीन है कि AI/WhatsApp चल रहा है, तो Supabase में {file} चलाना बाक़ी है।",
      service: "सर्विस", what: "क्या", units: "यूनिट", last: "आख़िरी", rows: "रो",
    },
    documents: {
      viewAll: "सारे", byUser: "यूज़र अनुसार", inStorage: "स्टोरेज में",
      uploaders: "अपलोड करने वाले", totalSize: "कुल साइज़",
      searchPh: "डॉक्युमेंट, नाम या ईमेल…", allTypes: "सब टाइप",
      document: "डॉक्युमेंट", uploadedWhen: "कब अपलोड", size: "साइज़",
      storage: "स्टोरेज", view: "देखें",
      noneYet: "अभी किसी ने डॉक्युमेंट अपलोड नहीं किया।",
      type: "टाइप", expiry: "एक्सपायरी", aiUnderstood: "AI ने क्या समझा",
      loadingPreview: "प्रीव्यू ला रहे हैं…", previewFailed: "प्रीव्यू लोड नहीं हुआ।",
    },
    seo: {
      addPath: "नया पेज पाथ जोड़ें",
      addBtn: "जोड़ें",
      title: "टाइटल",
      description: "मेटा डिस्क्रिप्शन",
      ogTitle: "सोशल टाइटल (OG)",
      ogDescription: "सोशल डिस्क्रिप्शन (OG)",
      keywords: "कीवर्ड",
      keywordsHint:
        "कॉमा से अलग करें। वही शब्द लिखें जो लोग सच में सर्च करते हैं — लंबी लिस्ट से फ़ायदा नहीं होता।",
      noindex: "सर्च से छुपाएँ",
    },
    blog: {
      postsLabel: "पोस्ट",
      newPost: "नई पोस्ट",
      noPosts: "अभी कोई पोस्ट नहीं। पहली लिख दें।",
      published: "पब्लिश्ड",
      draft: "ड्राफ़्ट",
      title: "टाइटल",
      slug: "URL slug",
      slugHint: "खाली छोड़ें तो टाइटल से बन जाएगा",
      description: "मेटा डिस्क्रिप्शन",
      descriptionHint: "Google के रिज़ल्ट में यही लाइन दिखती है। लगभग 155 characters.",
      heading: "पेज का हेडिंग (H1)",
      intro: "पहला पैराग्राफ़",
      tags: "टैग",
      readingMinutes: "पढ़ने का समय (मिनट)",
      publishedAt: "कब पब्लिश",
      sections: "सेक्शन",
      sectionHeading: "सेक्शन का हेडिंग (H2)",
      sectionBody: "पैराग्राफ़ — खाली लाइन से नया पैराग्राफ़ बनता है",
      addSection: "सेक्शन जोड़ें",
      publish: "वेबसाइट पर पब्लिश करें",
    },
    analytics: {
      events: "इवेंट", sessions: "सेशन",
      peakUsers: "सबसे ज़्यादा रोज़ाना यूज़र",
      fromWeb: "वेबसाइट से", daily: "रोज़ाना",
      topScreens: "सबसे ज़्यादा देखे गए स्क्रीन और पेज",
      journeyTitle: "एक यूज़र का सफ़र",
      journeySub:
        "Users टैब से यूज़र ID डालें — हर स्क्रीन और बटन क्रम से दिखेगा — वेबसाइट और ऐप दोनों।",
      userIdPh: "यूज़र ID (UUID)", showJourney: "सफ़र दिखाएँ",
      noJourney: "इस यूज़र का अभी कोई इवेंट नहीं।",
      chartApp: "ऐप",
      chartWeb: "वेबसाइट",
      chartTotal: "कुल",
      chartDay: "दिन",
      tableView: "टेबल",
      chartView: "चार्ट",
    },
    pricing: {
      basePrice: "बेस प्राइस (INR)", monthly: "मासिक", yearly: "सालाना",
      addCountry: "देश जोड़ें", choose: "चुनें…",
      multiplier: "मल्टीप्लायर (बाहर के लिए)", country: "देश",
      currency: "करेंसी", symbol: "चिह्न", display: "display",
      remove: "हटाएँ", applyToAll: "सब पर लगाएँ",
    },
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
    support: "Support",
    users: "Users",
    seo: "SEO",
    blog: "Blog",
    analytics: "Analytics",
    message: "Message",
    usage: "Usage",
    spend: "AI & WhatsApp",
    documents: "Documents",
    reviews: "Reviews",
    logs: "Logs",
    contacts: "Contacts",
    pricing: "Pricing",
    rewards: "Rewards",
  },
  headings: {
    support: { title: "Support", sub: "App se aaye sawaal — poori baatcheet padhiye aur jawab dijiye. Jawab app, email aur notification teeno jagah pahunchta hai." },
    seo: { title: "SEO", sub: "Har page ka title, description aur keywords. Yahan save karte hi live site par lag jaata hai — deploy nahi karna padta." },
    blog: { title: "Blog", sub: "Post likho aur badlo. Published post turant website aur sitemap dono me aa jaati hai." },
    analytics: { title: "Analytics", sub: "Log website aur app me kahan jaate hain — aur ek user ne asal me kya kiya." },
    rewards: { title: "Rewards & Referrals", sub: "Offer aur referral ke numbers yahin se badlo — turant live ho jaate hain." },
    pricing: { title: "Country pricing", sub: "Base × multiplier × conversion rate. IP se user ko uske desh ka price + currency dikhta hai." },
    users: { title: "Users", sub: "Kaun kis plan pe hai, kab juda, aur kab tak active hai." },
    usage: { title: "Usage", sub: "Kaun kitna use karta hai — documents, reminders, chats. Aur kaun bilkul nahi." },
    spend: { title: "AI & WhatsApp", sub: "Humara kitna istemaal ho raha hai — Gemini token, WhatsApp message aur email." },
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
    picked: "Khud chuno",
    pickedHint: "Jinhe chunoge sirf unhi ko email jaayega — aur kisi ko nahi.",
    listTitle: "Kise jaayega",
    searchPh: "Naam ya email se dhoondho…",
    selectAll: "Dikh rahe sab chuno",
    clearAll: "Hatao",
    onlyInactive: "Sirf inactive",
    activeTag: "Active",
    inactiveTag: "Inactive",
    selectedN: "{n} chune gaye",
    noneSelected: "Kam se kam ek user chuno.",
    listFailed: "User list load nahi hui.",
    users: "users",
    channelTitle: "Kaise pahunche?",
    chEmail: "Email",
    chPush: "Phone notification",
    chBoth: "Dono",
    pushOff: "Firebase abhi set nahi hai — FIREBASE-SETUP.md dekho.",
    pushDone: "{devices} device me se {sent} par notification pahunch gayi.",
    pushNone: "Is list me abhi kisi ne app install nahi ki.",
    hasApp: "App hai",
    noApp: "App nahi",
    devicesSummary: "{total} me se {withApp} user ke paas app hai — notification sirf unhi tak jayegi.",
    pushNoDevices:
      "Chune hue kisi bhi user ka phone register nahi hai — notification kisi tak nahi jayegi. Email phir bhi jayega.",
  },
  report: {
    tabSend: "Bhejo",
    tabReport: "Report",
    loading: "Report aa rahi hai…",
    failed: "Report nahi aa payi.",
    needsMigration:
      "Tracking abhi chalu nahi hai. Supabase ke SQL editor me supabase/message-tracking.sql chala do — uske baad yahan se bheja har message track hoga.",
    truncated:
      "Sirf pichhle {n} bheje hue message dikh rahe hain. Usse purane database me hain, par is screen par nahi.",
    refresh: "Phir se dekho",

    cardEmail: "Email bheje",
    cardPush: "Notification bheji",
    cardOpened: "Khole gaye",
    cardClicked: "Click hue",
    cardApp: "App par gaye",
    cardWeb: "Website par gaye",
    cardIgnored: "Kabhi nahi khola",
    accuracyNote:
      "“Khola” email me lagi ek chhoti si adrishya tasveer se pata chalta hai, isliye jo log tasveerein band rakhte hain (Gmail me aam hai) unki ginti kam rehti hai — click ko hamesha khulna bhi maan lete hain. Notification tabhi “khuli” ginti hai jab uspar tap ho.",

    usersTitle: "Ek-ek banda",
    searchPh: "Naam ya email se dhoondho…",
    empty: "Abhi tak kuch nahi bheja — “Bhejo” tab se message bhejiye.",
    colUser: "Banda",
    colEmail: "Email",
    colPush: "Notification",
    colOpened: "Khola",
    colClicked: "Click",
    colWhere: "Kahan gaya",
    colLast: "Aakhri baar",
    timesN: "{n} baar",
    app: "App",
    web: "Web",
    ignored: "Ignore",
    never: "—",
    onlySent: "Sab",
    onlyOpened: "Jinhone khola",
    onlyIgnored: "Jinhone ignore kiya",
    allUsers: "log",

    batchesTitle: "Aapke bheje hue saare message",
    colSubject: "Subject",
    colWhen: "Kab",
    colAudience: "Kisko",
    colReach: "Pahunch",
    openedOfSent: "{sent} me se {opened} ne khola",

    detailTitle: "Poora hisaab",
    detailLoading: "Aa raha hai…",
    detailEmpty: "Is bande ko abhi tak kuch nahi bheja gaya.",
    timeline: "Isne kya kiya",
    evOpen: "Email khola",
    evClick: "Link par click kiya",
    evPushOpen: "Notification par tap kiya",
    close: "Band karo",
    stSent: "Gaya",
    stSkipped: "Nahi gaya",
    stFailed: "Fail",
    chEmail: "Email",
    chPush: "Notification",
  },
  support: {
    loadFailed: "Ticket load nahi ho paye.",
    needsMigration:
      "Support abhi chalu nahi hai. Supabase ke SQL editor me supabase/support-tickets.sql chala do — uske baad app me pucha gaya har sawaal yahan aayega.",
    empty: "Yahan koi ticket nahi.",
    pickOne: "Baayen se koi ticket chuniye — poori baatcheet yahan khulegi.",
    searchPh: "Ticket number, subject, naam ya email…",
    tickets: "ticket",
    fAll: "Sab",
    stOpen: "Khula",
    stAnswered: "Jawab diya",
    stClosed: "Band",
    you: "Aap",
    them: "Wo",
    seen: "padh liya",
    notSeen: "abhi padha nahi",
    replyPh: "Apna jawab likhiye — ye app me, email par aur notification teeno jagah pahunchega.",
    replyNote:
      "Bhejte hi teen kaam hote hain: jawab unke app me dikhta hai, email jaata hai, aur phone par notification aati hai.",
    sendReply: "Jawab bhejo",
    sending: "Bhej rahe hain…",
    closeTicket: "Ticket band karo",
    sentNote: "Email gaya: {email} · notification {push} device par pahunchi.",
    sendFailed: "Jawab nahi bheja ja saka.",
    yes: "haan",
    no: "nahi",
  },
  contacts: {
    countMsg: "{n} message",
    empty: "Abhi koi message nahi.",
    searchPh: "Message khojo…",
    reply: "Reply",
  },
  data: {
    shared: {
      name: "Naam", email: "Email", user: "User", plan: "Plan", source: "Source",
      joined: "Kab juda", date: "Date", status: "Status", detail: "Detail",
      documents: "Documents", reminders: "Reminders", chats: "Chats",
      unlimited: "Unlimited", never: "Kabhi nahi", seeAll: "Sab dekho",
      loadFailed: "Load nahi hua", emptyFilter: "Is filter me kuch nahi.",
      empty: "Abhi kuch nahi.", total: "Total", free: "Free", plus: "Plus",
      expired: "Khatam",
      searchPh: "Dhundo…",
      countries: "countries", posts: "posts", pages: "pages",
      rows: "rows", events: "events",
    },
    rewards: {
      totalUsers: "Total users", referrals: "Referrals", rewarded: "Rewarded",
      limitsTitle: "Free plan limits",
      limitsSub: "Free plan ki limit yahin se badlo. Plus ka daam Pricing section me (country-wise) hai.",
      freeReminders: "Free reminders", freeDocuments: "Free documents",
      referralsTitle: "Referrals", referralDays: "Referral din (dono ko)",
      referralsOn: "Referrals chalu",
      grantTitle: "Manually Plus din do",
      grantSub: "Din user ke maujooda plan me add honge (paid plan bhi extend hoga).",
      grantDaysPh: "Din", grantBtn: "Do",
      granted: "{days} din de diye ✓",
      saved: "Save ho gaya ✓", saveFailed: "Save nahi hua",
      grantFailed: "Grant nahi hua", failedPrefix: "Nahi ho paya:",
    },
    reviews: {
      rating: "Rating", review: "Review", websiteAllowed: "Website allowed",
      totalReviews: "Total reviews", average: "Average", websiteOk: "Website OK",
      filterAll: "Saare", filterWebsite: "Website-allowed",
    },
    logs: {
      today: "Aaj", sinceYesterday: "Kal se", totalErrors: "Total errors",
      distinct: "Alag tarah ke", fromApp: "App se",
      noneTitle: "Koi error nahi 🎉", noneSub: "Is range me sab theek chala.",
    },
    users: {
      sourceFirstN: "First-N offer", sourceReferral: "Referral", sourceReward: "Reward",
      sourceGooglePlay: "Google Play", sourceAdmin: "Admin grant",
      activeTill: "Active till", referralDays: "Referral din", code: "Code",
      plusActive: "Plus (active)",
      searchPh: "Email, naam ya referral code…",
      details: "Details", referralCode: "Referral code",
      cameFromCode: "Kis code se aaya", noReferrer: "Kisi ne refer nahi kiya",
      earnedFromReferral: "Referral se kamaaye", planEnds: "Plan khatam",
      detailFailed: "Detail load nahi hui",
    },
    usage: {
      today: "Aaj", yesterday: "Kal", all: "Sab",
      noActivity: "Is range me koi activity nahi.", items: "items",
      lastActive: "Last active", activeUsers: "Active users",
      whatHappened: "Kya-kya hua", searchPh: "Email ya naam…",
      docsShort: "Docs", loadingDetail: "Poora detail la rahe hain…",
      nothingHere: "Is filter me kuch nahi.",
    },
    spend: {
      today: "Aaj", days7: "7 din", days30: "30 din", all: "Sab",
      aiLabel: "AI (Gemini)", whatsappLabel: "WhatsApp (Twilio)", emailLabel: "Email (SMTP)",
      tokens: "token", messages: "message", emails: "email",
      calls: "calls", failed: "fail", breakdown: "Breakdown",
      nothingYet:
        "Abhi tak koi usage record nahi hui. Agar aapko yakeen hai ki AI/WhatsApp chal raha hai, to Supabase me {file} run karna baaki hai.",
      service: "Service", what: "Kya", units: "Units", last: "Aakhri", rows: "rows",
    },
    documents: {
      viewAll: "Saare", byUser: "User-wise", inStorage: "Storage me",
      uploaders: "Uploaders", totalSize: "Total size",
      searchPh: "Document, naam ya email…", allTypes: "Sab type",
      document: "Document", uploadedWhen: "Kab upload", size: "Size",
      storage: "Storage", view: "Dekho",
      noneYet: "Abhi kisi ne document upload nahi kiya.",
      type: "Type", expiry: "Expiry", aiUnderstood: "AI ne kya samjha",
      loadingPreview: "Preview la rahe hain…", previewFailed: "Preview load nahi hua.",
    },
    seo: {
      addPath: "Naya page path jodo",
      addBtn: "Add",
      title: "Title",
      description: "Meta description",
      ogTitle: "Social title (OG)",
      ogDescription: "Social description (OG)",
      keywords: "Keywords",
      keywordsHint:
        "Comma se alag karo. Wahi shabd likho jo log sach me search karte hain — lambi list se faayda nahi hota.",
      noindex: "Search se chhupao",
    },
    blog: {
      postsLabel: "posts",
      newPost: "Nayi post",
      noPosts: "Abhi koi post nahi. Pehli likh do.",
      published: "Published",
      draft: "Draft",
      title: "Title",
      slug: "URL slug",
      slugHint: "khaali chhodo to title se ban jaayega",
      description: "Meta description",
      descriptionHint: "Google ke result me yahi line dikhti hai. Lagbhag 155 characters.",
      heading: "Page ka heading (H1)",
      intro: "Pehla paragraph",
      tags: "Tags",
      readingMinutes: "Padhne ka time (min)",
      publishedAt: "Kab publish",
      sections: "Sections",
      sectionHeading: "Section ka heading (H2)",
      sectionBody: "Paragraphs — khaali line se naya paragraph banta hai",
      addSection: "Section jodo",
      publish: "Website par publish karo",
    },
    analytics: {
      events: "Events", sessions: "Sessions", peakUsers: "Sabse zyada rozana users",
      fromWeb: "Website se", daily: "Rozana",
      topScreens: "Sabse zyada dekhe gaye screens aur pages",
      journeyTitle: "Ek user ka safar",
      journeySub:
        "Users tab se user ID daalo — har screen aur button kram se dikhega, website aur app dono ka.",
      userIdPh: "User ID (UUID)", showJourney: "Safar dikhao",
      noJourney: "Is user ka abhi koi event nahi.",
      chartApp: "App",
      chartWeb: "Website",
      chartTotal: "Kul",
      chartDay: "Din",
      tableView: "Table",
      chartView: "Chart",
    },
    pricing: {
      basePrice: "Base price (INR)", monthly: "Monthly", yearly: "Yearly",
      addCountry: "Country add karo", choose: "Choose…",
      multiplier: "Multiplier (bahar ke liye)", country: "Country",
      currency: "Currency", symbol: "Symbol", display: "display",
      remove: "Remove", applyToAll: "Apply to all",
    },
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
