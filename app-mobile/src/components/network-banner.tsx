import { useEffect, useRef } from "react";
import { Text, Animated, Easing } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { makeStyles, useColors } from "@/theme/theme";
import { useNetworkStatus } from "@/lib/network";
import { useT } from "@/lib/i18n/LanguageProvider";

/**
 * Patli si patti jo tabhi dikhti hai jab internet nahi hai ya dheema hai.
 * Screen ke upar, saare screens ke liye (root me mount).
 * Kuch block nahi karti — bas user ko pata rehta hai ki dikkat net ki hai,
 * app ki nahi.
 */
export function NetworkBanner() {
  const tc = useColors();
  const styles = useStyles();
  const { offline, slow } = useNetworkStatus();
  const { network: n } = useT();
  const insets = useSafeAreaInsets();
  const show = offline || slow;
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: show ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [show, slide]);

  if (!show) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.bar,
        offline ? styles.barOffline : styles.barSlow,
        { paddingTop: insets.top + 6 },
        {
          opacity: slide,
          transform: [
            { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [-30, 0] }) },
          ],
        },
      ]}
    >
      {/* Icon aur text ka rang patti ke hisaab se — neeche `useStyles` me
          poori wajah likhi hai. */}
      <Ionicons
        name={offline ? "cloud-offline-outline" : "time-outline"}
        size={15}
        color={offline ? tc.onInk : tc.inkCard}
      />
      <Text
        style={[styles.text, offline ? styles.textOffline : styles.textSlow]}
        numberOfLines={1}
      >
        {offline ? n.offline : n.slow}
      </Text>
    </Animated.View>
  );
}

const useStyles = makeStyles((c) => ({
  bar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingBottom: 7,
    paddingHorizontal: 16,
  },
  /**
   * ⚠️ Yahan pehle `backgroundColor: c.ink` tha aur text `c.white` — aur dark
   * mode me ye patti poori tarah GAYAB ho jaati thi.
   *
   * `ink` theme ke saath ULTA hota hai: light me gehra bhoora (#2E2823), dark me
   * lagbhag safed (#F2EAE0). Text safed hi rehta tha, yaani dark mode me safed
   * par safed. Aur yahi wo ek patti hai jo tabhi aati hai jab kuch pehle se
   * galat hai — user ko sirf ek khaali safed patti dikhti thi aur wo samajhta
   * tha ki app hi atak gayi.
   *
   * `inkCard` dono theme me GEHRA rehta hai aur `onInk` dono me UJLA — theek
   * isi soorat ke liye ye jodi banayi gayi thi (dekho `theme/colors.ts`).
   */
  barOffline: { backgroundColor: c.inkCard },
  /**
   * Amber dono theme me UJLA hai, isliye uspar safed text kabhi theek tha hi
   * nahi — light me 1.9:1, dark me 1.6:1. Gehra text yahan 6:1 se upar jaata hai.
   */
  barSlow: { backgroundColor: c.amber },
  text: { fontSize: 12.5, fontWeight: "700" },
  textOffline: { color: c.onInk },
  textSlow: { color: c.inkCard },
}));
