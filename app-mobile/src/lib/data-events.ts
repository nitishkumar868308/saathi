import { useEffect, useRef } from "react";

/**
 * "Kuch badal gaya" — ek screen ne data badla, baaki screens ko khabar.
 *
 * ⚠️ Ye isliye bana kyunki har screen sirf `useFocusEffect` par bharosa karti
 * thi: focus mile tabhi dobara load. Wo tab tak theek chalta hai jab tak data
 * usi screen se badle. Par reminder ka alert MODAL hai — wo poore app ke upar
 * khulta hai (`_layout` me mount hai), kisi screen ko chhodta hi nahi. User
 * "Ho gaya" dabata tha, modal band ho jaata tha, aur peeche Home wahi purana
 * reminder dikhata rehta tha. Kisi doosre tab pe jaake wapas aane par hi list
 * sudhrti thi — yaani sab kuch ho chuka tha, bas dikh nahi raha tha (item 2).
 *
 * Isliye ab jo BADALTA hai wo bata deta hai, aur jo DIKHATA hai wo sun leta
 * hai. Sirf memory me — na koi storage, na koi server call.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/** Reminder/document badla — jo bhi screen khuli hai, wo apna data taaza kar le. */
export function emitDataChanged(): void {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // Ek screen ka reload fail ho to baaki na ruken.
    }
  });
}

/**
 * Badlaav par apna data dobara load karo.
 *
 * Callback ko ref me rakhte hain taaki caller ko `useCallback` ki chinta na ho —
 * warna har render par listener add/remove hota rehta aur beech me aaya event
 * chhoot sakta tha.
 */
export function useDataChanged(onChange: () => void): void {
  const ref = useRef(onChange);

  // Ref ko render ke DAURAAN likhna React ka niyam todta hai (aur React
  // Compiler use pakad bhi leta hai) — isliye har render ke BAAD update karte
  // hain. Listener neeche wale effect me ek hi baar lagta hai aur hamesha
  // sabse taaza callback chalata hai.
  useEffect(() => {
    ref.current = onChange;
  });

  useEffect(() => {
    const listener = () => ref.current();
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
}
