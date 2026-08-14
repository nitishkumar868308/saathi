// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    /**
     * ⚠️ `.next/*` yahan isliye hai ki us folder me app ka apna koi code hai hi
     * nahi — wo Next.js ka build output hai jo galti se is folder me ban gaya
     * tha (asli Next app `web/` me hai). Uske generated `.d.ts` se 7 error aate
     * the (`import/no-unresolved`, `no-empty-object-type`), aur unka koi ilaaj
     * nahi hai — wo file hum likhte hi nahi. Un 7 ki wajah se `npm run lint`
     * hamesha laal rehta tha, yaani wo CI me lag hi nahi sakta tha.
     */
    ignores: ["dist/*", ".next/*"],
  },
  {
    /**
     * `scripts/` ki files Node par chalti hain (`node scripts/gen-icons.mjs`),
     * app ke bundle me kabhi jaati hi nahi. Bina is block ke `Buffer` jaise Node
     * ke apne global `no-undef` de dete the — ek aisi galti jo hai hi nahi.
     */
    files: ["scripts/**"],
    languageOptions: {
      globals: {
        Buffer: "readonly",
        process: "readonly",
        console: "readonly",
        __dirname: "readonly",
      },
    },
    rules: {
      // `sharp` sirf icon banate waqt chahiye (dev-only, on-demand install) —
      // isliye wo dependencies me nahi hai aur resolve bhi nahi hota.
      "import/no-unresolved": "off",
    },
  },
  {
    rules: {
      /**
       * ⚠️ Ye rule off hai, aur wajah "hume warning pasand nahi" NAHI hai.
       *
       * `react-hooks/refs` React Compiler ke saath aaya naya rule hai jo render
       * ke dauraan `ref.current` chhoone par error deta hai. Wo soch aam React
       * me bilkul sahi hai. Par React Native ki animation ka standard tareeka
       * hai:
       *
       *     const fade = useRef(new Animated.Value(0)).current;
       *     <Animated.View style={{ opacity: fade }} />
       *
       * Yahan `.current` render me padha ZAROOR jaata hai, par wo koi badalne
       * wali value nahi hai — wo ek sthir `Animated.Value` object hai jo pehle
       * render par bana tha aur kabhi badalta hi nahi. Render is se na kuch
       * padhta hai na uspar koi faisla leta hai; wo bas native driver ko diya
       * jaata hai. Yaani jis bug se ye rule bachata hai (render ka ref ki taaza
       * value par tikna) wo yahan ho hi nahi sakta.
       *
       * ── Ise off kyun karna ZAROORI tha ──────────────────────────────────
       *
       * Is ek rule se 97 error aate the — poore lint ke 113 me se. Do seedha
       * nuksan hota tha:
       *
       *   • 16 ASLI cheezein (`react-hooks/set-state-in-effect` waali) us dher
       *     me kahin dab jaati thi. Jo list padhi hi na ja sake, wo list kisi
       *     kaam ki nahi.
       *   • `npm run lint` hamesha laal rehta tha, isliye use CI me lagana
       *     namumkin tha — yaani lint kabhi kisi ko rok hi nahi sakta tha.
       *
       * ⚠️ Ise wapas ON karne ka ek hi sahi raasta hai: pehle har jagah
       * `useRef(new Animated.Value(0)).current` ko `useState(() => new
       * Animated.Value(0))[0]` (ya `react-native-reanimated` ke `useSharedValue`)
       * par le jao. Tab ye rule sach me kuch pakadne lagega.
       */
      "react-hooks/refs": "off",
    },
  },
]);
