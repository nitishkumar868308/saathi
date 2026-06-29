import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Warm, cozy, premium — Dot (New Computer) inspired
        cream: {
          DEFAULT: "#F7F2E9", // page background
          deep: "#EFE7D6",
        },
        surface: "#FFFCF6", // cards
        ink: {
          DEFAULT: "#2E2823", // primary text (warm near-black)
          soft: "#6B5F54", // muted text
        },
        terracotta: {
          DEFAULT: "#C25A37",
          dark: "#A8492B",
        },
        amber: {
          warm: "#E0A458",
        },
        sage: "#7C8A6B",
        line: "#E5DBC9", // borders
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
      },
      animation: {
        "fade-up": "fade-up 0.7s ease-out both",
        float: "float 6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
