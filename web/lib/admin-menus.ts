/**
 * Admin ke sidebar ke menu — ek hi sachchi jagah.
 *
 * Yahi list teen jagah chalti hai:
 *   1. sidebar me kya dikhega            (components/AdminDashboard.tsx)
 *   2. role/member me kya tick ho sakta   (components/AdminTeam.tsx)
 *   3. har API route kis menu ka hai      (lib/admin-guard.ts)
 *
 * ⚠️ Teenon ka ek hi jagah se aana zaroori hai. Alag-alag list rakhne par wo
 * dikkat aati hai jo sabse mehngi hoti hai: menu sidebar se chhup jaata hai par
 * uska API route khula reh jaata hai — yaani permission dikhti hai, lagti nahi.
 */

export const ADMIN_MENUS = [
  "users",
  "analytics",
  "seo",
  "blog",
  "message",
  "support",
  "usage",
  "spend",
  /**
   * Play / RevenueCat ke payments.
   *
   * ⚠️ `spend` se alag hai aur alag hi rehna chahiye: `spend` hamara KHARCHA
   * hai (Gemini, Twilio, email), `payments` hamari KAMAI. Dono ek menu me daal
   * dene ka matlab hota ki jise bill dekhna hai use har user ka transaction bhi
   * dikhe — aur wo permission ki poori baat hi ulti kar deta hai.
   */
  "payments",
  "notes",
  "documents",
  "renewals",
  "reviews",
  "logs",
  "contacts",
  "deleteRequests",
  "pricing",
  "rewards",
  "team",
] as const;

export type AdminMenu = (typeof ADMIN_MENUS)[number];

export function isAdminMenu(v: unknown): v is AdminMenu {
  return typeof v === "string" && (ADMIN_MENUS as readonly string[]).includes(v);
}

/** Jo aaya usme se sirf asli menu keys — bina duplicate ke, tay tarteeb me. */
export function cleanMenus(input: unknown): AdminMenu[] {
  if (!Array.isArray(input)) return [];
  const set = new Set(input.filter(isAdminMenu));
  return ADMIN_MENUS.filter((m) => set.has(m));
}

/**
 * Ek member ko sach me kaun se menu milte hain.
 *
 *     (role ke menu  +  is bande ke liye alag se di gayi chhoot)
 *      -  is bande ke liye alag se lagayi gayi rok
 *
 * Rok sabse aakhir me lagti hai, isliye wo hamesha jeetti hai. Ye jaan-boojh ke
 * hai: "isko ye NAHI dena" wali baat kabhi kisi role ke badalne se chup-chaap
 * ulti nahi honi chahiye.
 */
export function effectiveMenus(
  roleMenus: readonly string[] | null | undefined,
  extra: readonly string[] | null | undefined,
  denied: readonly string[] | null | undefined,
): AdminMenu[] {
  const allow = new Set<string>([...(roleMenus ?? []), ...(extra ?? [])]);
  for (const d of denied ?? []) allow.delete(d);
  return ADMIN_MENUS.filter((m) => allow.has(m));
}
