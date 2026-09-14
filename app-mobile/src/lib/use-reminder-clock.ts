import { useEffect, useState } from "react";
import { AppState } from "react-native";

import { msUntilNextChange, type BucketInput } from "@/utils/reminder-bucket";

/**
 * "Abhi" — jo reminder list ke saath chalta hai.
 *
 * ⚠️ Shikayat: "1:43 wala reminder 1:43 par apne aap 'ho chuke' me jaana chahiye
 * tha". Pehle list sirf screen KHULNE par baantti thi — tab khula pada rahe to
 * beeta hua reminder "Aaj" me hi baitha rehta tha jab tak user tab na badle.
 *
 * Ab screen theek us pal jaagti hai jab kisi reminder ka khaana badalna hai
 * (`msUntilNextChange`), aur zyada se zyada har minute. Har tick me sirf ek
 * `Date` banta hai — list dobara server se nahi aati, bas dobara baant-ti hai.
 *
 * App background se wapas aaye to turant — phone jeb me rakha tha, us beech
 * kai reminder ka waqt nikal chuka ho sakta hai.
 */
export function useReminderClock(list: BucketInput[]): Date {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const wait = msUntilNextChange(list, new Date());
    // +500ms — theek pal par jaagne se "abhi bhi barabar" wala ghadi ka farak
    // na ho. 60s ki chhat — ghadi badle (timezone/time set) to bhi list sahi rahe.
    const t = setTimeout(() => setNow(new Date()), Math.min(wait + 500, 60_000));
    return () => clearTimeout(t);
  }, [list, now]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) => {
      if (s === "active") setNow(new Date());
    });
    return () => sub.remove();
  }, []);

  return now;
}
