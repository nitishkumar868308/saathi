import { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  Animated,
  Easing,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { makeStyles, useColors } from "@/theme/theme";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";
import { useAuth } from "@/components/auth-provider";
import { useToast } from "@/components/toast";
import { getDeviceId, otherDevices } from "@/lib/device";
import { signOutOtherDevices } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

/**
 * "Aapki ID aur bhi phones par login hai" — login ke baad.
 *
 * ⚠️ Ye `DeviceOwnerWarning` ka ULTA hai, uski nakal nahi. Wo poochta hai "is
 * phone par pehle koi AUR tha kya" — ek phone, do log. Ye poochta hai "main
 * aur kahan-kahan login hoon" — ek account, kai phone.
 *
 * Doosre sawaal ka jawab kahin tha hi nahi. Isliye ek hi ID se paanch phone par
 * login karne par bhi kuch nahi dikhta tha, jabki teen cheezein chup-chaap
 * bikharti rehti hain:
 *
 *   • Reminder ke alarm har phone ke ANDAR lagte hain. Ek phone par time badla
 *     to doosre par purana alarm tab tak wahi rehta hai jab tak wahan app na
 *     khule — ek reminder do alag waqt par bajta hai.
 *   • Admin/reminder ka push har logged-in phone par jaata hai. User ko lagta
 *     hai message do baar aaya (bug), jabki dono phone usi ke naam par hain.
 *   • Har logged-in phone par uske saare documents khule pade hain.
 *
 * Kab dikhta hai: har asli sign-in par, aur uske alawa tabhi jab phone ki
 * ginti pichhli baar se badli ho ya 24 ghante beet gaye hon. Har app-open par
 * dikhana isse ek bekaar popup bana deta — aur log bina padhe band karne lagte
 * hain, jo is chetavni ka poora matlab khatm kar deta hai.
 */

const ACK_PREFIX = "saathi-multi-device-ack:";
const QUIET_MS = 24 * 60 * 60 * 1000;

type Ack = { count: number; at: number };

export function MultiDeviceWarning() {
  const tc = useColors();
  const styles = useStyles();
  const { multiDevice: d } = useT();
  const { session } = useAuth();
  const toast = useToast();
  const uid = session?.user?.id;

  const [count, setCount] = useState(0);
  const [busy, setBusy] = useState(false);
  // useState ka initializer — `useRef(new Animated.Value(...)).current` render ke
  // beech ref chhoo leta hai (react-hooks/refs). Value banti ek hi baar hai.
  const [scale] = useState(() => new Animated.Value(0.94));

  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxCardHeight = Math.max(320, height - insets.top - insets.bottom - 48);

  const ackKey = useCallback(async () => {
    const deviceId = await getDeviceId();
    return `${ACK_PREFIX}${deviceId}:${uid}`;
  }, [uid]);

  /**
   * `force` = abhi-abhi asli sign-in hua. Tab quiet-window nahi lagti: naya
   * login hi wo lamha hai jab ye baat sabse zyada kaam ki hai.
   */
  const check = useCallback(
    async (force: boolean) => {
      if (!uid) return;
      const res = await otherDevices();
      // `null` = RPC hi nahi chali (purana DB / net nahi). Chetavni na dikhna
      // galat chetavni dikhane se behtar hai.
      if (!res || res.count < 1) return;

      if (!force) {
        try {
          const raw = await AsyncStorage.getItem(await ackKey());
          const ack = raw ? (JSON.parse(raw) as Ack) : null;
          // Ginti wahi hai aur abhi thodi der pehle hi dekh chuke — chup raho.
          if (ack && ack.count === res.count && Date.now() - ack.at < QUIET_MS) return;
        } catch {
          /* padha na ja saka to dikha dena hi theek hai */
        }
      }
      setCount(res.count);
    },
    [uid, ackKey],
  );

  // App khulne par (session pehle se hai) — quiet-window ke saath.
  useEffect(() => {
    if (!uid) return;
    void check(false);
  }, [uid, check]);

  // Asli sign-in — hamesha dikhao.
  //
  // ⚠️ `INITIAL_SESSION` ko jaan-boojh ke chhoda hai: wo app khulne par purana
  // session wapas milne par bhi aata hai. Use `force` maan lene par ye modal
  // har app-open par khulta, jo theek wahi bekaar-popup wali galti hai jisse
  // bachna hai. App-open wala raasta upar wala effect (quiet-window ke saath)
  // sambhalta hai.
  useEffect(() => {
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void check(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [check]);

  useEffect(() => {
    if (!count) return;
    scale.setValue(0.94);
    Animated.timing(scale, {
      toValue: 1,
      duration: 210,
      easing: Easing.out(Easing.back(1.3)),
      useNativeDriver: true,
    }).start();
  }, [count, scale]);

  /** Band karte waqt hi "dekh liya" likhte hain — kholne par nahi. */
  async function remember(n: number) {
    if (!uid) return;
    try {
      const ack: Ack = { count: n, at: Date.now() };
      await AsyncStorage.setItem(await ackKey(), JSON.stringify(ack));
    } catch {
      /* storage na chale to agli baar phir dikh jayega — koi nuksan nahi */
    }
  }

  async function onOk() {
    await remember(count);
    setCount(0);
  }

  async function onLogoutOthers() {
    setBusy(true);
    try {
      await signOutOtherDevices();
      // Ab koi doosra phone bacha hi nahi — ack 0 par, taaki agli baar ginti
      // badalte hi (naya login) modal phir aa jaaye.
      await remember(0);
      setCount(0);
      toast.show(d.logoutOthersDone);
    } catch {
      toast.show(d.logoutOthersFailed);
    } finally {
      setBusy(false);
    }
  }

  // Logout hote hi gayab — `uid` bhi dekhte hain kyunki `count` ko effect me
  // reset karna cascading render bana deta hai (aur zaroorat bhi nahi).
  if (!uid || !count) return null;

  const intro = count === 1 ? d.introOne : tpl(d.intro, { count: String(count) });

  return (
    <Modal transparent animationType="fade" visible onRequestClose={() => void onOk()}>
      <View
        style={[
          styles.backdrop,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <Animated.View style={[styles.cardWrap, { transform: [{ scale }] }]}>
          <View style={[styles.card, { maxHeight: maxCardHeight }]}>
            <View style={styles.iconWrap}>
              <Ionicons name="phone-portrait-outline" size={26} color={tc.terracotta} />
            </View>

            <Text style={styles.title}>{d.title}</Text>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.body}>{intro}</Text>

              <Point icon="alarm" title={d.alarmTitle} body={d.alarmBody} />
              <Point icon="notifications" title={d.notifTitle} body={d.notifBody} />
              <Point icon="lock-closed" title={d.privacyTitle} body={d.privacyBody} />

              <View style={styles.advice}>
                <Ionicons name="bulb" size={16} color={tc.terracotta} />
                <Text style={styles.adviceText}>{d.advice}</Text>
              </View>
            </ScrollView>

            <Pressable
              onPress={() => void onLogoutOthers()}
              disabled={busy}
              style={({ pressed }) => [styles.cta, (pressed || busy) && { opacity: 0.85 }]}
            >
              <Text style={styles.ctaText}>{d.logoutOthers}</Text>
            </Pressable>
            <Pressable
              onPress={() => void onOk()}
              disabled={busy}
              style={({ pressed }) => [styles.ghost, pressed && { opacity: 0.85 }]}
            >
              <Text style={styles.ghostText}>{d.ok}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Point({
  icon,
  title,
  body,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
}) {
  const tc = useColors();
  const styles = useStyles();
  return (
    <View style={styles.point}>
      <View style={styles.pointIcon}>
        <Ionicons name={icon} size={16} color={tc.terracotta} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.pointTitle}>{title}</Text>
        <Text style={styles.pointBody}>{body}</Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(46,40,35,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  cardWrap: { width: "100%", maxWidth: 440 },
  card: {
    backgroundColor: c.surface,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: c.line,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
  iconWrap: {
    height: 60,
    width: 60,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.12)",
  },
  title: {
    marginTop: 15,
    fontSize: 21,
    fontWeight: "800",
    color: c.ink,
    lineHeight: 28,
  },
  // flexShrink: chhoti screen par sirf beech ka hissa scroll karta hai —
  // heading upar aur dono button neeche hamesha dikhte rehte hain.
  scroll: { marginTop: 12, flexShrink: 1 },
  scrollContent: { paddingBottom: 4 },
  body: { fontSize: 14.5, lineHeight: 22, color: c.inkSoft },
  point: {
    flexDirection: "row",
    gap: 11,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.cream,
    padding: 12,
  },
  pointIcon: {
    height: 32,
    width: 32,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(194,90,55,0.12)",
  },
  pointTitle: { fontSize: 14, fontWeight: "700", color: c.ink },
  pointBody: { marginTop: 3, fontSize: 12.5, lineHeight: 18.5, color: c.inkSoft },
  advice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginTop: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(194,90,55,0.3)",
    backgroundColor: "rgba(194,90,55,0.07)",
    paddingHorizontal: 13,
    paddingVertical: 11,
  },
  adviceText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "600",
    color: c.ink,
  },
  cta: {
    marginTop: 14,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: c.terracotta,
  },
  ctaText: { fontSize: 15.5, fontWeight: "800", color: c.white },
  ghost: {
    marginTop: 9,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: c.line,
    backgroundColor: c.surface,
  },
  ghostText: { fontSize: 14, fontWeight: "700", color: c.inkSoft },
}));
