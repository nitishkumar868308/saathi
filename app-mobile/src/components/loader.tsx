import { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  Modal,
  Animated,
  Easing,
  useWindowDimensions,
  type LayoutChangeEvent,
  type ViewStyle,
} from "react-native";

import { makeStyles, useColors } from "@/theme/theme";
import SaathiLogo from "@/components/saathi-logo";

/**
 * Loader system — poore app me EK HI loader (BrandLoader).
 *
 * Logo screen ke theek beech me, halke se saans leta hua. Uske PEECHE se
 * "Apka Saathi" sarak ke bahar aata hai, thoda ruk ke wapas logo ke peeche
 * chhup jaata hai — aur ye chalta rehta hai. Web + admin me bilkul yahi loader
 * hai (web/components/Loader.tsx).
 *
 * `Loader`, `LogoLoader`, `ScreenLoader`, `HandsLoader` sab isi BrandLoader ko
 * dikhate hain — purane naam sirf compatibility ke liye.
 *
 * Content aa raha ho -> Skeleton. Background kaam -> TopProgress.
 *
 * ⚠️ Peeche wali teal ripple-ring (circle) jaan-boojh ke hata di gayi hai,
 * wapas mat laana. Pehle logo ke peeche se do circle phail ke gayab hote the —
 * wo dhyaan logo se hata leti thi aur har bg par apna alag rang dikhati thi.
 * Ab peeche se sirf naam nikalta hai.
 *
 * ── Naam "peeche se" kaise nikalta hai ──────────────────────────────────
 *
 * Trick do cheezon ki hai:
 *
 *   1. Logo ki image OPAQUE hai (teal bg wala square). To jo text logo ke
 *      x-range me hai, wo apne aap dhak jaata hai — logo upar (zIndex) hai.
 *   2. Logo ke BAAYE jo hissa bachta hai use ek `overflow: "hidden"` wali
 *      khidki kaat deti hai, jiska baayan kinara theek logo ke baaye kinare
 *      par hai.
 *
 * Dono milke: text jab `translateX = -textW` par hota hai to uska daayan
 * kinara logo ke daaye kinare par hota hai — poora text ya to logo ke neeche
 * hai ya khidki ke bahar. Yaani bilkul gayab. Wahan se wo daaye sarakta hai
 * aur logo ke peeche se nikalta hua dikhta hai.
 *
 * Khidki `position: "absolute"` hai, isliye layout me jagah nahi leti — LOGO
 * HAMESHA CENTER ME RAHTA HAI, naam bahar aane par bhi wo khiskta nahi.
 *
 * Sab kuch `translateX`/`opacity` par hai (width par nahi), isliye poori
 * animation native driver par chalti hai — JS thread busy ho tab bhi (jaise AI
 * ka jawab aate waqt) makkhan chalti hai.
 */

/** Ek poori saans — andar 900ms, bahar 900ms. */
const BREATH_MS = 900;

/** Naam ke nikalne-rukne-chhupne ka ek poora chakkar. */
const REVEAL_MS = 2800;

/** Logo aur naam ke beech ka faasla, logo ke size ke hisaab se. */
const GAP_RATIO = 0.16;

function BrandLoader({
  size = 72,
  label,
  /** Logo ke peeche se brand ka naam bhi nikale. */
  brand = false,
  /** Naam dark overlay par hai (cream text) ya normal bg par (ink text)? */
  onDark = false,
}: {
  size?: number;
  label?: string;
  brand?: boolean;
  onDark?: boolean;
}) {
  const styles = useStyles();
  const beat = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(0)).current;
  /**
   * Naam ki asli chaudai. Jab tak naapi nahi jaati, animation ki manzil pata
   * nahi — isliye tab tak naam chhupa rehta hai (`opacity: 0`), warna wo pehle
   * frame me logo ke bagal me chipka hua dikh jaata.
   */
  const [textW, setTextW] = useState(0);

  useEffect(() => {
    beat.setValue(0);
    const b = Animated.loop(
      Animated.sequence([
        Animated.timing(beat, {
          toValue: 1,
          duration: BREATH_MS,
          // sin easing = dono siron par sabse naram mod; loop ke jodh par
          // koi jhatka mehsoos nahi hota.
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(beat, {
          toValue: 0,
          duration: BREATH_MS,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    b.start();
    return () => b.stop();
  }, [beat]);

  useEffect(() => {
    if (!brand || textW === 0) return;
    reveal.setValue(0);
    // Linear clock 0 -> 1; nikalna/rukna/chhupna sab neeche interpolate ke
    // keyframes me hai. Clock linear isliye ki loop ka jodh (1 -> 0) exactly
    // wahin pade jahan naam poora chhupa hua hai — koi jhatka nahi.
    const r = Animated.loop(
      Animated.timing(reveal, {
        toValue: 1,
        duration: REVEAL_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    r.start();
    return () => r.stop();
  }, [reveal, brand, textW]);

  const radius = Math.round(size * 0.3);
  const gap = Math.round(size * GAP_RATIO);
  const scale = beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });

  // Chhupa hua = text ka daayan kinara logo ke daaye kinare par. Bahar = logo
  // ke daaye kinare se `gap` aage.
  const hidden = -textW;
  const shown = gap;
  const nameX = reveal.interpolate({
    //      nikalna      ruko            chhupna       ruko (poora chhupa)
    inputRange: [0, 0.06, 0.3, 0.68, 0.9, 1],
    outputRange: [hidden, hidden, shown, shown, hidden, hidden],
    extrapolate: "clamp",
  });
  // Nikalte waqt halka sa fade-in; wapas jaate waqt aakhir tak dikhta rahe
  // (kyunki wo logo ke peeche chhup raha hai, gayab nahi ho raha).
  const nameOpacity = reveal.interpolate({
    inputRange: [0, 0.1, 0.3, 1],
    outputRange: [0, 0.35, 1, 1],
    extrapolate: "clamp",
  });

  const onNameLayout = (e: LayoutChangeEvent) => {
    const w = Math.ceil(e.nativeEvent.layout.width);
    if (w > 0 && w !== textW) setTextW(w);
  };

  return (
    <View style={styles.wrap}>
      {/* Fixed box = logo saans lete waqt bhi apni jagah se nahi hilta, aur
          neeche ka label upar-neeche nahi kaudta. */}
      <View style={[styles.logoBox, { width: size, height: size }]}>
        {brand && (
          /* Khidki: baayan kinara = logo ka baayan kinara. Isse baayi taraf
             nikla text kat jaata hai. Daayi taraf khuli hai (isliye chaudai
             udaar rakhi hai) taaki naam poora bahar aa sake. `absolute` hone
             se layout par koi asar nahi — logo center me hi rahta hai. */
          <View
            pointerEvents="none"
            style={[styles.nameWindow, { width: size + gap + textW + 8, height: size }]}
          >
            <Animated.View
              onLayout={onNameLayout}
              style={[
                styles.nameSlider,
                {
                  left: size,
                  // Naapne se pehle chhupa hi rehne do — warna pehla frame
                  // logo ke bagal me chipka hua naam dikha deta hai.
                  opacity: textW === 0 ? 0 : nameOpacity,
                  transform: [{ translateX: textW === 0 ? -9999 : nameX }],
                },
              ]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.name,
                  onDark ? styles.nameOnDark : styles.nameOnLight,
                  { fontSize: Math.max(13, Math.round(size * 0.24)) },
                ]}
              >
                Apka Saathi
              </Text>
            </Animated.View>
          </View>
        )}
        <Animated.View style={[styles.logoTop, { transform: [{ scale }] }]}>
          <SaathiLogo size={size} radius={radius} />
        </Animated.View>
      </View>
      {label ? <Text style={styles.label}>{label}</Text> : null}
    </View>
  );
}

/**
 * Screen ke hisaab se loader ka size — chhote 4" phone se le kar tablet tak
 * loader na to kho jaaye na screen kha jaaye. 390pt (aam phone) par `base`
 * milta hai, usse chhoti/badi screen par proportionally, phir min/max clamp.
 */
function useLoaderSize(base: number, min: number, max: number) {
  const { width, height } = useWindowDimensions();
  return useMemo(() => {
    const short = Math.min(width, height);
    return Math.round(Math.max(min, Math.min(max, (short / 390) * base)));
  }, [width, height, base, min, max]);
}

/** Inline/button loader. Chhota — sirf saans-leta logo. */
export function Loader({ size = 40, label }: { size?: number; label?: string; color?: string }) {
  return <BrandLoader size={size} label={label} />;
}

/** Bada logo loader. */
export function LogoLoader({ size = 76, label }: { size?: number; label?: string }) {
  return <BrandLoader size={size} label={label} />;
}

/** AI padh raha / kuch post ho raha — wahi ek loader. */
export function HandsLoader({ size = 60, label }: { size?: number; label?: string }) {
  return <BrandLoader size={size} label={label} />;
}

/** Poori screen ka loader — naram cream bg, logo theek beech me. */
export function ScreenLoader({ label }: { label?: string }) {
  const styles = useStyles();
  const size = useLoaderSize(84, 64, 120);
  return (
    <View style={styles.screen}>
      <BrandLoader size={size} label={label} brand />
    </View>
  );
}

/**
 * Blocking loader — poore app ka ek hi tareeka.
 *
 * Screen ke theek beech me, peeche naram dark overlay. Overlay isliye ki jab tak
 * kaam chal raha hai user peeche ka form chhu na sake (pehle loader inline aata
 * tha, form clickable rehta tha aur do baar submit ho jaata tha).
 *
 * Jaan-boojh ke koi status text nahi — "Samajh raha hoon…" jaisi line nahi.
 * Loader ko sirf ye batana hai ki kaam chal raha hai, kahani nahi sunani.
 * Brand ka naam sirf animation ka hissa hai (logo ke peeche se nikalta hua).
 *
 * ⚠️ Pehle loader ke peeche ek safed (kahin neela sa) card box hota tha, aur
 * logo ke peeche se teal circle phailte the. Dono hata diye gaye hain — ab
 * sirf brand ka logo, screen ke theek beech me, aur peeche naram dark overlay.
 * Har jagah bilkul ek jaisa.
 */
export function LoaderOverlay({ visible }: { visible: boolean }) {
  const styles = useStyles();
  const size = useLoaderSize(78, 60, 110);
  return (
    <Modal transparent visible={visible} animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <BrandLoader size={size} brand onDark />
      </View>
    </Modal>
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
  const tc = useColors();
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
          backgroundColor: tc.line,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.9] }),
        },
        style,
      ]}
    />
  );
}

export function SkeletonCard() {
  const styles = useStyles();
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
  const styles = useStyles();
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

const useStyles = makeStyles((c) => ({
  wrap: { alignItems: "center", justifyContent: "center", gap: 12 },
  logoBox: { alignItems: "center", justifyContent: "center" },
  /** Logo hamesha naam ke UPAR — naam iske "peeche" se nikalta hai. */
  logoTop: { zIndex: 2 },
  /**
   * Naam ki khidki. Baayan kinara theek logo ke baaye kinare par (left: 0),
   * isliye us se baaya nikla text kat jaata hai. `absolute` — layout me jagah
   * nahi leti, to logo center se nahi hilta.
   */
  nameWindow: { position: "absolute", left: 0, top: 0, overflow: "hidden", zIndex: 1 },
  nameSlider: { position: "absolute", top: 0, bottom: 0, justifyContent: "center" },
  name: { fontWeight: "800", letterSpacing: 0.3 },
  nameOnDark: {
    color: c.cream,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  nameOnLight: { color: c.ink, opacity: 0.9 },
  label: { fontSize: 14, color: c.inkSoft, fontWeight: "600", textAlign: "center" },
  screen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.cream,
  },
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    // Theme ke hisaab se — light par 45% garam-kaala, dark par 72%. Pehle
    // yahan ek hi hardcoded rgba tha, jo dark mode me gehre page par bilkul
    // dikhta hi nahi tha.
    backgroundColor: c.scrim,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
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
    backgroundColor: c.terracotta,
  },
}));
