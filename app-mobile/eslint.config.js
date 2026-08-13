// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*"],
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
