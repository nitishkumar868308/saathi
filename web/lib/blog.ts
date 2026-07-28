/**
 * Blog posts — abhi seedha is file me (koi CMS nahi).
 *
 * Kyun file me: posts abhi ginti ke hain, aur file me rakhne se poora blog
 * build-time par static HTML ban jaata hai. Google ko turant padhne layak
 * content milta hai aur page bina kisi database call ke khulta hai.
 *
 * Naya post likhne ka tarika: neeche array me ek object add kar do. Route,
 * sitemap, JSON-LD aur "related posts" sab apne aap ban jaate hain.
 *
 * Likhte waqt:
 *   - `slug` me wahi shabd jo log search karte hain ("passport-renewal-reminder")
 *   - `title` 60 characters ke andar, `description` ~155
 *   - `updated` tabhi badlo jab content sach me badla ho (Google dekhta hai)
 */

export type BlogSection = { h: string; p: string[] };

export type BlogPost = {
  slug: string;
  title: string;
  /** Meta description — search result me yahi line dikhti hai. */
  description: string;
  /** Page ke andar ka bada heading (title se thoda lamba ho sakta hai). */
  heading: string;
  /** Pehla paragraph — intro. */
  intro: string;
  published: string; // YYYY-MM-DD
  updated: string; // YYYY-MM-DD
  tags: string[];
  readingMinutes: number;
  sections: BlogSection[];
};

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "document-expiry-reminder-app",
    title: "Never Miss a Document Expiry Date Again",
    description:
      "Passport, driving licence, insurance, FASTag — every document expires quietly. Here is a simple system to track expiry dates and get reminded in time.",
    heading: "Never miss a document expiry date again",
    intro:
      "Documents do not warn you before they expire. You find out at the airport counter, at the RTO, or when a claim gets rejected. The fix is not a better memory — it is a system that remembers for you.",
    published: "2026-06-02",
    updated: "2026-07-20",
    tags: ["Documents", "Reminders"],
    readingMinutes: 5,
    sections: [
      {
        h: "Why expiry dates are so easy to miss",
        p: [
          "Every important document has a date printed on it, and then it goes into a drawer. Nothing pings you. Nothing shows up on your phone. The date sits quietly for four years and then becomes urgent overnight.",
          "Most people try to solve this with a calendar entry. That works until you switch phones, or until the entry gets buried under forty other events, or until you snooze it once and never see it again.",
        ],
      },
      {
        h: "The three documents people forget most",
        p: [
          "Passport. Many countries require six months of validity beyond your travel date, so a passport that looks valid can still stop you at immigration.",
          "Vehicle insurance and FASTag. A lapsed policy is not just a fine — it means an accident is paid out of your own pocket.",
          "Driving licence. Renewal is cheap and quick before expiry, and a long, expensive process after it.",
        ],
      },
      {
        h: "A system that actually works",
        p: [
          "Keep one place for every document instead of a drawer, an email folder and a photo gallery. One place means one thing to check.",
          "Store the expiry date with the document, not in your head. A date attached to the thing it belongs to never gets orphaned.",
          "Get reminded more than once. A single alert on the expiry day is too late — renewals take time. Two weeks before, three days before, and on the day itself is a reasonable ladder.",
        ],
      },
      {
        h: "How Apka Saathi handles it",
        p: [
          "Add a photo of the document and Saathi reads the expiry date from it. You do not type anything.",
          "It then sets three reminders on its own — fourteen days before, three days before, and on the day. You get a notification on your phone, and on Saathi Plus an email and WhatsApp message too.",
          "Everything stays in your account. Change your phone and your documents and their dates come with you.",
        ],
      },
    ],
  },
  {
    slug: "passport-renewal-reminder",
    title: "When to Renew Your Passport (and How to Remember)",
    description:
      "Indian passports last 10 years, but you should renew about a year early. Here is why, and how to set a reminder you will actually see.",
    heading: "When to renew your passport — and how to remember",
    intro:
      "A passport that is technically valid can still be useless. Airlines and immigration desks look for months of remaining validity, not just a date that has not passed yet.",
    published: "2026-06-14",
    updated: "2026-07-20",
    tags: ["Passport", "Documents"],
    readingMinutes: 4,
    sections: [
      {
        h: "The six-month rule",
        p: [
          "Many countries require your passport to be valid for at least six months after the date you enter. Some require more. This is checked at the airline counter, before you even reach immigration.",
          "So a passport expiring in four months is, for travel purposes, already expired. Plan around remaining validity, not the printed date.",
        ],
      },
      {
        h: "When to actually start",
        p: [
          "Start the renewal roughly one year before the printed expiry date. That leaves room for appointment slots, police verification and postal delivery without any of it becoming urgent.",
          "If you travel often, keep an eye on blank pages too. Running out of pages forces a renewal regardless of the date.",
        ],
      },
      {
        h: "Setting a reminder you will actually see",
        p: [
          "A calendar entry a year out will be forgotten. What works is a reminder tied to the document itself, repeated as the date gets closer.",
          "In Apka Saathi you add a photo of the passport once. It picks up the expiry date and reminds you well before it matters — and again as the date approaches.",
        ],
      },
    ],
  },
  {
    slug: "aadhaar-update-reminder",
    title: "Aadhaar Updates: What to Track and When",
    description:
      "Aadhaar does not expire, but it does go stale. Here is what actually needs updating, when, and how to keep track without thinking about it.",
    heading: "Aadhaar updates: what to track and when",
    intro:
      "Aadhaar has no expiry date, which is exactly why it gets ignored. But an Aadhaar with an old address or an old phone number fails you at the worst possible moment.",
    published: "2026-06-24",
    updated: "2026-07-20",
    tags: ["Aadhaar", "Documents"],
    readingMinutes: 4,
    sections: [
      {
        h: "What goes stale",
        p: [
          "Mobile number. Most verification flows send an OTP to the number linked to Aadhaar. If that number is dead, so is the verification.",
          "Address. Bank KYC, gas connections and rental agreements all read the address from Aadhaar. An old address means paperwork gets rejected.",
          "Photograph and biometrics. Children's biometrics need updating as they grow, and adult photographs from many years ago can cause mismatches.",
        ],
      },
      {
        h: "A simple schedule",
        p: [
          "Review your Aadhaar details once a year. It takes two minutes and prevents a bad surprise.",
          "Update immediately after any move or any change of phone number — not later, when you need it.",
        ],
      },
      {
        h: "How to remember a yearly check",
        p: [
          "A yearly task is the hardest kind to remember, because nothing reminds you in between.",
          "Add Aadhaar to Apka Saathi with a yearly review reminder. Once a year it asks you a single question: is everything still current?",
        ],
      },
    ],
  },
  {
    slug: "medicine-reminder-app",
    title: "Medicine Reminders That Actually Work",
    description:
      "Missing a dose is rarely about forgetting the medicine — it is about forgetting the moment. Here is how to build a reminder routine that sticks.",
    heading: "Medicine reminders that actually work",
    intro:
      "Nobody forgets that they take a tablet. They forget whether they took it today. That is a different problem, and it needs a different fix.",
    published: "2026-07-01",
    updated: "2026-07-20",
    tags: ["Medicine", "Reminders", "Health"],
    readingMinutes: 5,
    sections: [
      {
        h: "Why alarms stop working",
        p: [
          "A plain alarm at 9 am becomes background noise within a week. You dismiss it while doing something else and lose track of whether you actually took the dose.",
          "The reminder needs to be specific enough that dismissing it without acting feels wrong. 'Medicine' is easy to ignore. 'Blood pressure tablet, after breakfast' is not.",
        ],
      },
      {
        h: "Tie doses to routine, not to clock time",
        p: [
          "'After breakfast' is easier to keep than '9:00 am', because breakfast happens whether or not you looked at your phone.",
          "Set the reminder for when the routine usually happens, and write the routine into the reminder text.",
        ],
      },
      {
        h: "Reminders for the people you look after",
        p: [
          "Many people manage medicines for a parent, not for themselves. A phone alarm on your own device is not much help there.",
          "Reminders that also arrive by WhatsApp or email are easier to forward, and easier for an older family member to act on.",
        ],
      },
      {
        h: "Setting one up in Apka Saathi",
        p: [
          "Open the app and speak or type it in plain language — 'remind me to take the BP tablet every morning at 8'. Saathi works out the time and sets the reminder.",
          "When the reminder fires it shows on the lock screen with the full text, so there is no guessing about which medicine it meant.",
        ],
      },
    ],
  },
  {
    slug: "bill-reminder-app",
    title: "Stop Paying Late Fees: A Bill Reminder System",
    description:
      "Electricity, rent, EMI, subscriptions — late fees are a tax on forgetting. Here is a simple way to never pay one again.",
    heading: "Stop paying late fees: a bill reminder system",
    intro:
      "Late fees are not an affordability problem. They are a timing problem. The money was there; the date slipped past.",
    published: "2026-07-08",
    updated: "2026-07-20",
    tags: ["Bills", "Reminders", "Money"],
    readingMinutes: 4,
    sections: [
      {
        h: "List every recurring payment once",
        p: [
          "Most people can name their big bills and forget the small ones. It is the annual domain renewal or the quarterly society maintenance that catches them out.",
          "Sit down once and write down every payment that repeats, with its due date. This is a thirty-minute job that pays for itself the first time it saves a late fee.",
        ],
      },
      {
        h: "Remind two days early, not on the day",
        p: [
          "A reminder on the due date leaves no room for a failed payment, a bank outage or a busy morning.",
          "Two days of buffer turns an emergency into an errand.",
        ],
      },
      {
        h: "Auto-pay is not a complete answer",
        p: [
          "Auto-pay still fails — cards expire, mandates lapse, balances fall short. And a silent failure is worse than a missed reminder, because nobody tells you.",
          "Keep the reminder even when auto-pay is on. It becomes a check, not a task.",
        ],
      },
      {
        h: "Doing it in Apka Saathi",
        p: [
          "Add each bill as a reminder with its due date. Saathi nudges you before the date, every cycle.",
          "On Saathi Plus the nudge also reaches you on WhatsApp and email, so it does not depend on you unlocking your phone at the right moment.",
        ],
      },
    ],
  },
  {
    slug: "best-reminder-app-india",
    title: "What Makes a Good Reminder App in India",
    description:
      "Most reminder apps are built for a calendar-first life. Here is what actually matters in India — and what to look for before you install one.",
    heading: "What makes a good reminder app in India",
    intro:
      "There is no shortage of reminder apps. There is a shortage of reminder apps that survive an Indian Android phone, an Indian language habit, and an Indian set of documents.",
    published: "2026-07-15",
    updated: "2026-07-20",
    tags: ["Reminders", "Apps"],
    readingMinutes: 6,
    sections: [
      {
        h: "It has to survive battery optimisation",
        p: [
          "Xiaomi, Realme, Oppo, Vivo and Samsung all kill background apps aggressively. A reminder app that does not ask for the right permissions will deliver your 8:36 reminder at 8:44, batched with something else.",
          "Look for an app that walks you through exact-alarm and battery settings during setup. If it never mentions them, its reminders will be late.",
        ],
      },
      {
        h: "It has to speak the way you do",
        p: [
          "Most people here think in a mix of Hindi and English. An app that only accepts formal English input adds friction to every single entry.",
          "Being able to say 'kal subah 8 baje paani ka bill' and have it understood is not a gimmick — it is the difference between using the app and abandoning it.",
        ],
      },
      {
        h: "It has to understand documents, not just tasks",
        p: [
          "A generic to-do app has no idea what a FASTag is or that a passport needs six months of validity. You end up doing the thinking and it just stores the result.",
          "An app that reads the expiry date off a document photo and schedules the reminders itself removes the part people actually get wrong.",
        ],
      },
      {
        h: "It should reach you outside the app",
        p: [
          "Notifications get swiped away. For anything that really matters, a second channel — email or WhatsApp — is what saves you.",
        ],
      },
      {
        h: "Where Apka Saathi fits",
        p: [
          "Saathi was built around exactly these four things: reliable delivery on Indian Android phones, Hinglish input, document understanding, and reminders that reach you on more than one channel.",
          "It is free to start, and works in Hindi, English or a mix of both.",
        ],
      },
    ],
  },
];

export function getPost(slug: string): BlogPost | undefined {
  return BLOG_POSTS.find((p) => p.slug === slug);
}

/** Newest first — index page aur sitemap dono isi order me. */
export function sortedPosts(): BlogPost[] {
  return [...BLOG_POSTS].sort((a, b) => b.published.localeCompare(a.published));
}

/** Ek tag milta ho aisi teen aur posts. */
export function relatedPosts(post: BlogPost, limit = 3): BlogPost[] {
  return sortedPosts()
    .filter((p) => p.slug !== post.slug && p.tags.some((t) => post.tags.includes(t)))
    .slice(0, limit);
}
