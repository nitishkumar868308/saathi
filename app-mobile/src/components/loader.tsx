import { useEffect, useRef } from "react";
import { View, Text, Animated, Easing, StyleSheet, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { colors } from "@/theme/colors";
import SaathiLogo from "@/components/saathi-logo";

/**
 * Loader system — poore app me EK HI loader (BrandLoader).
 *
 * Saathi ka apna logo halke se saans leta hai, peeche se naram teal ripple-ring
 * phailti hai, aur beech-beech me ek dil upar tairta hai. Warm, zinda, "yaad
 * rakhne wala saathi" feel. Web + admin me bilkul yahi loader hai
 * (web/components/Loader.tsx).
 *
 * `Loader`, `LogoLoader`, `ScreenLoader`, `HandsLoader` sab isi BrandLoader ko
 * dikhate hain — purane naam sirf compatibility ke liye.
 *
 * Chhote size (button) par sirf saans-leta logo; bade par ring + dil bhi (halo).
 * Content aa raha ho -> Skeleton. Background kaam -> TopProgress.
 */

const TEAL = "#125156";

function BrandLoader({
  size = 72,
  label,
  halo = false,
}: {
  size?: number;
  label?: string;
  halo?: boolean;
}) {
  const beat = useRef(new Animated.Value(0)).current;
  const ring1 = useRef(new Animated.Value(0)).current;
  const ring2 = useRef(new Animated.Value(0)).current;
  const heart = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(beat, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    b.start();

    let r1: Animated.CompositeAnimation | undefined;
    let r2: Animated.CompositeAnimation | undefined;
    let h: Animated.CompositeAnimation | undefined;
    if (halo) {
      const mkRing = (v: Animated.Value, delay: number) =>
        Animated.loop(
          Animated.sequence([
            Animated.delay(delay),
            Animated.timing(v, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
            Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
          ]),
        );
      r1 = mkRing(ring1, 0);
      r2 = mkRing(ring2, 900);
      h = Animated.loop(
        Animated.sequence([
          Animated.timing(heart, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.delay(500),
          Animated.timing(heart, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      );
      r1.start();
      r2.start();
      h.start();
    }
    return () => {
      b.stop();
      r1?.stop();
      r2?.stop();
      h?.stop();
    };
  }, [beat, ring1, ring2, heart, halo]);

  const radius = Math.round(size * 0.3);
  const scale = beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  const ringStyle = (v: Animated.Value): Animated.WithAnimatedObject<ViewStyle> => ({
    position: "absolute",
    width: size,
    height: size,
    borderRadius: radius,
    backgroundColor: TEAL,
    opacity: v.interpolate({ inputRange: [0, 0.12, 1], outputRange: [0, 0.22, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.95, 1.85] }) }],
  });

  const heartOpacity = heart.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const heartY = heart.interpolate({ inputRange: [0, 1], outputRange: [size * 0.1, -size * 0.55] });
  const heartScale = heart.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0.4, 1, 0.7] });

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        {halo && <Animated.View style={ringStyle(ring1)} />}
        {halo && <Animated.View style={ringStyle(ring2)} />}
        <Animated.View style={{ transform: [{ scale }] }}>
          <SaathiLogo size={size} radius={radius} />
        </Animated.View>
        {halo && (
          <Animated.View
            style={{ position: "absolute", opacity: heartOpacity, transform: [{ translateY: heartY }, { scale: heartScale }] }}
          >
            <Ionicons name="heart" size={Math.round(size * 0.26)} color={colors.terracotta} />
          </Animated.View>
        )}
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

/** Inline/button loader. Chhota — sirf saans-leta logo. */
export function Loader({ size = 40, label }: { size?: number; label?: string; color?: string }) {
  return <BrandLoader size={size} label={label} halo={size >= 44} />;
}

/** Bada logo loader (halo ke saath). */
export function LogoLoader({ size = 76, label }: { size?: number; label?: string }) {
  return <BrandLoader size={size} label={label} halo />;
}

/** AI padh raha / kuch post ho raha — wahi ek loader. */
export function HandsLoader({ size = 60, label }: { size?: number; label?: string }) {
  return <BrandLoader size={size} label={label} halo />;
}

/** Poori screen ka loader — naram bg ke saath. */
export function ScreenLoader({ label }: { label?: string }) {
  return (
    <View style={styles.screen}>
      <View style={styles.screenGlow} />
      <BrandLoader size={84} label={label} halo />
    </View>
  );
}

/* ------------------------------ skeleton ------------------------------ */

export function Skeleton({
  width = "100%",
  height = 14,
  radius = 8,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: ViewStyle;
}) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(v, { toValue: 0, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    a.start();
    return () => a.stop();
  }, [v]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: colors.line,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] }),
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  return (
    <View style={styles.card}>
      <Skeleton width={44} height={44} radius={14} />
      <View style={{ flex: 1, gap: 8 }}>
        <Skeleton width="62%" height={13} />
        <Skeleton width="38%" height={10} />
      </View>
      <Skeleton width={52} height={22} radius={999} />
    </View>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <View style={{ gap: 10 }}>
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </View>
  );
}

/* ---------------------------- top progress ---------------------------- */

export function TopProgress({ visible }: { visible: boolean }) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    v.setValue(0);
    const a = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    );
    a.start();
    return () => a.stop();
  }, [visible, v]);

  if (!visible) return null;

  return (
    <View style={styles.progressTrack} pointerEvents="none">
      <Animated.View
        style={[
          styles.progressBar,
          { transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [-120, 400] }) }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", gap: 12 },
  label: { fontSize: 14, color: colors.inkSoft, fontWeight: "600" },
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
  },
  screenGlow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(18,81,86,0.07)",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 14,
  },
  progressTrack: {
    height: 2.5,
    width: "100%",
    overflow: "hidden",
    backgroundColor: "rgba(194,90,55,0.12)",
  },
  progressBar: {
    height: 2.5,
    width: 120,
    borderRadius: 2,
    backgroundColor: colors.terracotta,
  },
});
