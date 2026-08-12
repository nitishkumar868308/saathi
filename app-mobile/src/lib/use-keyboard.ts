import { useEffect, useState } from "react";
import { Keyboard, Platform } from "react-native";

/**
 * Keyboard abhi kitni oonchai le raha hai (px). Band ho to 0.
 *
 * ── Ye kyun chahiye tha ────────────────────────────────────────────────────
 *
 * ⚠️ `KeyboardAvoidingView` ab Android par bharosemand nahi raha, aur ye ek
 * asli, dikhne wali dikkat hai — user ne khud pakdi thi: note likhte hi mic aur
 * "Reminder set karo" wale button keyboard ke NEECHE chhup jaate the, aur unka
 * hona hi pata nahi chalta tha.
 *
 * Wajah edge-to-edge hai. Android 15 (API 35) se har app zabardasti edge-to-edge
 * chalti hai, aur us haalat me `adjustResize` window ko chhota karta hi nahi —
 * keyboard content ke UPAR aa jaata hai. `KeyboardAvoidingView` ka Android wala
 * raasta (`behavior` na dena) usi window-resize par tika tha, isliye wo ab kuch
 * karta hi nahi. iOS par `padding` chalta hai, par ek hi screen do platform par
 * do tarah se behave kare — wahi bug ka ghar hai.
 *
 * Isliye oonchai khud naapte hain aur `paddingBottom` me daal dete hain. Ye
 * dono platform par ek jaisa chalta hai, edge-to-edge se poori tarah azaad hai,
 * aur koi nayi dependency nahi maangta.
 *
 * ⚠️ Event ke naam platform ke hisaab se alag hain. iOS ke `keyboardWillShow`
 * animation se PEHLE aata hai (isliye wahan content keyboard ke saath uthta hua
 * dikhta hai); Android sirf `keyboardDidShow` deta hai. Dono ka naam ek rakhne
 * par ek platform par jhatka lagta hai.
 */
export function useKeyboardHeight(): number {
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";

    const show = Keyboard.addListener(showEvent, (e) =>
      setHeight(e.endCoordinates?.height ?? 0),
    );
    const hide = Keyboard.addListener(hideEvent, () => setHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return height;
}
