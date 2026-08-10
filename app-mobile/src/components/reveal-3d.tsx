import { useEffect, useRef, type ReactNode } from "react";
import { Animated, Easing, Pressable, type ViewStyle } from "react-native";

/**
 * Home ke card "3D" me aate hain — peeche se uthte hue, aage ki taraf.
 *
 * ── Ye 3D "jaisa" kaise lagta hai ────────────────────────────────────────
 *
 * Teen cheezein ek saath chalti hain, aur teenon zaroori hain. Inme se ek bhi
 * hatao to wo sirf ek saada fade/slide reh jaata hai:
 *
 *   1. `perspective` — iske bina `rotateX` bas ek flat squeeze dikhta hai.
 *      Chhota number = zyada gehrai. 700 par card jhukta hua lagta hai,
 *      tedha nahi.
 *   2. `rotateX` — card peeche ki taraf letta hua shuru hota hai (~8°) aur
 *      seedha ho jaata hai. Yahi wo "screen se bahar aa raha hai" wala ehsaas
 *      deta hai.
 *   3. `translateY` + `scale` — thoda neeche se aur thoda door se. Akele
 *      rotateX se card sirf hilta hua lagta hai; ye dono use "aa raha hai"
 *      banate hain.
 *
 * ── Tez, dheema nahi ────────────────────────────────────────────────────
 *
 * ⚠️ Home wo screen hai jo din me sabse zyada baar khulti hai. Yahan lambi
 * animation pehli baar achhi lagti hai aur dasvi baar app ko SLOW bana deti
 * hai — user ko har baar apne data ka intezaar karna padta hai. Isliye:
 *
 *   • poori animation 300ms ki hai (`DURATION`),
 *   • har agla card sirf 55ms baad shuru hota hai (`STEP`), aur
 *   • aakhri card bhi ~450ms me apni jagah par hota hai.
 *
 * `Easing.out` isliye ki taakat shuruaat me hi lag jaaye aur aakhir naram ho —
 * wahi cheez animation ko "tez" mehsoos karati hai, chahe waqt utna hi ho.
 *
 * ⚠️ Sab kuch `transform`/`opacity` par hai, isliye poori animation NATIVE
 * driver par chalti hai. Home par ek saath do network call chalti hain; JS
 * thread us waqt busy hota hai, aur usi par chalne wali animation wahan saaf
 * atakti hui dikhti.
 */

const DURATION = 300;
const STEP = 55;

export function Reveal3D({
  children,
  /** Kitne number ka card — utna hi zara sa der se aata hai. */
  index = 0,
  style,
}: {
  children: ReactNode;
  index?: number;
  style?: ViewStyle;
}) {
  const v = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const a = Animated.timing(v, {
      toValue: 1,
      duration: DURATION,
      delay: index * STEP,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    a.start();
    return () => a.stop();
  }, [v, index]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: v,
          transform: [
            { perspective: 700 },
            {
              rotateX: v.interpolate({
                inputRange: [0, 1],
                outputRange: ["8deg", "0deg"],
              }),
            },
            {
              translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }),
            },
            { scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Dabane par card andar ki taraf dabta hai — 3D button jaisa.
 *
 * ⚠️ Yahan `Pressable` ka apna `pressed` style JAAN-BOOJH KE use nahi kiya.
 * Wo turant badalta hai aur turant wapas — ek jhatka, jo 3D ke ulta lagta hai.
 * Spring dabne aur uthne dono me thodi si jaan daal deta hai, aur wahi ise
 * "chhua hua" mehsoos karata hai.
 *
 * Dabav bahut halka rakha hai (0.965 + 4° jhukav): isse zyada karne par card
 * screen me ghusta hua lagta hai aur padhna mushkil ho jaata hai.
 */
export function Press3D({
  children,
  onPress,
  style,
}: {
  children: ReactNode;
  onPress: () => void;
  style?: ViewStyle;
}) {
  const p = useRef(new Animated.Value(0)).current;

  const to = (toValue: number) =>
    Animated.spring(p, {
      toValue,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => to(1)}
      onPressOut={() => to(0)}
      style={style}
    >
      <Animated.View
        style={{
          transform: [
            { perspective: 600 },
            {
              rotateX: p.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "4deg"] }),
            },
            { scale: p.interpolate({ inputRange: [0, 1], outputRange: [1, 0.965] }) },
          ],
        }}
      >
        {children}
      </Animated.View>
    </Pressable>
  );
}
