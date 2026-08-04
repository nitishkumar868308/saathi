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
 * Toast ka rang aur icon.
 *
 * Function isliye (const map nahi): rang theme se aate hain, aur module level
 * par theme abhi pata hi nahi hoti. Yahi wo chhoti si jagah thi jo dark mode me
 * hamesha light ka rang leke baithi rehti.
 *
 * Error ka laal dono theme me ek hi hai — jaan-boojh ke. Khatre ka rang halka
 * karne se wo khatra jaisa lagna band ho jaata hai.
 */
const metaFor = (tc: Colors): Record<ToastType, { bg: string; icon: string }> => ({
  success: { bg: tc.sage, icon: "checkmark-circle" },
  error: { bg: "#B23B3B", icon: "alert-circle" },
  info: { bg: tc.ink, icon: "information-circle" },
});

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
            <Ionicons name={meta[toast.type].icon as any} size={19} color="#fff" />
            <Text style={styles.text} numberOfLines={2}>
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
  text: { flex: 1, color: "#fff", fontSize: 14.5, fontWeight: "600" },
}));
