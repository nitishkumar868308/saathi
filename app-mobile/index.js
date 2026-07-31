/**
 * App ka entry point.
 *
 * ⚠️ Pehle `package.json` ka `main` seedha `expo-router/entry` tha. Wo ek soorat
 * me toot jaata tha, aur wahi sabse zyada shikayat wali soorat hai:
 *
 * App ko recents se hata do (bilkul band), aur reminder ka waqt aa jaye. Notifee
 * ka Android side event ko ek **headless JS task** ki tarah chalata hai — wo JS
 * bundle boot karke `onBackgroundEvent` wala handler dhoondhta hai. Handler
 * `lib/notifications.ts` me lagta tha, jise sirf `app/_layout.tsx` import karta
 * hai — aur expo-router route files ko lazy load karta hai. Headless task me
 * koi component render hota hi nahi, isliye `_layout.tsx` kabhi evaluate nahi
 * hota tha aur handler kabhi lagta hi nahi tha.
 *
 * Natija: alarm bajta tha, screen jaagti thi, app khul bhi jaati thi — par
 * reminder ka bada full-screen alert kabhi nahi aata tha.
 *
 * Isliye handler ab yahan, router se PEHLE. Is line ka kram maayne rakhta hai;
 * ise neeche mat karna.
 */
import "./src/lib/notification-background";

import "expo-router/entry";
