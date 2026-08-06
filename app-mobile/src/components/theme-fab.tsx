import { Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { makeStyles, useColors, useThemeMode } from "@/theme/theme";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * Har screen par mila hua theme switch.
 *
 * Settings me poora teen-wala chunav (light / dark / phone ke hisaab se) rehta
 * hai. Ye uski jagah nahi leta — ye us ek kaam ka shortcut hai jo log baar-baar
 * karte hain: "abhi ujla kar do" / "abhi gehra kar do". Isliye ek tap, do haal.
 *
 * ⚠️ JAGAH sabse zyada soch ke chuni gayi hai, aur bottom-right JAAN-BOOJH KE
 * NAHI hai — wahan pehle se FAB baithe hain (Documents, Reminders aur Notes
 * teenon me `right: 20, bottom: 24`). Naya button unhe dhak deta.
 *
 * Baaki har jagah bhi kisi na kisi screen par bhari hai:
 *   - upar        -> har screen ka apna header hai
 *   - neeche      -> tab bar; aur chat me input bar + suggestion chips
 *   - bottom-left -> chat ka input bar poori chaudai leta hai
 *
 * Bacha daayan kinara, beech ki oonchai par — wahan kisi screen ka koi control
 * nahi hota. Button aadha kinare me dhansa hua, chhota aur halka rakha hai
 * taaki list ke daayin kinare ka content bhi na chhupe.
 */
export function ThemeFab() {
  const styles = useStyles();
  const tc = useColors();
  const { scheme, setMode } = useThemeMode();
  const t = useT();

  // Ab kya banega — icon wahi dikhata hai, kyunki ye button ek KAAM hai, haal
  // nahi. Moon ka matlab "gehra kar do", sooraj ka "ujla kar do".
  const goingDark = scheme === "light";

  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <Pressable
        onPress={() => setMode(goingDark ? "dark" : "light")}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={goingDark ? t.settings.themeDark : t.settings.themeLight}
        style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
      >
        <Ionicons name={goingDark ? "moon" : "sunny"} size={15} color={tc.terracotta} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  /**
   * `pointerEvents="box-none"` zaroori hai — warna ye poori-oonchai wala
   * container beech ki screen ke saare tap kha jaata (scroll bhi ruk jaata).
   */
  /**
   * ⚠️ `top: "42%"` tha — aur wo theek screen ke beech me aata tha, yaani
   * hamesha kisi na kisi card ke upar. Home par ye "Aaj ka brief" wale card ka
   * text dhak leta tha (screenshot me saaf dikhta hai).
   *
   * 66% par ye content ke us hisse me aata hai jo aksar khaali ya list ka
   * kinara hota hai, aur tab bar (neeche ~84px) se bhi upar rehta hai.
   */
  wrap: {
    position: "absolute",
    right: 0,
    top: "66%",
    zIndex: 40,
  },
  btn: {
    height: 38,
    // Aadha kinare ke bahar — isliye sirf ~26 chaudai dikhti hai. Pehle 34 tha
    // aur wo list ke daayin kinare ka text chhoo leta tha.
    width: 30,
    alignItems: "center",
    justifyContent: "center",
    // Sirf baayin taraf gol — daayan hissa screen ke kinare se chipka rehta hai.
    borderTopLeftRadius: 19,
    borderBottomLeftRadius: 19,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: c.line,
    backgroundColor: c.surface,
    // Peeche ka content padha ja sake — dabane par poora saaf ho jaata hai.
    opacity: 0.82,
    // Halki chhaya — warna light theme me ye cream background me ghul jaata hai.
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: -2, height: 2 },
    elevation: 3,
  },
  pressed: { opacity: 1, backgroundColor: c.creamDeep },
}));

export default ThemeFab;
