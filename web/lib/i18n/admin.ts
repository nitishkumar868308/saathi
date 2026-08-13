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
    /** Email + password wale login ke liye (admin ab ek se zyada ho sakte hain). */
    emailPh: string;
    masterHint: string;
    pending: string;
    disabled: string;
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
    /** Play/RevenueCat ke payments — kamai (spend = kharcha). */
    payments: string;
    notes: string;
    documents: string;
    /** Kaun sa user kaun se phone se chal raha hai. */
    devices: string;
    reviews: string;
    logs: string;
    contacts: string;
    pricing: string;
    rewards: string;
    renewals: string;
    deleteRequests: string;
    team: string;
  };
  headings: Record<
    | "rewards"
    | "pricing"
    | "users"
    | "usage"
    | "spend"
    | "payments"
    | "notes"
    | "documents"
    | "devices"
    | "reviews"
    | "logs"
    | "contacts"
    | "message"
    | "support"
    | "analytics"
    | "seo"
    | "blog"
    | "renewals"
    | "deleteRequests"
    | "team",
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
    /**
     * Message har user ki APNI bhasha me bhejo.
     *
     * Admin ek hi bhasha me likhta hai; bhejte waqt uska anuvaad ho jaata hai.
     * Bina iske Hindi chunne wale user ko email ka button Hindi me dikhta tha
     * aur upar poora message English me.
     */
    translateTitle: string;
    translateHint: string;
    /** GEMINI_API_KEY set hi nahi hai — toggle band rehta hai. */
    translateOff: string;
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

    /* ── SMS OTP ki hadd (is ticket wale user ki) ────────────────────
     *
     * "Mera number verify nahi ho raha" support ki sabse aam ticket hai, aur
     * uska jawab aksar ek hi hai: user ki OTP limit poori ho gayi. Pehle uske
     * liye Supabase kholna padta tha. Ab wahi ginti aur reset ticket ke saath
     * hi dikhte hain.
     */
    otpTitle: string;
    /** {hour} {perHour} {day} {perDay} */
    otpCount: string;
    otpBlocked: string;
    otpFine: string;
    otpReset: string;
    otpResetting: string;
    /** {n} */
    otpResetDone: string;
    otpResetFailed: string;
  };
  contacts: {
    countMsg: string; // {n}
    empty: string;
    searchPh: string;
    reply: string;
    /** Panel se hi jawab bhejne wala modal. */
    replyTitle: string;
    replyPh: string;
    original: string;
    send: string;
    sending: string;
    sent: string;
    failed: string;
    repliedTag: string;
    repliedBy: string; // {who} {when}
    seeReply: string;
    onlyPending: string;
    all: string;
  };
  /** Admin team — roles, members, sidebar permissions. */
  team: {
    rolesTitle: string;
    rolesSub: string;
    membersTitle: string;
    membersSub: string;
    newRole: string;
    editRole: string;
    roleName: string;
    roleNamePh: string;
    menusLabel: string;
    menusHint: string;
    noRoles: string;
    memberCount: string; // {n}
    deleteRoleConfirm: string; // {name}
    invite: string;
    inviteTitle: string;
    nameLabel: string;
    namePh: string;
    emailLabel: string;
    emailPh: string;
    roleLabel: string;
    noRole: string;
    inviteBtn: string;
    inviting: string;
    inviteSent: string; // {email}
    inviteNoMail: string;
    passwordIs: string; // {password}
    copy: string;
    copied: string;
    statusPending: string;
    statusActive: string;
    statusDisabled: string;
    approve: string;
    disable: string;
    enable: string;
    newPassword: string;
    newPasswordSent: string;
    remove: string;
    removeConfirm: string; // {email}
    overrideTitle: string;
    overrideHint: string;
    extraLabel: string;
    deniedLabel: string;
    effective: string;
    lastLogin: string;
    never: string;
    addedBy: string;
    noMembers: string;
    masterOnly: string;
    emailOff: string;
    saved: string;
    failed: string;
    you: string;
    master: string;
    masterNote: string;
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
      /* ── SMS OTP ki haddein ─────────────────────────────────────────
       * Har OTP ek SMS hai, yaani seedha paisa. Isliye ye admin ke haath me
       * hain — pehle SQL me hardcoded the aur badalne ke liye migration
       * chalani padti thi. */
      otpTitle: string;
      otpSub: string;
      otpCooldown: string;
      otpTtl: string;
      otpPerHour: string;
      otpPerDay: string;
      otpIpPerDay: string;
      otpMaxAttempts: string;
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
      /** Website par abhi sach me kitne dikh rahe hain. */
      liveOnSite: string;
      /** Manzoori ka intezaar kar rahe hain — sabse pehla kaam. */
      pendingCount: string;
      filterPending: string;
      filterApproved: string;
      filterRejected: string;
      /** Card ke badge. */
      badgePending: string;
      badgeApproved: string;
      badgeRejected: string;
      /** Buttons. */
      approveBtn: string;
      rejectBtn: string;
      undoBtn: string;
      statusFailed: string;
      /** Jab user ne website par dikhane ki anumati hi na di ho. */
      noPermissionNote: string;
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
      /**
       * "Reminder delivery" block — support ka sabse aam sawaal.
       *
       * ⚠️ Ye block isliye hai ki "mujhe WhatsApp par reminder nahi aaya" ka
       * jawab pehle kahin se milta hi nahi tha. Wajah aksar seedhi hoti hai
       * (Plus nahi, ya number verify nahi hua) par use dhoondhne me har baar
       * teen-chaar jagah dekhni padti thi.
       */
      delivery: string;
      deliveryLang: string;
      willSend: string;
      wontSend: string;
      /** Koi rok nahi — agla sawaal cron ka hai, isliye wo isi line me. */
      deliveryOk: string;
      deliveryUnknown: string;
      /** Template us bhasha me nahi hai — pahunchega, par Hinglish me. */
      waWrongLang: string;
      blockerNotPlus: string;
      blockerNoEmail: string;
      blockerNoPhone: string;
      blockerPhoneUnverified: string;
      blockerSmtpOff: string;
      blockerTwilioOff: string;
      blockerWaTemplate: string;
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
    /**
     * Play / RevenueCat ke payments — hamari KAMAI.
     *
     * ⚠️ `spend` se ulta sawaal hai aur dono ko alag rakhna zaroori hai: `spend`
     * batata hai humara kitna KHARCH ho raha hai, ye batata hai kitna AA raha
     * hai. Ek hi screen me daal dene par permission ki baat ulti ho jaati —
     * jise bill dekhna hai use har user ka transaction bhi dikh jaata.
     */
    payments: {
      today: string;
      days7: string;
      days30: string;
      days90: string;
      all: string;
      /** Upar ke card. */
      revenue: string;
      payers: string;
      events: string;
      refunds: string;
      trials: string;
      sandbox: string;
      /** Table ke sir. */
      when: string;
      user: string;
      event: string;
      product: string;
      amount: string;
      status: string;
      txn: string;
      till: string;
      rows: string;
      /** Koi row hi nahi — par wajah do alag ho sakti hain (neeche). */
      none: string;
      /**
       * Webhook abhi chalu hi nahi hai.
       *
       * ⚠️ Ye `none` se alag hona ZAROORI hai. "Abhi tak koi payment nahi hua"
       * aur "payment ho bhi jaye to hum tak khabar aayegi hi nahi" — dono ek
       * jaisi khaali screen dikhate hain, par doosri ek toota hua setup hai. Use
       * pehli wali ki tarah dikhana wo galti hai jisme sabse zyada din jaate
       * hain.
       */
      offTitle: string;
      /** {status} — kaunsa env missing hai. */
      offBody: string;
      /** Sandbox row par chhota nishaan — asli kamai me ye ginti nahi. */
      testTag: string;
    };
    /**
     * Notes ka haal — kisne kitne note banaye aur unme se kitno ka reminder bhi
     * bana.
     *
     * ⚠️ Yahan kisi ka LIKHA HUA kabhi nahi dikhta (API use bhejti hi nahi).
     * Note user ki sabse niji cheez hai; admin ka sawaal "feature chal raha hai
     * ya nahi" hai, aur uska jawab ginti se mil jaata hai.
     */
    notes: {
      title: string;
      sub: string;
      statNotes: string;
      statWithReminder: string;
      statUsers: string;
      statLast7: string;
      /** {pct} */
      ofTotal: string;
      perUser: string;
      colUser: string;
      colNotes: string;
      colWithReminder: string;
      colLast: string;
      users: string;
      empty: string;
      privacyNote: string;
      migrationMissing: string;
      /* ---- Poora matn — kisne kya likha ---- */
      tabStats: string;
      tabContent: string;
      searchPh: string;
      /** {n} = kitne note mile. */
      foundN: string;
      noMatch: string;
      allUsers: string;
      viewNotes: string;
      pinned: string;
      hasReminder: string;
      untitled: string;
      created: string;
      edited: string;
      contentMigrationMissing: string;
      /** ⚠️ Ye ab ek chetavni hai, "hum nahi dekhte" wala vaada nahi. */
      contentWarn: string;
      loadMore: string;
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
    /** "Ye document renew kaise karein" — har desh ke liye. */
    renewals: {
      title: string;
      sub: string;
      docType: string;
      /** Bilkul naya doc_type — dropdown me na ho to admin khud likhta hai. */
      newType: string;
      newTypePh: string;
      docTypeNeeded: string;
      country: string;
      /** country = '*' ka label — har desh wala fallback. */
      allCountries: string;
      add: string;
      countryFormat: string;
      alreadyExists: string;
      /** {types} = jin doc types ka '*' fallback nahi bana. */
      missingGlobal: string;
      url: string;
      urlPlaceholder: string;
      urlHint: string;
      authority: string;
      guideTitle: string;
      steps: string;
      addStep: string;
      note: string;
      autoTranslate: string;
      unreviewed: string;
      deleteAsk: string;
      /* ---- Master: guide ka dhaancha khud (fields / tags / languages) ---- */
      tabGuides: string;
      tabMaster: string;
      masterSub: string;
      fields: string;
      fieldsSub: string;
      tags: string;
      tagsSub: string;
      languages: string;
      languagesSub: string;
      /** ⚠️ Ye SIRF renewal content ki bhasha hai, app ki UI ki nahi. */
      languagesWarn: string;
      keyLabel: string;
      keyHint: string;
      keyLocked: string;
      labelLabel: string;
      nativeLabel: string;
      kindLabel: string;
      kindText: string;
      kindLongtext: string;
      kindList: string;
      kindLink: string;
      kindNote: string;
      sortLabel: string;
      requiredLabel: string;
      iconLabel: string;
      iconHint: string;
      hintLabel: string;
      colorLabel: string;
      enabledLabel: string;
      disabledBadge: string;
      lockedBadge: string;
      lockedHint: string;
      addField: string;
      addTag: string;
      addLanguage: string;
      noFields: string;
      noTags: string;
      noLanguages: string;
      deleteFieldAsk: string;
      deleteTagAsk: string;
      deleteLangAsk: string;
      /** {n} = kitne guides me ye khaana bhara hai. */
      fieldInUse: string;
      migrationMissing: string;
      entryTags: string;
      noGuides: string;
      needMaster: string;
    };
    /** Account delete requests — dekhna aur poora karna. */
    deleteRequests: {
      title: string;
      sub: string;
      empty: string;
      status: { pending: string; hidden: string; deleted: string; rejected: string };
      reason: string;
      willDelete: string;
      removedTitle: string;
      files: string;
      nothingLeft: string;
      noAccount: string;
      noAccountHelp: string;
      hide: string;
      unhide: string;
      purge: string;
      reject: string;
      hideConfirm: string;
      /** {email} = user ka email, jo admin ko likhna padta hai. */
      purgeConfirm: string;
      /** Dono raaston ka fark — sabse zaroori line. */
      hideVsDelete: string;
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
    /**
     * Pricing tab — poora sirf PADHNE ke liye.
     *
     * ⚠️ Yahan pehle `basePrice`, `addCountry`, `multiplier`, `applyToAll`
     *    jaisi keys thi — ek manual pricing editor ki. Wo poora editor hata
     *    diya gaya: daam ab sirf Play Console me set hota hai. Do jagah daam
     *    rakhne ka natija hamesha ek tha — website ek number dikhati aur Play
     *    doosra kaat leta.
     */
    pricing: {
      monthly: string;
      yearly: string;
      country: string;
      currency: string;
      play: {
        title: string;
        sub: string;
        syncNow: string;
        syncing: string;
        lastSync: string;
        never: string;
        regions: string;
        offTitle: string;
        offBody: string;
        openConsole: string;
        staleWarn: string;
        /** Neeche wala "ye sirf display price hai" wala note. */
        note: string;
        /**
         * "2 ghante pehle" jaisa relative waqt.
         *
         * ⚠️ Ye ek function me bante the aur isliye hardcoded Hinglish reh gaye
         *    the — JSX me na hone ki wajah se koi scan inhe pakadta bhi nahi.
         *    `{n}` ki jagah ginti aati hai.
         */
        justNow: string;
        minsAgo: string;
        hoursAgo: string;
        daysAgo: string;
      };
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
    emailPh: "Email (leave blank for master)",
    masterHint: "Master admin: leave the email blank and enter the .env password.",
    pending: "Your account hasn't been approved yet — ask the master admin.",
    disabled: "This account has been turned off.",
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
    payments: "Payments",
    notes: "Notes",
    documents: "Documents",
    devices: "Devices",
    reviews: "Reviews",
    logs: "Logs",
    contacts: "Contacts",
    pricing: "Pricing",
    rewards: "Rewards",
    renewals: "Renew guides",
    deleteRequests: "Delete requests",
    team: "Admin team",
  },
  headings: {
    support: { title: "Support", sub: "Questions raised from the app — read the whole thread and reply. Your reply reaches them in the app, by email and as a notification." },
    seo: { title: "SEO", sub: "Title, description and keywords for every page. Saving here updates the live site — no deploy needed." },
    blog: { title: "Blog", sub: "Write and edit posts. Published posts appear on the website and in the sitemap right away." },
    renewals: { title: "How to renew", sub: "What people should actually do when a document expires. Every country gets an answer — the all-countries guide is the fallback." },
    deleteRequests: { title: "Delete requests", sub: "People asking to have their account deleted. See everything of theirs, then hide it or remove it for good." },
    analytics: { title: "Analytics", sub: "Where people go on the website and in the app — and what one user actually did." },
    rewards: { title: "Rewards & Referrals", sub: "Change offer and referral numbers here — they go live instantly." },
    pricing: { title: "Pricing", sub: "Prices come from Google Play Console — set them there, sync them here. Visitors see their own country's price by IP." },
    users: { title: "Users", sub: "Who's on which plan, when they joined, and how active they are." },
    usage: { title: "Usage", sub: "Who uses how much — documents, reminders, chats. And who not at all." },
    spend: { title: "AI & WhatsApp", sub: "How much we are actually consuming — Gemini tokens, WhatsApp messages and emails." },
    payments: { title: "Payments", sub: "Every Play Store purchase, renewal and refund — who paid, when, and how much." },
    notes: { title: "Notes", sub: "Who writes notes, and how many turn into a reminder. What people write is never shown." },
    documents: { title: "Documents", sub: "Who uploaded which document and when — with the path. Click View to see." },
    devices: { title: "Devices", sub: "Which user is on which phone. Only one phone stays active at a time — reminders and alerts go only there. If a code never reaches their email, activate their phone from here." },
    reviews: { title: "Reviews & Ratings", sub: "Reviews from the app. A review reaches the website only when the user allowed it AND you approve it — nothing goes live on its own." },
    logs: { title: "Logs & Issues", sub: "What broke in app/web — full stack + context. New errors also go to email." },
    // ⚠️ `sub` jaan-boojh ke khaali hai — AdminDashboard is EK section par
    // subtitle ki jagah "{n} messages" wali live ginti dikhata hai
    // (`t.contacts.countMsg`). Ise bharne par wo ginti dab jaayegi.
    contacts: { title: "Contact messages", sub: "" },
    team: { title: "Admin team", sub: "Create roles, decide which menus each role sees, and invite people. New members stay pending until you approve them." },
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
    translateTitle: "Send in each user's own language",
    translateHint:
      "Write once, in any language. Before sending, the subject and message are translated into whatever language each user picked in the app — Hinglish, Hindi or English.",
    translateOff:
      "Translation is off — GEMINI_API_KEY isn't set in the web env. Everyone gets exactly what you type.",
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
    otpTitle: "SMS OTP limit",
    otpCount: "{hour}/{perHour} this hour · {day}/{perDay} today",
    otpBlocked: "Blocked — can't request a new code",
    otpFine: "Within limit",
    otpReset: "Reset limit",
    otpResetting: "Resetting…",
    otpResetDone: "Limit reset ({n} sends cleared). They can try again now.",
    otpResetFailed: "Could not reset the limit.",
  },
  contacts: {
    countMsg: "{n} messages",
    empty: "No messages yet.",
    searchPh: "Search messages…",
    reply: "Reply",
    replyTitle: "Reply to {name}",
    replyPh: "Write your reply…",
    original: "Their message",
    send: "Send reply",
    sending: "Sending…",
    sent: "Reply sent ✅",
    failed: "Could not send the reply.",
    repliedTag: "Replied",
    repliedBy: "Replied by {who} · {when}",
    seeReply: "See reply",
    onlyPending: "Not replied",
    all: "All",
  },
  team: {
    rolesTitle: "Roles",
    rolesSub: "A role decides which sidebar menus its members see.",
    membersTitle: "Members",
    membersSub: "Everyone who can sign in to this panel.",
    newRole: "New role",
    editRole: "Edit role",
    roleName: "Role name",
    roleNamePh: "e.g. Support Staff",
    menusLabel: "Menus this role can open",
    menusHint: "Unticked menus are hidden from the sidebar and their API is blocked too.",
    noRoles: "No roles yet.",
    memberCount: "{n} members",
    deleteRoleConfirm: "Delete the role “{name}”? Its members stay, but they lose all menus until you give them another role.",
    invite: "Invite member",
    inviteTitle: "Invite a new member",
    nameLabel: "Name",
    namePh: "e.g. Riya Sharma",
    emailLabel: "Email",
    emailPh: "name@gmail.com",
    roleLabel: "Role",
    noRole: "No role (no menus)",
    inviteBtn: "Send invite",
    inviting: "Sending…",
    inviteSent: "Login details emailed to {email} ✅",
    inviteNoMail: "Member added, but the email could not be sent. Share this password yourself:",
    passwordIs: "Password: {password}",
    copy: "Copy",
    copied: "Copied ✅",
    statusPending: "Pending",
    statusActive: "Active",
    statusDisabled: "Off",
    approve: "Approve",
    disable: "Turn off",
    enable: "Turn on",
    newPassword: "New password",
    newPasswordSent: "A new password has been emailed ✅",
    remove: "Remove",
    removeConfirm: "Remove {email} from the admin team?",
    overrideTitle: "Just for this person",
    overrideHint: "On top of the role. A blocked menu always wins, even if the role allows it.",
    extraLabel: "Also allow",
    deniedLabel: "Always block",
    effective: "Gets",
    lastLogin: "Last login",
    never: "Never",
    addedBy: "Added by",
    noMembers: "Nobody added yet.",
    masterOnly: "Only the master admin can change the team.",
    emailOff: "⚠️ Email is not configured (SMTP env) — invites will not go out.",
    saved: "Saved ✅",
    failed: "Could not save.",
    you: "you",
    master: "Master",
    masterNote: "The master admin signs in with the .env password and always sees every menu.",
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
      otpTitle: "SMS OTP limits",
      otpSub: "Every OTP is a paid SMS. Raising these costs money — check Spend first. If a genuine user gets stuck, reset just their limit from their support ticket.",
      otpCooldown: "Gap between SMS (seconds)",
      otpTtl: "Code valid for (seconds)",
      otpPerHour: "Max SMS per hour (per user)",
      otpPerDay: "Max SMS per day (per user)",
      otpIpPerDay: "Max different numbers per IP per day",
      otpMaxAttempts: "Wrong tries before a code dies",
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
      liveOnSite: "Live on site", pendingCount: "Waiting for you",
      filterPending: "Pending", filterApproved: "Approved", filterRejected: "Rejected",
      badgePending: "Waiting for approval",
      badgeApproved: "Live on website",
      badgeRejected: "Rejected",
      approveBtn: "Approve", rejectBtn: "Reject", undoBtn: "Move back to pending",
      statusFailed: "Could not change",
      noPermissionNote: "User did not allow this on the website — it can never go live.",
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
      delivery: "Reminder delivery", deliveryLang: "Message language",
      willSend: "Will send", wontSend: "Won't send",
      deliveryOk: "Nothing is blocking delivery — check that the cron is running.",
      deliveryUnknown: "Couldn't check delivery.",
      waWrongLang: "No template in this language — WhatsApp will arrive in Hinglish.",
      blockerNotPlus: "Not on Plus — email and WhatsApp are Plus-only.",
      blockerNoEmail: "No email on the profile.",
      blockerNoPhone: "No phone number added.",
      blockerPhoneUnverified: "Phone added but never verified — nothing is sent to it.",
      blockerSmtpOff: "SMTP isn't configured on the server.",
      blockerTwilioOff: "Twilio isn't configured on the server.",
      blockerWaTemplate: "No approved WhatsApp template — Meta rejects the message.",
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
    payments: {
      today: "Today", days7: "7 days", days30: "30 days", days90: "90 days", all: "All",
      revenue: "Revenue", payers: "Paying users", events: "Events",
      refunds: "Refunds", trials: "Trials", sandbox: "Test purchases",
      when: "When", user: "User", event: "Event", product: "Plan",
      amount: "Amount", status: "Status", txn: "Transaction", till: "Valid till",
      rows: "payments",
      none: "No payments in this period yet.",
      offTitle: "Play Billing is switched off",
      offBody:
        "Purchases can happen in the app, but no webhook will reach us — so nothing will be recorded here. Reason: {status}. Set PLAY_BILLING_ENABLED=1 and REVENUECAT_WEBHOOK_SECRET once you go live on Play Console.",
      testTag: "test",
    },
    notes: {
      title: "Notes",
      sub: "Who is writing notes, and how many of those turned into a reminder.",
      statNotes: "Notes",
      statWithReminder: "With reminder",
      statUsers: "People",
      statLast7: "Last 7 days",
      ofTotal: "{pct}% of all notes",
      perUser: "Per person",
      colUser: "Person",
      colNotes: "Notes",
      colWithReminder: "With reminder",
      colLast: "Last activity",
      users: "people",
      empty: "Nobody has written a note yet.",
      privacyNote:
        "Counts and timestamps answer the question that matters most — is the feature being used, and do notes turn into reminders. The full text is under Content.",
      migrationMissing:
        "Run supabase/notes.sql and supabase/notes-reminder-link.sql in the Supabase SQL editor first.",
      tabStats: "Numbers",
      tabContent: "Content",
      searchPh: "Search inside notes…",
      foundN: "{n} notes",
      noMatch: "Nothing matched.",
      allUsers: "Everyone",
      viewNotes: "Read",
      pinned: "pinned",
      hasReminder: "reminder set",
      untitled: "(no title)",
      created: "written",
      edited: "edited",
      contentMigrationMissing: "Run supabase/notes-admin-content.sql in the Supabase SQL editor first.",
      contentWarn:
        "This is what people wrote, word for word. Notes hold shopping lists, ideas, phone numbers, sometimes money — things written in the belief that they were private. Read only what you actually need for the job in front of you, and make sure the privacy policy says this can happen.",
      loadMore: "Load more",
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
    renewals: {
      title: "How to renew",
      sub: "What a user should do when a document is expiring. Shown inside the app, works offline.",
      docType: "Document type",
      newType: "…or a new type",
      newTypePh: "e.g. visa",
      docTypeNeeded: "Pick a document type or type a new one.",
      country: "Country (ISO2)",
      allCountries: "All countries",
      add: "Add",
      countryFormat: "Country must be a 2-letter code, like US or AE.",
      alreadyExists: "This document type already has a guide for that country.",
      missingGlobal:
        "No all-countries fallback for: {types}. Users outside the countries listed below will see nothing for these document types.",
      url: "Official link",
      urlPlaceholder: "https://…",
      urlHint:
        "Leave empty when there is no single official portal — the steps are then the whole answer.",
      authority: "Who handles it",
      guideTitle: "Heading",
      steps: "Steps",
      addStep: "Add step",
      note: "Note (the one thing people get wrong)",
      autoTranslate: "Translate into the other languages on save",
      unreviewed: "unchecked",
      deleteAsk: "Remove this country's guide?",
      tabGuides: "Guides",
      tabMaster: "Master",
      masterSub:
        "The shape of a guide. Fields you add here become the boxes you fill in on every guide — and the app shows them in this order.",
      fields: "Fields",
      fieldsSub: "What a guide is made of. Order here is the order in the app.",
      tags: "Tags",
      tagsSub: "Labels you can put on a guide. Handy for finding things later.",
      languages: "Languages",
      languagesSub: "Which languages a guide can be written in.",
      languagesWarn:
        "This is the language of the renewal content only — not the app's own menus and buttons. Adding a language here lets you write guides in it; the app's interface stays in the languages it ships with. For the app to pick a language up, the code must match the app's own (hinglish, hi, en).",
      keyLabel: "Key",
      keyHint: "a-z, 0-9 and _ only. Cannot be changed later.",
      keyLocked: "The key is what the saved content is filed under — changing it would orphan everything already written in this field.",
      labelLabel: "Label",
      nativeLabel: "In its own language",
      kindLabel: "Kind",
      kindText: "Text — one line",
      kindLongtext: "Paragraph",
      kindList: "List — numbered steps",
      kindLink: "Link — becomes a button",
      kindNote: "Note — highlighted box",
      sortLabel: "Order",
      requiredLabel: "Required",
      iconLabel: "Icon",
      iconHint: "Ionicons name, e.g. bulb-outline. Leave empty for none.",
      hintLabel: "Help text",
      colorLabel: "Colour",
      enabledLabel: "On",
      disabledBadge: "off",
      lockedBadge: "locked",
      lockedHint: "The app's renewal card is built on this one — it can be turned off, but not removed.",
      addField: "Add field",
      addTag: "Add tag",
      addLanguage: "Add language",
      noFields: "No fields yet. Add one to start — a guide with no fields has nothing to show.",
      noTags: "No tags yet.",
      noLanguages: "No languages yet. Add at least one before writing a guide.",
      deleteFieldAsk:
        "Remove this field? What is already written in it stays in the database but stops showing — add the field back and it returns.",
      deleteTagAsk: "Remove this tag?",
      deleteLangAsk: "Remove this language? Guides already written in it stop showing.",
      fieldInUse: "used in {n} guides",
      migrationMissing: "Run supabase/renewal-master.sql first.",
      entryTags: "Tags",
      noGuides: "No guides yet. Add one above.",
      needMaster:
        "Add at least one field and one language in Master first — without them there is nothing to fill in.",
    },
    deleteRequests: {
      title: "Delete requests",
      sub: "People who asked for their account to be deleted — and everything of theirs you would remove.",
      empty: "No delete requests yet.",
      status: { pending: "pending", hidden: "hidden", deleted: "deleted", rejected: "rejected" },
      reason: "Reason they gave",
      willDelete: "What would be deleted",
      removedTitle: "What was deleted",
      files: "Document files",
      nothingLeft: "Nothing left to delete.",
      noAccount: "no account",
      noAccountHelp:
        "No account matches this email, so there is nothing to delete. They may have used a different address — check with them before rejecting.",
      hide: "Hide from user",
      unhide: "Restore access",
      purge: "Delete everything",
      reject: "Reject",
      hideConfirm: "Hide this account? Their data stays in the database and you can restore it.",
      purgeConfirm:
        "This cannot be undone. Type the email to confirm you want to permanently delete everything:\n\n{email}",
      hideVsDelete:
        "Hide first, delete later. Hiding shuts the account out of the app but keeps everything, so you can restore it if they come back or a payment question comes up. Deleting removes the files, every row and the login itself — there is no way back.",
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
      monthly: "Monthly", yearly: "Yearly",
      country: "Country", currency: "Currency",
      play: {
        title: "Google Play — live price",
        sub: "These are the real prices from Play Console — the same ones the app charges. To change a price, change it there and sync. This table is read-only on purpose.",
        syncNow: "Sync now",
        syncing: "Syncing…",
        lastSync: "Last synced",
        never: "never",
        regions: "regions",
        offTitle: "Play price sync is off",
        offBody: "Until it is set up, the website shows the default ₹99 / ₹999. Setup: docs/play-prices.md",
        openConsole: "Open Play Console",
        staleWarn: "Last successful sync was over 3 days ago — the prices below may be out of date.",
        note: "Note: this is the display price only. Google Play charges based on the user's account country — a VPN can change what is shown, not what is charged. To change a price, change it in Play Console and then hit Sync now.",
        justNow: "just now",
        minsAgo: "{n} min ago",
        hoursAgo: "{n} hours ago",
        daysAgo: "{n} days ago",
      },
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
    emailPh: "ईमेल (मास्टर के लिए खाली छोड़ें)",
    masterHint: "मास्टर एडमिन: ईमेल खाली छोड़ें और .env वाला पासवर्ड डालें।",
    pending: "आपका अकाउंट अभी अप्रूव नहीं हुआ — मास्टर एडमिन से कहिए।",
    disabled: "यह अकाउंट बंद कर दिया गया है।",
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
    payments: "पेमेंट",
    notes: "नोट्स",
    documents: "डॉक्युमेंट्स",
    devices: "डिवाइस",
    reviews: "रिव्यूज़",
    logs: "लॉग्स",
    contacts: "कॉन्टैक्ट",
    pricing: "प्राइसिंग",
    rewards: "रिवॉर्ड्स",
    renewals: "रिन्यू गाइड",
    deleteRequests: "डिलीट रिक्वेस्ट",
    team: "एडमिन टीम",
  },
  headings: {
    support: { title: "सपोर्ट", sub: "ऐप से आए सवाल — पूरी बातचीत पढ़िए और जवाब दीजिए। जवाब ऐप, ईमेल और नोटिफ़िकेशन तीनों जगह पहुँचता है।" },
    seo: { title: "SEO", sub: "हर पेज का टाइटल, डिस्क्रिप्शन और कीवर्ड। यहाँ सेव करते ही लाइव साइट पर लग जाता है — डिप्लॉय नहीं करना पड़ता।" },
    blog: { title: "ब्लॉग", sub: "पोस्ट लिखें और बदलें। पब्लिश्ड पोस्ट तुरंत वेबसाइट और sitemap दोनों में आ जाती है।" },
    renewals: { title: "रिन्यू कैसे करें", sub: "डॉक्युमेंट एक्सपायर होने पर लोगों को असल में क्या करना चाहिए। हर देश को जवाब मिलता है — सभी-देश वाली गाइड फ़ॉलबैक है।" },
    deleteRequests: { title: "डिलीट रिक्वेस्ट", sub: "जो लोग अकाउंट डिलीट करवाना चाहते हैं। उनका सब कुछ देखें, फिर छुपाएँ या हमेशा के लिए हटाएँ।" },
    analytics: { title: "एनालिटिक्स", sub: "लोग वेबसाइट और ऐप में कहाँ जाते हैं — और एक यूज़र ने क्या किया।" },
    rewards: { title: "रिवॉर्ड्स और रेफरल", sub: "ऑफर और रेफरल के नंबर यहीं से बदलें — तुरंत लाइव हो जाते हैं।" },
    pricing: { title: "प्राइसिंग", sub: "दाम Google Play Console से आते हैं — सेट वहीं करें, यहाँ sync करें। IP से यूज़र को उसके देश का प्राइस दिखता है।" },
    users: { title: "यूज़र्स", sub: "कौन किस प्लान पर है, कब जुड़ा, और कितना एक्टिव है।" },
    usage: { title: "उपयोग", sub: "कौन कितना उपयोग करता है — डॉक्युमेंट्स, रिमाइंडर, चैट। और कौन बिलकुल नहीं।" },
    spend: { title: "AI और WhatsApp", sub: "हमारा कितना इस्तेमाल हो रहा है — Gemini टोकन, WhatsApp मैसेज और ईमेल।" },
    payments: { title: "पेमेंट", sub: "हर Play Store परचेज़, रिन्यूअल और रिफ़ंड — किसने, कब, कितना दिया।" },
    notes: { title: "नोट्स", sub: "कौन नोट लिखता है, और उनमें से कितनों का रिमाइंडर बनता है। लोग क्या लिखते हैं वह कभी नहीं दिखता।" },
    documents: { title: "डॉक्युमेंट्स", sub: "किसने कौन सा डॉक्युमेंट, कब अपलोड किया — path के साथ। View पर क्लिक करके देखें।" },
    devices: { title: "डिवाइस", sub: "कौन सा user कौन से फ़ोन से चल रहा है। एक समय में एक ही फ़ोन active रहता है — रिमाइंडर और अलर्ट उसी पर जाते हैं। जिसके email पर कोड न पहुँचे, उसका फ़ोन यहाँ से चालू करें।" },
    reviews: { title: "रिव्यूज़ और रेटिंग", sub: "ऐप में आए रिव्यूज़। वेबसाइट पर रिव्यू तभी जाता है जब यूज़र ने अनुमति दी हो और आप मंज़ूरी दें — अपने आप कुछ लाइव नहीं होता।" },
    logs: { title: "लॉग्स और इशू", sub: "ऐप/वेब में क्या टूटा — पूरा stack + context. नए errors ईमेल पर भी जाते हैं।" },
    // ⚠️ `sub` jaan-boojh ke khaali hai — AdminDashboard is EK section par
    // subtitle ki jagah "{n} messages" wali live ginti dikhata hai
    // (`t.contacts.countMsg`). Ise bharne par wo ginti dab jaayegi.
    contacts: { title: "कॉन्टैक्ट मैसेज", sub: "" },
    team: { title: "एडमिन टीम", sub: "रोल बनाइए, तय कीजिए कि किस रोल को कौन-से मेन्यू दिखें, और लोगों को जोड़िए। नया मेंबर आपके अप्रूव करने तक pending रहता है।" },
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
    translateTitle: "हर यूज़र की अपनी भाषा में भेजें",
    translateHint:
      "एक ही बार, किसी भी भाषा में लिखिए। भेजने से पहले सब्जेक्ट और मैसेज उसी भाषा में बदल जाते हैं जो यूज़र ने ऐप में चुनी है — हिंग्लिश, हिंदी या अंग्रेज़ी।",
    translateOff:
      "अनुवाद बंद है — web env में GEMINI_API_KEY सेट नहीं है। सबको वही जाएगा जो आप लिखेंगे।",
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
    otpTitle: "SMS OTP लिमिट",
    otpCount: "इस घंटे {hour}/{perHour} · आज {day}/{perDay}",
    otpBlocked: "ब्लॉक — नया कोड नहीं माँग सकते",
    otpFine: "लिमिट के अंदर",
    otpReset: "लिमिट रीसेट करें",
    otpResetting: "रीसेट हो रहा है…",
    otpResetDone: "लिमिट रीसेट हो गई ({n} भेजे हुए हटाए)। अब दोबारा कोशिश कर सकते हैं।",
    otpResetFailed: "लिमिट रीसेट नहीं हो पाई।",
  },
  contacts: {
    countMsg: "{n} मैसेज",
    empty: "अभी कोई मैसेज नहीं।",
    searchPh: "मैसेज खोजें…",
    reply: "जवाब दें",
    replyTitle: "{name} को जवाब",
    replyPh: "अपना जवाब लिखिए…",
    original: "उनका मैसेज",
    send: "जवाब भेजें",
    sending: "भेज रहे हैं…",
    sent: "जवाब भेज दिया ✅",
    failed: "जवाब नहीं भेजा जा सका।",
    repliedTag: "जवाब दिया",
    repliedBy: "{who} ने जवाब दिया · {when}",
    seeReply: "जवाब देखें",
    onlyPending: "जिनका जवाब बाकी है",
    all: "सभी",
  },
  team: {
    rolesTitle: "रोल",
    rolesSub: "रोल तय करता है कि उसके मेंबर को साइडबार में कौन-से मेन्यू दिखेंगे।",
    membersTitle: "मेंबर",
    membersSub: "वे सब जो इस पैनल में लॉगिन कर सकते हैं।",
    newRole: "नया रोल",
    editRole: "रोल बदलें",
    roleName: "रोल का नाम",
    roleNamePh: "जैसे Support Staff",
    menusLabel: "इस रोल को कौन-से मेन्यू खुलेंगे",
    menusHint: "बिना टिक वाले मेन्यू साइडबार में नहीं दिखते, और उनका API भी बंद रहता है।",
    noRoles: "अभी कोई रोल नहीं।",
    memberCount: "{n} मेंबर",
    deleteRoleConfirm: "रोल “{name}” हटाएँ? उसके मेंबर बने रहेंगे, पर नया रोल देने तक उन्हें कोई मेन्यू नहीं मिलेगा।",
    invite: "मेंबर जोड़ें",
    inviteTitle: "नया मेंबर जोड़ें",
    nameLabel: "नाम",
    namePh: "जैसे Riya Sharma",
    emailLabel: "ईमेल",
    emailPh: "name@gmail.com",
    roleLabel: "रोल",
    noRole: "कोई रोल नहीं (कोई मेन्यू नहीं)",
    inviteBtn: "इनवाइट भेजें",
    inviting: "भेज रहे हैं…",
    inviteSent: "लॉगिन की जानकारी {email} पर भेज दी ✅",
    inviteNoMail: "मेंबर जुड़ गया, पर ईमेल नहीं जा सका। यह पासवर्ड खुद भेज दीजिए:",
    passwordIs: "पासवर्ड: {password}",
    copy: "कॉपी",
    copied: "कॉपी हो गया ✅",
    statusPending: "पेंडिंग",
    statusActive: "चालू",
    statusDisabled: "बंद",
    approve: "अप्रूव करें",
    disable: "बंद करें",
    enable: "चालू करें",
    newPassword: "नया पासवर्ड",
    newPasswordSent: "नया पासवर्ड ईमेल कर दिया ✅",
    remove: "हटाएँ",
    removeConfirm: "{email} को एडमिन टीम से हटाएँ?",
    overrideTitle: "सिर्फ़ इस व्यक्ति के लिए",
    overrideHint: "रोल के ऊपर। रोक हमेशा भारी पड़ती है, चाहे रोल में वह मेन्यू हो।",
    extraLabel: "यह भी दें",
    deniedLabel: "यह कभी नहीं",
    effective: "मिलता है",
    lastLogin: "पिछला लॉगिन",
    never: "कभी नहीं",
    addedBy: "जोड़ा",
    noMembers: "अभी कोई नहीं जोड़ा गया।",
    masterOnly: "टीम सिर्फ़ मास्टर एडमिन बदल सकता है।",
    emailOff: "⚠️ ईमेल सेट नहीं है (SMTP env) — इनवाइट नहीं जाएँगे।",
    saved: "सेव हो गया ✅",
    failed: "सेव नहीं हुआ।",
    you: "आप",
    master: "मास्टर",
    masterNote: "मास्टर एडमिन .env वाले पासवर्ड से लॉगिन करता है और उसे हमेशा सारे मेन्यू दिखते हैं।",
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
      otpTitle: "SMS OTP लिमिट",
      otpSub: "हर OTP एक पेड SMS है। इन्हें बढ़ाने में पैसा लगता है — पहले Spend देख लें। कोई सही यूज़र फँस जाए तो उसकी लिमिट उसके सपोर्ट टिकट से अलग से रीसेट करें।",
      otpCooldown: "दो SMS के बीच अंतर (सेकंड)",
      otpTtl: "कोड कितनी देर चले (सेकंड)",
      otpPerHour: "एक घंटे में ज़्यादा से ज़्यादा SMS (प्रति यूज़र)",
      otpPerDay: "एक दिन में ज़्यादा से ज़्यादा SMS (प्रति यूज़र)",
      otpIpPerDay: "एक IP से एक दिन में कितने अलग नंबर",
      otpMaxAttempts: "कितनी ग़लत कोशिश के बाद कोड मर जाए",
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
      liveOnSite: "साइट पर लाइव", pendingCount: "आपके इंतज़ार में",
      filterPending: "बाक़ी", filterApproved: "मंज़ूर", filterRejected: "नामंज़ूर",
      badgePending: "मंज़ूरी का इंतज़ार",
      badgeApproved: "वेबसाइट पर लाइव",
      badgeRejected: "नामंज़ूर",
      approveBtn: "मंज़ूर करो", rejectBtn: "नामंज़ूर करो", undoBtn: "वापस बाक़ी में डालो",
      statusFailed: "बदल नहीं पाया",
      noPermissionNote: "यूज़र ने वेबसाइट पर दिखाने की अनुमति नहीं दी — यह कभी लाइव नहीं जा सकता।",
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
      delivery: "रिमाइंडर डिलीवरी", deliveryLang: "मैसेज की भाषा",
      willSend: "जाएगा", wontSend: "नहीं जाएगा",
      deliveryOk: "कोई रोक नहीं — अब देखें कि cron चल रहा है या नहीं।",
      deliveryUnknown: "डिलीवरी जाँची नहीं जा सकी।",
      waWrongLang: "इस भाषा का टेम्पलेट नहीं — WhatsApp Hinglish में पहुँचेगा।",
      blockerNotPlus: "प्लस नहीं है — ईमेल और WhatsApp सिर्फ़ प्लस में।",
      blockerNoEmail: "प्रोफ़ाइल में ईमेल नहीं है।",
      blockerNoPhone: "नंबर डाला ही नहीं गया।",
      blockerPhoneUnverified: "नंबर है पर वेरिफ़ाई नहीं हुआ — उस पर कुछ नहीं जाता।",
      blockerSmtpOff: "सर्वर पर SMTP सेट नहीं है।",
      blockerTwilioOff: "सर्वर पर Twilio सेट नहीं है।",
      blockerWaTemplate: "कोई approved WhatsApp टेम्पलेट नहीं — Meta मैसेज reject करता है।",
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
    payments: {
      today: "आज", days7: "7 दिन", days30: "30 दिन", days90: "90 दिन", all: "सब",
      revenue: "कमाई", payers: "पैसे देने वाले", events: "इवेंट",
      refunds: "रिफ़ंड", trials: "ट्रायल", sandbox: "टेस्ट परचेज़",
      when: "कब", user: "यूज़र", event: "इवेंट", product: "प्लान",
      amount: "रक़म", status: "स्टेटस", txn: "ट्रांज़ैक्शन", till: "कब तक",
      rows: "पेमेंट",
      none: "इस अवधि में अभी कोई पेमेंट नहीं।",
      offTitle: "Play Billing बंद है",
      offBody:
        "ऐप में परचेज़ हो सकती है, पर webhook हम तक आएगा ही नहीं — यानी यहाँ कुछ रिकॉर्ड नहीं होगा। वजह: {status}. Play Console पर live होते ही PLAY_BILLING_ENABLED=1 और REVENUECAT_WEBHOOK_SECRET सेट करें।",
      testTag: "टेस्ट",
    },
    notes: {
      title: "नोट्स",
      sub: "कौन नोट लिख रहा है, और उनमें से कितनों का रिमाइंडर भी बना।",
      statNotes: "नोट्स",
      statWithReminder: "रिमाइंडर वाले",
      statUsers: "लोग",
      statLast7: "पिछले 7 दिन",
      ofTotal: "सभी नोट्स का {pct}%",
      perUser: "व्यक्ति के हिसाब से",
      colUser: "व्यक्ति",
      colNotes: "नोट्स",
      colWithReminder: "रिमाइंडर वाले",
      colLast: "आख़िरी गतिविधि",
      users: "लोग",
      empty: "अभी तक किसी ने नोट नहीं लिखा।",
      privacyNote:
        "जो सवाल सबसे ज़्यादा मायने रखता है — फ़ीचर इस्तेमाल हो रहा है या नहीं, और नोट से रिमाइंडर बनता है या नहीं — उसका जवाब गिनती और समय से मिल जाता है। पूरा मतन Content में है।",
      migrationMissing:
        "पहले Supabase SQL editor में supabase/notes.sql और supabase/notes-reminder-link.sql चलाइए।",
      tabStats: "गिनती",
      tabContent: "मतन",
      searchPh: "नोट्स के अंदर खोजें…",
      foundN: "{n} नोट्स",
      noMatch: "कुछ नहीं मिला।",
      allUsers: "सब लोग",
      viewNotes: "पढ़ें",
      pinned: "पिन",
      hasReminder: "रिमाइंडर लगा है",
      untitled: "(बिना टाइटल)",
      created: "लिखा",
      edited: "बदला",
      contentMigrationMissing: "पहले Supabase SQL editor में supabase/notes-admin-content.sql चलाइए।",
      contentWarn:
        "यह लोगों का लिखा हुआ है, हूबहू। नोट में बाज़ार की लिस्ट, आइडिया, फ़ोन नंबर, कभी पैसों का हिसाब होता है — यह सब इस भरोसे पर लिखा गया था कि यह उनका अपना है। सिर्फ़ उतना पढ़िए जितना सामने के काम के लिए सच में ज़रूरी है, और यह पक्का कीजिए कि प्राइवेसी पॉलिसी में यह बात लिखी हो।",
      loadMore: "और लाएँ",
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
    renewals: {
      title: "रिन्यू कैसे करें",
      sub: "डॉक्युमेंट एक्सपायर हो रहा हो तो यूज़र को क्या करना चाहिए। ऐप में दिखता है, ऑफ़लाइन भी चलता है।",
      docType: "डॉक्युमेंट टाइप",
      newType: "…या नया टाइप",
      newTypePh: "जैसे visa",
      docTypeNeeded: "डॉक्युमेंट टाइप चुनिए या नया लिखिए।",
      country: "देश (ISO2)",
      allCountries: "सभी देश",
      add: "जोड़ें",
      countryFormat: "देश का कोड 2 अक्षर का होना चाहिए, जैसे US या AE।",
      alreadyExists: "इस डॉक्युमेंट टाइप की गाइड उस देश के लिए पहले से है।",
      missingGlobal:
        "इनके लिए सभी-देश वाला फ़ॉलबैक नहीं है: {types}। नीचे दिए देशों के बाहर के यूज़र्स को इन टाइप पर कुछ नहीं दिखेगा।",
      url: "आधिकारिक लिंक",
      urlPlaceholder: "https://…",
      urlHint:
        "जहाँ कोई एक आधिकारिक पोर्टल नहीं है वहाँ ख़ाली छोड़ें — तब स्टेप्स ही पूरा जवाब हैं।",
      authority: "कौन करता है",
      guideTitle: "शीर्षक",
      steps: "स्टेप्स",
      addStep: "स्टेप जोड़ें",
      note: "नोट (वह एक बात जिसमें लोग चूकते हैं)",
      autoTranslate: "सेव करते ही बाक़ी भाषाओं में अनुवाद करें",
      unreviewed: "अनजाँची",
      deleteAsk: "इस देश की गाइड हटा दें?",
      tabGuides: "गाइड्स",
      tabMaster: "मास्टर",
      masterSub:
        "गाइड का ढाँचा। यहाँ जो खाने बनाएँगे वही हर गाइड में भरने को मिलेंगे — और ऐप उन्हें इसी क्रम में दिखाएगा।",
      fields: "खाने (Fields)",
      fieldsSub: "गाइड किन खानों से बनी है। यहाँ का क्रम ही ऐप का क्रम है।",
      tags: "टैग",
      tagsSub: "गाइड पर लगाने के लेबल। बाद में ढूँढने में काम आते हैं।",
      languages: "भाषाएँ",
      languagesSub: "गाइड किन भाषाओं में लिखी जा सकती है।",
      languagesWarn:
        "यह सिर्फ़ रिन्यूअल कंटेंट की भाषा है — ऐप के अपने मेन्यू और बटन की नहीं। यहाँ भाषा जोड़ने से आप उसमें गाइड लिख सकेंगे; ऐप का इंटरफ़ेस अपनी ही भाषाओं में रहेगा। ऐप उसी भाषा का कंटेंट उठाती है जिसका कोड उसके अपने कोड से मिलता हो (hinglish, hi, en)।",
      keyLabel: "Key",
      keyHint: "सिर्फ़ a-z, 0-9 और _ । बाद में बदली नहीं जा सकती।",
      keyLocked:
        "सेव किया हुआ कंटेंट इसी key के नीचे रखा जाता है — इसे बदलते ही इस खाने में लिखा सब कुछ अनाथ हो जाएगा।",
      labelLabel: "नाम",
      nativeLabel: "अपनी ही भाषा में",
      kindLabel: "किस्म",
      kindText: "टेक्स्ट — एक लाइन",
      kindLongtext: "पैराग्राफ़",
      kindList: "सूची — गिनती वाले स्टेप्स",
      kindLink: "लिंक — बटन बन जाता है",
      kindNote: "नोट — हाइलाइट बॉक्स",
      sortLabel: "क्रम",
      requiredLabel: "ज़रूरी",
      iconLabel: "आइकॉन",
      iconHint: "Ionicons का नाम, जैसे bulb-outline। न चाहिए तो खाली छोड़ दें।",
      hintLabel: "मदद की लाइन",
      colorLabel: "रंग",
      enabledLabel: "चालू",
      disabledBadge: "बंद",
      lockedBadge: "लॉक",
      lockedHint: "ऐप का रिन्यूअल कार्ड इसी पर टिका है — बंद कर सकते हैं, हटा नहीं सकते।",
      addField: "खाना जोड़ें",
      addTag: "टैग जोड़ें",
      addLanguage: "भाषा जोड़ें",
      noFields: "अभी कोई खाना नहीं। एक जोड़कर शुरू करें — बिना खानों की गाइड में दिखाने को कुछ नहीं होता।",
      noTags: "अभी कोई टैग नहीं।",
      noLanguages: "अभी कोई भाषा नहीं। गाइड लिखने से पहले कम से कम एक जोड़ें।",
      deleteFieldAsk:
        "यह खाना हटा दें? इसमें लिखा हुआ डेटाबेस में रहेगा पर दिखना बंद हो जाएगा — खाना दोबारा बनाते ही वापस आ जाएगा।",
      deleteTagAsk: "यह टैग हटा दें?",
      deleteLangAsk: "यह भाषा हटा दें? इसमें लिखी गाइड्स दिखनी बंद हो जाएँगी।",
      fieldInUse: "{n} गाइड्स में भरा है",
      migrationMissing: "पहले supabase/renewal-master.sql चलाएँ।",
      entryTags: "टैग",
      noGuides: "अभी कोई गाइड नहीं। ऊपर से एक जोड़ें।",
      needMaster:
        "पहले मास्टर में कम से कम एक खाना और एक भाषा जोड़ें — उनके बिना भरने को कुछ नहीं होता।",
    },
    deleteRequests: {
      title: "डिलीट रिक्वेस्ट",
      sub: "जिन्होंने अकाउंट डिलीट करने को कहा — और उनका वह सब कुछ जो हटेगा।",
      empty: "अभी कोई डिलीट रिक्वेस्ट नहीं है।",
      status: { pending: "बाक़ी", hidden: "छुपाया", deleted: "डिलीट", rejected: "मना किया" },
      reason: "उन्होंने जो वजह लिखी",
      willDelete: "क्या-क्या डिलीट होगा",
      removedTitle: "क्या-क्या डिलीट हुआ",
      files: "डॉक्युमेंट फ़ाइलें",
      nothingLeft: "डिलीट करने को कुछ नहीं बचा।",
      noAccount: "अकाउंट नहीं",
      noAccountHelp:
        "इस ईमेल से कोई अकाउंट नहीं मिला, इसलिए डिलीट करने को कुछ नहीं है। हो सकता है उन्होंने कोई और ईमेल इस्तेमाल किया हो — मना करने से पहले उनसे पूछ लें।",
      hide: "यूज़र से छुपाएँ",
      unhide: "वापस चालू करें",
      purge: "सब कुछ डिलीट करें",
      reject: "मना करें",
      hideConfirm:
        "यह अकाउंट छुपा दें? इनका डेटा डेटाबेस में रहेगा और आप इसे वापस चालू कर सकते हैं।",
      purgeConfirm:
        "यह वापस नहीं होगा। हमेशा के लिए सब कुछ डिलीट करने की पुष्टि के लिए ईमेल लिखें:\n\n{email}",
      hideVsDelete:
        "पहले छुपाएँ, डिलीट बाद में। छुपाने से अकाउंट ऐप में बंद हो जाता है पर सब कुछ बचा रहता है — वे वापस आएँ या पेमेंट का सवाल उठे तो आप बहाल कर सकते हैं। डिलीट करने पर फ़ाइलें, हर रो और लॉगिन तक मिट जाता है — वापस लाने का कोई रास्ता नहीं।",
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
      monthly: "मासिक", yearly: "सालाना",
      country: "देश", currency: "करेंसी",
      play: {
        title: "Google Play — लाइव प्राइस",
        sub: "ये Play Console के असली दाम हैं — वही जो ऐप में कटते हैं। दाम बदलना हो तो वहीं बदलिए और sync कीजिए। यह टेबल जान-बूझकर सिर्फ़ पढ़ने के लिए है।",
        syncNow: "अभी sync करें",
        syncing: "sync हो रहा है…",
        lastSync: "आख़िरी sync",
        never: "कभी नहीं",
        regions: "देश",
        offTitle: "Play प्राइस sync बंद है",
        offBody: "जब तक यह सेट नहीं होता, वेबसाइट डिफ़ॉल्ट ₹99 / ₹999 दिखाएगी। सेटअप: docs/play-prices.md",
        openConsole: "Play Console खोलें",
        staleWarn: "आख़िरी कामयाब sync 3 दिन से ज़्यादा पुराना है — नीचे के दाम पुराने हो सकते हैं।",
        note: "नोट: यह सिर्फ़ दिखाने का दाम है। पैसा Google Play यूज़र के अकाउंट वाले देश से काटता है — VPN से दिखने वाला दाम बदल सकता है, कटने वाला नहीं। दाम बदलना हो तो Play Console में बदलिए, फिर यहाँ Sync now दबाइए।",
        justNow: "अभी",
        minsAgo: "{n} मिनट पहले",
        hoursAgo: "{n} घंटे पहले",
        daysAgo: "{n} दिन पहले",
      },
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
    emailPh: "Email (master ke liye khaali chhodo)",
    masterHint: "Master admin: email khaali chhodo aur .env wala password daalo.",
    pending: "Aapka account abhi approve nahi hua — master admin se kahiye.",
    disabled: "Ye account band kar diya gaya hai.",
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
    payments: "Payments",
    notes: "Notes",
    documents: "Documents",
    devices: "Devices",
    reviews: "Reviews",
    logs: "Logs",
    contacts: "Contacts",
    pricing: "Pricing",
    rewards: "Rewards",
    renewals: "Renew guides",
    deleteRequests: "Delete requests",
    team: "Admin team",
  },
  headings: {
    support: { title: "Support", sub: "App se aaye sawaal — poori baatcheet padhiye aur jawab dijiye. Jawab app, email aur notification teeno jagah pahunchta hai." },
    seo: { title: "SEO", sub: "Har page ka title, description aur keywords. Yahan save karte hi live site par lag jaata hai — deploy nahi karna padta." },
    blog: { title: "Blog", sub: "Post likho aur badlo. Published post turant website aur sitemap dono me aa jaati hai." },
    renewals: { title: "Renew kaise karein", sub: "Document expire hone par logon ko asal me kya karna chahiye. Har desh ko jawab milta hai — sab-desh wali guide fallback hai." },
    deleteRequests: { title: "Delete requests", sub: "Jo log account delete karwana chahte hain. Unka sab kuch dekho, phir chhupao ya hamesha ke liye hatao." },
    analytics: { title: "Analytics", sub: "Log website aur app me kahan jaate hain — aur ek user ne asal me kya kiya." },
    rewards: { title: "Rewards & Referrals", sub: "Offer aur referral ke numbers yahin se badlo — turant live ho jaate hain." },
    pricing: { title: "Pricing", sub: "Daam Google Play Console se aate hain — set wahin karo, yahan sync karo. IP se user ko uske desh ka price dikhta hai." },
    users: { title: "Users", sub: "Kaun kis plan pe hai, kab juda, aur kab tak active hai." },
    usage: { title: "Usage", sub: "Kaun kitna use karta hai — documents, reminders, chats. Aur kaun bilkul nahi." },
    spend: { title: "AI & WhatsApp", sub: "Humara kitna istemaal ho raha hai — Gemini token, WhatsApp message aur email." },
    payments: { title: "Payments", sub: "Har Play Store kharidari, renewal aur refund — kisne, kab, kitna diya." },
    notes: { title: "Notes", sub: "Kaun note likhta hai, aur unme se kitno ka reminder banta hai. Log kya likhte hain wo kabhi nahi dikhta." },
    documents: { title: "Documents", sub: "Kisne kaun sa document, kab upload kiya — path ke saath. View pe click karke dekho." },
    devices: { title: "Devices", sub: "Kaun sa user kaun se phone se chal raha hai. Ek waqt me ek hi phone active rehta hai — reminder aur alert usi par jaate hain. Jiske email par code na pahunche, uska phone yahan se chaalu karo." },
    reviews: { title: "Reviews & Ratings", sub: "App me aaye reviews. Website par review tabhi jaata hai jab user ne anumati di ho AUR aap manzoori dein — apne aap kuch live nahi hota." },
    logs: { title: "Logs & Issues", sub: "App/web me kya toota — poora stack + context. Naye errors email pe bhi jaate hain." },
    // ⚠️ `sub` jaan-boojh ke khaali hai — AdminDashboard is EK section par
    // subtitle ki jagah "{n} messages" wali live ginti dikhata hai
    // (`t.contacts.countMsg`). Ise bharne par wo ginti dab jaayegi.
    contacts: { title: "Contact messages", sub: "" },
    team: { title: "Admin team", sub: "Role banao, tay karo kis role ko kaun se menu dikhein, aur logon ko jodo. Naya member tumhare approve karne tak pending rehta hai." },
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
    translateTitle: "Har user ki apni bhasha me bhejo",
    translateHint:
      "Ek hi baar, kisi bhi bhasha me likho. Bhejne se pehle subject aur message usi bhasha me badal jaate hain jo user ne app me chuni hai — Hinglish, Hindi ya English.",
    translateOff:
      "Anuvaad band hai — web env me GEMINI_API_KEY set nahi hai. Sabko wahi jayega jo tum likhoge.",
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
    otpTitle: "SMS OTP limit",
    otpCount: "Is ghante {hour}/{perHour} · aaj {day}/{perDay}",
    otpBlocked: "Block — naya code nahi maang sakte",
    otpFine: "Limit ke andar",
    otpReset: "Limit reset karo",
    otpResetting: "Reset ho raha hai…",
    otpResetDone: "Limit reset ho gayi ({n} bheje hue hataye). Ab dobara koshish kar sakte hain.",
    otpResetFailed: "Limit reset nahi ho payi.",
  },
  contacts: {
    countMsg: "{n} message",
    empty: "Abhi koi message nahi.",
    searchPh: "Message khojo…",
    reply: "Reply",
    replyTitle: "{name} ko jawab",
    replyPh: "Apna jawab likho…",
    original: "Unka message",
    send: "Jawab bhejo",
    sending: "Bhej rahe hain…",
    sent: "Jawab bhej diya ✅",
    failed: "Jawab nahi ja saka.",
    repliedTag: "Jawab diya",
    repliedBy: "{who} ne jawab diya · {when}",
    seeReply: "Jawab dekho",
    onlyPending: "Jinka jawab baaki hai",
    all: "Sab",
  },
  team: {
    rolesTitle: "Roles",
    rolesSub: "Role tay karta hai ki uske member ko sidebar me kaun se menu dikhenge.",
    membersTitle: "Members",
    membersSub: "Wo sab jo is panel me login kar sakte hain.",
    newRole: "Naya role",
    editRole: "Role badlo",
    roleName: "Role ka naam",
    roleNamePh: "jaise Support Staff",
    menusLabel: "Is role ko kaun se menu khulenge",
    menusHint: "Bina tick wale menu sidebar me nahi dikhte, aur unka API bhi band rehta hai.",
    noRoles: "Abhi koi role nahi.",
    memberCount: "{n} member",
    deleteRoleConfirm: "Role “{name}” hata dein? Uske member bane rahenge, par naya role dene tak unhe koi menu nahi milega.",
    invite: "Member jodo",
    inviteTitle: "Naya member jodo",
    nameLabel: "Naam",
    namePh: "jaise Riya Sharma",
    emailLabel: "Email",
    emailPh: "name@gmail.com",
    roleLabel: "Role",
    noRole: "Koi role nahi (koi menu nahi)",
    inviteBtn: "Invite bhejo",
    inviting: "Bhej rahe hain…",
    inviteSent: "Login ki jaankari {email} par bhej di ✅",
    inviteNoMail: "Member jud gaya, par email nahi ja saka. Ye password khud bhej dijiye:",
    passwordIs: "Password: {password}",
    copy: "Copy",
    copied: "Copy ho gaya ✅",
    statusPending: "Pending",
    statusActive: "Chalu",
    statusDisabled: "Band",
    approve: "Approve karo",
    disable: "Band karo",
    enable: "Chalu karo",
    newPassword: "Naya password",
    newPasswordSent: "Naya password email kar diya ✅",
    remove: "Hatao",
    removeConfirm: "{email} ko admin team se hata dein?",
    overrideTitle: "Sirf is bande ke liye",
    overrideHint: "Role ke upar. Rok hamesha bhaari padti hai, chahe role me wo menu ho.",
    extraLabel: "Ye bhi do",
    deniedLabel: "Ye kabhi nahi",
    effective: "Milta hai",
    lastLogin: "Pichhla login",
    never: "Kabhi nahi",
    addedBy: "Joda",
    noMembers: "Abhi koi nahi joda gaya.",
    masterOnly: "Team sirf master admin badal sakta hai.",
    emailOff: "⚠️ Email set nahi hai (SMTP env) — invite nahi jayenge.",
    saved: "Save ho gaya ✅",
    failed: "Save nahi hua.",
    you: "aap",
    master: "Master",
    masterNote: "Master admin .env wale password se login karta hai aur use hamesha saare menu dikhte hain.",
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
      otpTitle: "SMS OTP ki haddein",
      otpSub: "Har OTP ek paid SMS hai. Inhe badhane me paisa lagta hai — pehle Spend dekh lo. Koi sahi user phans jaye to uski limit uske support ticket se alag se reset kar do.",
      otpCooldown: "Do SMS ke beech ka gap (second)",
      otpTtl: "Code kitni der chale (second)",
      otpPerHour: "Ek ghante me max SMS (per user)",
      otpPerDay: "Ek din me max SMS (per user)",
      otpIpPerDay: "Ek IP se ek din me kitne alag number",
      otpMaxAttempts: "Kitni galat koshish ke baad code marr jaye",
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
      liveOnSite: "Site par live", pendingCount: "Aapke intezaar me",
      filterPending: "Baaki", filterApproved: "Manzoor", filterRejected: "Namanzoor",
      badgePending: "Manzoori ka intezaar",
      badgeApproved: "Website par live",
      badgeRejected: "Namanzoor",
      approveBtn: "Manzoor karo", rejectBtn: "Namanzoor karo", undoBtn: "Wapas baaki me daalo",
      statusFailed: "Badal nahi paya",
      noPermissionNote: "User ne website par dikhane ki anumati nahi di — ye kabhi live nahi ja sakta.",
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
      delivery: "Reminder delivery", deliveryLang: "Message ki bhasha",
      willSend: "Jayega", wontSend: "Nahi jayega",
      deliveryOk: "Koi rok nahi — ab dekho ki cron chal raha hai ya nahi.",
      deliveryUnknown: "Delivery jaanchi nahi ja saki.",
      waWrongLang: "Is bhasha ka template nahi — WhatsApp Hinglish me pahunchega.",
      blockerNotPlus: "Plus nahi hai — email aur WhatsApp sirf Plus me.",
      blockerNoEmail: "Profile me email nahi hai.",
      blockerNoPhone: "Number daala hi nahi gaya.",
      blockerPhoneUnverified: "Number hai par verify nahi hua — uspar kuch nahi jaata.",
      blockerSmtpOff: "Server par SMTP set nahi hai.",
      blockerTwilioOff: "Server par Twilio set nahi hai.",
      blockerWaTemplate: "Koi approved WhatsApp template nahi — Meta message reject karta hai.",
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
    payments: {
      today: "Aaj", days7: "7 din", days30: "30 din", days90: "90 din", all: "Sab",
      revenue: "Kamai", payers: "Paise dene wale", events: "Events",
      refunds: "Refund", trials: "Trial", sandbox: "Test purchase",
      when: "Kab", user: "User", event: "Event", product: "Plan",
      amount: "Rakam", status: "Status", txn: "Transaction", till: "Kab tak",
      rows: "payments",
      none: "Is range me abhi koi payment nahi.",
      offTitle: "Play Billing band hai",
      offBody:
        "App me kharidari ho sakti hai, par webhook hum tak aayega hi nahi — yaani yahan kuch record nahi hoga. Wajah: {status}. Play Console par live hote hi PLAY_BILLING_ENABLED=1 aur REVENUECAT_WEBHOOK_SECRET set karo.",
      testTag: "test",
    },
    notes: {
      title: "Notes",
      sub: "Kaun note likh raha hai, aur unme se kitno ka reminder bhi bana.",
      statNotes: "Notes",
      statWithReminder: "Reminder wale",
      statUsers: "Log",
      statLast7: "Pichhle 7 din",
      ofTotal: "saare notes ka {pct}%",
      perUser: "Har banda alag se",
      colUser: "Banda",
      colNotes: "Notes",
      colWithReminder: "Reminder wale",
      colLast: "Aakhri kaam",
      users: "log",
      empty: "Abhi tak kisi ne note nahi likha.",
      privacyNote:
        "Jo sawaal sabse zyada matlab rakhta hai — feature chal raha hai ya nahi, aur note se reminder banta hai ya nahi — uska jawab ginti aur waqt se mil jaata hai. Poora matn Content me hai.",
      migrationMissing:
        "Pehle Supabase SQL editor me supabase/notes.sql aur supabase/notes-reminder-link.sql chalao.",
      tabStats: "Ginti",
      tabContent: "Matn",
      searchPh: "Notes ke andar dhoondho…",
      foundN: "{n} notes",
      noMatch: "Kuch nahi mila.",
      allUsers: "Sab log",
      viewNotes: "Padho",
      pinned: "pin",
      hasReminder: "reminder laga hai",
      untitled: "(bina title)",
      created: "likha",
      edited: "badla",
      contentMigrationMissing: "Pehle Supabase SQL editor me supabase/notes-admin-content.sql chalao.",
      contentWarn:
        "Ye logon ka likha hua hai, hu-ba-hu. Note me bazaar ki list, idea, phone number, kabhi paise ka hisaab hota hai — ye sab is bharose par likha gaya tha ki ye unka apna hai. Sirf utna padho jitna saamne ke kaam ke liye sach me zaroori hai, aur ye pakka karo ki privacy policy me ye baat likhi ho.",
      loadMore: "Aur laao",
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
    renewals: {
      title: "Renew kaise karein",
      sub: "Document expire ho raha ho to user ko kya karna chahiye. App me dikhta hai, offline bhi chalta hai.",
      docType: "Document type",
      newType: "…ya naya type",
      newTypePh: "jaise visa",
      docTypeNeeded: "Document type chuno ya naya likho.",
      country: "Desh (ISO2)",
      allCountries: "Sab desh",
      add: "Jodo",
      countryFormat: "Desh ka code 2 akshar ka hona chahiye, jaise US ya AE.",
      alreadyExists: "Is document type ki guide us desh ke liye pehle se hai.",
      missingGlobal:
        "Inke liye sab-desh wala fallback nahi hai: {types}. Neeche diye deshon ke bahar wale users ko in types par kuch nahi dikhega.",
      url: "Official link",
      urlPlaceholder: "https://…",
      urlHint:
        "Jahan koi ek official portal nahi hai wahan khaali chhodo — tab steps hi poora jawab hain.",
      authority: "Kaun karta hai",
      guideTitle: "Heading",
      steps: "Steps",
      addStep: "Step jodo",
      note: "Note (wo ek baat jisme log chookte hain)",
      autoTranslate: "Save karte hi baaki bhashaon me anuvaad karo",
      unreviewed: "bin-jaanchi",
      deleteAsk: "Is desh ki guide hata dein?",
      tabGuides: "Guides",
      tabMaster: "Master",
      masterSub:
        "Guide ka dhaancha. Yahan jo khaane banayenge wahi har guide me bharne ko milenge — aur app unhe isi tarteeb me dikhayegi.",
      fields: "Khaane (Fields)",
      fieldsSub: "Guide kin khaanon se banti hai. Yahan ka kram hi app ka kram hai.",
      tags: "Tags",
      tagsSub: "Guide par lagane ke label. Baad me dhoondhne me kaam aate hain.",
      languages: "Bhashayein",
      languagesSub: "Guide kin bhashaon me likhi ja sakti hai.",
      languagesWarn:
        "Ye sirf renewal content ki bhasha hai — app ke apne menu aur button ki nahi. Yahan bhasha jodne se aap usme guide likh sakenge; app ka interface apni hi bhashaon me rahega. App usi bhasha ka content uthati hai jiska code uske apne code se milta ho (hinglish, hi, en).",
      keyLabel: "Key",
      keyHint: "Sirf a-z, 0-9 aur _ . Baad me badli nahi ja sakti.",
      keyLocked:
        "Save kiya hua content isi key ke neeche rakha jaata hai — ise badalte hi is khaane me likha sab kuch anaath ho jayega.",
      labelLabel: "Naam",
      nativeLabel: "Apni hi bhasha me",
      kindLabel: "Kism",
      kindText: "Text — ek line",
      kindLongtext: "Paragraph",
      kindList: "Soochi — ginti wale steps",
      kindLink: "Link — button ban jaata hai",
      kindNote: "Note — highlight box",
      sortLabel: "Kram",
      requiredLabel: "Zaroori",
      iconLabel: "Icon",
      iconHint: "Ionicons ka naam, jaise bulb-outline. Na chahiye to khaali chhod dein.",
      hintLabel: "Madad ki line",
      colorLabel: "Rang",
      enabledLabel: "Chalu",
      disabledBadge: "band",
      lockedBadge: "lock",
      lockedHint: "App ka renewal card isi par tika hai — band kar sakte hain, hata nahi sakte.",
      addField: "Khaana jodein",
      addTag: "Tag jodein",
      addLanguage: "Bhasha jodein",
      noFields: "Abhi koi khaana nahi. Ek jod ke shuru karein — bina khaanon ki guide me dikhane ko kuch nahi hota.",
      noTags: "Abhi koi tag nahi.",
      noLanguages: "Abhi koi bhasha nahi. Guide likhne se pehle kam se kam ek jodein.",
      deleteFieldAsk:
        "Ye khaana hata dein? Isme likha hua database me rahega par dikhna band ho jayega — khaana dobara banate hi wapas aa jayega.",
      deleteTagAsk: "Ye tag hata dein?",
      deleteLangAsk: "Ye bhasha hata dein? Isme likhi guides dikhni band ho jayengi.",
      fieldInUse: "{n} guides me bhara hai",
      migrationMissing: "Pehle supabase/renewal-master.sql chalayein.",
      entryTags: "Tags",
      noGuides: "Abhi koi guide nahi. Upar se ek jodein.",
      needMaster:
        "Pehle Master me kam se kam ek khaana aur ek bhasha jodein — unke bina bharne ko kuch nahi hota.",
    },
    deleteRequests: {
      title: "Delete requests",
      sub: "Jinhone account delete karne ko kaha — aur unka wo sab kuch jo hatega.",
      empty: "Abhi koi delete request nahi hai.",
      status: { pending: "baaki", hidden: "chhupaya", deleted: "delete", rejected: "mana kiya" },
      reason: "Unhone jo wajah likhi",
      willDelete: "Kya-kya delete hoga",
      removedTitle: "Kya-kya delete hua",
      files: "Document files",
      nothingLeft: "Delete karne ko kuch nahi bacha.",
      noAccount: "account nahi",
      noAccountHelp:
        "Is email se koi account nahi mila, isliye delete karne ko kuch nahi hai. Ho sakta hai unhone koi aur email use kiya ho — mana karne se pehle unse pooch lo.",
      hide: "User se chhupao",
      unhide: "Wapas chalu karo",
      purge: "Sab kuch delete karo",
      reject: "Mana karo",
      hideConfirm:
        "Ye account chhupa dein? Inka data database me rahega aur aap ise wapas chalu kar sakte ho.",
      purgeConfirm:
        "Ye wapas nahi hoga. Hamesha ke liye sab kuch delete karne ki pushti ke liye email likho:\n\n{email}",
      hideVsDelete:
        "Pehle chhupao, delete baad me. Chhupane se account app me band ho jaata hai par sab kuch bacha rehta hai — wo wapas aayein ya payment ka sawaal uthe to aap bahal kar sakte ho. Delete karne par files, har row aur login tak mit jaata hai — wapas laane ka koi raasta nahi.",
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
      monthly: "Monthly", yearly: "Yearly",
      country: "Country", currency: "Currency",
      play: {
        title: "Google Play — live price",
        sub: "Ye Play Console ke ASLI daam hain — wahi jo app me kate jaate hain. Daam badalna ho to wahin badlo aur sync karo. Ye table jaan-boojh ke sirf padhne ke liye hai.",
        syncNow: "Sync now",
        syncing: "Sync ho raha hai…",
        lastSync: "Aakhri sync",
        never: "kabhi nahi",
        regions: "desh",
        offTitle: "Play price sync band hai",
        offBody: "Jab tak ye set nahi hota, website default ₹99 / ₹999 dikhati hai. Setup: docs/play-prices.md",
        openConsole: "Play Console kholo",
        staleWarn: "Aakhri kaamyab sync 3 din se zyada purana hai — neeche ke daam purane ho sakte hain.",
        note: "Note: ye sirf dikhane ka daam hai. Paisa Google Play user ke account wale desh se kaatta hai — VPN se dikhne wala daam badal sakta hai, katne wala nahi. Daam badalna ho to Play Console me badlo, phir yahan Sync now dabao.",
        justNow: "abhi",
        minsAgo: "{n} min pehle",
        hoursAgo: "{n} ghante pehle",
        daysAgo: "{n} din pehle",
      },
    },
  },
};

/**
 * Export isliye ki iski JAANCH ho sake.
 *
 * Teen bhashaon ki dictionary me sabse aam bug ek hi hota hai: kisi ek bhasha me
 * key jodna bhool jaana. Type system usse pakad leta hai, par khaali string
 * ("") ya sirf ek bhasha me maujood nested block usse nikal jaate hain. Bina
 * export ke koi script in teenon ko aamne-saamne rakh hi nahi sakti.
 */
export const ADMIN: Record<Locale, AdminDict> = { hinglish, hi, en };

export function useAdminT(): AdminDict {
  const { locale } = useLanguage();
  return ADMIN[locale] ?? ADMIN.hinglish;
}

/** {key} placeholders bharo. */
export function atpl(s: string, vars: Record<string, string | number>): string {
  return s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}
