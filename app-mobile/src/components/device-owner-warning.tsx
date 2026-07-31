import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  Pressable,
  Modal,
  ScrollView,
  StyleSheet,
  Animated,
  Easing,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { colors } from "@/theme/colors";
import { useT } from "@/lib/i18n/LanguageProvider";
import { tpl } from "@/lib/i18n/dictionaries";
import { useAuth } from "@/components/auth-provider";
import { deviceOwner, getDeviceId, type DeviceOwner } from "@/lib/device";
import { signOut } from "@/lib/auth";

/**
 * "Ye phone kisi aur ke naam par set hai" — login ke baad ek baar.
 *
 * ⚠️ Ye rok NAHI hai. Login ho chuka hai aur chalta rahega; ye sirf wo baat
 * saaf-saaf keh deta hai jo pehle kahin likhi hi nahi thi.
 *
 * Kyun zaroori hai: ek phone par Saathi ki aadhi cheezein chup-chaap us account
 * ke saath badal jaati hain jo abhi login hai —
 *
 *   • FCM ka token phone ka hota hai, user ka nahi. Doosra login karte hi
 *     `save_device_token` us token ka maalik badal deta hai, aur pehle wale user
 *     ke reminder ki notification is phone par aani band ho jaati hai.
 *   • Reminder ke alarm phone ke andar lagte hain, usi user ke data se jo login
 *     hai.
 *   • Referral ka reward ek device par ek hi baar milta hai.
 *
 * In teeno ka koi error nahi aata — sab kuch theek dikhta hai aur kaam chup-chaap
 * nahi hota. Yahi sabse mehnga chup rehne wala fail tha.
 *
 * Ek (device, user) jodi par ek hi baar dikhta hai: baar-baar dikhana chetavni ko
 * bekaar ke popup me badal deta hai, aur log usse bina padhe band karne lagte hain.
 */

const SEEN_PREFIX = "saathi-device-owner-seen:";

export function DeviceOwnerWarning() {
  const { deviceOwner: d } = useT();
  const { session } = useAuth();
  const uid = session?.user?.id;

  const [owner, setOwner] = useState<DeviceOwner | null>(null);
  const [busy, setBusy] = useState(false);
  const scale = useRef(new Animated.Value(0.94)).current;

  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxCardHeight = Math.max(320, height - insets.top - insets.bottom - 48);

  useEffect(() => {
    if (!uid) {
      setOwner(null);
      return;
    }
    let alive = true;
    (async () => {
      const o = await deviceOwner();
      // Maalik hai hi nahi, ya maalik yahi banda hai — kuch dikhane ki baat hi
      // nahi. (Naya phone hamesha isi raaste se nikalta hai.)
      if (!o || o.isMe || !alive) return;

      // Ek baar dikha chuke? Key me device aur user dono — kyunki ek hi phone par
      // teesra banda aaye to usse phir batana chahiye.
      const deviceId = await getDeviceId();
      const key = `${SEEN_PREFIX}${deviceId}:${uid}`;
      const seen = await AsyncStorage.getItem(key).catch(() => null);
      if (seen === "1" || !alive) return;

      setOwner(o);
    })();
    return () => {
      alive = false;
    };
  }, [uid]);

  useEffect(() => {
    if (!owner) return;
    scale.setValue(0.94);
    Animated.timing(scale, {
      toValue: 1,
      duration: 210,
      easing: Easing.out(Easing.back(1.3)),
      useNativeDriver: true,
    }).start();
  }, [owner, scale]);

  /** Band karte waqt hi "dekh liya" likhte hain — kholne par nahi. */
  async function remember() {
    if (!uid) return;
    try {
      const deviceId = await getDeviceId();
      await AsyncStorage.setItem(`${SEEN_PREFIX}${deviceId}:${uid}`, "1");
    } catch {
      /* storage na chale to agli baar phir dikh jayega — koi nuksan nahi */
    }
  }

  async function onOk() {
    await remember();
    setOwner(null);
  }

  async function onLogout() {
    setBusy(true);
    // Yaad rakhna zaroori hai warna: logout -> wahi ID se dobara login -> phir
    // wahi popup. User ko lagta hai app atak gayi hai.
    await remember();
    try {
      await signOut();
    } catch {
      /* net na ho to session waise bhi local se hat jaata hai */
    }
    setOwner(null);
    setBusy(false);
  }

  if (!owner) return null;

  const who = owner.email ?? owner.name ?? "";
  const intro = owner.name
    ? tpl(d.intro, { name: owner.name, email: owner.email ?? "" })
    : tpl(d.introNoName, { email: who });

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onOk}>
      <View
        style={[
          styles.backdrop,
          { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 },
        ]}
      >
        <Animated.View style={[styles.cardWrap, { transform: [{ scale }] }]}>
          <View style={[styles.card, { maxHeight: maxCardHeight }]}>
            <View style={styles.iconWrap}>
              <Ionicons name="phone-portrait" size={26} color={colors.terracotta} />
            </View>

            <Text style={styles.title}>{d.title}</Text>

            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.body}>{intro}</Text>

              <Point icon="notifications" title={d.notifTitle} body={d.notifBody} />
              <Point icon="sparkles" title={d.aiTitle} body={d.aiBody} />
              <Point icon="gift" title={d.rewardTitle} body={d.rewardBody} />

              <View style={styles.advice}>
                <Ionicons name="bulb" size={16} color={colors.terracotta} />
                <Text style={styles.adviceText}>{d.advice}</Text>
              </View>
            </ScrollView>

            <Pressable
              onPress={() => void onLogout()}
              disabled={busy}
              style={({ pressed }) => [
                styles.cta,
                (pressed || busy) && { opacity: 0.85 },
              ]}
            >
              <Text style={styles.ctaText}>{d.logout}</Text>
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
  return (
    <View style={styles.point}>
      <View style={styles.pointIcon}>
        <Ionicons name={icon} size={16} color={colors.terracotta} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.pointTitle}>{title}</Text>
        <Text style={styles.pointBody}>{body}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(46,40,35,0.55)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  cardWrap: { width: "100%", maxWidth: 440 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.line,
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
    color: colors.ink,
    lineHeight: 28,
  },
  // flexShrink: chhoti screen par sirf beech ka hissa scroll karta hai —
  // heading upar aur dono button neeche hamesha dikhte rehte hain.
  scroll: { marginTop: 12, flexShrink: 1 },
  scrollContent: { paddingBottom: 4 },
  body: { fontSize: 14.5, lineHeight: 22, color: colors.inkSoft },
  point: {
    flexDirection: "row",
    gap: 11,
    marginTop: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.cream,
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
  pointTitle: { fontSize: 14, fontWeight: "700", color: colors.ink },
  pointBody: { marginTop: 3, fontSize: 12.5, lineHeight: 18.5, color: colors.inkSoft },
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
    color: colors.ink,
  },
  cta: {
    marginTop: 14,
    height: 50,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.terracotta,
  },
  ctaText: { fontSize: 15.5, fontWeight: "800", color: colors.white },
  ghost: {
    marginTop: 9,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  ghostText: { fontSize: 14, fontWeight: "700", color: colors.inkSoft },
});
