import { useEffect, useRef } from "react";
import { View, Text, Animated, Easing } from "react-native";
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
      <Ionicons
        name={offline ? "cloud-offline-outline" : "time-outline"}
        size={15}
        color={tc.white}
      />
      <Text style={styles.text} numberOfLines={1}>
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
  barOffline: { backgroundColor: c.ink },
  barSlow: { backgroundColor: c.amber },
  text: { color: c.white, fontSize: 12.5, fontWeight: "700" },
}));
