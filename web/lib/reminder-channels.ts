/**
 * "Is user ko email / WhatsApp reminder bhejna bhi chahiye ya nahi?"
 *
 * ⚠️ Ye check pehle KAHIN nahi tha. Dono cron (reminders aur document-expiry)
 * har us user ko email bhej dete the jiska email tha — yaani har user ko — aur
 * har us user ko WhatsApp jiska phone tha.
 *
 * Par email + WhatsApp reminders **Saathi Plus** ka feature hai. Pricing page,
 * FAQ aur app ke upgrade screen — teeno jagah wahi bech rahe hain. Yaani jo
 * cheez ke paise maang rahe the wo sabko free me ja rahi thi, aur uska Twilio
 * (per-message) + SMTP kharcha bhi poore user-base par lag raha tha.
 *
 * ⚠️ In-app aur phone ki notification ka isse koi lena-dena NAHI hai — wo free
 * plan ka hissa hai aur waise hi chalti rahegi. Yahan sirf wo do raaste rukte
 * hain jo Plus me aate hain.
 *
 * Ek hi jagah isliye ki dono cron kabhi alag hisaab na lagayein: ek reminder
 * email bheje aur doosra document-expiry na bheje, to user ko lagega app hi
 * kharab hai.
 */

export type Loc = "hinglish" | "hi" | "en";

/** Cron ko profile se yahi chahiye — ek hi query me sab. */
export type ReminderProfile = {
  email: string | null;
  language: Loc;
  /** Plus chalu hai (aur expire nahi hua)? */
  isPlus: boolean;
};

/** `profiles` se ye columns maango — dono cron ke liye ek hi list. */
export const PROFILE_SELECT = "email,language,plan,plan_expires_at";

export type ProfileRow = {
  email: string | null;
  language: string | null;
  plan: string | null;
  plan_expires_at: string | null;
};

/**
 * DB row → cron ke kaam ki shakl.
 *
 * Plus tabhi maana jaata hai jab `plan = 'plus'` HO **aur** expiry nikli na ho.
 * `plan_expires_at` null ka matlab "koi expiry nahi" (admin/lifetime grant) —
 * usse expire mat maano. Bilkul yahi hisaab app ka `getPlan()` lagata hai.
 */
export function toReminderProfile(row: ProfileRow | undefined): ReminderProfile {
  const lang = row?.language;
  const expiresAt = row?.plan_expires_at ?? null;
  const notExpired = !expiresAt || new Date(expiresAt).getTime() > Date.now();

  return {
    email: row?.email ?? null,
    language: (lang === "hi" || lang === "en" || lang === "hinglish" ? lang : "hinglish") as Loc,
    isPlus: row?.plan === "plus" && notExpired,
  };
}
