import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Image,
  Modal,
  Pressable,
  Animated,
  PanResponder,
  StatusBar,
  useWindowDimensions,
  type GestureResponderEvent,
  type PanResponderGestureState,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { makeStyles, useColors } from "@/theme/theme";

/**
 * Document ki photo — poori screen par, aur bada karke.
 *
 * ── Ye kyun bana ────────────────────────────────────────────────────────
 *
 * ⚠️ Shikayat: "document wala me ek cheez aur do, taaki wo image ko alag screen
 * me ek bada karke show ho jisme zoom in ya zoom out hoga".
 *
 * Zaroorat asli hai. `document-view` photo ko screen ki 45% oonchai me
 * `contain` karke dikhata hai — yaani ek passport ka poora page lagbhag 300px
 * me. Us naap par expiry ki date, policy number, ya challan ka amount padha hi
 * nahi ja sakta, aur wahi teen cheezein log document kholte hi dekhna chahte
 * hain. Ab tak ka ek hi raasta tha: document ko phone me download karo aur
 * Gallery me kholo.
 *
 * ── Zoom teen tareeke se, aur teenon jaan-boojh ke ─────────────────────
 *
 *   1. **Do ungli (pinch)** — jise pata hai, uske liye sabse swabhavik.
 *   2. **Do baar tap** — ek jhatke me poora zoom, phir wapas. Ye sabse zyada
 *      istemaal hota hai.
 *   3. **+ / − ke button** — ⚠️ ye teesra hi is app ke liye sabse zaroori hai.
 *      Ye app un logon ke liye bani hai jinke liye pinch ek anjaan ishara hai
 *      (aur kaanpte haath me wo chalta bhi nahi). Bina dikhne wale button ke
 *      unke liye zoom hota hi nahi.
 *
 * ⚠️ `useNativeDriver` yahan JAAN-BOOJH KE nahi hai. Har gesture par transform
 * `setValue()` se badalta hai, aur native driver ke saath us value ko JS se
 * seedha likhna bharosemand nahi rehta (RN wahan ek warning bhi deta hai). Ek
 * hi image ke teen transform JS se chalte hain — sasta phone bhi ise aaram se
 * jhelta hai.
 */

/** Isse zyada bada karne par photo pixel-pixel ho jaati hai — matlab nahi rehta. */
const MAX_SCALE = 5;
/** Isse chhoti karne ka koi matlab nahi: photo pehle se poori screen me `contain` hai. */
const MIN_SCALE = 1;
/** "+" / "−" ka ek kadam. */
const STEP = 0.6;
/** Do tap isse jaldi aaye to wo "double tap" hai. */
const DOUBLE_TAP_MS = 280;
/** Isse upar ko "zoom laga hua hai" maante hain (float ki dhool se bachne ke liye). */
const ZOOM_EPS = 1.02;

export function ImageViewer({
  uri,
  title,
  visible,
  onClose,
}: {
  uri: string | null;
  title?: string;
  visible: boolean;
  onClose: () => void;
}) {
  /**
   * ⚠️ Andar wala hissa band hote hi UNMOUNT ho jaata hai — bilkul wahi tareeka
   * jo `otp-modal.tsx` par hai, aur usi wajah se.
   *
   * Warna har baar khulne par zoom, pan aur `zoomed` — teenon ko haath se reset
   * karna padta, aur wo reset ek `useEffect` me setState hota (jise React ka
   * apna lint theek hi rokta hai: wo ek bekaar ka cascading render hai). Mount
   * hone par sab apne aap naya hota hai, aur pichhli baar ka zoom kabhi chipka
   * hua nahi milta.
   */
  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
      // Landscape me document padhna aksar zaroori hota hai (licence, challan) —
      // isliye ye ek screen app ke portrait wale niyam se azaad hai.
      supportedOrientations={["portrait", "landscape"]}
    >
      {visible && !!uri && <ViewerBody uri={uri} title={title} onClose={onClose} />}
    </Modal>
  );
}

function ViewerBody({
  uri,
  title,
  onClose,
}: {
  uri: string;
  title?: string;
  onClose: () => void;
}) {
  const tc = useColors();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();

  // `useState(() => ...)[0]` — codebase ka idiom. `useRef(new Animated.Value())`
  // render ke beech ref chhoo leta hai, jise lint theek hi pakadta hai.
  const [scale] = useState(() => new Animated.Value(1));
  const [tx] = useState(() => new Animated.Value(0));
  const [ty] = useState(() => new Animated.Value(0));

  /**
   * Abhi ka haal — ref me, state me nahi.
   *
   * ⚠️ Gesture har frame par chalta hai. State me rakhne par har ungli ke hilne
   * par poora component dobara render hota, aur wahi wo jhatka hai jo sasta
   * phone bardasht nahi karta. Ref se render ek bhi baar nahi hota; sirf
   * `Animated.Value` badalti hai.
   */
  const cur = useRef({ s: 1, x: 0, y: 0 });
  /** Gesture shuru hote waqt ka haal — usi par sab hisaab lagta hai. */
  const start = useRef({ s: 1, x: 0, y: 0, dist: 0 });
  const lastTap = useRef(0);

  /**
   * Screen ka naap — ref me.
   *
   * ⚠️ PanResponder ek hi baar banta hai (neeche `useState` ka initializer),
   * isliye uske andar `width`/`height` seedha padhna unhe PEHLE render par jama
   * kar deta. Phone ghumate hi (ya foldable kholte hi) `clamp` purane naap par
   * hisaab lagata rehta — photo screen ke bahar khisak jaati aur wapas aa hi
   * nahi paati.
   */
  const size = useRef({ w: width, h: height });
  useEffect(() => {
    size.current = { w: width, h: height };
  }, [width, height]);

  /** Sirf button ke haal ke liye — gesture ise har frame par nahi chhoota. */
  const [zoomed, setZoomed] = useState(false);

  const api = useRef({
    /** Zoom kitna bhi ho, photo screen se poori tarah bahar na ja sake. */
    clamp(s: number, x: number, y: number) {
      const { w, h } = size.current;
      const maxX = Math.max(0, (w * s - w) / 2);
      const maxY = Math.max(0, (h * s - h) / 2);
      return {
        s,
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    apply(s: number, x: number, y: number, animate = false) {
      const v = api.current.clamp(Math.min(MAX_SCALE, Math.max(MIN_SCALE, s)), x, y);
      cur.current = v;
      setZoomed(v.s > ZOOM_EPS);
      if (animate) {
        Animated.parallel([
          Animated.timing(scale, { toValue: v.s, duration: 180, useNativeDriver: false }),
          Animated.timing(tx, { toValue: v.x, duration: 180, useNativeDriver: false }),
          Animated.timing(ty, { toValue: v.y, duration: 180, useNativeDriver: false }),
        ]).start();
      } else {
        scale.setValue(v.s);
        tx.setValue(v.x);
        ty.setValue(v.y);
      }
    },
  });
  const apply = (s: number, x: number, y: number, animate = false) =>
    api.current.apply(s, x, y, animate);

  const [pan] = useState(() => {
    const dist = (e: GestureResponderEvent) => {
      const t = e.nativeEvent.touches;
      if (t.length < 2) return 0;
      return Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      // ⚠️ Do ungli par HAMESHA lena zaroori hai, chahe ungli hili hi na ho —
      // warna pinch ka pehla lamha nikal jaata hai aur zoom jhatke se lagta hai.
      onMoveShouldSetPanResponder: (e, g) =>
        e.nativeEvent.touches.length === 2 || Math.abs(g.dx) > 3 || Math.abs(g.dy) > 3,
      onPanResponderGrant: (e) => {
        start.current = { ...cur.current, dist: dist(e) };
        // Double tap — do baar jaldi tap = poora zoom, phir wapas.
        const now = Date.now();
        if (e.nativeEvent.touches.length === 1) {
          if (now - lastTap.current < DOUBLE_TAP_MS) {
            lastTap.current = 0;
            api.current.apply(cur.current.s > ZOOM_EPS ? 1 : 2.6, 0, 0, true);
          } else lastTap.current = now;
        }
      },
      onPanResponderMove: (e: GestureResponderEvent, g: PanResponderGestureState) => {
        if (e.nativeEvent.touches.length === 2) {
          const d = dist(e);
          if (!start.current.dist || !d) return;
          api.current.apply(
            start.current.s * (d / start.current.dist),
            start.current.x,
            start.current.y,
          );
          return;
        }
        // Ek ungli: sirf tab sarkao jab photo screen se badi ho. Warna ye
        // "sarakti hui photo" ek toota hua ehsaas deta hai.
        if (cur.current.s <= ZOOM_EPS) return;
        api.current.apply(start.current.s, start.current.x + g.dx, start.current.y + g.dy);
      },
      onPanResponderRelease: () => {
        // Zoom wapas 1 par aa gaya — photo ko beech me le aao, warna wo kinare
        // par atki hui reh jaati hai.
        if (cur.current.s <= ZOOM_EPS) api.current.apply(1, 0, 0, true);
      },
      onPanResponderTerminationRequest: () => false,
    });
  });

  return (
    <>
      <StatusBar barStyle="light-content" />
      <View style={styles.root}>
        <Animated.View
          style={[
            styles.imgWrap,
            { transform: [{ translateX: tx }, { translateY: ty }, { scale }] },
          ]}
          {...pan.panHandlers}
        >
          <Image source={{ uri }} style={{ width, height }} resizeMode="contain" />
        </Animated.View>

        {/* ── Upar: naam + band karo ── */}
        <View style={[styles.top, { paddingTop: insets.top + 8 }]} pointerEvents="box-none">
          <Text style={styles.title} numberOfLines={1}>
            {title ?? ""}
          </Text>
          <Pressable
            onPress={onClose}
            hitSlop={12}
            style={({ pressed }) => [styles.roundBtn, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
          >
            <Ionicons name="close" size={22} color={tc.white} />
          </Pressable>
        </View>

        {/* ── Neeche: zoom ke button ──
            ⚠️ Ye teen button hi is screen ka asli hissa hain (upar wajah likhi
            hai). Bade rakhe gaye hain — 52px, kyunki inhe wo haath dabata hai
            jise pinch nahi aata. */}
        <View
          style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}
          pointerEvents="box-none"
        >
          <Pressable
            onPress={() => apply(cur.current.s - STEP, cur.current.x, cur.current.y, true)}
            disabled={!zoomed}
            hitSlop={8}
            style={({ pressed }) => [
              styles.zoomBtn,
              !zoomed && { opacity: 0.35 },
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Zoom out"
          >
            <Ionicons name="remove" size={24} color={tc.white} />
          </Pressable>

          <Pressable
            onPress={() => apply(1, 0, 0, true)}
            disabled={!zoomed}
            hitSlop={8}
            style={({ pressed }) => [
              styles.resetBtn,
              !zoomed && { opacity: 0.35 },
              pressed && { opacity: 0.7 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Reset zoom"
          >
            <Ionicons name="scan-outline" size={18} color={tc.white} />
          </Pressable>

          <Pressable
            onPress={() => apply(cur.current.s + STEP, cur.current.x, cur.current.y, true)}
            hitSlop={8}
            style={({ pressed }) => [styles.zoomBtn, pressed && { opacity: 0.7 }]}
            accessibilityRole="button"
            accessibilityLabel="Zoom in"
          >
            <Ionicons name="add" size={24} color={tc.white} />
          </Pressable>
        </View>
      </View>
    </>
  );
}

const useStyles = makeStyles(() => ({
  /**
   * ⚠️ Poori tarah kaala — theme ke saath nahi badalta, aur ye jaan-boojh ke
   * hai. Photo dekhne wali har screen (Gallery, WhatsApp, Files) kaali hoti
   * hai: cream background par document ke kinare ghul jaate hain aur ye pata hi
   * nahi chalta ki photo kahan khatam hui.
   */
  root: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" },
  imgWrap: { alignItems: "center", justifyContent: "center" },
  top: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingBottom: 10,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  title: { flex: 1, fontSize: 15.5, fontWeight: "700", color: "#FFFFFF" },
  roundBtn: {
    height: 42,
    width: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  bottom: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    paddingTop: 14,
  },
  zoomBtn: {
    height: 52,
    width: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
  },
  resetBtn: {
    height: 44,
    width: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.12)",
  },
}));

export default ImageViewer;
