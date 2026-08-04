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
