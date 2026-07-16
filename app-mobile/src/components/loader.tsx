import { useEffect, useRef } from "react";
import { View, Text, Animated, Easing, StyleSheet } from "react-native";

import { colors } from "@/theme/colors";

/**
 * Smooth branded loader — do halke ring aur ek dhadakta core. Plain spinner ki
 * jagah har jagah yahi use karo (ek hi consistent premium feel).
 */
export function Loader({ size = 44, label }: { size?: number; label?: string }) {
  const spin = useRef(new Animated.Value(0)).current;
  const spinSlow = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const b = Animated.loop(
      Animated.timing(spinSlow, {
        toValue: 1,
        duration: 2200,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    const c = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 650,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    a.start();
    b.start();
    c.start();
    return () => {
      a.stop();
      b.stop();
      c.stop();
    };
  }, [spin, spinSlow, pulse]);

  const rotate = spin.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const rotateBack = spinSlow.interpolate({
    inputRange: [0, 1],
    outputRange: ["360deg", "0deg"],
  });
  const coreScale = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] });
  const coreOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] });

  const ring = size;
  const core = size * 0.26;

  return (
    <View style={styles.wrap}>
      <View style={{ width: ring, height: ring, alignItems: "center", justifyContent: "center" }}>
        {/* Outer arc (fast) */}
        <Animated.View
          style={[
            styles.ring,
            {
              width: ring,
              height: ring,
              borderRadius: ring / 2,
              borderWidth: Math.max(3, size * 0.08),
              borderTopColor: colors.terracotta,
              transform: [{ rotate }],
            },
          ]}
        />
        {/* Inner arc (slow, reverse) */}
        <Animated.View
          style={[
            styles.ring,
            {
              position: "absolute",
              width: ring * 0.64,
              height: ring * 0.64,
              borderRadius: (ring * 0.64) / 2,
              borderWidth: Math.max(2.5, size * 0.06),
              borderTopColor: colors.amber,
              transform: [{ rotate: rotateBack }],
            },
          ]}
        />
        {/* Pulsing core */}
        <Animated.View
          style={{
            position: "absolute",
            width: core,
            height: core,
            borderRadius: core / 2,
            backgroundColor: colors.terracotta,
            transform: [{ scale: coreScale }],
            opacity: coreOpacity,
          }}
        />
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

/** Poori screen ka loader (center me). */
export function ScreenLoader({ label }: { label?: string }) {
  return (
    <View style={styles.screen}>
      <Loader size={48} label={label} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", gap: 14 },
  ring: {
    borderColor: "rgba(194,90,55,0.14)",
    borderRightColor: "rgba(194,90,55,0.14)",
    borderBottomColor: "rgba(194,90,55,0.14)",
    borderLeftColor: "rgba(194,90,55,0.14)",
  },
  label: { fontSize: 14, color: colors.inkSoft, fontWeight: "600" },
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
  },
});
