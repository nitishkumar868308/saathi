import { useEffect, useRef } from "react";
import { View, Text, Animated, Easing, StyleSheet, type ViewStyle } from "react-native";

import { colors } from "@/theme/colors";
import SaathiLogo from "@/components/saathi-logo";

/**
 * Loader system.
 *
 * Soch: ghoomta hua spinner hamesha "dheema" lagta hai. Isliye:
 *   - Loader        -> teen dots ki tez lehar (~0.9s cycle). Chhota, chust.
 *   - Skeleton      -> content ka dhaancha. List/card ke liye SABSE fast lagta
 *                      hai kyunki page ka shape turant dikh jaata hai.
 *   - TopProgress   -> upar patli patti, background kaam ke liye.
 *
 * Rule: content aa raha ho -> Skeleton. Button/inline -> Loader. Poori screen
 * -> ScreenLoader.
 */

const DOTS = [0, 1, 2];

export function Loader({
  size = 44,
  label,
  color = colors.terracotta,
}: {
  size?: number;
  label?: string;
  color?: string;
}) {
  const dot = size * 0.2;
  const gap = size * 0.14;
  const lift = size * 0.26;

  // Har dot ka apna value — stagger se lehar banti hai.
  const vals = useRef(DOTS.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    const anims = vals.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 110),
          Animated.timing(v, {
            toValue: 1,
            duration: 280,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 280,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay(220 - i * 110),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [vals]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.dots, { gap }]}>
        {vals.map((v, i) => (
          <Animated.View
            key={i}
            style={{
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: color,
              opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }),
              transform: [
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -lift] }) },
              ],
            }}
          />
        ))}
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

/**
 * Logo loader — Saathi ka apna logo dhadakta hua (heartbeat jaisa), peeche
 * ek naram halka ring phailta hai. Warm, zinda, "yaad rakhne wala saathi" feel.
 */
export function LogoLoader({ size = 76, label }: { size?: number; label?: string }) {
  const beat = useRef(new Animated.Value(0)).current;
  const ring = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(beat, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    const r = Animated.loop(
      Animated.timing(ring, {
        toValue: 1,
        duration: 1700,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    );
    b.start();
    r.start();
    return () => {
      b.stop();
      r.stop();
    };
  }, [beat, ring]);

  const radius = Math.round(size * 0.3);
  const scale = beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] });
  const ringScale = ring.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.9] });
  const ringOpacity = ring.interpolate({ inputRange: [0, 0.15, 1], outputRange: [0, 0.28, 0] });

  return (
    <View style={styles.wrap}>
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <Animated.View
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: colors.terracotta,
            opacity: ringOpacity,
            transform: [{ scale: ringScale }],
          }}
        />
        <Animated.View style={{ transform: [{ scale }] }}>
          <SaathiLogo size={size} radius={radius} />
        </Animated.View>
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

/** Poori screen ka loader (center me) — ab logo wala. */
export function ScreenLoader({ label }: { label?: string }) {
  return (
    <View style={styles.screen}>
      <LogoLoader size={78} label={label} />
    </View>
  );
}

/* ------------------------------ skeleton ------------------------------ */

/** Halka dhadakta placeholder block. Content ka shape turant dikhata hai. */
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
        Animated.timing(v, {
          toValue: 1,
          duration: 620,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(v, {
          toValue: 0,
          duration: 620,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
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

/** Ek list-card ka dhaancha (icon + do lines + badge). */
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

/** n cards ka dhaancha — list load hote waqt. */
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

/**
 * Upar ki patli patti — background kaam (sync, refresh) ke liye.
 * Ek chhota segment left se right daudta hai; ye "chal raha hai" ka ehsaas
 * deta hai bina screen block kiye.
 */
export function TopProgress({ visible }: { visible: boolean }) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    v.setValue(0);
    const a = Animated.loop(
      Animated.timing(v, {
        toValue: 1,
        duration: 900,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
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
          {
            transform: [
              {
                translateX: v.interpolate({
                  inputRange: [0, 1],
                  outputRange: [-120, 400],
                }),
              },
            ],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center", gap: 12 },
  dots: { flexDirection: "row", alignItems: "center" },
  label: { fontSize: 14, color: colors.inkSoft, fontWeight: "600" },
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.cream,
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
