import type { Config } from "tailwindcss";

/**
 * Editor ke chrome ke rang ek hi jagah.
 *
 * Ye video ke rang nahi hain (wo doc ke brand tokens se aate hain) — ye sirf UI
 * ki khaal hai. Phir bhi hex components me bikhrane se ek hafte me hi panel
 * alag-alag grey ke ho jaate hain, isliye naam yahin diye gaye hain.
 */
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          // Sabse gehra = canvas ke peeche, sabse halka = uthi hui satah.
          950: "#0b0b0d",
          900: "#121215",
          800: "#17171c",
          700: "#1e1e24",
          600: "#2a2a32",
          500: "#3a3a45",
        },
        chalk: {
          100: "#e8e6e3",
          300: "#b8b5b0",
          500: "#84817c",
        },
        // brand.primary / brand.accent — @reel/core ke DEFAULT_BRAND_TOKENS se.
        terracotta: "#c25a37",
        amber: "#e0a458",
      },
    },
  },
  plugins: [],
};

export default config;
