import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { Text, Animated, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { makeStyles, useColors } from "@/theme/theme";
import type { Colors } from "@/theme/colors";

type ToastType = "success" | "error" | "info";
type ToastState = { msg: string; type: ToastType } | null;

const ToastContext = createContext<{
  show: (msg: string, type?: ToastType) => void;
}>({ show: () => {} });

export const useToast = () => useContext(ToastContext);

/**
 * Kisi rang ki "roshni" (relative luminance, WCAG).
 *
 * Sirf `#rgb` / `#rrggbb` samajhta hai — poore app ke toast ke rang isi shakal
 * me aate hain. Kuch aur mile to `null`, aur caller apne surakshit default par
 * chala jaata hai.
 */
function luminance(hex: string): number | null {
  const h = hex.trim().replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  if (!/^[0-9a-f]{6}$/i.test(full)) return null;
  const ch = [0, 2, 4].map((i) => {
    const v = parseInt(full.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** Ujla background hai ya gehra — text/icon ka rang isi se tay hota hai. */
function isLightBg(bg: string): boolean {
  const l = luminance(bg);
  // Naa naap paaye to gehra maan lo: app ke saare toast rang gehre hi hain, aur
  // ujla text un par hi theek baithta hai.
  return l === null ? false : l > 0.45;
}

/**
 * Toast ka rang aur icon.
 *
 * Function isliye (const map nahi): rang theme se aate hain, aur module level
 * par theme abhi pata hi nahi hoti. Yahi wo chhoti si jagah thi jo dark mode me
 * hamesha light ka rang leke baithi rehti.
 *
 * ⚠️ `fg` (text + icon ka rang) yahan HISAAB se nikalta hai, likha hua nahi hai —
 * aur yahi is file ka asli sudhaar hai. Pehle `fg` har jagah hardcoded `#fff`
 * tha, jabki `bg` theme ke saath ULTA ho jaata hai:
 *
 *   • `info` ka bg `c.ink` hai. Light theme me wo gehra bhoora (#2E2823) hai —
 *     uspar safed text saaf padhta hai. Par dark theme me `ink` ulta ho ke
 *     lagbhag safed (#F2EAE0) ho jaata hai, aur text ab bhi safed hi rehta tha.
 *     Natija: safed par safed. Dark mode me har "Sahi email daalo" / "Dobara
 *     bolo" jaisa toast ek khaali cream patti bankar aata tha — user ko lagta
 *     tha app ne bina kuch kahe kuch flash kar diya.
 *   • `success` ka `sage` dark theme me ujla (#9DAE8A) ho jaata hai — wahan bhi
 *     safed text sirf 2:1 par tha, yaani AA se bahut neeche.
 *
 * Ab har rang ke saath uska padha jaane wala saathi apne aap aata hai: ujle bg
 * par gehra text, gehre bg par cream. Dono theme me, har toast par.
 */
const metaFor = (
  tc: Colors,
): Record<ToastType, { bg: string; fg: string; icon: string }> => {
  const pair = (bg: string, icon: string) => ({
    bg,
    // Cream/ink — brand ke apne do sire. Saada #fff/#000 yahan thanda lagta hai.
    fg: isLightBg(bg) ? "#241F1A" : "#FFF8EC",
    icon,
  });
  return {
    success: pair(tc.sage, "checkmark-circle"),
    // Khatre ka rang theme se aata hai (`danger`) — dark page par light wala
    // #B23B3B 3.4:1 par gir jaata tha.
    error: pair(tc.danger, "alert-circle"),
    info: pair(tc.ink, "information-circle"),
  };
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const styles = useStyles();
  const meta = metaFor(useColors());
  const [toast, setToast] = useState<ToastState>(null);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-12)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (msg: string, type: ToastType = "info") => {
      setToast({ msg, type });
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true }),
      ]).start();

      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        Animated.parallel([
          Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }),
          Animated.timing(translateY, { toValue: -12, duration: 200, useNativeDriver: true }),
        ]).start(() => setToast(null));
      }, 2600);
    },
    [opacity, translateY],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {toast && (
        <SafeAreaView style={styles.wrap} pointerEvents="none" edges={["top"]}>
          <Animated.View
            style={[
              styles.toast,
              { backgroundColor: meta[toast.type].bg, opacity, transform: [{ translateY }] },
            ]}
          >
            <Ionicons
              name={meta[toast.type].icon as any}
              size={19}
              color={meta[toast.type].fg}
            />
            <Text
              style={[styles.text, { color: meta[toast.type].fg }]}
              numberOfLines={3}
            >
              {toast.msg}
            </Text>
          </Animated.View>
        </SafeAreaView>
      )}
    </ToastContext.Provider>
  );
}

const useStyles = makeStyles((c) => ({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 1000,
  },
  toast: {
    marginTop: Platform.OS === "android" ? 12 : 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    maxWidth: 480,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  // ⚠️ Yahan `color` jaan-boojh ke nahi hai — wo `metaFor()` se background ke
  // hisaab se aata hai (upar dekho). Yahan likh dene par wo dobara us purani
  // haalat me chala jaata jahan dark mode me cream par cream padta tha.
  text: { flex: 1, fontSize: 14.5, fontWeight: "600", lineHeight: 20 },
}));
