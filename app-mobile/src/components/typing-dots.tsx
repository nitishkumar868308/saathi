import { useEffect, useRef } from "react";
import { Animated, Easing, View } from "react-native";
import { makeStyles } from "@/theme/theme";

/** Saathi "soch raha hai" — teen dots jo baari-baari upar-neeche jaate hain. */
export function TypingDots() {
  const styles = useStyles();
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const anims = dots.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 140),
          Animated.timing(v, {
            toValue: 1,
            duration: 300,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(v, {
            toValue: 0,
            duration: 300,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.delay((2 - i) * 140),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.row}>
      {dots.map((v, i) => (
        <Animated.View
          key={i}
          style={[
            styles.dot,
            {
              opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] }),
              transform: [
                { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4 },
  dot: { height: 7, width: 7, borderRadius: 4, backgroundColor: c.inkSoft },
}));
