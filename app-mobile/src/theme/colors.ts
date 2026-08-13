// Warm theme — landing page ke saath consistent (Dot-inspired cozy premium)
export const lightColors = {
  cream: "#F7F2E9",
  creamDeep: "#EFE7D6",
  surface: "#FFFCF6",
  ink: "#2E2823",
  inkSoft: "#6B5F54",
  terracotta: "#C25A37",
  terracottaDark: "#A8492B",
  amber: "#E0A458",
  sage: "#7C8A6B",
  line: "#E5DBC9",
  white: "#FFFFFF",
  /**
   * Modal/loader ke peeche ka parda.
   *
   * ⚠️ Ye dono theme me GEHRA hi rehta hai, ulta nahi hota — parde ka kaam
   * peeche wali screen ko dabana hai, uska rang copy karna nahi. Light theme
   * par cream page ke upar 45% garam-kaala kaafi hai.
   *
   * Dark theme me iski value ALAG hai (colors.ts me neeche dekho): wahan page
   * khud gehra hai, to 45% ka parda dikhta hi nahi tha — user ko lagta tha app
   * ne uska tap suna hi nahi, aur wo dobara dabata tha.
   */
  scrim: "rgba(46,40,35,0.45)",

  /**
   * Blocking loader ke peeche ka parda — `scrim` se ALAG, aur jaan-boojh ke.
   *
   * ⚠️ Ye token us bug ke liye bana hai jo SIRF light theme me dikhta tha.
   * `LoaderOverlay` apne naam ("Apka Saathi") ko hamesha ujle rang me likhta hai,
   * kyunki uske peeche parda hai. Par light theme me `scrim` sirf 45% hai, aur
   * cream page par wo milke ~#9C9790 ban jaata tha — ek beech ka sletee rang.
   * Us par ujla naam sirf **2.6:1** par tha (AA chahiye 4.5:1), yaani text
   * maujood hote hue bhi dikhta hi nahi tha. Dark theme me wahi naam 17.5:1 par
   * bilkul saaf tha — isiliye ye "dark me theek, light me gayab" wala fark tha.
   *
   * `scrim` ko gehra karna galat hota: wo aam modal ka parda hai, aur uska kaam
   * peeche ki screen dabana hai — poori tarah chhupana nahi. Loader ka parda ulta
   * hai: wahan peeche kuch dikhna zaroori hi nahi, kaam poora hone tak user ko
   * rokna hi maksad hai.
   *
   * Isliye dono theme me GEHRA — taaki naam ka rang ek hi rakha ja sake aur wo
   * dono jagah AA paas kare.
   */
  scrimLoader: "rgba(26,23,20,0.92)",

  /* ── "Ulta" highlight card ──────────────────────────────────────────
   *
   * Wo gehra card jisme ujla text hota hai — home ka "Aaj ka brief", profile ka
   * "Saathi Plus", upgrade ka price card, permission modal ka header.
   *
   * ⚠️ Ye teen token isliye bane kyunki bina inke ek saaf bug tha, aur wo
   * SIRF dark mode me dikhta tha. Card ka background `c.ink` se aata tha aur
   * uska text hardcoded `rgba(247,242,233,0.9)` (cream) tha. Light theme me ye
   * theek chalta hai — `ink` gehra bhoora hai, uspar cream text saaf padhta
   * hai. Par dark theme me `ink` ULTA ho jaata hai (#F2EAE0, yaani lagbhag
   * safed) — aur text ab bhi cream hi rehta tha. Natija: cream par cream.
   * Card poora khaali dikhta tha, jaise text load hi na hua ho. (Screenshot me
   * "Aaj ka brief" aur profile ka "Saathi Plus" dono aise hi gayab the.)
   *
   * Ab card ka apna rang hai jo dono theme me GEHRA rehta hai, aur uska text
   * dono theme me UJLA. `ink` ka is card se koi lena-dena nahi.
   */
  /** Highlight card ka background — dono theme me gehra. */
  inkCard: "#2E2823",
  /** Us card par ka mukhya text. */
  onInk: "#F7F2E9",
  /** Us card par ka halka/doosre darje ka text. */
  onInkSoft: "rgba(247,242,233,0.72)",
  /** Us card ke andar ki lakeer. */
  onInkLine: "rgba(247,242,233,0.16)",
  /**
   * Us gehre parde/card par brand ka accent — loader ka "Saathi".
   *
   * ⚠️ Saada `terracotta` yahan kaam NAHI karta, aur ye ganit ki baat hai, pasand
   * ki nahi. Terracotta (#C25A37) ek beech ka rang hai; gehre parde par uska
   * contrast sirf **1.7:1** aata hai — yaani naam bilkul ghul jaata hai. Dark
   * theme ka #D2653C bhi wahan 3.2:1 se aage nahi jaata.
   *
   * Isliye ek halka kiya hua terracotta, sirf gehri surface ke liye: parde par
   * 5.5:1 (light theme) aur 7.4:1 (dark theme). Hue wahi brand ka hai, bas dark
   * background ke liye tuned — bilkul waise hi jaise dark theme apne terracotta
   * ko ujla karta hai.
   *
   * ⚠️ Ise saadi cream/surface par mat lagana — wahan ye bahut halka pad jaata
   * hai. Cream page par `terracotta` hi sahi hai.
   */
  onInkAccent: "#E8875F",

  /* ── Ujle accent (amber / sage) par ka rang ─────────────────────────
   *
   * ⚠️ Ye token us bug ke liye bana hai jo poore app me phaila hua tha, aur
   * `onInk` ka theek ULTA hai.
   *
   * `amber` aur `sage` DONO theme me UJLE hain (dark me to aur bhi ujle —
   * #E0A458 → #E8B570, #7C8A6B → #9DAE8A). Un par jo bhi baithta tha wo do me
   * se ek galti karta tha:
   *
   *   • `c.white` — light me hi kamzor (sage par 3.4:1, amber par 1.9:1), aur
   *     dark me aur gir jaata hai (2.4:1 / 1.6:1). Home ka "Ho gaya" button,
   *     permission modal ka poora hua CTA, aur reminder-alert ka expiry wala
   *     34px icon — teenon isi wajah se dhundhle the.
   *   • `c.ink` — jo theme ke saath ULTA hota hai. Light me theek (6.2:1), par
   *     dark me wo lagbhag safed ho jaata hai: Home ke brief-upsell ka
   *     "Plus lo" wala chip amber par POORI TARAH gayab ho jaata tha.
   *
   * Isliye ek aisa rang jo dono theme me GEHRA rehta hai. amber par 6.2:1 /
   * 6.7:1, sage par 4.2:1 / 5.6:1 — chaaron soorat me padha jaata hai.
   */
  onAccent: "#241F1A",

  /**
   * Khatre ka rang — delete, logout, "ye wapas nahi aayega".
   *
   * ⚠️ Ye poore app me `#B23B3B` hardcoded pada tha (settings, reminders,
   * doc-card, toast, confirm-modal, status). Light theme par wo theek hai —
   * cream #F7F2E9 par 5.1:1. Par dark page #1A1714 par wahi rang sirf 3.4:1
   * par gir jaata hai, jo aam text ke liye AA se neeche hai: "Delete" jaisa
   * sabse zaroori shabd hi sabse kam padha jaata tha. Dark me isliye halka
   * ujla shade (#E06B6B, 5.9:1).
   */
  danger: "#B23B3B",
} as const;

export type Colors = { -readonly [K in keyof typeof lightColors]: string };

/**
 * Dark — kaala nahi, GARAM andhera.
 *
 * ⚠️ Sadhaaran #000/#111 is brand ke saath thanda aur sasta lagta hai. Yahan har
 * gehre rang me wahi bhoora-pan hai jo light theme me hai, bas ulta. Terracotta
 * aur amber jaan-boojh ke thode ujle hain: gehre background par light theme wala
 * rang padhne me kam saaf rehta hai.
 *
 * `white` ko haath nahi lagaya — wo terracotta button par likhe text ka rang
 * hai, aur wo button dono theme me rangeen hi rehta hai. Use ulta karne par
 * button ka text gayab ho jaata.
 *
 * ⚠️ `terracotta` ka shade naap ke chuna gaya hai, aankh se nahi. Ise DO ulte
 * kaam karne hain: gehre page par TEXT ban ke padha jaana (ujla chahiye), aur
 * button ka BACKGROUND ban ke uspar safed text dikhana (gehra chahiye). Dono ko
 * 4.5:1 par le jaana ganit se namumkin hai — page #1A1714 par text ke liye
 * luminance >= 0.215 chahiye, par safed text ke liye <= 0.183.
 *
 * Isliye #D2653C: text 4.82:1 (AA poora), aur safed button text 3.71:1 — jo AA
 * ki "bada text" wali shart (3:1) se upar hai, aur button ka text bada aur bold
 * hota bhi hai. Pehle yahan #E07A55 tha jispar safed text 2.96:1 par gir jaata
 * tha — yaani sabse zyada dabaya jaane wala button hi sabse kam padha jaata.
 */
export const darkColors: Colors = {
  cream: "#1A1714",
  creamDeep: "#241F1A",
  surface: "#221D19",
  ink: "#F2EAE0",
  inkSoft: "#A79A8C",
  terracotta: "#D2653C",
  terracottaDark: "#C25A37",
  amber: "#E8B570",
  sage: "#9DAE8A",
  line: "#3A322B",
  white: "#FFFFFF",
  // Light theme se kaafi gehra. Page khud #1A1714 hai; 45% wala parda uspar
  // bilkul nahi dikhta tha, yaani "app abhi busy hai" ka koi ishaara hi nahi
  // jaata tha. 72% par peeche ka content dab jaata hai aur parda saaf padhta hai.
  scrim: "rgba(8,6,5,0.72)",
  // Loader ka parda yahan pehle se hi kaafi gehra tha — isliye light theme wale
  // se bhi thoda aur gehra rakha hai, taaki dono theme me naam ek jaisa saaf
  // padhe (light par 5.5:1, yahan 7.4:1).
  scrimLoader: "rgba(8,6,5,0.94)",

  /**
   * Dark theme me card page se THODA UJLA hai, gehra nahi.
   *
   * Page khud #1A1714 hai. Usse aur gehra card banane par wo dikhta hi nahi —
   * highlight card ka poora matlab hi yahi hai ki wo baaki page se alag dikhe.
   * #332C26 page se saaf upar uthta hai aur uspar cream text ab bhi 11:1 se
   * upar padhta hai.
   */
  inkCard: "#332C26",
  onInk: "#F2EAE0",
  onInkSoft: "rgba(242,234,224,0.72)",
  onInkLine: "rgba(242,234,224,0.16)",
  // ⚠️ Light theme jaisa hi — ye rang GEHRI surface ke liye hai, theme ke liye
  // nahi. Use ulta karne ka matlab hoga wahi 1.7:1 wala bug wapas laana.
  onInkAccent: "#E8875F",
  // ⚠️ Light theme jaisa hi — amber/sage yahan aur bhi UJLE hain, isliye un par
  // ka rang ulta karna theek wo bug wapas laa dega jiske liye ye token bana hai.
  onAccent: "#241F1A",
  // Light wala #B23B3B gehre page par 3.4:1 par gir jaata hai (AA se neeche).
  danger: "#E06B6B",
};

export type ColorKey = keyof Colors;

/**
 * ⚠️ `colors` ab bhi maujood hai par ye SIRF light theme hai.
 *
 * Kisi bhi aisi jagah ise mat use karo jo screen par dikhti ho — wo jagah dark
 * mode me light hi rah jaayegi. Screens ke liye `makeStyles` / `useColors`
 * (theme.tsx) hai, jo chuni hui theme ke hisaab se rang deta hai.
 *
 * Ye export sirf un cheezon ke liye bacha hai jo theme se bahar hain: app icon,
 * splash, notification ka accent — wahan ek hi tay rang chahiye hota hai.
 */
export const colors = lightColors;
