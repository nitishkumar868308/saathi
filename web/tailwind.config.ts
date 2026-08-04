import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  // Theme `<html class="dark">` se badalti hai — user ka apna faisla OS ke
  // faisle se upar rehna chahiye, isliye media-query wala mode nahi.
  darkMode: "class",
  theme: {
    extend: {
      /**
       * Rang seedhe hex me NAHI hain — CSS variables me hain.
       *
       * ⚠️ Ye poore dark mode ka sabse zaroori faisla hai. Hex likhne par har
       * component me `dark:` wala doosra class jodna padta: `bg-cream
       * dark:bg-[#1A1714]`, aur wo bhi 50+ files me, har jagah. Ek bhi jagah
       * chhoot jaati to dark mode me safed patti chamak jaati.
       *
       * Variables ke saath maujooda `bg-cream`, `text-ink`, `border-line` —
       * sab apne aap dono theme me sahi rang le lete hain. Kisi component ko
       * haath lagane ki zaroorat hi nahi padti.
       *
       * `<alpha-value>` isliye ki `bg-terracotta/12` jaisi opacity abhi bhi
       * chale — wahi Tailwind us jagah asli alpha bhar deta hai.
       */
      colors: {
        // Warm, cozy, premium — Dot (New Computer) inspired
        cream: {
          DEFAULT: "rgb(var(--c-cream) / <alpha-value>)", // page background
          deep: "rgb(var(--c-cream-deep) / <alpha-value>)",
        },
        surface: "rgb(var(--c-surface) / <alpha-value>)", // cards
        ink: {
          DEFAULT: "rgb(var(--c-ink) / <alpha-value>)", // primary text
          soft: "rgb(var(--c-ink-soft) / <alpha-value>)", // muted text
        },
        terracotta: {
          DEFAULT: "rgb(var(--c-terracotta) / <alpha-value>)",
          dark: "rgb(var(--c-terracotta-dark) / <alpha-value>)",
        },
        amber: {
          warm: "rgb(var(--c-amber-warm) / <alpha-value>)",
        },
        sage: "rgb(var(--c-sage) / <alpha-value>)",
        line: "rgb(var(--c-line) / <alpha-value>)", // borders
      },
      fontFamily: {
        display: ["var(--font-fraunces)", "Georgia", "serif"],
        sans: ["var(--font-mulish)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        "4xl": "2rem",
      },
      boxShadow: {
        soft: "0 8px 30px -12px rgba(46, 40, 35, 0.18)",
        warm: "0 20px 60px -24px rgba(194, 90, 55, 0.35)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        "loader-bounce": {
          "0%, 80%, 100%": { transform: "scale(0.5)", opacity: "0.4" },
          "40%": { transform: "scale(1)", opacity: "1" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "translateY(24px) scale(0.94)" },
          "100%": { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "pulse-soft": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.035)" },
        },
        sparkle: {
          "0%, 100%": { opacity: "0.25", transform: "scale(0.8)" },
          "50%": { opacity: "1", transform: "scale(1.15)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.7s ease-out both",
        float: "float 6s ease-in-out infinite",
        marquee: "marquee 32s linear infinite",
        "loader-bounce": "loader-bounce 1.4s ease-in-out infinite both",
        "pop-in": "pop-in 0.5s cubic-bezier(0.22,1,0.36,1) both",
        "pulse-soft": "pulse-soft 2.2s ease-in-out infinite",
        sparkle: "sparkle 2.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
