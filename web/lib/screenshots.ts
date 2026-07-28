/**
 * App screenshots — landing page ke "Inside the app" section ke liye.
 *
 * Play Store launch ke baad karna sirf itna hai:
 *   1. Screenshots `web/public/screenshots/` me daal do (PNG ya WebP,
 *      portrait, kam se kam 1080px chaudai — WebP chhota hota hai, wahi behtar).
 *   2. Neeche wali list me har file ka naam + ek line ka caption likh do.
 *
 * List khaali ho to poora section render hi nahi hota — adhoori ya placeholder
 * images kabhi live nahi jaati. Isliye ye code abhi bhi safe hai.
 *
 * `alt` sirf accessibility ke liye nahi hai — Google Images se traffic wahi se
 * aata hai. Har caption me batao ki screen kya kar rahi hai, "screenshot 1" mat
 * likho.
 */

export type Screenshot = {
  /** `public/screenshots/` ke andar ka file naam. */
  file: string;
  /** Image ke neeche dikhne wali line, aur alt text ka base. */
  caption: string;
  width: number;
  height: number;
};

export const SCREENSHOTS: Screenshot[] = [
  // Example (launch ke baad uncomment karke apni files bhar do):
  // { file: "home.webp",      caption: "Today's brief — what needs you today",      width: 1080, height: 2340 },
  // { file: "documents.webp", caption: "Documents with their expiry dates tracked", width: 1080, height: 2340 },
  // { file: "reminder.webp",  caption: "Set a reminder by typing or speaking",      width: 1080, height: 2340 },
  // { file: "chat.webp",      caption: "Ask Saathi in Hindi, English or a mix",     width: 1080, height: 2340 },
];

export const hasScreenshots = SCREENSHOTS.length > 0;

/** Play Store par app live hai? Env se — launch ke din bas ye flag on karna hai. */
export const PLAY_STORE_LIVE = process.env.NEXT_PUBLIC_PLAY_STORE_LIVE === "true";
