import type { ReactNode } from "react";
import { View, type StyleProp, type ViewStyle } from "react-native";

import { useKeyboardHeight } from "@/lib/use-keyboard";

/**
 * Keyboard ke upar ka hissa — poore app ke liye EK hi tareeka.
 *
 * ── Ye kyun bana ────────────────────────────────────────────────────────
 *
 * ⚠️ Shikayat ek line ki thi par har screen par thi: "jaha jaha pe keyboard
 * aata h — pin, otp, chat, reminder — us screen ka kuch content keyboard ke
 * ander chala jata h".
 *
 * Wajah ek hi thi. Poore app me `KeyboardAvoidingView` laga hua tha, aur wo
 * Android par ab kuch karta hi NAHI. Android 15 (API 35) se har app zabardasti
 * edge-to-edge chalti hai, aur us haalat me `adjustResize` window ko chhota
 * karta hi nahi — keyboard content ke UPAR aa jaata hai. `KeyboardAvoidingView`
 * ka Android wala raasta (`behavior` na dena) usi window-resize par tika tha.
 * iOS par `padding` chalta tha, isliye bug sirf Android par dikhta tha —
 * yaani hamare lagbhag saare users par.
 *
 * `note-edit.tsx` par ye pehle hi haath se theek kiya ja chuka tha
 * (`useKeyboardHeight` + `paddingBottom`), par sirf wahin. Ab wahi ek tareeka
 * ek component me hai, taaki agli nayi screen par ye galti dobara na ho.
 *
 * ⚠️ Naya screen banate waqt: `KeyboardAvoidingView` mat lagana — `KeyboardView`
 * lagana. Dono platform par ek hi vyavhaar, aur edge-to-edge se poori tarah
 * azaad.
 */
export function KeyboardView({
  children,
  style,
  /**
   * Keyboard ke upar itni aur jagah (px).
   *
   * Un screens ke liye jahan sabse neeche ka control keyboard se chipka hua
   * bhadda lagta hai (chat ka input bar, form ka save button).
   */
  extra = 0,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  extra?: number;
}) {
  const kb = useKeyboardHeight();
  return (
    <View style={[{ flex: 1 }, style, { paddingBottom: kb > 0 ? kb + extra : 0 }]}>
      {children}
    </View>
  );
}

/**
 * Wahi naap, par khud lagane ke liye.
 *
 * Un jagahon ke liye jahan ek poora wrapper `View` daalna layout bigaad deta hai
 * — jaise modal ka centered card (`justifyContent: center` par ek aur flex
 * container beech me aa jaata hai), ya ScrollView ka `contentContainerStyle`.
 */
export function useKeyboardPad(extra = 0): number {
  const kb = useKeyboardHeight();
  return kb > 0 ? kb + extra : 0;
}

export default KeyboardView;
