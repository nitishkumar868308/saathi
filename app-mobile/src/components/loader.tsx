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
 * ── Naam DONO taraf se nikalta hai ──────────────────────────────────────
 *
 * Brand ka naam do tukdon me toota hua hai, aur dono ulti disha me chalte hain:
 *
 *      "Apka"  ←  [LOGO]  →  "Saathi"
 *
 * ⚠️ Pehle poora "Apka Saathi" ek hi tukda tha jo sirf DAAYI taraf se nikalta
 * tha. Wo dekhne me ek-tarfa lagta tha — logo screen ke beech me hota tha par
 * naam usse hamesha daaye khisak jaata, aur poora loader ek taraf jhuka hua
 * dikhta. Dono taraf se nikalne par logo sach me beech ka lang bana rehta hai
 * aur animation santulit lagti hai. Wapas ek tukde par mat le jaana.
 *
 * Trick do cheezon ki hai (dono taraf bilkul mirror me):
 *
 *   1. Logo ki image OPAQUE hai (teal bg wala square). To jo text logo ke
 *      x-range me hai, wo apne aap dhak jaata hai — logo upar (zIndex) hai.
 *   2. Har taraf ek `overflow: "hidden"` wali khidki hai jo logo ke us kinare
 *      par khatam hoti hai. Baayi khidki ka DAAYAN kinara logo ke baaye kinare
 *      par hai; daayi khidki ka BAAYAN kinara logo ke daaye kinare par.
 *
 * Chhupi hui haalat me har tukda apni khidki se poora bahar hota hai (baaya
 * `+textW` par, daaya `-textW` par) — yaani bilkul gayab. Wahan se wo apni
 * disha me sarak ke "logo ke peeche se" nikalta hua dikhta hai.
 *
 * Dono khidki `position: "absolute"` hain, isliye layout me jagah nahi leti —
 * LOGO HAMESHA CENTER ME RAHTA HAI, naam bahar aane par bhi wo khiskta nahi.
 *
 * Sab kuch `translateX`/`opacity` par hai (width par nahi), isliye poori
 * animation native driver par chalti hai — JS thread busy ho tab bhi (jaise AI
 * ka jawab aate waqt) makkhan chalti hai.
 *
 * ── Naam ke DO rang ─────────────────────────────────────────────────────
 *
 * "Apka" dabaa hua, "Saathi" brand ke rang me. Neeche `wordStyle()` par poori
 * baat likhi hai, par ek baat yahan bhi zaroori hai:
 *
 * ⚠️ Naam ka rang PARDE ke hisaab se chunna hai, theme ke hisaab se nahi.
 * `LoaderOverlay` ka parda (`scrimLoader`) dono theme me gehra hai, isliye
 * wahan `onInkSoft`/`onInkAccent` — jo dono theme me ujle rehte hain. Cream
 * page par (`ScreenLoader`) theme-wale `inkSoft`/`terracotta`.
 *
 * Ye ulta karne par theek wo bug wapas aata hai jiske liye ye likha gaya:
 * light theme me gehre parde par gehra naam, yaani naam gayab.
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
   * Dono tukdon ki asli chaudai. Jab tak naapi nahi jaati, animation ki manzil
   * pata nahi — isliye tab tak naam chhupa rehta hai (`opacity: 0`), warna wo
   * pehle frame me logo ke bagal me chipka hua dikh jaata.
   *
   * Do alag naap isliye ki dono shabd alag lambai ke hain ("Apka" chhota,
   * "Saathi" bada) — ek hi naap dono par lagane se chhota wala poora chhupta
   * nahi tha aur logo ke kinare se ek tukda jhaankta rehta.
   */
  const [leftW, setLeftW] = useState(0);
  const [rightW, setRightW] = useState(0);
  const measured = leftW > 0 && rightW > 0;

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
    if (!brand || !measured) return;
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
  }, [reveal, brand, measured]);

  const radius = Math.round(size * 0.3);
  const gap = Math.round(size * GAP_RATIO);
  const scale = beat.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const fontSize = Math.max(13, Math.round(size * 0.24));

  /**
   * Ek tukde ka safar — chhupe se bahar, ruko, wapas chhup jao.
   *
   * `dir` = kis taraf nikalna hai: -1 baaye, +1 daaye. Baaki poora hisaab dono
   * ke liye bilkul ek jaisa hai, isliye ek hi jagah likha hai — warna do lagbhag
   * ek jaise blocks ban jaate aur unme se ek chupchaap purana pad jaata.
   *
   * Chhupa hua = tukda apni khidki se poora bahar (logo ke peeche). Bahar =
   * logo ke us kinare se `gap` aage.
   */
  const slide = (width: number, dir: -1 | 1) => {
    const hidden = -dir * width;
    const shown = dir * gap;
    return reveal.interpolate({
      //      nikalna      ruko            chhupna       ruko (poora chhupa)
      inputRange: [0, 0.06, 0.3, 0.68, 0.9, 1],
      outputRange: [hidden, hidden, shown, shown, hidden, hidden],
      extrapolate: "clamp",
    });
  };

  // Nikalte waqt halka sa fade-in; wapas jaate waqt aakhir tak dikhta rahe
  // (kyunki wo logo ke peeche chhup raha hai, gayab nahi ho raha).
  const nameOpacity = reveal.interpolate({
    inputRange: [0, 0.1, 0.3, 1],
    outputRange: [0, 0.35, 1, 1],
    extrapolate: "clamp",
  });

  const measure = (set: (w: number) => void, current: number) => (e: LayoutChangeEvent) => {
    const w = Math.ceil(e.nativeEvent.layout.width);
    if (w > 0 && w !== current) set(w);
  };

  /**
   * Do shabd, do rang — aur ye sajawat se zyada padhne ki baat hai.
   *
   * "Apka" dabaa hua (muted) hai aur "Saathi" brand ke rang me. Isse nazar
   * apne aap us shabd par jaati hai jo brand ka asli naam hai, aur ek hi mote
   * rang me likhe do shabd jaisa flat nahi lagta.
   *
   * ⚠️ Rang parde ke hisaab se badalte hain, THEME ke hisaab se nahi — aur yahi
   * wo fark hai jo pehle chhoot gaya tha. `onDark` ka matlab hai "naam gehre
   * parde par baitha hai", aur wo parda DONO theme me gehra hi rehta hai
   * (`scrimLoader`). Isliye wahan theme-wale token (`inkSoft`/`terracotta`)
   * lagana ulta galat hai: light theme me wo gehre parde par gehre rang de dete
   * hain. Cream page par (`ScreenLoader`) theme-wale token hi sahi hain.
   */
  const wordStyle = (accent: boolean) => [
    styles.name,
    onDark
      ? accent
        ? styles.saathiOnDark
        : styles.apkaOnDark
      : accent
        ? styles.saathiOnLight
        : styles.apkaOnLight,
    { fontSize },
  ];

  return (
    <View style={styles.wrap}>
      {/* Fixed box = logo saans lete waqt bhi apni jagah se nahi hilta, aur
          neeche ka label upar-neeche nahi kaudta. */}
      <View style={[styles.logoBox, { width: size, height: size }]}>
        {brand && (
          <>
            {/* ── "Apka" — BAAYI taraf ──────────────────────────────────
                Khidki ka daayan kinara theek logo ke baaye kinare par hai
                (`right: size`, kyunki parent ki chaudai hi `size` hai). Usse
                daaye nikla text kat jaata hai — yaani logo ke peeche chhupa
                rehta hai. Baayi taraf udaar chaudai, taaki shabd poora bahar
                aa sake. */}
            <View
              pointerEvents="none"
              style={[
                styles.nameWindow,
                { right: size, width: gap + leftW + 8, height: size },
              ]}
            >
              <Animated.View
                onLayout={measure(setLeftW, leftW)}
                style={[
                  styles.nameSlider,
                  {
                    right: 0,
                    // Naapne se pehle chhupa hi rehne do — warna pehla frame
                    // logo ke bagal me chipka hua naam dikha deta hai.
                    opacity: measured ? nameOpacity : 0,
                    transform: [{ translateX: measured ? slide(leftW, -1) : 9999 }],
                  },
                ]}
              >
                <Text numberOfLines={1} style={wordStyle(false)}>
                  Apka
                </Text>
              </Animated.View>
            </View>

            {/* ── "Saathi" — DAAYI taraf (upar wale ka aaina) ───────────── */}
            <View
              pointerEvents="none"
              style={[
                styles.nameWindow,
                { left: size, width: gap + rightW + 8, height: size },
              ]}
            >
              <Animated.View
                onLayout={measure(setRightW, rightW)}
                style={[
                  styles.nameSlider,
                  {
                    left: 0,
                    opacity: measured ? nameOpacity : 0,
                    transform: [{ translateX: measured ? slide(rightW, 1) : -9999 }],
                  },
                ]}
              >
                <Text numberOfLines={1} style={wordStyle(true)}>
                  Saathi
                </Text>
              </Animated.View>
            </View>
          </>
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
   * Naam ke tukde ki khidki.
   *
   * `left`/`right` aur `width` inline aate hain (dono taraf alag hain), yahan
   * sirf wo cheezein hain jo dono me ek jaisi hain. `overflow: hidden` hi wo
   * kainchi hai jo tukde ko logo ke peeche "chhupa" deti hai, aur `absolute`
   * hone se ye layout me koi jagah nahi leti — logo center se nahi hilta.
   */
  nameWindow: { position: "absolute", top: 0, overflow: "hidden", zIndex: 1 },
  nameSlider: { position: "absolute", top: 0, bottom: 0, justifyContent: "center" },
  // letterSpacing 0.3 se 0.6 — chhote size par bhi shabd khule-khule padhte hain,
  // aur logo ke bagal se nikalte waqt "chipke hue" nahi lagte.
  name: { fontWeight: "800", letterSpacing: 0.6 },

  /* ── Gehre parde par (LoaderOverlay) ────────────────────────────────
   *
   * ⚠️ Yahan koi textShadow nahi hai, aur wo jaan-boojh ke hataya gaya hai.
   * Pehle shadow isliye tha kyunki naam parde par ghul jaata tha — wo asli
   * dikkat (kam contrast) ka ilaaj nahi, uspar parda tha. Ab parda khud gehra
   * hai (`scrimLoader`) aur dono rang 5.5:1 se upar hain, to shadow sirf text
   * ko dhundhla karta.
   */
  apkaOnDark: { color: c.onInkSoft },
  saathiOnDark: { color: c.onInkAccent },

  /* ── Saadi cream page par (ScreenLoader) ────────────────────────────
   *
   * Yahan theme-wale token hi sahi hain — ye dono theme me apne aap ulte ho
   * jaate hain. `ink` ki jagah `inkSoft`: "Apka" ko dabaana hai, aur pehle wala
   * `ink` + opacity 0.9 wahi kaam ghuma ke karta tha.
   */
  apkaOnLight: { color: c.inkSoft },
  saathiOnLight: { color: c.terracotta },
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
    /**
     * ⚠️ Ye `c.scrim` NAHI hai — aur wahi is fix ki jad thi.
     *
     * `scrim` aam modal ka parda hai aur light theme me sirf 45% hai (peeche ka
     * form dikhta rehna chahiye). Loader ka naam us halke parde par cream me
     * likha jaata tha — cream page + 45% parda milke ~#9C9790 banta tha, aur us
     * par cream text sirf 2.6:1 par tha. Yaani light mode me naam likha to
     * jaata tha, dikhta nahi tha; dark mode me wahi naam 17.5:1 par saaf tha.
     * User ke liye ye "text mode ke hisaab se badalta nahi" jaisa dikhta tha.
     *
     * `scrimLoader` dono theme me gehra hai — blocking loader ke peeche kuch
     * dikhna zaroori bhi nahi hai.
     */
    backgroundColor: c.scrimLoader,
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
